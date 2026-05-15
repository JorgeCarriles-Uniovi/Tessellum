use std::path::{Path, PathBuf};
use tauri::State;

use crate::error::TessellumError;
use crate::models::{AppState, AssetIndex};
use crate::utils::{normalize_path, sanitize_string, validate_path_in_vault};

const SUPPORTED_EXTS: &[&str] = &[
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif", "pdf",
];

fn is_supported_ext(ext: &str) -> bool {
	SUPPORTED_EXTS.contains(&ext)
}

fn is_supported_asset(path: &Path) -> bool {
	let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
	is_supported_ext(ext.as_str())
}

fn to_asset_path(path: &Path) -> String {
	let raw = path.to_string_lossy().to_string();
	raw.strip_prefix("\\\\?\\")
		.unwrap_or(&raw)
		.to_string()
}

async fn resolve_asset_inner(
	state: &AppState,
	vault_path: &str,
	target: &str,
	source_path: Option<&str>,
	mode: &str,
) -> Result<Option<String>, TessellumError> {
	let target = target.trim();
	
	if target.starts_with("http://") || target.starts_with("https://") || target.starts_with("data:") {
		return Ok(None);
	}
	
	if mode == "markdown" {
		let base_dir = source_path
			.and_then(|p| Path::new(p).parent())
			.unwrap_or(Path::new(vault_path));
		
		let resolved_path = if Path::new(target).is_absolute() {
			PathBuf::from(target)
		} else {
			base_dir.join(target)
		};
		
		if !resolved_path.exists() {
			return Ok(None);
		}
		
		let resolved = validate_path_in_vault(&resolved_path.to_string_lossy(), vault_path)
			.map_err(TessellumError::Validation)?;
		
		if !is_supported_asset(&resolved) {
			return Ok(None);
		}
		
		return Ok(Some(to_asset_path(&resolved)));
	}
	
	let mut index_guard = state.asset_index.lock().await;
	if index_guard.is_none() {
		let idx = AssetIndex::build(vault_path)
			.map_err(|e| TessellumError::Internal(format!("Failed to build asset index: {}", e)))?;
		*index_guard = Some(idx);
	}
	
	let asset_index = index_guard.as_ref().unwrap();
	Ok(asset_index
		.resolve(vault_path, target)
		.map(|p| to_asset_path(&p)))
}

async fn save_asset_inner(
	state: &AppState,
	vault_path: &str,
	target_dir: &str,
	base_name: &str,
	extension: &str,
	bytes: Vec<u8>,
) -> Result<String, TessellumError> {
	let ext_raw = extension.trim().trim_start_matches('.');
	if ext_raw.is_empty() {
		return Err(TessellumError::Validation("Unsupported file type".to_string()));
	}
	if !is_supported_ext(&ext_raw.to_lowercase()) {
		return Err(TessellumError::Validation("Unsupported file type".to_string()));
	}
	
	let clean_base = sanitize_string(base_name.to_string());
	let base = if clean_base.trim().is_empty() {
		"Pasted file".to_string()
	} else {
		clean_base
	};
	
	let vault_root = validate_path_in_vault(vault_path, vault_path)
		.map_err(TessellumError::Validation)?;
	
	let dir_path = if target_dir.trim().is_empty() {
		vault_root.to_path_buf()
	} else {
		let candidate = Path::new(target_dir);
		let full = if candidate.is_absolute() {
			candidate.to_path_buf()
		} else {
			vault_root.join(candidate)
		};
		validate_path_in_vault(&full.to_string_lossy(), vault_path)
			.map_err(TessellumError::Validation)?
	};
	
	tokio::fs::create_dir_all(&dir_path).await?;
	
	let mut filename = format!("{}.{}", base, ext_raw);
	let mut final_path = dir_path.join(&filename);
	let mut counter = 1;
	while final_path.exists() {
		filename = format!("{}-{}.{}", base, counter, ext_raw);
		final_path = dir_path.join(&filename);
		counter += 1;
	}
	
	tokio::fs::write(&final_path, bytes).await?;
	
	let mut index_guard = state.asset_index.lock().await;
	*index_guard = None;
	
	let final_resolved = validate_path_in_vault(&final_path.to_string_lossy(), vault_path)
		.map_err(TessellumError::Validation)?;
	let relative = final_resolved.strip_prefix(&vault_root).unwrap_or(&final_resolved);
	Ok(normalize_path(&relative.to_string_lossy()))
}

