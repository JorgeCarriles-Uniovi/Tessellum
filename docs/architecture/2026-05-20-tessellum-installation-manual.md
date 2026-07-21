---
tags: ["documentation", "installation-manual", "une-157801"]
type: "installation_manual"
suite: "une_157801"
document_role: "installation"
app: "tessellum"
language: "en"
---
# Tessellum Installation Manual

## Formal Installation Manual
**Universidad de Oviedo | Escuela de Ingenieria Informatica | Trabajo Fin de Grado**  
**Application**: Tessellum  
**Document purpose**: End-user installation and deployment manual  
**Reference context**: UNE 157801 documentation set

> [!info] Purpose of this manual
> This document is part of the Tessellum UNE 157801 documentation set. It explains how to install, start, update, and uninstall Tessellum on Windows, macOS, and Linux, and it is intended for final users and evaluators who need a clear, reproducible installation procedure.

---

## 1. Introduction

Tessellum is a local-first desktop application for Markdown note-taking, knowledge organization, search, and graph visualization. It is distributed as a native desktop application built with Tauri and is packaged for the three main desktop operating system families:

- Windows
- macOS
- Linux

The application stores user notes inside a user-selected vault folder and maintains its local indexes and runtime metadata on the local machine.

This manual describes:

- the minimum installation conditions;
- the package formats expected for each platform;
- the installation steps for standard end users;
- the first launch procedure;
- update and removal procedures;
- a source-build path for technical users.

---

## 2. Distribution Formats

According to the project release pipeline, Tessellum may be distributed in one or more of the following native package formats:

| Platform | Expected package formats |
| --- | --- |
| Windows | `.exe`, `.msi` |
| macOS | `.dmg`, `.app.tar.gz` |
| Linux | `.deb`, `.rpm`, `.AppImage` |

> [!tip] Recommended choice
> If several packages are available for your operating system, use the most native installer format first:
> - Windows: `.msi`
> - macOS: `.dmg`
> - Linux: `.deb` for Debian/Ubuntu, `.rpm` for Fedora/openSUSE/RHEL-compatible systems, and `.AppImage` when no native package fits your distribution.

---

## 3. Minimum Installation Requirements

### 3.1 General hardware baseline

The target host machine should satisfy at least the following baseline:

- 64-bit operating system
- 16 GB RAM recommended
- SSD storage recommended
- at least 500 MB of available free disk space for the application, local indexes, and user-generated auxiliary data

### 3.2 Operating system baseline

The installation target should match one of the following environments:

- **Windows**: Windows 11 64-bit recommended
- **macOS**: recent supported macOS release on Apple Silicon or Intel
- **Linux**: modern 64-bit desktop distribution with a graphical environment

### 3.3 Runtime dependencies

Tessellum is packaged as a desktop application, but some platform runtime components matter:

- **Windows**: Microsoft Edge WebView2 must be available. Tessellum is configured to use an embedded bootstrapper in the Windows bundle, which helps install or resolve WebView2 automatically when needed.
- **macOS**: no extra browser runtime is normally required beyond the system WebKit stack provided by macOS.
- **Linux**: depending on the distribution, the system may require WebKitGTK-related runtime libraries if the package does not install them automatically.

> [!warning] Linux note
> Linux package behavior varies by distribution. Native `.deb` and `.rpm` packages are generally the best option because they integrate with the system package manager and usually resolve dependencies more reliably than manually launching a binary.

---

## 4. Before Installing

Before beginning the installation:

1. Download the correct package for your operating system and processor architecture.
2. Verify that the package comes from the intended project release source.
3. Close other installers or package-management tools that may be updating the system at the same time.
4. Ensure you have permission to install software on the machine.

For managed computers in universities, companies, or public labs, administrative permissions may be required.

---

## 5. Windows Installation

### Recommended package

The recommended Windows package is:

- `Tessellum_<version>_x64_en-US.msi` or equivalent `.msi` installer

