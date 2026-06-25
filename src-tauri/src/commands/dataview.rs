use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;

use crate::error::TessellumError;
use crate::models::AppState;

// ─── DSL types ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
pub enum ViewKind {
    Table,
    List,
    Calendar,
}

#[derive(Debug, Clone)]
pub enum WhereClause {
    TagEq(String),
    FolderEq(String),
    PropEq(String, String),
    PropContains(String, String),
}

#[derive(Debug, Clone)]
struct ParsedQuery {
    view: ViewKind,
    columns: Vec<String>,
    where_clauses: Vec<WhereClause>,
    sort_field: Option<String>,
    sort_desc: bool,
    limit: Option<u32>,
    calendar_field: Option<String>,
}

// ─── Parser ──────────────────────────────────────────────────────────────────

fn parse_query(input: &str) -> Result<ParsedQuery, TessellumError> {
    let mut view = ViewKind::List;
    let mut columns: Vec<String> = Vec::new();
    let mut where_clauses: Vec<WhereClause> = Vec::new();
    let mut sort_field: Option<String> = None;
    let mut sort_desc = false;
    let mut limit: Option<u32> = None;
    let mut calendar_field: Option<String> = None;

    for raw_line in input.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with("//") {
            continue;
        }

        let upper = line.to_uppercase();

        if upper.starts_with("TABLE") {
            view = ViewKind::Table;
            let rest = line[5..].trim();
            if !rest.is_empty() {
                columns = rest.split(',').map(|s| s.trim().to_string()).collect();
            }
        } else if upper.starts_with("LIST") {
            view = ViewKind::List;
            let rest = line[4..].trim();
            if !rest.is_empty() {
                columns = vec![rest.to_string()];
            }
        } else if upper.starts_with("CALENDAR") {
            view = ViewKind::Calendar;
            let rest = line[8..].trim();
            if !rest.is_empty() {
                calendar_field = Some(rest.to_string());
            }
        } else if upper.starts_with("WHERE") {
            let rest = line[5..].trim();
            parse_where_clause(rest, &mut where_clauses)?;
        } else if upper.starts_with("SORT") {
            let rest = line[4..].trim();
            let parts: Vec<&str> = rest.splitn(2, ' ').collect();
            if !parts.is_empty() {
                sort_field = Some(parts[0].trim().to_string());
                sort_desc = parts.get(1).map(|s| s.trim().to_uppercase() == "DESC").unwrap_or(false);
            }
        } else if upper.starts_with("LIMIT") {
            let rest = line[5..].trim();
            if let Ok(n) = rest.parse::<u32>() {
                limit = Some(n);
            }
        }
    }

    Ok(ParsedQuery {
        view,
        columns,
        where_clauses,
        sort_field,
        sort_desc,
        limit,
        calendar_field,
    })
}

fn parse_where_clause(expr: &str, out: &mut Vec<WhereClause>) -> Result<(), TessellumError> {
    // Supported forms:
    //   tag = "value"
    //   tag = value
    //   folder = "path"
    //   propname = "value"
    //   propname contains "value"
    let strip_quotes = |s: &str| s.trim().trim_matches('"').trim_matches('\'').to_string();

    if let Some(idx) = expr.to_lowercase().find(" contains ") {
        let field = expr[..idx].trim().to_string();
        let value = strip_quotes(&expr[idx + 10..]);
        out.push(WhereClause::PropContains(field, value));
        return Ok(());
    }

    if let Some(idx) = expr.find('=') {
        let field = expr[..idx].trim().to_lowercase();
        let value = strip_quotes(&expr[idx + 1..]);
        match field.as_str() {
            "tag" | "tags" => out.push(WhereClause::TagEq(value)),
            "folder" => out.push(WhereClause::FolderEq(value)),
            other => out.push(WhereClause::PropEq(other.to_string(), value)),
        }
        return Ok(());
    }

    Err(TessellumError::Validation(format!("Cannot parse WHERE clause: {}", expr)))
}

// ─── SQL builder ─────────────────────────────────────────────────────────────

struct SqlQuery {
    sql: String,
    params: Vec<String>,
}

