use chrono::Local;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tauri::async_runtime;
use tokio::time::{Duration, timeout};
use walkdir::WalkDir;
use crate::commands::extract_wikilinks;
use crate::commands::templates::{apply_placeholders, templates_dir};
use crate::error::TessellumError;
use crate::indexer::VaultIndexer;
use crate::grafeo_projection::{
    ManagedGrafeoConnection, sync_full, sync_link_create, sync_link_delete, sync_note_delete,
    sync_note_upsert,
};
use crate::models::{AppState, FileIndex, FileMetadata};
use crate::search::SearchDoc;
use crate::trash::{
    build_restored_destination_path, generate_unique_trash_path, parse_trash_entry_name,
    parse_trash_timestamp, permanently_delete_trash_entry, rename_recursively,
    restore_trashed_names_recursively,
};
use crate::utils::config::load_or_init_config;
use crate::utils::{extract_tags, sanitize_string, validate_path_in_vault};

struct NoteSyncDelta {
    note_id: String,
    previous_links: Vec<String>,
    current_links: Vec<String>,
}

#[derive(Serialize)]
pub struct TrashItemsResult {
    deleted_paths: Vec<String>,
    failed: Vec<TrashItemFailure>,
}

#[derive(Serialize)]
pub struct TrashItemFailure {
    item_path: String,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrashItemMetadata {
    path: String,
    filename: String,
    display_name: String,
    original_name: String,
    parent_label: String,
    restore_path: String,
    is_dir: bool,
    timestamp: u128,
}

fn get_trash_dir(vault_root: &Path) -> PathBuf {
    vault_root.join(".trash")
}

fn canonicalize_existing_path(path: &Path) -> Result<PathBuf, TessellumError> {
    path.canonicalize().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            TessellumError::NotFound(path.to_string_lossy().to_string())
        } else {
            TessellumError::Io(error)
        }
    })
}

fn validate_top_level_trash_entry(trash_item_path: &Path, vault_root: &Path) -> Result<PathBuf, TessellumError> {
    let resolved_item = canonicalize_existing_path(trash_item_path)?;
    let resolved_trash_dir = canonicalize_existing_path(&get_trash_dir(vault_root))?;
    
    let parent = resolved_item.parent().ok_or_else(|| {
        TessellumError::Validation("Trash entry must have a parent directory".to_string())
    })?;
    
    if parent != resolved_trash_dir {
        return Err(TessellumError::Validation(
            "Trash actions only support top-level .trash entries".to_string(),
        ));
    }
    
    Ok(resolved_item)
}

fn candidate_directory_priority(path: &Path) -> (usize, String) {
    (
        path.components().count(),
        crate::utils::normalize_path(&path.to_string_lossy()),
    )
}

fn resolve_restore_directory(vault_root: &Path, parent_label: &str) -> PathBuf {
    if parent_label.eq_ignore_ascii_case("Root") {
        return vault_root.to_path_buf();
    }
    
    let mut matches: Vec<PathBuf> = WalkDir::new(vault_root)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.into_path())
        .filter(|path| path.is_dir())
        .filter(|path| !path.starts_with(get_trash_dir(vault_root)))
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .map(|value| value == parent_label)
                .unwrap_or(false)
        })
        .collect();
    
    matches.sort_by_key(|path| candidate_directory_priority(path));
    matches
        .into_iter()
        .next()
        .unwrap_or_else(|| vault_root.join(parent_label))
}

fn build_trash_item_metadata(vault_root: &Path, entry_path: &Path) -> Option<TrashItemMetadata> {
    let filename = entry_path.file_name()?.to_string_lossy().to_string();
    let is_dir = entry_path.is_dir();
    let timestamp = parse_trash_timestamp(&filename)?;
    let parsed = parse_trash_entry_name(&filename, is_dir)?;
    let restore_dir = resolve_restore_directory(vault_root, &parsed.parent_label);
    let restore_path = restore_dir.join(&parsed.original_name);
    
    Some(TrashItemMetadata {
        path: crate::utils::normalize_path(&entry_path.to_string_lossy()),
        filename,
        display_name: parsed.original_name.clone(),
        original_name: parsed.original_name.clone(),
        parent_label: parsed.parent_label,
        restore_path: crate::utils::normalize_path(&restore_path.to_string_lossy()),
        is_dir,
        timestamp,
    })
}

