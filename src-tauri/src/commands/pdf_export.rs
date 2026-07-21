use crate::error::TessellumError;
use lopdf::{Dictionary, Document, Object, ObjectId};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use tempfile::tempdir;
use tokio::process::Command;
use url::Url;

const EXPORT_PAGE_HEIGHT_PX: f32 = 1122.0;
const EXPORT_PAGE_MARGIN_TOP_PX: f32 = 28.0;
const EXPORT_PAGE_MARGIN_BOTTOM_PX: f32 = 36.0;
const EXPORT_PAGE_CONTENT_HEIGHT_PX: f32 =
    EXPORT_PAGE_HEIGHT_PX - EXPORT_PAGE_MARGIN_TOP_PX - EXPORT_PAGE_MARGIN_BOTTOM_PX;
const CSS_PX_TO_PDF_PT: f32 = 72.0 / 96.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportOutlineItem {
    pub title: String,
    pub level: u32,
    pub line_number: u32,
    pub page: u32,
    pub offset_within_page_px: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExportRequest {
    pub destination_path: String,
    pub document_title: String,
    pub html: String,
    pub outline: Vec<PdfExportOutlineItem>,
}

#[derive(Debug, Clone, PartialEq)]
struct NormalizedOutlineEntry {
    title: String,
    level: u32,
    page: u32,
    offset_within_page_px: f32,
    parent_index: Option<usize>,
}

fn validate_export_request(request: &PdfExportRequest) -> Result<(), TessellumError> {
    if request.destination_path.trim().is_empty() {
        return Err(TessellumError::Validation(
            "PDF destination path cannot be empty".to_string(),
        ));
    }

    if request.html.trim().is_empty() {
        return Err(TessellumError::Validation(
            "PDF HTML payload cannot be empty".to_string(),
        ));
    }

    Ok(())
}

fn normalize_outline_entries(
    outline: &[PdfExportOutlineItem],
    total_pages: u32,
) -> Vec<NormalizedOutlineEntry> {
    if total_pages == 0 {
        return Vec::new();
    }

    let mut parent_stack: Vec<(u32, usize)> = Vec::new();
    let mut normalized = Vec::with_capacity(outline.len());

    for item in outline {
        let level = item.level.max(1);
        let page = item.page.clamp(1, total_pages);

        while parent_stack.last().is_some_and(|(parent_level, _)| *parent_level >= level) {
            parent_stack.pop();
        }

        let parent_index = parent_stack.last().map(|(_, index)| *index);
        normalized.push(NormalizedOutlineEntry {
            title: item.title.clone(),
            level,
            page,
            offset_within_page_px: item.offset_within_page_px.clamp(0.0, EXPORT_PAGE_CONTENT_HEIGHT_PX),
            parent_index,
        });
        parent_stack.push((level, normalized.len() - 1));
    }

    normalized
}

fn encode_outline_title(title: &str) -> Object {
    if title.is_ascii() {
        return Object::string_literal(title.as_bytes().to_vec());
    }

    let mut bom = vec![0xFE, 0xFF];
    bom.extend(title.encode_utf16().flat_map(u16::to_be_bytes));
    Object::string_literal(bom)
}

fn resolve_page_height_points(document: &Document, page_id: ObjectId) -> f32 {
    let default_height = 842.0;

    let Ok(page) = document.get_dictionary(page_id) else {
        return default_height;
    };
    let Ok(media_box) = page.get(b"MediaBox").and_then(Object::as_array) else {
        return default_height;
    };
    if media_box.len() != 4 {
        return default_height;
    }

    let bottom = media_box[1].as_float().unwrap_or(0.0);
    let top = media_box[3].as_float().unwrap_or(default_height);
    let height = top - bottom;

    if height.is_finite() && height > 0.0 {
        height
    } else {
        default_height
    }
}

fn heading_top_position_points(page_height_points: f32, offset_within_page_px: f32) -> f32 {
    let top_margin_points = EXPORT_PAGE_MARGIN_TOP_PX * CSS_PX_TO_PDF_PT;
    let bottom_margin_points = EXPORT_PAGE_MARGIN_BOTTOM_PX * CSS_PX_TO_PDF_PT;
    let content_height_points = (page_height_points - top_margin_points - bottom_margin_points).max(1.0);
    let clamped_offset = offset_within_page_px.clamp(0.0, EXPORT_PAGE_CONTENT_HEIGHT_PX);
    let scaled_offset = (clamped_offset / EXPORT_PAGE_CONTENT_HEIGHT_PX) * content_height_points;
    let top_position = page_height_points - top_margin_points - scaled_offset;

    top_position.clamp(0.0, page_height_points)
}

fn build_outline_action(page_id: ObjectId, top_position_points: f32) -> Dictionary {
    let mut action = Dictionary::new();
    action.set("D", vec![
        Object::Reference(page_id),
        Object::Name(b"XYZ".to_vec()),
        Object::Null,
        Object::Real(top_position_points),
        Object::Null,
    ]);
    action.set("S", Object::Name(b"GoTo".to_vec()));
    action
}

fn build_outline_objects(
    document: &mut Document,
    outline: &[NormalizedOutlineEntry],
    page_ids: &[ObjectId],
) -> Result<ObjectId, TessellumError> {
    let outlines_id = document.new_object_id();
    if outline.is_empty() {
        document.set_object(outlines_id, Dictionary::new());
        return Ok(outlines_id);
    }

    let item_ids: Vec<_> = outline.iter().map(|_| document.new_object_id()).collect();
    let action_ids: Vec<_> = outline.iter().map(|_| document.new_object_id()).collect();
    let mut children_by_parent = vec![Vec::<usize>::new(); outline.len()];
    let mut root_children = Vec::<usize>::new();

    for (index, entry) in outline.iter().enumerate() {
        if let Some(parent_index) = entry.parent_index {
            children_by_parent[parent_index].push(index);
        } else {
            root_children.push(index);
        }
    }

    for (index, entry) in outline.iter().enumerate() {
        let page_id = page_ids[(entry.page - 1) as usize];
        let page_height_points = resolve_page_height_points(document, page_id);
        let top_position_points =
            heading_top_position_points(page_height_points, entry.offset_within_page_px);
        document.set_object(action_ids[index], build_outline_action(page_id, top_position_points));
    }

    for (index, entry) in outline.iter().enumerate() {
        let siblings = if let Some(parent_index) = entry.parent_index {
            &children_by_parent[parent_index]
        } else {
            &root_children
        };
        let sibling_position = siblings.iter().position(|candidate| *candidate == index).unwrap_or(0);

        let mut item = Dictionary::new();
        item.set(
            "Parent",
            Object::Reference(entry.parent_index.map(|parent_index| item_ids[parent_index]).unwrap_or(outlines_id)),
        );
        item.set("Title", encode_outline_title(&entry.title));
        item.set("A", Object::Reference(action_ids[index]));
        item.set("F", Object::Integer(0));
        item.set("C", vec![Object::Real(0.0), Object::Real(0.0), Object::Real(0.0)]);

        if sibling_position > 0 {
            item.set("Prev", Object::Reference(item_ids[siblings[sibling_position - 1]]));
        }
        if sibling_position + 1 < siblings.len() {
            item.set("Next", Object::Reference(item_ids[siblings[sibling_position + 1]]));
        }

        let children = &children_by_parent[index];
        if !children.is_empty() {
            item.set("First", Object::Reference(item_ids[children[0]]));
            item.set("Last", Object::Reference(item_ids[*children.last().unwrap()]));
            item.set("Count", Object::Integer(children.len() as i64));
        }

        document.set_object(item_ids[index], item);
    }

    let mut outlines = Dictionary::new();
    outlines.set("First", Object::Reference(item_ids[root_children[0]]));
    outlines.set("Last", Object::Reference(item_ids[*root_children.last().unwrap()]));
    outlines.set("Count", Object::Integer(root_children.len() as i64));
    document.set_object(outlines_id, outlines);

    Ok(outlines_id)
}

fn inject_outline_into_pdf(
    destination_path: &Path,
    outline: &[PdfExportOutlineItem],
) -> Result<(), TessellumError> {
    if outline.is_empty() {
        return Ok(());
    }

    let mut document = Document::load(destination_path)
        .map_err(|error| TessellumError::Internal(format!("Failed to open generated PDF: {error}")))?;
    let pages = document.get_pages();
    if pages.is_empty() {
        return Ok(());
    }

    let page_ids: Vec<_> = pages.values().copied().collect();
    let normalized = normalize_outline_entries(outline, page_ids.len() as u32);
    let outlines_id = build_outline_objects(&mut document, &normalized, &page_ids)?;
    document
        .catalog_mut()
        .map_err(|error| TessellumError::Internal(format!("Failed to access PDF catalog: {error}")))?
        .set("Outlines", Object::Reference(outlines_id));
    document
        .save(destination_path)
        .map_err(|error| TessellumError::Internal(format!("Failed to save outlined PDF: {error}")))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn candidate_browser_paths() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for root in [
        env::var_os("PROGRAMFILES"),
        env::var_os("PROGRAMFILES(X86)"),
        env::var_os("LOCALAPPDATA"),
    ]
    .into_iter()
    .flatten()
    {
        let root = PathBuf::from(root);
        candidates.push(root.join("Microsoft").join("Edge").join("Application").join("msedge.exe"));
        candidates.push(root.join("Google").join("Chrome").join("Application").join("chrome.exe"));
    }

    candidates
}

#[cfg(target_os = "macos")]
fn candidate_browser_paths() -> Vec<PathBuf> {
    [
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect()
}

#[cfg(target_os = "linux")]
fn candidate_browser_paths() -> Vec<PathBuf> {
    // Resolve well-known Chromium-family binaries against PATH.
    let names = [
        "microsoft-edge",
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "brave-browser",
    ];
    let path_dirs: Vec<PathBuf> = env::var_os("PATH")
        .map(|paths| env::split_paths(&paths).collect())
        .unwrap_or_default();

    names
        .into_iter()
        .flat_map(|name| path_dirs.iter().map(move |dir| dir.join(name)))
        .collect()
}

fn find_print_browser() -> Result<PathBuf, TessellumError> {
    candidate_browser_paths()
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| {
            TessellumError::Internal(
                "No compatible browser was found for PDF export. Install Microsoft Edge or Google Chrome."
                    .to_string(),
            )
        })
}

fn build_print_pdf_args(html_url: &str, destination_path: &Path) -> Vec<String> {
    vec![
        "--headless".to_string(),
        "--disable-gpu".to_string(),
        "--allow-file-access-from-files".to_string(),
        "--no-first-run".to_string(),
        "--no-pdf-header-footer".to_string(),
        "--print-to-pdf-no-header".to_string(),
        format!("--print-to-pdf={}", destination_path.display()),
        html_url.to_string(),
    ]
}

/// Renders the export HTML into `output_path` with a headless Chromium-family
/// browser. `output_path` must be a fresh, app-controlled file: headless
/// Chromium exits with code 0 even when it cannot write its target, so
/// printing to a pre-existing (possibly locked) destination would silently
/// leave stale content behind. Printing to a fresh temp file makes any failure
/// detectable via `output_path.exists()`.
async fn render_html_to_pdf(html_path: &Path, output_path: &Path) -> Result<(), TessellumError> {
    let browser_path = find_print_browser()?;
    let html_url = Url::from_file_path(html_path).map_err(|_| {
        TessellumError::Internal("Failed to convert export HTML path into a file URL".to_string())
    })?;
    let args = build_print_pdf_args(html_url.as_str(), output_path);

    let output = Command::new(&browser_path)
        .args(args)
        .output()
        .await
        .map_err(TessellumError::Io)?;

    if !output.status.success() || !output_path.exists() {
        // Surface the browser's own diagnostics; without them these failures
        // are undebuggable ("Browser PDF generation failed" alone).
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stderr_tail: String = stderr
            .lines()
            .rev()
            .take(5)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join(" | ");
        log::error!(
            "PDF print failed: browser={}, exit={:?}, stderr: {}",
            browser_path.display(),
            output.status.code(),
            stderr
        );
        return Err(TessellumError::Internal(format!(
            "Browser PDF generation failed (browser: {}, exit code: {}). {}",
            browser_path.display(),
            output
                .status
                .code()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "none".to_string()),
            if stderr_tail.is_empty() {
                "No browser error output was captured.".to_string()
            } else {
                format!("Browser output: {stderr_tail}")
            }
        )));
    }

    Ok(())
}

