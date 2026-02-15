# Google Cloud 整合指南

## 概述

本應用程式已整合 Google Cloud Platform (GCP) 服務，包括：

- **Google Cloud Storage**: 用於檔案儲存和管理
- **Google Cloud Firestore**: 用於實時資料庫存儲和查詢

## 設定步驟

### 1. 建立 Google Cloud 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立一個新專案或選擇現有專案
3. 記下您的 **Project ID**

### 2. 啟用必要的 API

1. 在 Google Cloud Console 中，前往 **API & Services > Library**
2. 搜尋並啟用以下 API：
   - **Cloud Storage API**
   - **Cloud Firestore API**
   - **Service Accounts API**

### 3. 建立 Service Account

1. 前往 **API & Services > Credentials**
2. 點擊 **Create Credentials > Service Account**
3. 填寫服務帳戶詳細資訊
4. 點擊 **Create and Continue**
5. 跳過可選步驟，點擊 **Done**

### 4. 建立和下載金鑰

1. 在 Service Accounts 列表中，點擊您剛建立的服務帳戶
2. 前往 **Keys** 標籤
3. 點擊 **Add Key > Create new key**
4. 選擇 **JSON** 格式
5. 點擊 **Create** - JSON 檔案將自動下載

### 5. 建立 Storage Bucket

1. 在 Google Cloud Console 中，前往 **Cloud Storage**
2. 點擊 **Create Bucket**
3. 命名您的 bucket（例如：`my-app-bucket-123`）
4. 選擇儲存位置和其他設定
5. 點擊 **Create**

### 6. 設定環境變數

1. 在應用程式根目錄建立 `.env` 檔案（複製 `.env.example` 為範本）
2. 從您下載的 JSON 金鑰檔案中複製以下資訊：

```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_CLIENT_ID=your-client-id
GOOGLE_CLOUD_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
GOOGLE_CLOUD_FIRESTORE_DB=(default)
```

**⚠️ 重要：** 保護您的 `.env` 檔案，不要將其提交至版本控制。

### 7. 安裝依賴

```bash
npm install
```

## 使用方法

### 在 Renderer 進程中使用

```javascript
// 連接到 Google Cloud
const result = await window.electronAPI.googleCloud.connect();

// 上傳檔案
const uploadResult = await window.electronAPI.googleCloud.uploadFile(
  'my-bucket',
  'path/to/file.txt',
  fileData
);

// 下載檔案
const downloadResult = await window.electronAPI.googleCloud.downloadFile(
  'my-bucket',
  'path/to/file.txt'
);

// 列出檔案
const listResult = await window.electronAPI.googleCloud.listFiles(
  'my-bucket',
  'prefix/'
);

// 刪除檔案
const deleteResult = await window.electronAPI.googleCloud.deleteFile(
  'my-bucket',
  'path/to/file.txt'
);

// Firestore 操作
const saveResult = await window.electronAPI.googleCloud.saveToFirestore(
  'users',
  'user-123',
  { name: 'John Doe', email: 'john@example.com' }
);

const getResult = await window.electronAPI.googleCloud.getFromFirestore(
  'users',
  'user-123'
);

// 取得狀態
const status = await window.electronAPI.googleCloud.getStatus();
```

## 本地開發模式

若要在沒有 Google Cloud 認證的情況下開發，可啟用本地回退模式：

```env
GOOGLE_CLOUD_LOCAL_FALLBACK=true
```

這將使用本地檔案系統而不是 Google Cloud，檔案儲存在 `local_google_cloud/` 目錄中。

## 疑難排解

### 認證失敗

- 確認您的 Service Account 金鑰正確複製到 `.env` 檔案
- 驗證 `GOOGLE_CLOUD_PRIVATE_KEY` 包含換行符號（`\n`）
- 確認 Service Account 具有適當的 IAM 權限

### Bucket 不存在

- 驗證 `GOOGLE_CLOUD_STORAGE_BUCKET` 環境變數設定正確
- 確認 bucket 在 Google Cloud Storage 中存在
- 確認 Service Account 具有 bucket 的讀寫權限

### Firestore 連接問題

- 確認 Cloud Firestore API 已啟用
- 驗證 Service Account 具有 Firestore 的讀寫權限
- 檢查 Firestore 資料庫是否在與 Project ID 相同的地區

## 結構

```
src/
├── google-cloud-config.js      # Google Cloud 配置管理
├── google-cloud-service.js     # Google Cloud 服務實現
```

## API 參考

### GoogleCloudService

#### 方法

- `connect()` - 連接到 Google Cloud
- `uploadFile(bucket, filePath, fileData)` - 上傳檔案
- `downloadFile(bucket, filePath)` - 下載檔案
- `deleteFile(bucket, filePath)` - 刪除檔案
- `listFiles(bucket, prefix)` - 列出 bucket 中的檔案
- `saveToFirestore(collection, documentId, data)` - 保存文件到 Firestore
- `getFromFirestore(collection, documentId)` - 從 Firestore 取得文件
- `logStatus()` - 記錄服務狀態

## 費用考量

使用 Google Cloud 服務會產生費用。請查看：

- [Cloud Storage 定價](https://cloud.google.com/storage/pricing)
- [Firestore 定價](https://cloud.google.com/firestore/pricing)

建議設定預算提醒以監控成本。

## 安全最佳實踐

1. **不要在程式碼中硬編碼認證資訊**
2. **使用環境變數存儲敏感資訊**
3. **定期輪換 Service Account 金鑰**
4. **限制 Service Account 的 IAM 權限**（最少特權原則）
5. **加密傳輸中和靜止的敏感資料**
6. **定期審計日誌以檢測不尋常的活動**

需要進一步協助，請參考 [Google Cloud 官方文件](https://cloud.google.com/docs)。
