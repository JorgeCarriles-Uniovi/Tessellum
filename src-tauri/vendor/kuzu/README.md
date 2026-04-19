# Kuzu prebuilt binaries

Place precompiled Kuzu artifacts in this directory to skip CMake compilation in Rust builds.

## Layout

Use one folder per target triple:

- `src-tauri/vendor/kuzu/x86_64-apple-darwin/`
- `src-tauri/vendor/kuzu/aarch64-apple-darwin/`
- `src-tauri/vendor/kuzu/x86_64-unknown-linux-gnu/`
- `src-tauri/vendor/kuzu/aarch64-unknown-linux-gnu/`
- `src-tauri/vendor/kuzu/x86_64-pc-windows-msvc/`

Each target folder must contain:

- `lib/` with:
  - macOS: `libkuzu.dylib`
  - Linux: `libkuzu.so`
  - Windows: `kuzu_shared.dll`
- `include/` with Kuzu headers used by the Rust crate (for example `kuzu.h`).

## How it is used

The `scripts/run-tauri-with-kuzu-prebuilt.mjs` script sets:

- `KUZU_LIBRARY_DIR`
- `KUZU_INCLUDE_DIR`
- `KUZU_SHARED=1`

When the expected files are missing, build automatically falls back to the default source build from the `kuzu` crate.

