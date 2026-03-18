use serde_json::Value;

/// Extracts the raw YAML string and the body (content after frontmatter).
/// Returns `None` if no frontmatter exists.
pub fn parse_frontmatter(content: &str) -> Option<(String, String)> {
	let frontmatter_start = if content.starts_with("---\r\n") {
		5
	} else if content.starts_with("---\n") {
		4
	} else if content.starts_with("---") {
		3
	} else {
		return None;
	};
	
	let sub = &content[frontmatter_start..];
	let (idx, delim_len) = if let Some(i) = sub.find("\r\n---") {
		(i, 5)
	} else if let Some(i) = sub.find("\n---") {
		(i, 4)
	} else if let Some(i) = sub.find("---") {
		(i, 3)
	} else {
		return None;
	};
	
	let yaml_str = content[frontmatter_start..frontmatter_start + idx]
		.trim()
		.to_string();
	
	let after_start = frontmatter_start + idx + delim_len;
	let after_dash = &content[after_start..];
	let body = if let Some(rest) = after_dash.strip_prefix("\r\n") {
		rest
	} else if let Some(rest) = after_dash.strip_prefix('\n') {
		rest
	} else if let Some(rest) = after_dash.strip_prefix('\r') {
		rest
	} else {
		after_dash
	};
	
	Some((yaml_str, body.to_string()))
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
	let frontmatter_start = if content.starts_with("---\r\n") {
		5
	} else if content.starts_with("---\n") {
		4
	} else if content.starts_with("---") {
		3
	} else {
		return content;
	};
	
	let sub = &content[frontmatter_start..];
	let (idx, delim_len) = if let Some(i) = sub.find("\r\n---") {
		(i, 5)
	} else if let Some(i) = sub.find("\n---") {
		(i, 4)
	} else if let Some(i) = sub.find("---") {
		(i, 3)
	} else {
		return content;
	};
	
	let after_start = frontmatter_start + idx + delim_len;
	let after_dash = &content[after_start..];
	if let Some(rest) = after_dash.strip_prefix("\r\n") {
		return rest;
	}
	if let Some(rest) = after_dash.strip_prefix('\n') {
		return rest;
	}
	if let Some(rest) = after_dash.strip_prefix('\r') {
		return rest;
	}
	
	after_dash
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
	
	#[test]
	fn parses_frontmatter_without_newlines() {
		let content = "---title: Test---Body";
		let parsed = parse_frontmatter(content).expect("expected frontmatter to parse");
		
		assert_eq!(parsed.0, "title: Test");
		assert_eq!(parsed.1, "Body");
	}
}