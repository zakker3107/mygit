// 通知系統
const { ipcMain } = require('electron');

class NotificationService {
  constructor() {
    this.notifications = [];
    this.notificationId = 0;
    this.listeners = new Map();
    this.maxNotifications = 100;
    this.notificationRetentionMs = 24 * 60 * 60 * 1000; // 24小時保留期
    this._cleanupTimer = null;
  }

  // 初始化通知服務（不再在這裡設置 IPC，改由 main.js 處理）
  initialize() {
    console.log('✓ 通知服務已初始化');
    this._startCleanupTimer();
    return { success: true };
  }

  // 啟動定期清理舊通知的計時器
  _startCleanupTimer() {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => this._cleanupOldNotifications(), this.notificationRetentionMs / 2);
  }

  // 清理超過保留時間的舊通知
  _cleanupOldNotifications() {
    const now = Date.now();
    const beforeCount = this.notifications.length;
    this.notifications = this.notifications.filter(notif => {
      const notifTime = new Date(notif.timestamp).getTime();
      return now - notifTime < this.notificationRetentionMs;
    });
    const removed = beforeCount - this.notifications.length;
    if (removed > 0) console.log(`✓ 已清理 ${removed} 個過期通知`);
  }

  // 發送通知
  sendNotification(type, title, message, metadata = {}) {
    const notification = {
      id: ++this.notificationId,
      type, // 'success', 'error', 'warning', 'info'
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      read: false
    };

    this.notifications.push(notification);

    // 保持通知數量在限制內
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(-this.maxNotifications);
    }

    // 觸發監聽器
    this._notifyListeners('notification-received', notification);

    console.log(`[通知] ${type.toUpperCase()}: ${title}`);
    return notification;
  }

  // 發送成功通知
  success(title, message, metadata = {}) {
    return this.sendNotification('success', title, message, metadata);
  }

  // 發送錯誤通知
  error(title, message, metadata = {}) {
    return this.sendNotification('error', title, message, metadata);
  }

  // 發送警告通知
  warning(title, message, metadata = {}) {
    return this.sendNotification('warning', title, message, metadata);
  }

  // 發送信息通知
  info(title, message, metadata = {}) {
    return this.sendNotification('info', title, message, metadata);
  }

  // 發送安全警報
  securityAlert(title, message, metadata = {}) {
    return this.sendNotification('security', title, message, {
      ...metadata,
      severity: 'high'
    });
  }

  // 發送帳戶事件通知
  accountEvent(eventType, accountName, details = {}) {
    const messages = {
      LOGIN: `帳戶 "${accountName}" 已登入`,
      LOGOUT: `帳戶 "${accountName}" 已登出`,
      FAILED_LOGIN: `帳戶 "${accountName}" 登入失敗`,
      PASSWORD_CHANGED: `帳戶 "${accountName}" 密碼已更改`,
      ACCOUNT_CREATED: `帳戶 "${accountName}" 已建立`,
      ACCOUNT_DELETED: `帳戶 "${accountName}" 已刪除`
    };

    return this.sendNotification(
      'account',
      '帳戶事件',
      messages[eventType] || `帳戶事件: ${eventType}`,
      { accountName, eventType, ...details }
    );
  }

  // 發送同步通知
  syncEvent(eventType, details = {}) {
    const messages = {
      SYNC_STARTED: '數據同步已開始',
      SYNC_COMPLETED: '數據同步已完成',
      SYNC_FAILED: '數據同步失敗',
      SYNC_QUEUED: '同步操作已入隊'
    };

    return this.sendNotification(
      'sync',
      '同步事件',
      messages[eventType] || `同步事件: ${eventType}`,
      { eventType, ...details }
    );
  }

  // 發送系統通知
  systemEvent(eventType, details = {}) {
    const messages = {
      APP_STARTED: '應用程式已啟動',
      APP_CLOSED: '應用程式已關閉',
      SETTINGS_CHANGED: '設定已更改',
      ERROR_OCCURRED: '發生錯誤'
    };

    return this.sendNotification(
      'system',
      '系統事件',
      messages[eventType] || `系統事件: ${eventType}`,
      { eventType, ...details }
    );
  }

  // 獲取所有通知
  getNotifications(limit = 50, unreadOnly = false) {
    let result = this.notifications;

    if (unreadOnly) {
      result = result.filter(n => !n.read);
    }

    return result.slice(-limit).reverse();
  }

  // 獲取特定類型的通知
  getNotificationsByType(type, limit = 50) {
    return this.notifications
      .filter(n => n.type === type)
      .slice(-limit)
      .reverse();
  }

  // 標記通知為已讀
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return { success: true };
    }
    return { success: false, message: '通知不存在' };
  }

  // 標記所有通知為已讀
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    return { success: true, message: '所有通知已標記為已讀' };
  }

  // 清除單個通知
  clearNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      return { success: true };
    }
    return { success: false, message: '通知不存在' };
  }

  // 清除所有通知
  clearAllNotifications() {
    this.notifications = [];
    return { success: true, message: '所有通知已清除' };
  }

  // 清除特定類型的通知
  clearNotificationsByType(type) {
    const initialCount = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.type !== type);
    const clearedCount = initialCount - this.notifications.length;
    return { success: true, message: `已清除 ${clearedCount} 個通知` };
  }

  // 獲取通知統計
  getNotificationStats() {
    const stats = {
      total: this.notifications.length,
      unread: this.notifications.filter(n => !n.read).length,
      byType: {},
      lastNotification: this.notifications[this.notifications.length - 1] || null
    };

    this.notifications.forEach(notification => {
      if (!stats.byType[notification.type]) {
        stats.byType[notification.type] = 0;
      }
      stats.byType[notification.type]++;
    });

    return stats;
  }

  // 添加事件監聽器
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // 移除事件監聽器
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 私有方法：觸發監聽器
  _notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`監聽器執行錯誤 [${event}]:`, error.message);
        }
      });
    }
  }
}

module.exports = new NotificationService();
