## Rust Backend Commands & Indexer

### BUG-G11: `next_available_name` has no upper bound
**Status:** FIXED-SINCE
**Severity:** Low
**File:** `src-tauri/src/commands/clipboard.rs:43-56`
**Description:** The dedup loop that used to run unbounded now caps at `MAX_ATTEMPTS = 100` and falls back to a millisecond-timestamp suffix, guaranteeing termination without an unbounded filesystem-existence-check loop.
**Evidence:**
```rust
const MAX_ATTEMPTS: u32 = 100;
for copy_index in 1..=MAX_ATTEMPTS {
	let candidate = format!("{stem} ({copy_index}){suffix}");
	if !exists(&candidate) {
		return candidate;
	}
}

// Fallback to a timestamp-based suffix to guarantee uniqueness without looping.
let ts = SystemTime::now()
	.duration_since(UNIX_EPOCH)
	.map(|d| d.as_millis())
	.unwrap_or(0);
format!("{stem} {ts}{suffix}")
```

---

### BUG-G12: Trash restore — misleading error message masks real filesystem error
**Status:** CONFIRMED-STILL-OPEN
**Severity:** Low
**File:** `src-tauri/src/commands/notes.rs:214-217`
**Description:** `restore_trash_item_internal_for_tests` still maps both `create_dir_all` and the restoring `fs::rename` straight through `TessellumError::Io`, which only carries the OS error's own text (e.g. "Access is denied. (os error 5)") with no path context. A permission failure, a missing/unwritable restore directory, and a genuine OS-level race all surface as the same uninformative message with no indication of which path or what kind of failure occurred.
**Evidence:**
```rust
let restore_dir = resolve_restore_directory(vault_root, &parsed);
fs::create_dir_all(&restore_dir).map_err(TessellumError::Io)?;
let destination = build_restored_destination_path(&restore_dir, &parsed.original_name)
    .ok_or_else(|| TessellumError::Validation("Failed to resolve restore destination".to_string()))?;
fs::rename(&resolved_entry, &destination).map_err(TessellumError::Io)?;
```
**Fix:** Wrap these `map_err` calls with a message that includes the source/destination paths, e.g. `TessellumError::Internal(format!("Failed to restore '{}' to '{}': {}", resolved_entry.display(), destination.display(), e))`.

---

### BUG-R6: Frontmatter-only changes are not re-indexed when saved within the same second
**Status:** CHANGED-SINCE
**Severity:** Medium
**File:** `src-tauri/src/indexer.rs:76-84`
**Description:** The periodic indexer's re-index decision now also compares file size when mtime is unchanged, which catches same-second frontmatter edits that add/remove characters. However, an edit that changes frontmatter content while preserving the exact byte count (e.g. `status: draft` → `status: ready ` with padding, or swapping two same-length tag values) still has both `modified_time` and `size` identical to the DB record, so it is still silently skipped by `full_sync`. Note this periodic-sync gap is largely masked in the interactive app because `write_file` (`notes.rs`) calls `index_note_content` directly on every save — this code path only matters for changes made outside the app (external editors, `git checkout`, etc.) or vault sync/import flows that don't call `write_file`.
**Evidence:**
```rust
let needs_index = match db_files.get(path) {
    None => true, // New file
    // Re-index if mtime changed OR if mtime is equal but size changed
    // (handles same-second edits that only touch frontmatter).
    Some((db_modified, _, db_size)) => {
        *modified_time > *db_modified
            || (*modified_time == *db_modified && *db_size != *size as i64)
    }
};
```
**Fix:** For a fully correct fix, hash file content (or use nanosecond mtime where the filesystem supports it) instead of relying on the `(mtime, size)` tuple as a proxy for "changed".

---

### BUG-R7: DB transaction commits after filesystem mutation — no rollback path on commit failure
**Status:** CONFIRMED-STILL-OPEN
**Severity:** Medium
**File:** `src-tauri/src/db.rs:247-334` (function `update_file_path`), called from `src-tauri/src/commands/vault.rs:250-274` (`rename_file`) and `src-tauri/src/commands/vault.rs:392-403` (`move_items`)
**Description:** Both `rename_file` and `move_items` perform the filesystem `rename`/`tokio::fs::rename` first and only afterward call `db.update_file_path`, whose transaction commits at `db.rs:333`. If `tx.commit()` fails (disk full, DB locked, power loss) after the filesystem move already succeeded, the file is at its new location but the database — and therefore backlinks/graph — still reference the old path, with no recovery path.
**Evidence:**
```rust
// vault.rs — rename_file
tokio::fs::rename(old, &new_path)
    .await
    .map_err(TessellumError::from)?;
...
db
    .update_file_path(&old_path, &new_path.to_string_lossy())
    .await
    .map_err(TessellumError::from)?;
```
```rust
// db.rs — update_file_path
...
tx.commit().await?;
Ok(())
```
**Fix:** As originally suggested — perform the DB update/commit first, then the filesystem rename, so a DB failure never leaves an already-moved file with stale index state; or wrap both in a compensating action that reverts the filesystem move if the commit fails.

