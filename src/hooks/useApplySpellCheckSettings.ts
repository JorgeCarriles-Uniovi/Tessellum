import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/settingsStore";

type SpellcheckElement = HTMLElement & { spellcheck?: boolean };

const MANAGED_SELECTOR = "input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']";
const TEXT_LIKE_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel"]);
const OBSERVED_ROOT_ID = "root";
const EDITOR_ACTIVE_SURFACE_SELECTOR = ".cm-editor, .editor-scroll-shell";
const OBSERVER_RETRY_DELAY_MS = 50;
const OBSERVER_RETRY_MAX_ATTEMPTS = 20;

function isSpellcheckTarget(element: HTMLElement): element is SpellcheckElement {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) {
        return TEXT_LIKE_INPUT_TYPES.has(element.type.toLowerCase());
    }
    if (element.isContentEditable) return true;
    return false;
}

function setSpellcheckOnElement(element: SpellcheckElement, enabled: boolean) {
    if (!isSpellcheckTarget(element)) {
        return;
    }

    element.spellcheck = enabled;
    element.setAttribute("spellcheck", String(enabled));
}

function applySpellcheckToTree(root: ParentNode, enabled: boolean) {
    if (root instanceof HTMLElement) {
        setSpellcheckOnElement(root, enabled);
    }

    root.querySelectorAll<HTMLElement>(MANAGED_SELECTOR).forEach((element) => {
        setSpellcheckOnElement(element, enabled);
    });
}

function isManagedNodeOrContainsManaged(element: HTMLElement): boolean {
    return element.matches(MANAGED_SELECTOR) || element.querySelector(MANAGED_SELECTOR) !== null;
}

function isEditorActiveSurface(element: HTMLElement): boolean {
    return element.matches(EDITOR_ACTIVE_SURFACE_SELECTOR) || element.closest(EDITOR_ACTIVE_SURFACE_SELECTOR) !== null;
}

function isSameValue(previous: boolean | null, next: boolean): boolean {
    return previous !== null && previous === next;
}

export function useApplySpellCheckSettings() {
    const lastApplied = useRef<boolean | null>(null);

    useEffect(() => {
        const applyIfChanged = (enabled: boolean, force = false) => {
            if (!force && isSameValue(lastApplied.current, enabled)) {
                return;
            }

            lastApplied.current = enabled;
            const root = document.getElementById(OBSERVED_ROOT_ID);
            if (root instanceof HTMLElement) {
                applySpellcheckToTree(root, enabled);
                return;
            }

            // Fallback for early app bootstrap before #root is available.
            applySpellcheckToTree(document, enabled);
        };

        applyIfChanged(useSettingsStore.getState().spellCheck, true);

        const unsubscribe = useSettingsStore.subscribe((state) => {
            applyIfChanged(state.spellCheck);
        });

        let observer: MutationObserver | null = null;
        let retryTimer: number | null = null;
        let retryCount = 0;

        const attachObserver = () => {
            const root = document.getElementById(OBSERVED_ROOT_ID);
            if (!(root instanceof HTMLElement)) {
                if (retryCount >= OBSERVER_RETRY_MAX_ATTEMPTS) {
                    return;
                }
                retryCount += 1;
                retryTimer = window.setTimeout(attachObserver, OBSERVER_RETRY_DELAY_MS);
                return;
            }

            observer = new MutationObserver((mutations) => {
                const enabled = useSettingsStore.getState().spellCheck;
                for (const mutation of mutations) {
                    if (mutation.type === "childList") {
                        for (const node of mutation.addedNodes) {
                            if (!(node instanceof HTMLElement)) continue;
                            if (!isManagedNodeOrContainsManaged(node)) continue;
                            applySpellcheckToTree(node, enabled);
                        }
                        continue;
                    }

                    if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
                        if (!isEditorActiveSurface(mutation.target)) continue;
                        setSpellcheckOnElement(mutation.target, enabled);
                    }
                }
            });

            observer.observe(root, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["contenteditable", "type"],
            });
        };

        attachObserver();

        return () => {
            unsubscribe();
            if (retryTimer !== null) {
                window.clearTimeout(retryTimer);
            }
            observer?.disconnect();
        };
    }, []);
}

