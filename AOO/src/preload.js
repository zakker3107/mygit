// Preload script for secure communication between main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');

let axios, CryptoJS;
try {
  axios = require('axios');
  console.log('axios loaded successfully');
} catch (e) {
  console.error('Failed to load axios:', e.message);
}

try {
  CryptoJS = require('crypto-js');
  console.log('CryptoJS loaded successfully');
} catch (e) {
  console.error('Failed to load CryptoJS:', e.message);
}

// 防止重複請求的去重機制
const requestDedup = new Map(); // url -> { promise, timestamp }
const REQUEST_DEDUP_TIMEOUT = 3000; // 3秒內相同請求去重

function getDedupKey(method, url) {
  return `${method}:${url}`;
}

async function dedupRequest(key, requestFn) {
  const cached = requestDedup.get(key);
  if (cached && Date.now() - cached.timestamp < REQUEST_DEDUP_TIMEOUT) {
    return cached.promise;
  }
  const promise = requestFn();
  requestDedup.set(key, { promise, timestamp: Date.now() });
  return promise;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // ============ 遙測和加密 ============
  sendTelemetry: async (payload) => {
    if (!payload.event || !payload.timestamp) {
      throw new Error('Invalid telemetry payload');
    }
    if (!axios) {
      console.warn('axios not available, skipping telemetry');
      return { data: {} };
    }
    return axios.post('https://example.com/collect', payload);
  },
  
  getEncryptionKey: () => process.env.ENCRYPTION_KEY || 'default-secure-key',

  // ============ 加密工具 ============
  crypto: {
    encrypt: (data, key) => {
      if (!CryptoJS) {
        throw new Error('CryptoJS not available');
      }
      return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    },
    decrypt: (encryptedData, key) => {
      if (!CryptoJS) {
        throw new Error('CryptoJS not available');
      }
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      } catch (error) {
        console.error('解密失敗:', error);
        throw error;
      }
    }
  },

  // ============ 通用 Cloud API ============
  cloudApi: {
    request: async (method, url, data, config = {}) => {
      if (!method || !url) throw new Error('Invalid request parameters');
      if (!axios) throw new Error('axios not available');
      const key = getDedupKey(method, url);
      return dedupRequest(key, () => 
        axios(Object.assign({ method, url, data, timeout: 30000 }, config))
      );
    },
    get: async (url, config = {}) => {
      if (!axios) throw new Error('axios not available');
      const key = getDedupKey('GET', url);
      return dedupRequest(key, () => axios.get(url, Object.assign({ timeout: 30000 }, config)));
    },
    post: async (url, data, config = {}) => {
      if (!axios) throw new Error('axios not available');
      const key = getDedupKey('POST', url);
      return dedupRequest(key, () => axios.post(url, data, Object.assign({ timeout: 30000 }, config)));
    }
  },
  
  // ============ Azure API ============
  azure: {
    connect: () => ipcRenderer.invoke('azure:connect'),
    createContainer: (containerName) => ipcRenderer.invoke('azure:createContainer', containerName),
    uploadFile: (containerName, fileName, fileData) => ipcRenderer.invoke('azure:uploadFile', containerName, fileName, fileData),
    downloadFile: (containerName, fileName) => ipcRenderer.invoke('azure:downloadFile', containerName, fileName),
    listBlobs: (containerName) => ipcRenderer.invoke('azure:listBlobs', containerName),
    deleteFile: (containerName, fileName) => ipcRenderer.invoke('azure:deleteFile', containerName, fileName),
    getStatus: () => ipcRenderer.invoke('azure:getStatus')
  },

  // ============ 帳戶持久化 API ============
  persistence: {
    saveAccounts: (accounts, userId) => ipcRenderer.invoke('persistence:saveAccounts', accounts, userId),
    restoreAccounts: (userId) => ipcRenderer.invoke('persistence:restoreAccounts', userId),
    listBackups: (userId) => ipcRenderer.invoke('persistence:listBackups', userId)
  },

  // ============ 錯誤日誌 API ============
  logging: {
    uploadLogs: (userId) => ipcRenderer.invoke('logging:uploadLogs', userId),
    getStats: () => ipcRenderer.invoke('logging:getStats'),
    getLogs: (filterType, limit) => ipcRenderer.invoke('logging:getLogs', filterType, limit)
  },

  // ============ 認證 API ============
  auth: {
    createAccount: (username, password, email) => ipcRenderer.invoke('auth:createAccount', username, password, email),
    login: (username, password, deviceId) => ipcRenderer.invoke('auth:login', username, password, deviceId),
    logout: (sessionId) => ipcRenderer.invoke('auth:logout', sessionId),
    validateSession: (sessionId) => ipcRenderer.invoke('auth:validateSession', sessionId),
    changePassword: (username, oldPassword, newPassword) => ipcRenderer.invoke('auth:changePassword', username, oldPassword, newPassword)
  },

  // ============ 數據同步 API ============
  sync: {
    startAutoSync: (userId) => ipcRenderer.invoke('sync:startAutoSync', userId),
    stopAutoSync: () => ipcRenderer.invoke('sync:stopAutoSync'),
    syncData: (userId, localData) => ipcRenderer.invoke('sync:syncData', userId, localData),
    getSyncStatus: () => ipcRenderer.invoke('sync:getSyncStatus')
  },

  // ============ Google Cloud API ============
  googleCloud: {
    connect: () => ipcRenderer.invoke('googleCloud:connect'),
    uploadFile: (bucket, filePath, fileData) => ipcRenderer.invoke('googleCloud:uploadFile', bucket, filePath, fileData),
    downloadFile: (bucket, filePath) => ipcRenderer.invoke('googleCloud:downloadFile', bucket, filePath),
    deleteFile: (bucket, filePath) => ipcRenderer.invoke('googleCloud:deleteFile', bucket, filePath),
    listFiles: (bucket, prefix) => ipcRenderer.invoke('googleCloud:listFiles', bucket, prefix),
    saveToFirestore: (collection, documentId, data) => ipcRenderer.invoke('googleCloud:saveToFirestore', collection, documentId, data),
    getFromFirestore: (collection, documentId) => ipcRenderer.invoke('googleCloud:getFromFirestore', collection, documentId),
    getStatus: () => ipcRenderer.invoke('googleCloud:getStatus')
  },

  // ============ 通知 API ============
  notification: {
    list: (limit) => ipcRenderer.invoke('notification:list', limit),
    clear: (notificationId) => ipcRenderer.invoke('notification:clear', notificationId),
    clearAll: () => ipcRenderer.invoke('notification:clearAll'),
    markAsRead: (notificationId) => ipcRenderer.invoke('notification:markAsRead', notificationId),
    getStats: () => ipcRenderer.invoke('notification:getStats')
  }
});