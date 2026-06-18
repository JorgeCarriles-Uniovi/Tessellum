use crate::error::TessellumError;
use docx_rs::{
    AbstractNumbering, Docx, Level, LevelJc, LevelText, NumberFormat, Numbering,
    NumberingType, Paragraph, Run, Start,
};
use regex::Regex;
use std::io::Cursor;
use std::path::PathBuf;

// ────────────────────────────────────────────────────────────────────────────
// D7 — DOCX export
// ────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_note_docx(
    vault_path: String,
    note_path: String,
    output_path: String,
) -> Result<String, TessellumError> {
    let vault = vault_path.clone();
    let note = note_path.clone();
    let out = output_path.clone();

    tokio::task::spawn_blocking(move || {
        // Read the note file
        let full_note_path = if PathBuf::from(&note).is_absolute() {
            PathBuf::from(&note)
        } else {
            PathBuf::from(&vault).join(&note)
        };

        let content = std::fs::read_to_string(&full_note_path).map_err(|e| {
            TessellumError::Internal(format!("Failed to read note file: {e}"))
        })?;

        // Build the DOCX with bullet list numbering
        let bullet_abstract_id = 1;
        let bullet_numbering_id = 1;

        let abstract_numbering = AbstractNumbering::new(bullet_abstract_id).add_level(
            Level::new(
                0,
                Start::new(1),
                NumberFormat::new("bullet"),
                LevelText::new("•"),
                LevelJc::new("left"),
            )
            .indent(Some(720), Some(docx_rs::SpecialIndentType::Hanging(360)), None, None),
        );

        let numbering = Numbering::new(bullet_numbering_id, bullet_abstract_id);

        let mut doc = Docx::new()
            .add_abstract_numbering(abstract_numbering)
            .add_numbering(numbering);

        for line in content.lines() {
            let paragraph = if let Some(rest) = line.strip_prefix("### ") {
                Paragraph::new()
                    .add_run(Run::new().add_text(rest))
                    .style("Heading3")
            } else if let Some(rest) = line.strip_prefix("## ") {
                Paragraph::new()
                    .add_run(Run::new().add_text(rest))
                    .style("Heading2")
            } else if let Some(rest) = line.strip_prefix("# ") {
                Paragraph::new()
                    .add_run(Run::new().add_text(rest))
                    .style("Heading1")
            } else if let Some(rest) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
                Paragraph::new()
                    .add_run(Run::new().add_text(rest))
                    .numbering(docx_rs::NumberingId::new(bullet_numbering_id), docx_rs::IndentLevel::new(0))
            } else if line.trim().is_empty() {
                Paragraph::new()
            } else {
                Paragraph::new()
                    .add_run(Run::new().add_text(line))
            };

            doc = doc.add_paragraph(paragraph);
        }

        // Write DOCX to output path
        let out_path = PathBuf::from(&out);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                TessellumError::Internal(format!("Failed to create output directory: {e}"))
            })?;
        }

        let buf: Vec<u8> = Vec::new();
        let cursor = Cursor::new(buf);
        let result = doc.build().pack(cursor).map_err(|e| {
            TessellumError::Internal(format!("Failed to build DOCX: {e}"))
        })?;

        std::fs::write(&out_path, result.into_inner()).map_err(|e| {
            TessellumError::Internal(format!("Failed to write DOCX file: {e}"))
        })?;

        Ok(out)
    })
    .await
    .map_err(|e| TessellumError::Internal(format!("Task error: {e}")))?
}

// ────────────────────────────────────────────────────────────────────────────
// D8 — Import from URL
// ────────────────────────────────────────────────────────────────────────────

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn extract_title(html: &str) -> Option<String> {
    let re = Regex::new(r"(?is)<title[^>]*>(.*?)</title>").ok()?;
    let caps = re.captures(html)?;
    let raw = caps.get(1)?.as_str();
    // Strip any inner tags inside <title> (rare but possible)
    let inner_tag_re = Regex::new(r"<[^>]+>").ok()?;
    let cleaned = inner_tag_re.replace_all(raw, "");
    let title = cleaned.trim().to_string();
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

fn strip_head_sections(html: &str) -> String {
    // Remove <head>...</head>
    let head_re = Regex::new(r"(?is)<head[^>]*>.*?</head>").unwrap();
    let without_head = head_re.replace_all(html, "");
    // Remove <script>...</script>
    let script_re = Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
    let without_script = script_re.replace_all(&without_head, "");
    // Remove <style>...</style>
    let style_re = Regex::new(r"(?is)<style[^>]*>.*?</style>").unwrap();
    style_re.replace_all(&without_script, "").into_owned()
}

fn strip_html_tags(html: &str) -> String {
    let tag_re = Regex::new(r"<[^>]+>").unwrap();
    let text = tag_re.replace_all(html, "");
    // Collapse multiple blank lines
    let blank_re = Regex::new(r"\n{3,}").unwrap();
    blank_re.replace_all(&text, "\n\n").into_owned()
}

#[tauri::command]
pub async fn import_from_url(
    url: String,
    vault_path: String,
) -> Result<String, TessellumError> {
    let url_clone = url.clone();
    let vault = vault_path.clone();

    tokio::task::spawn_blocking(move || {
        let response = reqwest::blocking::get(&url_clone).map_err(|e| {
            TessellumError::Internal(format!("Failed to fetch URL: {e}"))
        })?;

        let html = response.text().map_err(|e| {
            TessellumError::Internal(format!("Failed to read response body: {e}"))
        })?;

        // Extract title before stripping head
        let title = extract_title(&html).unwrap_or_else(|| "Imported Page".to_string());
        let sanitized_title = sanitize_filename(&title);

        // Strip sections and tags to get plain text body
        let stripped = strip_head_sections(&html);
        let body_text = strip_html_tags(&stripped);

        // Build frontmatter + content
        let note_content = format!(
            "---\nsource: \"{url_clone}\"\nimported: \"true\"\n---\n\n# {title}\n\n{body}\n",
            url_clone = url_clone,
            title = title,
            body = body_text.trim(),
        );

        // Write note to vault
        let file_name = format!("{sanitized_title}.md");
        let note_path = PathBuf::from(&vault).join(&file_name);

        std::fs::write(&note_path, &note_content).map_err(|e| {
            TessellumError::Internal(format!("Failed to write imported note: {e}"))
        })?;

        Ok(note_path
            .to_str()
            .unwrap_or(&file_name)
            .to_string())
    })
    .await
    .map_err(|e| TessellumError::Internal(format!("Task error: {e}")))?
}