fn list_trash_items_internal(vault_root: &Path) -> Result<Vec<TrashItemMetadata>, TessellumError> {
    let trash_dir = get_trash_dir(vault_root);
    if !trash_dir.exists() {
        return Ok(Vec::new());
    }
    
    let entries = fs::read_dir(&trash_dir).map_err(TessellumError::Io)?;
    let mut items = Vec::new();
    
    for entry in entries {
        let entry = entry.map_err(TessellumError::Io)?;
        if let Some(item) = build_trash_item_metadata(vault_root, &entry.path()) {
            items.push(item);
        }
    }
    
    items.sort_by(|left, right| right.timestamp.cmp(&left.timestamp));
    Ok(items)
}

fn restore_trash_item_internal_for_tests(
    vault_root: &Path,
    trash_item_path: &Path,
) -> Result<PathBuf, TessellumError> {
    let resolved_entry = validate_top_level_trash_entry(trash_item_path, vault_root)?;
    let filename = resolved_entry
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| TessellumError::Validation("Invalid trash entry name".to_string()))?;
    let is_dir = resolved_entry.is_dir();
    let parsed = parse_trash_entry_name(filename, is_dir)
        .ok_or_else(|| TessellumError::Validation("Invalid trash entry format".to_string()))?;
    let restore_dir = resolve_restore_directory(vault_root, &parsed.parent_label);
    fs::create_dir_all(&restore_dir).map_err(TessellumError::Io)?;
    let destination = build_restored_destination_path(&restore_dir, &parsed.original_name)
        .ok_or_else(|| TessellumError::Validation("Failed to resolve restore destination".to_string()))?;
    fs::rename(&resolved_entry, &destination).map_err(TessellumError::Io)?;
    if destination.is_dir() {
        restore_trashed_names_recursively(&destination).map_err(TessellumError::Io)?;
    }
    Ok(destination)
}

async fn refresh_indexes_after_restore(
    state: &State<'_, AppState>,
    kuzu_state: &State<'_, ManagedGrafeoConnection>,
    vault_path: &str,
) {
    let db = state.db.clone();
    let search_index = state.search_index.clone();
    
    if let Err(error) = VaultIndexer::full_sync(db.as_ref(), search_index, vault_path).await {
        eprintln!("Vault sync failed after restore: {}", error);
    }
    
    if let Err(error) = sync_full(kuzu_state.inner(), db.as_ref()).await {
        eprintln!("Kuzu sync_full failed after restore: {}", error);
    }
    
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    let mut asset_guard = state.asset_index.lock().await;
    *asset_guard = None;
}

fn build_daily_note_relative_path(template: &str, now: chrono::DateTime<Local>) -> String {
    let year = now.format("%Y").to_string();
    let month = now.format("%m").to_string();
    let day = now.format("%d").to_string();
    
    let mut path = template
        .replace("{YYYY}", &year)
        .replace("{MM}", &month)
        .replace("{DD}", &day)
        .replace('\\', "/");
    
    if !path.to_lowercase().ends_with(".md") {
        path = format!("{}.md", path);
    }
    
    path
}

fn validate_template_name(template_name: &str) -> Result<(), TessellumError> {
    let trimmed = template_name.trim();
    if trimmed.is_empty() {
        return Err(TessellumError::Validation(
            "Template name cannot be empty".to_string(),
        ));
    }
    
    let mut components = Path::new(trimmed).components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(()),
        _ => Err(TessellumError::Validation(
            "Template name must be a filename without path separators".to_string(),
        )),
    }
}

