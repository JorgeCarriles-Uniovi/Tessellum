use regex::Regex;
use std::collections::HashSet;

fn is_fence_line(line: &str) -> bool {
	let trimmed = line.trim_start();
	trimmed.starts_with("```") || trimmed.starts_with("~~~")
}

fn is_block_line(line: &str) -> bool {
	line.trim_start().starts_with('>')
}

fn strip_inline_code_spans_for_tag_scan(line: &str) -> String {
	let chars: Vec<char> = line.chars().collect();
	let mut result = String::with_capacity(line.len());
	let mut i = 0;
	let mut in_code = false;
	let mut delimiter_len = 0usize;

	while i < chars.len() {
		if chars[i] == '`' {
			let mut run_len = 1usize;
			while i + run_len < chars.len() && chars[i + run_len] == '`' {
				run_len += 1;
			}

			if !in_code {
				in_code = true;
				delimiter_len = run_len;
			} else if run_len == delimiter_len {
				in_code = false;
				delimiter_len = 0;
			}

			for _ in 0..run_len {
				result.push(' ');
			}
			i += run_len;
			continue;
		}

		result.push(if in_code { ' ' } else { chars[i] });
		i += 1;
	}

	result
}

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
	let mut in_fenced_block = false;
	for line in body_content.lines() {
		if is_fence_line(line) {
			in_fenced_block = !in_fenced_block;
			continue;
		}

		if in_fenced_block || is_block_line(line) {
			continue;
		}
		let scan_line = strip_inline_code_spans_for_tag_scan(line);

		for cap in tag_regex.captures_iter(&scan_line) {
			if let Some(tag_match) = cap.get(1) {
				let normalized = normalize_tag(tag_match.as_str());
				if !normalized.is_empty() {
					tags.insert(normalized);
				}
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

#[cfg(test)]
mod tests {
	use super::extract_tags;

	#[test]
	fn ignores_tags_in_fenced_blocks_and_blockquotes() {
		let content = r##"#ok

```ts
const x = "#ignored_code";
```

> #ignored_quote
> [!note] #ignored_callout

final #visible
"##;

		let tags = extract_tags(content);
		assert!(tags.contains(&"ok".to_string()));
		assert!(tags.contains(&"visible".to_string()));
		assert!(!tags.contains(&"ignored_code".to_string()));
		assert!(!tags.contains(&"ignored_quote".to_string()));
		assert!(!tags.contains(&"ignored_callout".to_string()));
	}

	#[test]
	fn keeps_frontmatter_tags() {
		let content = r#"---
tags: [alpha, beta]
---

body
"#;
		let tags = extract_tags(content);
		assert!(tags.contains(&"alpha".to_string()));
		assert!(tags.contains(&"beta".to_string()));
	}

	#[test]
	fn ignores_tags_inside_inline_code_spans() {
		let content = r##"normal #visible `#ignored_inline`
text ``#also_ignored`` and #kept
"##;

		let tags = extract_tags(content);
		assert!(tags.contains(&"visible".to_string()));
		assert!(tags.contains(&"kept".to_string()));
		assert!(!tags.contains(&"ignored_inline".to_string()));
		assert!(!tags.contains(&"also_ignored".to_string()));
	}
}

