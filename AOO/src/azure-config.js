// Azure 配置模組
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AZURE_CONFIG = {
  storageAccount: process.env.AZURE_STORAGE_ACCOUNT || '',
  storageKey: process.env.AZURE_STORAGE_KEY || '',
  cosmosEndpoint: process.env.AZURE_COSMOS_ENDPOINT || '',
  cosmosKey: process.env.AZURE_COSMOS_KEY || '',
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
  tenantId: process.env.AZURE_TENANT_ID || '',
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || ''
};

function validateAzureConfig() {
  const requiredFields = ['storageAccount', 'storageKey'];
  const missing = requiredFields.filter(field => !AZURE_CONFIG[field]);
  
  if (missing.length > 0) {
    // 若希望完全靜默缺少憑證的提醒，可在本機 `.env` 設定
    // `SUPPRESS_AZURE_WARNINGS=true`。
    if (process.env.SUPPRESS_AZURE_WARNINGS === 'true') {
      return false;
    }

    // 改用 info 等級以減少啟動時雜訊，並提供明確下一步（不會包含任何憑證）
    console.info(`Azure 配置不足（可複製 .env.example 為 .env 並填入）：${missing.join(', ')}`);
    return false;
  }
  return true;
}

module.exports = {
  AZURE_CONFIG,
  validateAzureConfig
};
