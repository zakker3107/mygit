// 數據同步系統
const azureService = require('./azure-service');
const { validateAzureConfig } = require('./azure-config');
const notificationService = require('./notification-service');
const logging = require('./logging');

class DataSyncService {
  constructor() {
    this.containerName = 'data-sync';
    this.syncQueue = [];
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.syncInterval = 10 * 60 * 1000; // 10分鐘
    this.conflictResolutionStrategy = 'latest-wins'; // 或 'manual'
    this.remoteBlobCache = new Map(); // userId -> { blobName, data }
    this.maxSyncRetry = 3; // 同步操作最多重試次數
  }

  // 初始化同步服務
  async initialize() {
    try {
      if (!validateAzureConfig()) {
        console.warn('Azure 未設定，已跳過數據同步服務初始化');
        return { success: true, message: 'Azure 未設定，已跳過初始化' };
      }

      if (!azureService.isConnected) {
        await azureService.connectToAzure();
      }

      await azureService.createContainer(this.containerName);
      logging.info('✓ 數據同步服務已初始化');
      return { success: true };
    } catch (error) {
      console.error('✗ 數據同步服務初始化失敗:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 開始自動同步
  startAutoSync(userId, getDataCallback, onSyncComplete) {
    if (this.syncTimer) return;

    logging.info('✓ 自動數據同步已啟動');

    this.syncTimer = setInterval(async () => {
      try {
        const localData = getDataCallback();
        // 廣播開始同步事件
        notificationService.syncEvent('SYNC_STARTED', { userId });

        const result = await this.syncData(userId, localData);

        if (result && result.success) {
          notificationService.syncEvent('SYNC_COMPLETED', { userId, lastSyncTime: this.lastSyncTime });
          if (onSyncComplete) {
            onSyncComplete(true, {
              lastSyncTime: this.lastSyncTime,
              status: '同步成功'
            });
          }
        } else {
          notificationService.syncEvent('SYNC_FAILED', { userId, reason: result && result.message });
          if (onSyncComplete) {
            onSyncComplete(false, result && result.message);
          }
        }
      } catch (error) {
        logging.error('✗ 自動同步失敗:', error.message);
        notificationService.syncEvent('SYNC_FAILED', { userId, reason: error.message });
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
      console.log('✓ 自動數據同步已停止');
    }
  }

  // 執行同步
  async syncData(userId, localData) {
    if (this.isSyncing) {
      return { success: false, message: '已有同步進行中' };
    }

    this.isSyncing = true;

    try {
      // 獲取遠程數據
      const remoteData = await this._getRemoteData(userId);

      // 比較並合併數據
      const mergedData = this._mergeData(localData, remoteData);

      // 上傳合併後的數據
      await this._uploadData(userId, mergedData);

      this.lastSyncTime = new Date().toISOString();
      this.isSyncing = false;

      logging.info(`✓ 數據同步完成 [${userId}]`);
      return {
        success: true,
        message: '數據同步完成',
        lastSyncTime: this.lastSyncTime,
        syncedItems: mergedData.items ? mergedData.items.length : 0
      };
    } catch (error) {
      this.isSyncing = false;
      logging.error('✗ 同步失敗:', error.message);
      return { success: false, message: `同步失敗: ${error.message}` };
    }
  }

  // 隊列化同步操作
  async queueSync(userId, operation, data) {
    const syncOperation = {
      id: `SYNC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      operation,
      data,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    this.syncQueue.push(syncOperation);
    console.log(`✓ 同步操作已入隊: ${syncOperation.id}`);

    return { success: true, operationId: syncOperation.id };
  }

  // 處理隊列中的所有操作
  async processSyncQueue() {
    if (this.isSyncing) {
      return { success: false, message: '已有同步進行中' };
    }

    this.isSyncing = true;
    let processedCount = 0;

    try {
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue.shift();

        try {
          operation.status = 'processing';
          
          // 執行操作
          switch (operation.operation) {
            case 'CREATE':
              await this._handleCreate(operation);
              break;
            case 'UPDATE':
              await this._handleUpdate(operation);
              break;
            case 'DELETE':
              await this._handleDelete(operation);
              break;
          }

          operation.status = 'completed';
          operation.completedAt = new Date().toISOString();
          processedCount++;

          logging.info(`✓ 同步操作已完成: ${operation.id}`);
        } catch (error) {
          operation.retryCount = (operation.retryCount || 0) + 1;
          operation.error = error.message;
          if (operation.retryCount <= this.maxSyncRetry) {
            operation.status = 'pending';
            this.syncQueue.push(operation); // 重新加入隊列尾端重試
            console.warn(`⚠️ 同步操作 ${operation.id} 失敗，將重試 (${operation.retryCount}/${this.maxSyncRetry})`);
          } else {
            operation.status = 'failed';
            logging.error(`✗ 同步操作 ${operation.id} 已達最大重試次數，標記為失敗`, error.message);
          }
        }
      }

      this.isSyncing = false;
      return {
        success: true,
        message: `已處理 ${processedCount} 個同步操作`,
        processedCount
      };
    } catch (error) {
      this.isSyncing = false;
      logging.error('✗ 隊列處理失敗:', error.message);
      return { success: false, message: `隊列處理失敗: ${error.message}` };
    }
  }

  // 獲取同步狀態
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queuedOperations: this.syncQueue.length,
      conflictResolution: this.conflictResolutionStrategy
    };
  }

  // 獲取隊列中的操作
  getQueuedOperations() {
    return this.syncQueue;
  }

  // 清空隊列
  clearQueue() {
    this.syncQueue = [];
    console.log('✓ 同步隊列已清空');
    return { success: true };
  }

  // 私有方法
  async _getRemoteData(userId) {
    try {
      // 若 Azure 無法連線且開啟本地回退，直接從本地資料夾讀取
      if (!azureService.getConnectionStatus() && process.env.LOCAL_FALLBACK === 'true') {
        const fs = require('fs');
        const path = require('path');
        const localDir = path.join(__dirname, '..', 'local_azure', this.containerName);
        if (!fs.existsSync(localDir)) {
          return { userId, items: [], version: '1.0' };
        }
        const files = fs.readdirSync(localDir).filter(f => f.includes(`sync_${userId}`)).sort().reverse();
        if (files.length === 0) return { userId, items: [], version: '1.0' };
        const latest = files[0];
        const data = fs.readFileSync(path.join(localDir, latest), 'utf8');
        return JSON.parse(data);
      }

      const listResult = await azureService.listBlobs(this.containerName);
      
      if (!listResult.success || listResult.blobs.length === 0) {
        return { userId, items: [], version: '1.0' };
      }

      const userBlobs = listResult.blobs
        .filter(blob => blob.includes(`sync_${userId}`))
        .sort()
        .reverse();

      if (userBlobs.length === 0) {
        return { userId, items: [], version: '1.0' };
      }

      const latestBlob = userBlobs[0];

      // 檢查快取，若最新 blob 與快取相同則直接回傳快取資料，避免重複下載
      const cache = this.remoteBlobCache.get(userId);
      if (cache && cache.blobName === latestBlob && cache.data) {
        return cache.data;
      }

      const downloadResult = await azureService.downloadFile(this.containerName, latestBlob);

      if (downloadResult.success) {
        const parsed = JSON.parse(downloadResult.data);
        this.remoteBlobCache.set(userId, { blobName: latestBlob, data: parsed });
        return parsed;
      }

      return { userId, items: [], version: '1.0' };
    } catch (error) {
      console.error('✗ 獲取遠程數據失敗:', error.message);
      return { userId, items: [], version: '1.0' };
    }
  }

  async _uploadData(userId, data) {
    const fileName = `sync_${userId}_${new Date().getTime()}.json`;
    const syncData = {
      userId,
      uploadedAt: new Date().toISOString(),
      ...data
    };

    // 若 Azure 無法連線且開啟本地回退，直接寫入本地
    if (!azureService.getConnectionStatus() && process.env.LOCAL_FALLBACK === 'true') {
      const fs = require('fs');
      const path = require('path');
      const localDir = path.join(__dirname, '..', 'local_azure', this.containerName);
      fs.mkdirSync(localDir, { recursive: true });
      const target = path.join(localDir, fileName);
      fs.writeFileSync(target, JSON.stringify(syncData));
      logging.debug(`✓ (本地回退) 同步資料已寫入: ${target}`);
      return { success: true, message: '(local) 上傳成功' };
    }

    const result = await azureService.uploadFile(
      this.containerName,
      fileName,
      JSON.stringify(syncData)
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result;
  }

  _mergeData(localData, remoteData) {
    // 簡單的合併策略：遠程數據優先
    const merged = {
      userId: localData.userId || remoteData.userId,
      items: [...(remoteData.items || [])],
      version: '1.0',
      mergedAt: new Date().toISOString()
    };

    // 添加本地唯一的項目
    if (localData.items) {
      const remoteIds = new Set((remoteData.items || []).map(item => item.id));
      const localOnly = localData.items.filter(item => !remoteIds.has(item.id));
      merged.items = [...merged.items, ...localOnly];
    }

    return merged;
  }

  async _handleCreate(operation) {
    // 在 Azure 中創建數據
    console.log(`建立數據: ${operation.data.id}`);
  }

  async _handleUpdate(operation) {
    // 在 Azure 中更新數據
    console.log(`更新數據: ${operation.data.id}`);
  }

  async _handleDelete(operation) {
    // 在 Azure 中刪除數據
    console.log(`刪除數據: ${operation.data.id}`);
  }
}

module.exports = new DataSyncService();
