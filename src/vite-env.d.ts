/// <reference types="vite/client" />

declare global {
    interface Window {
        __E2E__?: {
            seed?: {
                vaultPath: string;
                files: Record<string, string>;
            };
            seedVault?: (seed: { vaultPath: string; files: Record<string, string> }) => void;
            dialogSelection?: string | null;
        };
    }
}