# Facebook Manager - AI Coding Guidelines

## Architecture Overview
This is an Electron desktop application for managing Facebook accounts. The app follows Electron's main/renderer process separation with secure IPC via contextBridge.

**Key Components:**
- `src/main.js`: Main process - creates BrowserWindow with webPreferences (nodeIntegration: false, contextIsolation: true, preload: 'src/preload.js'), loads `public/index.html`
- `src/preload.js`: Preload script - exposes `axios` to renderer via `window.electronAPI.axios` using contextBridge
- `public/renderer.js`: Renderer process - handles UI interactions, account management, and telemetry collection
- `public/index.html`: Basic HTML UI with Traditional Chinese interface (zh-tw)

## Data Collection Pattern
All user actions trigger telemetry via `collectData()` function in `renderer.js`. Events are sent to `https://example.com/collect` (placeholder endpoint) with payload:
```javascript
{
  event: "event_name",
  data: {...},
  timestamp: "ISO string"
}
```
Always include `collectData()` calls for new UI interactions, following the pattern in existing buttons (loginBtn, addAccountBtn).

## Account Management
Accounts are stored in-memory as array of objects: `{name: string, status: "未登入"|"已登入"}`. No persistence implemented. Use `updateAccountList()` to refresh UI after changes.

## Development Workflow
- **Run app**: `npm start` (runs `electron .`)
- **No build step**: Direct electron execution
- **Dependencies**: Only `electron` and `axios` - keep minimal

## Code Conventions
- **Language**: UI text and comments in Traditional Chinese (zh-tw)
- **Security**: Use contextBridge for any new renderer<->main communication
- **HTTP**: All external requests via exposed axios in preload
- **Event tracking**: Instrument all user actions with collectData()

## File Structure
- `src/`: Electron process files (main.js, preload.js)
- `public/`: Web assets (HTML, JS, CSS)
- No separate config files - all logic in respective process files

## Adding Features
When extending account management or UI:
1. Add collectData() call for new interactions in renderer.js
2. Update accounts array and call updateAccountList()
3. Use Traditional Chinese for user-facing text
4. Expose new APIs via preload if needed for main<->renderer communication