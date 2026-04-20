use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use tauri::State;

use crate::commands::indexer::run_sync_vault;
use crate::error::TessellumError;
use crate::grafeo_projection::ManagedGrafeoConnection;
use crate::models::{AppState, SearchReadinessState, SearchReadinessStatus};
use crate::utils::is_hidden_or_special;
use crate::utils::normalize_path;
use walkdir::WalkDir;

const SEARCH_MAX_ATTEMPTS: u32 = 10;
const SEARCH_RETRY_DELAY_MS: u64 = 5_000;
const SEARCH_MISMATCH_THRESHOLD_RATIO: f64 = 0.01;

fn log_readiness_transition(
	vault_path: &str,
	from: &SearchReadinessStatus,
	to: &SearchReadinessStatus,
	attempt: u32,
	detail: &str,
) {
	if from == to {
		log::debug!(
			"[search-readiness] vault={} status={} attempt={} detail={}",
			vault_path,
			status_to_string(to),
			attempt,
			detail,
		);
		return;
	}

	log::info!(
		"[search-readiness] vault={} {} -> {} attempt={} detail={}",
		vault_path,
		status_to_string(from),
		status_to_string(to),
		attempt,
		detail,
	);
}

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

#[derive(Debug, Clone, Serialize)]
pub struct SearchReadinessResponse {
	pub status: String,
	pub attempt_count: u32,
	pub max_attempts: u32,
	pub retry_delay_ms: u64,
	pub reopen_required: bool,
	pub last_error: Option<String>,
}

struct CoherenceResult {
	expected_markdown_count: usize,
	indexed_markdown_count: usize,
	mismatch_count: usize,
	mismatch_threshold: usize,
}

fn status_to_string(status: &SearchReadinessStatus) -> String {
	match status {
		SearchReadinessStatus::Idle => "idle",
		SearchReadinessStatus::Warming => "warming",
		SearchReadinessStatus::Ready => "ready",
		SearchReadinessStatus::Failed => "failed",
	}
		.to_string()
}

fn readiness_response(state: &SearchReadinessState) -> SearchReadinessResponse {
	SearchReadinessResponse {
		status: status_to_string(&state.status),
		attempt_count: state.attempt_count,
		max_attempts: state.max_attempts,
		retry_delay_ms: SEARCH_RETRY_DELAY_MS,
		reopen_required: state.attempt_count >= state.max_attempts,
		last_error: state.last_error.clone(),
	}
}

fn mismatch_threshold(expected_markdown_count: usize) -> usize {
	if expected_markdown_count == 0 {
		return 1;
	}
	let threshold = (expected_markdown_count as f64 * SEARCH_MISMATCH_THRESHOLD_RATIO).ceil() as usize;
	threshold.max(1)
}

fn is_markdown_path(path: &str) -> bool {
	path.to_ascii_lowercase().ends_with(".md")
}

fn count_mismatches_with_early_exit(
	expected_paths: &HashSet<String>,
	indexed_paths: &HashSet<String>,
	stop_after: usize,
) -> usize {
	let mut mismatches = 0usize;
	for path in expected_paths {
		if !indexed_paths.contains(path) {
			mismatches += 1;
			if mismatches >= stop_after {
				return mismatches;
			}
		}
	}
	for path in indexed_paths {
		if !expected_paths.contains(path) {
			mismatches += 1;
			if mismatches >= stop_after {
				return mismatches;
			}
		}
	}
	mismatches
}

