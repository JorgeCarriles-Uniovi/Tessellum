use std::collections::{HashMap, HashSet};
use serde::Serialize;
use tauri::State;

use crate::error::TessellumError;
use crate::models::AppState;
use crate::utils::normalize_path;

#[derive(Debug, Clone, Serialize)]
pub struct SemanticHit {
    pub path: String,
    pub title: String,
    pub score: f32,
}

fn tokenize(text: &str) -> Vec<String> {
    let stopwords: HashSet<&str> = [
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "as", "is", "it", "be", "by", "do", "was", "are", "has",
        "not", "this", "that", "from", "they", "we", "you", "i", "he", "she",
        "his", "her", "our", "their", "if", "so", "up", "can", "my", "no",
        "its", "also", "than", "then", "any", "all", "more", "into", "just",
    ].iter().cloned().collect();

    let re = regex::Regex::new(r"[A-Za-z0-9_-]+").unwrap();
    re.find_iter(text)
        .map(|m| m.as_str().to_lowercase())
        .filter(|t| t.len() > 2 && !stopwords.contains(t.as_str()))
        .collect()
}

fn term_frequencies(tokens: &[String]) -> HashMap<String, f32> {
    let mut tf: HashMap<String, f32> = HashMap::new();
    for tok in tokens {
        *tf.entry(tok.clone()).or_insert(0.0) += 1.0;
    }
    let total = tokens.len() as f32;
    if total > 0.0 {
        for v in tf.values_mut() {
            *v /= total;
        }
    }
    tf
}

fn compute_idf(all_token_sets: &[Vec<String>]) -> HashMap<String, f32> {
    let n = all_token_sets.len() as f32;
    let mut doc_freq: HashMap<String, f32> = HashMap::new();
    for tokens in all_token_sets {
        let unique: HashSet<&str> = tokens.iter().map(|s| s.as_str()).collect();
        for term in unique {
            *doc_freq.entry(term.to_string()).or_insert(0.0) += 1.0;
        }
    }
    doc_freq.into_iter()
        .map(|(term, df)| (term, (n / (df + 1.0)).ln() + 1.0))
        .collect()
}

fn tfidf_vec(tf: &HashMap<String, f32>, idf: &HashMap<String, f32>) -> HashMap<String, f32> {
    tf.iter()
        .filter_map(|(term, &tf_val)| idf.get(term).map(|&w| (term.clone(), tf_val * w)))
        .collect()
}

fn cosine(a: &HashMap<String, f32>, b: &HashMap<String, f32>) -> f32 {
    let dot: f32 = a.iter()
        .filter_map(|(k, &va)| b.get(k).map(|&vb| va * vb))
        .sum();
    let na: f32 = a.values().map(|v| v * v).sum::<f32>().sqrt();
    let nb: f32 = b.values().map(|v| v * v).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 { 0.0 } else { dot / (na * nb) }
}

#[tauri::command]
pub async fn semantic_search(
    state: State<'_, AppState>,
    vault_path: String,
    query: String,
    top_k: Option<u32>,
) -> Result<Vec<SemanticHit>, TessellumError> {
    let k = top_k.unwrap_or(10) as usize;
    let query_tokens = tokenize(&query);
    if query_tokens.is_empty() {
        return Ok(Vec::new());
    }

    let search_index = state.search_index.clone();
    let docs = tauri::async_runtime::spawn_blocking(move || {
        let guard = tauri::async_runtime::block_on(search_index.lock());
        guard.get_all_docs()
    })
    .await
    .map_err(|e| TessellumError::Internal(format!("Semantic search task failed: {e}")))?
    .map_err(TessellumError::Internal)?;

    let all_tokens: Vec<Vec<String>> = docs.iter()
        .map(|d| tokenize(&format!("{} {}", d.title, d.body)))
        .collect();
    let idf = compute_idf(&all_tokens);

    let query_vec = tfidf_vec(&term_frequencies(&query_tokens), &idf);

    let mut scored: Vec<SemanticHit> = docs.iter().zip(all_tokens.iter())
        .filter_map(|(doc, tokens)| {
            let score = cosine(&query_vec, &tfidf_vec(&term_frequencies(tokens), &idf));
            if score > 0.0 {
                Some(SemanticHit {
                    path: normalize_path(&doc.path),
                    title: doc.title.clone(),
                    score,
                })
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);

    // Only return results with vault_path prefix
    let vault_norm = normalize_path(&vault_path);
    scored.retain(|h| h.path.starts_with(&vault_norm));

    Ok(scored)
}

#[tauri::command]
pub async fn get_link_suggestions(
    state: State<'_, AppState>,
    vault_path: String,
    note_path: String,
    top_k: Option<u32>,
) -> Result<Vec<SemanticHit>, TessellumError> {
    let k = top_k.unwrap_or(5) as usize;

    let current_content = tokio::fs::read_to_string(&note_path).await
        .map_err(|e| TessellumError::Internal(format!("Failed to read note: {e}")))?;

    // Collect already-linked note stems
    let wikilink_re = regex::Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();
    let existing_links: HashSet<String> = wikilink_re.captures_iter(&current_content)
        .filter_map(|cap| cap.get(1))
        .map(|m| {
            let target = m.as_str().to_lowercase();
            // Handle path-style wikilinks: take last segment
            target.rsplit('/').next().unwrap_or(&target).to_string()
        })
        .collect();

    let search_index = state.search_index.clone();
    let docs = tauri::async_runtime::spawn_blocking(move || {
        let guard = tauri::async_runtime::block_on(search_index.lock());
        guard.get_all_docs()
    })
    .await
    .map_err(|e| TessellumError::Internal(format!("Link suggestions task failed: {e}")))?
    .map_err(TessellumError::Internal)?;

    let all_tokens: Vec<Vec<String>> = docs.iter()
        .map(|d| tokenize(&format!("{} {}", d.title, d.body)))
        .collect();
    let idf = compute_idf(&all_tokens);

    let current_stem = std::path::Path::new(&note_path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let current_tokens = tokenize(&format!("{} {}", current_stem, current_content));
    if current_tokens.is_empty() {
        return Ok(Vec::new());
    }
    let current_vec = tfidf_vec(&term_frequencies(&current_tokens), &idf);

    let normalized_note = normalize_path(&note_path);
    let vault_norm = normalize_path(&vault_path);

    let mut scored: Vec<SemanticHit> = docs.iter().zip(all_tokens.iter())
        .filter_map(|(doc, tokens)| {
            let doc_path = normalize_path(&doc.path);
            if doc_path == normalized_note { return None; }
            if !doc_path.starts_with(&vault_norm) { return None; }

            // Filter out already-linked notes by stem
            let stem = std::path::Path::new(&doc_path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            if existing_links.contains(&stem) { return None; }

            let score = cosine(&current_vec, &tfidf_vec(&term_frequencies(tokens), &idf));
            if score > 0.01 {
                Some(SemanticHit {
                    path: doc_path,
                    title: doc.title.clone(),
                    score,
                })
            } else {
                None
            }
        })
        .collect();

    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(k);
    Ok(scored)
}
