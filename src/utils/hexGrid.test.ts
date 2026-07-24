// src/utils/hexGrid.test.ts
import { describe, expect, it } from "vitest";
import { packHexClusters, neighborsOf, HEX_TILE_WIDTH, HEX_TILE_HEIGHT } from "./hexGrid";

function isConnected(cells: { row: number; col: number }[]): boolean {
    if (cells.length <= 1) return true;
    const key = (c: { row: number; col: number }) => `${c.row},${c.col}`;
    const set = new Set(cells.map(key));
    const seen = new Set([key(cells[0])]);
    const queue = [cells[0]];
    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const n of neighborsOf(cur)) {
            const k = key(n);
            if (set.has(k) && !seen.has(k)) {
                seen.add(k);
                queue.push(n);
            }
        }
    }
    return seen.size === cells.length;
}

describe("packHexClusters", () => {
    it("places every item in a single bucket as one connected region with unique cells", () => {
        const bucket = { items: ["a", "b", "c", "d", "e", "f", "g"] };
        const { tiles } = packHexClusters([bucket]);
        expect(tiles).toHaveLength(7);
        const cellStrings = tiles.map((t) => `${t.row},${t.col}`);
        expect(new Set(cellStrings).size).toBe(7); // no collisions
        expect(isConnected(tiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
    });

    it("gives each of two buckets its own contiguous region with no cell collisions, forming one combined mosaic", () => {
        const bucketA = { items: ["a1", "a2", "a3", "a4", "a5"] };
        const bucketB = { items: ["b1", "b2", "b3"] };
        const { tiles } = packHexClusters([bucketA, bucketB]);
        expect(tiles).toHaveLength(8);

        const aTiles = tiles.filter((t) => t.item.startsWith("a"));
        const bTiles = tiles.filter((t) => t.item.startsWith("b"));
        expect(isConnected(aTiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
        expect(isConnected(bTiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);

        const allCells = tiles.map((t) => `${t.row},${t.col}`);
        expect(new Set(allCells).size).toBe(8); // no cross-bucket collisions

        // The whole layout (both buckets together) is one connected mosaic.
        expect(isConnected(tiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
    });

    it("converts grid cells to pixel coordinates with the design's exact geometry, normalized to start at (0, 0)", () => {
        const { tiles, width, height } = packHexClusters([{ items: ["solo"] }]);
        expect(tiles).toHaveLength(1);
        // A single tile's own cell becomes the origin after normalization.
        expect(tiles[0].x).toBeCloseTo((88 - HEX_TILE_WIDTH) / 2, 5);
        expect(tiles[0].y).toBeCloseTo((88 * 1.1547 - HEX_TILE_HEIGHT) / 2, 1);
        expect(width).toBeCloseTo(88, 5);
        expect(height).toBeCloseTo(88 * 1.1547, 1);
    });

    it("returns an empty layout for no buckets", () => {
        const { tiles, width, height } = packHexClusters([]);
        expect(tiles).toEqual([]);
        expect(width).toBe(0);
        expect(height).toBe(0);
    });
});
