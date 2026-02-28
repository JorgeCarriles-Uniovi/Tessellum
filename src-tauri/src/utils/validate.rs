use std::path::PathBuf;

/// Validates that a given path resolves to a location inside the vault directory.
/// Uses `canonicalize()` to resolve symlinks and `..` components, preventing
/// path traversal attacks (e.g., `../../etc/passwd`).
pub fn validate_path_in_vault(path: &str, vault_path: &str) -> Result<PathBuf, String> {
	let resolved = PathBuf::from(path)
		.canonicalize()
		.map_err(|e| format!("Invalid path '{}': {}", path, e))?;
	let vault_root = PathBuf::from(vault_path)
		.canonicalize()
		.map_err(|e| format!("Invalid vault path '{}': {}", vault_path, e))?;
	if !resolved.starts_with(&vault_root) {
		return Err("Security Error: Cannot access files outside the vault".to_string());
	}
	Ok(resolved)
}

/// Checks if a path contains hidden or special directories/files (starting with `.`).
/// This covers `.git`, `.trash`, `.obsidian`, etc. in a cross-platform way.
pub fn is_hidden_or_special(path: &std::path::Path) -> bool {
	path.components()
		.any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
}
