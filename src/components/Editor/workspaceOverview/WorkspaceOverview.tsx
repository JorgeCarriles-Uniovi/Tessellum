import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HeroProjection, WorkspaceCardItem } from "./types";
import { stringToColor } from "../../../utils/graphUtils";
import { useAppTranslation } from "../../../i18n/react.tsx";

interface WorkspaceOverviewProps {
    cards: WorkspaceCardItem[];
    isOpen: boolean;
    isMounted: boolean;
    reducedMotion: boolean;
    durationMs: number;
    heroProjection: HeroProjection | null;
    onClose: () => void;
    onSelectCard: (id: string, element?: HTMLButtonElement) => void;
}

const OVERVIEW_CARD_MIN_WIDTH_PX = 380;
const OVERVIEW_MAX_COLUMNS = 3;
const OVERVIEW_MAX_GAP_PX = 24;
const OVERVIEW_MAX_WIDTH_PX =
    OVERVIEW_CARD_MIN_WIDTH_PX * OVERVIEW_MAX_COLUMNS + OVERVIEW_MAX_GAP_PX * (OVERVIEW_MAX_COLUMNS - 1);

function formatEditedAt(lastModified: number): string {
    if (!lastModified) return "";
    const date = new Date(lastModified > 1_000_000_000_000 ? lastModified : lastModified * 1000);
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function cardEntryAnimation(order: number, isOpen: boolean, reducedMotion: boolean): string {
    if (reducedMotion) {
        return isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-0 scale-100";
    }
    if (isOpen) {
        return "opacity-100 translate-y-0 scale-100";
    }
    const fromLeft = order % 2 === 0;
    return fromLeft ? "opacity-0 -translate-x-5 scale-95" : "opacity-0 translate-x-5 scale-95";
}

function getTagStyles(tag: string) {
    const { h } = stringToColor(tag);
    const saturation = "70%";
    const lightnessBg = "60%";
    const lightnessText = "50%";
    return {
        backgroundColor: `hsla(${h}, ${saturation}, ${lightnessBg}, 0.15)`,
        color: `hsl(${h}, ${saturation}, ${lightnessText})`,
        border: `1px solid hsla(${h}, ${saturation}, ${lightnessBg}, 0.3)`,
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
    };
}

function removeExtension(filename: string): string {
    const name = filename.split(".");
    let fileName = name[0];
    for (let i = 1; i < name.length - 1; i++) {
        fileName += "." + name[i];
    }
    return fileName;
}

export function WorkspaceOverview({
                                      cards,
                                      isOpen,
                                      isMounted,
                                      reducedMotion,
                                      durationMs,
                                      heroProjection,
                                      onClose,
                                      onSelectCard,
                                  }: WorkspaceOverviewProps) {
    const { t } = useAppTranslation("core");
    const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const activeCardIndex = useMemo(() => cards.findIndex((card) => card.isActive), [cards]);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const clampIndex = useCallback((index: number) => {
        if (cards.length === 0) return -1;
        if (index < 0) return cards.length - 1;
        if (index >= cards.length) return 0;
        return index;
    }, [cards.length]);

    useEffect(() => {
        if (!isOpen) return;
        const initialIndex = activeCardIndex >= 0 ? activeCardIndex : 0;
        setFocusedIndex(initialIndex);
    }, [activeCardIndex, isOpen]);

    useEffect(() => {
        if (!isOpen || focusedIndex < 0) return;
        const target = cardRefs.current[focusedIndex];
        if (!target) return;
        target.focus();
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [focusedIndex, isOpen]);

    useEffect(() => {
        const total = cards.length;
        if (total === 0) {
            setFocusedIndex(-1);
            return;
        }
        setFocusedIndex((current) => {
            if (current < 0) return activeCardIndex >= 0 ? activeCardIndex : 0;
            if (current >= total) return total - 1;
            return current;
        });
    }, [activeCardIndex, cards.length]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (cards.length === 0) return;

            const key = event.key;
            const current = focusedIndex >= 0 ? focusedIndex : (activeCardIndex >= 0 ? activeCardIndex : 0);
            const moveNext = () => setFocusedIndex(clampIndex(current + 1));
            const movePrev = () => setFocusedIndex(clampIndex(current - 1));

            if (key === "ArrowRight" || key === "ArrowDown") {
                event.preventDefault();
                moveNext();
                return;
            }

            if (key === "ArrowLeft" || key === "ArrowUp") {
                event.preventDefault();
                movePrev();
                return;
            }

            if (key === "Tab") {
                event.preventDefault();
                if (event.shiftKey) {
                    movePrev();
                } else {
                    moveNext();
                }
                return;
            }

            if (key === "Home") {
                event.preventDefault();
                setFocusedIndex(0);
                return;
            }

            if (key === "End") {
                event.preventDefault();
                setFocusedIndex(cards.length - 1);
                return;
            }

            if ((key === "Enter" || key === " ") && current >= 0) {
                event.preventDefault();
                onSelectCard(cards[current].id, cardRefs.current[current] ?? undefined);
                return;
            }

            if (key === "Escape") {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeCardIndex, cards, clampIndex, focusedIndex, isOpen, onClose, onSelectCard]);

    if (!isMounted) return null;

    return (
        <>
            <div
                className="absolute inset-0 z-20"
                aria-hidden={!isOpen}
                style={{
                    backgroundColor: "color-mix(in srgb, var(--color-bg-primary) 68%, transparent)",
                    opacity: isOpen ? 1 : 0,
                    transition: reducedMotion ? "opacity 160ms linear" : `opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                    backdropFilter: isOpen ? "blur(4px)" : "blur(0px)",
                    WebkitBackdropFilter: isOpen ? "blur(4px)" : "blur(0px)",
                    pointerEvents: isOpen ? "auto" : "none",
                    willChange: "opacity, backdrop-filter",
                }}
            />

            <div
                className="absolute inset-0 z-30 p-6 md:p-8 lg:p-10"
                style={{
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? "auto" : "none",
                    transition: reducedMotion ? "opacity 160ms linear" : `opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                    willChange: "opacity",
                    padding: "1rem",
                }}
            >
                <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between pb-4"
                         style={{
                             paddingBottom: "1rem"
                         }}
                    >
                        <div className="text-xs uppercase tracking-[0.12em]"
                             style={{
                                 color: "var(--color-text-muted)",
                                 paddingTop: "1rem",
                                 paddingBottom: "1rem"
                             }}>
                            {t("workspaceOverview.title")}
                        </div>
                        <button
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-md h-8 w-8 border cursor-pointer"
                            style={{
                                borderColor: "var(--color-border-light)",
                                backgroundColor: "var(--color-bg-secondary)",
                                color: "var(--color-text-muted)",
                            }}
                            aria-label={t("workspaceOverview.close")}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto">
                        <div
                            className="grid gap-4 md:gap-5 lg:gap-6"
                            style={{
                                // Make card count per row adapt to the current overview width.
                                gridTemplateColumns: `repeat(auto-fit, minmax(${OVERVIEW_CARD_MIN_WIDTH_PX}px, 1fr))`,
                                // Keep rows to a maximum of 3 cards even on very wide overviews.
                                maxWidth: `${OVERVIEW_MAX_WIDTH_PX}px`,
                                marginInline: "auto",
                            }}
                        >
                            {cards.map((card, index) => (
                                <button
                                    key={card.id}
                                    ref={(element) => {
                                        cardRefs.current[index] = element;
                                    }}
                                    onClick={(event) => onSelectCard(card.id, event.currentTarget)}
                                    onFocus={() => setFocusedIndex(index)}
                                    className={`text-left rounded-xl border p-4 md:p-5 shadow-sm cursor-pointer ${cardEntryAnimation(index, isOpen, reducedMotion)}`}
                                    style={{
                                        borderColor: card.isActive ? "var(--primary)" : "var(--color-border-light)",
                                        backgroundColor: card.isActive
                                            ? "color-mix(in srgb, var(--primary) 10%, var(--color-bg-secondary))"
                                            : "var(--color-bg-secondary)",
                                        boxShadow: card.isActive
                                            ? "0 10px 28px color-mix(in srgb, var(--primary) 20%, transparent)"
                                            : "0 8px 20px rgba(0,0,0,0.12)",
                                        transform: !reducedMotion && isOpen ? "translate3d(0, 0, 0) scale(1)" : "none",
                                        transition: reducedMotion
                                            ? "opacity 160ms linear"
                                            : `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), border-color 220ms cubic-bezier(0.4, 0, 0.2, 1)`,
                                        transitionDelay: reducedMotion ? "0ms" : `${Math.min(index * 26, 180)}ms`,
                                        willChange: "transform, opacity",
                                        padding: "1rem",
                                        outlineColor: focusedIndex === index ? "var(--primary)" : undefined,
                                    }}
                                >
                                    <div className="truncate text-sm md:text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                        {removeExtension(card.title)}
                                    </div>
                                    <div className="truncate mt-1 text-[11px] md:text-xs" style={{ color: "var(--color-text-muted)", paddingBottom: "0.5rem", paddingTop: "0.2rem" }}>
                                        <span title={card.path}>{card.shortPath}</span>
                                    </div>
                                    <div
                                        className="mt-3 pt-3 border-t flex items-center justify-between text-[10px] md:text-[11px]"
                                        style={{ borderColor: "var(--color-border-light)", color: "var(--color-text-muted)", paddingTop: "0.5rem" }}
                                    >

                                    </div>
                                    <div
                                        className="mt-2 text-[11px] md:text-xs leading-5 min-h-10"
                                        style={{
                                            color: "color-mix(in srgb, var(--color-text-muted) 88%, var(--color-text-primary) 12%)",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            paddingTop: "0.2rem",
                                            paddingBottom: "0.2rem"
                                        }}
                                    >
                                        {card.contentPreview || t("editor.emptyPreview")}
                                    </div>
                                    {card.tags.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5" style={{ gap: "0.3rem", paddingBottom: "0.5rem", paddingTop: "0.2rem" }}>
                                            {card.tags.map((tag) => (
                                                <span
                                                    key={`${card.id}-${tag}`}
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] md:text-[11px]"
                                                    style={getTagStyles(tag)}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div
                                        className="mt-3 pt-3 border-t flex items-center justify-between text-[10px] md:text-[11px]"
                                        style={{ borderColor: "var(--color-border-light)", color: "var(--color-text-muted)" }}
                                    >
                                        <span>{card.isActive ? t("workspaceOverview.current") : t("workspaceOverview.openTab")}</span>
                                        <span>{formatEditedAt(card.lastModified)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {heroProjection && !reducedMotion && (
                <div
                    className="fixed z-40 rounded-xl border p-5 shadow-2xl"
                    style={{
                        left: `${heroProjection.startRect.left}px`,
                        top: `${heroProjection.startRect.top}px`,
                        width: `${heroProjection.startRect.width}px`,
                        height: `${heroProjection.startRect.height}px`,
                        borderColor: "var(--color-border-light)",
                        backgroundColor: "var(--color-bg-secondary)",
                        color: "var(--color-text-primary)",
                        transform: `translate3d(${heroProjection.translateX}px, ${heroProjection.translateY}px, 0) scale(${heroProjection.scaleX}, ${heroProjection.scaleY})`,
                        transformOrigin: "top left",
                        transition: `transform ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), border-radius ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${Math.floor(durationMs * 0.55)}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                        borderRadius: "0.5rem",
                        opacity: 1,
                        willChange: "transform, opacity",
                        pointerEvents: "none",
                    }}
                >
                    <div className="truncate text-base font-semibold">{heroProjection.title}</div>
                    <div className="truncate mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {heroProjection.path}
                    </div>
                    <div className="mt-3 text-[11px]" style={{ color: "var(--color-text-muted)", opacity: 0 }}>
                        {formatEditedAt(heroProjection.lastModified)}
                    </div>
                </div>
            )}
        </>
    );
}
