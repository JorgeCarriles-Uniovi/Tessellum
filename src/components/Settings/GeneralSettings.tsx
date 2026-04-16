import { SettingSection } from "./items/SettingSection.tsx";
import { SettingItem } from "./items/SettingItem.tsx";
import { ToggleSetting } from "./items/ToggleSetting.tsx";
import { useSettingsStore } from "../../stores";
import { useAppTranslation } from "../../i18n/react.tsx";

export function GeneralSettings() {
    //const [autoSave, setAutoSave] = useState(true);
    const spellCheck = useSettingsStore((state) => state.spellCheck);
    const setSpellCheck = useSettingsStore((state) => state.setSpellCheck);
    const locale = useSettingsStore((state) => state.locale);
    const setLocale = useSettingsStore((state) => state.setLocale);
    const { t } = useAppTranslation("settings");
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
            <SettingSection title={t("general.languageTitle")} description={t("general.languageDescription")}>
                <SettingItem label={t("general.languageLabel")}>
                    <div className="space-y-3">
                        <select
                            value={locale}
                            onChange={(event) => setLocale(event.target.value as typeof locale)}
                            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"
                            style={inputStyle}
                        >
                            <option value="en">{t("general.locale.en")}</option>
                            <option value="es">{t("general.locale.es")}</option>
                        </select>
                    </div>
                </SettingItem>
            </SettingSection>

            {/*<SettingSection title={t("general.profileTitle")} description={t("general.profileDescription")}>*/}
            {/*    <SettingItem label={t("general.displayName")}>*/}
            {/*        <input*/}
            {/*            type="text"*/}
            {/*            defaultValue="DevAdmin"*/}
            {/*            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"*/}
            {/*            style={inputStyle}*/}
            {/*        />*/}
            {/*    </SettingItem>*/}
            {/*    <SettingItem label={t("general.email")}>*/}
            {/*        <input*/}
            {/*            type="email"*/}
            {/*            defaultValue="admin@workspace.com"*/}
            {/*            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] focus:border-transparent transition-all"*/}
            {/*            style={inputStyle}*/}
            {/*        />*/}
            {/*    </SettingItem>*/}
            {/*</SettingSection>*/}

            <SettingSection title={t("general.workspaceTitle")} description={t("general.workspaceDescription")}>
                {/*<ToggleSetting*/}
                {/*    label={t("general.autoSave")}*/}
                {/*    description={t("general.autoSaveDescription")}*/}
                {/*    checked={autoSave}*/}
                {/*    onChange={setAutoSave}*/}
                {/*/>*/}
                <ToggleSetting
                    label={t("general.spellCheck")}
                    description={t("general.spellCheckDescription")}
                    checked={spellCheck}
                    onChange={setSpellCheck}
                />
            </SettingSection>
        </div>
    );
}
