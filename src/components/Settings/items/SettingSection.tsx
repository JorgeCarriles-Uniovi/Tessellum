export function SettingSection({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
    return (<div>
        <div className="mb-4"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <h4 className="text-sm font-bold text-[#0f172a] mb-1">{title}</h4>
            <p className="text-xs text-[#94a3b8]">{description}</p>
        </div>
        <div className="space-y-4"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`,
             }}>
            {children}
        </div>
    </div>)
}