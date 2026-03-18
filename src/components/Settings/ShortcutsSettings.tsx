import {SettingSection} from "./items/SettingSection.tsx";
import {ShortcutItem} from "./items/ShortcutItem.tsx";

export function ShortcutsSettings() {
    return (
        <div className="space-y-6">
            <SettingSection title="Keyboard Shortcuts" description="Customize keyboard shortcuts">
                <div className="space-y-3">
                    <ShortcutItem label="New note" shortcut="Cmd + N" />
                    <ShortcutItem label="Quick search" shortcut="Cmd + P" />
                    <ShortcutItem label="Toggle sidebar" shortcut="Cmd + B" />
                    <ShortcutItem label="Open settings" shortcut="Cmd + ," />
                    <ShortcutItem label="Bold text" shortcut="Cmd + B" />
                    <ShortcutItem label="Italic text" shortcut="Cmd + I" />
                </div>
            </SettingSection>
        </div>
    )
}