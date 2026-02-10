use std::path::Path;

use crate::utils::sanitize_string;

/// Asynchronous command to create a new folder within a specified vault path.
///
/// This function performs the following operations:
/// 1. Sanitizes the provided folder name to ensure it is safe to use in file paths.
/// 2. Validates that the folder name is not empty after sanitization.
/// 3. Checks if a folder with the same name already exists at the desired location.
/// 4. Creates the folder if it does not already exist.
#[tauri::command]
pub async fn create_folder(vault_path: String, folder_name: String) -> Result<String, String> {
    let sanitized_folder_name = sanitize_string(folder_name);

    // SECURITY & VALIDATION:
    // Ensure the name isn't empty after sanitization.
    if sanitized_folder_name.trim().is_empty() {
        return Err("Invalid folder name: Name cannot be empty".to_string());
    }

    let folder_path = Path::new(&vault_path).join(&sanitized_folder_name);

    // Check for existence
    if folder_path.exists() {
        return Err(String::from("Folder already exists"));
    }

    // Create the directory
    tokio::fs::create_dir(&folder_path)
        .await
        .map_err(|e| e.to_string())?;

    Ok(folder_path.to_string_lossy().to_string())
}
