import {SettingSection} from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import {ToggleSetting} from "./items/ToggleSetting.tsx";

export function GeneralSettings({ autoSave, setAutoSave, spellCheck, setSpellCheck }: { autoSave: boolean; setAutoSave: (value: boolean) => void; spellCheck: boolean; setSpellCheck: (value: boolean) => void }) {
    return (
        <div className="space-y-6">
            <SettingSection title="Profile" description="Manage your profile information">
                <SettingItem label="Display Name">
                    <input
                        type="text"
                        defaultValue="DevAdmin"
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all"
                    />
                </SettingItem>
                <SettingItem label="Email">
                    <input
                        type="email"
                        defaultValue="admin@workspace.com"
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all"
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