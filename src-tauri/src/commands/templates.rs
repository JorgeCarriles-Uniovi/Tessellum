use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::error::TessellumError;
use crate::models::AppState;
use crate::utils::{normalize_path, sanitize_string, validate_path_in_vault};

#[derive(Serialize)]
pub struct TemplateInfo {
	pub name: String,
	pub path: String,
}

fn templates_dir(vault_path: &str) -> std::path::PathBuf {
	Path::new(vault_path).join(".tessellum").join("templates")
}

#[tauri::command]
pub async fn list_templates(vault_path: String) -> Result<Vec<TemplateInfo>, TessellumError> {
	validate_path_in_vault(&vault_path, &vault_path).map_err(TessellumError::Validation)?;
	
	let dir = templates_dir(&vault_path);
	if !dir.exists() {
		fs::create_dir_all(&dir).map_err(TessellumError::Io)?;
	}
	
	let mut templates = Vec::new();
	
	for entry in fs::read_dir(&dir).map_err(TessellumError::Io)? {
		let entry = match entry {
			Ok(e) => e,
			Err(e) => {
				log::warn!("Failed to read templates entry: {}", e);
				continue;
			}
		};
		
		let path = entry.path();
		if path.extension().and_then(|e| e.to_str()) != Some("md") {
			continue;
		}
		
		let name = match path.file_stem().and_then(|s| s.to_str()) {
			Some(stem) => stem.to_string(),
			None => continue,
		};
		
		templates.push(TemplateInfo {
			name,
			path: normalize_path(&path.to_string_lossy()),
		});
	}
	
	templates.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
	
	Ok(templates)
}

#[tauri::command]
pub async fn create_note_from_template(
	state: State<'_, AppState>,
	vault_path: String,
	template_path: String,
	title: String,
) -> Result<String, TessellumError> {
	validate_path_in_vault(&vault_path, &vault_path).map_err(TessellumError::Validation)?;
	validate_path_in_vault(&template_path, &vault_path).map_err(TessellumError::Validation)?;
	
	let template_content = tokio::fs::read_to_string(&template_path)
		.await
		.map_err(TessellumError::from)?;
	
	let clean_title = sanitize_string(title);
	if clean_title.trim().is_empty() {
		return Err(TessellumError::Validation(
			"Title cannot be empty".to_string(),
		));
	}
	
	let mut filename = if clean_title.to_lowercase().ends_with(".md") {
		clean_title.clone()
	} else {
		format!("{}.md", clean_title)
	};
	let mut file_path = Path::new(&vault_path).join(&filename);
	let mut collision_index = 1;
	
	while file_path.exists() {
		let stem = clean_title.strip_suffix(".md").unwrap_or(&clean_title);
		filename = format!("{} ({}).md", stem, collision_index);
		file_path = Path::new(&vault_path).join(&filename);
		collision_index += 1;
	}
	
	tokio::fs::write(&file_path, &template_content)
		.await
		.map_err(TessellumError::from)?;
	
	let path_str = normalize_path(&file_path.to_string_lossy());
	
	let db_guard = state.db.lock().await;
	db_guard
		.index_file(&path_str, 0, 0, None, None, &[])
		.await
		.unwrap_or_else(|e| log::warn!("Failed to index new file: {}", e));
	
	let mut idx_guard = state.file_index.lock().await;
	*idx_guard = None;
	
	Ok(path_str)
}
