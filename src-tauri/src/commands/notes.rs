use regex::Regex;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::commands::extract_wikilinks;
use crate::error::TessellumError;
use crate::models::{AppState, FileIndex};
use crate::utils::{sanitize_string, validate_path_in_vault};

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
    
    // Invalidate the cache since a new file exists
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    
    Ok(path_str)
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
    
    // Invalidate the cache
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    
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
    
    let db_guard = state.db.lock().await;
    
    // 2. Get metadata AFTER writing
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
    
    // Parse frontmatter
    let mut frontmatter_json_str = None;
    let mut body_content = content.as_str();
    
    if let Some((yaml, _)) = crate::utils::frontmatter::parse_frontmatter(&content) {
        body_content = crate::utils::frontmatter::strip_frontmatter(&content);
        if let Ok(json) = crate::utils::frontmatter::frontmatter_to_json(&yaml) {
            frontmatter_json_str = Some(json);
        }
    }
    
    // 3. Extract inline tags
    let tag_regex = Regex::new(r"(?:^|\s)#([a-zA-Z0-9_\-]+)").unwrap();
    let mut inline_tags = Vec::new();
    for cap in tag_regex.captures_iter(body_content) {
        if let Some(tag_match) = cap.get(1) {
            inline_tags.push(tag_match.as_str().to_string());
        }
    }
    
    let inline_tags_json_str = if inline_tags.is_empty() {
        None
    } else {
        serde_json::to_string(&inline_tags).ok()
    };
    
    // 4. Extract wikilinks
    let wikilinks = extract_wikilinks(body_content);
    
    // 5. Build or use cached file index for resolving links
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
    
    // 6. Resolve each wikilink to its full path (non-existent targets get a fallback path)
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
    
    // 7. Index the file with resolved links
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
    
    log::debug!(
        "Indexed file: {} with {} resolved links",
        path,
        resolved_links.len()
    );
    
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
pub async fn get_all_property_keys(
    state: State<'_, AppState>,
) -> Result<Vec<String>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard
        .get_all_property_keys()
        .await
        .map_err(TessellumError::from)
}
