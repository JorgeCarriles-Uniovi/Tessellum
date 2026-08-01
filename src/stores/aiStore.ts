import {create} from "zustand";
import {persist} from "zustand/middleware";
import { getSecret, migratePlaintextSecret, setSecret, SECRET_KEYS } from "../lib/secretStorage";

export interface AiProviderConfig {
    kind: "ollama" | "openai" | "claude";
    base_url: string;
    api_key?: string;
    model: string;
}

export interface AiPanelState {
    isOpen: boolean;
    prompt: string;
    output: string;
    streaming: boolean;
    selectedContext: string;
    providerConfig: AiProviderConfig;
}

export interface AiPanelActions {
    openPanel: (opts?: { prompt?: string; context?: string }) => void;
    closePanel: () => void;
    setPrompt: (prompt: string) => void;
    setOutput: (output: string) => void;
    appendToken: (token: string) => void;
    setStreaming: (streaming: boolean) => void;
    setProviderConfig: (config: Partial<AiProviderConfig>) => void;
    reset: () => void;
}

export type AiStore = AiPanelState & AiPanelActions;

const DEFAULT_CONFIG: AiProviderConfig = {
    kind: "ollama",
    base_url: "http://localhost:11434",
    api_key: undefined,
    model: "llama3",
};

export const useAIStore = create<AiStore>()(
    persist(
        (set) => ({
            isOpen: false,
            prompt: "",
            output: "",
            streaming: false,
            selectedContext: "",
            providerConfig: DEFAULT_CONFIG,

            openPanel: (opts) =>
                set((s) => ({
                    isOpen: true,
                    output: "",
                    streaming: false,
                    prompt: opts?.prompt ?? s.prompt,
                    selectedContext: opts?.context ?? "",
                })),

            closePanel: () => set({ isOpen: false, streaming: false }),

            setPrompt: (prompt) => set({ prompt }),

            setOutput: (output) => set({ output }),

            appendToken: (token) =>
                set((s) => ({ output: s.output + token })),

            setStreaming: (streaming) => set({ streaming }),

            setProviderConfig: (config) =>
                set((s) => ({
                    providerConfig: { ...s.providerConfig, ...config },
                })),

            reset: () => set({ output: "", streaming: false }),
        }),
        {
            name: "tessellum:ai",
            // `api_key` is a billed provider credential. Same rule as the git
            // password in syncStore: memory for the session, OS credential
            // store at rest, never localStorage. Call `hydrateAiSecret()` once
            // at startup to load it.
            partialize: (s) => {
                const { api_key: _apiKey, ...safeProviderConfig } = s.providerConfig;
                return { providerConfig: safeProviderConfig };
            },
        }
    )
);

const AI_STORAGE_KEY = "tessellum:ai";

/**
 * Load the AI provider API key from the OS credential store into memory,
 * migrating any plaintext copy left by an earlier build. Call once at startup.
 */
export async function hydrateAiSecret(): Promise<void> {
    const migrated = await migratePlaintextSecret({
        storageKey: AI_STORAGE_KEY,
        secretKey: SECRET_KEYS.aiApiKey,
        extract: (parsed) =>
            (parsed as { state?: { providerConfig?: { api_key?: string } } })?.state?.providerConfig?.api_key,
        strip: (parsed) => {
            const blob = parsed as { state?: { providerConfig?: Record<string, unknown> } };
            if (blob?.state?.providerConfig) delete blob.state.providerConfig.api_key;
            return blob;
        },
    });

    const apiKey = migrated ?? (await getSecret(SECRET_KEYS.aiApiKey));
    if (apiKey) {
        useAIStore.setState((s) => ({ providerConfig: { ...s.providerConfig, api_key: apiKey } }));
    }
}

/** Write the current in-memory API key through to the OS credential store. */
export async function persistAiSecret(): Promise<void> {
    await setSecret(SECRET_KEYS.aiApiKey, useAIStore.getState().providerConfig.api_key ?? "");
}
