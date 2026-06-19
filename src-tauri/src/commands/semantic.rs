use std::collections::{HashMap, HashSet};
use serde::{Serialize, Deserialize};
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

// ----- Auto-tagging / concept extraction -----

/// Extracts high-weight keyword candidates from note content using TF-IDF
/// and capitalized proper-noun heuristic.
#[tauri::command]
pub async fn suggest_tags(
    state: State<'_, AppState>,
    content: String,
    existing_tags: Vec<String>,
) -> Result<Vec<String>, TessellumError> {
    let search_index = state.search_index.clone();
    let docs = tauri::async_runtime::spawn_blocking(move || {
        let guard = tauri::async_runtime::block_on(search_index.lock());
        guard.get_all_docs()
    })
    .await
    .map_err(|e| TessellumError::Internal(e.to_string()))?
    .map_err(TessellumError::Internal)?;

    let all_tokens: Vec<Vec<String>> = docs.iter()
        .map(|d| tokenize(&format!("{} {}", d.title, d.body)))
        .collect();
    let idf = compute_idf(&all_tokens);

    // Strip YAML frontmatter before analysis
    let body = if content.starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            &content[3 + end + 4..]
        } else {
            &content
        }
    } else {
        &content
    };

    let tokens = tokenize(body);
    let tf = term_frequencies(&tokens);
    let mut tfidf: Vec<(String, f32)> = tfidf_vec(&tf, &idf).into_iter().collect();
    tfidf.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Top keyword candidates from TF-IDF
    let keyword_candidates: Vec<String> = tfidf.into_iter()
        .take(20)
        .filter(|(term, score)| *score > 0.1 && term.len() > 3)
        .map(|(term, _)| term)
        .collect();

    // Extract capitalized proper noun phrases (2+ words)
    let cap_re = regex::Regex::new(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b").unwrap();
    let proper_nouns: Vec<String> = cap_re.find_iter(&content)
        .map(|m| {
            m.as_str()
                .split_whitespace()
                .map(|w| w.to_lowercase())
                .collect::<Vec<_>>()
                .join("-")
        })
        .collect::<HashSet<String>>()
        .into_iter()
        .collect();

    // Build existing tag set (normalised)
    let existing_set: HashSet<String> = existing_tags.iter()
        .map(|t| t.trim_start_matches('#').to_lowercase())
        .collect();

    // Merge candidates, deduplicate, exclude existing tags
    let mut suggestions: Vec<String> = keyword_candidates.into_iter()
        .chain(proper_nouns)
        .filter(|t| !existing_set.contains(t))
        .collect::<HashSet<String>>()
        .into_iter()
        .take(8)
        .collect();

    suggestions.sort();
    Ok(suggestions)
}

// ----- Tag consolidation -----

#[derive(Debug, Serialize, Deserialize)]
pub struct TagGroup {
    pub canonical: String,
    pub variants: Vec<String>,
}

fn edit_distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let (m, n) = (a.len(), b.len());
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 0..=m { dp[i][0] = i; }
    for j in 0..=n { dp[0][j] = j; }
    for i in 1..=m {
        for j in 1..=n {
            dp[i][j] = if a[i - 1] == b[j - 1] {
                dp[i - 1][j - 1]
            } else {
                1 + dp[i - 1][j].min(dp[i][j - 1]).min(dp[i - 1][j - 1])
            };
        }
    }
    dp[m][n]
}

/// Returns groups of near-duplicate tags found in the vault.
#[tauri::command]
pub async fn get_similar_tag_groups(
    state: State<'_, AppState>,
) -> Result<Vec<TagGroup>, TessellumError> {
    let db = state.db.clone();
    let tags: Vec<String> = db.get_all_tags()
        .await
        .map_err(|e| TessellumError::Internal(e.to_string()))?;

    // Cluster by edit distance ≤ 2 or common prefix ≥ 4 chars
    let mut used = vec![false; tags.len()];
    let mut groups: Vec<TagGroup> = Vec::new();

    for i in 0..tags.len() {
        if used[i] { continue; }
        let mut group = vec![tags[i].clone()];
        used[i] = true;

        for j in (i + 1)..tags.len() {
            if used[j] { continue; }
            let a = &tags[i];
            let b = &tags[j];
            let shorter_len = a.len().min(b.len());
            let common_prefix = a.chars().zip(b.chars()).take_while(|(ca, cb)| ca == cb).count();

            let similar = edit_distance(a, b) <= 2
                || (shorter_len >= 4 && common_prefix >= shorter_len.saturating_sub(1));

            if similar {
                group.push(tags[j].clone());
                used[j] = true;
            }
        }

        if group.len() > 1 {
            // Shortest/most common as canonical
            let canonical = group.iter().min_by_key(|t| t.len()).cloned().unwrap_or_default();
            let variants: Vec<String> = group.into_iter().filter(|t| t != &canonical).collect();
            groups.push(TagGroup { canonical, variants });
        }
    }

    Ok(groups)
}

/// Rewrites all occurrences of variant tags to the canonical tag across vault files.
#[tauri::command]
pub async fn merge_tags(
    state: State<'_, AppState>,
    canonical: String,
    variants: Vec<String>,
) -> Result<u32, TessellumError> {
    let db = state.db.clone();

    // Get all notes that have any of the variant tags
    let mut updated = 0u32;
    for variant in &variants {
        let notes = db.get_notes_with_tag(variant)
            .await
            .map_err(|e| TessellumError::Internal(e.to_string()))?;

        for note_path in notes {
            let content = tokio::fs::read_to_string(&note_path)
                .await
                .map_err(|e| TessellumError::Internal(format!("Failed to read {note_path}: {e}")))?;

            // Replace variant tag in frontmatter
            let new_content = replace_tag_in_content(&content, variant, &canonical);
            if new_content != content {
                tokio::fs::write(&note_path, &new_content)
                    .await
                    .map_err(|e| TessellumError::Internal(format!("Failed to write {note_path}: {e}")))?;
                updated += 1;
            }
        }
    }

    Ok(updated)
}

fn replace_tag_in_content(content: &str, old_tag: &str, new_tag: &str) -> String {
    // Replace in frontmatter tag lists
    let escaped_old = regex::escape(old_tag);
    let tag_re = regex::Regex::new(&format!(r"(?i)\b{escaped_old}\b")).unwrap();
    tag_re.replace_all(content, new_tag).into_owned()
}
