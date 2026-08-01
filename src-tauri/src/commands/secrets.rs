use crate::error::TessellumError;

const KEYRING_SERVICE: &str = "dev.tessellum.app";
const MAX_KEY_LEN: usize = 64;

/// Reject keys that are not simple identifiers.
///
/// The key becomes the keychain "username" for our service entry, so an
/// unvalidated value could collide with — or shadow — another entry. Keeping
/// it to a short identifier charset makes entries predictable and auditable.
fn validate_key(key: &str) -> Result<(), TessellumError> {
	if key.is_empty() || key.len() > MAX_KEY_LEN {
		return Err(TessellumError::Validation(
			"Secret key must be 1-64 characters".to_string(),
		));
	}
	if !key
		.chars()
		.all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
	{
		return Err(TessellumError::Validation(
			"Secret key may only contain letters, digits, '.', '_' and '-'".to_string(),
		));
	}
	Ok(())
}

fn entry(key: &str) -> Result<keyring::Entry, TessellumError> {
	keyring::Entry::new(KEYRING_SERVICE, key)
		.map_err(|e| TessellumError::Internal(format!("Credential store unavailable: {}", e)))
}

#[tauri::command]
pub async fn secret_set(key: String, value: String) -> Result<(), TessellumError> {
	validate_key(&key)?;
	entry(&key)?
		.set_password(&value)
		.map_err(|e| TessellumError::Internal(format!("Failed to store secret '{}': {}", key, e)))
}

#[tauri::command]
pub async fn secret_get(key: String) -> Result<Option<String>, TessellumError> {
	validate_key(&key)?;
	match entry(&key)?.get_password() {
		Ok(value) => Ok(Some(value)),
		Err(keyring::Error::NoEntry) => Ok(None),
		Err(e) => Err(TessellumError::Internal(format!(
			"Failed to read secret '{}': {}",
			key, e
		))),
	}
}

#[tauri::command]
pub async fn secret_delete(key: String) -> Result<(), TessellumError> {
	validate_key(&key)?;
	match entry(&key)?.delete_credential() {
		Ok(()) => Ok(()),
		// Deleting something that is not there is the desired end state.
		Err(keyring::Error::NoEntry) => Ok(()),
		Err(e) => Err(TessellumError::Internal(format!(
			"Failed to delete secret '{}': {}",
			key, e
		))),
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn validate_key_accepts_dotted_identifiers() {
		assert!(validate_key("sync.password").is_ok());
		assert!(validate_key("ai.api_key").is_ok());
		assert!(validate_key("a-b_c.1").is_ok());
	}

	#[test]
	fn validate_key_rejects_empty_oversized_and_exotic_keys() {
		assert!(validate_key("").is_err());
		assert!(validate_key(&"x".repeat(MAX_KEY_LEN + 1)).is_err());
		assert!(validate_key("sync password").is_err());
		assert!(validate_key("sync/password").is_err());
		assert!(validate_key("sync:password").is_err());
		assert!(validate_key("sync\npassword").is_err());
	}

	/// Guarantees the real-credential-store entry created by the round-trip
	/// test below is removed even if an assertion between `secret_set` and
	/// `secret_delete` panics. Without this, a failed test run would leave a
	/// stray entry permanently in the developer's or CI runner's keychain.
	///
	/// `Drop` cannot be `async` and cannot fail, so this deletes via the raw
	/// `keyring::Entry` directly (not the async `secret_delete` command) and
	/// swallows any error, including `NoEntry` — which just means the test's
	/// own `secret_delete` call already cleaned up.
	struct CredentialCleanupGuard {
		key: &'static str,
	}

	impl Drop for CredentialCleanupGuard {
		fn drop(&mut self) {
			if let Ok(e) = keyring::Entry::new(KEYRING_SERVICE, self.key) {
				let _ = e.delete_credential();
			}
		}
	}

	#[tokio::test]
	async fn set_get_delete_round_trips_through_the_credential_store() {
		// Uses the real platform credential store; the key is namespaced so it
		// cannot collide with a developer's actual Tessellum entries.
		let key = "test.roundtrip-do-not-use";
		let _cleanup = CredentialCleanupGuard { key };

		secret_set(key.to_string(), "hunter2".to_string()).await.unwrap();
		assert_eq!(secret_get(key.to_string()).await.unwrap(), Some("hunter2".to_string()));

		secret_delete(key.to_string()).await.unwrap();
		assert_eq!(secret_get(key.to_string()).await.unwrap(), None);

		// Deleting an absent entry is a no-op, not an error.
		secret_delete(key.to_string()).await.unwrap();
	}

	#[tokio::test]
	async fn invalid_keys_are_rejected_before_touching_the_store() {
		assert!(secret_set("bad key".to_string(), "v".to_string()).await.is_err());
		assert!(secret_get("bad key".to_string()).await.is_err());
		assert!(secret_delete("bad key".to_string()).await.is_err());
	}
}
