import {SettingSection} from "./items/SettingSection";
import {SelectSetting} from "./items/SelectSetting";
import {TextInputSetting} from "./items/TextInputSetting";
import {useAIStore} from "../../stores/aiStore";

export function AISettings() {
    const providerConfig = useAIStore((s) => s.providerConfig);
    const setProviderConfig = useAIStore((s) => s.setProviderConfig);

    return (
        <div className="space-y-6">
            <SettingSection
                title="AI Provider"
                description="Configure the AI provider used by the writing assistant."
            >
                <SelectSetting
                    label="Provider"
                    value={providerConfig.kind}
                    onChange={(v) => setProviderConfig({kind: v as "ollama" | "openai" | "claude"})}
                >
                    <option value="ollama">Ollama (local)</option>
                    <option value="openai">OpenAI / compatible API</option>
                    <option value="claude">Claude (Anthropic)</option>
                </SelectSetting>

                <TextInputSetting
                    label="Base URL"
                    description={
                        providerConfig.kind === "ollama"
                            ? "Default Ollama endpoint. Change if running on a different port or host."
                            : providerConfig.kind === "claude"
                                ? "Use https://api.anthropic.com, or a compatible proxy endpoint."
                                : "Use https://api.openai.com for OpenAI, or your self-hosted endpoint."
                    }
                    value={providerConfig.base_url}
                    onChange={(v) => setProviderConfig({ base_url: v })}
                    placeholder={
                        providerConfig.kind === "openai"
                            ? "https://api.openai.com"
                            : providerConfig.kind === "claude"
                                ? "https://api.anthropic.com"
                                : "http://localhost:11434"
                    }
                />

                <TextInputSetting
                    label="Model"
                    value={providerConfig.model}
                    onChange={(v) => setProviderConfig({ model: v })}
                    placeholder={
                        providerConfig.kind === "ollama"
                            ? "llama3"
                            : providerConfig.kind === "claude"
                                ? "claude-sonnet-4-6"
                                : "gpt-4o"
                    }
                />

                {(providerConfig.kind === "openai" || providerConfig.kind === "claude") && (
                    <TextInputSetting
                        label="API Key"
                        description="Stored locally in your browser. Not sent to any server other than the API endpoint above."
                        type="password"
                        value={providerConfig.api_key ?? ""}
                        onChange={(v) => setProviderConfig({ api_key: v || undefined })}
                        placeholder={providerConfig.kind === "claude" ? "sk-ant-…" : "sk-…"}
                        autoComplete="new-password"
                    />
                )}
            </SettingSection>

            <SettingSection title="How to use" description="Tips for the AI Writing Assistant.">
                <ul className="space-y-1.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    <li>• Type <code className="px-1 rounded" style={{ background: "var(--color-panel-active)" }}>/ai</code> in the editor to open the assistant.</li>
                    <li>• Select text, then click the <strong>AI</strong> button in the selection toolbar to summarise, expand, rephrase, or translate.</li>
                    <li>• Press <strong>Enter</strong> to send your prompt. <strong>Tab</strong> to accept the generated text.</li>
                    <li>• <strong>Ctrl+Enter</strong> regenerates. <strong>Esc</strong> closes the panel.</li>
                    {providerConfig.kind === "ollama" && (
                        <li>• Make sure Ollama is running locally: <code className="px-1 rounded" style={{ background: "var(--color-panel-active)" }}>ollama serve</code></li>
                    )}
                </ul>
            </SettingSection>
        </div>
    );
}
