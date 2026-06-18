use serde::Serialize;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::error::TessellumError;

#[derive(Debug, Serialize)]
pub struct PublishResult {
    pub published: usize,
    pub skipped: usize,
    pub output_dir: String,
}

const CSS: &str = r#"/* Tessellum static site */
*, *::before, *::after { box-sizing: border-box; }
body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 1.65;
    background: #ffffff;
    color: #1a1a1a;
    padding: 0 1rem;
}
main {
    max-width: 760px;
    margin: 3rem auto;
}
h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    margin-top: 2rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
}
h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }
a { color: #3b82f6; text-decoration: none; }
a:hover { text-decoration: underline; }
code {
    font-family: "Fira Code", "JetBrains Mono", monospace;
    background: #f3f4f6;
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-size: 0.875em;
}
pre {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
}
pre code { background: none; padding: 0; }
blockquote {
    margin: 1rem 0;
    padding: 0.5rem 0 0.5rem 1rem;
    border-left: 3px solid #d1d5db;
    color: #6b7280;
}
hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
th { background: #f9fafb; font-weight: 600; }
nav.breadcrumb { font-size: 0.875rem; color: #6b7280; margin-bottom: 2rem; }
nav.breadcrumb a { color: #6b7280; }
ul.note-list { list-style: none; padding: 0; }
ul.note-list li { padding: 0.25rem 0; }
"#;

fn html_page(title: &str, site_title: &str, body: &str, depth: usize) -> String {
    let prefix = if depth == 0 {
        "./".to_string()
    } else {
        "../".repeat(depth)
    };
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title} — {site_title}</title>
<link rel="stylesheet" href="{prefix}style.css" />
</head>
<body>
<main>
<nav class="breadcrumb"><a href="{prefix}index.html">{site_title}</a></nav>
{body}
</main>
</body>
</html>
"#,
        title = escape_html(title),
        site_title = escape_html(site_title),
        body = body,
        prefix = prefix,
    )
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Convert wikilinks `[[Note]]` or `[[Note|Alias]]` to HTML anchor tags.
fn convert_wikilinks(html: &str) -> String {
    let re = regex::Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap();
    re.replace_all(html, |caps: &regex::Captures| {
        let target = &caps[1];
        let label = caps.get(2).map(|m| m.as_str()).unwrap_or(target);
        // Encode spaces in href as %20
        let href = target.replace(' ', "%20");
        format!("<a href=\"{}.html\">{}</a>", href, escape_html(label))
    })
    .into_owned()
}

/// Very small markdown-to-HTML converter using pulldown_cmark.
fn markdown_to_html(md: &str) -> String {
    use pulldown_cmark::{html, Options, Parser};
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_TASKLISTS);
    let parser = Parser::new_ext(md, opts);
    let mut output = String::new();
    html::push_html(&mut output, parser);
    output
}

/// Strip YAML frontmatter block if present and return remaining content.
/// Also returns `true` if `publish: false` was found in the frontmatter.
fn strip_frontmatter(content: &str) -> (bool, &str) {
    let content = content.trim_start_matches('\u{FEFF}'); // strip BOM
    if !content.starts_with("---") {
        return (false, content);
    }
    // Find closing ---
    let rest = &content[3..];
    if let Some(end) = rest.find("\n---") {
        let fm = &rest[..end];
        let publish_false = fm
            .lines()
            .any(|line| line.trim() == "publish: false" || line.trim() == "publish: \"false\"");
        let body_start = end + 4; // skip past \n---
        let body = rest.get(body_start..).unwrap_or("").trim_start_matches('\n');
        (publish_false, body)
    } else {
        (false, content)
    }
}

/// Derive a human-readable title from a file stem.
fn title_from_stem(stem: &str) -> String {
    stem.replace('-', " ").replace('_', " ")
}

#[tauri::command]
pub async fn publish_vault(
    vault_path: String,
    output_dir: String,
    site_title: Option<String>,
) -> Result<PublishResult, TessellumError> {
    tokio::task::spawn_blocking(move || {
        let site_title = site_title
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "My Notes".to_string());

        let vault = Path::new(&vault_path);
        let out = Path::new(&output_dir);

        // Ensure output directory exists
        fs::create_dir_all(out)
            .map_err(|e| TessellumError::Internal(format!("create output dir: {e}")))?;

        // Write stylesheet
        fs::write(out.join("style.css"), CSS)
            .map_err(|e| TessellumError::Internal(format!("write style.css: {e}")))?;

        let mut published = 0usize;
        let mut skipped = 0usize;
        // (relative_path_without_ext, title) for index
        let mut index_entries: Vec<(String, String)> = Vec::new();

        for entry in WalkDir::new(vault)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let abs_path = entry.path();

            // Compute path relative to vault root
            let rel = match abs_path.strip_prefix(vault) {
                Ok(r) => r,
                Err(_) => continue,
            };

            // Skip hidden/internal directories
            let skip = rel.components().any(|c| {
                if let std::path::Component::Normal(name) = c {
                    let s = name.to_string_lossy();
                    s == ".tessellum" || s == ".git" || s == ".trash"
                } else {
                    false
                }
            });
            if skip {
                skipped += 1;
                continue;
            }

            // Only process .md files
            if abs_path.extension().and_then(|e| e.to_str()) != Some("md") {
                continue;
            }

            // Read file
            let content = match fs::read_to_string(abs_path) {
                Ok(c) => c,
                Err(e) => {
                    log::warn!("publish: could not read {:?}: {}", abs_path, e);
                    skipped += 1;
                    continue;
                }
            };

            // Strip frontmatter; check publish: false
            let (suppress, body_md) = strip_frontmatter(&content);
            if suppress {
                skipped += 1;
                continue;
            }

            // Derive title from filename stem
            let stem = abs_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Note");
            let note_title = title_from_stem(stem);

            // Convert markdown → HTML
            let mut html_body = markdown_to_html(body_md);

            // Convert wikilinks in rendered HTML
            html_body = convert_wikilinks(&html_body);

            // Compute output path: same relative structure, .md → .html
            let out_rel = rel.with_extension("html");
            let out_abs = out.join(&out_rel);
            if let Some(parent) = out_abs.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| TessellumError::Internal(format!("create dir: {e}")))?;
            }

            // Depth for relative CSS path
            let depth = out_rel.components().count().saturating_sub(1);

            let page = html_page(&note_title, &site_title, &html_body, depth);

            fs::write(&out_abs, page)
                .map_err(|e| TessellumError::Internal(format!("write {:?}: {e}", out_abs)))?;

            // Record for index (use forward-slash path)
            let rel_str = out_rel
                .to_string_lossy()
                .replace('\\', "/");
            index_entries.push((rel_str, note_title));
            published += 1;
        }

        // Sort entries for deterministic output
        index_entries.sort_by(|a, b| a.1.cmp(&b.1));

        // Build index.html
        let mut list_html = String::from("<ul class=\"note-list\">\n");
        for (href, title) in &index_entries {
            list_html.push_str(&format!(
                "  <li><a href=\"{}\">{}</a></li>\n",
                href,
                escape_html(title)
            ));
        }
        list_html.push_str("</ul>\n");

        let index_body = format!(
            "<h1>{}</h1>\n<p>{} note{} published.</p>\n{}",
            escape_html(&site_title),
            published,
            if published == 1 { "" } else { "s" },
            list_html
        );

        let index_page = format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{site_title}</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<main>
{body}
</main>
</body>
</html>
"#,
            site_title = escape_html(&site_title),
            body = index_body,
        );

        fs::write(out.join("index.html"), index_page)
            .map_err(|e| TessellumError::Internal(format!("write index.html: {e}")))?;

        Ok(PublishResult {
            published,
            skipped,
            output_dir: output_dir.clone(),
        })
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
}
