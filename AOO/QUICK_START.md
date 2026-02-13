# 系統功能快速開始指南

## ✅ 已完成的實現

所有 5 個系統功能模塊已成功創建並集成到 Facebook Manager 應用中：

### 1. 帳戶數據持久化系統 ✅
- **文件**: `src/account-persistence-service.js`
- **功能**: 自動備份、恢復、列表管理帳戶數據到 Azure
- **UI**: ☁️ 帳戶備份 按鈕

### 2. 錯誤日誌系統 ✅
- **文件**: `src/error-logging-service.js`
- **功能**: 多級別日誌記錄、統計分析、上傳到 Azure
- **UI**: 📊 日誌管理 按鈕

### 3. 用戶認證系統 ✅
- **文件**: `src/authentication-service.js`
- **功能**: 密碼驗證、會話管理、帳戶安全、雙因素認證
- **IPC**: `window.electronAPI.auth.*`

### 4. 數據同步系統 ✅
- **文件**: `src/data-sync-service.js`
- **功能**: 自動同步、操作隊列、衝突解決
- **UI**: 🔄 數據同步 按鈕

### 5. 通知系統 ✅
- **文件**: `src/notification-service.js`
- **功能**: 實時通知、事件分類、通知統計
- **UI**: 🔔 通知中心 按鈕

---

## 🎯 主要功能

### 用戶界面
應用主窗口現在包含以下功能區域：

```
[登入 Facebook] [添加帳戶] [防盜設備管理] [本地控制]

[系統功能區域]
☁️ 帳戶備份  📊 日誌管理  🔔 通知中心  🔄 數據同步

[Azure 功能區域]
連接 Azure  建立容器  列出檔案
```

### 核心 API

所有功能都通過 Electron IPC 安全暴露給渲染進程：

```javascript
// 帳戶備份
window.electronAPI.persistence.saveAccounts(accounts, userId)
window.electronAPI.persistence.restoreAccounts(userId)
window.electronAPI.persistence.listBackups(userId)

// 日誌管理
window.electronAPI.logging.uploadLogs(userId)
window.electronAPI.logging.getStats()
window.electronAPI.logging.getLogs(filterType, limit)

// 認證
window.electronAPI.auth.createAccount(username, password, email)
window.electronAPI.auth.login(username, password, deviceId)
window.electronAPI.auth.logout(sessionId)
window.electronAPI.auth.changePassword(username, oldPassword, newPassword)

// 數據同步
window.electronAPI.sync.startAutoSync(userId)
window.electronAPI.sync.stopAutoSync()
window.electronAPI.sync.syncData(userId, localData)
window.electronAPI.sync.getSyncStatus()

// 通知
window.electronAPI.notification.list(limit)
window.electronAPI.notification.clear(notificationId)
window.electronAPI.notification.getStats()
```

---

## 🚀 使用步驟

### 1. 啟動應用
```bash
npm start
```

應用會自動初始化所有服務。

### 2. 訪問系統功能

在應用主窗口點擊以下按鈕：

#### ☁️ 帳戶備份
- **保存帳戶到 Azure**: 將當前帳戶保存到 Azure
- **從 Azure 恢復帳戶**: 恢復上次保存的帳戶
- **列出備份**: 查看所有備份列表

#### 📊 日誌管理
- **上傳日誌**: 將本地日誌上傳到 Azure
- **查看日誌**: 查看最近 20 條日誌
- **統計信息**: 查看日誌統計數據

#### 🔔 通知中心
- **查看通知**: 查看最近 20 條通知
- **統計信息**: 查看未讀、已讀等統計
- **清除所有**: 清除所有通知

#### 🔄 數據同步
- **啟動自動同步**: 開始自動同步（10分鐘間隔）
- **停止同步**: 停止自動同步
- **立即同步**: 手動觸發同步
- **同步狀態**: 查看當前同步狀態

---

## 🔧 配置說明

### Azure 配置
建議使用環境變數（`.env`）來管理 Azure 憑證，避免將敏感資訊寫死在程式碼中。

1. 複製範例檔案為 `.env`：

```bash
cp .env.example .env
```

2. 編輯 `.env` 並填入你的憑證：

```
AZURE_STORAGE_ACCOUNT=your_storage_account
AZURE_STORAGE_KEY=your_storage_key
AZURE_COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
AZURE_COSMOS_KEY=your_cosmos_key
AZURE_SUBSCRIPTION_ID=your_subscription_id
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_client_secret

ENCRYPTION_KEY=your_secure_encryption_key
```

