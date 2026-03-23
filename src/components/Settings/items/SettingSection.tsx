export function SettingSection({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
    return (<div>
        <div className="mb-4"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <h4 className="text-sm font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>{title}</h4>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{description}</p>
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