async fn compute_markdown_coherence(state: &State<'_, AppState>) -> Result<CoherenceResult, TessellumError> {
	let db = state.db.clone();
	let expected_search_files = db
		.get_all_search_files()
		.await
		.map_err(TessellumError::from)?;
	let expected_markdown_paths: HashSet<String> = expected_search_files
		.into_iter()
		.filter(|(_, _, is_markdown)| *is_markdown == 1)
		.map(|(path, _, _)| normalize_path(&path))
		.collect();
	let expected_markdown_count = expected_markdown_paths.len();
	let threshold = mismatch_threshold(expected_markdown_count);

	let search_index = state.search_index.clone();
	let indexed_paths = tauri::async_runtime::spawn_blocking(move || {
		let guard = tauri::async_runtime::block_on(search_index.lock());
		guard.indexed_paths()
	})
	.await
	.map_err(|e| TessellumError::Internal(format!("Index coherence task failed: {e}")))?
	.map_err(TessellumError::Internal)?;

	let indexed_markdown_paths: HashSet<String> = indexed_paths
		.into_iter()
		.filter(|path| is_markdown_path(path))
		.collect();
	let indexed_markdown_count = indexed_markdown_paths.len();

	let mismatches = count_mismatches_with_early_exit(
		&expected_markdown_paths,
		&indexed_markdown_paths,
		threshold,
	);

	Ok(CoherenceResult {
		expected_markdown_count,
		indexed_markdown_count,
		mismatch_count: mismatches,
		mismatch_threshold: threshold,
	})
}

fn needs_rebuild(coherence: &CoherenceResult) -> bool {
	if coherence.expected_markdown_count == 0 {
		return coherence.indexed_markdown_count > 0;
	}
	coherence.mismatch_count >= coherence.mismatch_threshold
}

#[tauri::command]
pub async fn get_search_readiness(
	state: State<'_, AppState>,
	vault_path: String,
) -> Result<SearchReadinessResponse, TessellumError> {
	let mut readiness = state.search_readiness.lock().await;
	if readiness.vault_path.as_deref() != Some(vault_path.as_str()) {
		*readiness = SearchReadinessState::default();
		readiness.max_attempts = SEARCH_MAX_ATTEMPTS;
		readiness.vault_path = Some(vault_path.clone());
	}
	Ok(readiness_response(&readiness))
}

#[tauri::command]
pub async fn reset_search_readiness_attempts(
	state: State<'_, AppState>,
	vault_path: String,
) -> Result<SearchReadinessResponse, TessellumError> {
	let mut readiness = state.search_readiness.lock().await;
	if readiness.vault_path.as_deref() != Some(vault_path.as_str()) {
		*readiness = SearchReadinessState::default();
		readiness.vault_path = Some(vault_path.clone());
	}
	let previous = readiness.status.clone();
	readiness.attempt_count = 0;
	readiness.status = SearchReadinessStatus::Idle;
	readiness.last_error = None;
	readiness.max_attempts = SEARCH_MAX_ATTEMPTS;
	log_readiness_transition(
		&vault_path,
		&previous,
		&readiness.status,
		readiness.attempt_count,
		"attempts reset",
	);
	Ok(readiness_response(&readiness))
}

