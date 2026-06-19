import { SettingSection } from "./items/SettingSection";
import { useAIStore } from "../../stores/aiStore";

export function AISettings() {
    const providerConfig = useAIStore((s) => s.providerConfig);
    const setProviderConfig = useAIStore((s) => s.setProviderConfig);

    const inputStyle = {
        background: "var(--color-background-secondary)",
        border: "1px solid var(--color-border-light)",
        color: "var(--color-text-primary)",
        outline: "none",
        borderRadius: "0.5rem",
        padding: "0.375rem 0.75rem",
        fontSize: "0.8125rem",
        width: "100%",
    } as const;

    return (
        <div className="space-y-6">
            <SettingSection
                title="AI Provider"
                description="Configure the AI provider used by the writing assistant."
            >
                <div className="space-y-4">
                    {/* Provider kind */}
                    <div>
                        <label
                            className="block text-xs font-medium mb-1"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Provider
                        </label>
                        <select
                            value={providerConfig.kind}
                            onChange={(e) =>
                                setProviderConfig({ kind: e.target.value as "ollama" | "openai" })
                            }
                            style={inputStyle}
                        >
                            <option value="ollama">Ollama (local)</option>
                            <option value="openai">OpenAI / compatible API</option>
                        </select>
                    </div>

                    {/* Base URL */}
                    <div>
                        <label
                            className="block text-xs font-medium mb-1"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Base URL
                        </label>
                        <input
                            type="text"
                            value={providerConfig.base_url}
                            onChange={(e) => setProviderConfig({ base_url: e.target.value })}
                            placeholder={
                                providerConfig.kind === "openai"
                                    ? "https://api.openai.com"
                                    : "http://localhost:11434"
                            }
                            style={inputStyle}
                        />
                        <p className="text-[0.6875rem] mt-1" style={{ color: "var(--color-text-muted)" }}>
                            {providerConfig.kind === "ollama"
                                ? "Default Ollama endpoint. Change if running on a different port or host."
                                : "Use https://api.openai.com for OpenAI, or your self-hosted endpoint."}
                        </p>
                    </div>

                    {/* Model */}
                    <div>
                        <label
                            className="block text-xs font-medium mb-1"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            Model
                        </label>
                        <input
                            type="text"
                            value={providerConfig.model}
                            onChange={(e) => setProviderConfig({ model: e.target.value })}
                            placeholder={providerConfig.kind === "ollama" ? "llama3" : "gpt-4o"}
                            style={inputStyle}
                        />
                    </div>

                    {/* API Key (OpenAI only) */}
                    {providerConfig.kind === "openai" && (
                        <div>
                            <label
                                className="block text-xs font-medium mb-1"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                API Key
                            </label>
                            <input
                                type="password"
                                value={providerConfig.api_key ?? ""}
                                onChange={(e) => setProviderConfig({ api_key: e.target.value || undefined })}
                                placeholder="sk-…"
                                style={inputStyle}
                            />
                            <p className="text-[0.6875rem] mt-1" style={{ color: "var(--color-text-muted)" }}>
                                Stored locally in your browser. Not sent to any server other than the API endpoint above.
                            </p>
                        </div>
                    )}
                </div>
            </SettingSection>

            <SettingSection
                title="How to use"
                description="Tips for the AI Writing Assistant."
            >
                <ul
                    className="space-y-1.5 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    <li>• Type <code className="px-1 rounded" style={{ background: "var(--color-background-secondary)" }}>/ai</code> in the editor to open the assistant.</li>
                    <li>• Select text, then click the <strong>AI</strong> button in the selection toolbar to summarise, expand, rephrase, or translate.</li>
                    <li>• Press <strong>Enter</strong> to send your prompt. <strong>Tab</strong> to accept the generated text.</li>
                    <li>• <strong>Ctrl+Enter</strong> regenerates. <strong>Esc</strong> closes the panel.</li>
                    {providerConfig.kind === "ollama" && (
                        <li>• Make sure Ollama is running locally: <code className="px-1 rounded" style={{ background: "var(--color-background-secondary)" }}>ollama serve</code></li>
                    )}
                </ul>
            </SettingSection>
        </div>
    );
}
