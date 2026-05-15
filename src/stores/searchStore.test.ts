import { describe, expect, test, vi } from "vitest";
import { invokeMock } from "../test/tauriMocks";
import { trackStore } from "../test/storeIsolation";

async function importSearchStore() {
    vi.resetModules();
    return import("./searchStore");
}

describe("searchStore", () => {
    test("falls back from invalid recent-search storage and deduplicates capped entries", async () => {
        localStorage.setItem("tessellum:search:recent", "not-json");

        const { useSearchStore } = await importSearchStore();
        trackStore(useSearchStore);

        expect(useSearchStore.getState().recentSearches).toEqual([]);

        useSearchStore.getState().addRecentSearch(" Rust ");
        useSearchStore.getState().addRecentSearch("rust");
        [
            "graph",
            "design",
            "notes",
            "daily",
            "vault",
            "cypher",
            "outline",
        ].forEach((query) => useSearchStore.getState().addRecentSearch(query));

        expect(useSearchStore.getState().recentSearches).toEqual([
            "outline",
            "cypher",
            "vault",
            "daily",
            "notes",
            "design",
            "graph",
        ]);
    });

    test("loads and stores vault-specific recent searches", async () => {
        const { useSearchStore } = await importSearchStore();
        trackStore(useSearchStore);

        useSearchStore.getState().setRecentSearches(["one", "two", "three"], "/vault-a");
        useSearchStore.getState().loadRecentSearches("/vault-a");
        expect(useSearchStore.getState().recentSearches).toEqual(["one", "two", "three"]);

        localStorage.setItem(
            "tessellum:search:recent:/vault-b",
            JSON.stringify(["remote"]),
        );
        useSearchStore.getState().loadRecentSearches("/vault-b");
        expect(useSearchStore.getState().recentSearches).toEqual(["remote"]);
    });

    test("uses single-flight readiness sync per vault path", async () => {
        const { useSearchStore } = await importSearchStore();
        trackStore(useSearchStore);

        let resolvePayload: ((value: {
            status: "ready";
            attempt_count: number;
            max_attempts: number;
            retry_delay_ms: number;
            reopen_required: boolean;
            last_error: null;
        }) => void) | null = null;

        invokeMock.mockImplementation((command) => {
            if (command === "get_search_readiness") {
                return new Promise((resolve) => {
                    resolvePayload = resolve;
                });
            }
            return Promise.reject(new Error(`Unexpected command ${String(command)}`));
        });

        const first = useSearchStore.getState().syncReadiness("/vault");
        const second = useSearchStore.getState().syncReadiness("/vault");

        expect(invokeMock).toHaveBeenCalledTimes(1);

        resolvePayload?.({
            status: "ready",
            attempt_count: 2,
            max_attempts: 5,
            retry_delay_ms: 1000,
            reopen_required: false,
            last_error: null,
        });
        await Promise.all([first, second]);

        expect(useSearchStore.getState()).toMatchObject({
            readinessStatus: "ready",
            readinessAttemptCount: 2,
            readinessMaxAttempts: 5,
            readinessRetryDelayMs: 1000,
            readinessReopenRequired: false,
            readinessLastError: null,
        });
    });

    test("treats empty vault paths as no-ops and resets readiness before ensuring", async () => {
        const { useSearchStore } = await importSearchStore();
        trackStore(useSearchStore);

        await useSearchStore.getState().syncReadiness("");
        await useSearchStore.getState().ensureReadiness("");
        await useSearchStore.getState().resetAndEnsureReadiness("");
        expect(invokeMock).not.toHaveBeenCalled();

        invokeMock
            .mockResolvedValueOnce({
                status: "warming",
                attempt_count: 1,
                max_attempts: 10,
                retry_delay_ms: 5000,
                reopen_required: false,
                last_error: "warming",
            })
            .mockResolvedValueOnce({
                status: "ready",
                attempt_count: 2,
                max_attempts: 10,
                retry_delay_ms: 5000,
                reopen_required: false,
                last_error: null,
            });

        await useSearchStore.getState().resetAndEnsureReadiness("/vault");

        expect(invokeMock.mock.calls.map(([command]) => command)).toEqual([
            "reset_search_readiness_attempts",
            "ensure_search_ready",
        ]);
        expect(useSearchStore.getState()).toMatchObject({
            readinessStatus: "ready",
            readinessAttemptCount: 2,
            readinessLastError: null,
        });
    });
});
