use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::State;

use crate::error::TessellumError;
use crate::kuzu_projection::{execute_graph_query_inner, lock_connection, ManagedKuzuConnection};
use crate::models::AppState;

#[derive(Serialize, Clone)]
pub struct GraphNode {
	pub id: String,
	pub label: String,
	pub exists: bool,
	pub orphan: bool,
	pub tags: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct GraphEdge {
	pub source: String,
	pub target: String,
	pub broken: bool,
}

#[derive(Serialize, Clone)]
pub struct GraphData {
	pub nodes: Vec<GraphNode>,
	pub edges: Vec<GraphEdge>,
}

fn path_to_label(path: &str, vault_path: &str) -> String {
	let normalized = crate::utils::normalize_path(path);
	let normalized_vault = crate::utils::normalize_path(vault_path);
	
	let mut relative = normalized;
	if relative.starts_with(&normalized_vault) {
		relative = relative[normalized_vault.len()..].to_string();
		if relative.starts_with('/') {
			relative = relative[1..].to_string();
		}
	}
	
	if let Some(stripped) = relative.strip_suffix(".md") {
		relative = stripped.to_string();
	}
	
	let parts: Vec<&str> = relative.split('/').collect();
	parts.last().unwrap_or(&"").to_string()
}

/// Retrieves data for the graph view, resolving paths and checking status on the backend.
#[tauri::command]
pub async fn get_graph_data(
	state: State<'_, AppState>,
	vault_path: String,
) -> Result<GraphData, TessellumError> {
	build_graph_data(&state, &vault_path).await
}

#[tauri::command]
pub fn execute_graph_query(
	cypher: String,
	state: State<'_, Mutex<ManagedKuzuConnection>>,
) -> Result<Value, String> {
	let conn = lock_connection(&state)?;
	execute_graph_query_inner(&conn, &cypher)
}

pub async fn build_graph_data(
	state: &AppState,
	vault_path: &str,
) -> Result<GraphData, TessellumError> {
	let db_guard = state.db.lock().await;
	
	let notes = db_guard
		.get_all_indexed_files()
		.await
		.map_err(TessellumError::from)?;
	let links = db_guard
		.get_all_links()
		.await
		.map_err(TessellumError::from)?;
	let broken_links: HashSet<(String, String)> = db_guard
		.get_broken_links()
		.await
		.map_err(TessellumError::from)?
		.into_iter()
		.map(|(s, t)| {
			(
				crate::utils::normalize_path(&s),
				crate::utils::normalize_path(&t),
			)
		})
		.collect();
	
	let orphaned_files: HashSet<String> = db_guard
		.get_orphaned_files()
		.await
		.map_err(TessellumError::from)?
		.into_iter()
		.map(|p| crate::utils::normalize_path(&p))
		.collect();
	
	let file_tags = db_guard
		.get_files_tags()
		.await
		.map_err(TessellumError::from)?;
	
	let mut nodes = Vec::new();
	let mut edges = Vec::new();
	
	let mut existing_paths = HashSet::new();
	
	// Add existing nodes
	for (path, _) in notes {
		let normalized = crate::utils::normalize_path(&path);
		existing_paths.insert(normalized.clone());
		
		let tags = file_tags.get(&path).cloned().unwrap_or_default();
		
		nodes.push(GraphNode {
			id: normalized.clone(),
			label: path_to_label(&path, vault_path),
			exists: true,
			orphan: orphaned_files.contains(&normalized),
			tags,
		});
	}
	
	// Add edges and missing target nodes
	for (source, target) in links {
		let normalized_source = crate::utils::normalize_path(&source);
		let normalized_target = crate::utils::normalize_path(&target);
		
		let broken = broken_links.contains(&(normalized_source.clone(), normalized_target.clone()));
		
		if broken && !existing_paths.contains(&normalized_target) {
			// Check if we already added a ghost node for this target
			let already_added = nodes.iter().any(|n| n.id == normalized_target);
			if !already_added {
				nodes.push(GraphNode {
					id: normalized_target.clone(),
					label: path_to_label(&target, vault_path),
					exists: false,
					orphan: false,
					tags: Vec::new(),
				});
				existing_paths.insert(normalized_target.clone());
			}
		}
		
		edges.push(GraphEdge {
			source: normalized_source,
			target: normalized_target,
			broken,
		});
	}
	
	Ok(GraphData { nodes, edges })
}
