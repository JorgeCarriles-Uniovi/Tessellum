use std::collections::HashMap;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// In-memory index of files in the vault for fast wikilink resolution.
pub struct FileIndex {
    /// Map: filename -> Vec<full_path>
    name_to_paths: HashMap<String, Vec<PathBuf>>,
}

impl FileIndex {
    /// Build an index from a vault directory
    pub fn build(vault_path: &str) -> Result<Self, String> {
        let mut name_to_paths: HashMap<String, Vec<PathBuf>> = HashMap::new();

        if !Path::new(vault_path).exists() {
            return Err("Vault path does not exist".to_string());
        }

        for entry in WalkDir::new(vault_path).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();

            // Skip hidden files and directories
            let path_str = path.to_string_lossy();
            if path_str.contains("/.") {
                continue;
            }

            // Only index .md files
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                if let Some(filename) = path.file_name() {
                    let filename_str = filename.to_string_lossy().to_string();

                    // Index both with and without .md extension
                    name_to_paths
                        .entry(filename_str.clone())
                        .or_insert_with(Vec::new)
                        .push(path.to_path_buf());

                    // Also index without extension
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

    /// Resolve a wikilink target to a full file path.
    /// Returns the best match based on Obsidian's resolution rules:
    /// 1. If the link contains a path (e.g., "folder/Note"), try to match that structure
    /// 2. If multiple files have the same name, prefer the shortest path (closest to root)
    /// 3. Return None if no match is found
    pub fn resolve(&self, vault_path: &str, link_target: &str) -> Option<PathBuf> {
        let vault_root = Path::new(vault_path);

        // Check if this is a path-based link (contains /)
        if link_target.contains('/') {
            // Try to resolve as a relative path from vault root
            let mut full_path = vault_root.join(link_target);

            // Add .md extension if not present
            if !full_path.extension().map_or(false, |ext| ext == "md") {
                full_path.set_extension("md");
            }

            if full_path.exists() {
                return Some(full_path);
            }

            // Also try matching the filename part only
            if let Some(filename) = Path::new(link_target).file_name() {
                let filename_str = filename.to_string_lossy().to_string();
                if let Some(candidates) = self.name_to_paths.get(&filename_str) {
                    // Filter candidates that end with the specified path structure
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

        // Simple filename lookup
        let search_key = if link_target.ends_with(".md") {
            link_target.to_string()
        } else {
            link_target.to_string()
        };

        if let Some(candidates) = self.name_to_paths.get(&search_key) {
            if candidates.is_empty() {
                return None;
            }

            // If multiple matches, prefer shortest path (closest to vault root)
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
