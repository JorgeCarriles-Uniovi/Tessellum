# Section 8: Development Environment and Standards

## Tessellum: Local-First Knowledge Management & Visualization Platform
**Universidad de Oviedo | Escuela de Ingeniería Informática | Trabajo Fin de Grado**
- **Author**: Jorge Carriles Ruiz
- **Standard Reference**: Aligned with UNE 157801:2014 ("Criterios generales para la elaboración de proyectos de sistemas de información")

---

## 8.1 Standards and Norms Followed

During the development of Tessellum, strict coding standards and formatting norms were established and enforced to ensure code quality, maintainability, and security across both the frontend and backend architectures.

**Applied Standards:**
1. **Rust Idiomatic Standards**: The backend adheres to the official Rust API Guidelines. Code formatting strictly follows the `rustfmt` standard, ensuring uniform indentation, spacing, and line lengths across the entire Rust codebase.
2. **TypeScript and React Best Practices**: The frontend codebase complies with modern ECMAScript standards (ES2022+), strict TypeScript typing (avoiding `any` types), and the official Rules of Hooks for React components. Formatting is governed by `Prettier`.
3. **Engineering Documentation**: The project documentation itself follows the guidelines established by the **UNE 157801:2014** norm for IT engineering projects.

**Validation of Standards:**
The compliance of these standards is automatically validated rather than manually checked. A Continuous Integration (CI) pipeline deployed via GitHub Actions (`tauri-ci.yml`) is triggered on every code commit. This pipeline runs:
- `cargo clippy -- -D warnings`: To enforce idiomatic Rust and catch anti-patterns.
- `cargo fmt --check`: To reject code that does not match the formatting standard.
- `eslint` and `prettier --check`: To validate the frontend TypeScript/React code against potential bugs and styling deviations. 
Any violation of these norms causes the pipeline to fail, preventing the code from being merged into the main repository.

---

## 8.2 Programming Languages

Due to Tessellum's decoupled architecture, the system relies on two primary programming languages, each optimized for its specific domain within the application.

### Rust
- **Version**: `1.95.0` (Stable channel)
- **Distribution**: Managed via `rustup`, the official Rust toolchain installer.
- **Purpose**: Rust is used to implement the high-performance native backend. It handles file system operations, background indexing, database queries, and the IPC (Inter-Process Communication) bridge.
- **Key Modules/Crates Employed**: 
  - `tauri`: The core framework for building the desktop application.
  - `sqlx`: Asynchronous SQL toolkit used for SQLite database management.
  - `tantivy`: Full-text search engine library used for note indexing.
  - `grafeo`: Embedded graph database for bidirectional link projections.
  - `serde`: Serialization and deserialization framework for JSON data passing.

### TypeScript
- **Version**: `5.x`
- **Distribution**: Executed and managed via Node.js (`v24.14.x` LTS) and `npm` (`v10.x`).
- **Purpose**: TypeScript is used to develop the entire frontend graphical user interface. It provides static typing over JavaScript, significantly reducing runtime errors in the UI state management.
- **Key Modules/Libraries Employed**:
  - `react`: Core UI rendering library.
  - `tailwindcss`: Utility-first CSS framework for interface styling.
  - `zustand`: Lightweight state management for managing vaults, search queries, and themes.
  - `cytoscape`: Graph theory library used to render the visual knowledge graph.

---

## 8.3 Development Tools and Programs Used

The implementation of Tessellum required a specific set of development tools, IDEs, and supplementary software to manage the dual-stack nature of the application.

**1. JetBrains RustRover**
- **Version**: 2026.1 (or compatible)
- **Purpose & Interaction**: Primary Integrated Development Environment (IDE) for the backend. It interacts natively with the Rust compiler and `Cargo` to provide real-time memory safety analysis, borrow-checker visualizations, and advanced debugging for the `src-tauri` directory.

**2. Visual Studio Code (VS Code)**
- **Version**: 1.90+
- **Purpose & Interaction**: Primary IDE for the frontend subsystem. It interacts with the `npm` ecosystem, utilizing extensions for ESLint, Prettier, and Tailwind CSS intellisense to assist in developing the React components within the `src` directory.

**3. Tauri CLI**
- **Version**: 2.x
- **Purpose & Interaction**: The core application packager. It interacts with both the frontend build system and the Rust compiler. When invoked, it orchestrates the building of the web assets and embeds them into the final native Rust binary executable.

**4. Vite**
- **Version**: 6.4.x
- **Purpose & Interaction**: Frontend build tool and development server. It compiles the TypeScript code and processes PostCSS. During development, it interacts with the Tauri WebView to provide Hot Module Replacement (HMR), instantly reflecting UI changes without needing to recompile the Rust backend.

**5. Cypress & Vitest**
- **Versions**: Cypress `13.12.x` / Vitest `4.1.x`
- **Purpose & Interaction**: Testing frameworks. Cypress is used for End-to-End (E2E) testing, interacting with the system via a simulated mock backend (`mockBackend.ts`) since it cannot access native Tauri APIs. Vitest is used to execute isolated unit tests for the frontend logic.

**6. Git & GitHub Actions**
- **Versions**: Git `2.40+` / GitHub Cloud
- **Purpose & Interaction**: Version control and CI/CD automation. Git tracks all local code changes, while GitHub Actions interacts with the repository by spinning up Windows, macOS, and Ubuntu virtual machines to automatically compile and verify the application across all target platforms.
