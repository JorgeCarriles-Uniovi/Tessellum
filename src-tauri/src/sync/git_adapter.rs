use git2::{
    BranchType, Cred, FetchOptions, PushOptions, RemoteCallbacks, Repository,
    RepositoryOpenFlags, Signature, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Open the git repo located exactly at `vault_path`.
/// Unlike `Repository::open`, this never walks up to a parent directory,
/// so we never accidentally operate on the wrong repo.
fn open_vault_repo(vault_path: &str) -> Result<Repository, String> {
    Repository::open_ext(vault_path, RepositoryOpenFlags::NO_SEARCH, std::iter::empty::<&Path>())
        .map_err(|e| format!("open repo: {}", e))
}

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncState {
    /// No remote configured
    NoRemote,
    /// Up to date with remote
    Synced,
    /// Local commits not yet pushed
    Ahead,
    /// Remote has commits not yet pulled
    Behind,
    /// Both local and remote have commits — need merge
    Diverged,
    /// Merge conflicts detected
    Conflict,
    /// Sync operation in progress
    Syncing,
    /// Error state
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub state: SyncState,
    pub ahead: u32,
    pub behind: u32,
    pub uncommitted_changes: u32,
    pub conflicts: Vec<String>,
    pub last_sync: Option<i64>,
    pub message: Option<String>,
}

#[allow(dead_code)] // kept for the sync conflict UI; not wired up yet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictEntry {
    pub path: String,
    pub ours: Option<String>,
    pub theirs: Option<String>,
    pub ancestor: Option<String>,
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

fn make_callbacks<'a>(username: Option<&'a str>, password: Option<&'a str>) -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    if username.is_some() || password.is_some() {
        let u = username.map(|s| s.to_string());
        let p = password.map(|s| s.to_string());
        callbacks.credentials(move |_url, _username_from_url, _allowed| {
            Cred::userpass_plaintext(
                u.as_deref().unwrap_or(""),
                p.as_deref().unwrap_or(""),
            )
        });
    } else {
        callbacks.credentials(|_url, username_from_url, _allowed| {
            Cred::ssh_key_from_agent(username_from_url.unwrap_or("git"))
        });
    }
    callbacks
}

// ─── Core operations ─────────────────────────────────────────────────────────

/// Initialize a new git repo in the vault. No-op if already a repo.
pub fn init_vault_repo(vault_path: &str) -> Result<(), String> {
    if open_vault_repo(vault_path).is_ok() {
        return Ok(());
    }
    let mut opts = git2::RepositoryInitOptions::new();
    opts.initial_head("main");
    Repository::init_opts(vault_path, &opts)
        .map(|_| ())
        .map_err(|e| format!("git init failed: {}", e))
}

/// Rename the current branch to `target_branch` if it differs (e.g. master → main).
/// No-op if already on the right branch or if there are no commits yet.
pub fn ensure_branch_name(vault_path: &str, target_branch: &str) -> Result<(), String> {
    let repo = open_vault_repo(vault_path)?;
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(()), // unborn branch, nothing to rename yet
    };
    let current = match head.shorthand() {
        Some(n) => n.to_string(),
        None => return Ok(()),
    };
    if current == target_branch {
        return Ok(());
    }
    let oid = head.target().ok_or("HEAD has no target")?;
    repo.branch(target_branch, &repo.find_commit(oid).map_err(|e| e.to_string())?, false)
        .map_err(|e| format!("create branch '{}': {}", target_branch, e))?;
    repo.set_head(&format!("refs/heads/{}", target_branch))
        .map_err(|e| format!("set HEAD: {}", e))?;
    repo.find_branch(&current, BranchType::Local)
        .and_then(|mut b| b.delete())
        .ok();
    Ok(())
}

/// Stage all changes, commit them, return the commit OID as hex string.
pub fn stage_and_commit(
    vault_path: &str,
    message: &str,
    author_name: &str,
    author_email: &str,
) -> Result<String, String> {
    let repo = open_vault_repo(vault_path)?;

    // Stage all tracked + untracked files (respecting .gitignore).
    // Skip nested git repos — add_all errors on them with "invalid path".
    let vault_root = std::path::PathBuf::from(vault_path);
    let mut index = repo.index().map_err(|e| format!("index: {}", e))?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, Some(&mut |path: &Path, _| {
            if vault_root.join(path).join(".git").exists() { 1 } else { 0 }
        }))
        .map_err(|e| format!("add_all: {}", e))?;
    index.write().map_err(|e| format!("write index: {}", e))?;

    let tree_oid = index.write_tree().map_err(|e| format!("write tree: {}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("find tree: {}", e))?;

    let sig = Signature::now(author_name, author_email)
        .map_err(|e| format!("signature: {}", e))?;

    let parents: Vec<git2::Commit> = match repo.head() {
        Ok(head) => {
            let oid = head.target().ok_or("HEAD has no target")?;
            let commit = repo.find_commit(oid).map_err(|e| format!("find commit: {}", e))?;
            vec![commit]
        }
        Err(_) => vec![], // Initial commit
    };

    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    // Skip empty commits
    if let Ok(head) = repo.head()
        && let Some(oid) = head.target()
            && let Ok(parent_commit) = repo.find_commit(oid)
                && parent_commit.tree_id() == tree_oid {
                    return Ok(oid.to_string());
                }

    let oid = repo
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &parent_refs,
        )
        .map_err(|e| format!("commit: {}", e))?;

    Ok(oid.to_string())
}

