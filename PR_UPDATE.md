PR 更新與驗證指南

目的
- 幫你把 PR 加上 reviewers、labels，並更新 PR title 與 PR body（使用 PowerShell 或 gh CLI）。

步驟 A：使用已存的 PowerShell 腳本（建議）
1. 確認你已把先前腳本存成 `update-pr.ps1` 並放在 `mygit` 資料夾。
2. 在 PowerShell（同一個資料夾）執行：

```powershell
# 在目前 session 設定你的 PAT（只在此 session）
$env:GITHUB_TOKEN = "<your_PAT_here>"

# 執行腳本並把輸出重定向到檔案
.\update-pr.ps1 *> .\update-pr-output.txt

# 顯示完整輸出
Get-Content .\update-pr-output.txt -Raw
```

3. 把 `update-pr-output.txt` 的內容貼回給我（或把重要的成功/錯誤訊息複製貼上）。

步驟 B：若你想用 gh CLI（你已安裝並登入 gh）
- 新增 reviewers 並加入 labels：

```bash
# 範例（替換 PR_URL 與 reviewer/label）
gh pr edit <PR_URL_OR_NUMBER> --add-reviewer zakker3107,alice --add-label "chore","dependencies","eslint"
```

- 更新 PR title 與 body（title 與 body 可分開）
```bash
gh pr edit <PR_URL_OR_NUMBER> --title "chore: upgrade deps + apply ESLint (AirBnB + React)"
# 若要從檔案載入 body
gh pr edit <PR_URL_OR_NUMBER> --body-file ./tmp_pr_body.md
```

步驟 C：如果你想用 REST API（PowerShell 範例）
- 我已經提供完整 PowerShell REST 範例在 `update-pr.ps1`，也可直接呼叫 API 並回傳錯誤以供我分析。

驗證清單（執行後請貼回）
- PR 編號
- 終端輸出（或 `update-pr-output.txt`）
- 已加入的 reviewers
- 已加入的 labels
- PR 新的 title（若更新成功）

備註
- `package.json` 目前：ESLint pinned 在 `^8.57.1`，AirBnB config 與 React/React-DOM 已安裝；Jest 為 `^30.2.0`。
- 若你要我自動 commit 一個紀錄檔（例如 `PR_UPDATE.md`、或把輸出放入 repo），我可以建立並 commit，但需要你允許我在 workspace 寫檔（我已新增 `PR_UPDATE.md`）。

接下來我建議的最直接下一步：在你的機器執行 `update-pr.ps1`（PowerShell），把 `update-pr-output.txt` 貼回來，我會立即幫你驗證結果並把 todo 標為完成。