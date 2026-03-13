use std::fs::metadata;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri_plugin_fs::FsExt;
use walkdir::WalkDir;

use crate::error::TessellumError;
use crate::models::FileMetadata;
use crate::utils::{is_hidden_or_special, sanitize_string, validate_path_in_vault};

/// Rewrite `[[OldStem]]` and `[[OldStem|alias]]` to `[[NewStem]]` / `[[NewStem|alias]]`
/// in all files whose paths are listed in `backlinks`.
/// Escaped links (`\[[OldStem]]`) are left unchanged.
async fn rewrite_backlinks(
    backlinks: &[String],
    old_stem: &str,
    new_stem: &str,
) -> Result<(), TessellumError> {
    if backlinks.is_empty() {
        return Ok(());
    }
    
    // Build a regex that matches [[OldStem]] and [[OldStem|alias]],
    // with an optional leading backslash to detect escaped links.
    let escaped = regex::escape(old_stem);
    let pattern = format!(r"(\\?)\[\[{escaped}(\|[^\]]+)?\]\]");
    let re = regex::Regex::new(&pattern)
        .map_err(|e| TessellumError::Internal(format!("Link-rewrite regex error: {e}")))?;
    
    for source_path in backlinks {
        let content = match tokio::fs::read_to_string(source_path).await {
            Ok(c) => c,
            Err(e) => {
                log::warn!("rewrite_backlinks: could not read '{source_path}': {e}");
                continue;
            }
        };
        
        let new_content = re.replace_all(&content, |caps: &regex::Captures<'_>| {
            // If preceded by a backslash, the link is escaped — leave it verbatim.
            if caps.get(1).map_or(false, |m| m.as_str() == "\\") {
                return caps[0].to_string();
            }
            let alias = caps.get(2).map_or("", |m| m.as_str());
            format!("[[{new_stem}{alias}]]")
        });
        
        if new_content != content {
            if let Err(e) = tokio::fs::write(source_path, new_content.as_bytes()).await {
                log::warn!("rewrite_backlinks: could not write '{source_path}': {e}");
            }
        }
    }
    
    Ok(())
}

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
pub fn list_files(vault_path: String) -> Result<Vec<FileMetadata>, TessellumError> {
    let mut files = Vec::new();
    
    // Check if path exists
    if !Path::new(&vault_path).exists() {
        return Err(TessellumError::NotFound(
            "Vault path does not exist".to_string(),
        ));
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
                path: crate::utils::normalize_path(&path_str),
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
    state: tauri::State<'_, crate::models::AppState>,
    vault_path: String,
    old_path: String,
    new_name: String,
) -> Result<String, TessellumError> {
    // Validate old_path is inside the vault (using canonicalize to prevent traversal)
    validate_path_in_vault(&old_path, &vault_path).map_err(|e| TessellumError::Validation(e))?;
    
    let vault_root = Path::new(&vault_path);
    let old = Path::new(&old_path);
    
    let parent = old.parent().ok_or_else(|| {
        TessellumError::Validation("Invalid path: No parent directory".to_string())
    })?;
    
    let clean_name = sanitize_string(new_name);
    
    if clean_name.trim().is_empty() {
        return Err(TessellumError::Validation(
            "Invalid name: Filename cannot be empty".to_string(),
        ));
    }
    
    // Check before the rename while the path still exists on disk
    let is_file = old.is_file();
    
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
        .map_err(|_| TessellumError::Validation("Invalid vault path".to_string()))?;
    let new_canonical = new_path
        .parent()
        .ok_or_else(|| TessellumError::Validation("Invalid path: No parent directory".to_string()))?
        .canonicalize()
        .map_err(|_| TessellumError::Validation("Invalid destination path".to_string()))?
        .join(&final_filename);
    if !new_canonical.starts_with(&vault_canonical) {
        return Err(TessellumError::Validation(
            "Security Error: Cannot rename file to outside the vault".to_string(),
        ));
    }
    
    if new_path.exists() {
        return Err(TessellumError::Validation(
            "A file or folder with that name already exists".to_string(),
        ));
    }
    
    // Capture stems before the rename (path no longer exists on disk after)
    let old_stem = old.file_stem().and_then(|s| s.to_str()).map(str::to_string);
    let new_stem = new_path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(str::to_string);
    
    // Rename on the filesystem
    tokio::fs::rename(old, &new_path)
        .await
        .map_err(TessellumError::from)?;
    
    let db_guard = state.db.lock().await;
    
    // Rewrite [[OldStem]] -> [[NewStem]] in all files that link to this note
    if is_file {
        if let (Some(os), Some(ns)) = (&old_stem, &new_stem) {
            if os != ns {
                let backlinks = db_guard
                    .get_backlinks(&old_path)
                    .await
                    .map_err(TessellumError::from)?;
                
                rewrite_backlinks(&backlinks, os, ns).await?;
            }
        }
    }
    
    // Update the DB index so backlinks and graph stay correct
    db_guard
        .update_file_path(&old_path, &new_path.to_string_lossy())
        .await
        .map_err(TessellumError::from)?;
    
    // Invalidate the cache since path has changed
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn move_items(
    state: tauri::State<'_, crate::models::AppState>,
    vault_path: String,
    item_paths: Vec<String>,
    dest_dir: String,
) -> Result<Vec<String>, TessellumError> {
    if item_paths.is_empty() {
        return Ok(Vec::new());
    }
    
    validate_path_in_vault(&dest_dir, &vault_path)
        .map_err(|e| TessellumError::Validation(e))?;
    
    let dest_path = Path::new(&dest_dir);
    let dest_meta = tokio::fs::metadata(dest_path).await.map_err(TessellumError::from)?;
    if !dest_meta.is_dir() {
        return Err(TessellumError::Validation(
            "Destination must be a folder".to_string(),
        ));
    }
    
    let normalized_dest = crate::utils::normalize_path(&dest_dir);
    
    let mut planned: Vec<(String, String)> = Vec::new();
    let mut seen_targets: std::collections::HashSet<String> = std::collections::HashSet::new();
    
    for item_path in item_paths {
        validate_path_in_vault(&item_path, &vault_path)
            .map_err(|e| TessellumError::Validation(e))?;
        
        let normalized_item = crate::utils::normalize_path(&item_path);
        if normalized_dest == normalized_item
            || normalized_dest.starts_with(&(normalized_item.clone() + "/"))
        {
            return Err(TessellumError::Validation(
                "Cannot move a folder into itself".to_string(),
            ));
        }
        
        let old_path = Path::new(&item_path);
        let file_name = old_path.file_name().ok_or_else(|| {
            TessellumError::Validation("Invalid path: no filename".to_string())
        })?;
        let new_path = dest_path.join(file_name);
        
        let new_path_str = new_path.to_string_lossy().to_string();
        let normalized_new = crate::utils::normalize_path(&new_path_str);
        if normalized_new == normalized_item {
            continue;
        }
        
        if !seen_targets.insert(normalized_new.clone()) {
            return Err(TessellumError::Validation(
                "Multiple items share the same name in the destination".to_string(),
            ));
        }
        
        if new_path.exists() {
            return Err(TessellumError::Validation(
                "A file or folder with that name already exists in the destination".to_string(),
            ));
        }
        
        planned.push((item_path, new_path_str));
    }
    
    for (old_path, new_path) in planned.iter() {
        tokio::fs::rename(old_path, new_path)
            .await
            .map_err(TessellumError::from)?;
    }
    
    let db_guard = state.db.lock().await;
    for (old_path, new_path) in planned.iter() {
        db_guard
            .update_file_path(old_path, new_path)
            .await
            .map_err(TessellumError::from)?;
    }
    
    let mut idx_guard = state.file_index.lock().await;
    *idx_guard = None;
    
    Ok(planned.into_iter().map(|(_, new_path)| new_path).collect())
}
use serde::Serialize;
use std::collections::HashMap;

#[derive(Serialize, Clone)]
pub struct TreeNode {
    pub id: String,
    pub name: String,
    pub is_dir: bool,
    pub children: Vec<TreeNode>,
    pub file: Option<FileMetadata>,
}

#[tauri::command]
pub fn list_files_tree(vault_path: String) -> Result<Vec<TreeNode>, TessellumError> {
    let files = list_files(vault_path.clone())?;
    
    let mut tree_nodes: HashMap<String, TreeNode> = HashMap::new();
    
    // First, map all items
    for file in files {
        let normalized = crate::utils::normalize_path(&file.path);
        tree_nodes.insert(
            normalized.clone(),
            TreeNode {
                id: normalized,
                name: file.filename.clone(),
                is_dir: file.is_dir,
                children: Vec::new(),
                file: Some(file),
            },
        );
    }
    
    let mut paths: Vec<String> = tree_nodes.keys().cloned().collect();
    // Sort paths by length descending so that deep children are processed before their parents.
    paths.sort_by_key(|a| std::cmp::Reverse(a.len()));
    
    let mut root_nodes = Vec::new();
    
    for path in paths {
        let node = tree_nodes.remove(&path).unwrap();
        
        let parent_path = crate::utils::normalize_path(
            &Path::new(&path)
                .parent()
                .unwrap_or(Path::new(""))
                .to_string_lossy(),
        );
        
        if let Some(parent) = tree_nodes.get_mut(&parent_path) {
            parent.children.push(node);
        } else {
            root_nodes.push(node);
        }
    }
    
    // Recursive sort lambda-like equivalent function
    fn sort_nodes(nodes: &mut Vec<TreeNode>) {
        nodes.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.name.cmp(&b.name)
            } else if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        });
        
        for child in nodes.iter_mut() {
            sort_nodes(&mut child.children);
        }
    }
    
    sort_nodes(&mut root_nodes);
    
    Ok(root_nodes)
}

#[tauri::command]
pub fn set_vault_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}



