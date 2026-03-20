export function ShortcutItem({ label, shortcut }: { label: string; shortcut: string }) {
    return (
        <div className="flex items-center justify-between py-2" style={{ paddingTop: `0.5rem`, paddingBottom: `0.5rem` }}>
            <span className="text-sm text-[#475569]">{label}</span>
            <kbd className="px-2 py-1 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs font-mono text-[#64748b]"
                 style={{
                     paddingTop: `0.5rem`,
                     paddingBottom: `0.5rem`,
                     paddingLeft: `0.5rem`,
                     paddingRight: `0.5rem`,
                 }}>
                {shortcut}
            </kbd>
        </div>
    );
}