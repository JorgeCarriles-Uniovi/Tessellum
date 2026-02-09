/// Represents a parsed wikilink from note content.
///
/// # Fields
///
/// * `target` - The link target (e.g., "Note" or "folder/Note")
/// * `alias` - Optional display text after the pipe (e.g., "custom text" in [[Note|custom text]])
#[derive(Debug, Clone, PartialEq)]
pub struct WikiLink {
    pub target: String,
    pub alias: Option<String>,
}
