use std::fs;
use std::path::PathBuf;

fn ensure_kuzu_vendor_root() -> Result<(), String> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .map_err(|e| format!("CARGO_MANIFEST_DIR is not set: {e}"))?;
    let vendor_root = PathBuf::from(manifest_dir).join("vendor").join("kuzu");

    fs::create_dir_all(&vendor_root)
        .map_err(|e| format!("Failed to create vendor/kuzu directory: {e}"))?;

    // Keep at least one match for tauri bundle.resources globs in CI fallback builds.
    let marker = vendor_root.join("PLACEHOLDER.txt");
    if !marker.exists() {
        fs::write(&marker, b"placeholder for optional prebuilt kuzu resources\n")
            .map_err(|e| format!("Failed to create vendor/kuzu placeholder: {e}"))?;
    }

    Ok(())
}

fn main() {
    if let Err(err) = ensure_kuzu_vendor_root() {
        panic!("{err}");
    }
    tauri_build::build()
}
