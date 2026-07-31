// src/utils/hexGrid.ts

export const HEX_CLIP_PATH = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";

const CELL_WIDTH = 88;
const CELL_HEIGHT = CELL_WIDTH * 1.1547;
const ROW_STEP = CELL_HEIGHT * 0.75;
const COLUMN_OFFSET = CELL_WIDTH / 2;

export const HEX_TILE_WIDTH = 81;
export const HEX_TILE_HEIGHT = 93;

const INSET_X = (CELL_WIDTH - HEX_TILE_WIDTH) / 2;
const INSET_Y = (CELL_HEIGHT - HEX_TILE_HEIGHT) / 2;

interface HexCell {
    row: number;
    col: number;
}

function cellKey(cell: HexCell): string {
    return `${cell.row},${cell.col}`;
}

/**
 * "Odd-r" horizontal offset neighbor math: odd rows are shifted right by
 * half a cell, so which diagonal neighbors are "up-left" vs "up-right"
 * flips between even and odd rows.
 */
export function neighborsOf(cell: HexCell): HexCell[] {
    const { row, col } = cell;
    if (row % 2 === 0) {
        return [
            { row, col: col - 1 }, { row, col: col + 1 },
            { row: row - 1, col: col - 1 }, { row: row - 1, col },
            { row: row + 1, col: col - 1 }, { row: row + 1, col },
        ];
    }
    return [
        { row, col: col - 1 }, { row, col: col + 1 },
        { row: row - 1, col }, { row: row - 1, col: col + 1 },
        { row: row + 1, col }, { row: row + 1, col: col + 1 },
    ];
}

export interface HexBucket<T> {
    items: T[];
}

export interface HexTile<T> {
    item: T;
    row: number;
    col: number;
    x: number;
    y: number;
}

export interface HexLayout<T> {
    tiles: HexTile<T>[];
    width: number;
    height: number;
}

/**
 * Places bucketed items onto a hex grid so each bucket occupies one
 * contiguous region, seeded adjacent to the previously-placed bucket, so the
 * whole result is a single connected honeycomb rather than scattered islands.
 */
export function packHexClusters<T>(buckets: HexBucket<T>[]): HexLayout<T> {
    const occupied = new Set<string>();
    const tiles: HexTile<T>[] = [];
    let frontier: HexCell[] = [{ row: 0, col: 0 }];

    for (const bucket of buckets) {
        if (bucket.items.length === 0) continue;

        // Defensive fallback only: every cell ever pushed onto `frontier` was
        // verified unoccupied when it was queued, and buckets are processed
        // strictly sequentially (never interleaved), so nothing else can mark
        // a queued cell occupied out from under it -- except the boxed-in
        // fallback below, which can occupy a *later* bucket's leftover
        // frontier via its global scan before an *earlier* saved `frontier`
        // reference is consumed. That's the one path that makes this `??`
        // reachable in practice; it stays as a safety net either way.
        const seed = frontier.find((cell) => !occupied.has(cellKey(cell))) ?? { row: 0, col: 0 };
        const localVisited = new Set<string>([cellKey(seed)]);
        const queue: HexCell[] = [seed];
        let itemIndex = 0;

        while (itemIndex < bucket.items.length) {
            let cell = queue.shift();

            if (!cell) {
                // This bucket's local BFS frontier ran dry before every item
                // was placed -- the seed was "boxed in" by cells earlier
                // buckets (or this bucket's own growth) already occupy, with
                // no reachable unoccupied neighbor left in `queue`/`localVisited`.
                // Recover by scanning the neighbors of every cell occupied so
                // far (not just this bucket's own local frontier) for any
                // still-free, not-yet-queued cell, and resume growth from
                // there. `occupied` is always finite and the grid is
                // unbounded, so this is guaranteed to find somewhere to go
                // as long as items remain -- placement always makes forward
                // progress instead of silently dropping trailing items.
                for (const occupiedKey of occupied) {
                    const [r, c] = occupiedKey.split(",").map(Number);
                    for (const neighbor of neighborsOf({ row: r, col: c })) {
                        const neighborKey = cellKey(neighbor);
                        if (occupied.has(neighborKey) || localVisited.has(neighborKey)) continue;
                        localVisited.add(neighborKey);
                        queue.push(neighbor);
                    }
                }
                cell = queue.shift();
                // Should be unreachable given the argument above; kept as a
                // defensive guard so a future change can't turn this into an
                // infinite loop.
                if (!cell) break;
            }

            const key = cellKey(cell);
            // Unreachable in practice: every cell is checked against
            // `occupied` at the moment it's queued (both in the normal
            // growth below and in the boxed-in fallback above), and buckets
            // never interleave, so nothing can occupy a queued cell before
            // its own turn. Kept as a defensive guard.
            if (occupied.has(key)) continue;

            occupied.add(key);
            tiles.push({ item: bucket.items[itemIndex], row: cell.row, col: cell.col, x: 0, y: 0 });
            itemIndex++;

            for (const neighbor of neighborsOf(cell)) {
                const neighborKey = cellKey(neighbor);
                if (occupied.has(neighborKey) || localVisited.has(neighborKey)) continue;
                localVisited.add(neighborKey);
                queue.push(neighbor);
            }
        }

        frontier = queue.length > 0 ? queue : frontier;
    }

    if (tiles.length === 0) return { tiles: [], width: 0, height: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const tile of tiles) {
        const cellX = tile.col * CELL_WIDTH + (tile.row % 2 === 0 ? 0 : COLUMN_OFFSET);
        const cellY = tile.row * ROW_STEP;
        tile.x = cellX + INSET_X;
        tile.y = cellY + INSET_Y;
        minX = Math.min(minX, cellX);
        minY = Math.min(minY, cellY);
        maxX = Math.max(maxX, cellX + CELL_WIDTH);
        maxY = Math.max(maxY, cellY + CELL_HEIGHT);
    }
    for (const tile of tiles) {
        tile.x -= minX;
        tile.y -= minY;
    }

    return { tiles, width: maxX - minX, height: maxY - minY };
}
