use chrono::Local;
use std::fs;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use tauri::async_runtime;

use crate::commands::extract_wikilinks;
use crate::commands::templates::{apply_placeholders, templates_dir};
use crate::error::TessellumError;
use crate::models::{AppState, FileIndex, FileMetadata};
use crate::search::SearchDoc;
use crate::utils::config::load_or_init_config;
use crate::utils::{extract_tags, sanitize_string, validate_path_in_vault};

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
) -> Result<(), TessellumError> {
    let db_guard = state.db.lock().await;
    
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
    
    db_guard
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
    
    db_guard
        .set_note_tags(&path, &inline_tags)
        .await
        .map_err(TessellumError::from)?;
    db_guard
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
    
    Ok(())
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
    let db_guard = state.db.lock().await;
    db_guard
        .index_file(&path_str, 0, 0, None, None, &[])
        .await
        .unwrap_or_else(|e| log::warn!("Failed to index new file: {}", e));
    db_guard
        .set_note_tags(&path_str, &[])
        .await
        .unwrap_or_else(|e| log::warn!("Failed to index new tags: {}", e));
    db_guard
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
    
    Ok(path_str)
}

#[tauri::command]
pub async fn get_or_create_daily_note(
    state: State<'_, AppState>,
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
        
        index_note_content(&state, &vault_path, &full_path_str, &content).await?;
        
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
#[tauri::command]
pub async fn trash_item(
    state: State<'_, AppState>,
    item_path: String,
    vault_path: String,
) -> Result<(), TessellumError> {
    validate_path_in_vault(&item_path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    let item = Path::new(&item_path);
    if !item.exists() {
        return Err(TessellumError::NotFound("Item does not exist".to_string()));
    }
    
    let vault_root = Path::new(&vault_path);
    let trash_dir = vault_root.join(".trash");
    
    if !trash_dir.exists() {
        fs::create_dir_all(&trash_dir).map_err(TessellumError::Io)?;
    }
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    
    let trash_name = generate_trash_name(item, timestamp)
        .ok_or_else(|| TessellumError::Validation("Failed to generate trash name".to_string()))?;
    
    let trash_path = trash_dir.join(&trash_name);
    
    fs::rename(item, &trash_path).map_err(TessellumError::Io)?;
    
    // Recursively rename contents if it's a directory
    if trash_path.is_dir() {
        rename_recursively(&trash_path, timestamp).map_err(TessellumError::Io)?;
    }
    
    let db_guard = state.db.lock().await;
    db_guard
        .delete_file(&item_path)
        .await
        .map_err(TessellumError::from)?;
    db_guard
        .delete_search_files(&[item_path.clone()])
        .await
        .map_err(TessellumError::from)?;
    
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
    
    Ok(())
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
    
    index_note_content(&state, &vault_path, &path, &content).await?;
    
    Ok(())
}

/// Generates a "trash name" for the provided path, incorporating a cleaned-up parent directory name
/// and a timestamp for unique identification.
fn generate_trash_name(path: &Path, timestamp: u128) -> Option<String> {
    let filename = path.file_name()?.to_string_lossy();
    
    // Get parent name, but clean it up
    let raw_parent = path
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy())
        .unwrap_or_else(|| "root".into());
    
    // Simple parser: Stop at the first " (" to strip previous timestamps
    let clean_parent = raw_parent.split(" (").next().unwrap_or(&raw_parent);
    
    if path.is_dir() {
        Some(format!("{} ({}) {}", filename, clean_parent, timestamp))
    } else {
        let stem = filename.trim_end_matches(".md");
        Some(format!("{} ({}) {}.md", stem, clean_parent, timestamp))
    }
}

/// Recursively renames files and directories within a given directory, appending a timestamp-based
/// identifier to their names.
fn rename_recursively(dir: &Path, timestamp: u128) -> std::io::Result<()> {
    use std::path::PathBuf;
    
    if !dir.is_dir() {
        return Ok(());
    }
    
    // Collect paths first to avoid issues while modifying the directory
    let entries: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|e| e.ok().map(|entry| entry.path()))
        .collect();
    
    for path in entries {
        if let Some(new_name) = generate_trash_name(&path, timestamp) {
            let new_path = path.parent().unwrap().join(new_name);
            
            // Rename the current item
            fs::rename(&path, &new_path)?;
            
            // If it is a directory, we must recurse into the NEW path
            if new_path.is_dir() {
                rename_recursively(&new_path, timestamp)?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_all_notes(
    state: State<'_, AppState>,
) -> Result<Vec<(String, i64)>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard
        .get_all_indexed_files()
        .await
        .map_err(TessellumError::from)
}

use serde::Serialize;

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
    let db_guard = state.db.lock().await;
    let files = db_guard
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
    let db_guard = state.db.lock().await;
    db_guard.get_all_tags().await.map_err(TessellumError::from)
}
#[tauri::command]
pub async fn get_file_tags(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, TessellumError> {
    let db_guard = state.db.lock().await;
    let normalized = crate::utils::normalize_path(&path);
    db_guard
        .get_file_tags(&normalized)
        .await
        .map_err(TessellumError::from)
}

#[tauri::command]
pub async fn get_all_property_keys(
    state: State<'_, AppState>,
) -> Result<Vec<String>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard
        .get_all_property_keys()
        .await
        .map_err(TessellumError::from)
}

#[cfg(test)]
mod tests {
    use super::build_daily_note_relative_path;
    use chrono::TimeZone;
    
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
}
