export async function open(): Promise<string | null> {
    const selection = window.__E2E__?.dialogSelection ?? window.__E2E__?.seed?.vaultPath ?? null;
    return selection ?? null;
}
