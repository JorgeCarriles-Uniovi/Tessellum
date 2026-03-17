use std::path::{Path, PathBuf};
use tauri::State;

use crate::error::TessellumError;
use crate::models::{AppState, AssetIndex};
use crate::utils::validate_path_in_vault;

const SUPPORTED_EXTS: &[&str] = &[
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif", "pdf",
];

fn is_supported_asset(path: &Path) -> bool {
	let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
	SUPPORTED_EXTS.contains(&ext.as_str())
}

fn to_asset_path(path: &Path) -> String {
	let raw = path.to_string_lossy().to_string();
	raw.strip_prefix("\\\\?\\")
		.unwrap_or(&raw)
		.to_string()
}

#[tauri::command]
pub async fn resolve_asset(
	state: State<'_, AppState>,
	vault_path: String,
	target: String,
	source_path: Option<String>,
	mode: String,
) -> Result<Option<String>, TessellumError> {
	let target = target.trim();
	
	if target.starts_with("http://") || target.starts_with("https://") || target.starts_with("data:") {
		return Ok(None);
	}
	
	if mode == "markdown" {
		let base_dir = source_path
			.as_deref()
			.and_then(|p| Path::new(p).parent())
			.unwrap_or(Path::new(&vault_path));
		
		let resolved_path = if Path::new(target).is_absolute() {
			PathBuf::from(target)
		} else {
			base_dir.join(target)
		};
		
		if !resolved_path.exists() {
			return Ok(None); 
		}
		
		let resolved = validate_path_in_vault(&resolved_path.to_string_lossy(), &vault_path)
			.map_err(TessellumError::Validation)?;
		
		if !is_supported_asset(&resolved) {
			return Ok(None);
		}
		
		return Ok(Some(to_asset_path(&resolved)));
	}
	
	// First check under the lock whether the index is already built.
	{
		let mut index_guard = state.asset_index.lock().await;
		if index_guard.is_some() {
			let asset_index = index_guard.as_ref().unwrap();
			return Ok(asset_index
				.resolve(&vault_path, target)
				.map(|p| to_asset_path(&p)));
		}
		// `index_guard` is dropped here, releasing the lock before building the index.
	}
	// Build the asset index without holding the mutex, as this can be expensive.
	let built_index = AssetIndex::build(&vault_path)
		.map_err(|e| TessellumError::Internal(format!("Failed to build asset index: {}", e)))?;
	// Reacquire the lock and install the built index if another task hasn't done so already.
	
	let mut index_guard = state.asset_index.lock().await;
	if index_guard.is_none() {
		*index_guard = Some(built_index);
	}
	
	let asset_index = index_guard.as_ref().unwrap();
	Ok(asset_index
		.resolve(&vault_path, target)
		.map(|p| to_asset_path(&p)))
}
