# Agent rules

## Testing

- `bun test` runs `tsc --noEmit` (typecheck) then `bun test` (unit tests).
- Tests live next to source files as `*.test.ts`.
- Prefer pure-function tests: tabular input/output, no mocks, no network.
- One `describe` per function, `test.each` for cases.

## Commits

- Linear history only. Rebase, never merge.
- Push to `master` when asked.
