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
