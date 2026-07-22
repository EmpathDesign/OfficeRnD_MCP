# Agent Instructions

Guidelines for AI coding agents working on this repository.

## CI Pipeline

Every pull request must pass all four steps of the CI pipeline (defined in
`.github/workflows/ci.yml`). **Run all four checks locally before committing**
to avoid avoidable build failures:

```bash
npm run format:check   # Prettier — must pass before anything else
npm run lint           # ESLint
npm run build          # TypeScript compiler (all packages)
npm test               # Vitest (all packages)
```

To auto-fix formatting before committing:

```bash
npm run format         # writes Prettier fixes in-place
```

## Repository Layout

This is an npm-workspaces TypeScript monorepo with four packages:

| Package                | Path              | Purpose                      |
| ---------------------- | ----------------- | ---------------------------- |
| `@officernd/sdk`       | `packages/sdk`    | OAuth2 + HTTP client         |
| `@officernd/core`      | `packages/core`   | Shared types / utilities     |
| `@officernd/mcp`       | `packages/mcp`    | MCP server + CLI entry point |
| `officernd-mcp-vscode` | `packages/vscode` | VS Code extension            |

Build output (`packages/*/dist`, `*.tsbuildinfo`, `*.tgz`) is git-ignored.
Never commit those paths.

## Common Pitfalls

- **Always run `npm run format:check` (or `npm run format`) before
  committing.** Prettier failures are the most frequent cause of CI failures
  in this repo. Markdown files (e.g. `README.md`) are checked too.
- **Build before testing.** The `packages/mcp` test suite imports the
  compiled `@officernd/sdk` package; running `npm test` without a prior
  `npm run build` will fail with a package entry-point error.
- **Install dependencies first.** In a fresh clone run `npm install` (or
  `npm ci`) before build/test/lint.
