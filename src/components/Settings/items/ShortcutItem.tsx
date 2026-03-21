export function ShortcutItem({ label, shortcut }: { label: string; shortcut: string }) {
    return (
        <div className="flex items-center justify-between py-2" style={{ paddingTop: `0.5rem`, paddingBottom: `0.5rem` }}>
            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>{label}</span>
            <kbd
                className="px-2 py-1 border rounded text-xs font-mono"
                style={{
                    paddingTop: `0.5rem`,
                    paddingBottom: `0.5rem`,
                    paddingLeft: `0.5rem`,
                    paddingRight: `0.5rem`,
                    backgroundColor: "var(--color-kbd-bg)",
                    borderColor: "var(--color-kbd-border)",
                    color: "var(--color-kbd-text)",
                }}
            >
                {shortcut}
            </kbd>
        </div>
    );
}
