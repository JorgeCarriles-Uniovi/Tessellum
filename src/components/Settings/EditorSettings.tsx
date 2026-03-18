import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useState } from "react";

export function EditorSettings() {
    const [fontSize, setFontSize] = useState('16');
    const [lineNumbers, setLineNumbers] = useState(false);
    const [fontFamily, setFontFamily] = useState('Inter');
    const [lineHeight, setLineHeight] = useState('1.6');
    const [letterSpacing, setLetterSpacing] = useState('0');

    const selectStyle = {
        paddingTop: `0.33rem`,
        paddingBottom: `0.33rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`
    }

    return (
        <div className="space-y-6">
            <SettingSection title="Font" description="Customize editor typography">
                <SettingItem label="Font Family">
                    <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                        style={selectStyle}
                    >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Source Sans 3">Source Sans 3</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </SettingItem>
                <SettingItem label="Font Size">
                    <select
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                        className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3d14b8] focus:border-transparent transition-all bg-white cursor-pointer"
                        style={selectStyle}
                    >
                        <option value="14">14px - Small</option>
                        <option value="16">16px - Medium</option>
                        <option value="18">18px - Large</option>
                        <option value="20">20px - Extra Large</option>
                    </select>
                </SettingItem>
                <SettingItem label="Line Height">
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="1.2"
                            max="2"
                            step="0.1"
                            value={lineHeight}
                            onChange={(e) => setLineHeight(e.target.value)}
                            className="w-40"
                        />
                        <span className="text-xs text-[#64748b] w-10">{lineHeight}</span>
                    </div>
                </SettingItem>
                <SettingItem label="Letter Spacing">
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="0.2"
                            step="0.01"
                            value={letterSpacing}
                            onChange={(e) => setLetterSpacing(e.target.value)}
                            className="w-40"
                        />
                        <span className="text-xs text-[#64748b] w-10">{letterSpacing}</span>
                    </div>
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
                    onChange={() => { }}
                />
                <ToggleSetting
                    label="Vim mode"
                    description="Enable Vim keyboard bindings"
                    checked={false}
                    onChange={() => { }}
                />
            </SettingSection>
        </div>
    )
}
