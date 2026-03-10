import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useTagAutocomplete() {
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const allTags = await invoke<string[]>('get_all_tags');
                setTags(allTags);
            } catch (err) {
                console.error('Failed to fetch tags:', err);
            }
        };

        fetchTags();
    }, []);

    const filterTags = (query: string): string[] => {
        if (!query) return tags;
        const lowerQuery = query.toLowerCase();
        return tags.filter(t => t.toLowerCase().includes(lowerQuery));
    };

    return { tags, filterTags };
}
