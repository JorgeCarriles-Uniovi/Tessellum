use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::utils::is_hidden_or_special;

const SUPPORTED_EXTS: &[&str] = &[
	"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif", "pdf",
];

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
						.or_insert_with(Vec::new)
						.push(path.to_path_buf());
					
					if let Some(stem) = path.file_stem() {
						let stem_str = stem.to_string_lossy().to_string();
						name_to_paths
							.entry(stem_str)
							.or_insert_with(Vec::new)
							.push(path.to_path_buf());
					}
				}
			}
		}
		
		Ok(Self { name_to_paths })
	}
	
	pub fn resolve(&self, vault_path: &str, link_target: &str) -> Option<PathBuf> {
		let vault_root = Path::new(vault_path);
		
		if link_target.contains('/') || link_target.contains('\\') {
			let mut full_path = vault_root.join(link_target);
			if full_path.exists() {
				return Some(full_path);
			}
			
			if full_path.extension().is_none() {
				for ext in SUPPORTED_EXTS {
					full_path.set_extension(ext);
					if full_path.exists() {
						return Some(full_path.clone());
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
						return Some(matching[0].clone());
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
			
			return Some(best_match.clone());
		}
		
		None
	}
}
