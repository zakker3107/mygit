/**
 * Google Cloud 整合示例
 * 展示如何在應用程式中使用 Google Cloud 服務
 */

// ==================== Storage 使用示例 ====================

async function uploadFileToGoogleCloud() {
  try {
    // 準備檔案資料（例如：JSON 序列化）
    const fileData = JSON.stringify({
      accountName: 'test-account',
      loginTime: new Date().toISOString(),
      status: '已登入'
    });

    // 上傳到 Google Cloud Storage
    const result = await window.electronAPI.googleCloud.uploadFile(
      'my-bucket',
      'accounts/test-account.json',
      Buffer.from(fileData)
    );

    if (result.success) {
      console.log('✓ 檔案上傳成功');
      return result.data;
    } else {
      console.error('✗ 上傳失敗:', result.message);
      return null;
    }
  } catch (error) {
    console.error('上傳錯誤:', error);
  }
}

async function downloadFileFromGoogleCloud() {
  try {
    const result = await window.electronAPI.googleCloud.downloadFile(
      'my-bucket',
      'accounts/test-account.json'
    );

    if (result.success) {
      // 解析 JSON 資料
      const accountData = JSON.parse(result.data.toString());
      console.log('✓ 檔案下載成功:', accountData);
      return accountData;
    } else {
      console.error('✗ 下載失敗:', result.message);
      return null;
    }
  } catch (error) {
    console.error('下載錯誤:', error);
  }
}

async function listFilesInGoogleCloud() {
  try {
    const result = await window.electronAPI.googleCloud.listFiles(
      'my-bucket',
      'accounts/'
    );

    if (result.success) {
      console.log('✓ 檔案列表:');
      result.files.forEach(file => {
        console.log(`  - ${file.name} (${file.size} bytes, 更新於 ${file.updated})`);
      });
      return result.files;
    } else {
      console.error('✗ 列表失敗:', result.message);
      return [];
    }
  } catch (error) {
    console.error('列表錯誤:', error);
  }
}

async function deleteFileFromGoogleCloud() {
  try {
    const result = await window.electronAPI.googleCloud.deleteFile(
      'my-bucket',
      'accounts/test-account.json'
    );

    if (result.success) {
      console.log('✓ 檔案刪除成功');
      return true;
    } else {
      console.error('✗ 刪除失敗:', result.message);
      return false;
    }
  } catch (error) {
    console.error('刪除錯誤:', error);
  }
}

// ==================== Firestore 使用示例 ====================

async function saveAccountToFirestore(accountData) {
  try {
    const result = await window.electronAPI.googleCloud.saveToFirestore(
      'accounts',  // collection 名稱
      'account-123',  // document ID
      {
        name: accountData.name,
        email: accountData.email,
        status: '已登入',
        loginTime: new Date().toISOString(),
        lastSync: new Date().toISOString()
      }
    );

    if (result.success) {
      console.log('✓ 帳戶資料已保存到 Firestore');
      return true;
    } else {
      console.error('✗ 儲存失敗:', result.message);
      return false;
    }
  } catch (error) {
    console.error('儲存錯誤:', error);
  }
}

async function getAccountFromFirestore(accountId) {
  try {
    const result = await window.electronAPI.googleCloud.getFromFirestore(
      'accounts',  // collection 名稱
      accountId  // document ID
    );

    if (result.success) {
      console.log('✓ 帳戶資料已取得:', result.data);
      return result.data;
    } else {
      console.error('✗ 查詢失敗:', result.message);
      return null;
    }
  } catch (error) {
    console.error('查詢錯誤:', error);
  }
}

// ==================== 連接和狀態檢查 ====================

async function connectToGoogleCloud() {
  try {
    const result = await window.electronAPI.googleCloud.connect();
    
    if (result.success) {
      console.log('✓ Google Cloud 連接成功:', result.message);
      return true;
    } else {
      console.warn('⚠️ Google Cloud 連接失敗:', result.message);
      return false;
    }
  } catch (error) {
    console.error('連接錯誤:', error);
  }
}

