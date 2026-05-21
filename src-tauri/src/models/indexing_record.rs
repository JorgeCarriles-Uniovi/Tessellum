#[derive(Debug, Clone)]
pub struct IndexedMarkdownFile {
    pub path: String,
    pub modified: i64,
    pub size: u64,
    pub frontmatter_json: Option<String>,
    pub inline_tags: Vec<String>,
    pub resolved_links: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct IndexedSearchFile {
    pub path: String,
    pub modified: i64,
    pub is_markdown: bool,
}