/// Copies the finished PDF from the temp workspace to the user's destination,
/// translating a locked/unwritable destination into an actionable error.
async fn copy_pdf_to_destination(
    rendered_path: &Path,
    destination_path: &Path,
) -> Result<(), TessellumError> {
    tokio::fs::copy(rendered_path, destination_path)
        .await
        .map(|_| ())
        .map_err(|e| {
            TessellumError::Internal(format!(
                "Could not write the PDF to '{}'. If the file is open in another program, close it and try again. ({e})",
                destination_path.display()
            ))
        })
}

#[tauri::command]
pub async fn export_markdown_pdf(request: PdfExportRequest) -> Result<(), TessellumError> {
    validate_export_request(&request)?;

    let destination_path = PathBuf::from(&request.destination_path);
    let parent = destination_path.parent().ok_or_else(|| {
        TessellumError::Validation("PDF destination must include a parent directory".to_string())
    })?;
    if !parent.exists() {
        return Err(TessellumError::Validation(
            "PDF destination directory does not exist".to_string(),
        ));
    }

    let temp_dir = tempdir().map_err(TessellumError::Io)?;
    let html_path = temp_dir.path().join("export.html");
    tokio::fs::write(&html_path, &request.html)
        .await
        .map_err(TessellumError::Io)?;

    // Render and post-process entirely inside the temp dir; only the final copy
    // touches the user's destination, so a locked destination produces a clear
    // error instead of a silently stale file.
    let rendered_path = temp_dir.path().join("export.pdf");
    render_html_to_pdf(&html_path, &rendered_path).await?;
    inject_outline_into_pdf(&rendered_path, &request.outline)?;
    copy_pdf_to_destination(&rendered_path, &destination_path).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        build_print_pdf_args, copy_pdf_to_destination, heading_top_position_points,
        normalize_outline_entries, validate_export_request, PdfExportOutlineItem, PdfExportRequest,
    };
    use std::path::Path;
    use tempfile::tempdir;

    /// Full end-to-end export through a real headless browser. Ignored by
    /// default because it needs Edge/Chrome installed; run explicitly with
    /// `cargo test pdf_export_end_to_end -- --ignored`.
    #[tokio::test]
    #[ignore]
    async fn pdf_export_end_to_end_produces_pdf() {
        let dir = tempdir().unwrap();
        let destination = dir.path().join("out.pdf");
        super::export_markdown_pdf(PdfExportRequest {
            destination_path: destination.to_string_lossy().to_string(),
            document_title: "E2E".to_string(),
            html: "<html><body><h1>E2E export</h1></body></html>".to_string(),
            outline: vec![PdfExportOutlineItem {
                title: "E2E export".to_string(),
                level: 1,
                line_number: 1,
                page: 1,
                offset_within_page_px: 0.0,
            }],
        })
        .await
        .unwrap();

        let bytes = std::fs::read(&destination).unwrap();
        assert!(bytes.starts_with(b"%PDF"), "destination is not a PDF");
    }

    #[tokio::test]
    async fn copy_pdf_to_destination_overwrites_existing_file() {
        let dir = tempdir().unwrap();
        let rendered = dir.path().join("rendered.pdf");
        let destination = dir.path().join("out.pdf");
        std::fs::write(&rendered, b"new content").unwrap();
        std::fs::write(&destination, b"old content").unwrap();

        copy_pdf_to_destination(&rendered, &destination).await.unwrap();

        assert_eq!(std::fs::read(&destination).unwrap(), b"new content");
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn copy_pdf_to_destination_reports_locked_destination() {
        // Regression: a destination held open by a PDF viewer must produce a
        // clear error instead of silently keeping stale content.
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;

        let dir = tempdir().unwrap();
        let rendered = dir.path().join("rendered.pdf");
        let destination = dir.path().join("out.pdf");
        std::fs::write(&rendered, b"new content").unwrap();
        std::fs::write(&destination, b"old content").unwrap();

        // share_mode(1) = FILE_SHARE_READ only: readers allowed, writers blocked,
        // mirroring how PDF viewers typically hold the file.
        let _lock = OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&destination)
            .unwrap();

        let err = copy_pdf_to_destination(&rendered, &destination).await.unwrap_err();

        assert!(
            err.to_string().contains("open in another program"),
            "unexpected error: {err}"
        );
        drop(_lock);
        assert_eq!(std::fs::read(&destination).unwrap(), b"old content");
    }

    #[test]
    fn pdf_export_validation_rejects_empty_destination() {
        let result = validate_export_request(&PdfExportRequest {
            destination_path: String::new(),
            document_title: "Doc".to_string(),
            html: "<html></html>".to_string(),
            outline: Vec::new(),
        });

        assert!(result.is_err());
    }

    #[test]
    fn pdf_export_validation_rejects_empty_html() {
        let result = validate_export_request(&PdfExportRequest {
            destination_path: "C:/tmp/doc.pdf".to_string(),
            document_title: "Doc".to_string(),
            html: "   ".to_string(),
            outline: Vec::new(),
        });

        assert!(result.is_err());
    }

    #[test]
    fn normalize_outline_entries_preserves_hierarchy_and_clamps_pages() {
        let normalized = normalize_outline_entries(
            &[
                PdfExportOutlineItem {
                    title: "Intro".to_string(),
                    level: 1,
                    line_number: 1,
                    page: 1,
                    offset_within_page_px: 10.0,
                },
                PdfExportOutlineItem {
                    title: "Details".to_string(),
                    level: 2,
                    line_number: 4,
                    page: 9,
                    offset_within_page_px: 24.0,
                },
                PdfExportOutlineItem {
                    title: "Appendix".to_string(),
                    level: 1,
                    line_number: 10,
                    page: 0,
                    offset_within_page_px: 50.0,
                },
            ],
            3,
        );

        assert_eq!(
            normalized,
            vec![
                super::NormalizedOutlineEntry {
                    title: "Intro".to_string(),
                    level: 1,
                    page: 1,
                    offset_within_page_px: 10.0,
                    parent_index: None,
                },
                super::NormalizedOutlineEntry {
                    title: "Details".to_string(),
                    level: 2,
                    page: 3,
                    offset_within_page_px: 24.0,
                    parent_index: Some(0),
                },
                super::NormalizedOutlineEntry {
                    title: "Appendix".to_string(),
                    level: 1,
                    page: 1,
                    offset_within_page_px: 50.0,
                    parent_index: None,
                },
            ]
        );
    }

    #[test]
    fn heading_top_position_points_tracks_heading_offset_within_page() {
        let first_heading = heading_top_position_points(792.0, 0.0);
        let lower_heading = heading_top_position_points(792.0, 400.0);

        assert!(first_heading < 792.0);
        assert!(lower_heading < first_heading);
        assert!(lower_heading > 0.0);
    }

    #[test]
    fn build_print_pdf_args_disables_browser_headers_and_footers() {
        let args = build_print_pdf_args("file:///tmp/export.html", Path::new("C:/tmp/doc.pdf"));

        assert!(args.iter().any(|arg| arg == "--no-pdf-header-footer"));
        assert!(args.iter().any(|arg| arg == "--print-to-pdf-no-header"));
        assert!(args.iter().any(|arg| arg == "--print-to-pdf=C:/tmp/doc.pdf"));
    }
}
