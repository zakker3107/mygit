// 錯誤日誌系統
const azureService = require('./azure-service');
const { validateAzureConfig } = require('./azure-config');
const path = require('path');
const logging = require('./logging');

class ErrorLoggingService {
  constructor() {
    this.containerName = 'error-logs';
    this.logs = [];
    this.maxLocalLogs = 1000;
    this.batchUploadQueue = []; // 待上傳批次
    this.batchSize = 100; // 每批上傳 100 筆日誌
    this.batchUploadTimeout = 5 * 60 * 1000; // 5分鐘若未達批量則自動上傳
    this._batchUploadTimer = null;
  }

  // 初始化日誌服務
  async initialize() {
    try {
      if (!validateAzureConfig()) {
        console.warn('Azure 未設定，已跳過錯誤日誌服務初始化');
        return { success: true, message: 'Azure 未設定，已跳過初始化' };
      }

      if (!azureService.isConnected) {
        await azureService.connectToAzure();
      }

      await azureService.createContainer(this.containerName);
      logging.info('✓ 錯誤日誌服務已初始化');
      return { success: true };
    } catch (error) {
      logging.error('✗ 錯誤日誌服務初始化失敗:', error.message);
      return { success: false, message: error.message };
    }
  }

  // 記錄錯誤
  logError(errorType, errorMessage, stackTrace, metadata = {}) {
    const logEntry = {
      id: `ERROR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: errorType,
      message: errorMessage,
      stackTrace: stackTrace || '',
      metadata: metadata,
      severity: this._determineSeverity(errorType)
    };

    this.logs.push(logEntry);
    this.batchUploadQueue.push(logEntry);

    // 若未設定批次上傳計時器，設定一個在超時後嘗試上傳
    if (!this._batchUploadTimer) {
      this._batchUploadTimer = setTimeout(() => {
        this._tryFlushBatch();
      }, this.batchUploadTimeout);
    }

    // 保持日誌數量在限制內
    if (this.logs.length > this.maxLocalLogs) {
      this.logs = this.logs.slice(-this.maxLocalLogs);
    }

    // 若累積達批量大小，立即上傳
    if (this.batchUploadQueue.length >= this.batchSize) {
      this._tryFlushBatch();
    }

    logging.error(`[${logEntry.severity}] ${errorType}: ${errorMessage}`);
    return logEntry;
  }

  // 記錄警告
  logWarning(warningType, message, metadata = {}) {
    const logEntry = {
      id: `WARNING_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: warningType,
      message: message,
      metadata: metadata,
      severity: 'WARNING'
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLocalLogs) {
      this.logs = this.logs.slice(-this.maxLocalLogs);
    }

    logging.warn(`[WARNING] ${warningType}: ${message}`);
    return logEntry;
  }

  // 記錄信息
  logInfo(infoType, message, metadata = {}) {
    const logEntry = {
      id: `INFO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: infoType,
      message: message,
      metadata: metadata,
      severity: 'INFO'
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLocalLogs) {
      this.logs = this.logs.slice(-this.maxLocalLogs);
    }

    logging.info(`[INFO] ${infoType}: ${message}`);
    return logEntry;
  }

  // 確定錯誤級別
  _determineSeverity(errorType) {
    if (errorType.includes('CRITICAL') || errorType.includes('FATAL')) {
      return 'CRITICAL';
    } else if (errorType.includes('ERROR') || errorType.includes('FAIL')) {
      return 'ERROR';
    }
    return 'WARNING';
  }

  // 上傳日誌到 Azure
  async uploadLogs(userId, logsToUpload = null) {
    try {
      if (!azureService.isConnected) {
        throw new Error('未連接到 Azure');
      }

      const logs = logsToUpload || this.logs;
      if (logs.length === 0) {
        return { success: false, message: '沒有日誌可上傳' };
      }

      const fileName = `logs_${userId}_${new Date().getTime()}.json`;
      const logsData = JSON.stringify({
        userId,
        uploadedAt: new Date().toISOString(),
        logCount: logs.length,
        logs: logs
      });

      const result = await azureService.uploadFile(
        this.containerName,
        fileName,
        logsData
      );

      if (result.success) {
        logging.info(`✓ 日誌已上傳至 Azure: ${fileName}`);
      }

      return result;
    } catch (error) {
      logging.error('✗ 上傳日誌失敗:', error.message);
      return { success: false, message: `上傳失敗: ${error.message}` };
    }
  }

  // 获取本地日誌
  getLocalLogs(filterType = null, limit = 100) {
    let filteredLogs = this.logs;

    if (filterType) {
      filteredLogs = this.logs.filter(log => log.type === filterType);
    }

    return filteredLogs.slice(-limit).reverse();
  }

  // 获取特定时间范围内的日誌
  getLogsByTimeRange(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return this.logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= start && logTime <= end;
    });
  }

  // 统计日誌
  getLogStatistics() {
    const stats = {
      total: this.logs.length,
      byType: {},
      bySeverity: {
        CRITICAL: 0,
        ERROR: 0,
        WARNING: 0,
        INFO: 0
      }
    };

    this.logs.forEach(log => {
      // 按類型統計
      if (!stats.byType[log.type]) {
        stats.byType[log.type] = 0;
      }
      stats.byType[log.type]++;

      // 按級別統計
      if (stats.bySeverity[log.severity] !== undefined) {
        stats.bySeverity[log.severity]++;
      }
    });

    return stats;
  }

  // 清空本地日誌
  clearLocalLogs() {
    this.logs = [];
    console.log('✓ 本地日誌已清空');
    return { success: true };
  }

  // 備份日誌並清空
  async backupAndClear(userId) {
    const uploadResult = await this.uploadLogs(userId);
    if (uploadResult.success) {
      this.clearLocalLogs();
    }
    return uploadResult;
  }

  // 私有方法：嘗試批次上傳日誌
  async _tryFlushBatch() {
    if (this.batchUploadQueue.length === 0) return;

    if (this._batchUploadTimer) {
      clearTimeout(this._batchUploadTimer);
      this._batchUploadTimer = null;
    }

    // 取出要上傳的批次
    const batch = this.batchUploadQueue.splice(0, this.batchSize);

    try {
      const result = await this.uploadLogs('system', batch);
      if (result.success) {
        // 上傳成功，從本地日誌中移除已上傳的項目
        const uploadedIds = new Set(batch.map(l => l.id));
        this.logs = this.logs.filter(l => !uploadedIds.has(l.id));
        logging.info(`✓ 批次日誌上傳成功，移除本地 ${batch.length} 筆`);
      } else {
        // 若上傳失敗，將批次回推到佇列尾以便稍後重試
        this.batchUploadQueue = batch.concat(this.batchUploadQueue);
        logging.warn('批次日誌上傳未成功，將稍後重試', result.message);
      }
    } catch (err) {
      // 發生例外，回推批次並記錄錯誤
      this.batchUploadQueue = batch.concat(this.batchUploadQueue);
      logging.error('批次上傳異常:', err.message || err);
    }

    // 若仍有待上傳項目，重新設定計時器
    if (this.batchUploadQueue.length > 0) {
      this._batchUploadTimer = setTimeout(() => {
        this._tryFlushBatch();
      }, this.batchUploadTimeout);
    }
  }
}

module.exports = new ErrorLoggingService();
