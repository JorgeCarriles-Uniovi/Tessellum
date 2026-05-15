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
    let db = state.db.clone();
    let normalized = crate::utils::normalize_path(&path);
    db
        .get_backlinks(&normalized)
        .await
        .map_err(TessellumError::from)
}

/// Get all files that the specified file links to (outgoing links).
#[tauri::command]
pub async fn get_outgoing_links(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, TessellumError> {
    let db = state.db.clone();
    let normalized = crate::utils::normalize_path(&path);
    db
        .get_outgoing_links(&normalized)
        .await
        .map_err(TessellumError::from)
}

/// Get all links in the vault (for graph visualization).
/// Returns a vector of [source_path, target_path] pairs.
#[tauri::command]
pub async fn get_all_links(
    state: State<'_, AppState>,
) -> Result<Vec<(String, String)>, TessellumError> {
    let db = state.db.clone();
    db.get_all_links().await.map_err(TessellumError::from)
}

/// Resolves a wikilink target to its full path.
/// Uses the cached in-memory FileIndex for fast lookup without traversing the filesystem.
#[tauri::command]
pub async fn resolve_wikilink(
    state: State<'_, AppState>,
    vault_path: String,
    target: String,
) -> Result<Option<String>, TessellumError> {
    let resolved_note = {
        let mut index_guard = state.file_index.lock().await;

        // Build markdown index if not cached yet
        if index_guard.is_none() {
            let idx = crate::models::FileIndex::build(&vault_path)
                .map_err(|e| TessellumError::Internal(format!("Failed to build file index: {}", e)))?;
            *index_guard = Some(idx);
        }

        index_guard
            .as_ref()
            .and_then(|file_index| file_index.resolve(&vault_path, &target))
    };

    if let Some(path) = resolved_note {
        return Ok(Some(crate::utils::normalize_path(&path.to_string_lossy())));
    }

    // Wikilinks can target media too (e.g. [[image.png]]), so fall back to the asset index.
    let resolved_asset = {
        let mut index_guard = state.asset_index.lock().await;

        if index_guard.is_none() {
            let idx = crate::models::AssetIndex::build(&vault_path)
                .map_err(|e| TessellumError::Internal(format!("Failed to build asset index: {}", e)))?;
            *index_guard = Some(idx);
        }

        index_guard
            .as_ref()
            .and_then(|asset_index| asset_index.resolve(&vault_path, &target))
    };

	Ok(resolved_asset
        .map(|p| crate::utils::normalize_path(&p.to_string_lossy())))
}

#[cfg(test)]
mod tests {
    use super::extract_wikilinks;

    #[test]
    fn extracts_plain_and_aliased_wikilinks() {
        let links = extract_wikilinks("See [[Alpha]] and [[Beta|Shown Beta]] today.");

        assert_eq!(links.len(), 2);
        assert_eq!(links[0].target, "Alpha");
        assert_eq!(links[0].alias, None);
        assert_eq!(links[1].target, "Beta");
        assert_eq!(links[1].alias.as_deref(), Some("Shown Beta"));
    }

    #[test]
    fn ignores_escaped_wikilinks_and_trims_inner_whitespace() {
        let links = extract_wikilinks(r"\[[Ignored]] [[  Folder/Note  |  Alias  ]]");

        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "Folder/Note");
        assert_eq!(links[0].alias.as_deref(), Some("Alias"));
    }
}
