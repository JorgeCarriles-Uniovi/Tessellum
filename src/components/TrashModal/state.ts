type TrashItemLike = {
    path: string;
};

export function shouldShowTrashLoading(isLoading: boolean, itemCount: number): boolean {
    return isLoading && itemCount === 0;
}

export function removeTrashItem<T extends TrashItemLike>(items: T[], path: string): T[] {
    return items.filter((item) => item.path !== path);
}
