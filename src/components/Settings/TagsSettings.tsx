import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Tags, GitMerge } from "lucide-react";
import { SettingSection } from "./items/SettingSection";
import { Button } from "../ui";

interface TagGroup {
    canonical: string;
    variants: string[];
}

export function TagsSettings() {
    const [groups, setGroups] = useState<TagGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [merging, setMerging] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const result = await invoke<TagGroup[]>("get_similar_tag_groups");
            setGroups(result);
        } catch {
            toast.error("Failed to load tag groups");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleDismiss = (canonical: string) => {
        setGroups((prev) => prev.filter((g) => g.canonical !== canonical));
    };

    return (
        <div className="space-y-6">
            <SettingSection
                title="Near-Duplicate Tag Groups"
                description="Tags that look similar and might be duplicates. Review and decide whether to merge them."
            >
                {loading && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Scanning tags…
                    </div>
                )}

                {!loading && groups.length === 0 && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        No near-duplicate tags found. Your tags look clean!
                    </div>
                )}

                <div className="space-y-3">
                    {groups.map((group) => (
                        <div
                            key={group.canonical}
                            className="rounded-xl p-3 flex flex-col gap-2"
                            style={{
                                background: "var(--color-background-secondary)",
                                border: "1px solid var(--color-border-light)",
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Tags size={13} style={{ color: "var(--primary)", flexShrink: 0 }} />
                                <div className="flex-1 flex flex-wrap gap-1.5 items-center">
                                    <span
                                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                                            color: "var(--primary)",
                                        }}
                                    >
                                        #{group.canonical}
                                    </span>
                                    <span className="text-[0.625rem]" style={{ color: "var(--color-text-muted)" }}>
                                        ←
                                    </span>
                                    {group.variants.map((v) => (
                                        <span
                                            key={v}
                                            className="text-xs px-2 py-0.5 rounded-full"
                                            style={{
                                                background: "var(--color-background-tertiary)",
                                                color: "var(--color-text-secondary)",
                                            }}
                                        >
                                            #{v}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                                <Button variant="secondary" size="sm" onClick={() => handleDismiss(group.canonical)}>
                                    Ignore
                                </Button>
                                <Button
                                    variant="tint"
                                    size="sm"
                                    disabled={merging === group.canonical}
                                    onClick={async () => {
                                        setMerging(group.canonical);
                                        try {
                                            await invoke("merge_tags", {
                                                canonical: group.canonical,
                                                variants: group.variants,
                                            });
                                            toast.success(`Merged ${group.variants.join(", ")} → ${group.canonical}`);
                                            setGroups((prev) => prev.filter((g) => g.canonical !== group.canonical));
                                        } catch (e) {
                                            toast.error(`Merge failed: ${String(e)}`);
                                        } finally {
                                            setMerging(null);
                                        }
                                    }}
                                >
                                    <GitMerge size={11} />
                                    {merging === group.canonical ? "Merging…" : `Merge into #${group.canonical}`}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {groups.length > 0 && !loading && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={load}>
                        Refresh
                    </Button>
                )}
            </SettingSection>
        </div>
    );
}
