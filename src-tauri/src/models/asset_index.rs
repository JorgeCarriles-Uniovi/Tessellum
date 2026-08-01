use std::collections::HashMap;
use std::fs::canonicalize;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::utils::is_hidden_or_special;

const SUPPORTED_EXTS: &[&str] = &[
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif", "pdf", "html", "htm",
];

fn is_supported_path(path: &Path) -> bool {
	let ext = path
		.extension()
		.and_then(|s| s.to_str())
		.unwrap_or("")
		.to_lowercase();
	SUPPORTED_EXTS.contains(&ext.as_str())
}

/// Accept `candidate` only when it canonicalizes to a location under
/// `canonical_vault_root` and carries a supported asset extension.
///
/// Every `resolve` return path goes through this. Containment must be enforced
/// here rather than relying on Tauri's asset scope, which is outside this
/// codebase and widens as more vault directories are granted per session.
fn accept_in_vault(candidate: &Path, canonical_vault_root: &Path) -> Option<PathBuf> {
	if !is_supported_path(candidate) {
		return None;
	}
	let canonical = canonicalize(candidate).ok()?;
	if canonical.starts_with(canonical_vault_root) {
		Some(candidate.to_path_buf())
	} else {
		None
	}
}

#[derive(Debug, Clone)]
pub struct AssetIndex {
	name_to_paths: HashMap<String, Vec<PathBuf>>,
}

impl AssetIndex {
	pub fn build(vault_path: &str) -> Result<Self, String> {
		let mut name_to_paths: HashMap<String, Vec<PathBuf>> = HashMap::new();
		
		if !Path::new(vault_path).exists() {
			return Err("Vault path does not exist".to_string());
		}
		
		for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
			let path = entry.path();
			let rel_path = path.strip_prefix(vault_path).unwrap_or(path);
			if is_hidden_or_special(rel_path) {
				continue;
			}
			
			if path.is_file() {
				let ext = path
					.extension()
					.and_then(|s| s.to_str())
					.unwrap_or("")
					.to_lowercase();
				if !SUPPORTED_EXTS.contains(&ext.as_str()) {
					continue;
				}
				
				if let Some(filename) = path.file_name() {
					let filename_str = filename.to_string_lossy().to_string();
					name_to_paths
						.entry(filename_str.clone())
						.or_default()
						.push(path.to_path_buf());
					
					if let Some(stem) = path.file_stem() {
						let stem_str = stem.to_string_lossy().to_string();
						name_to_paths
							.entry(stem_str)
							.or_default()
							.push(path.to_path_buf());
					}
				}
			}
		}
		
		Ok(Self { name_to_paths })
	}
	
	pub fn resolve(&self, vault_path: &str, link_target: &str) -> Option<PathBuf> {
		let vault_root = Path::new(vault_path);
		let canonical_vault_root = canonicalize(vault_root).ok()?;
		
		// Reject absolute link targets so they cannot escape the vault via
		// join.
		if Path::new(link_target).is_absolute() {
			return None;
		}
		
		if link_target.contains('/') || link_target.contains('\\') {
			let mut full_path = vault_root.join(link_target);
			if full_path.exists() {
				return accept_in_vault(&full_path, &canonical_vault_root);
			}

			if full_path.extension().is_none() {
				for ext in SUPPORTED_EXTS {
					full_path.set_extension(ext);
					if full_path.exists() {
						return accept_in_vault(&full_path, &canonical_vault_root);
					}
				}
			}

			if let Some(filename) = Path::new(link_target).file_name() {
				let filename_str = filename.to_string_lossy().to_string();
				if let Some(candidates) = self.name_to_paths.get(&filename_str) {
					let matching: Vec<_> = candidates
						.iter()
						.filter(|p| {
							if let Ok(rel) = p.strip_prefix(vault_root) {
								rel.to_string_lossy().contains(link_target)
							} else {
								false
							}
						})
						.collect();

					if !matching.is_empty() {
						return accept_in_vault(matching[0], &canonical_vault_root);
					}
				}
			}
		}

		if let Some(candidates) = self.name_to_paths.get(link_target) {
			if candidates.is_empty() {
				return None;
			}

			let best_match = candidates.iter().min_by_key(|p| {
				p.strip_prefix(vault_root)
					.ok()
					.map(|rel| rel.components().count())
					.unwrap_or(usize::MAX)
			})?;

			return accept_in_vault(best_match, &canonical_vault_root);
		}

		None
	}
}

