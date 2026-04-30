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

#[cfg(test)]
mod tests {
	use std::fs;

	use tempfile::tempdir;

	use super::{is_hidden_or_special, validate_path_in_vault};

	#[test]
	fn validates_paths_that_resolve_inside_the_vault() {
		let vault = tempdir().unwrap();
		let notes_dir = vault.path().join("Notes");
		fs::create_dir_all(&notes_dir).unwrap();
		let note = notes_dir.join("Note.md");
		fs::write(&note, "# Note").unwrap();

		let validated = validate_path_in_vault(
			note.to_str().unwrap(),
			vault.path().to_str().unwrap(),
		)
		.unwrap();

		assert_eq!(validated, note.canonicalize().unwrap());
	}

	#[test]
	fn rejects_paths_outside_the_vault() {
		let vault = tempdir().unwrap();
		let outside = tempdir().unwrap();
		let outside_note = outside.path().join("Outside.md");
		fs::write(&outside_note, "# Outside").unwrap();

		let err = validate_path_in_vault(
			outside_note.to_str().unwrap(),
			vault.path().to_str().unwrap(),
		)
		.unwrap_err();

		assert!(err.contains("outside the vault"));
	}

	#[test]
	fn detects_hidden_and_special_path_components() {
		assert!(is_hidden_or_special(std::path::Path::new(".git/config")));
		assert!(is_hidden_or_special(std::path::Path::new("Notes/.trash/Entry.md")));
		assert!(!is_hidden_or_special(std::path::Path::new("Notes/Entry.md")));
	}
}
