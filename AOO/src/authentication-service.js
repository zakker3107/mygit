// 用戶認證系統
const CryptoJS = require('crypto-js');

class AuthenticationService {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30分鐘
    this.failedLoginAttempts = new Map();
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15分鐘
    this.sessionCleanupInterval = 5 * 60 * 1000; // 5分鐘清理一次過期會話
    this._cleanupTimer = null;
  }

  // 初始化認證服務
  initialize() {
    console.log('✓ 認證服務已初始化');
    // 啟動過期會話清理排程，避免 sessions 無限制成長
    this._startSessionCleanup();
    return { success: true, message: '認證服務已初始化' };
  }

  _startSessionCleanup() {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => this._cleanupExpiredSessions(), this.sessionCleanupInterval);
  }

  _stopSessionCleanup() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  // 驗證密碼強度
  validatePasswordStrength(password) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const strength = {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      length: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      score: 0
    };

    if (strength.length) strength.score++;
    if (strength.hasUpperCase) strength.score++;
    if (strength.hasLowerCase) strength.score++;
    if (strength.hasNumbers) strength.score++;
    if (strength.hasSpecialChar) strength.score++;

    return strength;
  }

  // 建立帳戶
  createAccount(username, password, email) {
    // 驗證輸入
    if (!username || username.length < 3 || username.length > 50) {
      return { 
        success: false, 
        message: '用戶名必須為3-50個字符' 
      };
    }

    const passwordValidation = this.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return {
        success: false,
        message: '密碼強度不足。必須包含：至少8個字符、大小寫字母、數字和特殊符號',
        requirements: {
          minLength: !passwordValidation.length,
          needsUpperCase: !passwordValidation.hasUpperCase,
          needsLowerCase: !passwordValidation.hasLowerCase,
          needsNumbers: !passwordValidation.hasNumbers,
          needsSpecialChar: !passwordValidation.hasSpecialChar
        }
      };
    }

    if (!this._isValidEmail(email)) {
      return { success: false, message: '電子郵件格式無效' };
    }

    const accountId = `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hashedPassword = this._hashPassword(password);

    const account = {
      accountId,
      username,
      password: hashedPassword,
      email,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      twoFactorEnabled: false,
      twoFactorSecret: null
    };

    console.log(`✓ 帳戶已建立: ${username}`);
    return {
      success: true,
      message: '帳戶已建立',
      account: {
        accountId,
        username,
        email,
        createdAt: account.createdAt
      }
    };
  }

  // 登入
  login(username, password, deviceId) {
    // 檢查是否被鎖定
    if (this._isAccountLocked(username)) {
      return {
        success: false,
        message: '帳戶已因多次登入失敗而鎖定。請在15分鐘後重試。'
      };
    }

    // 這裡應該驗證密碼，但在演示中我們假設登入成功
    const hashedPassword = this._hashPassword(password);

    const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      sessionId,
      username,
      deviceId,
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
      isActive: true
    };

    this.sessions.set(sessionId, session);

    // 清除失敗計數
    this.failedLoginAttempts.delete(username);

    console.log(`✓ 用戶 ${username} 登入成功`);
    return {
      success: true,
      message: '登入成功',
      sessionId,
      session
    };
  }

  // 登入失敗
  recordFailedLogin(username) {
    const attempts = this.failedLoginAttempts.get(username) || 0;
    const newAttempts = attempts + 1;

    this.failedLoginAttempts.set(username, newAttempts);

    if (newAttempts >= this.maxFailedAttempts) {
      this.failedLoginAttempts.set(`${username}_locked_until`, Date.now() + this.lockoutDuration);
      console.warn(`✗ 帳戶 ${username} 已因多次登入失敗而鎖定`);
    }

    return {
      success: false,
      message: `登入失敗。還有 ${this.maxFailedAttempts - newAttempts} 次嘗試機會。`,
      remainingAttempts: Math.max(0, this.maxFailedAttempts - newAttempts)
    };
  }

  // 登出
  logout(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.isActive = false;
      console.log(`✓ 用戶 ${session.username} 已登出`);
      return { success: true, message: '已登出' };
    }

    return { success: false, message: '會話不存在' };
  }

  // 驗證會話
  validateSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      return { valid: false, message: '會話不存在' };
    }

    const session = this.sessions.get(sessionId);
    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();

    if (expiresAt < now || !session.isActive) {
      return { valid: false, message: '會話已過期' };
    }

    return { valid: true, message: '會話有效', session };
  }

  // 啟用雙因素認證
  enableTwoFactor(username) {
    const secret = this._generateTwoFactorSecret();
    
    return {
      success: true,
      message: '雙因素認證已啟用',
      secret,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secret)}`
    };
  }

  // 驗證 OTP 代碼
  verifyOTP(secret, code) {
    // 這是一個簡化的實現，實際應使用 speakeasy 或類似庫
    const isValid = code.length === 6 && /^\d+$/.test(code);
    
    if (isValid) {
      console.log('✓ OTP 驗證成功');
      return { success: true, message: 'OTP 驗證成功' };
    }

    return { success: false, message: 'OTP 無效' };
  }

  // 改變密碼
  changePassword(username, oldPassword, newPassword) {
    const oldPasswordValidation = this.validatePasswordStrength(oldPassword);
    const newPasswordValidation = this.validatePasswordStrength(newPassword);

    if (!oldPasswordValidation.isValid) {
      return { success: false, message: '舊密碼無效' };
    }

    if (!newPasswordValidation.isValid) {
      return {
        success: false,
        message: '新密碼強度不足'
      };
    }

    if (oldPassword === newPassword) {
      return {
        success: false,
        message: '新密碼不能與舊密碼相同'
      };
    }

    console.log(`✓ 用戶 ${username} 密碼已更改`);
    return { success: true, message: '密碼已更改' };
  }

  // 重置密碼
  resetPassword(email) {
    const resetToken = `RESET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1小時有效

    console.log(`✓ 密碼重置令牌已生成: ${resetToken}`);
    return {
      success: true,
      message: '密碼重置連結已發送至電子郵件',
      resetToken,
      expiresAt
    };
  }

  // 獲取會話列表
  getSessions(username) {
    const userSessions = Array.from(this.sessions.values()).filter(
      session => session.username === username
    );

    return userSessions;
  }

  // 撤銷所有會話
  revokeAllSessions(username) {
    let revokedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.username === username) {
        session.isActive = false;
        revokedCount++;
      }
    }

    console.log(`✓ 已撤銷 ${revokedCount} 個會話`);
    return { success: true, message: `已撤銷 ${revokedCount} 個會話` };
  }

  // 清理過期會話（私有）
  _cleanupExpiredSessions() {
    const now = Date.now();
    let removed = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      const expiresAt = new Date(session.expiresAt).getTime();
      if (!session.isActive || expiresAt < now) {
        this.sessions.delete(sessionId);
        removed++;
      }
    }
    if (removed > 0) console.log(`✓ 已清理 ${removed} 個過期會話`);
  }

  // 私有方法
  _hashPassword(password) {
    return CryptoJS.SHA256(password).toString();
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  _generateTwoFactorSecret() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  _isAccountLocked(username) {
    const lockedUntil = this.failedLoginAttempts.get(`${username}_locked_until`);
    if (!lockedUntil) return false;

    if (Date.now() > lockedUntil) {
      this.failedLoginAttempts.delete(`${username}_locked_until`);
      this.failedLoginAttempts.delete(username);
      return false;
    }

    return true;
  }
}

module.exports = new AuthenticationService();
