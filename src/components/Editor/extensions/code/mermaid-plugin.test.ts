import { beforeEach, describe, expect, test, vi } from "vitest";

const initializeMock = vi.fn();

vi.mock("mermaid", () => ({
    default: {
        initialize: initializeMock,
        render: vi.fn(async () => ({ svg: "<svg></svg>" })),
    },
}));

describe("mermaid-plugin", () => {
    beforeEach(() => {
        initializeMock.mockClear();
        vi.resetModules();
    });

    test("pins securityLevel to strict so diagram labels are always sanitized", async () => {
        const { createMermaidPlugin } = await import("./mermaid-plugin");
        createMermaidPlugin();

        expect(initializeMock).toHaveBeenCalled();
        const config = initializeMock.mock.calls[0][0];
        expect(config.securityLevel).toBe("strict");
        expect(config.startOnLoad).toBe(false);
    });
});