If the `.msi` installer is not available, a packaged `.exe` may also be distributed.

### Installation procedure using `.msi`

1. Locate the downloaded `.msi` file.
2. Double-click the installer.
3. If Windows asks for confirmation, allow the installer to run.
4. Follow the installation wizard.
5. Accept the destination folder or choose a custom installation location if the installer allows it.
6. Complete the installation.
7. Start Tessellum from the Start menu or the created desktop shortcut.

### Installation procedure using `.exe`

1. Locate the downloaded `.exe` installer.
2. Double-click the file.
3. Confirm the security prompt if you trust the origin of the installer.
4. Follow the installation steps displayed by the installer.
5. Finish the setup and open Tessellum.

### WebView2 behavior on Windows

Tessellum depends on Microsoft Edge WebView2 for rendering the interface. On Windows, the application bundle is configured to use an embedded WebView2 bootstrapper.

From the user point of view, this means:

- if WebView2 is already present, installation usually continues normally;
- if WebView2 is missing, the installer may request or trigger its installation;
- in managed or offline environments, installation may fail if runtime installation is blocked by policy.

If the application does not start after installation, confirm that WebView2 is installed on the machine.

### First launch on Windows

After installation:

1. Open Tessellum from the Start menu.
2. Wait for the main window to appear.
3. Choose a vault folder when prompted or use the open-vault action from the interface.
4. Confirm that the application can create and read files in your selected vault location.

### Windows uninstallation

To remove Tessellum:

1. Open `Settings > Apps > Installed apps` on Windows.
2. Search for `Tessellum`.
3. Select `Uninstall`.
4. Follow the removal wizard.

> [!info] User data note
> Uninstalling the application does not automatically guarantee deletion of your vault folder. Your Markdown notes normally remain in the vault location you chose. If you also want to remove your notes, do so manually after confirming you have backups.

---

## 6. macOS Installation

### Recommended package

The recommended macOS package is:

- a `.dmg` disk image

An additional compressed `.app.tar.gz` bundle may also be distributed for technical or manual deployment scenarios.

### Installation procedure using `.dmg`

1. Locate the downloaded `.dmg` file.
2. Double-click the file to mount it.
3. In the mounted window, drag the Tessellum application into the `Applications` folder.
4. Wait for the copy process to finish.
5. Open the `Applications` folder.
6. Launch `Tessellum`.

### First macOS security prompt

Depending on system policy and signing status, macOS may show a security warning the first time you open the application.

If this happens:

1. Try to open Tessellum normally.
2. If macOS blocks the app, open `System Settings > Privacy & Security`.
3. Locate the blocked-app message.
4. Use `Open Anyway` if you trust the package source.
5. Confirm the final prompt.

> [!warning] Institutional devices
> On managed macOS devices, Gatekeeper, MDM policies, or administrator restrictions may block applications installed outside the App Store or outside the approved software catalog.

### Installation procedure using `.app.tar.gz`

This method is primarily for technical users.

1. Extract the `.app.tar.gz` archive.
2. Move the resulting `Tessellum.app` to the `Applications` folder.
3. Open the application from `Applications`.

### First launch on macOS

After installation:

1. Start Tessellum from `Applications` or Spotlight.
2. Select a vault folder when requested.
3. Confirm that the application can read and write inside that folder.

### macOS uninstallation

To remove Tessellum:

1. Open the `Applications` folder.
2. Move `Tessellum.app` to the Trash.
3. Empty the Trash if you want to finalize removal.

Your vault data remains in the folder where you created it unless you delete it manually.

---

## 7. Linux Installation

### Available package types

Linux distributions may receive Tessellum in one or more of these formats:

- `.deb`
- `.rpm`
- `.AppImage`

Choose the package that best matches your distribution.

### Debian, Ubuntu, Linux Mint, Pop!_OS, and compatible systems

Use the `.deb` package when available.

### Graphical method