#[tauri::command]
pub async fn ensure_search_ready(
	state: State<'_, AppState>,
	kuzu_state: State<'_, ManagedGrafeoConnection>,
	vault_path: String,
) -> Result<SearchReadinessResponse, TessellumError> {
	{
		let mut readiness = state.search_readiness.lock().await;
		if readiness.vault_path.as_deref() != Some(vault_path.as_str()) {
			let previous = readiness.status.clone();
			*readiness = SearchReadinessState::default();
			readiness.vault_path = Some(vault_path.clone());
			log_readiness_transition(
				&vault_path,
				&previous,
				&readiness.status,
				readiness.attempt_count,
				"vault scope changed",
			);
		}
		readiness.max_attempts = SEARCH_MAX_ATTEMPTS;

		if readiness.status == SearchReadinessStatus::Ready {
			log_readiness_transition(
				&vault_path,
				&readiness.status,
				&readiness.status,
				readiness.attempt_count,
				"already ready",
			);
			return Ok(readiness_response(&readiness));
		}
		if readiness.status == SearchReadinessStatus::Warming {
			log_readiness_transition(
				&vault_path,
				&readiness.status,
				&readiness.status,
				readiness.attempt_count,
				"warm-up already in progress",
			);
			return Ok(readiness_response(&readiness));
		}
		if readiness.attempt_count >= readiness.max_attempts {
			let previous = readiness.status.clone();
			readiness.status = SearchReadinessStatus::Failed;
			log_readiness_transition(
				&vault_path,
				&previous,
				&readiness.status,
				readiness.attempt_count,
				"retry budget exhausted",
			);
			return Ok(readiness_response(&readiness));
		}

		let previous = readiness.status.clone();
		readiness.attempt_count += 1;
		readiness.status = SearchReadinessStatus::Warming;
		readiness.last_error = None;
		log_readiness_transition(
			&vault_path,
			&previous,
			&readiness.status,
			readiness.attempt_count,
			"starting warm-up",
		);
	}

	let warm_result: Result<(), TessellumError> = async {
		let sync_result = run_sync_vault(state.inner(), kuzu_state.inner(), &vault_path).await?;
		if !sync_result.success {
			return Err(TessellumError::Internal(
				sync_result
					.error
					.unwrap_or_else(|| "sync_vault reported failure".to_string()),
			));
		}

		let coherence = compute_markdown_coherence(&state).await?;
		if needs_rebuild(&coherence) {
			rebuild_search_index_internal(state.inner(), vault_path.clone()).await?;
		}
		Ok(())
	}
	.await;

	let mut readiness = state.search_readiness.lock().await;
	match warm_result {
		Ok(()) => {
			let previous = readiness.status.clone();
			readiness.status = SearchReadinessStatus::Ready;
			readiness.last_error = None;
			log_readiness_transition(
				&vault_path,
				&previous,
				&readiness.status,
				readiness.attempt_count,
				"warm-up complete",
			);
		}
		Err(error) => {
			let previous = readiness.status.clone();
			readiness.status = SearchReadinessStatus::Failed;
			readiness.last_error = Some(error.to_string());
			log_readiness_transition(
				&vault_path,
				&previous,
				&readiness.status,
				readiness.attempt_count,
				"warm-up failed",
			);
		}
	}

	Ok(readiness_response(&readiness))
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
	rebuild_search_index_internal(state.inner(), vault_path).await
}

async fn rebuild_search_index_internal(
	state: &AppState,
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

#[cfg(test)]
mod tests {
	use super::{
		count_mismatches_with_early_exit,
		is_markdown_path,
		mismatch_threshold,
		needs_rebuild,
		CoherenceResult,
	};
	use std::collections::HashSet;

	#[test]
	fn mismatch_threshold_uses_one_percent_floor_of_one() {
		assert_eq!(mismatch_threshold(0), 1);
		assert_eq!(mismatch_threshold(10), 1);
		assert_eq!(mismatch_threshold(99), 1);
		assert_eq!(mismatch_threshold(100), 1);
		assert_eq!(mismatch_threshold(101), 2);
		assert_eq!(mismatch_threshold(250), 3);
	}

	#[test]
	fn mismatch_counter_short_circuits_at_threshold() {
		let expected = HashSet::from([
			"a.md".to_string(),
			"b.md".to_string(),
			"c.md".to_string(),
			"d.md".to_string(),
		]);
		let indexed = HashSet::from(["a.md".to_string()]);
		let mismatches = count_mismatches_with_early_exit(&expected, &indexed, 2);
		assert_eq!(mismatches, 2);
	}

	#[test]
	fn needs_rebuild_respects_threshold_for_markdown_entries() {
		let below = CoherenceResult {
			expected_markdown_count: 500,
			indexed_markdown_count: 498,
			mismatch_count: 4,
			mismatch_threshold: 5,
		};
		let at_threshold = CoherenceResult {
			expected_markdown_count: 500,
			indexed_markdown_count: 495,
			mismatch_count: 5,
			mismatch_threshold: 5,
		};
		assert!(!needs_rebuild(&below));
		assert!(needs_rebuild(&at_threshold));
	}

	#[test]
	fn markdown_path_detection_is_case_insensitive() {
		assert!(is_markdown_path("note.md"));
		assert!(is_markdown_path("NOTE.MD"));
		assert!(!is_markdown_path("asset.png"));
	}
}

