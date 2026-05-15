import { describe, expect, it } from "vitest";
import type { FileMetadata, TreeNode } from "../../../types";
import {
    findPreviousOpenNote,
    normalizeDeleteTargets,
    pruneTreeByTargets,
    summarizeFailedTargets,
} from "./deleteFileLogic";

function createFile(path: string, isDir = false): FileMetadata {
    const parts = path.split(/[\\/]/);
    return {
        path,
        filename: parts[parts.length - 1],
        is_dir: isDir,
        size: 0,
        last_modified: 0,
    };
}

function createNode(path: string, children: TreeNode[] = []): TreeNode {
    return {
        id: path,
        name: path.split(/[\\/]/).at(-1) ?? path,
        is_dir: true,
        children,
        file: createFile(path, true),
    };
}

describe("deleteFileLogic", () => {
    it("removes descendants when a folder target is present", () => {
        const result = normalizeDeleteTargets([
            createFile("vault/folder", true),
            createFile("vault/folder/note.md"),
            createFile("vault/other.md"),
        ]);

        expect(result.map((target) => target.path)).toEqual([
            "vault/folder",
            "vault/other.md",
        ]);
    });

    it("finds the nearest previous open note that is not being removed", () => {
        const files = [
            createFile("vault/a.md"),
            createFile("vault/b.md"),
            createFile("vault/c.md"),
        ];
        const targets = [createFile("vault/c.md")];

        const result = findPreviousOpenNote(
            "vault/c.md",
            ["vault/a.md", "vault/b.md", "vault/c.md"],
            files,
            targets,
        );

        expect(result?.path).toBe("vault/b.md");
    });

    it("prunes removed nodes and summarizes more than three failed targets", () => {
        const nodes = [
            createNode("vault/folder", [
                {
                    id: "vault/folder/note.md",
                    name: "note.md",
                    is_dir: false,
                    children: [],
                    file: createFile("vault/folder/note.md"),
                },
            ]),
            createNode("vault/keep"),
        ];
        const pruned = pruneTreeByTargets(nodes, [createFile("vault/folder", true)]);

        expect(pruned.map((node) => node.id)).toEqual(["vault/keep"]);
        expect(
            summarizeFailedTargets([
                createFile("vault/A.md"),
                createFile("vault/B.md"),
                createFile("vault/C.md"),
                createFile("vault/D.md"),
            ]),
        ).toBe("A.md, B.md, C.md and 1 more");
    });
});
