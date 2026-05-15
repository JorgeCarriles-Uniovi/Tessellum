import type { StoreApi, UseBoundStore } from "zustand";

type AnyStore = UseBoundStore<StoreApi<object>>;

const trackedStores = new Map<AnyStore, object>();

function cloneResetValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(cloneResetValue);
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [key, cloneResetValue(entryValue)]),
    );
}

function cloneStoreState<T extends object>(state: T): T {
    return Object.fromEntries(
        Object.entries(state).map(([key, value]) => [key, cloneResetValue(value)]),
    ) as T;
}

export function trackStore<T extends object>(store: UseBoundStore<StoreApi<T>>): void {
    if (!trackedStores.has(store as AnyStore)) {
        trackedStores.set(store as AnyStore, cloneStoreState(store.getState()));
    }
}

export function trackStores(...stores: AnyStore[]): void {
    stores.forEach((store) => trackStore(store));
}

export function resetTrackedStores(): void {
    trackedStores.forEach((initialState, store) => {
        store.setState(initialState, true);
    });
    trackedStores.clear();
}