fn build_sql(query: &ParsedQuery, vault_path: &str) -> SqlQuery {
    // We join notes with note_tags to support tag filters.
    // For simplicity we use a subquery approach.

    let mut conditions: Vec<String> = Vec::new();
    // Params are bound positionally in `run_dataview_query`, so they must be in
    // the same order their `?` placeholders appear in the final SQL. The JOIN
    // clauses are rendered before the WHERE clause, so tag-join params must be
    // bound before the condition params — hence two separate vectors that are
    // concatenated (tags first) at the end.
    let mut tag_params: Vec<String> = Vec::new();
    let mut condition_params: Vec<String> = Vec::new();

    // Always filter to markdown files within the vault
    conditions.push("n.path LIKE ?".to_string());
    condition_params.push(format!("{}%", vault_path.trim_end_matches('/')));

    // Skip hidden/trash files
    conditions.push("n.path NOT LIKE '%/.tessellum/%'".to_string());
    conditions.push("n.path NOT LIKE '%/.trash/%'".to_string());

    let mut tag_joins: Vec<String> = Vec::new();
    let mut tag_idx = 0;

    for clause in &query.where_clauses {
        match clause {
            WhereClause::TagEq(tag) => {
                let alias = format!("nt{}", tag_idx);
                tag_joins.push(format!(
                    "JOIN note_tags {alias} ON {alias}.path = n.path AND {alias}.tag = ?",
                    alias = alias
                ));
                tag_params.push(tag.clone());
                tag_idx += 1;
            }
            WhereClause::FolderEq(folder) => {
                conditions.push("n.path LIKE ?".to_string());
                condition_params.push(format!("%/{}/%", folder.trim_matches('/')));
            }
            WhereClause::PropEq(field, value) => {
                conditions.push(format!(
                    "json_extract(n.frontmatter, '$.{}') = ?",
                    field
                ));
                condition_params.push(value.clone());
            }
            WhereClause::PropContains(field, value) => {
                conditions.push(format!(
                    "json_extract(n.frontmatter, '$.{}') LIKE ?",
                    field
                ));
                condition_params.push(format!("%{}%", value));
            }
        }
    }

    // SQL placeholder order: joins first, then WHERE conditions.
    let mut params: Vec<String> = Vec::with_capacity(tag_params.len() + condition_params.len());
    params.extend(tag_params);
    params.extend(condition_params);

    let joins = tag_joins.join("\n");
    let where_sql = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let order_sql = if let Some(ref field) = query.sort_field {
        let dir = if query.sort_desc { "DESC" } else { "ASC" };
        let col = if field == "title" {
            "n.path".to_string()
        } else {
            format!("json_extract(n.frontmatter, '$.{}')", field)
        };
        format!("ORDER BY {} {}", col, dir)
    } else {
        "ORDER BY n.modified_at DESC".to_string()
    };

    let limit_sql = query.limit.map(|l| format!("LIMIT {}", l)).unwrap_or_default();

    let sql = format!(
        "SELECT n.path, n.frontmatter FROM notes n {} {} {} {}",
        joins, where_sql, order_sql, limit_sql
    );

    SqlQuery { sql, params }
}

// ─── Result types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct DataviewRow {
    pub path: String,
    pub title: String,
    #[serde(flatten)]
    pub props: serde_json::Map<String, serde_json::Value>,
}

#[derive(Serialize)]
pub struct DataviewResult {
    pub view: String,
    pub columns: Vec<String>,
    pub rows: Vec<DataviewRow>,
    pub calendar_field: Option<String>,
    pub error: Option<String>,
}

// ─── Command ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn execute_dataview_query(
    state: State<'_, AppState>,
    query: String,
    vault_path: String,
) -> Result<DataviewResult, TessellumError> {
    let parsed = match parse_query(&query) {
        Ok(p) => p,
        Err(e) => {
            return Ok(DataviewResult {
                view: "LIST".to_string(),
                columns: vec![],
                rows: vec![],
                calendar_field: None,
                error: Some(e.to_string()),
            });
        }
    };

    let built = build_sql(&parsed, &vault_path);
    let db = &state.db;

    let columns = if parsed.columns.is_empty() {
        vec!["title".to_string()]
    } else {
        parsed.columns.clone()
    };

    let rows = db.run_dataview_query(&built.sql, &built.params, &columns).await
        .unwrap_or_else(|e| {
            log::warn!("Dataview query failed: {}", e);
            vec![]
        });

    let view_str = match parsed.view {
        ViewKind::Table => "TABLE",
        ViewKind::List => "LIST",
        ViewKind::Calendar => "CALENDAR",
    };

    Ok(DataviewResult {
        view: view_str.to_string(),
        columns,
        rows,
        calendar_field: parsed.calendar_field,
        error: None,
    })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression: params must be bound in the same order their `?` placeholders
    /// appear in the SQL. JOINs render before WHERE, so a tag filter's param must
    /// come before the vault-path param — otherwise the tag JOIN matches nothing
    /// and every tagged query returns no results.
    #[test]
    fn tag_param_binds_before_path_param() {
        let parsed = parse_query("TABLE type, app\nWHERE tag = \"explain\"").unwrap();
        let built = build_sql(&parsed, "/home/me/vault");

        // The JOIN placeholder appears before the WHERE placeholder in the SQL.
        let join_pos = built.sql.find("nt0.tag = ?").expect("tag join placeholder");
        let path_pos = built.sql.find("n.path LIKE ?").expect("path placeholder");
        assert!(join_pos < path_pos, "JOIN placeholder must precede path placeholder");

        // Params must line up with that placeholder order.
        assert_eq!(built.params[0], "explain", "first bound param must be the tag");
        assert_eq!(built.params[1], "/home/me/vault%", "second bound param must be the vault path");
    }
}
