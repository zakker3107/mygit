// Renderer process script
// Encryption key (in production, use a secure key management)
// TODO: Ensure ENCRYPTION_KEY is set in environment
const ENCRYPTION_KEY = window.electronAPI.getEncryptionKey();

let accounts = [];
let telemetryEnabled = localStorage.getItem('telemetryEnabled') !== 'false'; // Default true
let deviceId = getOrCreateDeviceId();
let deviceSecuritySettings = getOrCreateDeviceSecuritySettings();

// 生成或獲取設備ID
function getOrCreateDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'DEVICE_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('deviceId', id);
  }
  return id;
}

// 獲取或建立設備安全設定
function getOrCreateDeviceSecuritySettings() {
  let settings = localStorage.getItem('deviceSecuritySettings');
  if (!settings) {
    settings = {
      trustedDevices: [{ deviceId: getOrCreateDeviceId(), deviceName: getDeviceName(), addedAt: new Date().toISOString() }],
      suspiciousLoginAttempts: [],
      lockdown: false
    };
    localStorage.setItem('deviceSecuritySettings', JSON.stringify(settings));
    return settings;
  }
  return JSON.parse(settings);
}

// 獲取設備名稱
function getDeviceName() {
  const storedName = localStorage.getItem('deviceName');
  if (storedName) return storedName;
  
  // 使用瀏覽器信息生成設備名稱
  const userAgent = navigator.userAgent;
  const browser = /Chrome/.test(userAgent) ? 'Chrome' : /Safari/.test(userAgent) ? 'Safari' : 'Unknown';
  const os = /Windows/.test(userAgent) ? 'Windows' : /Mac/.test(userAgent) ? 'Mac' : 'Unknown';
  const deviceName = `${os} - ${browser}`;
  localStorage.setItem('deviceName', deviceName);
  return deviceName;
}

// 保存設備安全設定
function saveDeviceSecuritySettings() {
  localStorage.setItem('deviceSecuritySettings', JSON.stringify(deviceSecuritySettings));
}

