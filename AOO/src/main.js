const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const azureService = require('./azure-service');
const accountPersistenceService = require('./account-persistence-service');
const errorLoggingService = require('./error-logging-service');
const authenticationService = require('./authentication-service');
const dataSyncService = require('./data-sync-service');
const notificationService = require('./notification-service');

let mainWindow;
const ipcResponseCache = new Map(); // channel -> { response, timestamp }
const IPC_CACHE_DURATION = 5 * 60 * 1000; // 5分鐘 IPC 快取有效期

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('public/index.html');

  // Add error handlers
  mainWindow.webContents.on('crashed', () => {
    console.error('[CRASH] Renderer process crashed');
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window content loaded successfully');
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[CRASH] Renderer process crashed');
  });

  // 初始化所有服務
  initializeServices();
}

// IPC 快取輔助函式
function getCachedResponse(channel) {
  const cached = ipcResponseCache.get(channel);
  if (cached && Date.now() - cached.timestamp < IPC_CACHE_DURATION) {
    return cached.response;
  }
  return null;
}

function setCachedResponse(channel, response) {
  ipcResponseCache.set(channel, { response, timestamp: Date.now() });
}

app.whenReady().then(createWindow);

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in Main Process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in Main Process:', reason);
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed (standard behavior)
  if (process.platform !== 'darwin') {
    console.log('All windows closed, app will exit');
    app.quit();
  }
});

// 初始化所有服務
async function initializeServices() {
  try {
    console.log('Starting service initialization...');
    const serviceOrder = [
      { name: '通知', service: notificationService },
      { name: '錯誤日誌', service: errorLoggingService },
      { name: '認證', service: authenticationService },
      { name: '帳戶持久化', service: accountPersistenceService },
      { name: '數據同步', service: dataSyncService }
    ];

    for (const item of serviceOrder) {
      try {
        if (item.service && item.service.initialize) {
          const result = await item.service.initialize();
          console.log(`✓ ${item.name}初始化成功`);
        } else {
          console.log(`⊘ ${item.name}沒有初始化方法`);
        }
      } catch (error) {
        console.error(`✗ ${item.name}初始化失敗:`, error.message);
        // Don't crash the app if one service fails
      }
    }

    console.log('Service initialization completed');
  } catch (error) {
    console.error('Fatal error during service initialization:', error.message);
  }
}