1. Locate the downloaded `.deb` file.
2. Double-click it.
3. Open it with the system software installer.
4. Approve installation.
5. Wait for the package manager to finish.
6. Launch Tessellum from the applications menu.

### Terminal method

```bash
sudo apt install ./tessellum_<version>_amd64.deb
```

If the exact filename differs, replace it with the actual package name.

### Fedora, RHEL-compatible systems, and openSUSE-compatible workflows

Use the `.rpm` package when available.

### Graphical method

1. Locate the downloaded `.rpm` file.
2. Open it with the system software installer.
3. Confirm installation.
4. Wait for completion.
5. Launch Tessellum from the applications menu.

### Terminal method

For Fedora:

```bash
sudo dnf install ./tessellum-<version>.x86_64.rpm
```

For openSUSE:

```bash
sudo zypper install ./tessellum-<version>.x86_64.rpm
```

### Generic Linux installation using AppImage

Use the `.AppImage` package when a native package is not available for your distribution.

### Installation and first execution

1. Download the `.AppImage` file.
2. Move it to the folder where you want to keep the application.
3. Mark it as executable.
4. Run it.

Example:

```bash
chmod +x Tessellum-<version>.AppImage
./Tessellum-<version>.AppImage
```

Some desktop environments also allow:

1. Right-click the file.
2. Open `Properties`.
3. Enable `Allow executing file as a program`.
4. Double-click the AppImage.

> [!note] AppImage behavior
> An AppImage does not always create a permanent menu entry automatically. Depending on your desktop environment, Tessellum may run directly from the file unless you integrate it with an AppImage launcher or create a desktop shortcut manually.

### Linux runtime dependency considerations

On Linux, graphical desktop applications built on Tauri may require runtime libraries associated with GTK and WebKitGTK. The project's Linux build pipeline installs dependencies such as:

- `libgtk-3`
- `webkit2gtk`
- `javascriptcoregtk`
- `libsoup`
- `libayatana-appindicator`
- `librsvg2`

In most end-user scenarios, native packages should resolve these more cleanly than a manual binary deployment. If the application fails to start, verify that the required runtime libraries are installed for your distribution.

### Linux uninstallation

### For `.deb` packages

```bash
sudo apt remove tessellum
```

### For `.rpm` packages on Fedora

```bash
sudo dnf remove tessellum
```

### For `.rpm` packages on openSUSE

```bash
sudo zypper remove tessellum
```

### For AppImage

Delete the `.AppImage` file manually. If you created shortcuts or integration entries, remove those separately.

As on other platforms, your vault folder remains on disk unless you delete it yourself.

---

## 8. First Start and Initial Configuration

After installing Tessellum on any supported operating system, the initial user workflow is similar.

### First start

1. Open Tessellum.
2. Wait for the main interface to load.
3. Open an existing vault or create a new working folder.
4. Let the application initialize the vault structure.

Tessellum may create support folders such as:

- `.trash`
- `.tessellum/templates`
- `.tessellum/.themes`

These folders are part of the normal application workflow.

### Recommended first checks

After first launch, verify the following:

- the selected vault opens correctly;
- you can create a note;
- you can create a folder;
- the application reopens without errors;
- the Settings panel opens correctly;
- search and graph features initialize normally.

---

## 9. Updating the Application

The exact update process depends on how Tessellum is distributed.

### Manual update model

If Tessellum is distributed as release assets:

1. Download the newer package for your operating system.
2. Close the running application.
3. Install the new version using the same method as the original installation.

Typical behavior:

- `.msi`, `.deb`, and `.rpm` packages usually update the existing installation;
- `.dmg` updates are normally performed by replacing the old application in `Applications`;
- `.AppImage` updates are usually performed by replacing the old AppImage file with the new one.

### Vault safety during updates

Because Tessellum is local-first and stores notes in normal folders, the user vault is independent from the application bundle itself.

This means:

