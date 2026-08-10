import { describe, expect, test } from "vitest";
import { resolveGhostNodeTarget } from "./graphNodeActions";

describe("resolveGhostNodeTarget", () => {
    test("classifies a missing media asset as media so no .md file is created", () => {
        // BUG-U3: `title` used to come out as "Diagram.png" (the .md strip is a
        // no-op), and create_note appended .md — producing Diagram.png.md.
        expect(resolveGhostNodeTarget("Diagram.png", "/vault")).toEqual({ kind: "media" });
        expect(resolveGhostNodeTarget("assets/Chart.SVG", "/vault")).toEqual({ kind: "media" });
        expect(resolveGhostNodeTarget("clip.mp4", "/vault")).toEqual({ kind: "media" });
        expect(resolveGhostNodeTarget("spec.pdf", "/vault")).toEqual({ kind: "media" });
    });

    test("preserves the folder prefix for a nested ghost note", () => {
        expect(resolveGhostNodeTarget("Projects/Idea", "/vault")).toEqual({
            kind: "note",
            title: "Idea",
            targetDir: "/vault/Projects",
        });
        expect(resolveGhostNodeTarget("a/b/c/Deep.md", "/vault")).toEqual({
            kind: "note",
            title: "Deep",
            targetDir: "/vault/a/b/c",
        });
    });

    test("puts a root-level ghost note at the vault root", () => {
        expect(resolveGhostNodeTarget("Idea", "/vault")).toEqual({
            kind: "note",
            title: "Idea",
            targetDir: "/vault",
        });
    });

    test("normalizes windows separators in the node id", () => {
        expect(resolveGhostNodeTarget("Projects\\Idea.md", "C:/vault")).toEqual({
            kind: "note",
            title: "Idea",
            targetDir: "C:/vault/Projects",
        });
    });

    test("rejects a node id that would resolve outside the vault", () => {
        // BUG: a note-content-driven wikilink target (e.g. [[../../Documents/pwned]])
        // must never join `..` segments onto vaultPath — that would write a
        // file outside the vault via createNoteInDir/create_note.
        expect(resolveGhostNodeTarget("../../Documents/pwned", "/vault")).toEqual({ kind: "rejected" });
        expect(resolveGhostNodeTarget("..\\..\\Documents\\pwned", "/vault")).toEqual({ kind: "rejected" });
        // A bare ".." segment mid-path is just as unsafe.
        expect(resolveGhostNodeTarget("Projects/../Secret/pwned", "/vault")).toEqual({ kind: "rejected" });
        // Absolute paths must never be joined onto vaultPath either.
        expect(resolveGhostNodeTarget("/etc/passwd", "/vault")).toEqual({ kind: "rejected" });
        expect(resolveGhostNodeTarget("\\\\server\\share\\file", "/vault")).toEqual({ kind: "rejected" });
        expect(resolveGhostNodeTarget("C:/Windows/System32/evil", "C:/vault")).toEqual({ kind: "rejected" });
        expect(resolveGhostNodeTarget("C:\\Windows\\System32\\evil", "C:/vault")).toEqual({ kind: "rejected" });

        // Legitimate nested targets must still resolve normally.
        expect(resolveGhostNodeTarget("Projects/Idea", "/vault")).toEqual({
            kind: "note",
            title: "Idea",
            targetDir: "/vault/Projects",
        });
    });

    test("strips only a trailing .md, case-insensitively", () => {
        expect(resolveGhostNodeTarget("Notes.MD", "/vault")).toEqual({
            kind: "note",
            title: "Notes",
            targetDir: "/vault",
        });
        // A dotted title that is not a media extension stays intact.
        expect(resolveGhostNodeTarget("v1.2.plan", "/vault")).toEqual({
            kind: "note",
            title: "v1.2.plan",
            targetDir: "/vault",
        });
    });
});
