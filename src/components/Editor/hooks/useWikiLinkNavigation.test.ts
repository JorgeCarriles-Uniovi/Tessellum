import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import "../../../test/tauriMocks";
import { trackStores } from "../../../test/storeIsolation";
import { useVaultStore } from "../../../stores";
import { useWikiLinkNavigation } from "./useWikiLinkNavigation";
import type { FileMetadata } from "../../../types";

const noteUtilsMocks = vi.hoisted(() => ({
    createNoteInDir: vi.fn(),
}));

vi.mock("../../../utils/noteUtils", () => ({
    createNoteInDir: noteUtilsMocks.createNoteInDir,
}));

function makeFile(path: string, filename: string): FileMetadata {
    return {
        path,
        filename,
        is_dir: false,
        size: 0,
        last_modified: 0,
    };
}

describe("useWikiLinkNavigation", () => {
    beforeEach(() => {
        trackStores(useVaultStore);
        noteUtilsMocks.createNoteInDir.mockReset();
        noteUtilsMocks.createNoteInDir.mockResolvedValue(makeFile("vault/new-note.md", "new-note.md"));
    });

    test("clicking a wikilink to an existing .html file opens it instead of creating a note", async () => {
        const activeNote = makeFile("vault/Home.md", "Home.md");
        const existingHtmlFile = makeFile("vault/page.html", "page.html");

        useVaultStore.setState({
            activeNote,
            files: [activeNote, existingHtmlFile],
        });

        const { result } = renderHook(() => useWikiLinkNavigation());

        await act(async () => {
            await result.current("page.html");
        });

        expect(useVaultStore.getState().activeNote).toEqual(existingHtmlFile);
        expect(noteUtilsMocks.createNoteInDir).not.toHaveBeenCalled();
    });
});
