export function ThemeOption({ label, icon: Icon, selected, onClick }: { label: string; icon: any; selected: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg border-2 transition-all ${selected
                ? ''
                : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
            }`}
            style={{
                paddingTop: `1rem`,
                paddingBottom: `1rem`,
                paddingLeft: `1rem`,
                paddingRight: `1rem`,
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'column',
                borderColor: selected ? "var(--color-blue-600)" : undefined,
                backgroundColor: selected ? "color-mix(in srgb, var(--color-blue-600) 10%, transparent)" : undefined,
            }}
        >
            <Icon
                className={`size-6 mx-auto mb-2 ${selected ? '' : 'text-[#94a3b8]'}`}
                style={{ color: selected ? "var(--color-blue-600)" : undefined }}
            />
            <p className={`text-xs font-semibold ${selected ? '' : 'text-[#64748b]'}`}
               style={{
                   paddingTop: `0.75rem`,
                   paddingLeft: `1rem`,
                   paddingRight: `1rem`,
                   color: selected ? "var(--color-blue-600)" : undefined,
               }}
            >
                {label}
            </p>
        </button>
    );
}
