import {useEffect, useRef, useState} from "react";
import {SettingSection} from "./items/SettingSection";
import {SelectSetting} from "./items/SelectSetting";
import {TextInputSetting} from "./items/TextInputSetting";
import {SettingStatus} from "./items/SettingStatus";
import {useAIStore, persistAiSecret} from "../../stores/aiStore";

const API_KEY_WRITE_DEBOUNCE_MS = 500;

export function AISettings() {
    const providerConfig = useAIStore((s) => s.providerConfig);
    const setProviderConfig = useAIStore((s) => s.setProviderConfig);

    // Local field state, mirroring SyncSettings' pattern: `hydrateAiSecret()`
    // resolves asynchronously at startup, so binding the input directly to
    // `providerConfig.api_key` risks a key typed before hydration lands being
    // clobbered in memory once the keychain value arrives. `apiKeyDirty` is
    // the same "user actually touched it" guard used there.
    const [apiKey, setApiKey] = useState(providerConfig.api_key ?? "");
    const [apiKeyDirty, setApiKeyDirty] = useState(false);
    const [keyStatus, setKeyStatus] = useState<string | null>(null);
    const writeTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (providerConfig.api_key && !apiKeyDirty) {
            setApiKey(providerConfig.api_key);
        }
    }, [providerConfig.api_key, apiKeyDirty]);

    // Flush a pending debounced write immediately on unmount (e.g. the user
    // navigates away from Settings right after typing) rather than losing it.
    useEffect(() => {
        return () => {
            if (writeTimeoutRef.current !== null) {
                window.clearTimeout(writeTimeoutRef.current);
                void persistAiSecret();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApiKeyChange = (value: string) => {
        setApiKey(value);
        setApiKeyDirty(true);
        setKeyStatus(null);
        setProviderConfig({api_key: value || undefined});

        // Debounce the keychain write: it used to fire on every keystroke,
        // which is one OS credential-store round trip per character typed.
        if (writeTimeoutRef.current !== null) {
            window.clearTimeout(writeTimeoutRef.current);
        }
        writeTimeoutRef.current = window.setTimeout(() => {
            writeTimeoutRef.current = null;
            void persistAiSecret().then((ok) => {
                if (!ok) {
                    setKeyStatus("Error: couldn't save the API key to the credential store. It will not persist after restart.");
                }
            });
        }, API_KEY_WRITE_DEBOUNCE_MS);
    };

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
                    <>
                        <TextInputSetting
                            label="API Key"
                            description="Stored in your operating system's credential manager. Not sent to any server other than the API endpoint above."
                            type="password"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                            placeholder={providerConfig.kind === "claude" ? "sk-ant-…" : "sk-…"}
                            autoComplete="new-password"
                        />
                        <div style={{ paddingLeft: "1rem", paddingRight: "1rem" }}>
                            <SettingStatus message={keyStatus} error={!!keyStatus} />
                        </div>
                    </>
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
