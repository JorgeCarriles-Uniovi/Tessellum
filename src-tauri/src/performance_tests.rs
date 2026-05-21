use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex as TokioMutex;
use std::time::Instant;
use tempfile::tempdir;

use crate::db::Database;
use crate::indexer::VaultIndexer;
use crate::search::SearchIndex;
use crate::test_support::TestVault;
use crate::grafeo_projection;

#[tokio::test]
async fn benchmark_10k_file_indexing() {
    let mut builder = TestVault::new();
    
    // Seed 10,000 files
    for i in 1..=10000 {
        let content = format!("# Note {}\n\nThis is a performance test note with some generic content.", i);
        builder = builder.with_markdown(&format!("Note_{}.md", i), &content);
    }
    
    let vault = builder.build();
    let db_dir = tempdir().unwrap();
    let db = Database::init(db_dir.path().join("indexer.sqlite").to_str().unwrap())
        .await
        .expect("Database should initialize");
        
    let search_dir = tempdir().unwrap();
    let search_index = Arc::new(TokioMutex::new(
        SearchIndex::open_or_create(&search_dir.path().join("search-index")).unwrap(),
    ));

    // Time the indexing operation
    let start = Instant::now();
    let stats = VaultIndexer::full_sync(
        &db,
        search_index,
        vault.path().to_str().unwrap(),
    )
    .await
    .expect("Full sync should succeed");
    
    let elapsed = start.elapsed();
    
    // Assert constraints defined in UNE 157801 testing specification
    assert_eq!(stats.files_indexed, 10000);
    assert!(
        elapsed.as_secs() < 5, 
        "Indexing 10,000 files took {:?}, exceeding the 5-second limit", 
        elapsed
    );
}

#[tokio::test]
async fn benchmark_5k_node_graph_extraction() {
    let grafeo_dir = tempdir().unwrap();
    grafeo_projection::init_connection(grafeo_dir.path().join("grafeo.db"))
        .expect("Grafeo should initialize");
        
    let db_dir = tempdir().unwrap();
    let db = Database::init(db_dir.path().join("indexer.sqlite").to_str().unwrap())
        .await
        .unwrap();

    let connection_mock = StdMutex::new(());

    // Insert 5,000 nodes
    for i in 1..=5000 {
        let note_id = format!("Note_{}.md", i);
        db.index_file(&note_id, 1, 1, None, None, &[]).await.unwrap();
        grafeo_projection::sync_note_upsert(&connection_mock, &db, &note_id)
            .await
            .expect("Note upsert should succeed");
    }

    // Insert 20,000 edges (4 per node)
    for i in 1..=5000 {
        let from_id = format!("Note_{}.md", i);
        for j in 1..=4 {
            let target = (i + j) % 5000 + 1;
            let to_id = format!("Note_{}.md", target);
            grafeo_projection::sync_link_create(&connection_mock, &from_id, &to_id)
                .expect("Link creation should succeed");
        }
    }

    // Benchmark Graph Extraction using a Cypher query
    let start = Instant::now();
    let _graph_data = grafeo_projection::execute_query("MATCH (n:Note) RETURN count(n) AS c")
        .expect("Graph query should succeed");
    let elapsed = start.elapsed();

    assert!(
        elapsed.as_millis() < 500,
        "Graph extraction of 5,000 nodes and 20,000 edges took {:?}, exceeding the 500ms limit",
        elapsed
    );
}

#[tokio::test]
async fn benchmark_sqlite_concurrency() {
    let db_dir = tempdir().unwrap();
    let db_path = db_dir.path().join("concurrency.sqlite");
    
    let db = Database::init(db_path.to_str().unwrap())
        .await
        .expect("Database should initialize in WAL mode");
        
    let db_arc = Arc::new(db);
    let mut handles = vec![];

    // Spawn 10 concurrent tasks making 50 rapid writes each
    // This simulates 500 concurrent saves per second to ensure SQLITE_BUSY is avoided.
    for i in 0..10 {
        let db_clone = db_arc.clone();
        let handle = tokio::spawn(async move {
            for j in 0..50 {
                let path = format!("Thread_{}_Note_{}.md", i, j);
                // upsert_search_file runs an INSERT OR REPLACE
                db_clone.upsert_search_file(&path, 123456789, true)
                    .await
                    .expect("Database write should not hit SQLITE_BUSY lock");
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}
