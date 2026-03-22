import type { ThemeDefinition } from "../../themes/builtinThemes";

interface ThemePreviewProps {
    theme: ThemeDefinition;
    size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
    sm: { width: "w-24", height: "h-16" },
    md: { width: "w-32", height: "h-20" },
    lg: { width: "w-40", height: "h-24" },
};

function resolveToken(theme: ThemeDefinition, key: keyof ThemeDefinition["tokens"], fallback: string) {
    return theme.tokens[key] ?? fallback;
}

export function ThemePreview({ theme, size = "md" }: ThemePreviewProps) {
    const { width, height } = SIZE_MAP[size];
    const background = resolveToken(theme, "background.primary", "var(--color-bg-primary)");
    const border = resolveToken(theme, "border.light", "var(--color-border-light)");
    const accent = resolveToken(theme, "accent.default", "var(--primary)");

    return (
        <div className={`${width} ${height} rounded-lg overflow-hidden border shadow-sm`} style={{ borderColor: border }}>
            <div className="size-full flex flex-col" style={{ backgroundColor: background }}>
                <div
                    className="h-3 border-b flex items-center gap-1 px-2"
                    style={{
                        backgroundColor: background,
                        borderColor: border,
                    }}
                >
                    <div className="size-1 rounded-full bg-[#f87171]" />
                    <div className="size-1 rounded-full bg-[#fbbf24]" />
                    <div className="size-1 rounded-full bg-[#34d399]" />
                </div>
                <div className="flex-1 flex gap-1 p-1.5">
                    <div className="w-8 rounded" style={{ backgroundColor: background }} />
                    <div className="flex-1 space-y-1">
                        <div className="h-1 rounded w-3/4" style={{ backgroundColor: border }} />
                        <div className="h-1 rounded w-1/2" style={{ backgroundColor: border }} />
                        <div className="h-1 rounded w-2/3" style={{ backgroundColor: accent }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
