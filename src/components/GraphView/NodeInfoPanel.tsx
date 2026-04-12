import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../../stores/editorStore';
import { stringToColor } from '../../utils/graphUtils';
import { useAppTranslation } from '../../i18n/react.tsx';

interface NodeInfoPanelProps {
    nodePath: string;
    tags?: string[];
    onClose: () => void;
}

export function NodeInfoPanel({ nodePath, tags, onClose }: NodeInfoPanelProps) {
    const { t } = useAppTranslation("core");
    const [outgoing, setOutgoing] = useState<string[]>([]);
    const [incoming, setIncoming] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const vaultPath = useEditorStore((s) => s.vaultPath);

    useEffect(() => {
        if (!nodePath) return;

        setLoading(true);
        Promise.all([
            invoke<string[]>('get_outgoing_links', { path: nodePath }),
            invoke<string[]>('get_backlinks', { path: nodePath }),
        ])
            .then(([out, inc]) => {
                setOutgoing(out);
                setIncoming(inc);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [nodePath]);

    const relativePath = vaultPath
        ? nodePath.replace(/\\/g, '/').replace(vaultPath.replace(/\\/g, '/'), '').replace(/^\//, '')
        : nodePath;

    const getLabel = (p: string) => {
        const parts = p.replace(/\\/g, '/').split('/');
        let name = parts[parts.length - 1];
        if (name.endsWith('.md')) name = name.slice(0, -3);
        return name;
    }

    return (
        <div
            style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                width: 280,
                maxHeight: 360,
                backgroundColor: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-light)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10,
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--color-border-light)',
                    backgroundColor: 'var(--color-bg-secondary)',
                }}
            >
                <span
                    style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--color-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {getLabel(nodePath)}
                </span>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)',
                        fontSize: '16px',
                        lineHeight: 1,
                        padding: '0 2px',
                    }}
                >
                    ×
                </button>
            </div>

            {/* Content */}
            <div
                style={{
                    padding: '10px 14px',
                    overflowY: 'auto',
                    flex: 1,
                }}
                onWheel={(e) => {
                    e.currentTarget.scrollTop += e.deltaY;
                }}
            >
                {/* Path */}
                <div style={{ marginBottom: 12 }}>
                    <div style={sectionLabelStyle}>{t("graph.path")}</div>
                    <div style={sectionValueStyle}>{relativePath}</div>
                </div>

                {/* Tags */}
                {tags && tags.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={sectionLabelStyle}>{t("graph.tags")}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {tags.map((tag) => {
                                const { h } = stringToColor(tag);
                                const saturation = '70%';
                                const lightnessBg = '60%';
                                const lightnessText = '50%';

                                return (
                                    <span key={tag} style={{
                                        fontSize: '11px',
                                        backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
                                        color: `hsl(${h}, ${saturation}, ${lightnessText})`,
                                        border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
                                        padding: '2px 6px',
                                        borderRadius: 'var(--radius-full)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        #{tag}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={{ ...sectionValueStyle, fontStyle: 'italic' }}>{t("graph.loading")}</div>
                ) : (
                    <>
                        {/* Outgoing links */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={sectionLabelStyle}>
                                {t("graph.outgoingLinks", { count: outgoing.length })}
                            </div>
                            {outgoing.length === 0 ? (
                                <div style={emptyStyle}>{t("graph.noOutgoingLinks")}</div>
                            ) : (
                                outgoing.map((path) => (
                                    <div key={path} style={linkItemStyle}>
                                        {getLabel(path)}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Incoming links */}
                        <div>
                            <div style={sectionLabelStyle}>
                                {t("graph.incomingLinks", { count: incoming.length })}
                            </div>
                            {incoming.length === 0 ? (
                                <div style={emptyStyle}>{t("graph.noIncomingLinks")}</div>
                            ) : (
                                incoming.map((path) => (
                                    <div key={path} style={linkItemStyle}>
                                        {getLabel(path)}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// --- Styles ---
const sectionLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    marginBottom: 4,
};

const sectionValueStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    wordBreak: 'break-all',
};

const emptyStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
};

const linkItemStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    padding: '3px 6px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-bg-tertiary)',
    marginBottom: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};
