export interface WorkspaceCardItem {
    id: string;
    title: string;
    path: string;
    shortPath: string;
    contentPreview: string;
    tags: string[];
    lastModified: number;
    isActive: boolean;
    order: number;
}

export interface HeroProjection {
    id: string;
    title: string;
    path: string;
    lastModified: number;
    startRect: DOMRect;
    translateX: number;
    translateY: number;
    scaleX: number;
    scaleY: number;
}