// 驗證登入設備
function validateDeviceLogin(accountName) {
  const trustedDevices = deviceSecuritySettings.trustedDevices || [];
  const isTrustedDevice = trustedDevices.some(d => d.deviceId === deviceId);
  
  if (!isTrustedDevice && deviceSecuritySettings.lockdown) {
    const suspiciousAttempt = {
      accountName,
      deviceId,
      deviceName: getDeviceName(),
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    deviceSecuritySettings.suspiciousLoginAttempts.push(suspiciousAttempt);
    saveDeviceSecuritySettings();
    
    alert(`⚠️ 異常登入偵測！\\n\\n帳戶: ${accountName}\\n設備: ${getDeviceName()}\\n\\n此設備未被信任。請在設備安全設定中驗證此設備。`);
    return false;
  }
  return true;
}

// Encrypt data
function encryptData(data) {
  return window.electronAPI.crypto.encrypt(data, ENCRYPTION_KEY);
}

// Decrypt data
function decryptData(encryptedData) {
  try {
    return window.electronAPI.crypto.decrypt(encryptedData, ENCRYPTION_KEY);
  } catch (error) {
    console.error('解密失敗:', error);
    alert('載入帳戶資料失敗，請檢查加密金鑰。');
    return [];
  }
}

// 從 localStorage 加載帳號資料 (已加密)
function loadAccounts() {
  const stored = localStorage.getItem('facebookAccounts');
  if (stored) {
    accounts = decryptData(stored);
  }
}

// 保存帳號資料到 localStorage (加密)
function saveAccounts() {
  localStorage.setItem('facebookAccounts', encryptData(accounts));
}

// 使用 debounce 排程儲存，減少頻繁寫入 localStorage（例如連續編輯/快速操作）
let _saveAccountsTimeout = null;
function scheduleSaveAccounts(delay = 500) {
  if (_saveAccountsTimeout) clearTimeout(_saveAccountsTimeout);
  _saveAccountsTimeout = setTimeout(() => {
    try {
      saveAccounts();
    } catch (e) {
      console.error('保存帳戶失敗', e);
    }
    _saveAccountsTimeout = null;
  }, delay);
}

// 初始化時加載帳號
function initializeApp() {
  try {
    console.log('Starting app initialization...');
    document.getElementById('loading').style.display = 'block';
    loadAccounts();
    console.log('Accounts loaded');
    updateAccountList();
    console.log('Account list updated');
    document.getElementById('loading').style.display = 'none';
    setupEventListeners();
    console.log('Event listeners set up');
    console.log('App initialization complete!');
  } catch (error) {
    console.error('App initialization error:', error);
    console.error('Error stack:', error.stack);
    alert(`App initialization failed: ${error.message}`);
  }
}

function setupEventListeners() {
  document.getElementById('loginBtn').addEventListener('click', () => {
    collectData('login_button_click', {});
    // Open Facebook login page in a new window or redirect
    window.open('https://www.facebook.com', '_blank');
    document.getElementById('content').innerHTML = '<p>請在瀏覽器中登入 Facebook。</p>';
  });

  document.getElementById('addAccountBtn').addEventListener('click', () => {
    collectData('add_account_button_click', {});
    const accountName = prompt('輸入帳戶名稱：');
    if (accountName) {
      // 輸入驗證：檢查長度、移除特殊字符
      const sanitizedName = accountName.trim().replace(/[<>\"'&]/g, '');
      if (sanitizedName.length === 0 || sanitizedName.length > 50) {
        alert('帳戶名稱無效：請輸入1-50個字符，且不包含特殊符號。');
        return;
      }
      // 檢查是否已存在
      if (accounts.some(acc => acc.name === sanitizedName)) {
        alert('帳戶名稱已存在。');
        return;
      }
      accounts.push({ name: sanitizedName, status: '未登入' });
      scheduleSaveAccounts();
      updateAccountList();
      collectData('account_added', { accountName: sanitizedName });
    }
  });

  document.getElementById('localControlBtn').addEventListener('click', () => {
    collectData('local_control_button_click', {});
    showLocalControlPanel();
  });

  // 新系統功能按鈕
  document.getElementById('persistenceBtn')?.addEventListener('click', () => {
    collectData('persistence_panel_click', {});
    showPersistencePanel();
  });

  document.getElementById('loggingBtn')?.addEventListener('click', () => {
    collectData('logging_panel_click', {});
    showLoggingPanel();
  });

  document.getElementById('notificationBtn')?.addEventListener('click', () => {
    collectData('notification_panel_click', {});
    showNotificationPanel();
  });

  document.getElementById('syncBtn')?.addEventListener('click', () => {
    collectData('sync_panel_click', {});
    showSyncPanel();
  });

  // 防盜設備管理按鈕
  document.getElementById('deviceSecurityBtn').addEventListener('click', () => {
    collectData('device_security_button_click', {});
    showDeviceSecurityPanel();
  });

  // Azure 連接按鈕
  document.getElementById('azureConnectBtn')?.addEventListener('click', async () => {
    collectData('azure_connect_click', {});
    const statusDiv = document.getElementById('azureStatus');
    statusDiv.innerHTML = '<p>連接中...</p>';
    
    try {
      const result = await window.electronAPI.azure.connect();
      if (result.success) {
        statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p>`;
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  // Azure 建立容器按鈕
  document.getElementById('azureCreateContainerBtn')?.addEventListener('click', async () => {
    collectData('azure_create_container_click', {});
    const containerName = prompt('輸入容器名稱：');
    if (!containerName) return;
    
    const statusDiv = document.getElementById('azureStatus');
    statusDiv.innerHTML = '<p>建立中...</p>';
    
    try {
      const result = await window.electronAPI.azure.createContainer(containerName);
      if (result.success) {
        statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p>`;
        collectData('azure_container_created', { containerName });
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  // Azure 列出 Blobs 按鈕
  document.getElementById('azureListBlobsBtn')?.addEventListener('click', async () => {
    collectData('azure_list_blobs_click', {});
    const containerName = prompt('輸入容器名稱：');
    if (!containerName) return;
    
    const statusDiv = document.getElementById('azureStatus');
    statusDiv.innerHTML = '<p>列出中...</p>';
    
    try {
      const result = await window.electronAPI.azure.listBlobs(containerName);
      if (result.success) {
        const blobsList = result.blobs.map(blob => `<li>${blob}</li>`).join('');
        statusDiv.innerHTML = `<p style="color: green;">✓ 容器 '${containerName}' 中的檔案：</p><ul>${blobsList}</ul>`;
        collectData('azure_blobs_listed', { containerName, count: result.blobs.length });
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  // 範例：呼叫通用雲端 API（使用 preload 暴露的 cloudApi）
  document.getElementById('callCloudApiBtn')?.addEventListener('click', async () => {
    collectData('cloud_api_call_click', {});
    const statusDiv = document.getElementById('azureStatus') || document.getElementById('content');
    statusDiv.innerHTML = '<p>呼叫中...</p>';
    try {
      const resp = await window.electronAPI.cloudApi.get('https://httpbin.org/get');
      statusDiv.innerHTML = `<pre style="white-space: pre-wrap;">${JSON.stringify(resp.data, null, 2)}</pre>`;
      collectData('cloud_api_call_success', { url: 'https://httpbin.org/get' });
    } catch (err) {
      statusDiv.innerHTML = `<p style="color: red;">錯誤: ${err.message}</p>`;
      collectData('cloud_api_call_error', { message: err.message });
    }
  });

  // 隱私設定
  document.getElementById('privacyBtn').addEventListener('click', () => {
    const enable = confirm('啟用數據收集以改進應用程式？（選擇"取消"以禁用）');
    telemetryEnabled = enable;
    localStorage.setItem('telemetryEnabled', enable);
    alert(enable ? '數據收集已啟用' : '數據收集已禁用');
  });
}

document.addEventListener('DOMContentLoaded', initializeApp);

function collectData(event, data) {
  if (!telemetryEnabled) return; // 如果禁用遙測，則不收集
  const payload = {
    event: event,
    data: data,
    timestamp: new Date().toISOString()
  };
  // 使用安全的API發送遙測數據
  window.electronAPI.sendTelemetry(payload)
    .then(response => console.log('數據收集成功'))
    .catch(error => console.error('數據收集失敗', error));
}

function updateAccountList() {
  const accountsDiv = document.getElementById('accounts');
  accountsDiv.innerHTML = '';
  accounts.forEach((account, index) => {
    const accountDiv = document.createElement('div');
    accountDiv.className = 'account-item';
    accountDiv.innerHTML = `
      <strong>${account.name}</strong> - 狀態: ${account.status}
      <button onclick="loginAccount(${index})">登入</button>
      <button onclick="editAccount(${index})">編輯</button>
      <button onclick="removeAccount(${index})">移除</button>
    `;
    accountsDiv.appendChild(accountDiv);
  });
    // 注意：不在每次更新 UI 時同步寫回 localStorage，改以變更時使用 scheduleSaveAccounts()
}

function loginAccount(index) {
  const accountName = accounts[index].name;
  
  // 驗證設備登入
  if (!validateDeviceLogin(accountName)) {
    return;
  }
  
  collectData('account_login', { accountName });
  accounts[index].status = '已登入';
  scheduleSaveAccounts();
  updateAccountList();
  document.getElementById('content').innerHTML = `<p>✓ 已登入帳戶: ${accountName}</p><p><small>設備: ${getDeviceName()}</small></p>`;
}

function removeAccount(index) {
  collectData('account_removed', { accountName: accounts[index].name });
  accounts.splice(index, 1);
  scheduleSaveAccounts();
  updateAccountList();
}

function editAccount(index) {
  collectData('account_edit', { accountName: accounts[index].name });
  const newName = prompt('輸入新帳戶名稱：', accounts[index].name);
  if (newName && newName !== accounts[index].name) {
    const sanitizedName = newName.trim().replace(/[<>\"'&]/g, '');
    if (sanitizedName.length === 0 || sanitizedName.length > 50) {
      alert('帳戶名稱無效：請輸入1-50個字符，且不包含特殊符號。');
      return;
    }
    if (accounts.some(acc => acc.name === sanitizedName && acc !== accounts[index])) {
      alert('帳戶名稱已存在。');
      return;
    }
    const oldName = accounts[index].name;
    accounts[index].name = sanitizedName;
    scheduleSaveAccounts();
    updateAccountList();
    collectData('account_edited', { oldName, newName: sanitizedName });
  }
}

// All event listeners are now in setupEventListeners() function called from DOMContentLoaded

// 防盜設備安全面板
function showDeviceSecurityPanel() {
  const contentDiv = document.getElementById('content');
  const trustedDevices = deviceSecuritySettings.trustedDevices || [];
  const suspiciousAttempts = deviceSecuritySettings.suspiciousLoginAttempts || [];
  
  let trustedDevicesHtml = trustedDevices.map((device, index) => `
    <div style="background-color: #e8f5e9; padding: 10px; margin: 5px 0; border-left: 4px solid #4caf50; border-radius: 3px;">
      <strong>${device.deviceName}</strong> (${device.deviceId.substring(0, 12)}...)
      <br><small>新增於: ${new Date(device.addedAt).toLocaleString('zh-tw')}</small>
      <button onclick="removeTrustedDevice(${index})" style="margin-left: 10px; padding: 5px 10px; background-color: #ff6b6b; color: white; border: none; border-radius: 3px; cursor: pointer;">移除設備</button>
    </div>
  `).join('');
  
  let suspiciousHtml = suspiciousAttempts.map((attempt, index) => `
    <div style="background-color: #ffebee; padding: 10px; margin: 5px 0; border-left: 4px solid #f44336; border-radius: 3px;">
      <strong>🔔 ${attempt.accountName}</strong> - ${attempt.deviceName}
      <br><small>時間: ${new Date(attempt.timestamp).toLocaleString('zh-tw')}</small>
      <button onclick="approveSuspiciousDevice(${index})" style="margin-left: 10px; padding: 5px 10px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">信任此設備</button>
      <button onclick="rejectSuspiciousDevice(${index})" style="margin-left: 5px; padding: 5px 10px; background-color: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">拒絕</button>
    </div>
  `).join('');
  
  contentDiv.innerHTML = `
    <h2>🔒 防盜帳號設備管理</h2>
    
    <div style="background-color: #fff3e0; padding: 15px; margin: 15px 0; border-left: 4px solid #ff9800; border-radius: 3px;">
      <strong>✓ 目前設備</strong>
      <br>設備ID: ${deviceId.substring(0, 12)}...
      <br>設備名稱: ${getDeviceName()}
      <button onclick="renameCurrentDevice()" style="margin-left: 10px; padding: 5px 10px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">重新命名</button>
    </div>
    
    <h3>🔐 已信任的設備</h3>
    <div id="trustedDevicesContainer">
      ${trustedDevicesHtml || '<p>目前沒有其他已信任的設備</p>'}
    </div>
    
    <h3>⚠️ 可疑登入嘗試</h3>
    <div id="suspiciousContainer">
      ${suspiciousHtml || '<p>目前沒有可疑登入嘗試</p>'}
    </div>
    
    <h3>🔑 安全設定</h3>
    <label>
      <input type="checkbox" id="lockdownToggle" ${deviceSecuritySettings.lockdown ? 'checked' : ''}>
      啟用帳號鎖定 - 只允許已信任設備登入
    </label>
    <button onclick="updateLockdownSetting()" style="margin-left: 10px; padding: 5px 10px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">保存設定</button>
    
    <br><br>
    <button id="closeSecurityPanelBtn" style="padding: 10px 20px; background-color: #757575; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
  `;
  
  document.getElementById('closeSecurityPanelBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}

// 移除信任的設備
function removeTrustedDevice(index) {
  if (confirm('確定要移除此設備嗎？')) {
    deviceSecuritySettings.trustedDevices.splice(index, 1);
    saveDeviceSecuritySettings();
    collectData('trusted_device_removed', {});
    showDeviceSecurityPanel();
  }
}

// 批准可疑設備
function approveSuspiciousDevice(index) {
  const attempt = deviceSecuritySettings.suspiciousLoginAttempts[index];
  const deviceExists = deviceSecuritySettings.trustedDevices.some(d => d.deviceId === attempt.deviceId);
  
  if (!deviceExists) {
    deviceSecuritySettings.trustedDevices.push({
      deviceId: attempt.deviceId,
      deviceName: attempt.deviceName,
      addedAt: new Date().toISOString()
    });
  }
  
  deviceSecuritySettings.suspiciousLoginAttempts[index].status = 'approved';
  saveDeviceSecuritySettings();
  collectData('suspicious_device_approved', {});
  alert('✓ 設備已信任');
  showDeviceSecurityPanel();
}

// 拒絕可疑設備
function rejectSuspiciousDevice(index) {
  deviceSecuritySettings.suspiciousLoginAttempts[index].status = 'rejected';
  saveDeviceSecuritySettings();
  collectData('suspicious_device_rejected', {});
  alert('✓ 已拒絕此設備');
  showDeviceSecurityPanel();
}

// 重新命名當前設備
function renameCurrentDevice() {
  const newName = prompt('輸入新設備名稱:', getDeviceName());
  if (newName && newName.trim()) {
    localStorage.setItem('deviceName', newName.trim());
    location.reload();
  }
}

// 更新鎖定設定
function updateLockdownSetting() {
  const lockdownToggle = document.getElementById('lockdownToggle');
  deviceSecuritySettings.lockdown = lockdownToggle.checked;
  saveDeviceSecuritySettings();
  alert('✓ 設定已保存');
  collectData('lockdown_setting_updated', { lockdown: deviceSecuritySettings.lockdown });
}

// 本地控制面板
function showLocalControlPanel() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <h2>本地控制面板</h2>
    <button id="clearAllAccountsBtn">清除所有帳戶</button>
    <button id="reloadAppBtn">重新載入應用程式</button>
    <button id="exportAccountsBtn">匯出帳戶資料</button>
    <button id="importAccountsBtn">匯入帳戶資料</button>
    <button id="closeControlPanelBtn">關閉</button>
  `;

  // 清除所有帳戶
  document.getElementById('clearAllAccountsBtn').addEventListener('click', () => {
    if (confirm('確定要清除所有帳戶嗎？此操作無法復原。')) {
      accounts = [];
      scheduleSaveAccounts();
      updateAccountList();
      collectData('all_accounts_cleared', {});
      alert('所有帳戶已清除。');
    }
  });

  // 重新載入應用程式
  document.getElementById('reloadAppBtn').addEventListener('click', () => {
    collectData('app_reloaded', {});
    location.reload();
  });

  // 匯出帳戶資料
  document.getElementById('exportAccountsBtn').addEventListener('click', () => {
    const dataStr = JSON.stringify(accounts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'facebook_accounts.json';
    link.click();
    URL.revokeObjectURL(url);
    collectData('accounts_exported', {});
  });

  // 匯入帳戶資料
  document.getElementById('importAccountsBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedAccounts = JSON.parse(e.target.result);
            if (Array.isArray(importedAccounts)) {
              accounts = importedAccounts;
              scheduleSaveAccounts();
              updateAccountList();
              collectData('accounts_imported', { count: importedAccounts.length });
              alert('帳戶資料已匯入。');
            } else {
              alert('無效的檔案格式。');
            }
          } catch (error) {
            alert('讀取檔案失敗：' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  });

  // 關閉控制面板
  document.getElementById('closeControlPanelBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}

// ============ 新系統功能 UI ============

// 帳戶持久化面板
async function showPersistencePanel() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <h2>☁️ 帳戶備份和恢復</h2>
    <p>管理您的帳戶備份到 Azure 雲存儲</p>
    <button id="saveAccountsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">💾 保存帳戶到 Azure</button>
    <button id="restoreAccountsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">📥 從 Azure 恢復帳戶</button>
    <button id="listBackupsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer;">📋 列出備份</button>
    <button id="closePersistenceBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #757575; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
    <div id="persistenceStatus" style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; min-height: 50px;"></div>
  `;

  const userId = deviceId;

  document.getElementById('saveAccountsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('persistenceStatus');
    statusDiv.innerHTML = '<p>⏳ 保存中...</p>';
    try {
      const result = await window.electronAPI.persistence.saveAccounts(accounts, userId);
      if (result.success) {
        statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p><p>檔案: ${result.fileName}</p>`;
        collectData('accounts_saved_to_azure', { fileName: result.fileName });
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('restoreAccountsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('persistenceStatus');
    statusDiv.innerHTML = '<p>⏳ 恢復中...</p>';
    try {
      const result = await window.electronAPI.persistence.restoreAccounts(userId);
      if (result.success) {
        accounts = result.data;
        scheduleSaveAccounts();
        updateAccountList();
        statusDiv.innerHTML = `<p style="color: green;">✓ 帳戶已恢復</p><p>來自: ${result.fileName}</p><p>帳戶數: ${accounts.length}</p>`;
        collectData('accounts_restored_from_azure', { count: accounts.length });
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('listBackupsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('persistenceStatus');
    statusDiv.innerHTML = '<p>⏳ 列出備份中...</p>';
    try {
      const result = await window.electronAPI.persistence.listBackups(userId);
      if (result.success) {
        const backupsList = result.backups.map(backup => `<li>${backup}</li>`).join('');
        statusDiv.innerHTML = `<p style="color: green;">✓ 找到 ${result.backups.length} 個備份</p><ul>${backupsList}</ul>`;
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('closePersistenceBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}

// 錯誤日誌面板
async function showLoggingPanel() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <h2>📊 錯誤日誌和統計</h2>
    <p>查看和管理應用程式日誌</p>
    <button id="uploadLogsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">⬆️ 上傳日誌</button>
    <button id="getLogsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">📋 查看日誌</button>
    <button id="getStatsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer;">📈 統計信息</button>
    <button id="closeLoggingBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #757575; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
    <div id="loggingStatus" style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; min-height: 50px;"></div>
  `;

  const userId = deviceId;

  document.getElementById('uploadLogsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('loggingStatus');
    statusDiv.innerHTML = '<p>⏳ 上傳中...</p>';
    try {
      const result = await window.electronAPI.logging.uploadLogs(userId);
      statusDiv.innerHTML = result.success 
        ? `<p style="color: green;">✓ ${result.message}</p>`
        : `<p style="color: red;">✗ ${result.message}</p>`;
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('getLogsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('loggingStatus');
    statusDiv.innerHTML = '<p>⏳ 載入日誌中...</p>';
    try {
      const logs = await window.electronAPI.logging.getLogs(null, 20);
      if (logs && logs.length > 0) {
        const logsHtml = logs.map(log => `
          <div style="padding: 8px; margin: 5px 0; background-color: #fff; border-left: 4px solid ${log.severity === 'ERROR' ? '#f44336' : log.severity === 'WARNING' ? '#ff9800' : '#4caf50'}; border-radius: 2px;">
            <strong>[${log.severity}]</strong> ${log.type}: ${log.message}
            <br><small>${new Date(log.timestamp).toLocaleString('zh-tw')}</small>
          </div>
        `).join('');
        statusDiv.innerHTML = `<p style="color: green;">✓ 最近 20 個日誌</p>${logsHtml}`;
      } else {
        statusDiv.innerHTML = '<p>沒有日誌記錄</p>';
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('getStatsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('loggingStatus');
    statusDiv.innerHTML = '<p>⏳ 計算統計中...</p>';
    try {
      const stats = await window.electronAPI.logging.getStats();
      const statsHtml = `
        <p><strong>日誌統計</strong></p>
        <ul style="list-style-type: none; padding: 0;">
          <li>📊 總數: ${stats.total}</li>
          <li>🔴 критical: ${stats.bySeverity.CRITICAL}</li>
          <li>🔴 ERROR: ${stats.bySeverity.ERROR}</li>
          <li>🟡 WARNING: ${stats.bySeverity.WARNING}</li>
          <li>🟢 INFO: ${stats.bySeverity.INFO}</li>
        </ul>
      `;
      statusDiv.innerHTML = statsHtml;
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('closeLoggingBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}

// 通知面板
async function showNotificationPanel() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <h2>🔔 通知中心</h2>
    <button id="viewNotificationsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">查看通知</button>
    <button id="getNotificationStatsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer;">統計信息</button>
    <button id="clearAllNotificationsBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">清除所有</button>
    <button id="closeNotificationBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #757575; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
    <div id="notificationStatus" style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; min-height: 50px;"></div>
  `;

  document.getElementById('viewNotificationsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('notificationStatus');
    statusDiv.innerHTML = '<p>⏳ 載入通知中...</p>';
    try {
      const notifications = await window.electronAPI.notification.list(20);
      if (notifications && notifications.length > 0) {
        const notifHtml = notifications.map(notif => `
          <div style="padding: 10px; margin: 5px 0; background-color: #fff; border-left: 4px solid ${
            notif.type === 'error' ? '#f44336' : 
            notif.type === 'warning' ? '#ff9800' : 
            notif.type === 'success' ? '#4caf50' : '#2196F3'
          }; border-radius: 2px;">
            <strong>${notif.title}</strong> ${notif.read ? '✓' : '●'}<br>${notif.message}
            <br><small>${new Date(notif.timestamp).toLocaleString('zh-tw')}</small>
          </div>
        `).join('');
        statusDiv.innerHTML = `<p style="color: green;">✓ 最近 20 個通知</p>${notifHtml}`;
      } else {
        statusDiv.innerHTML = '<p>沒有通知</p>';
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('getNotificationStatsBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('notificationStatus');
    try {
      const stats = await window.electronAPI.notification.getStats();
      const statsHtml = `
        <p><strong>通知統計</strong></p>
        <ul style="list-style-type: none; padding: 0;">
          <li>📊 總數: ${stats.total}</li>
          <li>● 未讀: ${stats.unread}</li>
          <li>✓ 已讀: ${stats.total - stats.unread}</li>
        </ul>
      `;
      statusDiv.innerHTML = statsHtml;
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('clearAllNotificationsBtn').addEventListener('click', async () => {
    if (confirm('確定要清除所有通知嗎？')) {
      try {
        const result = await window.electronAPI.notification.clearAll();
        const statusDiv = document.getElementById('notificationStatus');
        statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p>`;
      } catch (error) {
        const statusDiv = document.getElementById('notificationStatus');
        statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
      }
    }
  });

  document.getElementById('closeNotificationBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}

// 數據同步面板
async function showSyncPanel() {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `
    <h2>🔄 數據同步管理</h2>
    <button id="startSyncBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">▶️ 啟動自動同步</button>
    <button id="stopSyncBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer;">⏹️ 停止同步</button>
    <button id="syncNowBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">🔄 立即同步</button>
    <button id="getSyncStatusBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer;">📊 同步狀態</button>
    <button id="closeSyncBtn" style="padding: 10px 20px; margin: 10px 5px; background-color: #757575; color: white; border: none; border-radius: 3px; cursor: pointer;">關閉</button>
    <div id="syncStatus" style="margin-top: 15px; padding: 10px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; min-height: 50px;"></div>
  `;

  const userId = deviceId;

  document.getElementById('startSyncBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.innerHTML = '<p>⏳ 啟動同步中...</p>';
    try {
      const result = await window.electronAPI.sync.startAutoSync(userId);
      statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p>`;
      collectData('auto_sync_started', {});
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('stopSyncBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('syncStatus');
    try {
      const result = await window.electronAPI.sync.stopAutoSync();
      statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p>`;
      collectData('auto_sync_stopped', {});
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('syncNowBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.innerHTML = '<p>⏳ 同步中...</p>';
    try {
      const result = await window.electronAPI.sync.syncData(userId, { accounts });
      if (result.success) {
        statusDiv.innerHTML = `<p style="color: green;">✓ ${result.message}</p><p>已同步項目: ${result.syncedItems}</p>`;
        collectData('manual_sync_completed', { count: result.syncedItems });
      } else {
        statusDiv.innerHTML = `<p style="color: red;">✗ ${result.message}</p>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('getSyncStatusBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('syncStatus');
    try {
      const status = await window.electronAPI.sync.getSyncStatus();
      const statusHtml = `
        <p><strong>同步狀態</strong></p>
        <ul style="list-style-type: none; padding: 0;">
          <li>🔄 同步中: ${status.isSyncing ? '是' : '否'}</li>
          <li>⏰ 最後同步: ${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString('zh-tw') : '未同步'}</li>
          <li>📋 隊列操作數: ${status.queuedOperations}</li>
        </ul>
      `;
      statusDiv.innerHTML = statusHtml;
    } catch (error) {
      statusDiv.innerHTML = `<p style="color: red;">✗ 錯誤: ${error.message}</p>`;
    }
  });

  document.getElementById('closeSyncBtn').addEventListener('click', () => {
    contentDiv.innerHTML = '';
  });
}