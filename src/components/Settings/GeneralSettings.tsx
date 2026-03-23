import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useState } from "react";

export function GeneralSettings() {
    const [autoSave, setAutoSave] = useState(true);
    const [spellCheck, setSpellCheck] = useState(true);
    const inputStyle = {
        paddingTop: `0.5rem`,
        paddingBottom: `0.5rem`,
        paddingLeft: `1rem`,
        paddingRight: `1rem`,
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-primary)",
    };

    return (
        <div className="space-y-6">
            <SettingSection title="Profile" description="Manage your profile information">
                <SettingItem label="Display Name">
                    <input
                        type="text"
                        defaultValue="DevAdmin"
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                        style={inputStyle}
                    />
                </SettingItem>
                <SettingItem label="Email">
                    <input
                        type="email"
                        defaultValue="admin@workspace.com"
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                        style={inputStyle}
                    />
                </SettingItem>
            </SettingSection>

            <SettingSection title="Workspace" description="Configure workspace settings">
                <ToggleSetting
                    label="Auto-save"
                    description="Automatically save changes as you type"
                    checked={autoSave}
                    onChange={setAutoSave}
                />
                <ToggleSetting
                    label="Spell check"
                    description="Check spelling as you type"
                    checked={spellCheck}
                    onChange={setSpellCheck}
                />
            </SettingSection>
        </div>
    );
}
