export function SettingSection({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
    return (<div>
        <div className="mb-3"
             style={{
                 paddingTop: `0.5rem`,
                 paddingBottom: `0.5rem`,
                 paddingLeft: `1rem`,
                 paddingRight: `1rem`
             }}>
            <h4
                className="mb-1"
                style={{
                    fontSize: "10.5px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.11em",
                    color: "var(--color-text-muted)",
                }}
            >
                {title}
            </h4>
            <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{description}</p>
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
