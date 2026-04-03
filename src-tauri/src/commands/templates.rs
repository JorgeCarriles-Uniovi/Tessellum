use std::fs;
use std::path::Path;

use chrono::{DateTime, Local};
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

pub(crate) fn templates_dir(vault_path: &str) -> std::path::PathBuf {
	Path::new(vault_path).join(".tessellum").join("templates")
}

pub(crate) fn apply_placeholders(
	content: &str,
	title: &str,
	vault_path: &str,
	now: DateTime<Local>,
) -> String {
	let date = now.format("%Y-%m-%d").to_string();
	let time = now.format("%H:%M").to_string();
	let datetime = now.format("%Y-%m-%d %H:%M").to_string();
	let vault = normalize_path(vault_path);
	
	content
		.replace("{{date}}", &date)
		.replace("{{time}}", &time)
		.replace("{{datetime}}", &datetime)
		.replace("{{title}}", title)
		.replace("{{vault}}", &vault)
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
	target_dir: String,
	template_path: String,
	title: String,
) -> Result<String, TessellumError> {
	validate_path_in_vault(&vault_path, &vault_path).map_err(TessellumError::Validation)?;
	validate_path_in_vault(&target_dir, &vault_path).map_err(TessellumError::Validation)?;
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
	let mut file_path = Path::new(&target_dir).join(&filename);
	let mut collision_index = 1;
	
	while file_path.exists() {
		let stem = clean_title.strip_suffix(".md").unwrap_or(&clean_title);
		filename = format!("{} ({}).md", stem, collision_index);
		file_path = Path::new(&target_dir).join(&filename);
		collision_index += 1;
	}
	
	let processed_content =
		apply_placeholders(&template_content, &clean_title, &target_dir, Local::now());
	
	tokio::fs::write(&file_path, &processed_content)
		.await
		.map_err(TessellumError::from)?;
	
	let path_str = normalize_path(&file_path.to_string_lossy());
	
	let db = state.db.clone();
	db
		.index_file(&path_str, 0, 0, None, None, &[])
		.await
		.unwrap_or_else(|e| log::warn!("Failed to index new file: {}", e));
	
	let mut idx_guard = state.file_index.lock().await;
	*idx_guard = None;
	let mut asset_guard = state.asset_index.lock().await;
	*asset_guard = None;
	
	Ok(path_str)
}

#[cfg(test)]
mod tests {
	use super::apply_placeholders;
	use chrono::{Local, TimeZone};
	
	#[test]
	fn test_apply_placeholders_replaces_core_tokens() {
		let now = Local.with_ymd_and_hms(2026, 3, 11, 14, 5, 0).unwrap();
		let content = "Date: {{date}}\nTime: {{time}}\nDT: {{datetime}}\nTitle: {{title}}\nVault: {{vault}}";
		let out = apply_placeholders(content, "My Note", "C:\\Vault", now);
		
		assert!(out.contains("Date: 2026-03-11"));
		assert!(out.contains("Time: 14:05"));
		assert!(out.contains("DT: 2026-03-11 14:05"));
		assert!(out.contains("Title: My Note"));
		assert!(out.contains("Vault: C:/Vault"));
	}
	
	#[test]
	fn test_apply_placeholders_leaves_unknown_tokens() {
		let now = Local.with_ymd_and_hms(2026, 3, 11, 14, 5, 0).unwrap();
		let content = "Hello {{unknown}} {{date}}";
		let out = apply_placeholders(content, "X", "/vault", now);
		
		assert!(out.contains("{{unknown}}"));
		assert!(out.contains("2026-03-11"));
	}
	
	#[test]
	fn test_apply_placeholders_multiple_occurrences() {
		let now = Local.with_ymd_and_hms(2026, 3, 11, 14, 5, 0).unwrap();
		let content = "{{date}} {{date}} {{time}} {{time}}";
		let out = apply_placeholders(content, "X", "/vault", now);
		
		assert_eq!(out, "2026-03-11 2026-03-11 14:05 14:05");
	}
}


