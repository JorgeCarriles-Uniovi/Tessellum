import type { EventRef, EventCallback } from "./types";

/**
 * Lightweight event emitter powering all plugin event subscriptions.
 *
 * Plugins receive opaque `EventRef` tokens when subscribing; the registry
 * collects them and calls `removeAll()` during plugin unload for automatic cleanup.
 */
export class EventBus {
    private listeners = new Map<string, Map<number, EventCallback>>();
    private nextId = 0;

    /** Subscribe to an event. Returns an opaque ref for unsubscription. */
    on(event: string, callback: EventCallback): EventRef {
        const id = this.nextId++;
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Map());
        }
        this.listeners.get(event)!.set(id, callback);
        return { _id: id, _event: event };
    }

    /** Unsubscribe a single event ref. */
    off(ref: EventRef): void {
        const listeners = this.listeners.get(ref._event);
        if (listeners) {
            listeners.delete(ref._id);
            if (listeners.size === 0) {
                this.listeners.delete(ref._event);
            }
        }
    }

    emit(event: string, ...args: any[]): void {
        const listeners = this.listeners.get(event);
        if (!listeners) return;
        for (const callback of listeners.values()) {
            try {
                callback(...args);
            } catch (err) {
                console.error(`[EventBus] Error in listener for "${event}":`, err);
            }
        }
    }

    /** Batch-unsubscribe a list of refs. Used by Plugin._cleanup(). */
    removeAll(refs: EventRef[]): void {
        for (const ref of refs) {
            this.off(ref);
        }
    }
}
