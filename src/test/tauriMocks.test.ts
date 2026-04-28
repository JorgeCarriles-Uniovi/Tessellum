import { describe, expect, it } from "vitest";
import { existsMock, invokeMock, resetTauriMocks } from "./tauriMocks";

describe("tauriMocks", () => {
    it("resets mocked Tauri behaviors to deterministic defaults", async () => {
        invokeMock.mockResolvedValueOnce("ok");
        existsMock.mockResolvedValueOnce(true);

        await expect(invokeMock("command", {})).resolves.toBe("ok");
        await expect(existsMock("vault")).resolves.toBe(true);

        resetTauriMocks();

        await expect(invokeMock("command", {})).resolves.toBeUndefined();
        await expect(existsMock("vault")).resolves.toBe(false);
    });
});
