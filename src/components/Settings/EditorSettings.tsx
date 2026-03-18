import {SettingSection} from "./items/SettingSection.tsx";
import {SettingItem} from "./items/SettingItem.tsx";
import {ToggleSetting} from "./items/ToggleSetting.tsx";

export function EditorSettings({fontSize, setFontSize, lineNumbers, setLineNumbers}: { fontSize: string; setFontSize: (value: string) => void; lineNumbers: boolean; setLineNumbers: (value: boolean) => void }) {
    return (
        <div className="space-y-6">
            <SettingSection title="Font" description="Customize editor typography">
                <SettingItem label="Font Size">
                    <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                    >
                        <option value="14">14px - Small</option>
                        <option value="16">16px - Medium</option>
                        <option value="18">18px - Large</option>
                        <option value="20">20px - Extra Large</option>
                    </select>
                </SettingItem>
            </SettingSection>

            <SettingSection title="Display" description="Editor display options">
                <ToggleSetting
                    label="Show line numbers"
                    description="Display line numbers in the editor"
                    checked={lineNumbers}
                    onChange={setLineNumbers}
                />
                <ToggleSetting
                    label="Word wrap"
                    description="Wrap long lines automatically"
                    checked={true}
                    onChange={() => {}}
                />
                <ToggleSetting
                    label="Vim mode"
                    description="Enable Vim keyboard bindings"
                    checked={false}
                    onChange={() => {}}
                />
            </SettingSection>
        </div>
    )
}