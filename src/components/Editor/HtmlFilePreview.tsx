import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { theme } from "../../styles/theme";
import { useVaultStore } from "../../stores/vaultStore";

interface HtmlFilePreviewProps {
    path: string;
}

type PreviewStatus = "checking" | "available" | "unavailable";

/**
 * Whole-file viewer for .html/.htm files, registered by HtmlPreviewPlugin.
 *
 * Renders through `convertFileSrc` rather than a blob URL so relative
 * references inside the document (sibling stylesheets, images) still resolve.
 * The empty `sandbox` attribute blocks script execution entirely on every
 * engine.
 *
 * This frame carries no CSP: the `csp` attribute (CSP Embedded Enforcement)
 * is not usable here — see `EMBEDDED_HTML_CSP`'s docstring in
 * `html-block-plugin.ts` for why it silently breaks asset:// loading on
 * Blink/WebView2. There is no subresource confinement on this surface, so an
 * `<img src="https://tracker/...">` in the document will still fire a
 * request when the frame loads.
 *
 * Availability is checked up front via `validate_preview_file`: browsers do not
 * fire an `error` event on an iframe for navigation failures, so an asset 403
 * (out-of-vault path) or 404 (file deleted between resolution and render) would
 * otherwise show a silent blank frame instead of this fallback. The native
 * `error` listener stays as belt-and-braces for load failures that do fire.
 *
 * The vault path comes from the store rather than a prop because `FileViewer`
 * components are constructed by the plugin registry with `{ path }` only
 * (`src/plugins/api/UIAPI.ts`), and that contract is shared by every viewer.
 */
export function HtmlFilePreview({ path }: HtmlFilePreviewProps) {
    const vaultPath = useVaultStore((s) => s.vaultPath);
    const [status, setStatus] = useState<PreviewStatus>("checking");
    const frameRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let cancelled = false;
        setStatus("checking");

        if (!vaultPath) {
            setStatus("unavailable");
            return;
        }

        invoke<boolean>("validate_preview_file", { vaultPath, path })
            .then((ok) => {
                if (!cancelled) setStatus(ok ? "available" : "unavailable");
            })
            .catch((error) => {
                console.error("Failed to validate HTML preview file:", error);
                if (!cancelled) setStatus("unavailable");
            });

        return () => {
            cancelled = true;
        };
    }, [path, vaultPath]);

    // React's synthetic event system only delegates the `load` event for
    // <iframe> elements, not `error` (see react-dom's setInitialProperties),
    // so a plain `onError` prop never fires here. Attach a native listener
    // directly to the node instead.
    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const handleError = () => setStatus("unavailable");
        frame.addEventListener("error", handleError);
        return () => frame.removeEventListener("error", handleError);
    }, [status]);

    if (status === "checking") {
        return <div className="h-full w-full" style={{ backgroundColor: "var(--color-panel-footer)" }} />;
    }

    if (status === "unavailable") {
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
