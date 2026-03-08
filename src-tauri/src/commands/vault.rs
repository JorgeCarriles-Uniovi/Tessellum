use std::fs::metadata;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::State;
use walkdir::WalkDir;
use crate::AppState;
use crate::models::FileMetadata;
use crate::utils::{is_hidden_or_special, sanitize_string, validate_path_in_vault};

/// Lists all files and directories within the specified vault path and retrieves their metadata.
///
/// # Arguments
///
/// * `vault_path` - A `String` specifying the path of the directory to scan.
///
/// # Returns
///
/// * `Ok(Vec<FileMetadata>)` containing a vector of `FileMetadata` structs.
/// * `Err(String)` containing an error message if the vault path does not exist.
#[tauri::command]
pub fn list_files(vault_path: String) -> Result<Vec<FileMetadata>, String> {
    let mut files = Vec::new();
    
    // Check if path exists
    if !Path::new(&vault_path).exists() {
        return Err(String::from("Vault path does not exist"));
    }
    
    // For each entry in the vault directory that does not give an error, add it to the list
    for entry in WalkDir::new(&vault_path)
        .min_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        // Get the file path
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        
        // Ignore hidden files/dirs (.git, .trash, etc.)
        if is_hidden_or_special(path) {
            continue;
        }
        
        // If able to get metadata, add it to the list
        if let Ok(meta) = metadata(path) {
            // Get the last modified time in milliseconds
            let modified_time = meta
                .modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            
            // Push the file metadata to the list
            files.push(FileMetadata {
                path: path_str,
                filename: path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                is_dir: meta.is_dir(),
                size: meta.len(),
                last_modified: modified_time,
            });
        }
    }
    
    Ok(files)
}

/// Asynchronous Tauri command to rename a file or folder.
///
/// # Parameters
/// - `vault_path`: The root vault path for security validation.
/// - `old_path`: The current path of the item to be renamed.
/// - `new_name`: The new name for the item.
///
/// # Returns
/// - `Ok(String)`: The new path of the renamed item.
/// - `Err(String)`: An error message if the operation fails.
#[tauri::command]
pub async fn rename_file(
    state: State<'_, AppState>,
    vault_path: String,
    old_path: String,
    new_name: String,
) -> Result<String, String> {
    // Validate old_path is inside the vault (using canonicalize to prevent traversal)
    validate_path_in_vault(&old_path, &vault_path)?;
    
    let vault_root = Path::new(&vault_path);
    let old = Path::new(&old_path);
    
    let parent = old.parent().ok_or("Invalid path: No parent directory")?;
    
    let clean_name = sanitize_string(new_name);
    
    if clean_name.trim().is_empty() {
        return Err("Invalid name: Filename cannot be empty".to_string());
    }
    
    let final_filename = if old.is_dir() {
        clean_name
    } else if clean_name.ends_with(".md") {
        clean_name
    } else {
        format!("{}.md", clean_name)
    };
    
    let new_path = parent.join(&final_filename);
    
    // Validate destination is also inside the vault
    let vault_canonical = vault_root
        .canonicalize()
        .map_err(|e| format!("Invalid vault path: {}", e))?;
    let new_canonical = new_path
        .parent()
        .ok_or("Invalid path: No parent directory")?
        .canonicalize()
        .map_err(|e| format!("Invalid destination path: {}", e))?
        .join(&final_filename);
    if !new_canonical.starts_with(&vault_canonical) {
        return Err("Security Error: Cannot rename file to outside the vault".to_string());
    }
    
    if new_path.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }
    
    tokio::fs::rename(old, &new_path)
        .await
        .map_err(|e| e.to_string())?;
    
    // Update the DB index so backlinks and graph stay correct
    let db_guard = state.db.lock().await;
    if let Some(db) = db_guard.as_ref() {
        db.update_file_path(&old_path, &new_path.to_string_lossy())
            .await
            .map_err(|e| format!("Failed to update index: {}", e))?;
    }
    
    // Invalidate the cache since path has changed
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    
    Ok(new_path.to_string_lossy().to_string())
}