#[cfg(test)]
mod tests {
	use std::fs;
	use tempfile::tempdir;

	use super::AssetIndex;

	#[test]
	fn build_and_resolve_finds_html_files_by_name() {
		// Regression test: SUPPORTED_EXTS previously excluded html/htm, so
		// AssetIndex::build never added .html files to name_to_paths at all,
		// and resolve() always returned None for them regardless of the
		// wikilink target — this is what made ![[page.html]] embeds show
		// "Missing asset" in the app.
		let vault = tempdir().unwrap();
		let html_path = vault.path().join("scratch.html");
		fs::write(&html_path, "<h1>hi</h1>").unwrap();

		let index = AssetIndex::build(vault.path().to_str().unwrap()).unwrap();

		assert_eq!(index.resolve(vault.path().to_str().unwrap(), "scratch.html"), Some(html_path.clone()));
		// Extensionless wikilink target ("[[scratch]]") resolves via the
		// file-stem entry build() only populates for supported extensions.
		assert_eq!(index.resolve(vault.path().to_str().unwrap(), "scratch"), Some(html_path));
	}

	#[test]
	fn resolve_rejects_a_path_style_target_that_escapes_the_vault() {
		// `![[../outside/page.html]]` must not resolve: the joined-path branch
		// previously returned as soon as the file existed, with no containment
		// check, handing the frontend a path outside the vault to iframe.
		let parent = tempdir().unwrap();
		let vault = parent.path().join("vault");
		let outside = parent.path().join("outside");
		fs::create_dir_all(&vault).unwrap();
		fs::create_dir_all(&outside).unwrap();
		fs::write(outside.join("page.html"), "<h1>secret</h1>").unwrap();

		let index = AssetIndex::build(vault.to_str().unwrap()).unwrap();

		assert_eq!(index.resolve(vault.to_str().unwrap(), "../outside/page.html"), None);
		assert_eq!(index.resolve(vault.to_str().unwrap(), "..\\outside\\page.html"), None);
	}

	#[test]
	fn resolve_still_returns_in_vault_nested_targets() {
		let vault = tempdir().unwrap();
		let nested = vault.path().join("Projects");
		fs::create_dir_all(&nested).unwrap();
		let page = nested.join("page.html");
		fs::write(&page, "<h1>hi</h1>").unwrap();

		let index = AssetIndex::build(vault.path().to_str().unwrap()).unwrap();
		let resolved = index.resolve(vault.path().to_str().unwrap(), "Projects/page.html");

		assert!(resolved.is_some());
		assert!(std::fs::canonicalize(resolved.unwrap())
			.unwrap()
			.starts_with(std::fs::canonicalize(vault.path()).unwrap()));
	}

	#[test]
	fn resolve_rejects_unsupported_extensions_on_the_joined_path_branch() {
		// The joined-path branch never checked the extension, so an in-vault
		// `![[notes/private.env]]` would resolve and be handed to the frontend.
		let vault = tempdir().unwrap();
		let nested = vault.path().join("notes");
		fs::create_dir_all(&nested).unwrap();
		fs::write(nested.join("private.env"), "TOKEN=1").unwrap();

		let index = AssetIndex::build(vault.path().to_str().unwrap()).unwrap();

		assert_eq!(index.resolve(vault.path().to_str().unwrap(), "notes/private.env"), None);
	}
}
