use std::path::{Path, PathBuf};

use regex::Regex;
use tantivy::collector::{DocSetCollector, TopDocs};
use tantivy::query::{AllQuery, BooleanQuery, BoostQuery, Occur, PhrasePrefixQuery, Query, TermQuery};
use tantivy::schema::{Facet, Field, IndexRecordOption, STORED, STRING, Schema, TEXT, Value};
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term};

use crate::utils::normalize_path;

pub struct SearchIndex {
	index: Index,
	reader: IndexReader,
	fields: SearchFields,
	index_dir: PathBuf,
}

#[derive(Clone, Copy)]
pub struct SearchFields {
	pub path: Field,
	pub title: Field,
	pub body: Field,
	pub tags: Field,
}

#[derive(Clone)]
pub struct SearchDoc {
	pub path: String,
	pub title: String,
	pub body: String,
	pub tags: Vec<String>,
}

impl SearchIndex {
	pub fn open_or_create(index_dir: &Path) -> Result<Self, String> {
		let (schema, fields) = Self::build_schema();
		let index = if index_dir.exists() {
			Index::open_in_dir(index_dir).map_err(|e| e.to_string())?
		} else {
			std::fs::create_dir_all(index_dir).map_err(|e| e.to_string())?;
			Index::create_in_dir(index_dir, schema).map_err(|e| e.to_string())?
		};
		
		let reader = index
			.reader_builder()
			.reload_policy(ReloadPolicy::Manual)
			.try_into()
			.map_err(|e| e.to_string())?;
		
		Ok(Self {
			index,
			reader,
			fields,
			index_dir: index_dir.to_path_buf(),
		})
	}
	
	pub fn index_dir(&self) -> &Path {
		&self.index_dir
	}
	
	pub fn clear(&self) -> Result<(), String> {
		let mut writer = self.writer()?;
		writer.delete_all_documents().map_err(|e| e.to_string())?;
		writer.commit().map_err(|e| e.to_string())?;
		self.reader.reload().map_err(|e| e.to_string())?;
		Ok(())
	}
	
	pub fn index_batch(&self, docs: &[SearchDoc], delete_paths: &[String]) -> Result<(), String> {
		let mut writer = self.writer()?;
		for path in delete_paths {
			self.delete_path_with_writer(&mut writer, path)?;
		}
		for doc in docs {
			self.delete_path_with_writer(&mut writer, &doc.path)?;
			let mut document = TantivyDocument::default();
			document.add_text(self.fields.path, &doc.path);
			document.add_text(self.fields.title, &doc.title);
			document.add_text(self.fields.body, &doc.body);
			for tag in &doc.tags {
				let facet = Facet::from(&format!("/{}", tag));
				document.add_facet(self.fields.tags, facet);
			}
			writer.add_document(document).map_err(|e| e.to_string())?;
		}
		writer.commit().map_err(|e| e.to_string())?;
		self.reader.reload().map_err(|e| e.to_string())?;
		Ok(())
	}
	
	pub fn delete_path(&self, path: &str) -> Result<(), String> {
		let mut writer = self.writer()?;
		self.delete_path_with_writer(&mut writer, path)?;
		writer.commit().map_err(|e| e.to_string())?;
		self.reader.reload().map_err(|e| e.to_string())?;
		Ok(())
	}
	
	pub fn search(
		&self,
		query: &str,
		tags: &[String],
		match_all_tags: bool,
		limit: usize,
		offset: usize,
	) -> Result<Vec<(SearchDoc, f32)>, String> {
		let reader = self.reader.searcher();
		let normalized = tokenize_query(query);
		
		let text_query: Option<Box<dyn Query>> = if normalized.is_empty() {
			None
		} else {
			let mut clauses: Vec<(Occur, Box<dyn Query>)> = Vec::new();
			for term in normalized {
				let title_term = Term::from_field_text(self.fields.title, &term);
				let body_term = Term::from_field_text(self.fields.body, &term);
				let title_query = PhrasePrefixQuery::new(vec![title_term]);
				let body_query = PhrasePrefixQuery::new(vec![body_term]);
				let boosted = BoostQuery::new(Box::new(title_query), 2.0);
				let should = BooleanQuery::new(vec![
					(Occur::Should, Box::new(boosted)),
					(Occur::Should, Box::new(body_query)),
				]);
				clauses.push((Occur::Must, Box::new(should)));
			}
			Some(Box::new(BooleanQuery::new(clauses)))
		};
		
		let tag_query: Option<Box<dyn Query>> = if !tags.is_empty() {
			let mut tag_clauses = Vec::new();
			for tag in tags {
				let facet = Facet::from(&format!("/{}", tag));
				let term = Term::from_facet(self.fields.tags, &facet);
				let term_query = TermQuery::new(term, IndexRecordOption::Basic);
				tag_clauses.push((
					if match_all_tags {
						tantivy::query::Occur::Must
					} else {
						tantivy::query::Occur::Should
					},
					Box::new(term_query) as Box<dyn Query>,
				));
			}
			Some(Box::new(BooleanQuery::new(tag_clauses)))
		} else {
			None
		};
		
		let query: Box<dyn Query> = match (text_query, tag_query) {
			(Some(text), Some(tags)) => Box::new(BooleanQuery::new(vec![
				(tantivy::query::Occur::Must, text),
				(tantivy::query::Occur::Must, tags),
			])),
			(Some(text), None) => text,
			(None, Some(tags)) => tags,
			(None, None) => return Ok(Vec::new()),
		};
		let top_docs = reader
			.search(&query, &TopDocs::with_limit(limit + offset))
			.map_err(|e| e.to_string())?;
		
		let mut results = Vec::new();
		for (score, address) in top_docs.into_iter().skip(offset).take(limit) {
			let retrieved: TantivyDocument = reader.doc(address).map_err(|e| e.to_string())?;
			let path = retrieved
				.get_first(self.fields.path)
				.and_then(|v| v.as_str())
				.unwrap_or_default()
				.to_string();
			let title = retrieved
				.get_first(self.fields.title)
				.and_then(|v| v.as_str())
				.unwrap_or_default()
				.to_string();
			let body = retrieved
				.get_first(self.fields.body)
				.and_then(|v| v.as_str())
				.unwrap_or_default()
				.to_string();
			
			let mut tag_values = Vec::new();
			for value in retrieved.get_all(self.fields.tags) {
				if let Some(facet) = value.as_facet() {
					let raw = facet.to_string();
					let trimmed = raw.trim_start_matches('/');
					if !trimmed.is_empty() {
						tag_values.push(trimmed.to_string());
					}
				}
			}
			
			results.push((
				SearchDoc {
					path: normalize_path(&path),
					title,
					body,
					tags: tag_values,
				},
				score,
			));
		}
		
		Ok(results)
	}

