# Facebook Manager

[![CI](https://github.com/zakker3107/mygit/actions/workflows/ci.yml/badge.svg?branch=chore%2Fdeps-eslint)](https://github.com/zakker3107/mygit/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-6%20%2F%206%20passing-brightgreen)](https://github.com/zakker3107/mygit/actions)
[![Node.js](https://img.shields.io/badge/Node.js-16%20%7C%2018-blue)](package.json)

一個桌面應用程式，用於管理 Facebook 帳戶，整合 Azure 和 Google Cloud 存儲。

## 功能

### 核心功能
- 登入 Facebook
- 添加和管理多個帳戶
- 設備安全管理

### 雲端集成
- **Azure** — Blob Storage、Cosmos DB 支援
- **Google Cloud** — Cloud Storage、Firestore 支援
  - 自動本地回退模式（開發時無需真實 GCP 認證）
  - 檔案上傳/下載/刪除/列舉
  - Firestore 文檔保存與查詢

### 企業功能
- 帳戶持久化
- 數據同步
- 錯誤日誌記錄
- 通知中心
- 遙測與分析

## 測試

執行單元測試（Jest）：
```bash
npm test
```

目前測試覆蓋：
- Google Cloud Storage 操作（4 個測試）
- Firestore 本地回退操作（2 個測試）

## 安裝

1. 安裝 Node.js 16 或 18（LTS）與 npm
2. 複製 `.env.example` 為 `.env`（可選配置 GCP）
3. 運行 `npm install` 安裝依賴

## 運行

```bash
npm start
```

## 文檔

- [Google Cloud 快速開始](./GOOGLE_CLOUD_QUICKSTART.md)
- [Google Cloud 設定指南](./GOOGLE_CLOUD_SETUP.md)
- [系統功能更新](./SYSTEM_UPDATE_SUMMARY.md)

## 注意

此應用程式使用 Electron 框架。請確保遵守 Facebook 的使用條款及各雲端服務的條款。