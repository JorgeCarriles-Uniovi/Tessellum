# Wave 5 Editor Host and File Tree Plan

## Goal

Implement isolated branch-oriented tests for the remaining editor host and file-tree component layer, then document the wave under the required ISO and IEEE standards.

## Execution Steps

1. Write the Wave 5 design and plan artifacts.
2. Extract pure helper seams from `Editor.tsx` and the autocomplete hooks:
   - `editorViewHelpers.ts`
   - `slashCommandLogic.ts`
   - `wikiLinkSuggestionsLogic.ts`
3. Implement isolated tests for the extracted editor helpers and interaction hooks:
   - `editorHostHelpers.test.ts`
   - `editorInteractionHooks.test.tsx`
4. Implement isolated tests for the editor host components:
   - `editorHostComponents.test.tsx`
   - `Editor.test.tsx`
5. Implement isolated tests for the file-tree component layer:
   - `fileTreeComponents.test.tsx`
6. Run the targeted Wave 5 Vitest command and fix any failing assumptions.
7. Write the Wave 5 standards package and implementation-process record.

## Constraints

- Tests must remain independent.
- Refactors are allowed only when they reduce coupling or cognitive complexity.
- Files without frontend or backend logic remain excluded.
- Assertions should favor behavioral branches over shallow smoke coverage.

## Exit Criteria

- All Wave 5 suites pass locally.
- The helper extraction is integrated into production code without behavior changes.
- Wave 5 documentation is complete and contains no placeholders.
- The implementation matches the Wave 5 scope inventory.
