import { invoke } from "@tauri-apps/api/core";

/**
 * Logical names for secrets held in the OS credential store.
 *
 * These are never written to localStorage. The backend (`commands/secrets.rs`)
 * uses the name as the keychain entry's username under the Tessellum service.
 */
export const SECRET_KEYS = {
    syncPassword: "sync.password",
    aiApiKey: "ai.api_key",
} as const;

export type SecretKey = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];

/**
 * Store a secret. An empty value deletes the entry instead of storing "".
 *
 * Resolves to `true` on success and `false` on failure (credential store
 * unavailable, locked keyring, etc.) instead of throwing — a rejection here
 * used to become an unhandled promise rejection at every call site, which
 * silently discarded the write. Callers must check the result and tell the
 * user, since (unlike a failed read) a failed write has no fallback: the
 * credential is not persisted anywhere else. Never log or surface `value`
 * itself, only the fact of failure.
 */
export async function setSecret(key: string, value: string): Promise<boolean> {
    if (!value) {
        return deleteSecret(key);
    }
    try {
        await invoke("secret_set", { key, value });
        return true;
    } catch (error) {
        console.error(`Failed to store secret '${key}':`, error);
        return false;
    }
}

/**
 * Read a secret. Resolves to `null` when absent — and also when the platform
 * credential store is unavailable, so a locked keyring degrades to "no
 * credential configured" rather than breaking the settings screen.
 */
export async function getSecret(key: string): Promise<string | null> {
    try {
        return (await invoke<string | null>("secret_get", { key })) ?? null;
    } catch (error) {
        console.error(`Failed to read secret '${key}':`, error);
        return null;
    }
}

/** Resolves to `true` on success and `false` on failure, without throwing. */
export async function deleteSecret(key: string): Promise<boolean> {
    try {
        await invoke("secret_delete", { key });
        return true;
    } catch (error) {
        console.error(`Failed to delete secret '${key}':`, error);
        return false;
    }
}

interface MigratePlaintextSecretOptions {
    /** localStorage key holding the persisted zustand blob. */
    storageKey: string;
    /** Keychain name to move the secret to. */
    secretKey: string;
    /** Pull the plaintext secret out of the parsed blob, if present. */
    extract: (parsed: unknown) => string | undefined;
    /** Return the blob with the secret field removed. May mutate. */
    strip: (parsed: unknown) => unknown;
}

/**
 * One-time upgrade path for secrets persisted in plaintext by earlier versions.
 *
 * Moves the value into the credential store and rewrites the localStorage blob
 * without it, so the plaintext copy does not survive the upgrade. Returns the
 * migrated value so the caller can seed its in-memory state without a second
 * round trip. Any failure leaves localStorage untouched and returns null.
 */
export async function migratePlaintextSecret({
    storageKey,
    secretKey,
    extract,
    strip,
}: MigratePlaintextSecretOptions): Promise<string | null> {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        // A corrupted blob is zustand's problem, not ours — leave it alone.
        return null;
    }

    const secret = extract(parsed);
    if (!secret) return null;

    try {
        await invoke("secret_set", { key: secretKey, value: secret });
    } catch (error) {
        console.error(`Failed to migrate secret '${secretKey}' to the credential store:`, error);
        return null;
    }

    try {
        localStorage.setItem(storageKey, JSON.stringify(strip(parsed)));
    } catch (error) {
        console.error(`Failed to purge plaintext secret from '${storageKey}':`, error);
    }

    return secret;
}
