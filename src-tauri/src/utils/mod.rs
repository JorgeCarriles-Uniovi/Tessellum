mod sanitize;
mod validate;
pub mod frontmatter;
pub mod config;
mod tags;

pub use sanitize::sanitize_string;
pub use validate::{is_hidden_or_special, validate_path_in_vault};
pub use tags::extract_tags;

/// Normalize path separators to forward slashes (for cross-platform consistency)
pub fn normalize_path(path: &str) -> String {
	path.replace('\\', "/")
}
