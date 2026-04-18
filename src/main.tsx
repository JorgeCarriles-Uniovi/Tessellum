import React from "react";
import ReactDOM from "react-dom/client";
import './styles/globals.css'
import App from "./App";
import {ErrorBoundary} from "./components/ErrorBoundary.tsx";
import { AppI18nProvider } from "./i18n/react.tsx";
import 'katex/dist/katex.css';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AppI18nProvider>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </AppI18nProvider>
    </React.StrictMode>
);
