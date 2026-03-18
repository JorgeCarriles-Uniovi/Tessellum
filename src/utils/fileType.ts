export const IMAGE_EXTENSIONS = [
    "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff", "avif"
];

export const PDF_EXTENSIONS = ["pdf"];

export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...PDF_EXTENSIONS];

export function getFileExtension(path: string): string {
    return path.split('.').pop()?.toLowerCase() || "";
}

export function isImageFile(path: string): boolean {
    return IMAGE_EXTENSIONS.includes(getFileExtension(path));
}

export function isPdfFile(path: string): boolean {
    return PDF_EXTENSIONS.includes(getFileExtension(path));
}

export function isMediaFile(path: string): boolean {
    return MEDIA_EXTENSIONS.includes(getFileExtension(path));
}