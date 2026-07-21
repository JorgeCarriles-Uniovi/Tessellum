# Installed RAM Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document a manual process for measuring RAM usage on the installed Tessellum desktop application after opening a representative vault.

**Architecture:** Reuse the existing PowerShell RAM sampling script and extend its README with a dedicated installed-build workflow. Keep the change documentation-only so the measurement method stays centralized in one place.

**Tech Stack:** Markdown, PowerShell

---

### Task 1: Add installed-build RAM measurement guidance

**Files:**
- Modify: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\scripts\measure-ui-ram\README.md`
- Reference: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\scripts\measure-ui-ram\measure-ui-ram.ps1`

- [ ] **Step 1: Inspect the current README and script parameters**

Read:
- `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\scripts\measure-ui-ram\README.md`
- `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\scripts\measure-ui-ram\measure-ui-ram.ps1`

Confirm that the documentation will only use supported parameters:
- `-MatchTitle`
- `-IncludeChildren`
- `-DurationSeconds`
- `-IntervalSeconds`
- `-CsvPath`

- [ ] **Step 2: Update the README with the installed-build manual test**

Add a new section that states:
- The application must be the installed build, not `tauri dev`
- The tester should open a representative vault
- The tester should wait for indexing and startup activity to settle before sampling
- The recommended command should match by window title and include child processes
- The tester should record peak and average working set/private memory values

Add this command to the README:

```powershell
.\scripts\measure-ui-ram\measure-ui-ram.ps1 -MatchTitle "Tessellum" -IncludeChildren -DurationSeconds 60 -IntervalSeconds 1
```

Add this optional CSV export command:

```powershell
.\scripts\measure-ui-ram\measure-ui-ram.ps1 -MatchTitle "Tessellum" -IncludeChildren -DurationSeconds 60 -IntervalSeconds 1 -CsvPath ".\ram-samples.csv"
```

- [ ] **Step 3: Verify the documentation matches the script**

Run:

```powershell
Select-String -Path "C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\scripts\measure-ui-ram\measure-ui-ram.ps1" -Pattern "MatchTitle|IncludeChildren|DurationSeconds|IntervalSeconds|CsvPath"
```

Expected:
- Output includes each documented parameter name
- No undocumented flags are required by the new procedure

- [ ] **Step 4: Review the updated README for clarity**

Check that the new section clearly answers:
- When to measure
- Which command to run
- Which numbers to record
- What to do if the window title does not match exactly

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-06-02-installed-ram-measurement.md scripts/measure-ui-ram/README.md
git commit -m "docs: document installed RAM measurement workflow"
```
