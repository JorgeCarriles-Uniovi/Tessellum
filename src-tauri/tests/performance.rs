use std::time::{Duration, Instant};

use tempfile::tempdir;
use tessellum_lib::commands::graph::build_graph_data;
use tessellum_lib::models::AppState;
use tessellum_lib::{Database, SearchIndex, TestVault, VaultIndexer};

fn seed_linear_vault(file_count: usize) -> TestVault {
    let mut builder = TestVault::new();

    for index in 0..file_count {
        let content = format!(
            "---\nstatus: active\ntags:\n  - perf\n  - generated\n---\n# Note {index}\n\nSynthetic body for indexing."
        );
        builder = builder.with_markdown(&format!("Inbox/Note_{index}.md"), &content);
    }

    builder.build()
}

fn seed_dense_graph_vault(node_count: usize, edges_per_node: usize) -> TestVault {
    let mut builder = TestVault::new();

    for index in 0..node_count {
        let links = (1..=edges_per_node)
            .map(|offset| {
                let target = (index + offset) % node_count;
                format!("[[Node_{target}]]")
            })
            .collect::<Vec<_>>()
            .join(" ");
        let content = format!("# Node {index}\n\n{links}\n");
        builder = builder.with_markdown(&format!("Graph/Node_{index}.md"), &content);
    }

    builder.build()
}

fn assert_within_limit(elapsed: Duration, limit: Duration, label: &str) {
    assert!(
        elapsed <= limit,
        "{label} took {:?}, exceeding the {:?} limit",
        elapsed,
        limit
    );
}

#[tokio::test]
#[ignore = "performance budget validation; run with cargo test --release --test performance -- --ignored"]
async fn indexes_10k_files_within_five_seconds() {
    let vault = seed_linear_vault(10_000);
    let db_dir = tempdir().expect("database tempdir should be created");
    let db = Database::init(db_dir.path().join("indexer.sqlite").to_str().unwrap())
        .await
        .expect("database should initialize");
    let search_dir = tempdir().expect("search tempdir should be created");
    let search_index = std::sync::Arc::new(tokio::sync::Mutex::new(
        SearchIndex::open_or_create(&search_dir.path().join("search-index"))
            .expect("search index should initialize"),
    ));

    let start = Instant::now();
    let stats = VaultIndexer::full_sync(&db, search_index, vault.path().to_str().unwrap())
        .await
        .expect("full sync should succeed");
    let elapsed = start.elapsed();

    assert_eq!(stats.files_indexed, 10_000);
    assert_within_limit(elapsed, Duration::from_secs(5), "10k file indexing");
}

#[tokio::test]
#[ignore = "performance budget validation; run with cargo test --release --test performance -- --ignored"]
async fn projects_5k_node_graph_within_five_hundred_milliseconds() {
    let vault = seed_dense_graph_vault(5_000, 4);
    let db_dir = tempdir().expect("database tempdir should be created");
    let db = Database::init(db_dir.path().join("graph.sqlite").to_str().unwrap())
        .await
        .expect("database should initialize");
    let search_dir = tempdir().expect("search tempdir should be created");
    let search_index = SearchIndex::open_or_create(&search_dir.path().join("search-index"))
        .expect("search index should initialize");
    let app_state = AppState::new(db, search_index);

    let sync_search_index = app_state.search_index.clone();
    let stats = VaultIndexer::full_sync(
        app_state.db.as_ref(),
        sync_search_index,
        vault.path().to_str().unwrap(),
    )
    .await
    .expect("full sync should succeed");
    assert_eq!(stats.files_indexed, 5_000);

    let start = Instant::now();
    let graph = build_graph_data(&app_state, vault.path().to_str().unwrap())
        .await
        .expect("graph data should build");
    let elapsed = start.elapsed();

    assert_eq!(graph.nodes.len(), 5_000);
    assert_eq!(graph.edges.len(), 20_000);
    assert_within_limit(
        elapsed,
        Duration::from_millis(500),
        "5k node graph projection",
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "performance budget validation; run with cargo test --release --test performance -- --ignored"]
async fn handles_concurrent_sqlite_operations_without_busy_errors() {
    let db_dir = tempdir().expect("database tempdir should be created");
    let db = std::sync::Arc::new(
        Database::init(db_dir.path().join("concurrency.sqlite").to_str().unwrap())
            .await
            .expect("database should initialize"),
    );
    let mut tasks = Vec::new();

    for worker in 0..10 {
        let db = db.clone();
        tasks.push(tokio::spawn(async move {
            for iteration in 0..50 {
                let path = format!("Vault/Worker_{worker}/Note_{iteration}.md");
                db.index_file(
                    &path,
                    iteration as i64,
                    512,
                    None,
                    None,
                    &[format!("Vault/Shared/Target_{}.md", iteration % 5)],
                )
                .await
                .expect("index_file should succeed under contention");
                db.set_note_tags(&path, &[format!("worker-{worker}"), "perf".to_string()])
                    .await
                    .expect("set_note_tags should succeed under contention");
                db.upsert_search_file(&path, iteration as i64, true)
                    .await
                    .expect("upsert_search_file should succeed under contention");

                let outgoing_links = db
                    .get_outgoing_links(&path)
                    .await
                    .expect("reads should succeed during concurrent writes");
                assert_eq!(outgoing_links.len(), 1);
            }
        }));
    }

    for task in tasks {
        task.await.expect("worker task should finish");
    }
}
