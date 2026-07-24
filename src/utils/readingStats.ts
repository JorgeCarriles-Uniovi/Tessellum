/** Shared reading-time helpers used by the status bar and editor header. */

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function readTimeMinutes(words: number): number {
    return Math.max(1, Math.round(words / 200));
}
