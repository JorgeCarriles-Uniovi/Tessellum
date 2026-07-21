# Wave 2 Frontend Operational Logic Implementation Process

## Purpose

This note records the actual implementation sequence for Wave 2 so later waves can reuse the same testing pattern for operational frontend logic.

## Step-By-Step Process

1. Freeze Wave 2 around operational logic instead of broad UI coverage.
   - clipboard domain logic
   - graph utilities
   - DOM-writing hooks
   - small state helpers under UI directories

2. Save the Wave 2 design and plan.
   - `docs/superpowers/specs/2026-04-29-wave2-frontend-operational-logic-design.md`
   - `docs/superpowers/plans/2026-04-29-wave2-frontend-operational-logic.md`

3. Add grouped domain suites instead of one test file per source file.
   - clipboard domain
   - graph utilities
   - appearance hook
   - spellcheck hook
   - resizable sidebar hook
   - sidebar context menu helper
   - trash modal helper logic

4. Keep the boundaries deterministic.
   - clipboard tests used injected dependencies or mocked `invoke()`
   - wrapper hooks used mocked translation hooks and mocked toast emitters
   - DOM-writing hooks were verified through `document.documentElement` state and temporary DOM nodes
   - store-backed hooks used the Wave 0 `trackStore()` reset support

5. Run the full Wave 2 slice.
   - the first run exposed one real production defect and several expectation/fixture mismatches

6. Fix the real production defect with the minimum change.
   - `useApplyAppearanceSettings.ts` imported the `../stores` barrel
   - `themeStore.ts` imports `useApplyAppearanceSettings.ts`
   - that created a circular initialization path during theme-store startup
   - the fix was to import concrete store modules directly inside hook files:
     - `useApplyAppearanceSettings.ts`
     - `useApplySpellCheckSettings.ts`
     - `useApplyAccessibilitySettings.ts`

7. Correct the spellcheck fixtures to match the real DOM contract.
   - the contenteditable fixture had to be prepared before hook mount
   - the editor-surface mutation branch worked more reliably with an input-based editor target than with a generic div in `jsdom`
   - the retry-path test needed explicit timer advancement plus a microtask flush instead of a generic `waitFor()` loop under fake timers

8. Re-run the exact same Wave 2 command until the whole slice passed.
   - final result: `7` test files passed and `25` tests passed

9. Write the standards-aligned QA document using the implemented scope and fresh pass evidence.
   - `docs/qa/2026-04-29-wave2-frontend-operational-logic-standards.md`

## Implementation Notes

- Wave 2 required a small production refactor, but only at the import-boundary level.
- No behavior-level production rewrite was needed.
- The tests stayed public-surface oriented even for the DOM-writing hooks.

## Reuse Guidance For Later Waves

- prefer direct store imports over barrel imports inside hook modules that may be referenced by stores
- verify DOM-writing hooks through observable browser state, not internal helper calls
- when fake timers are active, prefer explicit timer advancement and microtask flushing over open-ended waits
- use injected dependencies first before mocking deep runtime internals