// ============ Azure IPC 處理器 ============
ipcMain.handle('azure:connect', async () => {
  try {
    const result = await azureService.connectToAzure();
    if (result.success) {
      notificationService.success('連接成功', 'Azure 已連接');
    } else {
      notificationService.error('連接失敗', result.message);
    }
    return result;
  } catch (error) {
    errorLoggingService.logError('AZURE_CONNECT_ERROR', error.message, error.stack);
    notificationService.error('錯誤', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:createContainer', async (event, containerName) => {
  try {
    const result = await azureService.createContainer(containerName);
    if (result.success) {
      notificationService.success('容器已建立', containerName);
    }
    return result;
  } catch (error) {
    errorLoggingService.logError('AZURE_CREATE_CONTAINER_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:uploadFile', async (event, containerName, fileName, fileData) => {
  try {
    return await azureService.uploadFile(containerName, fileName, fileData);
  } catch (error) {
    errorLoggingService.logError('AZURE_UPLOAD_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:downloadFile', async (event, containerName, fileName) => {
  try {
    return await azureService.downloadFile(containerName, fileName);
  } catch (error) {
    errorLoggingService.logError('AZURE_DOWNLOAD_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:listBlobs', async (event, containerName) => {
  try {
    return await azureService.listBlobs(containerName);
  } catch (error) {
    errorLoggingService.logError('AZURE_LIST_BLOBS_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:deleteFile', async (event, containerName, fileName) => {
  try {
    return await azureService.deleteFile(containerName, fileName);
  } catch (error) {
    errorLoggingService.logError('AZURE_DELETE_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('azure:getStatus', async () => {
  // 快取連線狀態查詢以減少頻繁檢查
  const cached = getCachedResponse('azure:getStatus');
  if (cached !== null) {
    return cached;
  }
  const response = { connected: azureService.getConnectionStatus() };
  setCachedResponse('azure:getStatus', response);
  return response;
});

// ============ 帳戶持久化 IPC 處理器 ============
ipcMain.handle('persistence:saveAccounts', async (event, accounts, userId) => {
  try {
    const result = await accountPersistenceService.saveAccountsToAzure(accounts, userId);
    if (result.success) {
      notificationService.success('帳戶已保存', `已保存至 ${result.fileName}`);
    }
    return result;
  } catch (error) {
    errorLoggingService.logError('PERSISTENCE_SAVE_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('persistence:restoreAccounts', async (event, userId) => {
  try {
    return await accountPersistenceService.restoreAccountsFromAzure(userId);
  } catch (error) {
    errorLoggingService.logError('PERSISTENCE_RESTORE_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('persistence:listBackups', async (event, userId) => {
  try {
    return await accountPersistenceService.listBackups(userId);
  } catch (error) {
    errorLoggingService.logError('PERSISTENCE_LIST_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

// ============ 錯誤日誌 IPC 處理器 ============
ipcMain.handle('logging:uploadLogs', async (event, userId) => {
  try {
    return await errorLoggingService.uploadLogs(userId);
  } catch (error) {
    console.error('上傳日誌失敗:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('logging:getStats', async (event) => {
  return errorLoggingService.getLogStatistics();
});

ipcMain.handle('logging:getLogs', async (event, filterType, limit) => {
  return errorLoggingService.getLocalLogs(filterType, limit);
});

// ============ 認證服務 IPC 處理器 ============
ipcMain.handle('auth:createAccount', async (event, username, password, email) => {
  try {
    const result = authenticationService.createAccount(username, password, email);
    if (result.success) {
      notificationService.success('帳戶已建立', `歡迎 ${username}`);
    }
    return result;
  } catch (error) {
    errorLoggingService.logError('AUTH_CREATE_ACCOUNT_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:login', async (event, username, password, deviceId) => {
  try {
    const result = authenticationService.login(username, password, deviceId);
    if (result.success) {
      notificationService.accountEvent('LOGIN', username);
    } else {
      errorLoggingService.logWarning('AUTH_LOGIN_FAILED', `用戶 ${username} 登入失敗`);
      authenticationService.recordFailedLogin(username);
    }
    return result;
  } catch (error) {
    errorLoggingService.logError('AUTH_LOGIN_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:logout', async (event, sessionId) => {
  try {
    return authenticationService.logout(sessionId);
  } catch (error) {
    errorLoggingService.logError('AUTH_LOGOUT_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:validateSession', async (event, sessionId) => {
  try {
    return authenticationService.validateSession(sessionId);
  } catch (error) {
    errorLoggingService.logError('AUTH_VALIDATE_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('auth:changePassword', async (event, username, oldPassword, newPassword) => {
  try {
    return authenticationService.changePassword(username, oldPassword, newPassword);
  } catch (error) {
    errorLoggingService.logError('AUTH_CHANGE_PASSWORD_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

// ============ 數據同步 IPC 處理器 ============
ipcMain.handle('sync:startAutoSync', async (event, userId) => {
  try {
    dataSyncService.startAutoSync(
      userId,
      () => ({ userId, items: [] }), // 這裡應該獲取實際的本地數據
      (success, data) => {
        if (success) {
          notificationService.syncEvent('SYNC_COMPLETED');
        } else {
          notificationService.syncEvent('SYNC_FAILED');
        }
      }
    );
    return { success: true, message: '自動同步已啟動' };
  } catch (error) {
    errorLoggingService.logError('SYNC_START_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('sync:stopAutoSync', async (event) => {
  try {
    dataSyncService.stopAutoSync();
    return { success: true, message: '自動同步已停止' };
  } catch (error) {
    errorLoggingService.logError('SYNC_STOP_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('sync:syncData', async (event, userId, localData) => {
  try {
    return await dataSyncService.syncData(userId, localData);
  } catch (error) {
    errorLoggingService.logError('SYNC_ERROR', error.message, error.stack);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('sync:getSyncStatus', async (event) => {
  return dataSyncService.getSyncStatus();
});

// ============ 通知服務 IPC 處理器 ============
ipcMain.handle('notification:list', async (event, limit) => {
  return notificationService.getNotifications(limit);
});

ipcMain.handle('notification:clear', async (event, notificationId) => {
  return notificationService.clearNotification(notificationId);
});

ipcMain.handle('notification:clearAll', async (event) => {
  return notificationService.clearAllNotifications();
});

ipcMain.handle('notification:markAsRead', async (event, notificationId) => {
  return notificationService.markAsRead(notificationId);
});

ipcMain.handle('notification:getStats', async (event) => {
  return notificationService.getNotificationStats();
});