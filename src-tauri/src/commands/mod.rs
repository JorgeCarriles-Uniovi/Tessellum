pub mod folders;
pub mod links;
pub mod notes;
pub mod vault;
pub mod watcher;
pub mod indexer;

pub use folders::create_folder;
pub use links::{extract_wikilinks, get_backlinks, get_outgoing_links, get_all_links};
pub use notes::{create_note, read_file, trash_item, write_file, get_all_notes};
pub use vault::{list_files, rename_file};
pub use watcher::watch_vault;
