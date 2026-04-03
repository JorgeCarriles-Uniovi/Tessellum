use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

use crate::error::TessellumError;
use crate::models::AppState;
use crate::utils::{normalize_path};
use crate::utils::is_hidden_or_special;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagFilter {
	pub tags: Vec<String>,
	pub match_mode: TagMatchMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TagMatchMode {
	All,
	Any,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullTextSearchRequest {
	pub query: String,
	pub limit: Option<u32>,
	pub offset: Option<u32>,
	pub include_snippets: Option<bool>,
	pub tag_filter: Option<TagFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSearchRequest {
	pub tags: Vec<String>,
	pub match_mode: TagMatchMode,
	pub limit: Option<u32>,
	pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
	pub path: String,
	pub relative_path: String,
	pub title: String,
	pub score: f32,
	pub snippet: Option<String>,
	pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FullTextSearchResponse {
	pub total: u32,
	pub hits: Vec<SearchHit>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagSearchResponse {
	pub total: u32,
	pub hits: Vec<SearchHit>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexRebuildResult {
	pub indexed_files: usize,
	pub deleted_files: usize,
	pub duration_ms: u128,
}

#[tauri::command]
pub async fn search_full_text(
	state: State<'_, AppState>,
	vault_path: String,
	request: FullTextSearchRequest,
) -> Result<FullTextSearchResponse, TessellumError> {
	let limit = request.limit.unwrap_or(25) as usize;
	let offset = request.offset.unwrap_or(0) as usize;
	let include_snippets = request.include_snippets.unwrap_or(false);
	
	let tags = request
		.tag_filter
		.as_ref()
		.map(|f| f.tags.clone())
		.unwrap_or_default();
	let match_all = request
		.tag_filter
		.as_ref()
		.map(|f| f.match_mode == TagMatchMode::All)
		.unwrap_or(true);
	
	let search_index = state.search_index.clone();
	let query = request.query.clone();
	let vault_root = vault_path.clone();
	
	let results = tauri::async_runtime::spawn_blocking(move || {
		let guard = tauri::async_runtime::block_on(search_index.lock());
		guard.search(&query, &tags, match_all, limit, offset)
	})
		.await
		.map_err(|e| TessellumError::Internal(format!("Search task failed: {e}")))?
		.map_err(|e| TessellumError::Internal(e))?;
	
	let mut hits = Vec::new();
	for (doc, score) in results {
		let relative_path = make_relative_path(&vault_root, &doc.path);
		let snippet = if include_snippets {
			read_snippet(&doc.path, &request.query).await
		} else {
			None
		};
		
		hits.push(SearchHit {
			path: doc.path,
			relative_path,
			title: doc.title,
			score,
			snippet,
			tags: doc.tags,
		});
	}
	
	Ok(FullTextSearchResponse {
		total: hits.len() as u32,
		hits,
	})
}

#[tauri::command]
pub async fn search_tags(
	state: State<'_, AppState>,
	vault_path: String,
	request: TagSearchRequest,
) -> Result<TagSearchResponse, TessellumError> {
	let limit = request.limit.unwrap_or(50);
	let offset = request.offset.unwrap_or(0);
	let match_all = request.match_mode == TagMatchMode::All;
	
	let db = state.db.clone();
	let (paths, total) = db
		.search_notes_by_tags(&request.tags, match_all, limit, offset)
		.await
		.map_err(TessellumError::from)?;
	
	let mut hits = Vec::new();
	for path in paths {
		let title = Path::new(&path)
			.file_name()
			.unwrap_or_default()
			.to_string_lossy()
			.to_string()
			.trim_end_matches(".md")
			.to_string();
		hits.push(SearchHit {
			path: normalize_path(&path),
			relative_path: make_relative_path(&vault_path, &path),
			title,
			score: 0.0,
			snippet: None,
			tags: Vec::new(),
		});
	}
	
	Ok(TagSearchResponse { total, hits })
}

#[tauri::command]
pub async fn rebuild_search_index(
	state: State<'_, AppState>,
	vault_path: String,
) -> Result<IndexRebuildResult, TessellumError> {
	let search_index = state.search_index.clone();
	let vault_clone = vault_path.clone();
	
	let result = tauri::async_runtime::spawn_blocking(move || {
		let guard = tauri::async_runtime::block_on(search_index.lock());
		guard.clear()?;
		let mut docs = Vec::new();
		let mut seen_paths = Vec::new();
		
		for entry in WalkDir::new(&vault_clone).into_iter().filter_map(|e| e.ok()) {
			let path = entry.path();
			let rel_path = path.strip_prefix(&vault_clone).unwrap_or(path);
			if is_hidden_or_special(rel_path) {
				continue;
			}
			if !path.is_file() {
				continue;
			}
			
			let path_str = normalize_path(&path.to_string_lossy());
			let metadata = std::fs::metadata(path).map_err(|e| e.to_string())?;
			let modified = metadata
				.modified()
				.map_err(|e| e.to_string())?
				.duration_since(std::time::UNIX_EPOCH)
				.unwrap_or_default()
				.as_secs() as i64;
			
			let is_markdown = path.extension().and_then(|s| s.to_str()) == Some("md");
			let title = path
				.file_name()
				.unwrap_or_default()
				.to_string_lossy()
				.to_string();
			
			if is_markdown {
				if let Ok(content) = std::fs::read_to_string(path) {
					let tags = crate::utils::extract_tags(&content);
					let body = if let Some((_, _)) = crate::utils::frontmatter::parse_frontmatter(&content) {
						crate::utils::frontmatter::strip_frontmatter(&content).to_string()
					} else {
						content.clone()
					};
					docs.push(crate::search::SearchDoc {
						path: path_str.clone(),
						title: title.trim_end_matches(".md").to_string(),
						body,
						tags,
					});
				}
			} else {
				docs.push(crate::search::SearchDoc {
					path: path_str.clone(),
					title,
					body: String::new(),
					tags: Vec::new(),
				});
			}
			
			seen_paths.push((path_str, modified, is_markdown));
		}
		
		guard.index_batch(&docs, &[])?;
		Ok::<(usize, Vec<(String, i64, bool)>), String>((docs.len(), seen_paths))
	})
		.await
		.map_err(|e| TessellumError::Internal(format!("Rebuild task failed: {e}")))?
		.map_err(|e| TessellumError::Internal(e))?;
	
	let (indexed_count, seen_paths) = result;
	let db = state.db.clone();
	let existing = db
		.get_all_search_files()
		.await
		.map_err(TessellumError::from)?;
	let existing_set: std::collections::HashSet<String> =
		existing.into_iter().map(|(p, _, _)| p).collect();
	let seen_set: std::collections::HashSet<String> =
		seen_paths.iter().map(|(p, _, _)| p.clone()).collect();
	let deleted: Vec<String> = existing_set
		.difference(&seen_set)
		.cloned()
		.collect();
	if !deleted.is_empty() {
		db
			.delete_search_files(&deleted)
			.await
			.map_err(TessellumError::from)?;
	}
	for (path, modified, is_md) in seen_paths {
		db
			.upsert_search_file(&path, modified, is_md)
			.await
			.map_err(TessellumError::from)?;
	}
	
	Ok(IndexRebuildResult {
		indexed_files: indexed_count,
		deleted_files: 0,
		duration_ms: 0,
	})
}

fn make_relative_path(vault_path: &str, full_path: &str) -> String {
	let vault_root = Path::new(vault_path);
	let path = Path::new(full_path);
	if let Ok(rel) = path.strip_prefix(vault_root) {
		normalize_path(&rel.to_string_lossy())
	} else {
		normalize_path(full_path)
	}
}

async fn read_snippet(path: &str, query: &str) -> Option<String> {
	let content = tokio::fs::read_to_string(path).await.ok()?;
	let body = if let Some((_, _)) = crate::utils::frontmatter::parse_frontmatter(&content) {
		crate::utils::frontmatter::strip_frontmatter(&content).to_string()
	} else {
		content
	};
	
	let query_term = query.split_whitespace().next().unwrap_or("");
	if query_term.is_empty() {
		return None;
	}
	
	let lower_body = body.to_lowercase();
	let lower_query = query_term.to_lowercase();
	if let Some(pos) = lower_body.find(&lower_query) {
		let start = pos.saturating_sub(40);
		let end = (pos + 120).min(body.len());
		return Some(body[start..end].trim().to_string());
	}
	
	Some(body.split_whitespace().take(24).collect::<Vec<_>>().join(" "))
}
