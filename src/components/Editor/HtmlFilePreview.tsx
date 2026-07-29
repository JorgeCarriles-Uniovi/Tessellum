import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { theme } from "../../styles/theme";

interface HtmlFilePreviewProps {
    path: string;
}

/**
 * Whole-file viewer for .html/.htm files, registered by HtmlPreviewPlugin.
 *
 * Renders through `convertFileSrc` rather than a blob URL so relative
 * references inside the document (sibling stylesheets, images) still resolve.
 * The empty `sandbox` attribute blocks script execution entirely.
 */
export function HtmlFilePreview({ path }: HtmlFilePreviewProps) {
    const [failed, setFailed] = useState(false);
    const frameRef = useRef<HTMLIFrameElement>(null);

    // React's synthetic event system only delegates the `load` event for
    // <iframe> elements, not `error` (see react-dom's setInitialProperties),
    // so a plain `onError` prop never fires here. Attach a native listener
    // directly to the node instead.
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const handleError = () => setFailed(true);
        frame.addEventListener("error", handleError);
        return () => frame.removeEventListener("error", handleError);
    }, []);

    if (failed) {
        return (
            <div className="h-full w-full flex items-center justify-center select-none">
                <div
                    className="text-center space-y-3"
                    style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}
                >
                    <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                        Couldn't render this HTML file
                    </div>
                    <div className="text-sm">{path.split(/[\\/]/).pop()}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full" style={{ backgroundColor: "var(--color-panel-footer)" }}>
            <iframe
                ref={frameRef}
                src={convertFileSrc(path)}
                sandbox=""
                title="HTML Preview"
                className="w-full h-full border-none"
            />
        </div>
    );
}
