import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { trackStore } from "../test/storeIsolation";
import { useSettingsStore } from "../stores/settingsStore";
import { useApplySpellCheckSettings } from "./useApplySpellCheckSettings";

describe("useApplySpellCheckSettings", () => {
    beforeEach(() => {
        trackStore(useSettingsStore);
        document.body.innerHTML = "";
        vi.useRealTimers();
    });

    test("applies spellcheck to managed root descendants and reacts to store changes", async () => {
        document.body.innerHTML = `
            <div id="root">
                <textarea id="notes"></textarea>
                <input id="search" type="search" />
                <div id="editable"></div>
                <input id="checkbox" type="checkbox" />
            </div>
        `;

        act(() => {
            useSettingsStore.getState().setSpellCheck(false);
        });
        const textarea = document.getElementById("notes") as HTMLTextAreaElement;
        const search = document.getElementById("search") as HTMLInputElement;
        const editable = document.getElementById("editable") as HTMLElement;
        const checkbox = document.getElementById("checkbox") as HTMLInputElement;
        editable.setAttribute("contenteditable", "true");
        Object.defineProperty(editable, "isContentEditable", {
            configurable: true,
            value: true,
        });

        renderHook(() => useApplySpellCheckSettings());

        expect(textarea.getAttribute("spellcheck")).toBe("false");
        expect(search.getAttribute("spellcheck")).toBe("false");
        expect(editable.getAttribute("spellcheck")).toBe("false");
        expect(checkbox.getAttribute("spellcheck")).toBeNull();

        act(() => {
            useSettingsStore.getState().setSpellCheck(true);
        });

        await waitFor(() => {
            expect(textarea.getAttribute("spellcheck")).toBe("true");
            expect(search.getAttribute("spellcheck")).toBe("true");
            expect(editable.getAttribute("spellcheck")).toBe("true");
        });
    });

    test("applies spellcheck to added nodes and editor-surface attribute mutations", async () => {
        document.body.innerHTML = `<div id="root"><input class="cm-editor" id="editor" type="text" /></div>`;

        act(() => {
            useSettingsStore.getState().setSpellCheck(true);
        });
        renderHook(() => useApplySpellCheckSettings());

        const root = document.getElementById("root") as HTMLElement;
        const textarea = document.createElement("textarea");

        act(() => {
            root.appendChild(textarea);
        });

        await waitFor(() => {
            expect(textarea.getAttribute("spellcheck")).toBe("true");
        });

        const editor = document.getElementById("editor") as HTMLInputElement;
        act(() => {
            editor.setAttribute("type", "search");
        });

        await waitFor(() => {
            expect(editor.getAttribute("spellcheck")).toBe("true");
        });
    });

    test("uses the document fallback before root exists and retries observer attachment", async () => {
        vi.useFakeTimers();

        const floatingTextarea = document.createElement("textarea");
        document.body.appendChild(floatingTextarea);

        act(() => {
            useSettingsStore.getState().setSpellCheck(true);
        });
        renderHook(() => useApplySpellCheckSettings());

        expect(floatingTextarea.getAttribute("spellcheck")).toBe("true");

        const root = document.createElement("div");
        root.id = "root";
        document.body.appendChild(root);

        act(() => {
            vi.advanceTimersByTime(50);
        });

        const delayedInput = document.createElement("textarea");
        act(() => {
            root.appendChild(delayedInput);
        });

        await act(async () => {
            await Promise.resolve();
        });

        expect(delayedInput.getAttribute("spellcheck")).toBe("true");
    });
});
