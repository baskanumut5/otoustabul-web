// ============================================================
// UstaBul Web - Uygulama Durumu (State)
// ============================================================

const STORAGE_KEY_USER = "ustabul_user_v1";
const STORAGE_KEY_DARK_MODE = "ustabul_dark_mode_v1";
const STORAGE_KEY_FAVORITES = "ustabul_favorites_v1";
const STORAGE_KEY_PHONE_VERIFICATIONS = "ustabul_phone_verifications_v1";
const STORAGE_KEY_PENDING_PHONE_VERIFICATION = "ustabul_pending_phone_verification_v1";
const THEME_COLOR_LIGHT = "#1E5EFF";
const THEME_COLOR_DARK = "#000000";

class AppStore {
  constructor() {
    this.user = this._loadUser();
    this.isDarkMode = this._loadDarkMode();
    this.favorites = this._loadFavorites();
    this.phoneVerifications = this._loadPhoneVerifications();
    this.pendingPhoneVerification = this._loadPendingPhoneVerification();
    this.shops = [];
    this.comments = [];
    this.commentVotes = {};
    this.currentTab = 0;
    this.selectedCity = this.user?.city || CONFIG.DEFAULT_CITY;
    this.selectedDistrict = this.user?.district || CONFIG.DEFAULT_DISTRICT;
    this._listeners = [];
  }

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  }

  _notify() {
    this._listeners.forEach(fn => fn(this));
  }

  // --- Persistence ---

  _loadUser() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_USER);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  _saveUser(user) {
    if (user) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY_USER);
  }

  _loadDarkMode() {
    return localStorage.getItem(STORAGE_KEY_DARK_MODE) === "true";
  }

  _saveDarkMode(val) {
    localStorage.setItem(STORAGE_KEY_DARK_MODE, String(val));
  }

  _loadFavorites() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_FAVORITES);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }

  _loadPhoneVerifications() {
    try {
      const s = localStorage.getItem(STORAGE_KEY_PHONE_VERIFICATIONS);
      const parsed = s ? JSON.parse(s) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  _pendingPhoneStorage() {
    try {
      if (window.sessionStorage) return window.sessionStorage;
    } catch {}
    return localStorage;
  }

  _loadPendingPhoneVerification() {
    try {
      const s = this._pendingPhoneStorage().getItem(STORAGE_KEY_PENDING_PHONE_VERIFICATION);
      const parsed = s ? JSON.parse(s) : null;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  _saveFavorites(favs) {
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favs));
  }

  _savePhoneVerifications(map) {
    localStorage.setItem(STORAGE_KEY_PHONE_VERIFICATIONS, JSON.stringify(map || {}));
  }

  _savePendingPhoneVerification(user) {
    try {
      const storage = this._pendingPhoneStorage();
      if (user) storage.setItem(STORAGE_KEY_PENDING_PHONE_VERIFICATION, JSON.stringify(user));
      else storage.removeItem(STORAGE_KEY_PENDING_PHONE_VERIFICATION);
    } catch {}
  }

  // --- Mutations ---

  setUser(user) {
    this.user = user;
    this._profileRefreshAttempted = false;
    this._saveUser(user);
    if (user) {
      this.selectedCity = user.city || this.selectedCity;
      this.selectedDistrict = user.district || this.selectedDistrict;
    }
    this._notify();
  }

  setPendingPhoneVerification(user) {
    const username = String(user?.username || "").trim();
    const phoneNumber = normalizeTurkishPhone(user?.phoneNumber || user?.phone || "");
    if (!username || !isValidTurkishPhone(phoneNumber)) {
      this.clearPendingPhoneVerification();
      return;
    }

    this.pendingPhoneVerification = {
      ...user,
      username,
      phoneNumber,
    };
    this._savePendingPhoneVerification(this.pendingPhoneVerification);
    this._notify();
  }

  clearPendingPhoneVerification() {
    this.pendingPhoneVerification = null;
    this._savePendingPhoneVerification(null);
    this._notify();
  }

  setPhoneVerified(username, phoneNumber, verified = true) {
    const normalizedUsername = String(username || "").trim().toLocaleLowerCase("tr-TR");
    const normalizedPhone = normalizeTurkishPhone(phoneNumber);
    if (!normalizedUsername) return;
    if (!verified) {
      delete this.phoneVerifications[normalizedUsername];
    } else if (normalizedPhone) {
      this.phoneVerifications[normalizedUsername] = normalizedPhone;
    }
    const pendingUsername = String(this.pendingPhoneVerification?.username || "").trim().toLocaleLowerCase("tr-TR");
    if (verified && pendingUsername && pendingUsername === normalizedUsername) {
      this.pendingPhoneVerification = null;
      this._savePendingPhoneVerification(null);
    }
    this._savePhoneVerifications(this.phoneVerifications);
    this._notify();
  }

  isPhoneVerified(user = this.user) {
    const normalizedUsername = String(user?.username || "").trim().toLocaleLowerCase("tr-TR");
    const normalizedPhone = normalizeTurkishPhone(user?.phoneNumber || "");
    if (!normalizedUsername || !normalizedPhone) return false;
    return this.phoneVerifications[normalizedUsername] === normalizedPhone;
  }

  setDarkMode(val) {
    this.isDarkMode = val;
    this._saveDarkMode(val);
    document.documentElement.setAttribute("data-theme", val ? "dark" : "light");
    document.getElementById("theme-color-meta")?.setAttribute("content", val ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
    this._notify();
  }

  setShops(shops) {
    this.shops = Array.isArray(shops) ? shops : [];
    this._notify();
  }

  mergeShops(shops) {
    const merged = new Map();
    [...this.shops, ...(Array.isArray(shops) ? shops : [])].forEach(shop => {
      if (!shop) return;
      const key = shop.id || shop.placeId;
      if (!key) return;
      merged.set(key, { ...(merged.get(key) || {}), ...shop });
    });
    this.shops = Array.from(merged.values());
    this._notify();
  }

  setComments(comments) {
    this.comments = comments;
    this._notify();
  }

  setCommentVotes(votes) {
    this.commentVotes = votes;
    this._notify();
  }

  setTab(tab) {
    this.currentTab = tab;
    this._notify();
  }

  setLocation(city, district) {
    this.selectedCity = city;
    this.selectedDistrict = district;
    this._notify();
  }

  toggleFavorite(shopId) {
    const idx = this.favorites.indexOf(shopId);
    if (idx >= 0) {
      this.favorites = this.favorites.filter(id => id !== shopId);
    } else {
      this.favorites = [shopId, ...this.favorites];
    }
    this._saveFavorites(this.favorites);
    this._notify();
  }

  isFavorite(shopId) {
    return this.favorites.includes(shopId);
  }

  get isModerator() {
    const username = String(this.user?.username || "").trim().toLocaleLowerCase("tr-TR");
    return Boolean(username) && CONFIG.MODERATOR_USERNAMES
      .map(name => String(name || "").trim().toLocaleLowerCase("tr-TR"))
      .includes(username);
  }

  get isLoggedIn() {
    return !!this.user?.sessionToken;
  }

  get phoneVerificationTarget() {
    return null;
  }

  get requiresPhoneVerification() {
    return false;
  }
}

const store = new AppStore();
