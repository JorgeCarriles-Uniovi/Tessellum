use regex::Regex;
use tauri::State;

use crate::models::{AppState, WikiLink};

/// Extracts all wikilinks from the given input string.
///
/// Wikilinks are denoted by the pattern `[[...]]`, where "..." represents
/// the content of the link. This function uses a regular expression to find
/// all occurrences of these patterns and extracts their inner content.
pub fn extract_wikilinks(content: &str) -> Vec<WikiLink> {
    let reg = Regex::new(r"(\\)?\[\[(.*?)\]\]").unwrap();
    reg.captures_iter(content)
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
) -> Result<Vec<String>, String> {
    let db_guard = state.db.lock().await;

    if let Some(db) = db_guard.as_ref() {
        db.get_backlinks(&path).await.map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}

/// Get all files that the specified file links to (outgoing links).
#[tauri::command]
pub async fn get_outgoing_links(
    state: State<'_, AppState>,
    path: String,
) -> Result<Vec<String>, String> {
    let db_guard = state.db.lock().await;

    if let Some(db) = db_guard.as_ref() {
        db.get_outgoing_links(&path)
            .await
            .map_err(|e| e.to_string())
    } else {
        Ok(vec![])
    }
}
