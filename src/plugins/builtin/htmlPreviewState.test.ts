import { beforeEach, describe, expect, test } from "vitest";
import { isHtmlPreviewEnabled, setHtmlPreviewEnabled } from "./htmlPreviewState";

describe("html preview state", () => {
    beforeEach(() => {
        setHtmlPreviewEnabled(false);
    });

    test("defaults to disabled until a plugin enables it", () => {
        expect(isHtmlPreviewEnabled()).toBe(false);
    });

    test("reflects the most recently set value", () => {
        setHtmlPreviewEnabled(true);
        expect(isHtmlPreviewEnabled()).toBe(true);

        setHtmlPreviewEnabled(false);
        expect(isHtmlPreviewEnabled()).toBe(false);
    });
});
