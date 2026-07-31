import type { CSSProperties } from "react";
import { FolderOpen, X } from "lucide-react";
import { useVaultStore } from "../../stores";
import { useTessellumApp } from "../../plugins/TessellumApp";
import { theme } from "../../styles/theme";
import { useAppTranslation } from "../../i18n/react.tsx";

export interface VaultSwitcherPopoverProps {
    open: boolean;
    onClose: () => void;
}

const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "transparent",
    zIndex: 1000,
};

const popoverStyle: CSSProperties = {
    position: "fixed",
    top: 8,
    left: 64,
    width: 312,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.light}`,
    borderRadius: 14,
    boxShadow: theme.shadows.lg,
    zIndex: 1001,
    overflow: "hidden",
    padding: "10px",
};

const sectionHeaderStyle: CSSProperties = {
    fontSize: "10.5px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: theme.colors.text.muted,
    padding: "4px 6px 8px",
};

const vaultCardStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px",
    border: `1px solid ${theme.colors.border.light}`,
    background: theme.colors.background.elevated,
    borderRadius: "10px",
};

const vaultBadgeStyle: CSSProperties = {
    width: 30,
    height: 30,
    minWidth: 30,
    borderRadius: 9,
    color: "#fff",
    fontFamily: theme.typography.fontFamily.editor,
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: "15px",
    background: `linear-gradient(145deg, ${theme.colors.accent.default}, ${theme.colors.accent.secondary})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const vaultTextWrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
};

const vaultNameRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
};

const vaultNameStyle: CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: theme.colors.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const vaultPathStyle: CSSProperties = {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: "11px",
    color: theme.colors.text.tertiary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const activeDotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: theme.colors.semantic.green,
    flexShrink: 0,
};

const activeLabelStyle: CSSProperties = {
    fontSize: "11px",
    fontWeight: 500,
    color: theme.colors.semantic.green,
    display: "flex",
    alignItems: "center",
    gap: "4px",
};

const dividerStyle: CSSProperties = {
    height: 1,
    background: theme.colors.border.light,
    margin: "8px 0",
};

const actionRowPadding: CSSProperties = {
    padding: "8px 9px",
};

const recentRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "7px 9px",
    borderRadius: "9px",
    cursor: "pointer",
};

const recentTextWrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    minWidth: 0,
    flex: 1,
};

const recentNameStyle: CSSProperties = {
    fontSize: "12.5px",
    fontWeight: 500,
    color: theme.colors.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const recentPathStyle: CSSProperties = {
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: "10.5px",
    color: theme.colors.text.tertiary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

export function VaultSwitcherPopover({ open, onClose }: VaultSwitcherPopoverProps) {
    const { vaultPath, recentVaultPaths, setVaultPath, removeRecentVaultPath } = useVaultStore();
    const app = useTessellumApp();
    const { t } = useAppTranslation("core");

    if (!open) return null;

    const recents = recentVaultPaths.filter((p) => p !== vaultPath);

    const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() || vaultPath : t("sidebar.noVault");
    const vaultLetter = vaultName.charAt(0).toUpperCase();

    // Same lookup Sidebar.tsx uses to find the real "open a different vault" handler.
    const openVaultAction =
        app.ui.getUIActions("sidebar-header").find((action) => action.id === "sidebar-open-vault")
        ?? app.ui.getUIActions("titlebar-right").find((action) => action.id === "open-vault")
        ?? app.ui.getUIActions("titlebar-left").find((action) => action.id === "open-vault");

    return (
        <div style={backdropStyle} onClick={onClose}>
            <div style={popoverStyle} onClick={(e) => e.stopPropagation()}>
                <div style={sectionHeaderStyle}>{t("vaultSwitcher.currentVault")}</div>
                <div style={vaultCardStyle}>
                    <div style={vaultBadgeStyle}>{vaultLetter}</div>
                    <div style={vaultTextWrapStyle}>
                        <div style={vaultNameRowStyle}>
                            <span style={vaultNameStyle}>{vaultName}</span>
                        </div>
                        {vaultPath && <span style={vaultPathStyle}>{vaultPath}</span>}
                        <span style={activeLabelStyle}>
                            <span style={activeDotStyle} />
                            {t("vaultSwitcher.active")}
                        </span>
                    </div>
                </div>

                {recents.length > 0 && (
                    <>
                        <div style={dividerStyle} />
                        <div style={sectionHeaderStyle}>{t("vaultSwitcher.recentVaults")}</div>
                        {recents.map((path) => {
                            const name = path.split(/[\\/]/).pop() || path;
                            return (
                                <div
                                    key={path}
                                    className="ui-row-btn"
                                    style={recentRowStyle}
                                    onClick={() => {
                                        setVaultPath(path);
                                        onClose();
                                    }}
                                >
                                    <FolderOpen size={15} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                                    <div style={recentTextWrapStyle}>
                                        <span style={recentNameStyle}>{name}</span>
                                        <span style={recentPathStyle}>{path}</span>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label={t("vaultSwitcher.removeRecent")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeRecentVaultPath(path);
                                        }}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            width: 22, height: 22, flexShrink: 0,
                                            border: "none", background: "transparent",
                                            color: theme.colors.text.muted, cursor: "pointer",
                                            borderRadius: 6,
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </>
                )}

                <div style={dividerStyle} />

                <button
                    type="button"
                    className="ui-row-btn"
                    style={actionRowPadding}
                    onClick={() => {
                        openVaultAction?.onClick();
                        onClose();
                    }}
                    disabled={!openVaultAction}
                >
                    <FolderOpen size={16} style={{ color: theme.colors.text.muted, flexShrink: 0 }} />
                    <span>{t("vaultSwitcher.openFolderAsVault")}</span>
                </button>
            </div>
        </div>
    );
}
