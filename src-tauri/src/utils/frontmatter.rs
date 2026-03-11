use serde_json::Value;

/// Extracts the raw YAML string and the body (content after frontmatter).
/// Returns `None` if no frontmatter exists.
pub fn parse_frontmatter(content: &str) -> Option<(String, String)> {
	let frontmatter_start = if content.starts_with("---\n") {
		4
	} else if content.starts_with("---\r\n") {
		5
	} else {
		return None;
	};
	
	let end_index = content[frontmatter_start..].find("\n---");
	if let Some(idx) = end_index {
		let yaml_str = content[frontmatter_start..frontmatter_start + idx]
			.trim()
			.to_string();
		
		let after_dash = &content[frontmatter_start + idx + 4..];
		let body = if after_dash.starts_with('\n') {
			after_dash[1..].to_string()
		} else if after_dash.starts_with("\r\n") {
			after_dash[2..].to_string()
		} else {
			after_dash.to_string()
		};
		
		return Some((yaml_str, body));
	}
	None
}

/// Converts YAML to a JSON string for database storage.
pub fn frontmatter_to_json(yaml_str: &str) -> Result<String, String> {
	let yaml_val: serde_yaml::Value =
		serde_yaml::from_str(yaml_str).map_err(|e| format!("Failed to parse YAML: {}", e))?;
	
	// We only care if it's a mapping at the root
	if !yaml_val.is_mapping() {
		return Err("YAML frontmatter must be a mapping/object".to_string());
	}
	
	let json_val: Value = serde_yaml::from_value(yaml_val)
		.map_err(|e| format!("Failed to convert YAML to JSON: {}", e))?;
	
	serde_json::to_string(&json_val).map_err(|e| format!("Failed to serialize JSON: {}", e))
}

/// Returns the body content without frontmatter (for wikilink extraction, etc.).
pub fn strip_frontmatter(content: &str) -> &str {
	let frontmatter_start = if content.starts_with("---\n") {
		4
	} else if content.starts_with("---\r\n") {
		5
	} else {
		return content;
	};
	
	let end_index = content[frontmatter_start..].find("\n---");
	if let Some(idx) = end_index {
		let after_dash = &content[frontmatter_start + idx + 4..];
		if after_dash.starts_with('\n') {
			return &after_dash[1..];
		} else if after_dash.starts_with("\r\n") {
			return &after_dash[2..];
		} else {
			return after_dash;
		}
	}
	
	content
}

#[cfg(test)]
mod tests {
	use super::{parse_frontmatter, strip_frontmatter};
	
	#[test]
	fn parses_frontmatter_with_crlf_delimiters() {
		let content = "---\r\ntitle: Test\r\n---\r\nBody";
		let parsed = parse_frontmatter(content).expect("expected frontmatter to parse");
		
		assert_eq!(parsed.0, "title: Test");
		assert_eq!(parsed.1, "Body");
	}
	
	#[test]
	fn strips_frontmatter_with_crlf_delimiters() {
		let content = "---\r\ntitle: Test\r\n---\r\nBody";
		assert_eq!(strip_frontmatter(content), "Body");
	}
}
