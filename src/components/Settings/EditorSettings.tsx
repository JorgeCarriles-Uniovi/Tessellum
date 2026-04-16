import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useEditorContentStore, useSettingsStore } from "../../stores";

import { useAppTranslation } from "../../i18n/react.tsx";

export function EditorSettings() {
    const { t } = useAppTranslation("settings");
    const editorFontSizePx = useEditorContentStore((state) => state.editorFontSizePx);
    const setEditorFontSizePx = useEditorContentStore((state) => state.setEditorFontSizePx);

    const fontFamily = useSettingsStore((state) => state.fontFamily);
    const setFontFamily = useSettingsStore((state) => state.setFontFamily);
    const editorLineHeight = useSettingsStore((state) => state.editorLineHeight);
    const setEditorLineHeight = useSettingsStore((state) => state.setEditorLineHeight);
    const editorLetterSpacing = useSettingsStore((state) => state.editorLetterSpacing);
    const setEditorLetterSpacing = useSettingsStore((state) => state.setEditorLetterSpacing);
    const vimMode = useSettingsStore((state) => state.vimMode);
    const setVimMode = useSettingsStore((state) => state.setVimMode);

    const lineNumbers = useSettingsStore((state) => state.lineNumbers);
    const setLineNumbers = useSettingsStore((state) => state.setLineNumbers);

    const selectStyle = {
        paddingTop: `0.33rem`,
        paddingBottom: `0.33rem`,
        paddingLeft: `0.5rem`,
        paddingRight: `0.5rem`,
        borderColor: "var(--color-border-light)",
        backgroundColor: "var(--color-panel-bg)",
        color: "var(--color-text-primary)",
    };

    return (
        <div className="space-y-6">
            <SettingSection title={t("editor.fontTitle")} description={t("editor.fontDescription")}>
                <SettingItem label={t("editor.fontFamily")}>
                    <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                        style={selectStyle}
                    >
                        <option value="Geist Sans">Geist Sans</option>
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Source Sans 3">Source Sans 3</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Courier New">Courier New</option>
                    </select>
                </SettingItem>
                <SettingItem label={t("editor.fontSize")}>
                    <select
                        value={String(editorFontSizePx)}
                        onChange={(e) => setEditorFontSizePx(Number(e.target.value))}
                        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all cursor-pointer"
                        style={selectStyle}
                    >
                        <option value="14">{t("editor.fontSizeSmall")}</option>
                        <option value="16">{t("editor.fontSizeMedium")}</option>
                        <option value="18">{t("editor.fontSizeLarge")}</option>
                        <option value="20">{t("editor.fontSizeExtraLarge")}</option>
                    </select>
                </SettingItem>
                <SettingItem label={t("editor.lineHeight")}>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="1.2"
                            max="2"
                            step="0.1"
                            value={editorLineHeight}
                            onChange={(e) => setEditorLineHeight(Number(e.target.value))}
                            className="w-40"
                        />
                        <span className="text-xs w-10" style={{ color: "var(--color-text-muted)" }}>{editorLineHeight.toFixed(1)}</span>
                    </div>
                </SettingItem>
                <SettingItem label={t("editor.letterSpacing")}>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="0.2"
                            step="0.01"
                            value={editorLetterSpacing}
                            onChange={(e) => setEditorLetterSpacing(Number(e.target.value))}
                            className="w-40"
                        />
                        <span className="text-xs w-10" style={{ color: "var(--color-text-muted)" }}>{editorLetterSpacing.toFixed(2)}</span>
                    </div>
                </SettingItem>
            </SettingSection>

            <SettingSection title={t("editor.displayTitle")} description={t("editor.displayDescription")}>
                <ToggleSetting
                    label={t("editor.showLineNumbers")}
                    description={t("editor.showLineNumbersDescription")}
                    checked={lineNumbers}
                    onChange={setLineNumbers}
                />
                <ToggleSetting
                    label={t("editor.wordWrap")}
                    description={t("editor.wordWrapDescription")}
                    checked={true}
                    onChange={() => { }}
                />
                <ToggleSetting
                    label={t("editor.vimMode")}
                    description={t("editor.vimModeDescription")}
                    checked={vimMode}
                    onChange={setVimMode}
                />
            </SettingSection>
        </div>
    );
}
