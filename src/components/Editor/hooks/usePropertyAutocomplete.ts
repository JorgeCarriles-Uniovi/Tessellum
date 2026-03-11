import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function usePropertyAutocomplete() {
    const [properties, setProperties] = useState<string[]>([]);

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                const allKeys = await invoke<string[]>('get_all_property_keys');
                setProperties(allKeys);
            } catch (err) {
                console.error('Failed to fetch property keys:', err);
            }
        };

        fetchProperties();
    }, []);

    const filterProperties = (query: string): string[] => {
        if (!query) return properties;
        const lowerQuery = query.toLowerCase();
        return properties.filter(t => t.toLowerCase().includes(lowerQuery));
    };

    return { properties, filterProperties };
}