---

### BUG-R9: Files deleted from the vault root are restored into a folder named "root" (legacy label format)
**Status:** FIXED-SINCE
**Severity:** Medium
**File:** `src-tauri/src/commands/notes.rs:114-128`
**Description:** For legacy trash entries (bare `"root"` parent label, pre-dating the `p=`/`p:` relative-path encoding), `resolve_restore_directory` now explicitly checks `parent_label.eq_ignore_ascii_case("root")` before falling through to the `WalkDir` name-search heuristic, and returns `vault_root` directly instead of ever joining a literal `"root"` path segment. This is also covered by a passing regression test using the legacy `"(Root)"` label format.
**Evidence:**
```rust
// Legacy format or missing path: search for a folder with the bare parent name.
let parent_label = if let Some(encoded) = parsed
    .parent_label
    .strip_prefix("p=")
    .or_else(|| parsed.parent_label.strip_prefix("p:"))
{
    // Extract last segment of encoded path as a human-readable hint.
    decoded_last_segment(encoded)
} else {
    parsed.parent_label.clone()
};

if parent_label.eq_ignore_ascii_case("root") || parent_label.is_empty() {
    return vault_root.to_path_buf();
}
```
```rust
// notes.rs:1100-1113 — regression test using the legacy "(Root)" label
#[test]
fn restore_trash_item_moves_file_back_to_root_with_clean_name() {
    ...
    let trashed = trash.join("Note (Root) 1740681450123.md");
    ...
    let restored_path = restore_trash_item_internal_for_tests(vault, &trashed).unwrap();
    assert_eq!(restored_path, vault.join("Note.md"));
```

---

### BUG-R5 (remainder): `generate_unique_trash_path` still has a check-then-act gap before the caller's rename
**Status:** CONFIRMED-STILL-OPEN
**Severity:** Medium
**File:** `src-tauri/src/trash.rs:100-112` (function `generate_unique_trash_path`), called from `src-tauri/src/commands/notes.rs:696-701`
**Description:** The `if !trash_dir.exists()` mkdir race (the other half of the original BUG-R5) is fixed — `notes.rs` now unconditionally calls `fs::create_dir_all(&trash_dir)`, which is idempotent. However, `generate_unique_trash_path` still picks a trash-destination candidate purely by looping on `candidate.exists()` and returns that `PathBuf` to the caller, which performs the actual `tokio::fs::rename` afterward as a separate step. Between the last `exists()` check inside `generate_unique_trash_path` and the caller's `rename`, a concurrent `trash_item`/`trash_items` call (or an external process) can create a file at that exact candidate path, and the rename will silently overwrite it (or fail with a platform-specific error) instead of retrying with a new name.
**Evidence:**
```rust
// trash.rs
pub fn generate_unique_trash_path(trash_dir: &Path, source_path: &Path, vault_root: &Path, timestamp: u128) -> Option<PathBuf> {
	let base_name = generate_trash_name(source_path, vault_root, timestamp)?;
	let mut candidate = trash_dir.join(&base_name);
	let mut collision_index = 1;

	while candidate.exists() {
		let next_name = with_collision_suffix(&base_name, collision_index);
		candidate = trash_dir.join(next_name);
		collision_index += 1;
	}

	Some(candidate)
}
```
```rust
// notes.rs — trash_item_internal, separate call site after the check loop above
let trash_path = generate_unique_trash_path(&trash_dir, item, vault_root, timestamp)
    .ok_or_else(|| TessellumError::Validation("Failed to generate trash name".to_string()))?;

tokio::fs::rename(item, &trash_path)
    .await
    .map_err(TessellumError::Io)?;
```
**Fix:** As originally suggested — treat an `AlreadyExists`-class rename failure as a retry trigger (loop back into `generate_unique_trash_path` with a bumped collision index or a random suffix) rather than relying solely on the pre-check.

---

