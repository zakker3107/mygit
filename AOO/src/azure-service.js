// Azure 服務模組
const { BlobServiceClient } = require('@azure/storage-blob');
const { AZURE_CONFIG } = require('./azure-config');
const fs = require('fs');
const path = require('path');

class AzureService {
  constructor() {
    this.blobServiceClient = null;
    this.isConnected = false;
    this.downloadCache = new Map(); // containerName:fileName -> {data, timestamp}
    this.cacheExpiry = 10 * 60 * 1000; // 10分鐘快取有效期
    this.maxRetries = 3;
    this.retryDelayMs = 1000;
    this.localRoot = path.join(__dirname, '..', 'local_azure');
  }

  // 檢查是否應該使用本地回退（動態檢查，不依賴構造時的環境變數）
  _shouldUseFallback() {
    return process.env.LOCAL_FALLBACK === 'true';
  }

  // 連接到 Azure Blob Storage（含指數退避重試）
  async connectToAzure() {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const connectionString = `DefaultEndpointsProtocol=https;AccountName=${AZURE_CONFIG.storageAccount};AccountKey=${AZURE_CONFIG.storageKey};EndpointSuffix=core.windows.net`;
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        
        // 測試連接
        await this.blobServiceClient.getProperties();
        this.isConnected = true;
        console.log('✓ Azure 連接成功');
        return { success: true, message: 'Azure 連接成功' };
      } catch (error) {
        this.isConnected = false;
        // 若啟用本地回退，則視為可用但非 Azure 連線模式
        if (this._shouldUseFallback()) {
          console.warn('⚠️ Azure 連接失敗，已啟用本地回退（LOCAL_FALLBACK=true）');
          // 確保本地根目錄存在
          try {
            fs.mkdirSync(this.localRoot, { recursive: true });
          } catch (e) {}
          return { success: true, message: '使用本地回退模式' };
        }
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`⚠️ Azure 連接失敗，${delay}ms 後重試 (${attempt + 1}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('✗ Azure 連接失敗:', error.message);
          return { success: false, message: `連接失敗: ${error.message}` };
        }
      }
    }
  }

  // 建立容器
  async createContainer(containerName) {
    try {
      if (!this.isConnected) {
        if (this._shouldUseFallback()) {
          const dir = path.join(this.localRoot, containerName);
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✓ (本地回退) 容器 '${containerName}' 建立成功`);
          return { success: true, message: `(local) 容器 '${containerName}' 建立成功` };
        }
        throw new Error('未連接到 Azure');
      }
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      console.log(`✓ 容器 '${containerName}' 建立成功`);
      return { success: true, message: `容器 '${containerName}' 建立成功` };
    } catch (error) {
      console.error('✗ 建立容器失敗:', error.message);
      return { success: false, message: `建立失敗: ${error.message}` };
    }
  }

  // 上傳檔案到 Azure
  async uploadFile(containerName, fileName, fileData) {
    try {
      if (!this.isConnected) {
        if (this._shouldUseFallback()) {
          const dir = path.join(this.localRoot, containerName);
          fs.mkdirSync(dir, { recursive: true });
          const target = path.join(dir, fileName);
          fs.writeFileSync(target, typeof fileData === 'string' ? fileData : Buffer.from(fileData));
          console.log(`✓ (本地回退) 檔案 '${fileName}' 已寫入本地: ${target}`);
          return { success: true, message: `(local) 檔案 '${fileName}' 上傳成功` };
        }
        throw new Error('未連接到 Azure');
      }
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(fileData, fileData.length || Buffer.byteLength(fileData));
      console.log(`✓ 檔案 '${fileName}' 上傳成功`);
      return { success: true, message: `檔案 '${fileName}' 上傳成功` };
    } catch (error) {
      console.error('✗ 上傳檔案失敗:', error.message);
      return { success: false, message: `上傳失敗: ${error.message}` };
    }
  }

  // 下載檔案（含快取）
  async downloadFile(containerName, fileName) {
    const cacheKey = `${containerName}:${fileName}`;
    const cached = this.downloadCache.get(cacheKey);
    
    // 檢查快取有效性
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`✓ 檔案 '${fileName}' 由快取取得`);
      return { success: true, data: cached.data };
    }
    
    try {
      if (!this.isConnected) {
        if (this._shouldUseFallback()) {
          const target = path.join(this.localRoot, containerName, fileName);
          if (!fs.existsSync(target)) {
            throw new Error('本地檔案不存在');
          }
          const downloaded = fs.readFileSync(target, 'utf8');
          this.downloadCache.set(cacheKey, { data: downloaded, timestamp: Date.now() });
          console.log(`✓ (本地回退) 檔案 '${fileName}' 下載成功`);
          return { success: true, data: downloaded };
        }
        throw new Error('未連接到 Azure');
      }
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
      
      // 儲存至快取
      this.downloadCache.set(cacheKey, { data: downloaded, timestamp: Date.now() });
      console.log(`✓ 檔案 '${fileName}' 下載成功`);
      return { success: true, data: downloaded };
    } catch (error) {
      console.error('✗ 下載檔案失敗:', error.message);
      return { success: false, message: `下載失敗: ${error.message}` };
    }
  }

  // 列出容器中的所有 Blob
  async listBlobs(containerName) {
    try {
      if (!this.isConnected) {
        if (this._shouldUseFallback()) {
          const dir = path.join(this.localRoot, containerName);
          if (!fs.existsSync(dir)) return { success: true, blobs: [] };
          const files = fs.readdirSync(dir);
          console.log(`✓ (本地回退) 列出容器 '${containerName}' 中的 Blobs 成功`);
          return { success: true, blobs: files };
        }
        throw new Error('未連接到 Azure');
      }
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      const blobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        blobs.push(blob.name);
      }
      console.log(`✓ 列出容器 '${containerName}' 中的 Blobs 成功`);
      return { success: true, blobs: blobs };
    } catch (error) {
      console.error('✗ 列出 Blobs 失敗:', error.message);
      return { success: false, message: `列出失敗: ${error.message}` };
    }
  }

  // 刪除檔案
  async deleteFile(containerName, fileName) {
    try {
      if (!this.isConnected) {
        if (this._shouldUseFallback()) {
          const target = path.join(this.localRoot, containerName, fileName);
          if (fs.existsSync(target)) fs.unlinkSync(target);
          console.log(`✓ (本地回退) 檔案 '${fileName}' 刪除成功`);
          return { success: true, message: `(local) 檔案 '${fileName}' 刪除成功` };
        }
        throw new Error('未連接到 Azure');
      }
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      await containerClient.deleteBlob(fileName);
      console.log(`✓ 檔案 '${fileName}' 刪除成功`);
      return { success: true, message: `檔案 '${fileName}' 刪除成功` };
    } catch (error) {
      console.error('✗ 刪除檔案失敗:', error.message);
      return { success: false, message: `刪除失敗: ${error.message}` };
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  // 備份設備安全設定到 Azure
  async backupDeviceSecuritySettings(deviceId, securitySettings) {
    try {
      if (!this.isConnected) {
        throw new Error('未連接到 Azure');
      }
      const containerName = 'device-security-backup';
      const fileName = `device-${deviceId}-backup-${new Date().getTime()}.json`;
      const fileData = JSON.stringify(securitySettings);
      
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists();
      
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(fileData, Buffer.byteLength(fileData));
      
      console.log(`✓ 設備安全設定已備份至 Azure: ${fileName}`);
      return { success: true, message: '設備安全設定已成功備份至 Azure' };
    } catch (error) {
      console.error('✗ 備份設備安全設定失敗:', error.message);
      return { success: false, message: `備份失敗: ${error.message}` };
    }
  }

  // 恢復設備安全設定從 Azure
  async restoreDeviceSecuritySettings(deviceId) {
    try {
      if (!this.isConnected) {
        throw new Error('未連接到 Azure');
      }
      const containerName = 'device-security-backup';
      const containerClient = this.blobServiceClient.getContainerClient(containerName);
      
      const blobs = [];
      for await (const blob of containerClient.listBlobsFlat()) {
        if (blob.name.includes(`device-${deviceId}`)) {
          blobs.push(blob.name);
        }
      }
      
      if (blobs.length === 0) {
        return { success: false, message: '未找到此設備的備份' };
      }
      
      // 獲取最新的備份
      const latestBackup = blobs.sort().pop();
      const blockBlobClient = containerClient.getBlockBlobClient(latestBackup);
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);
      
      console.log(`✓ 設備安全設定已從 Azure 恢復: ${latestBackup}`);
      return { success: true, data: JSON.parse(downloaded) };
    } catch (error) {
      console.error('✗ 恢復設備安全設定失敗:', error.message);
      return { success: false, message: `恢復失敗: ${error.message}` };
    }
  }
}

// 將流轉換為字符串
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

module.exports = new AzureService();