#[tauri::command]
pub async fn resolve_asset(
	state: State<'_, AppState>,
	vault_path: String,
	target: String,
	source_path: Option<String>,
	mode: String,
) -> Result<Option<String>, TessellumError> {
	resolve_asset_inner(state.inner(), &vault_path, &target, source_path.as_deref(), &mode).await
}

#[tauri::command]
pub async fn save_asset(
	state: State<'_, AppState>,
	vault_path: String,
	target_dir: String,
	base_name: String,
	extension: String,
	bytes: Vec<u8>,
) -> Result<String, TessellumError> {
	save_asset_inner(
		state.inner(),
		&vault_path,
		&target_dir,
		&base_name,
		&extension,
		bytes,
	)
	.await
}

#[cfg(test)]
mod tests {
	use tempfile::tempdir;

	use super::{resolve_asset_inner, save_asset_inner};
	use crate::db::Database;
	use crate::models::AppState;
	use crate::search::SearchIndex;

	async fn build_app_state(vault_path: &str) -> AppState {
		let db_dir = tempdir().unwrap();
		let db = Database::init(db_dir.path().join("test.sqlite").to_str().unwrap())
			.await
			.unwrap();
		let search_dir = tempdir().unwrap();
		let index_path = search_dir.path().join("search-index");
		let search_index = SearchIndex::open_or_create(&index_path).unwrap();
		let state = AppState::new(db, search_index);
		let _ = vault_path;
		state
	}

	#[tokio::test]
	async fn resolve_asset_ignores_remote_targets_and_resolves_markdown_relative_files() {
		let vault = tempdir().unwrap();
		let note_dir = vault.path().join("Notes");
		std::fs::create_dir_all(&note_dir).unwrap();
		let note_path = note_dir.join("Entry.md");
		let image_path = note_dir.join("Diagram.png");
		std::fs::write(&note_path, "# Entry").unwrap();
		std::fs::write(&image_path, "png").unwrap();
		let state = build_app_state(vault.path().to_str().unwrap()).await;

		let remote = resolve_asset_inner(
			&state,
			vault.path().to_str().unwrap(),
			"https://example.com/file.png",
			Some(note_path.to_str().unwrap()),
			"markdown",
		)
		.await
		.unwrap();
		assert_eq!(remote, None);

		let resolved = resolve_asset_inner(
			&state,
			vault.path().to_str().unwrap(),
			"Diagram.png",
			Some(note_path.to_str().unwrap()),
			"markdown",
		)
		.await
		.unwrap();
		assert_eq!(resolved, Some(image_path.to_string_lossy().to_string()));
	}

	#[tokio::test]
	async fn save_asset_sanitizes_names_and_appends_collision_suffixes() {
		let vault = tempdir().unwrap();
		let assets_dir = vault.path().join("Assets");
		std::fs::create_dir_all(&assets_dir).unwrap();
		std::fs::write(assets_dir.join("Budget 1.png"), "existing").unwrap();
		let state = build_app_state(vault.path().to_str().unwrap()).await;

		let first = save_asset_inner(
			&state,
			vault.path().to_str().unwrap(),
			"Assets",
			"Budget #1",
			"png",
			vec![1, 2, 3],
		)
		.await
		.unwrap();
		let second = save_asset_inner(
			&state,
			vault.path().to_str().unwrap(),
			"Assets",
			"Budget #1",
			"png",
			vec![4, 5, 6],
		)
		.await
		.unwrap();

		assert_eq!(first, "Assets/Budget 1-1.png");
		assert_eq!(second, "Assets/Budget 1-2.png");
		assert!(assets_dir.join("Budget 1-1.png").exists());
		assert!(assets_dir.join("Budget 1-2.png").exists());
	}

	#[tokio::test]
	async fn save_asset_rejects_unsupported_extensions() {
		let vault = tempdir().unwrap();
		let state = build_app_state(vault.path().to_str().unwrap()).await;

		let err = save_asset_inner(
			&state,
			vault.path().to_str().unwrap(),
			"",
			"script",
			"exe",
			vec![1],
		)
		.await
		.unwrap_err();

		assert!(err.to_string().contains("Unsupported file type"));
	}
}
