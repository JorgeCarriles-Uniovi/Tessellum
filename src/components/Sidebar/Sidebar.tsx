import { useEffect, useState, useRef } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { Settings, Trash2, Network, FolderOpen } from "lucide-react";
import { useUiStore, useVaultStore } from "../../stores";
import { FileTree } from "../FileTree/FileTree";
import { SidebarContextMenu } from "./SidebarContextMenu";
import { InputModal } from "../InputModal";
import { useFileTree } from "../FileTree/hooks/useFileTree";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";
import { BaseSidebar } from "../Layout/BaseSidebar";
import { TemplatePicker } from "../TemplatePicker";
import { getParentFromTarget } from "../../utils/pathUtils";

const LEFT_SIDEBAR_WIDTH_KEY = "tessellum:left-sidebar-width";
const LEFT_SIDEBAR_MIN = 220;
const LEFT_SIDEBAR_MAX = 420;

const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${theme.spacing[4]}`,
    borderBottom: `1px solid ${theme.colors.border.light}`,
    backgroundColor: theme.colors.background.primary,
};

const headerLeftStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[2],
};

const logoStyle: CSSProperties = {
    width: "24px",
    height: "24px",
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.blue[600],
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
};

const fileTreeStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: `${theme.spacing[1]} 0`, // Reduced padding for tighter layout
};

const actionSectionStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing[1],
    padding: `0 ${theme.spacing[4]} ${theme.spacing[2]}`,
};

const footerStyle: CSSProperties = {
    borderTop: `1px solid ${theme.colors.gray[100]}`,
    padding: `${theme.spacing[2]} 0`,
};

const vaultSwitcherStyle: CSSProperties = {
    padding: theme.spacing[4],
    borderTop: `1px solid ${theme.colors.border.light}`,
    backgroundColor: theme.colors.background.primary,
    cursor: "pointer",
    border: "none",
};

const vaultBadgeStyle: CSSProperties = {
    width: 32,
    height: 32,
    backgroundColor: theme.colors.blue[50],
    color: theme.colors.blue[600],
    fontWeight: theme.typography.fontWeight.bold,
};

const headerActionStyle = (disabled?: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: theme.borderRadius.md,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.gray[300] : theme.colors.gray[600],
    backgroundColor: "transparent",
});

const actionButtonStyle = (isHovered: boolean, disabled?: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    width: "100%",
    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
    background: isHovered ? theme.colors.gray[50] : "transparent",
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: theme.borderRadius.lg,
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.gray[400] : theme.colors.gray[700],
    transition: theme.transitions.fast,
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
});

const footerButtonStyle = (isHovered: boolean, disabled?: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
    width: "100%",
    padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
    background: isHovered ? theme.colors.gray[50] : "transparent",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? theme.colors.gray[400] : theme.colors.gray[600],
    transition: theme.transitions.fast,
    textAlign: "left",
    opacity: disabled ? 0.6 : 1,
});

function clampWidth(value: number): number {
    return Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, value));
}

function useLeftSidebarWidth() {
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const stored = localStorage.getItem(LEFT_SIDEBAR_WIDTH_KEY);
        const parsed = stored ? Number.parseInt(stored, 10) : NaN;
        return Number.isFinite(parsed) ? clampWidth(parsed) : 256;
    });
    const isResizingRef = useRef(false);

    useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            if (!isResizingRef.current) return;
            const nextWidth = clampWidth(event.clientX);
            setSidebarWidth(nextWidth);
            localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(nextWidth));
        };

        const handleUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            }
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, []);

    const onResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    return { sidebarWidth, onResizeStart };
}

const actionButtonContentStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing[3],
};

const actionLabelStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
};

const emptyStateStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    color: theme.colors.gray[400],
    fontSize: theme.typography.fontSize.sm,
    textAlign: "center",
};

const emptyStateIconStyle: CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[50],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.gray[300],
};

const emptyStateTitleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[600],
};

const emptyStateTextStyle: CSSProperties = {
    maxWidth: 240,
    lineHeight: 1.5,
};

export function Sidebar() {
    const { vaultPath } = useVaultStore();
    const { isSidebarOpen } = useUiStore();
    const { sidebarWidth, onResizeStart } = useLeftSidebarWidth();
    const app = useTessellumApp();
    const sidebarActions = app.ui.getSidebarActions();
    const headerActions = app.ui.getUIActions("sidebar-header");
    const footerActions = app.ui.getUIActions("sidebar-footer");
    const openVaultAction =
        headerActions.find((action) => action.id === "sidebar-open-vault")
        ?? app.ui.getUIActions("titlebar-right").find((action) => action.id === "open-vault")
        ?? app.ui.getUIActions("titlebar-left").find((action) => action.id === "open-vault");

    const {
        files,
        treeData,
        menuState,
        handleContextMenu,
        closeMenu,
        deleteFile,
        isFolderModalOpen,
        closeFolderModal,
        handleHeaderNewFolder,
        handleContextNewFolder,
        handleCreateFolderConfirm,
        isRenameModalOpen,
        closeRenameModal,
        handleContextRename,
        handleRenameConfirm,
        getRenameInitialValue,
        handleContextCreateNote,
    } = useFileTree();

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [templatePickerParent, setTemplatePickerParent] = useState<string | undefined>(undefined);
    const [hoveredActionId, setHoveredActionId] = useState<string | null>(null);

    const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() || vaultPath : "No vault";

    const openTemplatePicker = (parentPath?: string) => {
        setTemplatePickerParent(parentPath);
        setTemplatePickerOpen(true);
    };

    useEffect(() => {
        const ref = app.events.on("ui:open-new-folder", () => {
            handleHeaderNewFolder();
        });
        return () => app.events.off(ref);
    }, [app, handleHeaderNewFolder]);

    useEffect(() => {
        const ref = app.events.on("ui:open-template-picker", () => {
            openTemplatePicker(undefined);
        });
        return () => app.events.off(ref);
    }, [app]);

    return (
        <>
            <BaseSidebar
                side="left"
                isOpen={isSidebarOpen}
                width={sidebarWidth}
                style={{
                    position: "relative",
                    backgroundColor: theme.colors.background.secondary,
                    borderColor: theme.colors.border.light,
                }}
            >
                <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
                    onMouseDown={onResizeStart}
                    style={{
                        backgroundColor: "transparent",
                    }}
                />
                <div
                    className="flex flex-col transition-all duration-300 ease-in-out"
                    style={{
                        width: sidebarWidth,
                        height: "100%",
                        minHeight: 0,
                        opacity: isSidebarOpen ? 1 : 0,
                        transform: isSidebarOpen ? "translateX(0)" : "translateX(-8px)",
                    }}
                >
                    <div style={headerStyle}>
                        <div style={headerLeftStyle}>
                            <div style={logoStyle}>T</div>
                            <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm }}>Tessellum</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {headerActions.map((action) => {
                                const disabled = action.disabled || (!vaultPath && action.id !== "sidebar-open-vault");
                                return (
                                    <button
                                        key={action.id}
                                        title={action.tooltip || action.label}
                                        style={headerActionStyle(disabled)}
                                        onClick={disabled ? undefined : action.onClick}
                                        disabled={disabled}
                                    >
                                        {action.icon || <FolderOpen size={16} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={fileTreeStyle}>
                        {files.length === 0 ? (
                            <div style={emptyStateStyle}>
                                <div style={emptyStateIconStyle}>
                                    <FolderOpen size={26} />
                                </div>
                                <div style={emptyStateTitleStyle}>No notes yet</div>
                                <div style={emptyStateTextStyle}>Create your first note or folder to get started.</div>
                            </div>
                        ) : (
                            <FileTree data={treeData} onContextMenu={handleContextMenu} />
                        )}
                    </div>

                    {sidebarActions.length > 0 && (
                        <div style={actionSectionStyle}>
                            {sidebarActions.map((action) => {
                                const isHovered = hoveredActionId === action.id;
                                return (
                                    <button
                                        key={action.id}
                                        style={actionButtonStyle(isHovered)}
                                        onClick={action.onClick}
                                        onMouseEnter={() => setHoveredActionId(action.id)}
                                        onMouseLeave={() => setHoveredActionId(null)}
                                    >
                                        <span style={actionButtonContentStyle}>
                                            {action.icon}
                                            <span style={actionLabelStyle}>{action.label}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div style={footerStyle}>
                        {footerActions.map((action) => {
                            const isHovered = hoveredActionId === action.id;
                            return (
                                <button
                                    key={action.id}
                                    style={footerButtonStyle(isHovered, action.disabled)}
                                    onClick={action.disabled ? undefined : action.onClick}
                                    onMouseEnter={() => setHoveredActionId(action.id)}
                                    onMouseLeave={() => setHoveredActionId(null)}
                                    title={action.tooltip || action.label}
                                >
                                    {action.icon || (action.id === "sidebar-graph" ? <Network size={18} /> : action.id === "sidebar-settings" ? <Settings size={18} /> : <Trash2 size={18} />)}
                                    <span>{action.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <VaultSwitcher vaultName={vaultName} onOpenVault={openVaultAction?.onClick} />
                </div>
            </BaseSidebar>

            {menuState && (
                <SidebarContextMenu
                    x={menuState.x}
                    y={menuState.y}
                    target={menuState.target}
                    onClose={closeMenu}
                    onRename={handleContextRename}
                    onDelete={() => deleteFile(menuState.target)}
                    onNewNote={handleContextCreateNote}
                    onNewNoteFromTemplate={() => {
                        openTemplatePicker(getParentFromTarget(menuState.target));
                        closeMenu();
                    }}
                    onNewFolder={handleContextNewFolder}
                />
            )}

            <TemplatePicker
                isOpen={templatePickerOpen}
                onClose={() => setTemplatePickerOpen(false)}
                parentPath={templatePickerParent}
            />

            <InputModal
                isOpen={isFolderModalOpen}
                onClose={closeFolderModal}
                onSubmit={handleCreateFolderConfirm}
                title="Create New Folder"
                placeholder="Enter folder name..."
                submitLabel="Create"
            />

            <InputModal
                isOpen={isRenameModalOpen}
                onClose={closeRenameModal}
                onSubmit={handleRenameConfirm}
                title="Rename"
                placeholder="Enter new name..."
                defaultValue={getRenameInitialValue()}
                submitLabel="Rename"
            />
        </>
    );
}

function VaultSwitcher({ vaultName, onOpenVault }: { vaultName: string; onOpenVault?: () => void }) {
    return (
        <button
            style={vaultSwitcherStyle}
            onClick={onOpenVault}
            title={onOpenVault ? "Switch Vault" : "No action"}
        >
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing[3] }}>
                <div style={{ ...logoStyle, ...vaultBadgeStyle }}>{vaultName.charAt(0).toUpperCase()}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontSize: theme.typography.fontSize.sm, fontWeight: 600 }}>{vaultName}</span>
                    <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.gray[400] }}>Open vault</span>
                </div>
            </div>
        </button>
    );
}
