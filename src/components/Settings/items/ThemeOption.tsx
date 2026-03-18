export function ThemeOption({ label, icon: Icon, selected, onClick }: { label: string; icon: any; selected: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`p-4 rounded-lg border-2 transition-all ${
                selected
                    ? 'border-[#3d14b8] bg-[rgba(61,20,184,0.05)]'
                    : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
            }`}
        >
            <Icon className={`size-6 mx-auto mb-2 ${selected ? 'text-[#3d14b8]' : 'text-[#94a3b8]'}`} />
            <p className={`text-xs font-semibold ${selected ? 'text-[#3d14b8]' : 'text-[#64748b]'}`}>{label}</p>
        </button>
    );
}