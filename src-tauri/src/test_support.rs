use std::fs;
use std::path::Path;
use tempfile::{tempdir, TempDir};

pub(crate) struct TestVaultBuilder {
    markdown_files: Vec<(String, String)>,
}

pub(crate) struct TestVault {
    root: TempDir,
}

impl TestVault {
    pub(crate) fn new() -> TestVaultBuilder {
        TestVaultBuilder {
            markdown_files: Vec::new(),
        }
    }

    pub(crate) fn path(&self) -> &Path {
        self.root.path()
    }
}

impl TestVaultBuilder {
    pub(crate) fn with_markdown(mut self, relative_path: &str, content: &str) -> Self {
        self.markdown_files
            .push((relative_path.to_string(), content.to_string()));
        self
    }

    pub(crate) fn build(self) -> TestVault {
        let root = tempdir().expect("temp vault should be created");

        for (relative_path, content) in self.markdown_files {
            let full_path = root.path().join(relative_path);
            if let Some(parent) = full_path.parent() {
                fs::create_dir_all(parent).expect("parent directories should be created");
            }
            fs::write(full_path, content).expect("seed markdown file should be written");
        }

        TestVault { root }
    }
}

#[cfg(test)]
mod tests {
    use super::TestVault;
    use crate::utils::validate_path_in_vault;

    #[test]
    fn seeded_vault_builder_creates_expected_files() {
        let vault = TestVault::new()
            .with_markdown("Inbox/Note.md", "# Note")
            .build();

        assert!(vault.path().join("Inbox/Note.md").exists());
    }

    #[test]
    fn seeded_vault_paths_validate_inside_the_vault() {
        let vault = TestVault::new()
            .with_markdown("Inbox/Note.md", "# Note")
            .build();
        let note_path = vault.path().join("Inbox/Note.md");

        let validated = validate_path_in_vault(
            note_path.to_str().unwrap(),
            vault.path().to_str().unwrap(),
        );

        assert!(validated.is_ok());
    }
}
