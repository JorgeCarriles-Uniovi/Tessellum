import { useEffect, type RefObject } from "react";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
    DEFAULT_EDITOR_FONT_SIZE_PX,
    nextEditorFontSizePx,
    useEditorContentStore,
} from "../../../stores";

export function useEditorFontZoom(editorRef: RefObject<ReactCodeMirrorRef>) {
    const { setEditorFontSizePx } = useEditorContentStore();

    useEffect(() => {
        let editorRoot: HTMLElement | null = editorRef.current?.view?.dom ?? null;
        let rafId = 0;

        const isMac = navigator.platform.toLowerCase().includes("mac");

        const isTargetInEditor = (target: EventTarget | null) => {
            if (!editorRoot || !target || !(target instanceof Node)) return false;
            return editorRoot.contains(target);
        };

        const onWheel = (event: WheelEvent) => {
            const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
            if (!modifierPressed) return;
            if (!isTargetInEditor(event.target)) return;
            const direction = Math.sign(event.deltaY);
            const delta = direction > 0 ? -1 : direction < 0 ? 1 : 0;
            if (!delta) return;
            event.preventDefault();
            const current = useEditorContentStore.getState().editorFontSizePx;
            setEditorFontSizePx(nextEditorFontSizePx(current, delta));
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
            if (!modifierPressed) return;
            if (event.key !== "0") return;
            if (!isTargetInEditor(document.activeElement)) return;
            event.preventDefault();
            setEditorFontSizePx(DEFAULT_EDITOR_FONT_SIZE_PX);
        };

        const tick = () => {
            editorRoot = editorRef.current?.view?.dom ?? null;
            rafId = requestAnimationFrame(tick);
        };

        window.addEventListener("wheel", onWheel, { passive: false, capture: true });
        window.addEventListener("keydown", onKeyDown);
        rafId = requestAnimationFrame(tick);

        return () => {
            window.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
            window.removeEventListener("keydown", onKeyDown);
            cancelAnimationFrame(rafId);
        };
    }, [editorRef, setEditorFontSizePx]);
}