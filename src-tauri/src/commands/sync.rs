use serde::{Deserialize, Serialize};
use tauri::State;

use crate::error::TessellumError;
use crate::models::AppState;
use crate::sync::git_adapter::{self, SyncStatus};

const DEFAULT_REMOTE: &str = "origin";
const DEFAULT_BRANCH: &str = "main";

// ─── Settings model ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitSyncConfig {
    pub remote_url: Option<String>,
    pub remote_name: Option<String>,
    pub branch: Option<String>,
    pub author_name: Option<String>,
    pub author_email: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Initialize a git repository in the vault directory (no-op if already exists).
/// Also writes a .gitignore that skips internal tessellum directories.
#[tauri::command]
pub async fn init_vault_repo(vault_path: String) -> Result<(), TessellumError> {
    tokio::task::spawn_blocking(move || {
        git_adapter::init_vault_repo(&vault_path)?;
        git_adapter::ensure_gitignore(&vault_path)?;
        Ok(())
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}

/// Configure or update the remote URL.
#[tauri::command]
pub async fn set_sync_remote(vault_path: String, remote_url: String) -> Result<(), TessellumError> {
    tokio::task::spawn_blocking(move || {
        git_adapter::add_or_set_remote(&vault_path, DEFAULT_REMOTE, &remote_url)
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}

/// Return current sync status (ahead/behind, uncommitted, conflicts).
#[tauri::command]
pub async fn get_sync_status(vault_path: String) -> Result<SyncStatus, TessellumError> {
    tokio::task::spawn_blocking(move || {
        Ok(git_adapter::get_sync_status(&vault_path, DEFAULT_REMOTE))
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
}

/// Stage all changes and commit with an auto message.
#[tauri::command]
pub async fn sync_commit(
    vault_path: String,
    message: Option<String>,
    config: GitSyncConfig,
) -> Result<String, TessellumError> {
    let commit_msg = message.unwrap_or_else(|| "auto: save".to_string());
    let author_name = config.author_name.unwrap_or_else(|| "Tessellum".to_string());
    let author_email = config.author_email.unwrap_or_else(|| "tessellum@sync".to_string());

    tokio::task::spawn_blocking(move || {
        git_adapter::stage_and_commit(&vault_path, &commit_msg, &author_name, &author_email)
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}

/// Fetch from remote, then fast-forward (or merge) the current branch.
/// Returns true if local tree was updated.
#[tauri::command]
pub async fn sync_pull(
    vault_path: String,
    config: GitSyncConfig,
) -> Result<bool, TessellumError> {
    let remote = config.remote_name.unwrap_or_else(|| DEFAULT_REMOTE.to_string());
    let branch = config.branch.unwrap_or_else(|| DEFAULT_BRANCH.to_string());
    let username = config.username.clone();
    let password = config.password.clone();
    let vp = vault_path.clone();

    tokio::task::spawn_blocking(move || {
        git_adapter::sync_fetch(
            &vp,
            &remote,
            username.as_deref(),
            password.as_deref(),
        )?;
        git_adapter::sync_merge_ff(&vp, &remote, &branch)
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}

/// Push committed changes to the remote.
#[tauri::command]
pub async fn sync_push(
    vault_path: String,
    config: GitSyncConfig,
) -> Result<(), TessellumError> {
    let remote = config.remote_name.unwrap_or_else(|| DEFAULT_REMOTE.to_string());
    let branch = config.branch.unwrap_or_else(|| DEFAULT_BRANCH.to_string());
    let username = config.username.clone();
    let password = config.password.clone();

    tokio::task::spawn_blocking(move || {
        git_adapter::sync_push(
            &vault_path,
            &remote,
            &branch,
            username.as_deref(),
            password.as_deref(),
        )
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}

/// Get list of conflicting files (paths).
#[tauri::command]
pub async fn get_conflict_list(vault_path: String) -> Result<Vec<String>, TessellumError> {
    tokio::task::spawn_blocking(move || {
        let status = git_adapter::get_sync_status(&vault_path, DEFAULT_REMOTE);
        Ok(status.conflicts)
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
}

/// Full sync: commit → pull → push.
/// Returns true if the local tree was updated by remote changes.
#[tauri::command]
pub async fn full_git_sync(
    vault_path: String,
    config: GitSyncConfig,
) -> Result<bool, TessellumError> {
    let author_name = config.author_name.clone().unwrap_or_else(|| "Tessellum".to_string());
    let author_email = config.author_email.clone().unwrap_or_else(|| "tessellum@sync".to_string());
    let remote = config.remote_name.clone().unwrap_or_else(|| DEFAULT_REMOTE.to_string());
    let branch = config.branch.clone().unwrap_or_else(|| DEFAULT_BRANCH.to_string());
    let username = config.username.clone();
    let password = config.password.clone();
    let vp = vault_path.clone();

    tokio::task::spawn_blocking(move || {
        // 1. Commit local changes
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let msg = format!("auto: save at {}", now_ms);
        git_adapter::stage_and_commit(&vp, &msg, &author_name, &author_email)?;

        // 2. Fetch
        git_adapter::sync_fetch(&vp, &remote, username.as_deref(), password.as_deref())?;

        // 3. Merge / fast-forward
        let updated = git_adapter::sync_merge_ff(&vp, &remote, &branch)?;

        // 4. Push
        git_adapter::sync_push(&vp, &remote, &branch, username.as_deref(), password.as_deref())?;

        Ok(updated)
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)
}
