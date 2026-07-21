import {create} from "zustand";
import {persist} from "zustand/middleware";

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
            partialize: (s) => ({ providerConfig: s.providerConfig }),
        }
    )
);
