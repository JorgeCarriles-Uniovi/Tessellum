# Tessellum E2E Suite

This suite drives the Tauri desktop app via `tauri-driver` and WebdriverIO.

## Prerequisites

- Node.js 20+
- Rust stable
- Tauri prerequisites for your OS
- `tauri-driver` installed and on PATH
- A compatible WebDriver for your OS (Windows: msedgedriver)

## Setup

1. Build a desktop binary for the target platform.
2. Start `tauri-driver` in a terminal.
3. Run the E2E tests with the binary path.

## Example (Windows PowerShell)

```powershell
cargo install tauri-driver --locked
npm install
npm run tauri build
$env:TAURI_APP_PATH = "C:\path\to\Tessellum.exe"
$env:TAURI_DRIVER_PORT = "4444"
$env:TAURI_DRIVER_HOST = "127.0.0.1"
# In another terminal: tauri-driver --port 4444
npm run e2e
```

## Notes

- The suite seeds a temporary vault and injects the vault path via `localStorage`.
- If the UI copy changes, update selectors in `e2e/fixtures/appSession.js`.

