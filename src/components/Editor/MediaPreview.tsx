import { convertFileSrc } from "@tauri-apps/api/core";
import { isImageFile, isPdfFile } from "../../utils/fileType";
import { theme } from "../../styles/theme";

interface MediaPreviewProps {
    path: string;
}

export function MediaPreview({ path }: MediaPreviewProps) {
    const src = convertFileSrc(path);

    if (isImageFile(path)) {
        return (
            <div className="h-full w-full flex items-center justify-center p-8 overflow-auto" style={{ backgroundColor: "var(--color-panel-footer)" }}>
                <img
                    src={src}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain shadow-lg rounded-sm"
                />
            </div>
        );
    }

    if (isPdfFile(path)) {
        return (
            <div className="h-full w-full" style={{ backgroundColor: "var(--color-panel-footer)" }}>
                <iframe
                    src={`${src}#view=FitH&toolbar=1`}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full flex items-center justify-center select-none">
            <div
                className="text-center space-y-3"
                style={{ color: theme.colors.text.muted, maxWidth: "720px", margin: "0 auto" }}
            >
                <div className="text-lg font-semibold" style={{ color: theme.colors.text.secondary }}>
                    Preview not available for this file type
                </div>
                <div className="text-sm">
                    {path.split(/[\\/]/).pop()}
                </div>
            </div>
        </div>
    );
}
