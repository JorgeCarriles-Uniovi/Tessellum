# Wave 0 Testability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared frontend/backend testing foundation and proof tests needed for later branch-oriented coverage waves.

**Architecture:** Add a shared `vitest` harness for frontend isolation, add a small Rust temp-vault fixture helper for backend tests, and extract pure delete-flow logic from the sidebar hook into a standalone module. Prove the foundation with representative tests and close with standards-aligned Wave 0 documentation.

**Tech Stack:** Vite, Vitest, React Testing Library, jsdom, Zustand, Rust `cargo test`, Tauri, Markdown documentation

---

### Task 1: Frontend Test Harness

**Files:**
- Modify: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\package.json`
- Modify: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\vite.config.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\test\setup.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\test\tauriMocks.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\test\storeIsolation.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\test\renderWithProviders.tsx`

- [ ] **Step 1: Write the failing frontend proof tests**

```tsx
import { describe, expect, it } from "vitest";
import { summarizeFailedTargets } from "../../components/Sidebar/hooks/deleteFileLogic";

describe("deleteFileLogic", () => {
  it("summarizes more than three failed targets", () => {
    expect(
      summarizeFailedTargets([
        { filename: "A.md" },
        { filename: "B.md" },
        { filename: "C.md" },
        { filename: "D.md" },
      ] as never),
    ).toBe("A.md, B.md, C.md and 1 more");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- src\\components\\Sidebar\\hooks\\deleteFileLogic.test.ts`
Expected: FAIL because the harness and module do not exist yet

- [ ] **Step 3: Add the test harness implementation**

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  clearMocks: true,
}
```

- [ ] **Step 4: Run the frontend proof test again**

Run: `cmd /c npm test -- src\\components\\Sidebar\\hooks\\deleteFileLogic.test.ts`
Expected: FAIL only on missing implementation details, not on missing runner setup

### Task 2: Delete Flow Seam Extraction

**Files:**
- Modify: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Sidebar\hooks\useDeleteFile.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Sidebar\hooks\deleteFileLogic.ts`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\Sidebar\hooks\deleteFileLogic.test.ts`

- [ ] **Step 1: Write the failing seam-extraction tests**

```tsx
it("removes descendants when a folder target is present", () => {
  const result = normalizeDeleteTargets([
    { path: "vault/folder", is_dir: true },
    { path: "vault/folder/note.md", is_dir: false },
  ] as never);

  expect(result).toHaveLength(1);
  expect(result[0].path).toBe("vault/folder");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd /c npm test -- src\\components\\Sidebar\\hooks\\deleteFileLogic.test.ts`
Expected: FAIL because helper module is missing

- [ ] **Step 3: Extract the pure helper implementation and wire the hook to it**

```ts
export function normalizeDeleteTargets(candidates: FileMetadata[]): FileMetadata[] {
  // pure helper moved out of the hook
}
```

- [ ] **Step 4: Run the seam-extraction tests**

Run: `cmd /c npm test -- src\\components\\Sidebar\\hooks\\deleteFileLogic.test.ts`
Expected: PASS

### Task 3: Representative Component and Backend Proof Tests

**Files:**
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\InputModal.test.tsx`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src\components\DeleteConfirmModal.test.tsx`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\test_support.rs`
- Modify: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\src-tauri\src\lib.rs`

- [ ] **Step 1: Write the failing component/backend proof tests**

```tsx
it("does not submit blank input", () => {
  // render InputModal and assert onSubmit is not called
});
```

```rust
#[test]
fn seeded_vault_builder_creates_expected_files() {
    let vault = TestVault::new()
        .with_markdown("Inbox/Note.md", "# Note")
        .build();
    assert!(vault.path().join("Inbox/Note.md").exists());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd /c npm test -- src\\components\\InputModal.test.tsx src\\components\\DeleteConfirmModal.test.tsx`
Expected: FAIL before component tests and helpers are implemented

Run: `cargo test --manifest-path src-tauri\\Cargo.toml seeded_vault_builder_creates_expected_files`
Expected: FAIL because backend support helper does not exist yet

- [ ] **Step 3: Add the proof-test implementations and backend support helper**

```rust
pub struct TestVault { /* temp root + builder helpers */ }
```

- [ ] **Step 4: Run the proof tests**

Run: `cmd /c npm test -- src\\components\\InputModal.test.tsx src\\components\\DeleteConfirmModal.test.tsx`
Expected: PASS

Run: `cargo test --manifest-path src-tauri\\Cargo.toml seeded_vault_builder_creates_expected_files`
Expected: PASS

### Task 4: Standards Documentation and Implementation Note

**Files:**
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\docs\qa\2026-04-28-wave0-test-foundation-standards.md`
- Create: `C:\Users\jorge\Desktop\Uniovi\4\TFG\Tessellum\docs\qa\2026-04-28-wave0-implementation-process.md`

- [ ] **Step 1: Write the standards-aligned documentation**

```md
## Test Plan Summary (IEEE 829 Format)
## Frontend Test Design Specification
## Backend Unit Test Notes (IEEE 1008)
## ISO 29119 Process Mapping
```

- [ ] **Step 2: Run full Wave 0 verification**

Run: `cmd /c npm test -- src\\components\\Sidebar\\hooks\\deleteFileLogic.test.ts src\\components\\InputModal.test.tsx src\\components\\DeleteConfirmModal.test.tsx`
Expected: PASS

Run: `cargo test --manifest-path src-tauri\\Cargo.toml`
Expected: PASS

- [ ] **Step 3: Review docs for placeholders and consistency**

Run: `rg -n "T[O]DO|T[B]D|implement\\slater|fill\\sin\\sdetails" docs\\qa docs\\superpowers`
Expected: no matches in new Wave 0 documents
