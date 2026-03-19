export function ToggleSetting({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <div className="flex items-start justify-between"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <div className="flex-1">
                <p className="text-sm font-medium text-[#0f172a]">{label}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">{description}</p>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? '' : 'bg-[#cbd5e1]'
                }`}
                style={{ backgroundColor: checked ? "var(--color-blue-600)" : undefined }}
            >
                <span
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
}