### NEW-BACKEND-1: `create_note_from_template` passes the destination folder, not the vault root, as `{{vault}}`
**Status:** NEW
**Severity:** Medium
**File:** `src-tauri/src/commands/templates.rs:120-121`
**Description:** `apply_placeholders`'s third parameter is documented/used elsewhere as `vault_path` (see `notes.rs`'s `get_or_create_daily_note`, which correctly passes `&vault_path`). `create_note_from_template` instead passes `&target_dir` — the note's destination subfolder — in that slot. Any template that uses the `{{vault}}` placeholder gets the wrong value (the subfolder the note happens to be created in) instead of the actual vault root, and the value changes depending on where in the vault the user creates the note.
**Evidence:**
```rust
let processed_content =
    apply_placeholders(&template_content, &clean_title, &target_dir, Local::now());
```
compare with the correct call elsewhere in the same codebase:
```rust
// notes.rs — get_or_create_daily_note
let content = ...
    apply_placeholders(&template_content, &title, &vault_path, now)
```
**Fix:** Pass `&vault_path` instead of `&target_dir` on `templates.rs:121`.

---

### NEW-BACKEND-2: Template/asset filename collision loops have no upper bound
**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/templates.rs:113-118` and `src-tauri/src/commands/assets.rs:119-126`
**Description:** Both `create_note_from_template` and `save_asset_inner` resolve name collisions with a `while path.exists() { ...; counter += 1 }` loop that has no iteration cap, unlike `clipboard.rs`'s `next_available_name` (BUG-G11 above), which was fixed to cap at 100 attempts with a timestamp fallback. A directory containing hundreds of same-titled notes/pasted assets (a plausible template-driven daily/meeting-notes workflow) makes each new-note/new-asset call do a correspondingly growing number of blocking filesystem `exists()` checks before returning.
**Evidence:**
```rust
// templates.rs — create_note_from_template
let mut file_path = Path::new(&target_dir).join(&filename);
let mut collision_index = 1;

while file_path.exists() {
	let stem = clean_title.strip_suffix(".md").unwrap_or(&clean_title);
	filename = format!("{} ({}).md", stem, collision_index);
	file_path = Path::new(&target_dir).join(&filename);
	collision_index += 1;
}
```
```rust
// assets.rs — save_asset_inner
let mut filename = format!("{}.{}", base, ext_raw);
let mut final_path = dir_path.join(&filename);
let mut counter = 1;
while final_path.exists() {
	filename = format!("{}-{}.{}", base, counter, ext_raw);
	final_path = dir_path.join(&filename);
	counter += 1;
}
```
**Fix:** Reuse (or factor out) the same bounded-loop-plus-timestamp-fallback pattern already used by `next_available_name` in `clipboard.rs`.

---

### NEW-BACKEND-3: `create_folder` has a check-then-act race between the existence check and `create_dir`
**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/folders.rs:34-41`
**Description:** `create_folder` checks `folder_path.exists()` and returns a friendly "Folder already exists" error, then calls `tokio::fs::create_dir` in a separate step. If two folder-creation calls for the same name race (e.g. a double-submitted UI action, or a filesystem watcher/import path creating the same directory concurrently), both can pass the `exists()` check before either has created the directory, and the loser gets a raw OS "already exists" `io::Error` surfaced as a generic string instead of the intended friendly message — the same class of TOCTOU gap called out in BUG-R5 for the trash directory.
**Evidence:**
```rust
// Check for existence
if folder_path.exists() {
    return Err(String::from("Folder already exists"));
}

// Create the directory
tokio::fs::create_dir(&folder_path)
    .await
    .map_err(|e| e.to_string())?;
```
**Fix:** Treat an `ErrorKind::AlreadyExists` result from `create_dir` as the authoritative "already exists" signal (mapping it to the friendly message) rather than relying on the preceding `exists()` check to catch every case.

---

### NEW-BACKEND-4: Watcher's `file-changed` event emission failure is silently swallowed
**Status:** NEW
**Severity:** Low
**File:** `src-tauri/src/commands/watcher.rs:65`
**Description:** Inside the `notify` callback, a successful (debounced) filesystem event triggers `app_handle_clone.emit("file-changed", ())`, whose `Result` is discarded with `let _ =`. If emission ever fails (e.g. serialization error, or the main window having been torn down during a vault switch race), the frontend never learns a file changed and nothing is logged, so the UI can silently go stale with no diagnostic trail.
**Evidence:**
```rust
let _ = app_handle_clone.emit("file-changed", ());
```
**Fix:** Log the error on the `Err` branch, e.g. `if let Err(e) = app_handle_clone.emit("file-changed", ()) { log::warn!("Failed to emit file-changed: {}", e); }`.