async fn index_note_content(
    state: &State<'_, AppState>,
    vault_path: &str,
    path: &str,
    content: &str,
) -> Result<NoteSyncDelta, TessellumError> {
    let db = state.db.clone();
    let previous_links = db
        .get_outgoing_links(path)
        .await
        .map_err(TessellumError::from)?;
    
    let metadata = tokio::fs::metadata(&path).await.map_err(|e| {
        TessellumError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to get metadata for {}: {}", path, e),
        ))
    })?;
    
    let size = metadata.len();
    let modified = metadata
        .modified()
        .map_err(|e| {
            TessellumError::Io(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to get modified time: {}", e),
            ))
        })?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    
    let mut frontmatter_json_str = None;
    let mut body_content = content;
    
    if let Some((yaml, _)) = crate::utils::frontmatter::parse_frontmatter(&content) {
        body_content = crate::utils::frontmatter::strip_frontmatter(&content);
        if let Ok(json) = crate::utils::frontmatter::frontmatter_to_json(&yaml) {
            frontmatter_json_str = Some(json);
        }
    }
    
    let inline_tags = extract_tags(content);
    
    let inline_tags_json_str = if inline_tags.is_empty() {
        None
    } else {
        serde_json::to_string(&inline_tags).ok()
    };
    
    let wikilinks = extract_wikilinks(body_content);
    
    let index_guard = state.file_index.lock().await;
    let file_index = match index_guard.as_ref() {
        Some(idx) => idx.clone(),
        None => {
            drop(index_guard);
            let idx = FileIndex::build(&vault_path).map_err(|e| {
                TessellumError::Internal(format!("Failed to build file index: {}", e))
            })?;
            let mut guard = state.file_index.lock().await;
            *guard = Some(idx.clone());
            idx
        }
    };
    
    let resolved_links: Vec<String> = wikilinks
        .iter()
        .map(|link| {
            crate::utils::normalize_path(
                &file_index
                    .resolve_or_default(&vault_path, &link.target)
                    .to_string_lossy(),
            )
        })
        .collect();
    let mut deduped_links = resolved_links.clone();
    deduped_links.sort();
    deduped_links.dedup();
    
    db
        .index_file(
            &path,
            modified,
            size,
            frontmatter_json_str.as_deref(),
            inline_tags_json_str.as_deref(),
            &resolved_links,
        )
        .await
        .map_err(TessellumError::from)?;
    
    db
        .set_note_tags(&path, &inline_tags)
        .await
        .map_err(TessellumError::from)?;
    db
        .upsert_search_file(&path, modified, true)
        .await
        .map_err(TessellumError::from)?;
    
    let title = Path::new(path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
        .trim_end_matches(".md")
        .to_string();
    
    let doc = SearchDoc {
        path: crate::utils::normalize_path(path),
        title,
        body: body_content.to_string(),
        tags: inline_tags,
    };
    
    let search_index = state.search_index.clone();
    async_runtime::spawn_blocking(move || {
        let guard = async_runtime::block_on(search_index.lock());
        guard.index_batch(&[doc], &[]).ok();
    });
    
    log::debug!(
        "Indexed file: {} with {} resolved links",
        path,
        resolved_links.len()
    );
    
    Ok(NoteSyncDelta {
        note_id: crate::utils::normalize_path(path),
        previous_links,
        current_links: deduped_links,
    })
}

async fn sync_note_delta_non_critical(
    state: &State<'_, AppState>,
    kuzu_state: &State<'_, ManagedGrafeoConnection>,
    delta: NoteSyncDelta,
) {
    let db = state.db.clone();
    if let Err(err) = sync_note_upsert(kuzu_state.inner(), db.as_ref(), &delta.note_id).await {
        eprintln!(
            "Kuzu sync_note_upsert failed for '{}': {}",
            delta.note_id, err
        );
        return;
    }
    
    let previous: HashSet<String> = delta.previous_links.into_iter().collect();
    let current: HashSet<String> = delta.current_links.into_iter().collect();
    
    for to_id in current.difference(&previous) {
        if let Err(err) = sync_link_create(kuzu_state.inner(), &delta.note_id, to_id) {
            eprintln!(
                "Kuzu sync_link_create failed for '{} -> {}': {}",
                delta.note_id, to_id, err
            );
        }
    }
    
    for to_id in previous.difference(&current) {
        if let Err(err) = sync_link_delete(kuzu_state.inner(), &delta.note_id, to_id) {
            eprintln!(
                "Kuzu sync_link_delete failed for '{} -> {}': {}",
                delta.note_id, to_id, err
            );
        }
    }
}

