import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [react()],
    css: {
        postcss: './postcss.config.js', // Optional, Vite uses this by default
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        clearMocks: true,
        restoreMocks: true,
        testTimeout: 10000,
        hookTimeout: 10000,
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 3000,
        strictPort: true,
        host: (host != null) || false,
        hmr: (host != null)
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
