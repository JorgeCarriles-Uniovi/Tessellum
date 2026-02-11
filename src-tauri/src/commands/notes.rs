use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::commands::extract_wikilinks;
use crate::models::{AppState, FileIndex};
use crate::utils::sanitize_string;

/// Creates a new note file in the specified vault directory with a unique name.
///
/// This function takes in a vault path and a title string to create a new `.md`
/// file in the specified vault directory. If the provided title contains
/// invalid characters or is empty, it is sanitized or defaulted to "Untitled".
/// If a file with the same name already exists, the function appends a numeric suffix
/// to the filename to ensure its uniqueness.
#[tauri::command]
pub fn create_note(vault_path: String, title: String) -> Result<String, String> {
    // Sanitize title for avoiding invalid characters
    let sanitized_title = sanitize_string(title);
    let sanitized_title = {
        if sanitized_title.trim().is_empty() {
            String::from("Untitled")
        } else {
            sanitized_title
        }
    };

    // Create a file path
    let mut filename = format!("{}.md", sanitized_title);
    let mut file_path = Path::new(&vault_path).join(&filename);
    let mut collision_index = 1;

    // Check for collisions in the filenames
    while file_path.exists() {
        filename = format!("{} ({}).md", sanitized_title, collision_index);
        file_path = Path::new(&vault_path).join(&filename);
        collision_index += 1;
    }

    // Create an empty file
    fs::write(&file_path, String::new()).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Moves a note or folder to a trash directory within the specified vault directory.
///
/// This function is useful for "soft-deleting" items by moving them to a `.trash`
/// subdirectory within a vault, while ensuring that the filenames are unique
/// using a timestamp.
#[tauri::command]
pub async fn trash_item(item_path: String, vault_path: String) -> Result<(), String> {
    let source_path = Path::new(&item_path);
    let vault_root = Path::new(&vault_path);

    let trash_dir = vault_root.join(".trash");
    if !trash_dir.exists() {
        tokio::fs::create_dir(&trash_dir)
            .await
            .map_err(|e| format!("Failed to create .trash: {}", e))?;
    }

    if !source_path.exists() {
        return Err("Item does not exist".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    // --- Step A: Rename the Main Item ---
    let trash_filename =
        generate_trash_name(source_path, timestamp).ok_or("Failed to generate name")?;

    let dest_path = trash_dir.join(&trash_filename);

    // Move the folder (and all contents) to .trash
    tokio::fs::rename(source_path, &dest_path)
        .await
        .map_err(|e| e.to_string())?;

    // --- Step B: Recursively Rename Contents ---
    if dest_path.is_dir() {
        rename_recursively(&dest_path, timestamp).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Reads the contents of a file at the given path and returns it as a `String`.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Writes the specified content to a file at the given path.
/// Also updates the database index with resolved wikilinks.
#[tauri::command]
pub async fn write_file(
    state: State<'_, AppState>,
    vault_path: String,
    path: String,
    content: String,
) -> Result<(), String> {
    // 1. Write the file first
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| e.to_string())?;

    let db_guard = state.db.lock().await;

    if let Some(db) = db_guard.as_ref() {
        // 2. Get metadata AFTER writing
        let metadata = tokio::fs::metadata(&path)
            .await
            .map_err(|e| format!("Failed to get metadata for {}: {}", path, e))?;

        let size = metadata.len();
        let modified = metadata
            .modified()
            .map_err(|e| format!("Failed to get modified time: {}", e))?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        // 3. Extract wikilinks
        let wikilinks = extract_wikilinks(&content);

        // 4. Build file index for resolving links
        let file_index = FileIndex::build(&vault_path)
            .map_err(|e| format!("Failed to build file index: {}", e))?;

        // 5. Resolve each wikilink to its full path
        let resolved_links: Vec<String> = wikilinks
            .iter()
            .filter_map(|link| {
                file_index
                    .resolve(&vault_path, &link.target)
                    .map(|p| p.to_string_lossy().to_string())
            })
            .collect();
        
        // 6. Index the file with resolved links
        db.index_file(&path, modified, size, &resolved_links)
            .await
            .map_err(|e| format!("Failed to index file in database: {}", e))?;
    }

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
) -> Result<Vec<(String, i64)>, String> {
    let db_guard = state.db.lock().await;
    
    if let Some(db) = db_guard.as_ref() {
        db.get_all_indexed_files()
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}
