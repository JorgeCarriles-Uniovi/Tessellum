export function SettingItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <label className="text-sm text-[#475569]">{label}</label>
            {children}
        </div>
    );
}