// 帳戶數據持久化系統
const azureService = require('./azure-service');
const { validateAzureConfig } = require('./azure-config');
const path = require('path');
const crypto = require('crypto');

class AccountPersistenceService {
  constructor() {
    this.containerName = 'account-backup';
    this.syncInterval = 5 * 60 * 1000; // 5分鐘同步一次
    this.isRunning = false;
    this._lastSavedHash = new Map(); // userId -> hash
  }

  // 初始化持久化服務
  async initialize() {
    try {
      // 若未設定 Azure，則跳過初始化以避免啟動時出現連線錯誤
      if (!validateAzureConfig()) {
        console.warn('Azure 未設定，已跳過帳戶持久化初始化');
        return { success: true, message: 'Azure 未設定，已跳過初始化' };
      }

      // 確保 Azure 已連接
      if (!azureService.isConnected) {
        await azureService.connectToAzure();
      }

      // 建立備份容器
      await azureService.createContainer(this.containerName);
      console.log('✓ 帳戶持久化服務已初始化');
      return { success: true, message: '帳戶持久化服務已初始化' };
    } catch (error) {
      console.error('✗ 帳戶持久化服務初始化失敗:', error.message);
      return { success: false, message: `初始化失敗: ${error.message}` };
    }
  }

  // 保存帳戶到 Azure
  async saveAccountsToAzure(accounts, userId) {
    try {
      if (!azureService.isConnected) {
        throw new Error('未連接到 Azure');
      }
      // 若資料未改變，則略過上傳以節省頻寬與費用
      const accountsDataObj = {
        userId,
        accounts,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      const accountsData = JSON.stringify(accountsDataObj);
      const hash = this._hashData(accountsData);
      const lastHash = this._lastSavedHash.get(userId);
      if (lastHash && lastHash === hash) {
        return { success: true, message: '無變更，略過保存', fileName: null };
      }

      const fileName = `accounts_${userId}_${new Date().getTime()}.json`;
      const result = await azureService.uploadFile(this.containerName, fileName, accountsData);

      if (result.success) {
        this._lastSavedHash.set(userId, hash);
        console.log(`✓ 帳戶已保存至 Azure: ${fileName}`);
        return { success: true, message: '帳戶已保存至 Azure', fileName };
      }
      return result;
    } catch (error) {
      console.error('✗ 保存帳戶到 Azure 失敗:', error.message);
      return { success: false, message: `保存失敗: ${error.message}` };
    }
  }

  _hashData(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
  }

  // 從 Azure 恢復帳戶
  async restoreAccountsFromAzure(userId) {
    try {
      if (!azureService.isConnected) {
        throw new Error('未連接到 Azure');
      }

      // 列出所有備份
      const listResult = await azureService.listBlobs(this.containerName);
      if (!listResult.success || listResult.blobs.length === 0) {
        return { success: false, message: '未找到備份' };
      }

      // 找到該用戶的最新備份
      const userBackups = listResult.blobs
        .filter(blob => blob.includes(`accounts_${userId}`))
        .sort()
        .reverse();

      if (userBackups.length === 0) {
        return { success: false, message: `未找到用戶 ${userId} 的備份` };
      }

      // 下載最新備份
      const latestBackup = userBackups[0];
      const downloadResult = await azureService.downloadFile(
        this.containerName,
        latestBackup
      );

      if (downloadResult.success) {
        const backupData = JSON.parse(downloadResult.data);
        console.log(`✓ 帳戶已從 Azure 恢復: ${latestBackup}`);
        return { success: true, data: backupData.accounts, fileName: latestBackup };
      }

      return downloadResult;
    } catch (error) {
      console.error('✗ 從 Azure 恢復帳戶失敗:', error.message);
      return { success: false, message: `恢復失敗: ${error.message}` };
    }
  }

  // 開始自動同步
  startAutoSync(userId, getAccountsCallback, onSyncComplete) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('✓ 已啟用自動帳戶同步');

    this.syncTimer = setInterval(async () => {
      try {
        const accounts = getAccountsCallback();
        const result = await this.saveAccountsToAzure(accounts, userId);
        if (result.success && onSyncComplete) {
          onSyncComplete(true, result.fileName);
        }
      } catch (error) {
        console.error('✗ 自動同步失敗:', error.message);
        if (onSyncComplete) {
          onSyncComplete(false, error.message);
        }
      }
    }, this.syncInterval);
  }

  // 停止自動同步
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.isRunning = false;
      console.log('✓ 已停止自動帳戶同步');
    }
  }

  // 手動觸發同步
  async manualSync(accounts, userId) {
    return await this.saveAccountsToAzure(accounts, userId);
  }

  // 列出所有備份
  async listBackups(userId) {
    try {
      if (!azureService.isConnected) {
        throw new Error('未連接到 Azure');
      }

      const listResult = await azureService.listBlobs(this.containerName);
      if (!listResult.success) {
        return listResult;
      }

      const userBackups = listResult.blobs
        .filter(blob => blob.includes(`accounts_${userId}`))
        .sort()
        .reverse();

      console.log(`✓ 找到 ${userBackups.length} 個備份`);
      return { success: true, backups: userBackups };
    } catch (error) {
      console.error('✗ 列出備份失敗:', error.message);
      return { success: false, message: `列出失敗: ${error.message}` };
    }
  }

  // 刪除舊備份
  async deleteOldBackups(userId, keepCount = 10) {
    try {
      if (!azureService.isConnected) {
        throw new Error('未連接到 Azure');
      }

      const listResult = await this.listBackups(userId);
      if (!listResult.success || listResult.backups.length <= keepCount) {
        return { success: true, message: '無需刪除' };
      }

      const toDelete = listResult.backups.slice(keepCount);
      let deletedCount = 0;

      for (const backup of toDelete) {
        const deleteResult = await azureService.deleteFile(
          this.containerName,
          backup
        );
        if (deleteResult.success) {
          deletedCount++;
        }
      }

      console.log(`✓ 已刪除 ${deletedCount} 個舊備份`);
      return { success: true, message: `已刪除 ${deletedCount} 個舊備份` };
    } catch (error) {
      console.error('✗ 刪除舊備份失敗:', error.message);
      return { success: false, message: `刪除失敗: ${error.message}` };
    }
  }
}

module.exports = new AccountPersistenceService();
