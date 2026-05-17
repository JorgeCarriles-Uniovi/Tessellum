type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export async function listen<T = unknown>(event: string, handler: (payload: T) => void): Promise<() => Promise<void>> {
    const listener = () => handler(undefined as T);
    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }
    listeners.get(event)!.add(listener);
    return async () => {
        listeners.get(event)?.delete(listener);
    };
}

export function emitEvent(event: string): void {
    const handlers = listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler());
}