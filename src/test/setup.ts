import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetTrackedStores } from "./storeIsolation";
import { resetTauriMocks } from "./tauriMocks";

afterEach(() => {
    cleanup();
    resetTrackedStores();
    resetTauriMocks();
    localStorage.clear();
    sessionStorage.clear();
});
