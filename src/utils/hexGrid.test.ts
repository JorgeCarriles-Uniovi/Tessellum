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

    it("never silently drops items when a later bucket's seed gets boxed in by earlier buckets", () => {
        // Bucket sizes found by brute-force search: with these exact sizes,
        // the 4th bucket's seed cell ends up fully surrounded by cells the
        // first three buckets already occupy, so its own local BFS frontier
        // runs dry after placing only its first item. Before the fix this
        // silently dropped every item after that point with no error.
        const sizes = [11, 16, 17, 2];
        const buckets = sizes.map((size, bucketIndex) => ({
            items: Array.from({ length: size }, (_, itemIndex) => `b${bucketIndex}-${itemIndex}`),
        }));
        const totalItems = sizes.reduce((sum, size) => sum + size, 0);

        const { tiles } = packHexClusters(buckets);

        expect(tiles).toHaveLength(totalItems);
        const cellStrings = tiles.map((t) => `${t.row},${t.col}`);
        expect(new Set(cellStrings).size).toBe(totalItems); // still no collisions
        // Every item from every bucket made it into the layout exactly once.
        const placedItems = new Set(tiles.map((t) => t.item));
        expect(placedItems.size).toBe(totalItems);
        // The whole layout remains one connected mosaic even with the
        // boxed-in fallback in play.
        expect(isConnected(tiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
    });

    it("skips an empty bucket in the middle of the list without affecting the surrounding buckets", () => {
        const bucketA = { items: ["a1", "a2", "a3"] };
        const bucketEmpty = { items: [] as string[] };
        const bucketB = { items: ["b1", "b2"] };

        const { tiles } = packHexClusters([bucketA, bucketEmpty, bucketB]);
        expect(tiles).toHaveLength(5);

        const aTiles = tiles.filter((t) => t.item.startsWith("a"));
        const bTiles = tiles.filter((t) => t.item.startsWith("b"));
        expect(aTiles).toHaveLength(3);
        expect(bTiles).toHaveLength(2);
        expect(isConnected(aTiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
        expect(isConnected(bTiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);

        const allCells = tiles.map((t) => `${t.row},${t.col}`);
        expect(new Set(allCells).size).toBe(5);
        expect(isConnected(tiles.map((t) => ({ row: t.row, col: t.col })))).toBe(true);
    });
});
