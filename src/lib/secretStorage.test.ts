import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock } from "../test/tauriMocks";
import { deleteSecret, getSecret, migratePlaintextSecret, setSecret, SECRET_KEYS } from "./secretStorage";

describe("secretStorage", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        localStorage.clear();
    });

    test("routes reads and writes through the keychain commands", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await setSecret(SECRET_KEYS.syncPassword, "hunter2");
        expect(invokeMock).toHaveBeenCalledWith("secret_set", {
            key: "sync.password",
            value: "hunter2",
        });

        invokeMock.mockResolvedValueOnce("hunter2");
        await expect(getSecret(SECRET_KEYS.syncPassword)).resolves.toBe("hunter2");

        invokeMock.mockResolvedValueOnce(undefined);
        await deleteSecret(SECRET_KEYS.syncPassword);
        expect(invokeMock).toHaveBeenLastCalledWith("secret_delete", { key: "sync.password" });
    });

    test("an empty value deletes rather than storing an empty secret", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await setSecret(SECRET_KEYS.aiApiKey, "");
        expect(invokeMock).toHaveBeenCalledWith("secret_delete", { key: "ai.api_key" });
    });

    test("a keychain read failure resolves to null instead of throwing", async () => {
        invokeMock.mockRejectedValueOnce(new Error("Credential store unavailable"));
        await expect(getSecret(SECRET_KEYS.aiApiKey)).resolves.toBeNull();
    });

    test("migrates a plaintext secret into the keychain and purges it from localStorage", async () => {
        localStorage.setItem(
            "tessellum:sync",
            JSON.stringify({ state: { config: { remoteUrl: "https://git", password: "leaked" } }, version: 0 })
        );
        invokeMock.mockResolvedValueOnce(undefined);

        const migrated = await migratePlaintextSecret({
            storageKey: "tessellum:sync",
            secretKey: SECRET_KEYS.syncPassword,
            extract: (parsed) => (parsed as { state?: { config?: { password?: string } } })?.state?.config?.password,
            strip: (parsed) => {
                const blob = parsed as { state?: { config?: Record<string, unknown> } };
                if (blob?.state?.config) delete blob.state.config.password;
                return blob;
            },
        });

        expect(migrated).toBe("leaked");
        expect(invokeMock).toHaveBeenCalledWith("secret_set", { key: "sync.password", value: "leaked" });
        expect(localStorage.getItem("tessellum:sync")).not.toContain("leaked");
        expect(localStorage.getItem("tessellum:sync")).toContain("https://git");
    });

    test("migration is a no-op when there is nothing stored or nothing to migrate", async () => {
        await expect(
            migratePlaintextSecret({
                storageKey: "tessellum:sync",
                secretKey: SECRET_KEYS.syncPassword,
                extract: () => undefined,
                strip: (p) => p,
            })
        ).resolves.toBeNull();

        localStorage.setItem("tessellum:sync", "{not json");
        await expect(
            migratePlaintextSecret({
                storageKey: "tessellum:sync",
                secretKey: SECRET_KEYS.syncPassword,
                extract: () => undefined,
                strip: (p) => p,
            })
        ).resolves.toBeNull();

        expect(invokeMock).not.toHaveBeenCalled();
    });
});
