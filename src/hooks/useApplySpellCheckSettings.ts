import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores";

type SpellcheckElement = HTMLElement & { spellcheck?: boolean };

const MANAGED_SELECTOR = "input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']";
const TEXT_LIKE_INPUT_TYPES = new Set(["", "text", "search", "email", "url", "tel"]);

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
            applySpellcheckToTree(document, enabled);
        };

        applyIfChanged(useSettingsStore.getState().spellCheck, true);

        const unsubscribe = useSettingsStore.subscribe((state) => {
            applyIfChanged(state.spellCheck);
        });

        const observer = new MutationObserver((mutations) => {
            const enabled = useSettingsStore.getState().spellCheck;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof HTMLElement)) return;
                    applySpellcheckToTree(node, enabled);
                });

                if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
                    setSpellcheckOnElement(mutation.target, enabled);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["contenteditable", "type"],
        });

        return () => {
            unsubscribe();
            observer.disconnect();
        };
    }, []);
}

