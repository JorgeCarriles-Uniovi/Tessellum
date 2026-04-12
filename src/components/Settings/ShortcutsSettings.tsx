import { SettingSection } from "./items/SettingSection.tsx";
import { ShortcutItem } from "./items/ShortcutItem.tsx";
import { useAppTranslation } from "../../i18n/react.tsx";

export function ShortcutsSettings() {
    const { t } = useAppTranslation("settings");

    return (
        <div className="space-y-6">
            <SettingSection title={t("shortcuts.title")} description={t("shortcuts.description")}>
                <div className="space-y-3">
                    <ShortcutItem label={t("shortcuts.newNote")} shortcut="Cmd + N" />
                    <ShortcutItem label={t("shortcuts.quickSearch")} shortcut="Cmd + P" />
                    <ShortcutItem label={t("shortcuts.toggleSidebar")} shortcut="Cmd + B" />
                    <ShortcutItem label={t("shortcuts.openSettings")} shortcut="Cmd + ," />
                    <ShortcutItem label={t("shortcuts.boldText")} shortcut="Cmd + B" />
                    <ShortcutItem label={t("shortcuts.italicText")} shortcut="Cmd + I" />
                </div>
            </SettingSection>
        </div>
    )
}