/// Creates a new note file in the specified vault directory with a unique name.
///
/// This function takes in a vault path and a title string to create a new `.md`
/// file in the specified vault directory. If the provided title contains
/// invalid characters or is empty, it is sanitized or defaulted to "Untitled".
/// If a file with the same name already exists, the function appends a numeric suffix
/// to the filename to ensure its uniqueness.
#[tauri::command]
pub async fn create_note(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
    title: String,
) -> Result<String, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    let clean_title = sanitize_string(title);
    
    if clean_title.trim().is_empty() {
        return Err(TessellumError::Validation(
            "Title cannot be empty".to_string(),
        ));
    }
    
    // Create a file path
    let mut filename = if clean_title.to_lowercase().ends_with(".md") {
        clean_title.clone()
    } else {
        format!("{}.md", clean_title)
    };
    let mut file_path = Path::new(&vault_path).join(&filename);
    let mut collision_index = 1;
    
    // Check for collisions in the filenames
    while file_path.exists() {
        let stem = clean_title.strip_suffix(".md").unwrap_or(&clean_title);
        filename = format!("{} ({}).md", stem, collision_index);
        file_path = Path::new(&vault_path).join(&filename);
        collision_index += 1;
    }
    
    // Create an empty file
    tokio::fs::write(&file_path, String::new())
        .await
        .map_err(TessellumError::from)?;
    
    let path_str = crate::utils::normalize_path(&file_path.to_string_lossy());
    
    // Update the index immediately if DB is ready
    let db = state.db.clone();
    db
        .index_file(&path_str, 0, 0, None, None, &[])
        .await
        .unwrap_or_else(|e| log::warn!("Failed to index new file: {}", e));
    db
        .set_note_tags(&path_str, &[])
        .await
        .unwrap_or_else(|e| log::warn!("Failed to index new tags: {}", e));
    db
        .upsert_search_file(&path_str, 0, true)
        .await
        .unwrap_or_else(|e| log::warn!("Failed to index search file: {}", e));
    
    // Invalidate the cache since a new file exists
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    let mut asset_guard = state.asset_index.lock().await;
    *asset_guard = None;
    
    let search_index = state.search_index.clone();
    let title = Path::new(&path_str)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
        .trim_end_matches(".md")
        .to_string();
    let doc = SearchDoc {
        path: path_str.clone(),
        title,
        body: String::new(),
        tags: Vec::new(),
    };
    async_runtime::spawn_blocking(move || {
        let guard = async_runtime::block_on(search_index.lock());
        guard.index_batch(&[doc], &[]).ok();
    });
    
    let db = state.db.clone();
    if let Err(err) = sync_note_upsert(kuzu_state.inner(), db.as_ref(), &path_str).await {
        eprintln!("Kuzu sync_note_upsert failed for '{}': {}", path_str, err);
    }
    
    Ok(path_str)
}

#[tauri::command]
pub async fn get_or_create_daily_note(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
) -> Result<FileMetadata, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    let config = load_or_init_config(&vault_path)?;
    let now = Local::now();
    let relative_path = build_daily_note_relative_path(&config.daily_notes.path_template, now);
    let full_path = Path::new(&vault_path).join(&relative_path);
    if Path::new(&relative_path).is_absolute() {
        return Err(TessellumError::Validation(
            "Daily note path must be relative".to_string(),
        ));
    }
    
    let full_path_str = crate::utils::normalize_path(&full_path.to_string_lossy());
    
    if let Some(parent) = full_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(TessellumError::from)?;
        
        let parent_str = crate::utils::normalize_path(&parent.to_string_lossy());
        validate_path_in_vault(&parent_str, &vault_path)
            .map_err(|e| TessellumError::Validation(e))?;
    }
    
    if !full_path.exists() {
        let title = now.format("%Y-%m-%d").to_string();
        let template_name = config.daily_notes.template_name.trim();
        validate_template_name(template_name)?;
        let template_path = templates_dir(&vault_path).join(format!("{}.md", template_name));
        
        let content = if template_path.exists() {
            validate_path_in_vault(&template_path.to_string_lossy(), &vault_path)
                .map_err(TessellumError::Validation)?;
            let template_content = tokio::fs::read_to_string(&template_path)
                .await
                .map_err(TessellumError::from)?;
            apply_placeholders(&template_content, &title, &vault_path, now)
        } else {
            format!("# {}\n", title)
        };
        
        tokio::fs::write(&full_path, &content)
            .await
            .map_err(TessellumError::from)?;
        
        let delta = index_note_content(&state, &vault_path, &full_path_str, &content).await?;
        sync_note_delta_non_critical(&state, &kuzu_state, delta).await;
        
        let mut idx_guard = state.file_index.lock().await;
        *idx_guard = None;
        let mut asset_guard = state.asset_index.lock().await;
        *asset_guard = None;
    }
    
    let metadata = tokio::fs::metadata(&full_path).await.map_err(|e| {
        TessellumError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to get metadata for {}: {}", full_path_str, e),
        ))
    })?;
    
    let filename = full_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    
    Ok(FileMetadata {
        path: full_path_str,
        filename,
        is_dir: false,
        size: metadata.len(),
        last_modified: metadata
            .modified()
            .map_err(|e| {
                TessellumError::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to get modified time: {}", e),
                ))
            })?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64,
    })
}