async function checkGoogleCloudStatus() {
  try {
    const status = await window.electronAPI.googleCloud.getStatus();
    
    console.log('Google Cloud 狀態:');
    console.log(`  連接: ${status.connected ? '✓ 已連接' : '✗ 未連接'}`);
    console.log(`  Project ID: ${status.projectId}`);
    console.log(`  Storage Bucket: ${status.bucket}`);
    
    return status;
  } catch (error) {
    console.error('狀態檢查錯誤:', error);
  }
}

// ==================== 整合到帳戶管理流程 ====================

/**
 * 整合示例：將帳戶備份同時保存到 Storage 和 Firestore
 */
async function backupAccountToGoogleCloud(account) {
  console.log(`開始備份帳戶: ${account.name}`);
  
  try {
    // 1. 檢查連接
    const isConnected = await connectToGoogleCloud();
    if (!isConnected) {
      console.warn('Google Cloud 未連接，將使用本地回退模式');
    }

    // 2. 保存到 Storage（JSON 檔案）
    const fileName = `backups/${account.name}-${Date.now()}.json`;
    const fileData = JSON.stringify({
      ...account,
      backupTime: new Date().toISOString()
    });
    
    const storageResult = await window.electronAPI.googleCloud.uploadFile(
      'my-bucket',
      fileName,
      Buffer.from(fileData)
    );

    if (!storageResult.success) {
      console.error('Storage 備份失敗:', storageResult.message);
      return false;
    }
    console.log('✓ Storage 備份成功');

    // 3. 保存到 Firestore（用於快速查詢）
    const firestoreResult = await window.electronAPI.googleCloud.saveToFirestore(
      'accounts',
      account.id || `account-${Date.now()}`,
      {
        name: account.name,
        status: account.status,
        backupTime: new Date().toISOString(),
        storageFile: fileName
      }
    );

    if (!firestoreResult.success) {
      console.error('Firestore 備份失敗:', firestoreResult.message);
      return false;
    }
    console.log('✓ Firestore 備份成功');

    // 4. 收集遙測資料
    collectData('account_backup', {
      accountName: account.name,
      storageSize: fileData.length,
      timestamp: new Date().toISOString()
    });

    console.log('✓ 帳戶備份完成');
    return true;

  } catch (error) {
    console.error('備份過程中發生錯誤:', error);
    return false;
  }
}

/**
 * 整合示例：從 Google Cloud 恢復帳戶
 */
async function restoreAccountFromGoogleCloud(accountId) {
  console.log(`開始恢復帳戶: ${accountId}`);
  
  try {
    // 1. 從 Firestore 查詢帳戶元資料
    const account = await window.electronAPI.googleCloud.getFromFirestore(
      'accounts',
      accountId
    );

    if (!account || !account.data) {
      console.error('無法在 Firestore 中找到帳戶');
      return null;
    }

    // 2. 從 Storage 下載完整資料
    const fileResult = await window.electronAPI.googleCloud.downloadFile(
      'my-bucket',
      account.data.storageFile
    );

    if (!fileResult.success) {
      console.error('無法從 Storage 下載檔案:', fileResult.message);
      return null;
    }

    // 3. 解析和驗證資料
    const restoredAccount = JSON.parse(fileResult.data.toString());
    console.log('✓ 帳戶恢復成功:', restoredAccount);

    // 4. 記錄遙測資料
    collectData('account_restore', {
      accountName: restoredAccount.name,
      backupTime: restoredAccount.backupTime,
      timestamp: new Date().toISOString()
    });

    return restoredAccount;

  } catch (error) {
    console.error('恢復過程中發生錯誤:', error);
    return null;
  }
}

// ==================== 匯出模組函式 ====================

// 如果此檔案被匯入為模組
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    uploadFileToGoogleCloud,
    downloadFileFromGoogleCloud,
    listFilesInGoogleCloud,
    deleteFileFromGoogleCloud,
    saveAccountToFirestore,
    getAccountFromFirestore,
    connectToGoogleCloud,
    checkGoogleCloudStatus,
    backupAccountToGoogleCloud,
    restoreAccountFromGoogleCloud
  };
}
