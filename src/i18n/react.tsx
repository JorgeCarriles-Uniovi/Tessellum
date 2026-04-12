import { useEffect, useState, type PropsWithChildren } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { appI18n, getPluginNamespace, i18nReady } from "./index.ts";
import { useSettingsStore } from "../stores/settingsStore.ts";

function I18nBootstrap({ children }: PropsWithChildren) {
    const locale = useSettingsStore((state) => state.locale);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let mounted = true;

        void i18nReady.then(async () => {
            await appI18n.setLocale(locale);
            if (mounted) {
                setReady(true);
            }
        });

        return () => {
            mounted = false;
        };
    }, [locale]);

    if (!ready) {
        return null;
    }

    return <>{children}</>;
}

export function AppI18nProvider({ children }: PropsWithChildren) {
    return (
        <I18nextProvider i18n={appI18n.getI18nInstance()}>
            <I18nBootstrap>{children}</I18nBootstrap>
        </I18nextProvider>
    );
}

export function useAppTranslation(namespace = "core") {
    return useTranslation(namespace);
}

export function usePluginTranslation(pluginId: string) {
    return useTranslation(getPluginNamespace(pluginId));
}
