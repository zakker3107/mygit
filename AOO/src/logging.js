// 簡易日誌封裝，根據環境變數 `DEBUG_SYSTEM` 控制 debug 輸出
const debugEnabled = process.env.DEBUG_SYSTEM === 'true';

function debug(...args) {
  if (debugEnabled) console.debug('[DEBUG]', ...args);
}

function info(...args) {
  console.info('[INFO]', ...args);
}

function warn(...args) {
  console.warn('[WARN]', ...args);
}

function error(...args) {
  console.error('[ERROR]', ...args);
}

module.exports = {
  debug,
  info,
  warn,
  error
};