/// Moves a note or folder to a trash directory within the specified vault directory.
///
/// This function is useful for "soft-deleting" items by moving them to a `.trash`
/// subdirectory within a vault, while ensuring that the filenames are unique
/// using a timestamp.
async fn trash_item_internal(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    item_path: String,
    vault_path: String,
) -> Result<(), TessellumError> {
    validate_path_in_vault(&item_path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    let item = Path::new(&item_path);
    if !item.exists() {
        
        return Err(TessellumError::NotFound("Item does not exist".to_string()));
    }
    let was_file = item.is_file();
    
    let vault_root = Path::new(&vault_path);
    let trash_dir = vault_root.join(".trash");
    
    if !trash_dir.exists() {
        fs::create_dir_all(&trash_dir)
            .map_err(TessellumError::Io)?;
    }
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let trash_path = generate_unique_trash_path(&trash_dir, item, timestamp)
        .ok_or_else(|| TessellumError::Validation("Failed to generate trash name".to_string()))?;
    
    tokio::fs::rename(item, &trash_path)
        .await
        .map_err(TessellumError::Io)?;
    
    // Recursively rename contents if it's a directory
    if trash_path.is_dir() {
        rename_recursively(&trash_path, timestamp).map_err(TessellumError::Io)?;
    }
    
    // Database/index cleanup is best-effort. The file is already moved to trash,
    // so we avoid blocking the entire bulk operation on long-running DB operations.
    let db = state.db.clone();
    
    match timeout(Duration::from_secs(5), db.delete_file(&item_path)).await {
        Ok(Ok(())) => {}
        Ok(Err(_)) => {},
        Err(_) => todo!()
    }
    
    match timeout(
        Duration::from_secs(5),
        db.delete_search_files(&[item_path.clone()]),
    )
        .await
    {
        Ok(Ok(_)) => {}
        Err(_) => {
        }
        _ => {}
    }
    
    
    let search_index = state.search_index.clone();
    let path = item_path.clone();
    async_runtime::spawn_blocking(move || {
        let guard = async_runtime::block_on(search_index.lock());
        guard.delete_path(&path).ok();
    });
    
    // Invalidate the cache
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    let mut asset_guard = state.asset_index.lock().await;
    *asset_guard = None;
    
    if was_file {
        if let Err(err) = sync_note_delete(kuzu_state.inner(), &crate::utils::normalize_path(&item_path)) {
            eprintln!("Kuzu sync_note_delete failed for '{}': {}", item_path, err);
        }
    } else {
        match timeout(Duration::from_secs(5), sync_full(kuzu_state.inner(), db.as_ref())).await {
            Ok(Ok(())) => {}
            Ok(Err(err)) => {
                eprintln!(
                    "Kuzu sync_full failed after trashing '{}': {}",
                    item_path, err
                );
            }
            Err(_) => {
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn trash_item(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    item_path: String,
    vault_path: String,
) -> Result<(), TessellumError> {
    trash_item_internal(state, kuzu_state, item_path, vault_path).await
}

#[tauri::command]
pub async fn trash_items(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    item_paths: Vec<String>,
    vault_path: String,
) -> Result<TrashItemsResult, TessellumError> {
    
    let mut deleted_paths = Vec::new();
    let mut failed = Vec::new();
    
    for (_index, item_path) in item_paths.into_iter().enumerate() {
        
        match trash_item_internal(
            state.clone(),
            kuzu_state.clone(),
            item_path.clone(),
            vault_path.clone(),
        )
            .await
        {
            Ok(()) => {
                
                deleted_paths.push(item_path);
            }
            Err(error) => {
                let message = error.to_string();
                
                failed.push(TrashItemFailure { item_path, message });
            }
        }
    }
    
    Ok(TrashItemsResult {
        deleted_paths,
        failed,
    })
}

#[tauri::command]
pub async fn list_trash_items(vault_path: String) -> Result<Vec<TrashItemMetadata>, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(|error| TessellumError::Validation(error))?;
    list_trash_items_internal(Path::new(&vault_path))
}

#[tauri::command]
pub async fn restore_trash_item(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    trash_item_path: String,
    vault_path: String,
) -> Result<String, TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(|error| TessellumError::Validation(error))?;
    let vault_root = Path::new(&vault_path);
    let restored_path = restore_trash_item_internal_for_tests(vault_root, Path::new(&trash_item_path))?;
    let normalized_restored_path = crate::utils::normalize_path(&restored_path.to_string_lossy());
    refresh_indexes_after_restore(&state, &kuzu_state, &vault_path).await;
    Ok(normalized_restored_path)
}

#[tauri::command]
pub async fn delete_trash_item_permanently(
    trash_item_path: String,
    vault_path: String,
) -> Result<(), TessellumError> {
    validate_path_in_vault(&vault_path, &vault_path).map_err(|error| TessellumError::Validation(error))?;
    let resolved_entry = validate_top_level_trash_entry(Path::new(&trash_item_path), Path::new(&vault_path))?;
    permanently_delete_trash_entry(&resolved_entry).map_err(TessellumError::Io)
}

/// Reads the contents of a file at the given path and returns it as a `String`.
/// The path is validated to be inside the vault directory.
#[tauri::command]
pub async fn read_file(vault_path: String, path: String) -> Result<String, TessellumError> {
    // Validate path inside vault
    validate_path_in_vault(&path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    tokio::fs::read_to_string(&path)
        .await
        .map_err(TessellumError::from)
}

/// Writes the specified content to a file at the given path.
/// Also updates the database index with resolved wikilinks.
#[tauri::command]
pub async fn write_file(
    state: State<'_, AppState>,
    kuzu_state: State<'_, ManagedGrafeoConnection>,
    vault_path: String,
    path: String,
    content: String,
) -> Result<(), TessellumError> {
    // Validate path inside vault
    validate_path_in_vault(&path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    // Write file
    tokio::fs::write(&path, &content)
        .await
        .map_err(TessellumError::from)?;
    
    let delta = index_note_content(&state, &vault_path, &path, &content).await?;
    sync_note_delta_non_critical(&state, &kuzu_state, delta).await;
    
    Ok(())
}

#[tauri::command]
pub async fn get_all_notes(
    state: State<'_, AppState>,
) -> Result<Vec<(String, i64)>, TessellumError> {
    let db = state.db.clone();
    db
        .get_all_indexed_files()
        .await
        .map_err(TessellumError::from)
}

#[derive(Serialize)]
pub struct NoteSuggestion {
    pub name: String,
    pub relative_path: String,
    pub full_path: String,
}

/// Search for notes matching a query.
/// Returns suggestions formatted for the wikilink auto-complete.
#[tauri::command]
pub async fn search_notes(
    state: State<'_, AppState>,
    vault_path: String,
    query: String,
) -> Result<Vec<NoteSuggestion>, TessellumError> {
    let db = state.db.clone();
    let files = db
        .get_all_indexed_files()
        .await
        .map_err(TessellumError::from)?;
    
    let query_lower = query.to_lowercase();
    let vault_root = Path::new(&vault_path);
    
    let mut suggestions = Vec::new();
    
    for (path_str, _) in files {
        let path = Path::new(&path_str);
        
        let filename = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        
        let name = filename
            .strip_suffix(".md")
            .unwrap_or(&filename)
            .to_string();
        
        let relative_path = if let Ok(rel) = path.strip_prefix(vault_root) {
            crate::utils::normalize_path(&rel.to_string_lossy())
        } else {
            crate::utils::normalize_path(&path_str)
        };
        
        if query_lower.is_empty()
            || name.to_lowercase().contains(&query_lower)
            || relative_path.to_lowercase().contains(&query_lower)
        {
            suggestions.push(NoteSuggestion {
                name,
                relative_path,
                full_path: crate::utils::normalize_path(&path_str),
            });
        }
    }
    
    Ok(suggestions)
}

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<String>, TessellumError> {
    let db = state.db.clone();
    db.get_all_tags().await.map_err(TessellumError::from)
}
#[tauri::command]
pub async fn get_file_tags(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, TessellumError> {
    let db = state.db.clone();
    let normalized = crate::utils::normalize_path(&path);
    db
        .get_file_tags(&normalized)
        .await
        .map_err(TessellumError::from)
}

#[tauri::command]
pub async fn get_all_property_keys(
    state: State<'_, AppState>,
) -> Result<Vec<String>, TessellumError> {
    let db = state.db.clone();
    db
        .get_all_property_keys()
        .await
        .map_err(TessellumError::from)
}

#[cfg(test)]
mod tests {
    use super::{build_daily_note_relative_path, list_trash_items_internal, restore_trash_item_internal_for_tests};
    use chrono::TimeZone;
    use std::fs;
    use tempfile::tempdir;
    
    #[test]
    fn test_build_daily_note_relative_path() {
        let now = chrono::Local
            .with_ymd_and_hms(2026, 3, 11, 9, 0, 0)
            .unwrap();
        let path = build_daily_note_relative_path("Daily/{YYYY}/{MM}/{DD}.md", now);
        assert_eq!(path, "Daily/2026/03/11.md");
    }
    
    #[test]
    fn test_build_daily_note_relative_path_adds_md() {
        let now = chrono::Local
            .with_ymd_and_hms(2026, 3, 11, 9, 0, 0)
            .unwrap();
        let path = build_daily_note_relative_path("Daily/{YYYY}-{MM}-{DD}", now);
        assert_eq!(path, "Daily/2026-03-11.md");
    }
    
    #[test]
    fn list_trash_items_returns_clean_names_sorted_newest_first() {
        let dir = tempdir().unwrap();
        let vault = dir.path();
        let trash = vault.join(".trash");
        fs::create_dir_all(&trash).unwrap();
        fs::write(trash.join("Alpha (Root) 1000.md"), "").unwrap();
        fs::write(trash.join("Beta (Root) 2000.md"), "").unwrap();
        
        let listed = list_trash_items_internal(vault).unwrap();
        
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].display_name, "Beta.md");
        assert_eq!(listed[1].display_name, "Alpha.md");
    }
    
    #[test]
    fn restore_trash_item_moves_file_back_to_root_with_clean_name() {
        let dir = tempdir().unwrap();
        let vault = dir.path();
        let trash = vault.join(".trash");
        fs::create_dir_all(&trash).unwrap();
        let trashed = trash.join("Note (Root) 1740681450123.md");
        fs::write(&trashed, "restored").unwrap();
        
        let restored_path = restore_trash_item_internal_for_tests(vault, &trashed).unwrap();
        
        assert_eq!(restored_path, vault.join("Note.md"));
        assert_eq!(fs::read_to_string(vault.join("Note.md")).unwrap(), "restored");
        assert!(!trashed.exists());
    }
    
    #[test]
    fn restore_trash_item_uses_restored_suffix_when_destination_exists() {
        let dir = tempdir().unwrap();
        let vault = dir.path();
        let trash = vault.join(".trash");
        fs::create_dir_all(&trash).unwrap();
        fs::write(vault.join("Note.md"), "existing").unwrap();
        let trashed = trash.join("Note (Root) 1740681450123.md");
        fs::write(&trashed, "restored").unwrap();
        
        let restored_path = restore_trash_item_internal_for_tests(vault, &trashed).unwrap();
        
        assert_eq!(restored_path, vault.join("Note (Restored).md"));
        assert_eq!(fs::read_to_string(restored_path).unwrap(), "restored");
    }
    
    #[test]
    fn restore_trashed_folder_recursively_restores_child_names() {
        let dir = tempdir().unwrap();
        let vault = dir.path();
        let trash = vault.join(".trash");
        let trashed_dir = trash.join("Project (Root) 1740681450123");
        fs::create_dir_all(&trashed_dir).unwrap();
        fs::write(
            trashed_dir.join("Child Note (Project) 1740681450123.md"),
            "nested",
        )
            .unwrap();
        
        let restored_path = restore_trash_item_internal_for_tests(vault, &trashed_dir).unwrap();
        
        assert!(restored_path.join("Child Note.md").exists());
        assert_eq!(
            fs::read_to_string(restored_path.join("Child Note.md")).unwrap(),
            "nested"
        );
    }
}