	pub fn indexed_paths(&self) -> Result<Vec<String>, String> {
		let reader = self.reader.searcher();
		let doc_addresses = reader
			.search(&AllQuery, &DocSetCollector)
			.map_err(|e| e.to_string())?;
		let mut paths = Vec::with_capacity(doc_addresses.len());
		for address in doc_addresses {
			let retrieved: TantivyDocument = reader.doc(address).map_err(|e| e.to_string())?;
			if let Some(path) = retrieved
				.get_first(self.fields.path)
				.and_then(|value| value.as_str())
			{
				paths.push(normalize_path(path));
			}
		}
		Ok(paths)
	}
	
	fn build_schema() -> (Schema, SearchFields) {
		let mut builder = Schema::builder();
		let path = builder.add_text_field("path", STRING | STORED);
		let title = builder.add_text_field("title", TEXT | STORED);
		let body = builder.add_text_field("body", TEXT | STORED);
		let tags = builder.add_facet_field("tags", STORED);
		let schema = builder.build();
		(
			schema,
			SearchFields {
				path,
				title,
				body,
				tags,
			},
		)
	}
	
	fn writer(&self) -> Result<IndexWriter, String> {
		self.index.writer(50_000_000).map_err(|e| e.to_string())
	}
	
	fn delete_path_with_writer(&self, writer: &mut IndexWriter, path: &str) -> Result<(), String> {
		let term = Term::from_field_text(self.fields.path, path);
		writer.delete_term(term);
		Ok(())
	}
}

fn tokenize_query(query: &str) -> Vec<String> {
	let regex = Regex::new(r"[A-Za-z0-9_-]+").unwrap();
	let mut terms = Vec::new();
	for cap in regex.captures_iter(query) {
		if let Some(m) = cap.get(0) {
			let term = m.as_str().to_lowercase();
			if !term.is_empty() {
				terms.push(term);
			}
		}
	}
	terms
}

#[cfg(test)]
mod tests {
	use tempfile::tempdir;

	use super::{tokenize_query, SearchDoc, SearchIndex};

	fn make_doc(path: &str, title: &str, body: &str, tags: &[&str]) -> SearchDoc {
		SearchDoc {
			path: path.to_string(),
			title: title.to_string(),
			body: body.to_string(),
			tags: tags.iter().map(|tag| tag.to_string()).collect(),
		}
	}

	#[test]
	fn tokenizes_query_into_search_terms() {
		let terms = tokenize_query("Alpha-beta, #tag and note_2");

		assert_eq!(terms, vec!["alpha-beta", "tag", "and", "note_2"]);
	}

	#[test]
	fn indexes_search_documents_and_filters_by_text_and_tags() {
		let dir = tempdir().unwrap();
		let index = SearchIndex::open_or_create(&dir.path().join("search-index")).unwrap();
		index
			.index_batch(
				&[
					make_doc("Vault/Alpha.md", "Alpha Note", "project kickoff body", &["project", "work"]),
					make_doc("Vault/Beta.md", "Beta", "meeting notes", &["meeting"]),
				],
				&[],
			)
			.unwrap();

		let text_results = index.search("alpha", &[], false, 10, 0).unwrap();
		assert_eq!(text_results.len(), 1);
		assert_eq!(text_results[0].0.path, "Vault/Alpha.md");

		let tag_results = index
			.search("", &[String::from("meeting")], false, 10, 0)
			.unwrap();
		assert_eq!(tag_results.len(), 1);
		assert_eq!(tag_results[0].0.path, "Vault/Beta.md");

		let no_results = index
			.search("unknown", &[String::from("project")], true, 10, 0)
			.unwrap();
		assert!(no_results.is_empty());
	}

	#[test]
	fn clears_and_deletes_indexed_paths() {
		let dir = tempdir().unwrap();
		let index = SearchIndex::open_or_create(&dir.path().join("search-index")).unwrap();
		index
			.index_batch(&[make_doc("Vault/Alpha.md", "Alpha", "body", &[])], &[])
			.unwrap();
		assert_eq!(index.indexed_paths().unwrap(), vec!["Vault/Alpha.md"]);

		index.delete_path("Vault/Alpha.md").unwrap();
		assert!(index.indexed_paths().unwrap().is_empty());

		index
			.index_batch(&[make_doc("Vault/Beta.md", "Beta", "body", &[])], &[])
			.unwrap();
		index.clear().unwrap();
		assert!(index.indexed_paths().unwrap().is_empty());
	}
}