/// Fetch from the remote.
pub fn sync_fetch(
    vault_path: &str,
    remote_name: &str,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<(), String> {
    let repo = open_vault_repo(vault_path)?;
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("find remote '{}': {}", remote_name, e))?;

    let callbacks = make_callbacks(username, password);
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    remote
        .fetch(&[] as &[&str], Some(&mut fetch_opts), None)
        .map_err(|e| format!("fetch: {}", e))?;

    Ok(())
}

/// Fast-forward current branch to FETCH_HEAD (after a clean fetch).
/// Returns `true` if any changes were applied.
pub fn sync_merge_ff(vault_path: &str, remote_name: &str, branch: &str) -> Result<bool, String> {
    let repo = open_vault_repo(vault_path)?;

    let remote_ref_name = format!("refs/remotes/{}/{}", remote_name, branch);
    let fetch_commit_oid = match repo.refname_to_id(&remote_ref_name) {
        Ok(oid) => oid,
        Err(_) => return Ok(false), // No remote ref yet
    };
    let fetch_commit = repo
        .find_annotated_commit(fetch_commit_oid)
        .map_err(|e| format!("find annotated commit: {}", e))?;

    let (merge_analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| format!("merge analysis: {}", e))?;

    if merge_analysis.is_up_to_date() {
        return Ok(false);
    }

    if merge_analysis.is_fast_forward() {
        let target_ref = format!("refs/heads/{}", branch);
        repo.reference(
            &target_ref,
            fetch_commit_oid,
            true,
            &format!("Fast-forward to {}", remote_ref_name),
        )
        .map_err(|e| format!("update ref: {}", e))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))
            .map_err(|e| format!("checkout: {}", e))?;
        return Ok(true);
    }

    // Not fast-forward — attempt regular merge
    repo.merge(&[&fetch_commit], None, None)
        .map_err(|e| format!("merge: {}", e))?;

    if repo.index().map(|i| i.has_conflicts()).unwrap_or(false) {
        return Err("merge_conflict".to_string());
    }

    // Complete the merge commit
    let mut index = repo.index().map_err(|e| format!("index after merge: {}", e))?;
    let tree_oid = index.write_tree().map_err(|e| format!("write tree: {}", e))?;
    let tree = repo.find_tree(tree_oid).map_err(|e| format!("find tree: {}", e))?;
    let sig = Signature::now("Tessellum", "tessellum@sync")
        .map_err(|e| format!("sig: {}", e))?;
    let head_commit = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .and_then(|oid| repo.find_commit(oid).ok())
        .ok_or("no HEAD commit")?;
    let merge_commit = repo
        .find_commit(fetch_commit_oid)
        .map_err(|e| format!("find merge commit: {}", e))?;
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "sync: merge remote changes",
        &tree,
        &[&head_commit, &merge_commit],
    )
    .map_err(|e| format!("merge commit: {}", e))?;
    repo.cleanup_state().ok();

    Ok(true)
}

