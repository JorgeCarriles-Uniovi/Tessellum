export function SettingItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <label className="text-sm text-[#475569]">{label}</label>
            {children}
        </div>
    );
}