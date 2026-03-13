import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";

export function EditorHeader() {
    const app = useTessellumApp();
    const actions = app.ui.getUIActions("editor-header");

    return (
        <div
            className="h-12 flex items-center justify-between px-5 border-b shrink-0"
            style={{
                backgroundColor: theme.colors.background.primary,
                borderColor: theme.colors.border.light,
            }}
        >
            <div className="flex items-center gap-2 text-[12px]" />
            <div className="flex items-center gap-2">
                <div
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                    style={{
                        color: "#16a34a",
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        border: `1px solid ${theme.colors.border.light}`,
                    }}
                >
                    <span
                        className="inline-block rounded-full"
                        style={{ width: 6, height: 6, backgroundColor: "#22c55e" }}
                    />
                    Editing
                </div>
                <div
                    className="h-4 w-px"
                    style={{ backgroundColor: theme.colors.border.light }}
                />
                {actions.map((action) => (
                    <button
                        key={action.id}
                        title={action.tooltip || action.label}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="p-1.5 rounded-md transition-colors"
                        style={{
                            color: action.disabled ? theme.colors.gray[300] : theme.colors.gray[500],
                            cursor: action.disabled ? "not-allowed" : "pointer",
                        }}
                    >
                        {action.icon}
                    </button>
                ))}
            </div>
        </div>
    );
}