pub mod folders;
pub mod graph;
pub mod indexer;
pub mod links;
pub mod notes;
pub mod vault;
pub mod watcher;

pub use folders::create_folder;
pub use graph::get_graph_data;
pub use links::{
	extract_wikilinks, get_all_links, get_backlinks, get_outgoing_links, resolve_wikilink,
};
pub use notes::{
	create_note, get_all_notes, get_all_property_keys, get_all_tags, read_file, search_notes,
	trash_item, write_file,
};
pub use vault::{list_files, list_files_tree, rename_file, set_vault_path};
pub use watcher::watch_vault;
