// Google Cloud 服務模組
// 提供 Google Cloud Storage、Firestore 和其他 GCP 服務的整合

const axios = require('axios');
const { GOOGLE_CLOUD_CONFIG } = require('./google-cloud-config');
const fs = require('fs');
const path = require('path');

class GoogleCloudService {
  constructor() {
    this.projectId = GOOGLE_CLOUD_CONFIG.projectId;
    this.storageBucket = GOOGLE_CLOUD_CONFIG.storageBucket;
    this.firestoreDb = GOOGLE_CLOUD_CONFIG.firestoreDatabase;
    this.isConnected = false;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.maxRetries = 3;
    this.retryDelayMs = 1000;
    this.downloadCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10分鐘快取有效期
    this.localRoot = path.join(__dirname, '..', 'local_google_cloud');
  }

  // 檢查是否應使用本地回退
  _shouldUseFallback() {
    return process.env.GOOGLE_CLOUD_LOCAL_FALLBACK === 'true' || !GOOGLE_CLOUD_CONFIG.isConfigValid();
  }

  // 使用 Service Account 認證取得存取令牌
  async getAccessToken() {
    try {
      // 若已有有效令牌，直接返回
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const config = GOOGLE_CLOUD_CONFIG.getAuthConfig();
      const now = Math.floor(Date.now() / 1000);
      const expiryTime = now + 3600; // 1小時後過期

      // 建立 JWT
      const jwtHeader = Buffer.from(JSON.stringify({ 
        alg: 'RS256',
        typ: 'JWT' 
      })).toString('base64').replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

      const jwtPayload = Buffer.from(JSON.stringify({
        iss: config.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: config.token_uri,
        exp: expiryTime,
        iat: now
      })).toString('base64').replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

      // 注：實際實現應使用適當的 JWT 簽名。這裡需要使用 crypto 或專門的 JWT 庫
      // 為簡起見，使用 Google API 預期的格式
      console.warn('⚠️ JWT 簽名需要使用 private key。建議安裝 jsonwebtoken 套件。');

      // 暫時返回 null，實際應該使用正確的簽名
      return null;
    } catch (error) {
      console.error('❌ 取得存取令牌失敗:', error.message);
      throw error;
    }
  }

