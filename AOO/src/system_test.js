// 系統整合測試：觸發錯誤日誌、同步與通知
process.env.DEBUG_SYSTEM = process.env.DEBUG_SYSTEM || 'true';
process.env.LOCAL_FALLBACK = process.env.LOCAL_FALLBACK || 'true';

const logging = require('./logging');
const errorLogging = require('./error-logging-service');
const dataSync = require('./data-sync-service');
const notification = require('./notification-service');

(async function runTests() {
  logging.info('=== 系統測試開始 ===');

  logging.debug('初始化錯誤日誌服務（如果適用）');
  try {
    await errorLogging.initialize();
  } catch (e) {
    logging.error('初始化錯誤日誌服務時發生錯誤', e.message || e);
  }

  logging.debug('記錄測試錯誤');
  const logEntry = errorLogging.logError('TEST_ERROR', '這是測試用錯誤訊息', 'Error: stack', {source: 'system_test'});
  logging.debug('logEntry', logEntry && logEntry.id);

  logging.debug('將同步操作入隊並處理隊列');
  const queueRes = await dataSync.queueSync('testuser', 'CREATE', { id: 'item-test-1' });
  logging.debug('queueRes', queueRes);

  const processRes = await dataSync.processSyncQueue();
  logging.debug('processRes', processRes);

  logging.debug('直接呼叫 syncData（本地合併測試）');
  const syncRes = await dataSync.syncData('testuser', { userId: 'testuser', items: [{ id: 'local-1' }] });
  logging.debug('syncRes', syncRes);

  logging.debug('取得通知清單');
  const notes = notification.getNotifications(50);
  logging.info('通知數量', notes.length);

  logging.debug('取得本地日誌');
  const localLogs = errorLogging.getLocalLogs(null, 50);
  logging.info('本地日誌數量', localLogs.length);

  console.log('=== 系統測試完成 ===');
})();
