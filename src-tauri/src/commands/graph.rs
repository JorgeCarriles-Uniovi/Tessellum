use serde::Serialize;
use std::collections::HashSet;
use tauri::State;

use crate::error::TessellumError;
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

/// Execute a GQL/Cypher query on the Grafeo database
#[tauri::command]
pub fn execute_graph_query(cypher: String) -> Result<serde_json::Value, TessellumError> {
	crate::grafeo_projection::execute_query(&cypher)
		.map_err(|e| TessellumError::Internal(e))
}

pub async fn build_graph_data(
	state: &AppState,
	vault_path: &str,
) -> Result<GraphData, TessellumError> {
	let db = state.db.clone();
	
	let notes = db
		.get_all_indexed_files()
		.await
		.map_err(TessellumError::from)?;
	let links = db
		.get_all_links()
		.await
		.map_err(TessellumError::from)?;
	let broken_links: HashSet<(String, String)> = db
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
	
	let orphaned_files: HashSet<String> = db
		.get_orphaned_files()
		.await
		.map_err(TessellumError::from)?
		.into_iter()
		.map(|p| crate::utils::normalize_path(&p))
		.collect();
	
	let file_tags = db
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

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::{build_graph_data, path_to_label};
    use crate::db::Database;
    use crate::models::AppState;
    use crate::search::SearchIndex;

    #[test]
    fn strips_vault_prefix_and_markdown_extension_for_labels() {
        assert_eq!(
            path_to_label("Vault/Projects/Plan.md", "Vault"),
            "Plan"
        );
        assert_eq!(path_to_label("Vault/Projects/Image.png", "Vault"), "Image.png");
    }

    #[tokio::test]
    async fn builds_graph_data_with_existing_orphan_and_broken_nodes() {
        let dir = tempdir().unwrap();
        let db = Database::init(dir.path().join("graph.sqlite").to_str().unwrap())
            .await
            .unwrap();
        let alpha = dir.path().join("Vault/Alpha.md");
        let beta = dir.path().join("Vault/Beta.md");
        let orphan = dir.path().join("Vault/Orphan.md");
        let missing = dir.path().join("Vault/Missing.md");
        db.index_file(
            &alpha.to_string_lossy(),
            1,
            10,
            Some(r#"{"tags":["project"]}"#),
            None,
            &[
                beta.to_string_lossy().to_string(),
                missing.to_string_lossy().to_string(),
            ],
        )
        .await
        .unwrap();
        db.index_file(&beta.to_string_lossy(), 1, 10, None, None, &[]).await.unwrap();
        db.index_file(&orphan.to_string_lossy(), 1, 10, None, None, &[]).await.unwrap();

        let search_dir = tempdir().unwrap();
        let app_state = AppState::new(db, SearchIndex::open_or_create(&search_dir.path().join("search-index")).unwrap());
        let normalized_alpha = crate::utils::normalize_path(&alpha.to_string_lossy());
        let normalized_orphan = crate::utils::normalize_path(&orphan.to_string_lossy());
        let normalized_missing = crate::utils::normalize_path(&missing.to_string_lossy());

        let graph = build_graph_data(&app_state, dir.path().join("Vault").to_str().unwrap()).await.unwrap();

        assert!(graph.nodes.iter().any(|node| node.id == normalized_alpha && node.exists));
        assert!(graph.nodes.iter().any(|node| node.id == normalized_orphan && node.orphan));
        assert!(graph.nodes.iter().any(|node| node.id == normalized_missing && !node.exists));
        assert!(graph.edges.iter().any(|edge| edge.target == normalized_missing && edge.broken));
    }
}