- updating the application should not remove your notes;
- your vault should still be backed up regularly;
- if you use custom themes or templates inside the vault, they remain tied to the vault, not to the installer package.

---

## 10. Installation from Source for Technical Users

This section is not required for normal end users, but it can be useful for developers, evaluators, or advanced users who want to build Tessellum locally.

### Required toolchain

The repository indicates the following prerequisites:

- Node.js 20 or higher
- npm
- Rust stable
- Tauri prerequisites for the target operating system

### Local build procedure

Clone the repository and install frontend dependencies:

```bash
npm install
```

Run the application in development mode:

```bash
npm run tauri dev
```

Build production bundles:

```bash
npm run tauri build
```

The generated bundles are created under the Tauri target release bundle directory.

### Linux source-build note

The release workflow shows that Linux builds require several system development packages related to GTK and WebKitGTK. If a local Linux build fails, install the missing system dependencies for your distribution before retrying.

---

## 11. Troubleshooting

### The installer does not start

Possible causes:

- the downloaded file is incomplete;
- the package format does not match the operating system;
- local security policy blocks external installers.

Recommended actions:

- download the package again;
- confirm the file extension matches your platform;
- run the installer with appropriate permissions;
- obtain the package from the intended release source.

### The application installs but does not open

Possible causes:

- missing runtime dependencies;
- blocked security execution policy;
- incomplete WebView2 availability on Windows;
- missing Linux graphical runtime libraries.

Recommended actions:

- reboot the machine and try again;
- verify WebView2 on Windows;
- review macOS `Privacy & Security`;
- use the native package manager on Linux rather than a manual launch path;
- check whether another application policy is blocking execution.

### The application opens but no vault can be used

Possible causes:

- the selected folder is read-only;
- the user lacks write permissions;
- a network-mounted or controlled directory blocks file creation.

Recommended actions:

- choose a local folder under your user profile;
- confirm you can manually create files in that folder;
- avoid protected system directories.

### The Linux AppImage does not execute

Recommended actions:

- confirm the file has execute permission;
- run it from a terminal to inspect the error;
- prefer the `.deb` or `.rpm` package if available;
- verify that required runtime libraries are installed.

---

## 12. Backup and Data Preservation Considerations

Tessellum stores user content primarily as Markdown files in the selected vault. This has two important consequences:

1. Installing, uninstalling, or updating the application is separate from the note files themselves.
2. Backing up the vault folder is the main data-protection measure for the user.

Recommended practice:

- keep the vault in a folder you can easily back up;
- use an external backup system or synchronized copy if appropriate;
- back up the vault before major operating system or application changes.

---

## 13. Installation Completion Criteria

The installation can be considered successful when all of the following conditions are met:

- Tessellum launches without runtime errors;
- the main interface is visible;
- a vault can be opened or created;
- a note can be created and saved;
- the Settings panel opens correctly;
- the application can be closed and reopened successfully.

---

## 14. Relationship with Companion Manuals

This installation manual should be read together with:

- [2026-05-20-tessellum-execution-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-execution-manual.md), for the operational startup, runtime, and shutdown behavior of the installed application;
- [2026-05-20-tessellum-user-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-user-manual.md), for end-user workflows and interface use;
- [2026-05-20-tessellum-programmers-manual.md](/C:/Users/jorge/Desktop/Uniovi/4/TFG/Tessellum/docs/architecture/2026-05-20-tessellum-programmers-manual.md), for maintenance, extension, and internal technical structure.

Together, these manuals cover deployment, execution, operation, and maintenance.

---

## 15. Final Notes

Tessellum is designed to behave like a native desktop application while preserving the user's notes in a portable local folder structure. For most final users, installation should follow the native conventions of the operating system:

- installer on Windows;
- application copy to `Applications` on macOS;
- package manager or AppImage workflow on Linux.

For the best experience:

- use the package type that matches your operating system directly;
- keep your vault in a writable local folder;
- back up your notes periodically;
- prefer native package formats over generic manual deployment when both are available.
