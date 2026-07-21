import { useMemo } from "react";
import { computeDiff, type DiffRow } from "./computeDiff";

interface DiffViewProps {
    /** older snapshot text */
    oldText: string;
    /** current note text */
    newText: string;
}

const rowStyles: Record<DiffRow["type"], { bg: string; text: string; sign: string }> = {
    add: { bg: "var(--color-diff-add-bg)", text: "var(--color-diff-add-text)", sign: "+" },
    remove: { bg: "var(--color-diff-remove-bg)", text: "var(--color-diff-remove-text)", sign: "-" },
    context: { bg: "transparent", text: "var(--color-text-primary)", sign: " " },
};

const wordBg: Record<"add" | "remove", string> = {
    add: "var(--color-diff-add-word-bg)",
    remove: "var(--color-diff-remove-word-bg)",
};

export function DiffView({ oldText, newText }: DiffViewProps) {
    const { rows, truncated } = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

    const unchanged = rows.every((r) => r.type === "context");

    return (
        <div
            className="flex-1 overflow-y-auto text-xs font-mono"
            style={{ color: "var(--color-text-primary)" }}
        >
            {unchanged && (
                <div className="px-3 py-3 text-center" style={{ color: "var(--color-text-muted)" }}>
                    No differences — this version matches the current note.
                </div>
            )}
            {rows.map((row, idx) => {
                const style = rowStyles[row.type];
                return (
                    <div
                        key={idx}
                        className="flex whitespace-pre-wrap break-words"
                        style={{ backgroundColor: style.bg }}
                    >
                        <span
                            className="select-none flex-shrink-0 text-center"
                            style={{ width: "1.25rem", color: style.text, opacity: 0.7 }}
                        >
                            {style.sign}
                        </span>
                        <span className="flex-1 pr-2" style={{ color: style.text }}>
                            {row.words
                                ? row.words.map((w, wi) =>
                                      w.changed && row.type !== "context" ? (
                                          <mark
                                              key={wi}
                                              style={{
                                                  backgroundColor: wordBg[row.type as "add" | "remove"],
                                                  color: "inherit",
                                                  borderRadius: "2px",
                                              }}
                                          >
                                              {w.text}
                                          </mark>
                                      ) : (
                                          <span key={wi}>{w.text}</span>
                                      ),
                                  )
                                : row.text || " "}
                        </span>
                    </div>
                );
            })}
            {truncated && (
                <div className="px-3 py-2 text-center" style={{ color: "var(--color-text-muted)" }}>
                    …diff truncated (note is very large)
                </div>
            )}
        </div>
    );
}