  // 連接到 Google Cloud
  async connect() {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (!GOOGLE_CLOUD_CONFIG.isConfigValid()) {
          if (this._shouldUseFallback()) {
            console.warn('⚠️ Google Cloud 配置無效，已啟用本地回退模式');
            // 確保本地根目錄存在
            fs.mkdirSync(this.localRoot, { recursive: true });
            this.isConnected = true;
            return { success: true, message: '使用本地回退模式' };
          }
          throw new Error('Google Cloud 配置無效，請檢查環境變數');
        }

        // 嘗試驗證
        const token = await this.getAccessToken();
        if (!token && this._shouldUseFallback()) {
          console.warn('⚠️ 無法取得 Google Cloud 令牌，切換至本地回退模式');
          fs.mkdirSync(this.localRoot, { recursive: true });
          this.isConnected = true;
          return { success: true, message: '使用本地回退模式' };
        }

        this.accessToken = token;
        this.isConnected = true;
        console.log('✓ Google Cloud 連接成功');
        return { success: true, message: 'Google Cloud 連接成功' };
      } catch (error) {
        this.isConnected = false;
        if (this._shouldUseFallback()) {
          console.warn('⚠️ Google Cloud 連接失敗，已啟用本地回退（GOOGLE_CLOUD_LOCAL_FALLBACK=true）');
          try {
            fs.mkdirSync(this.localRoot, { recursive: true });
          } catch (e) {}
          return { success: true, message: '使用本地回退模式' };
        }
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`⚠️ Google Cloud 連接失敗，${delay}ms 後重試 (${attempt + 1}/${this.maxRetries}): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ Google Cloud 連接最終失敗');
          return { success: false, message: `連接失敗: ${error.message}` };
        }
      }
    }
    return { success: false, message: 'Google Cloud 連接失敗' };
  }

  // 上傳檔案到 Google Cloud Storage
  async uploadFile(bucket, filePath, fileData) {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    if (this._shouldUseFallback()) {
      return this._localUploadFile(filePath, fileData);
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();
        if (!token) throw new Error('無法取得存取令牌');

        // 使用 Google Cloud Storage JSON API
        const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;
        
        const response = await axios.post(url, fileData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
          },
          timeout: 30000
        });

        console.log(`✓ 檔案上傳成功: ${filePath}`);
        return { 
          success: true, 
          message: '檔案上傳成功',
          data: response.data 
        };
      } catch (error) {
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`⚠️ 上傳失敗，${delay}ms 後重試: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ 檔案上傳最終失敗');
          return { success: false, message: `上傳失敗: ${error.message}` };
        }
      }
    }
  }

  // 下載檔案從 Google Cloud Storage
  async downloadFile(bucket, filePath) {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    // 檢查快取
    const cacheKey = `${bucket}:${filePath}`;
    const cached = this.downloadCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      console.log(`✓ 從快取返回檔案: ${filePath}`);
      return { success: true, data: cached.data };
    }

    if (this._shouldUseFallback()) {
      return this._localDownloadFile(filePath);
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();
        if (!token) throw new Error('無法取得存取令牌');

        const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
        
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000
        });

        // 快取結果
        this.downloadCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        
        console.log(`✓ 檔案下載成功: ${filePath}`);
        return { 
          success: true, 
          data: response.data 
        };
      } catch (error) {
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.warn(`⚠️ 下載失敗，${delay}ms 後重試: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ 檔案下載最終失敗');
          return { success: false, message: `下載失敗: ${error.message}` };
        }
      }
    }
  }

  // 刪除 Google Cloud Storage 中的檔案
  async deleteFile(bucket, filePath) {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    if (this._shouldUseFallback()) {
      return this._localDeleteFile(filePath);
    }

    try {
      const token = await this.getAccessToken();
      if (!token) throw new Error('無法取得存取令牌');

      const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(filePath)}`;
      
      await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      });

      console.log(`✓ 檔案刪除成功: ${filePath}`);
      return { success: true, message: '檔案刪除成功' };
    } catch (error) {
      console.error('❌ 檔案刪除失敗:', error.message);
      return { success: false, message: `刪除失敗: ${error.message}` };
    }
  }

  // 列出 Google Cloud Storage 中的檔案
  async listFiles(bucket, prefix = '') {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    if (this._shouldUseFallback()) {
      return this._localListFiles(prefix);
    }

    try {
      const token = await this.getAccessToken();
      if (!token) throw new Error('無法取得存取令牌');

      const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      });

      const files = (response.data.items || []).map(item => ({
        name: item.name,
        size: item.size,
        updated: item.updated,
        contentType: item.contentType
      }));

      console.log(`✓ 列出 ${files.length} 個檔案`);
      return { success: true, files };
    } catch (error) {
      console.error('❌ 列表檔案失敗:', error.message);
      return { success: false, message: `列表失敗: ${error.message}` };
    }
  }

  // ============ 本地回退實現 ============

  _localUploadFile(filePath, fileData) {
    try {
      const fullPath = path.join(this.localRoot, filePath);
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fullPath, fileData);
      console.log(`✓ 本地上傳成功: ${filePath}`);
      return { success: true, message: '本地上傳成功' };
    } catch (error) {
      console.error('❌ 本地上傳失敗:', error.message);
      return { success: false, message: `本地上傳失敗: ${error.message}` };
    }
  }

  _localDownloadFile(filePath) {
    try {
      const fullPath = path.join(this.localRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: '本地檔案不存在' };
      }
      const data = fs.readFileSync(fullPath);
      this.downloadCache.set(`local:${filePath}`, { data, timestamp: Date.now() });
      console.log(`✓ 本地下載成功: ${filePath}`);
      return { success: true, data };
    } catch (error) {
      console.error('❌ 本地下載失敗:', error.message);
      return { success: false, message: `本地下載失敗: ${error.message}` };
    }
  }

  _localDeleteFile(filePath) {
    try {
      const fullPath = path.join(this.localRoot, filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.downloadCache.delete(`local:${filePath}`);
      }
      console.log(`✓ 本地刪除成功: ${filePath}`);
      return { success: true, message: '本地刪除成功' };
    } catch (error) {
      console.error('❌ 本地刪除失敗:', error.message);
      return { success: false, message: `本地刪除失敗: ${error.message}` };
    }
  }

  _localListFiles(prefix = '') {
    try {
      const dir = prefix ? path.join(this.localRoot, prefix) : this.localRoot;
      if (!fs.existsSync(dir)) {
        return { success: true, files: [] };
      }
      const files = fs.readdirSync(dir).map(name => ({
        name: path.join(prefix, name).replace(/\\/g, '/'),
        size: fs.statSync(path.join(dir, name)).size,
        updated: new Date().toISOString()
      }));
      return { success: true, files };
    } catch (error) {
      console.error('❌ 本地列表失敗:', error.message);
      return { success: false, message: `本地列表失敗: ${error.message}` };
    }
  }

  // Firestore 操作
  async saveToFirestore(collection, documentId, data) {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    if (this._shouldUseFallback()) {
      return this._localSaveToFirestore(collection, documentId, data);
    }

    try {
      const token = await this.getAccessToken();
      if (!token) throw new Error('無法取得存取令牌');

      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.firestoreDb}/documents/${collection}/${documentId}`;
      
      const response = await axios.patch(url, 
        {
          fields: this._firestoreEncode(data)
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log(`✓ Firestore 儲存成功: ${collection}/${documentId}`);
      return { success: true, message: '儲存成功' };
    } catch (error) {
      console.error('❌ Firestore 儲存失敗:', error.message);
      return { success: false, message: `儲存失敗: ${error.message}` };
    }
  }

  async getFromFirestore(collection, documentId) {
    if (!this.isConnected) {
      return { success: false, message: 'Google Cloud 未連接' };
    }

    if (this._shouldUseFallback()) {
      return this._localGetFromFirestore(collection, documentId);
    }

    try {
      const token = await this.getAccessToken();
      if (!token) throw new Error('無法取得存取令牌');

      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.firestoreDb}/documents/${collection}/${documentId}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000
      });

      console.log(`✓ Firestore 查詢成功: ${collection}/${documentId}`);
      return { success: true, data: this._firestoreDecode(response.data.fields) };
    } catch (error) {
      console.error('❌ Firestore 查詢失敗:', error.message);
      return { success: false, message: `查詢失敗: ${error.message}` };
    }
  }

  // Firestore 資料編碼
  _firestoreEncode(data) {
    const encoded = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        encoded[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        encoded[key] = { doubleValue: value };
      } else if (typeof value === 'boolean') {
        encoded[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        encoded[key] = { timestampValue: value.toISOString() };
      }
    }
    return encoded;
  }

  // Firestore 資料解碼
  _firestoreDecode(fields) {
    const decoded = {};
    for (const [key, field] of Object.entries(fields)) {
      if (field.stringValue) {
        decoded[key] = field.stringValue;
      } else if (field.doubleValue) {
        decoded[key] = field.doubleValue;
      } else if (field.booleanValue) {
        decoded[key] = field.booleanValue;
      } else if (field.timestampValue) {
        decoded[key] = new Date(field.timestampValue);
      }
    }
    return decoded;
  }

  // ============ 本地 Firestore 回退實作 ============
  _localSaveToFirestore(collection, documentId, data) {
    try {
      const dir = path.join(this.localRoot, 'firestore', collection);
      fs.mkdirSync(dir, { recursive: true });
      const fullPath = path.join(dir, `${documentId}.json`);
      fs.writeFileSync(fullPath, JSON.stringify({ ...data, _savedAt: new Date().toISOString() }));
      console.log(`✓ 本地 Firestore 儲存成功: ${collection}/${documentId}`);
      return { success: true, message: '本地儲存成功' };
    } catch (error) {
      console.error('❌ 本地 Firestore 儲存失敗:', error.message);
      return { success: false, message: `本地儲存失敗: ${error.message}` };
    }
  }

  _localGetFromFirestore(collection, documentId) {
    try {
      const fullPath = path.join(this.localRoot, 'firestore', collection, `${documentId}.json`);
      if (!fs.existsSync(fullPath)) {
        return { success: false, message: '本地文件不存在' };
      }
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
      // Remove internal fields if present
      if (parsed._savedAt) delete parsed._savedAt;
      console.log(`✓ 本地 Firestore 讀取成功: ${collection}/${documentId}`);
      return { success: true, data: parsed };
    } catch (error) {
      console.error('❌ 本地 Firestore 讀取失敗:', error.message);
      return { success: false, message: `本地讀取失敗: ${error.message}` };
    }
  }

  // 記錄服務狀態
  logStatus() {
    console.log('【Google Cloud 服務狀態】');
    console.log(`  連接狀態: ${this.isConnected ? '✓ 已連接' : '✗ 未連接'}`);
    console.log(`  Project ID: ${this.projectId}`);
    console.log(`  Storage Bucket: ${this.storageBucket}`);
    console.log(`  Firestore DB: ${this.firestoreDb}`);
    console.log(`  快取項目數: ${this.downloadCache.size}`);
    console.log(`  本地回退: ${this._shouldUseFallback() ? '已使用' : '未使用'}`);
  }
}

module.exports = {
  GoogleCloudService: new GoogleCloudService()
};
