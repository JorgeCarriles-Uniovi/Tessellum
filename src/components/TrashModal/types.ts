export interface TrashItem {
    path: string;
    filename: string;
    display_name: string;
    original_name: string;
    parent_label: string;
    restore_path: string;
    is_dir: boolean;
    timestamp: number;
}
