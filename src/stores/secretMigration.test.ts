import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock } from "../test/tauriMocks";
import { useSyncStore, hydrateSyncSecret } from "./syncStore";
import { useAIStore, hydrateAiSecret } from "./aiStore";

describe("credential persistence", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        localStorage.clear();
    });

    test("syncStore never persists the password to localStorage", () => {
        useSyncStore.getState().setConfig({ remoteUrl: "https://git", password: "hunter2" });

        const persisted = localStorage.getItem("tessellum:sync") ?? "";
        expect(persisted).toContain("https://git");
        expect(persisted).not.toContain("hunter2");
        expect(persisted).not.toContain("password");
        // The in-memory value is still usable for the current session.
        expect(useSyncStore.getState().config.password).toBe("hunter2");
    });

    test("aiStore never persists the api key to localStorage", () => {
        useAIStore.getState().setProviderConfig({ kind: "openai", api_key: "sk-secret" });

        const persisted = localStorage.getItem("tessellum:ai") ?? "";
        expect(persisted).toContain("openai");
        expect(persisted).not.toContain("sk-secret");
        expect(persisted).not.toContain("api_key");
        expect(useAIStore.getState().providerConfig.api_key).toBe("sk-secret");
    });

    test("hydrateSyncSecret loads the password from the keychain into memory", async () => {
        invokeMock.mockResolvedValue("from-keychain");
        await hydrateSyncSecret();
        expect(useSyncStore.getState().config.password).toBe("from-keychain");
    });

    test("hydrateAiSecret loads the api key from the keychain into memory", async () => {
        invokeMock.mockResolvedValue("sk-from-keychain");
        await hydrateAiSecret();
        expect(useAIStore.getState().providerConfig.api_key).toBe("sk-from-keychain");
    });

    test("hydrateSyncSecret migrates a legacy plaintext password and purges it", async () => {
        localStorage.setItem(
            "tessellum:sync",
            JSON.stringify({ state: { config: { remoteUrl: "https://git", password: "legacy" } }, version: 0 })
        );
        invokeMock.mockResolvedValue(undefined);

        await hydrateSyncSecret();

        expect(invokeMock).toHaveBeenCalledWith("secret_set", { key: "sync.password", value: "legacy" });
        expect(localStorage.getItem("tessellum:sync")).not.toContain("legacy");
        expect(useSyncStore.getState().config.password).toBe("legacy");
    });
});
