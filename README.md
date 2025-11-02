# mygit-minitest

這是一個最小的 Node 範例專案，包含 Jest 測試與 ESLint 設定。

快速說明
- 測試：使用 Jest
- Lint：使用 ESLint

檔案結構（關鍵）
- `src/add.js` — 加法實作
- `__tests__/add.test.js` — Jest 測試
- `scripts/old_test_runner.js` — 舊的測試 runner（已移至 scripts 作為備份）
- `package.json` — scripts: `test`, `lint`

如何在你的電腦上執行

1) 安裝相依

PowerShell（如遇到 `npm.ps1` 執行政策問題，請參考下方備註）：

```powershell
cd C:\Users\User\.monica-code\mygit
npm install
```

或使用 cmd（可避開 PowerShell 的 script 執行政策）：

```powershell
cmd /c "cd /d C:\Users\User\.monica-code\mygit && npm install"
```

2) 執行測試（Jest）

```powershell
# 推薦用 cmd 執行以避免 PowerShell 的 npm.ps1 問題：
cmd /c "cd /d C:\Users\User\.monica-code\mygit && npm test"

# 或在 PowerShell 直接執行（若你已允許腳本執行）：
cd C:\Users\User\.monica-code\mygit
npm test
```

3) 執行 ESLint

```powershell
# 使用 cmd 或直接在 PowerShell（視你執行政策）
cmd /c "cd /d C:\Users\User\.monica-code\mygit && npm run lint"

# 或
cd C:\Users\User\.monica-code\mygit
npm run lint
```

備註（PowerShell 執行政策）
- 若在 PowerShell 遇到錯誤訊息："因為這個系統上已停用指令碼執行，所以無法載入 ... npm.ps1"，表示 PowerShell 的執行政策阻擋了 `npm` 指令的 ps1 包裝檔。可採用下列做法之一：
  1. 使用 `cmd /c` 執行 npm（最簡單、無須變更系統設定）。
  2. 允許 PowerShell 執行腳本（需評估安全性）：以管理員或 CurrentUser 執行

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

  3. 或使用 Windows Terminal 切換到 cmd / bash 執行 npm。

其他/建議
- 若想要把專案變成更標準的結構，我可以：
  - 移除 `scripts/old_test_runner.js`（若不需要備份），
  - 套用更嚴格的 ESLint 規則（例如 AirBnB），並自動修正相關風格問題，
  - 加上簡單的 CI（GitHub Actions）以在 push 時自動跑測試與 lint。

如需我執行上述任一項，請告訴我要做哪一個。
