// Google Cloud 配置模組
// 用於管理 Google Cloud 相關的配置和認證資訊

class GoogleCloudConfig {
  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id';
    this.clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL || 'your-client-email@your-project.iam.gserviceaccount.com';
    this.privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY || '';
    this.storageBucket = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'your-bucket-name';
    this.firestoreDatabase = process.env.GOOGLE_CLOUD_FIRESTORE_DB || '(default)';
    this.useLocalFallback = process.env.GOOGLE_CLOUD_LOCAL_FALLBACK === 'true';
  }

  // 驗證配置是否完整
  isConfigValid() {
    return this.projectId && 
           this.projectId !== 'your-project-id' &&
           this.clientEmail && 
           this.clientEmail !== 'your-client-email@your-project.iam.gserviceaccount.com' &&
           this.privateKey &&
           this.storageBucket &&
           this.storageBucket !== 'your-bucket-name';
  }

  // 取得認證物件（用於 Google Cloud SDK）
  getAuthConfig() {
    return {
      type: 'service_account',
      project_id: this.projectId,
      private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID || '',
      private_key: this.privateKey,
      client_email: this.clientEmail,
      client_id: process.env.GOOGLE_CLOUD_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    };
  }

  // 記錄配置狀態（不產出敏感資訊）
  logConfigStatus() {
    console.log('【Google Cloud 配置狀態】');
    console.log(`  Project ID: ${this.projectId}`);
    console.log(`  Storage Bucket: ${this.storageBucket}`);
    console.log(`  Firestore DB: ${this.firestoreDatabase}`);
    console.log(`  Client Email: ${this.clientEmail.substring(0, 10)}...`);
    console.log(`  配置完整: ${this.isConfigValid() ? '✓' : '✗'}`);
    console.log(`  本地回退: ${this.useLocalFallback ? '啟用' : '停用'}`);
  }
}

module.exports = {
  GOOGLE_CLOUD_CONFIG: new GoogleCloudConfig()
};
