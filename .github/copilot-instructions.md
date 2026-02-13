# Copilot Instructions for mygit-minitest

## Project Overview
Minimal Node.js project demonstrating Jest testing, ESLint linting, and PowerShell-based GitHub PR automation.

## Architecture
- **Core Code**: Modules in `src/` (e.g., `src/add.js` with `module.exports`).
- **Tests**: Jest tests in `__tests__/` (e.g., `__tests__/add.test.js` using `require` and `expect`).
- **Scripts**: Legacy utilities in `scripts/` (Jest-ignored via `testPathIgnorePatterns`); archived files in root with noop tests to avoid Jest errors.
- **PR Automation**: PowerShell scripts (`update-pr.ps1`) use GitHub REST API for PR management; wrapper `run-update.ps1` for execution.

## Developer Workflows
- **Install**: `npm install` (use `cmd /c` if PowerShell blocks `npm.ps1` due to execution policy).
- **Test**: `npm test` (Jest with `--runInBand` for sequential runs; ignores `scripts/`).
- **Lint**: `npm run lint` (ESLint Airbnb config + React plugins; React deps installed for peer dependencies only).
- **Update PRs**: Set `$env:GITHUB_TOKEN`, run `.\update-pr.ps1` (finds PR by branch, creates labels if needed, adds reviewers/labels, updates title/body).

## Conventions
- **ESLint**: `eslint-config-airbnb` ^19.0.4 with React support; pinned to ^8.57.1; config in `.eslintrc.json` with custom rules (e.g., `no-console: off`, React hooks).
- **Jest**: Ignores `scripts/`; use `test()` and `expect()`; CommonJS modules.
- **Modules**: Export with `module.exports`; import with relative `require()`.
- **PR Scripts**: Hardcode owner/repo/branch/reviewers/labels; authenticate with env `GITHUB_TOKEN`; uses GitHub API endpoints for PR edits.

## Key Files
- [package.json](package.json): Defines `test` and `lint` scripts; Jest config; React deps for linting.
- [src/add.js](src/add.js): Example function.
- [__tests__/add.test.js](__tests__/add.test.js): Test suite.
- [update-pr.ps1](update-pr.ps1): PR update script (REST API calls).
- [PR_UPDATE.md](PR_UPDATE.md): PR update guide (PowerShell/gh CLI).
- [.eslintrc.json](.eslintrc.json): ESLint config (Airbnb + React plugins).

## Integration Points
- **GitHub API**: Scripts call REST endpoints for PR queries/edits (reviewers, labels, title/body); handles label creation if missing.