/// Push to the remote.
pub fn sync_push(
    vault_path: &str,
    remote_name: &str,
    branch: &str,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<(), String> {
    let repo = open_vault_repo(vault_path)?;
    let mut remote = repo
        .find_remote(remote_name)
        .map_err(|e| format!("find remote '{}': {}", remote_name, e))?;

    let rejected: std::rc::Rc<std::cell::RefCell<Option<String>>> =
        std::rc::Rc::new(std::cell::RefCell::new(None));
    let rejected_cb = rejected.clone();

    let mut callbacks = make_callbacks(username, password);
    callbacks.push_update_reference(move |refname, status| {
        if let Some(msg) = status {
            *rejected_cb.borrow_mut() = Some(format!("{}: {}", refname, msg));
        }
        Ok(())
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    let push_result = remote.push(&[&refspec], Some(&mut push_opts));
    drop(push_opts); // drop closure so Rc count returns to 1

    push_result.map_err(|e| format!("push: {}", e))?;

    if let Some(msg) = std::rc::Rc::try_unwrap(rejected)
        .ok()
        .and_then(|c| c.into_inner())
    {
        return Err(format!("push rejected by remote: {}", msg));
    }

    Ok(())
}

/// Get current sync status (ahead/behind counts, uncommitted changes).
pub fn get_sync_status(vault_path: &str, remote_name: &str) -> SyncStatus {
    let repo = match open_vault_repo(vault_path) {
        Ok(r) => r,
        Err(_) => {
            return SyncStatus {
                state: SyncState::NoRemote,
                ahead: 0,
                behind: 0,
                uncommitted_changes: 0,
                conflicts: vec![],
                last_sync: None,
                message: Some("Not a git repository".to_string()),
            };
        }
    };

    // Check for active remote
    if repo.find_remote(remote_name).is_err() {
        return SyncStatus {
            state: SyncState::NoRemote,
            ahead: 0,
            behind: 0,
            uncommitted_changes: 0,
            conflicts: vec![],
            last_sync: None,
            message: None,
        };
    }

    // Count uncommitted changes
    let uncommitted = {
        let mut opts = StatusOptions::new();
        opts.include_untracked(true);
        repo.statuses(Some(&mut opts))
            .map(|s| s.len() as u32)
            .unwrap_or(0)
    };

    // Collect conflicts
    let conflicts: Vec<String> = if let Ok(index) = repo.index() {
        index
            .conflicts()
            .ok()
            .map(|c| {
                c.filter_map(|e| e.ok())
                    .filter_map(|entry| {
                        entry
                            .our
                            .or(entry.their)
                            .and_then(|e| std::str::from_utf8(&e.path).ok().map(|s| s.to_string()))
                    })
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    if !conflicts.is_empty() {
        return SyncStatus {
            state: SyncState::Conflict,
            ahead: 0,
            behind: 0,
            uncommitted_changes: uncommitted,
            conflicts,
            last_sync: None,
            message: Some("Merge conflicts detected".to_string()),
        };
    }

    // Compute ahead/behind
    let (ahead, behind) = compute_ahead_behind(&repo, remote_name);

    let state = match (ahead, behind) {
        (0, 0) => SyncState::Synced,
        (a, 0) if a > 0 => SyncState::Ahead,
        (0, b) if b > 0 => SyncState::Behind,
        _ => SyncState::Diverged,
    };

    SyncStatus {
        state,
        ahead,
        behind,
        uncommitted_changes: uncommitted,
        conflicts: vec![],
        last_sync: None,
        message: None,
    }
}

fn compute_ahead_behind(repo: &Repository, remote_name: &str) -> (u32, u32) {
    let head_oid = match repo.head().ok().and_then(|h| h.target()) {
        Some(oid) => oid,
        None => return (0, 0),
    };

    // Find the tracking branch for HEAD
    let branch_name = match repo.head().ok().and_then(|h| h.shorthand().map(|s| s.to_string())) {
        Some(n) => n,
        None => return (0, 0),
    };

    let remote_ref = format!("refs/remotes/{}/{}", remote_name, branch_name);
    let remote_oid = match repo.refname_to_id(&remote_ref) {
        Ok(oid) => oid,
        Err(_) => return (0, 0),
    };

    repo.graph_ahead_behind(head_oid, remote_oid)
        .map(|(a, b)| (a as u32, b as u32))
        .unwrap_or((0, 0))
}

/// Add a remote URL.
pub fn add_or_set_remote(vault_path: &str, remote_name: &str, url: &str) -> Result<(), String> {
    let repo = open_vault_repo(vault_path)?;
    if repo.find_remote(remote_name).is_ok() {
        repo.remote_set_url(remote_name, url)
            .map_err(|e| format!("set_url: {}", e))?;
    } else {
        repo.remote(remote_name, url)
            .map_err(|e| format!("add remote: {}", e))?;
    }
    Ok(())
}

/// Get current branch name.
#[allow(dead_code)] // kept for the sync status UI; not wired up yet
pub fn current_branch(vault_path: &str) -> Result<String, String> {
    let repo = open_vault_repo(vault_path)?;
    let head = repo.head().map_err(|e| format!("HEAD: {}", e))?;
    head.shorthand()
        .map(|s| s.to_string())
        .ok_or_else(|| "HEAD is not a branch".to_string())
}

/// Ensure .gitignore skips tessellum internal dirs.
pub fn ensure_gitignore(vault_path: &str) -> Result<(), String> {
    let gitignore = Path::new(vault_path).join(".gitignore");
    let entries = [
        ".tessellum/recovery/",
        ".tessellum/history/",
        "*.tessellum-tmp",
    ];
    let mut existing = std::fs::read_to_string(&gitignore).unwrap_or_default();
    let mut changed = false;
    for entry in &entries {
        if !existing.contains(entry) {
            if !existing.ends_with('\n') && !existing.is_empty() {
                existing.push('\n');
            }
            existing.push_str(entry);
            existing.push('\n');
            changed = true;
        }
    }
    if changed {
        std::fs::write(&gitignore, &existing)
            .map_err(|e| format!("write .gitignore: {}", e))?;
    }
    Ok(())
}
