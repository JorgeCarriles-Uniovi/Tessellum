use regex::Regex;
use std::sync::LazyLock;
use tauri::State;

use crate::error::TessellumError;
use crate::models::{AppState, WikiLink};

static WIKILINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\\)?\[\[(.*?)\]\]").unwrap());

/// Extracts all wikilinks from the given input string.
///
/// Wikilinks are denoted by the pattern `[[...]]`, where "..." represents
/// the content of the link. This function uses a statically compiled regex
/// to find all occurrences and extracts their inner content.
pub fn extract_wikilinks(content: &str) -> Vec<WikiLink> {
    WIKILINK_RE
        .captures_iter(content)
        .filter_map(|c| {
            // If there is a backslash before `[[`, this was an escaped literal
            if c.get(1).is_some() {
                None
            } else {
                let inner = c[2].to_string();
                
                // Split on | to separate target from alias
                if let Some(pipe_pos) = inner.find('|') {
                    let target = inner[..pipe_pos].trim().to_string();
                    let alias = inner[pipe_pos + 1..].trim().to_string();
                    Some(WikiLink {
                        target,
                        alias: Some(alias),
                    })
                } else {
                    Some(WikiLink {
                        target: inner.trim().to_string(),
                        alias: None,
                    })
                }
            }
        })
        .collect()
}

/// Get all files that link to the specified file (backlinks).
#[tauri::command]
pub async fn get_backlinks(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard
        .get_backlinks(&path)
        .await
        .map_err(TessellumError::from)
}

/// Get all files that the specified file links to (outgoing links).
#[tauri::command]
pub async fn get_outgoing_links(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard
        .get_outgoing_links(&path)
        .await
        .map_err(TessellumError::from)
}

/// Get all links in the vault (for graph visualization).
/// Returns a vector of [source_path, target_path] pairs.
#[tauri::command]
pub async fn get_all_links(
    state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, TessellumError> {
    let db_guard = state.db.lock().await;
    db_guard.get_all_links().await.map_err(TessellumError::from)
}

/// Resolves a wikilink target to its full path.
/// Uses the cached in-memory FileIndex for fast lookup without traversing the filesystem.
#[tauri::command]
pub async fn resolve_wikilink(
    state: State<'_, AppState>,
    vault_path: String,
    target: String,
) -> Result<Option<String>, TessellumError> {
    let mut index_guard = state.file_index.lock().await;
    
    // Build index if not cached yet
    if index_guard.is_none() {
        let idx = crate::models::FileIndex::build(&vault_path)
            .map_err(|e| TessellumError::Internal(format!("Failed to build file index: {}", e)))?;
        *index_guard = Some(idx);
    }
    
    let file_index = index_guard.as_ref().unwrap();
    
    // Resolve and return normalized path if found
    Ok(file_index
        .resolve(&vault_path, &target)
        .map(|p| crate::utils::normalize_path(&p.to_string_lossy())))
}
