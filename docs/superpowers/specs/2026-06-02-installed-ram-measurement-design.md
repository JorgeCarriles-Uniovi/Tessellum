# Installed RAM Measurement Design

## Goal

Document a manual test that measures Tessellum RAM usage on the installed desktop application, not the development build.

## Scope

- Use the existing PowerShell RAM sampler in `scripts/measure-ui-ram/measure-ui-ram.ps1`.
- Document how to measure memory after opening a representative vault in the installed application.
- Reuse current script options instead of adding a second measurement tool.

## Out Of Scope

- Automated CI enforcement.
- Development-build RAM measurements.
- New RAM sampling scripts.
- Pass/fail thresholds for this change.

## User Scenario

1. Install Tessellum using the normal installer.
2. Launch the installed application.
3. Open a representative vault.
4. Wait for indexing and startup activity to settle.
5. Run the RAM sampling script from the repository.
6. Record the reported memory figures for comparison across runs.

## Design

### Documentation Target

Update `scripts/measure-ui-ram/README.md` with a dedicated section for installed-build measurements.

### Measurement Procedure

The documented manual test will:

1. Instruct the tester to launch the installed application first.
2. Instruct the tester to load a representative vault.
3. Instruct the tester to wait until initial indexing and visible startup work have settled.
4. Recommend matching the running app by window title using `-MatchTitle "Tessellum"` so the procedure does not depend on the installed executable name.
5. Recommend `-IncludeChildren` so WebView child processes are counted when present.
6. Recommend capturing a fixed observation window and optional CSV output for later comparison.

### Recorded Outputs

The tester should record:

- `PeakWorkingSetMiB`
- `AvgWorkingSetMiB`
- `PeakPrivateMemoryMiB`
- `AvgPrivateMemoryMiB`
- Vault identity or dataset description
- Sampling duration and interval

### Error Handling

The documentation should explain:

- If no UI process is found, use `-MatchTitle` or `-ProcessId`.
- If the installed app title differs, adjust the title pattern.
- If deeper inspection is needed, use `-CsvPath` to export raw samples.

## Rationale

This approach keeps cognitive complexity low by reusing the existing script and documenting one clear workflow for installed builds. It avoids duplicate tools, reduces maintenance, and keeps the measurement method comparable between future runs.

## Testing

Because this change is documentation-only, verification should confirm:

- The new procedure matches actual script parameters.
- The commands are syntactically valid PowerShell commands.
- The documented flow is specific to the installed application and representative-vault scenario.