專案已在啟動時由 `src/azure-config.js` 讀取 `.env`（使用 `dotenv`）。如需範例檔，請參考專案根目錄的 `.env.example`（切勿將真實憑證提交到版本控制）。

---

## 📊 數據流程

```
┌─────────────────────────────────────┐
│   Renderer Process (UI)             │
├─────────────────────────────────────┤
│  ☁️ Persistence Panel               │
│  📊 Logging Panel                   │
│  🔔 Notification Panel              │
│  🔄 Sync Panel                      │
└──────────────┬──────────────────────┘
               │ IPC
               ▼
┌─────────────────────────────────────┐
│   Main Process (Services)           │
├─────────────────────────────────────┤
│  ├─ Persistence Service             │
│  ├─ Logging Service                 │
│  ├─ Auth Service                    │
│  ├─ Sync Service                    │
│  ├─ Notification Service            │
│  └─ Azure Service                   │
└──────────────┬──────────────────────┘
               │ HTTP/REST
               ▼
         ┌──────────────┐
         │ Azure Cloud  │
         └──────────────┘
```

---

## 🔒 安全特性

✅ **密碼強度檢查**
- 最少 8 個字符
- 必須包含大小寫、數字和特殊符號

✅ **會話管理**
- 30 分鐘超時自動登出
- 支持多設備會話管理

✅ **暴力攻擊防護**
- 5 次登入失敗後自動鎖定 15 分鐘

✅ **數據加密**
- 使用 CryptoJS 加密敏感數據

✅ **安全 IPC**
- contextIsolation: true
- nodeIntegration: false

---

## 📈 監控和日誌

### 自動記錄的事件
- ✅ 帳戶操作（登入、登出、更改）
- ✅ 備份和恢復操作
- ✅ 同步事件
- ✅ 認證事件
- ✅ 系統啟動/關閉
- ✅ 錯誤和異常

### 查看日誌
1. 點擊 **📊 日誌管理** 按鈕
2. 點擊 **查看日誌** 查看最近記錄
3. 點擊 **統計信息** 查看總體統計
4. 點擊 **上傳日誌** 上傳到 Azure

---

## 🎓 技術架構

### 使用的技術
- **Electron**: 桌面應用框架
- **Node.js**: 後端運行時
- **CryptoJS**: 數據加密
- **Azure Storage SDK**: 雲存儲
- **IPC**: 進程間通信

### 設計模式
- **Singleton Pattern**: 服務實例
- **IPC Handler Pattern**: 安全通信
- **Event Pattern**: 通知系統
- **Queue Pattern**: 數據同步隊列

---

## 🚨 故障排除

### Azure 連接失敗
**錯誤**: `Invalid AccountName in the provided Connection String`

**解決**:
1. 檢查 `azure-config.js` 中的配置
2. 確保提供了有效的 Azure 認證
3. 檢查網絡連接

### IPC 錯誤
**錯誤**: `Cannot invoke IPC handler`

**解決**:
1. 確保在主進程中正確註冊了處理器
2. 檢查 API 名稱是否正確
3. 查看浏覽器開發者工具的控制台

### 日誌沒有顯示
**原因**: 日誌可能未被記錄

**解決**:
1. 檢查服務是否正確初始化
2. 確認錯誤發生時日誌系統已啟動
3. 查看應用主進程控制台

---

## 💡 下一步開發建議

### 短期
1. ✅ 實現實際的 Azure 連接
2. ✅ 添加更多通知類型（郵件、推送）
3. ✅ 實現用戶認證UI
4. ✅ 添加設定面板

### 中期
1. 集成真實的 Facebook API
2. 實現數據庫存儲（Azure Cosmos DB）
3. 添加更多同步策略
4. 實現批量操作

### 長期
1. 實現分布式部署
2. 添加機器學習功能
3. 實現高級報告功能
4. 支持多語言本地化

---

## 📞 支持信息

如有問題，請：
1. 檢查日誌管理面板中的錯誤日誌
2. 查閱 `SYSTEM_FEATURES.md` 獲得詳細文檔
3. 查看各服務的源代碼中的註釋

---

**最後更新**: 2026年1月30日  
**版本**: 1.0  
**狀態**: 完全實現並通過初步測試
