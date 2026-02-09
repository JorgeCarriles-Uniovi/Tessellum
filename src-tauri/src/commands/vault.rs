use std::fs::metadata;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

use crate::models::FileMetadata;
use crate::utils::sanitize_string;

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
    for entry in WalkDir::new(&vault_path).into_iter().filter_map(|e| e.ok()) {
        // Get the file path
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();

        // Ignore hidden files/dirs
        if path_str.contains(".git") || path_str.contains(".trash") {
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
    vault_path: String,
    old_path: String,
    new_name: String,
) -> Result<String, String> {
    let vault_root = Path::new(&vault_path);
    let old = Path::new(&old_path);

    if !old.starts_with(vault_root) {
        return Err("Security Error: Cannot rename files outside the vault".to_string());
    }

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

    if !new_path.starts_with(vault_root) {
        return Err("Security Error: Cannot rename file to outside the vault".to_string());
    }

    if new_path.exists() {
        return Err("A file or folder with that name already exists".to_string());
    }

    tokio::fs::rename(old, &new_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_path.to_string_lossy().to_string())
}
