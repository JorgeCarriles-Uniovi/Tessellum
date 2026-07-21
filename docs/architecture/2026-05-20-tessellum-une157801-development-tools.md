# Development Tools and Additional Systems

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

## 1. Objective and Scope

This document provides a comprehensive description of all development tools, integrated development environments (IDEs), toolchains, complementary software, and additional systems required for the implementation, compilation, and testing of the Tessellum project.

In compliance with the **UNE 157801** engineering standard, this specification clearly establishes the versioning, purpose, and interaction of each software product with the main system, ensuring that the development environment is fully reproducible by any software engineer or auditor.

---

## 2. Integrated Development Environments (IDEs)

Due to Tessellum's decoupled architecture (a React/TypeScript frontend and a Rust/Tauri backend), the development workflow utilizes specialized IDEs optimized for each specific technology stack.

### 2.1. RustRover
- **Provider**: JetBrains
- **Version**: 2026.1 (or compatible)
- **Purpose**: Primary IDE for the backend subsystem.
- **Interaction with the System**: RustRover is used exclusively for writing, analyzing, and debugging the Rust backend codebase located in the `src-tauri` directory. It provides advanced code completion, memory safety analysis, borrow checker visualizations, and deep integration with Cargo (the Rust package manager). It is essential for developing the SQLite database models, the Tantivy search indexing engine, and the Grafeo projection logic.

### 2.2. Visual Studio Code (VS Code)
- **Provider**: Microsoft
- **Version**: 1.90+ (or compatible)
- **Purpose**: Primary IDE for the frontend subsystem and project configuration.
- **Interaction with the System**: VS Code is used to author the React components, TypeScript interfaces, and Tailwind CSS styles located in the `src` directory. It integrates tightly with the Node.js ecosystem, providing ESLint code linting, Prettier formatting, and Vitest test execution. It is also used to manage JSON configuration files, GitHub Actions CI workflows, and the Cypress E2E test suites.

---

## 3. Programming Languages and Toolchains

### 3.1. Rust Toolchain
- **Version**: `1.95.0` (Stable channel)
- **Components**: `rustc` (compiler), `cargo` (package manager), `rustfmt` (formatter), `clippy` (linter).
- **Purpose**: Compiles the native backend binaries.
- **Interaction with the System**: The Rust compiler translates the `src-tauri` source code into highly optimized native machine code. `Cargo` resolves all backend dependencies defined in `Cargo.toml` (e.g., `sqlx`, `tantivy`, `grafeo`) and orchestrates the compilation of the final executable file.

### 3.2. Node.js and npm
- **Version**: Node.js `v24.14.x` (LTS), npm `v10.x`
- **Purpose**: JavaScript runtime environment and package manager for frontend dependencies.
- **Interaction with the System**: Node.js executes the build scripts, local development servers, and testing frameworks. `npm` resolves and downloads all frontend dependencies defined in `package.json` (e.g., `react`, `cytoscape`, `zustand`) into the `node_modules` directory, enabling the compilation of the web assets.

---

## 4. Application Frameworks and Build Tools

### 4.1. Tauri CLI
- **Version**: `2.x`
- **Purpose**: Cross-platform application packager and IPC bridge generator.
- **Interaction with the System**: The Tauri CLI acts as the master orchestrator for the build process. When `npm run tauri build` is executed, the CLI commands Vite to bundle the frontend, commands Cargo to compile the Rust backend, embeds the frontend web assets into the compiled binary, and packages the final logical media (e.g., an MSI installer for Windows or an AppImage for Linux).

### 4.2. Vite
- **Version**: `6.4.x`
- **Purpose**: Frontend build tool and local development server.
- **Interaction with the System**: Vite compiles the TypeScript code, processes the Tailwind CSS classes via PostCSS, and bundles the React application into static HTML, JS, and CSS assets inside the `dist` folder. During development, it provides extremely fast Hot Module Replacement (HMR) to instantly reflect UI changes in the running Tauri application window.

---

## 5. Testing and Quality Assurance Tools

### 5.1. Cypress
- **Version**: `13.12.x`
- **Purpose**: End-to-End (E2E) and integration testing framework.
- **Interaction with the System**: Cypress runs a headless Chromium browser to simulate automated user journeys (e.g., creating notes, searching, navigating the graph). Since Cypress cannot execute native Tauri commands, it interacts with the system through the `src/e2e/mockBackend.ts` simulated environment, ensuring the frontend logic works perfectly before native compilation.

### 5.2. Vitest
- **Version**: `4.1.x`
- **Purpose**: Unit testing framework for the frontend.
- **Interaction with the System**: Vitest executes isolated tests for pure functions, React components, and custom hooks using a `jsdom` virtual browser environment. It provides code coverage metrics and ensures the stability of individual modules (e.g., markdown parsing logic, date formatters).

---

## 6. Version Control and CI/CD Systems

### 6.1. Git
- **Version**: `2.40+`
- **Purpose**: Distributed version control system.
- **Interaction with the System**: Git tracks every modification in the Tessellum source code, enabling branch-based development for new features and bug fixes. It acts as the bridge between the local development environments (RustRover/VS Code) and the remote repository.

### 6.2. GitHub Actions
- **Version**: Cloud Service
- **Purpose**: Continuous Integration and Continuous Deployment (CI/CD) automation.
- **Interaction with the System**: GitHub Actions utilizes runner instances configured via the `.github/workflows/tauri-ci.yml` file to automatically compile and test the application on Windows, macOS, and Ubuntu every time new code is pushed to the repository. This guarantees that cross-platform compatibility is maintained without requiring the developer to manually compile on multiple physical machines.

---

## 7. Additional Software and Subsystems

### 7.1. Microsoft Edge WebView2 Runtime
- **Version**: Evergreen (Automatically updated by the OS)
- **Purpose**: Native web rendering engine for Windows environments.
- **Interaction with the System**: Tessellum does not bundle a Chromium instance inside its executable to keep the file size minimal. Instead, the compiled Rust binary delegates all HTML/CSS/JS visual rendering to the WebView2 runtime already installed on modern Windows systems. This runtime acts as the display layer for the React frontend, communicating with the Rust backend through the Tauri IPC bridge.
