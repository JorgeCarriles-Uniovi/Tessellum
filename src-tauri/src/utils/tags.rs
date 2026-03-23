use regex::Regex;
use std::collections::HashSet;

/// Extract normalized tags from markdown content.
///
/// Normalization rules:
/// - strip leading '#'
/// - lowercase
/// - keep '/' for hierarchical tags
pub fn extract_tags(content: &str) -> Vec<String> {
	let mut tags = HashSet::new();
	
	let mut body_content = content;
	if let Some((_, _)) = crate::utils::frontmatter::parse_frontmatter(content) {
		body_content = crate::utils::frontmatter::strip_frontmatter(content);
	}
	
	// Inline tags: #tag-name
	let tag_regex = Regex::new(r"(?:^|\s)#([a-zA-Z0-9_\-/]+)").unwrap();
	for cap in tag_regex.captures_iter(body_content) {
		if let Some(tag_match) = cap.get(1) {
			let normalized = normalize_tag(tag_match.as_str());
			if !normalized.is_empty() {
				tags.insert(normalized);
			}
		}
	}
	
	// Frontmatter tags
	if let Some((yaml, _)) = crate::utils::frontmatter::parse_frontmatter(content) {
		if let Ok(json) = crate::utils::frontmatter::frontmatter_to_json(&yaml) {
			if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
				if let Some(tags_value) = value.get("tags") {
					match tags_value {
						serde_json::Value::Array(arr) => {
							for item in arr {
								if let Some(tag) = item.as_str() {
									let normalized = normalize_tag(tag);
									if !normalized.is_empty() {
										tags.insert(normalized);
									}
								}
							}
						}
						serde_json::Value::String(s) => {
							for part in s.split(',') {
								let normalized = normalize_tag(part);
								if !normalized.is_empty() {
									tags.insert(normalized);
								}
							}
						}
						_ => {}
					}
				}
			}
		}
	}
	
	let mut result: Vec<String> = tags.into_iter().collect();
	result.sort();
	result
}

fn normalize_tag(tag: &str) -> String {
	tag.trim()
		.trim_start_matches('#')
		.to_lowercase()
}
