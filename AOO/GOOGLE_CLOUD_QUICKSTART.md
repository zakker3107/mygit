# Google Cloud 功能 - 快速開始指南

## 🎯 5 分鐘快速開始

### 步驟 1: 準備環境變數（1 分鐘）

複製並編輯 `.env` 檔案：

```bash
cp .env.example .env
```

在 `.env` 中添加（或修改）以下內容：

```env
# Google Cloud 基本配置
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# 開發時使用本地模式（無需真實 GCP 認證）
GOOGLE_CLOUD_LOCAL_FALLBACK=true
```

### 步驟 2: 安裝依賴（2 分鐘）

```bash
npm install
```

### 步驟 3: 啟動應用（1 分鐘）

```bash
npm start
```

### 步驟 4: 測試功能（1 分鐘）

1. 在應用中找到 **Google Cloud 存儲管理** 區域
2. 點擊 **連接 Google Cloud** 按鈕
3. 測試其他功能（上傳、下載、Firestore 等）

---

## 🔐 配置真實的 Google Cloud（需要 GCP 帳戶）

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的專案選單
3. 點擊 **NEW PROJECT**
4. 輸入專案名稱（例如：`facebook-manager`）
5. 點擊 **CREATE**

### 2. 啟用必要的 API

1. 在 Google Cloud Console 左側菜單中，前往 **APIs & Services > Library**
2. 搜尋並啟用：
   - **Cloud Storage API**
   - **Cloud Firestore API**

### 3. 建立 Storage Bucket

1. 在左側菜單中，前往 **Cloud Storage**
2. 點擊 **CREATE BUCKET**
3. 輸入 bucket 名稱（例如：`my-facebook-manager-bucket`）
4. 選擇區域（例如：`us-central1`）
5. 點擊 **CREATE**

### 4. 建立 Service Account

1. 在左側菜單中，前往 **APIs & Services > Service Accounts**
2. 點擊 **CREATE SERVICE ACCOUNT**
3. 輸入服務帳戶名稱（例如：`facebook-manager-sa`）
4. 點擊 **CREATE AND CONTINUE**
5. 跳過權限設定，點擊 **CONTINUE**
6. 點擊 **DONE**

### 5. 建立並下載金鑰

1. 在 Service Accounts 列表中，點擊您剛建立的服務帳戶
2. 前往 **KEYS** 標籤
3. 點擊 **ADD KEY > Create new key**
4. 選擇 **JSON** 格式
5. 點擊 **CREATE**
6. JSON 檔案將自動下載

### 6. 配置環境變數

用文字編輯器開啟下載的 JSON 檔案和 `.env` 檔案，複製以下資訊：

```env
GOOGLE_CLOUD_PROJECT_ID=<project_id from JSON>
GOOGLE_CLOUD_CLIENT_EMAIL=<client_email from JSON>
GOOGLE_CLOUD_CLIENT_ID=<client_id from JSON>
GOOGLE_CLOUD_PRIVATE_KEY_ID=<private_key_id from JSON>
GOOGLE_CLOUD_PRIVATE_KEY="<完整的 private_key，包括 \n>"
GOOGLE_CLOUD_STORAGE_BUCKET=my-facebook-manager-bucket
GOOGLE_CLOUD_LOCAL_FALLBACK=false
```

### 7. 重新啟動應用

```bash
npm start
```

---

## 📚 主要功能說明

### Google Cloud Storage 操作

#### 上傳檔案
- 按鈕：**上傳檔案**
- 輸入 bucket 名稱和檔案路徑
- 示例檔案自動建立並上傳

#### 下載檔案
- 按鈕：**下載檔案**
- 輸入 bucket 名稱和檔案路徑
- 檔案內容在視窗中預覽

#### 列出檔案
- 按鈕：**列出 Storage 檔案**
- 顯示 bucket 中的所有檔案
- 包括檔案大小和最後更新時間

### Firestore 操作

#### 保存資料
- 按鈕：**保存至 Firestore**
- 自動建立 collection 和 document
- 示例資料自動建立

#### 查詢資料
- 按鈕：**從 Firestore 查詢**
- 輸入 collection 和 document ID
- 返回的資料以 JSON 格式顯示

---

## 🛠️ 開發與測試

### 本地模式開發

當 `GOOGLE_CLOUD_LOCAL_FALLBACK=true` 時：
- 檔案存儲在 `local_google_cloud/` 目錄
- 無需真實的 Google Cloud 認證
- 完美用於開發和測試

### 檢查日誌

應用啟動時會在控制台顯示：
```
✓ Google Cloud初始化: 使用本地回退模式
```

或

```
✓ Google Cloud 連接成功
```

---

## 💡 常見用法示例

### 例子 1: 備份帳戶資料

```javascript
// 上傳帳戶備份
await window.electronAPI.googleCloud.uploadFile(
  'my-bucket',
  'accounts/backup-2026-02-14.json',
  JSON.stringify(accountData)
);
```

### 例子 2: 保存登入信息

```javascript
// 保存到 Firestore
await window.electronAPI.googleCloud.saveToFirestore(
  'accounts',
  'user-123',
  {
    name: 'John Doe',
    email: 'john@example.com',
    status: '已登入',
    loginTime: new Date().toISOString()
  }
);
```

### 例子 3: 同步帳戶列表

```javascript
// 檢索已保存的帳戶
const result = await window.electronAPI.googleCloud.getFromFirestore(
  'accounts',
  'user-123'
);
if (result.success) {
  console.log('帳戶資料:', result.data);
}
```

---

## 🔍 故障排除

### 問題：「Google Cloud 未連接」

✓ **解決方案：**
1. 檢查 `.env` 中的 `GOOGLE_CLOUD_LOCAL_FALLBACK` 設定
2. 若要使用本地模式，設定為 `true`
3. 若要使用真實 GCP，確保認證資訊正確

### 問題：「Bucket not found」

✓ **解決方案：**
1. 驗證 `GOOGLE_CLOUD_STORAGE_BUCKET` 中的 bucket 名稱
2. 確認 bucket 在 Google Cloud Console 中存在
3. 檢查 Service Account 是否有 bucket 的存取權限

### 問題：「Private key 無效」

✓ **解決方案：**
1. 確保 `GOOGLE_CLOUD_PRIVATE_KEY` 包含完整金鑰（包括 BEGIN 和 END）
2. 換行應表示為 `\n` 而不是實際換行符
3. 整個金鑰應該包含在雙引號中

---

## 📖 更多資訊

- 詳細文檔：見 [`GOOGLE_CLOUD_SETUP.md`](./GOOGLE_CLOUD_SETUP.md)
- 程式碼範例：見 [`GOOGLE_CLOUD_EXAMPLES.js`](./GOOGLE_CLOUD_EXAMPLES.js)
- 整合報告：見 [`GOOGLE_CLOUD_INTEGRATION.md`](./GOOGLE_CLOUD_INTEGRATION.md)
- 官方文檔：[Google Cloud 說明文件](https://cloud.google.com/docs)

---

## ✅ 檢查清單

使用此檢查清單確保正確配置：

- [ ] 複製 `.env.example` 為 `.env`
- [ ] 設定 `GOOGLE_CLOUD_LOCAL_FALLBACK=true`（初期開發）
- [ ] 執行 `npm install`
- [ ] 執行 `npm start`
- [ ] 測試「連接 Google Cloud」按鈕
- [ ] 測試上傳/下載功能
- [ ] 檢查 `local_google_cloud/` 目錄（本地模式）

**完成後，應用即可正常使用 Google Cloud 功能！** 🎉
