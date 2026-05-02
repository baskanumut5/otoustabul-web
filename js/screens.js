// ============================================================
// UstaBul Web - Ekranlar (Auth, Home, Shops, Favorites, Settings, ShopDetail)
// ============================================================

// ===================== AUTH SCREEN ========================

function shouldUseTurnstile() {
  return Boolean(getTurnstileSiteKey() && window.location.protocol !== "file:");
}

function getCurrentHostname() {
  return String(window.location.hostname || "").trim().toLowerCase();
}

function isLocalHostname(hostname = getCurrentHostname()) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";
}

function getTurnstileSiteKey() {
  if (window.location.protocol === "file:") return "";
  const hostname = getCurrentHostname();
  const hostMap = CONFIG.TURNSTILE_SITE_KEY_BY_HOST || {};
  if (hostMap && typeof hostMap === "object" && hostMap[hostname]) {
    return String(hostMap[hostname] || "").trim();
  }
  if (isLocalHostname(hostname) && CONFIG.TURNSTILE_USE_TEST_KEY_ON_LOCALHOST) {
    return String(CONFIG.TURNSTILE_DEV_SITE_KEY || "").trim();
  }
  return String(CONFIG.TURNSTILE_SITE_KEY || "").trim();
}

function clearTurnstileError(slot) {
  if (!slot?.dataset) return;
  delete slot.dataset.turnstileErrorCode;
}

function setTurnstileError(slot, errorCode) {
  if (!slot?.dataset) return;
  slot.dataset.turnstileErrorCode = String(errorCode || "").trim();
}

function getTurnstileErrorMessage(errorCode) {
  const code = String(errorCode || "").trim();
  if (!code) return "Cloudflare dogrulamasi yuklenemedi. Lutfen tekrar deneyin.";
  if (code.startsWith("110200")) {
    if (isLocalHostname()) {
      return "Bu Turnstile anahtari localhost icin yetkili degil. Cloudflare Hostname Management'e bu hostu ekleyin ya da js/config.js icindeki host bazli Turnstile ayarini guncelleyin.";
    }
    return "Bu domain Turnstile icin yetkili degil. Cloudflare Turnstile panelinden mevcut domaini Hostname Management'e ekleyin.";
  }
  if (code.startsWith("110100") || code.startsWith("110110") || code.startsWith("400020") || code.startsWith("400070")) {
    return "Turnstile site key gecersiz veya devre disi. js/config.js ve Cloudflare panel ayarlarini kontrol edin.";
  }
  return `Cloudflare dogrulamasi baslatilamadi (hata ${code}). Lutfen sayfayi yenileyip tekrar deneyin.`;
}

let turnstileSlotSeq = 0;

function createTurnstileSlotId(prefix = "turnstile") {
  turnstileSlotSeq += 1;
  return `${prefix}-${turnstileSlotSeq}`;
}

function turnstileMarkup(slotId, style = "margin-top:12px") {
  if (!shouldUseTurnstile()) return "";
  return `<div id="${escHtml(slotId)}" class="cf-turnstile-slot" style="${escHtml(style)}"></div>`;
}

function mountTurnstile(slot) {
  if (!shouldUseTurnstile() || !slot || slot.dataset.widgetId) return;
  if (!window.turnstile || typeof window.turnstile.render !== "function") return;
  try {
    const widgetId = window.turnstile.render(slot, {
      sitekey: getTurnstileSiteKey(),
      theme: "auto",
      callback: () => clearTurnstileError(slot),
      "expired-callback": () => clearTurnstileError(slot),
      "error-callback": errorCode => {
        setTurnstileError(slot, errorCode);
        return true;
      },
    });
    clearTurnstileError(slot);
    slot.dataset.widgetId = String(widgetId);
  } catch (err) {
    setTurnstileError(slot, "render_failed");
    console.error("Turnstile render failed:", err);
  }
}

function ensureTurnstileMounted(slot, attempts = 20) {
  if (!shouldUseTurnstile() || !slot || slot.dataset.widgetId) return;
  mountTurnstile(slot);
  if (slot.dataset.widgetId || attempts <= 0) return;
  window.setTimeout(() => ensureTurnstileMounted(slot, attempts - 1), 250);
}

function readTurnstileToken(slot) {
  if (!shouldUseTurnstile()) return "";
  if (!slot || !slot.dataset.widgetId || !window.turnstile || typeof window.turnstile.getResponse !== "function") return "";
  return window.turnstile.getResponse(slot.dataset.widgetId) || "";
}

function resetTurnstile(slot) {
  if (!shouldUseTurnstile()) return;
  if (!slot || !slot.dataset.widgetId || !window.turnstile || typeof window.turnstile.reset !== "function") return;
  clearTurnstileError(slot);
  window.turnstile.reset(slot.dataset.widgetId);
}

function requireTurnstileToken(slot, errEl, loadingMessage = "CAPTCHA yukleniyor, lutfen biraz sonra tekrar deneyin.") {
  if (!shouldUseTurnstile()) return "";
  mountTurnstile(slot);
  if (slot?.dataset?.turnstileErrorCode) {
    showAuthError(errEl, getTurnstileErrorMessage(slot.dataset.turnstileErrorCode));
    return null;
  }
  if (!window.turnstile || typeof window.turnstile.getResponse !== "function") {
    showAuthError(errEl, loadingMessage);
    return null;
  }
  const token = readTurnstileToken(slot);
  if (!token) {
    showAuthError(errEl, "Lutfen Cloudflare dogrulamasini tamamlayin.");
    return null;
  }
  return token;
}

let phoneVerificationConfirmation = null;
let phoneVerificationRecaptcha = null;
let phoneVerificationRecaptchaHostId = "";

function resetPhoneVerificationFlow() {
  phoneVerificationConfirmation = null;
  if (phoneVerificationRecaptcha && typeof phoneVerificationRecaptcha.clear === "function") {
    try {
      phoneVerificationRecaptcha.clear();
    } catch {}
  }
  phoneVerificationRecaptcha = null;
  phoneVerificationRecaptchaHostId = "";
}

function phoneVerificationErrorMessage(error) {
  const code = String(error?.code || "").trim();
  if (code === "auth/invalid-phone-number") return "Telefon numarasi gecersiz. Lutfen numarani kontrol et.";
  if (code === "auth/too-many-requests") return "Cok fazla deneme yapildi. Biraz sonra tekrar deneyin.";
  if (code === "auth/code-expired") return "SMS kodunun suresi doldu. Yeni kod isteyin.";
  if (code === "auth/invalid-verification-code") return "Girdigin kod hatali. SMS ile gelen kodu tekrar kontrol et.";
  if (code === "auth/missing-verification-code") return "SMS ile gelen 6 haneli kodu girin.";
  if (code === "auth/captcha-check-failed") return "reCAPTCHA dogrulamasi basarisiz oldu. Tekrar deneyin.";
  if (code === "auth/quota-exceeded") return "SMS gonderim limiti doldu. Daha sonra tekrar deneyin.";
  if (code === "auth/network-request-failed") return "Ag baglantisi kurulamadigi icin telefon dogrulamasi tamamlanamadi.";
  return error?.message || "Telefon dogrulamasi su anda baslatilamadi.";
}

function toFirebaseE164Phone(phoneNumber) {
  const normalized = normalizeTurkishPhone(phoneNumber);
  if (!/^05\d{9}$/.test(normalized)) return "";
  return `+90${normalized.slice(1)}`;
}

function ensureFirebasePhoneAuth(errEl) {
  if (!window.firebase || !window.firebase.auth) {
    showAuthError(errEl, "Telefon dogrulama altyapisi yuklenemedi.");
    return null;
  }

  const config = CONFIG.FIREBASE_CONFIG || {};
  if (!config.apiKey || !config.authDomain || !config.projectId) {
    showAuthError(errEl, "Firebase telefon dogrulamasi icin gerekli ayarlar eksik.");
    return null;
  }

  if (!window.firebase.apps || window.firebase.apps.length === 0) {
    window.firebase.initializeApp(config);
  }

  return window.firebase.auth();
}

async function ensurePhoneRecaptcha(hostEl, errEl) {
  const auth = ensureFirebasePhoneAuth(errEl);
  if (!auth) return null;

  const hostId = String(hostEl?.id || "").trim();
  if (!hostId) {
    showAuthError(errEl, "reCAPTCHA alani hazirlanamadi.");
    return null;
  }

  if (!phoneVerificationRecaptcha || phoneVerificationRecaptchaHostId !== hostId) {
    resetPhoneVerificationFlow();
    phoneVerificationRecaptcha = new window.firebase.auth.RecaptchaVerifier(hostId, {
      size: "normal",
    });
    phoneVerificationRecaptchaHostId = hostId;
    try {
      await phoneVerificationRecaptcha.render();
    } catch (error) {
      resetPhoneVerificationFlow();
      showAuthError(errEl, phoneVerificationErrorMessage(error));
      return null;
    }
  }

  return auth;
}

function renderPhoneVerificationScreen() {
  const root = document.getElementById("app-root");
  const user = store.phoneVerificationTarget;
  if (!user) {
    resetPhoneVerificationFlow();
    renderAuthScreen();
    return;
  }

  const isPostRegisterFlow = Boolean(store.pendingPhoneVerification);
  const phoneNumber = normalizeTurkishPhone(user?.phoneNumber || "");
  const subtitle = isPostRegisterFlow
    ? "Kaydin tamamlandi. Simdi bu cihaz icin telefon onayini alip hesabi aktif hale getirelim."
    : "Giris tamamlandi. Devam etmek icin telefon numarani dogrulaman gerekiyor.";
  const exitLabel = store.isLoggedIn ? "Cikis yap" : "Kayit formuna don";
  const exitConfirmMessage = store.isLoggedIn
    ? "Bu hesaptan cikmak istediginizden emin misiniz?"
    : "Telefon dogrulamasindan cikarsan kaydin olusur ama uygulamaya girmek icin daha sonra giris yapman gerekir. Cikmak istiyor musun?";

  root.innerHTML = `
    <div class="auth-bg">
      <div class="auth-orb auth-orb-1"></div>
      <div class="auth-orb auth-orb-2"></div>
    </div>
    <div class="auth-container verify-container">
      <div class="auth-logo-area">
        ${brandLogoHtml("lg")}
        <p class="auth-tagline">Telefon onayi olmadan uygulamaya devam etmiyoruz.</p>
      </div>
      <div class="auth-card verify-card">
        <div class="verify-card-body">
          <div class="verify-kicker">Adim 2 / 2</div>
          <h1 class="verify-title">Telefon numarani dogrula</h1>
          <p class="verify-subtitle">${escHtml(subtitle)}</p>
          <div class="verify-phone-card">
            <div class="verify-phone-icon">${uiIcon("phone")}</div>
            <div>
              <div class="verify-phone-label">${escHtml(formatPhone(phoneNumber || user?.phoneNumber || ""))}</div>
              <div class="verify-phone-hint">SMS kodu bu numaraya gonderilecek.</div>
            </div>
          </div>
          <div class="verify-recaptcha-shell">
            <div id="phone-verification-recaptcha"></div>
          </div>
          <div id="verify-error" class="auth-error hidden"></div>
          <div class="field-group">
            <label>SMS Kodu</label>
            <input type="text" id="phone-verification-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 haneli kod">
          </div>
          <div class="verify-actions">
            <button type="button" class="btn btn-primary btn-full" id="send-phone-code-btn">Dogrulama kodu gonder</button>
            <button type="button" class="btn btn-primary btn-full" id="verify-phone-code-btn">Kodu dogrula</button>
            <button type="button" class="btn btn-secondary btn-full" id="verify-logout-btn">${escHtml(exitLabel)}</button>
          </div>
          <div class="verify-note">Bu dogrulama bu tarayici icin saklanir. Yeni cihazda tekrar onay isteyebiliriz.</div>
        </div>
      </div>
    </div>`;

  const errEl = root.querySelector("#verify-error");
  const sendBtn = root.querySelector("#send-phone-code-btn");
  const verifyBtn = root.querySelector("#verify-phone-code-btn");
  const logoutBtn = root.querySelector("#verify-logout-btn");
  const codeInput = root.querySelector("#phone-verification-code");
  const recaptchaHost = root.querySelector("#phone-verification-recaptcha");

  if (!isValidTurkishPhone(phoneNumber)) {
    showAuthError(errEl, "Bu hesapta gecerli bir telefon numarasi bulunmuyor. Farkli bir hesapla giris yapin.");
    sendBtn.disabled = true;
    verifyBtn.disabled = true;
  }

  sendBtn.addEventListener("click", async () => {
    errEl.classList.add("hidden");
    sendBtn.disabled = true;
    sendBtn.textContent = "Kod gonderiliyor...";

    try {
      const auth = await ensurePhoneRecaptcha(recaptchaHost, errEl);
      if (!auth) return;
      phoneVerificationConfirmation = await auth.signInWithPhoneNumber(
        toFirebaseE164Phone(phoneNumber),
        phoneVerificationRecaptcha
      );
      showToast("SMS kodu gonderildi.", "success");
      codeInput.focus();
    } catch (error) {
      showAuthError(errEl, phoneVerificationErrorMessage(error));
      resetPhoneVerificationFlow();
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Dogrulama kodu gonder";
    }
  });

  verifyBtn.addEventListener("click", async () => {
    errEl.classList.add("hidden");
    const code = String(codeInput.value || "").trim();

    if (!phoneVerificationConfirmation) {
      showAuthError(errEl, "Once SMS kodu gonderin.");
      return;
    }
    if (code.length !== 6) {
      showAuthError(errEl, "SMS ile gelen 6 haneli kodu girin.");
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Kod kontrol ediliyor...";

    try {
      await phoneVerificationConfirmation.confirm(code);
      await window.firebase.auth().signOut().catch(() => {});
      const shouldEnterApp = store.isLoggedIn;
      store.setPhoneVerified(user.username, phoneNumber, true);
      store.clearPendingPhoneVerification();
      resetPhoneVerificationFlow();
      if (shouldEnterApp) {
        renderApp();
        showToast("Telefon onayi tamamlandi.", "success");
      } else {
        store.setUser(null);
        renderAuthScreen();
        showToast("Telefon onayi tamamlandi. Simdi giris yapabilirsin.", "success");
      }
    } catch (error) {
      showAuthError(errEl, phoneVerificationErrorMessage(error));
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Kodu dogrula";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    const ok = await confirmDialog(exitConfirmMessage);
    if (!ok) return;
    resetPhoneVerificationFlow();
    store.clearPendingPhoneVerification();
    try {
      if (store.user?.sessionToken) {
        await api.revokeSession(store.user.sessionToken);
      }
    } catch {}
    store.setUser(null);
    renderApp();
  });
}

function renderAuthScreen() {
  const root = document.getElementById("app-root");
  root.innerHTML = `
    <div class="auth-bg">
      <div class="auth-orb auth-orb-1"></div>
      <div class="auth-orb auth-orb-2"></div>
    </div>
    <div class="auth-container">
      <div class="auth-logo-area">
        ${brandLogoHtml("lg")}
        <p class="auth-tagline">Güvenilir Oto Servis Bul</p>
      </div>
      <div class="auth-card">
        <div class="auth-tabs" id="auth-tabs">
          <button class="auth-tab active" data-mode="login">Giriş Yap</button>
          <button class="auth-tab" data-mode="register">Kayıt Ol</button>
        </div>
        <div id="auth-form-area"></div>
      </div>
    </div>`;

  let currentMode = "login";
  renderAuthForm(currentMode);

  document.getElementById("auth-tabs").addEventListener("click", e => {
    const tab = e.target.closest("[data-mode]");
    if (!tab) return;
    currentMode = tab.dataset.mode;
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t.dataset.mode === currentMode));
    renderAuthForm(currentMode);
  });
}

function renderAuthForm(mode) {
  const area = document.getElementById("auth-form-area");
  if (!area) return;
  const turnstileSlotId = createTurnstileSlotId(`auth-${mode}`);

  if (mode === "login") {
    area.innerHTML = `
      <form id="login-form" autocomplete="on">
        <div class="field-group">
          <label>Kullanıcı Adı</label>
          <input type="text" name="username" placeholder="kullaniciadi" autocomplete="username" required>
        </div>
        <div class="field-group">
          <label>Şifre</label>
          <div class="pw-wrap">
            <input type="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
            <button type="button" class="pw-toggle">${uiIcon("eye")}</button>
          </div>
        </div>
        ${turnstileMarkup(turnstileSlotId)}
        <div id="auth-error" class="auth-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-full" id="login-btn">Giriş Yap</button>
        <div class="auth-links">
          ${CONFIG.PRIVACY_POLICY_URL ? `<a href="${escHtml(CONFIG.PRIVACY_POLICY_URL)}" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</a>` : ""}
          ${CONFIG.TERMS_OF_SERVICE_URL ? `<a href="${escHtml(CONFIG.TERMS_OF_SERVICE_URL)}" target="_blank" rel="noopener noreferrer">Kullanım Koşulları</a>` : ""}
        </div>
      </form>`;
    setupPasswordToggle(area);
    area.querySelector("#login-form").addEventListener("submit", handleLogin);
    ensureTurnstileMounted(area.querySelector(`#${turnstileSlotId}`));
  } else {
    area.innerHTML = `
      <form id="register-form" autocomplete="on">
        <div class="field-section-title">Temel Bilgiler</div>
        <div class="field-group">
          <label>Kullanıcı Adı</label>
          <input type="text" name="username" placeholder="kullaniciadi" autocomplete="username" required>
        </div>
        <div class="field-group">
          <label>Gerçek Ad Soyad</label>
          <input type="text" name="realName" placeholder="Ad Soyad" autocomplete="name" required>
        </div>
        <div class="field-group">
          <label>Şifre</label>
          <div class="pw-wrap">
            <input type="password" name="password" placeholder="••••••••" autocomplete="new-password" required>
            <button type="button" class="pw-toggle">${uiIcon("eye")}</button>
          </div>
        </div>
        <div class="field-group">
          <label>Şifre Tekrar</label>
          <div class="pw-wrap">
            <input type="password" name="passwordConfirm" placeholder="••••••••" autocomplete="new-password" required>
            <button type="button" class="pw-toggle">${uiIcon("eye")}</button>
          </div>
        </div>
        <div class="field-section-title">İletişim ve Konum</div>
        <div class="field-group">
          <label>Telefon</label>
          <input type="tel" name="phone" placeholder="05XX XXX XX XX" autocomplete="tel" inputmode="tel" maxlength="17" pattern="^(\\+?90 ?)?0?5[0-9 ]{9,}$" required>
        </div>
        <div class="field-group">
          <label>Hesap Tipi</label>
          <div class="role-chips">
            <label class="role-chip"><input type="radio" name="role" value="Customer" checked> Araç Sahibi</label>
            <label class="role-chip"><input type="radio" name="role" value="Owner"> İşletme Sahibi</label>
          </div>
        </div>
        <div class="field-row">
          <div class="field-group field-half">
            <label>İl</label>
            <select name="city" data-rounded-select required>
              ${CITIES.map(c => `<option value="${escHtml(c)}" ${c === CONFIG.DEFAULT_CITY ? "selected" : ""}>${escHtml(c)}</option>`).join("")}
            </select>
          </div>
          <div class="field-group field-half">
            <label>İlçe</label>
            <select name="district" data-rounded-select required>
              ${(CITY_DISTRICT_DATA[CONFIG.DEFAULT_CITY] || []).map(d => `<option value="${escHtml(d)}" ${d === CONFIG.DEFAULT_DISTRICT ? "selected" : ""}>${escHtml(d)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field-section-title">Sözleşmeler</div>
        <label class="checkbox-label">
          <input type="checkbox" name="acceptLegal" required>
          <span>Gizlilik Politikası ve Kullanım Koşullarını okudum, kabul ediyorum.</span>
        </label>
        <div class="auth-links" style="margin-top:4px">
          ${CONFIG.PRIVACY_POLICY_URL ? `<a href="${escHtml(CONFIG.PRIVACY_POLICY_URL)}" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</a>` : ""}
          ${CONFIG.TERMS_OF_SERVICE_URL ? `<a href="${escHtml(CONFIG.TERMS_OF_SERVICE_URL)}" target="_blank" rel="noopener noreferrer">Kullanım Koşulları</a>` : ""}
        </div>
        ${turnstileMarkup(turnstileSlotId)}
        <div id="auth-error" class="auth-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-full" id="register-btn" style="margin-top:14px">Devam Et</button>
      </form>`;

    setupPasswordToggle(area);

    const citySelect = area.querySelector("[name=city]");
    const districtSelect = area.querySelector("[name=district]");
    enhanceRoundedSelects(area);
    citySelect.addEventListener("change", () => {
      const districts = CITY_DISTRICT_DATA[citySelect.value] || [];
      districtSelect.innerHTML = districts.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join("");
      syncRoundedSelect(districtSelect);
    });

    area.querySelector("#register-form").addEventListener("submit", handleRegister);

    ensureTurnstileMounted(area.querySelector(`#${turnstileSlotId}`));
  }
}

function setupPasswordToggle(container) {
  container.querySelectorAll(".pw-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      input.type = input.type === "password" ? "text" : "password";
      btn.innerHTML = input.type === "password" ? uiIcon("eye") : uiIcon("eyeOff");
    });
  });
}

function closeRoundedSelects(except = null) {
  document.querySelectorAll(".rounded-select.is-open").forEach(el => {
    if (el !== except) el.classList.remove("is-open");
  });
}

function updateRoundedSelectPlacement(root) {
  if (!root) return;
  const menu = root.querySelector(".rounded-select-menu");
  const trigger = root.querySelector(".rounded-select-trigger");
  if (!menu || !trigger) return;

  const rect = trigger.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const gap = 8;
  const preferredHeight = Math.min(menu.scrollHeight || 0, 248);
  const spaceBelow = Math.max(0, viewportHeight - rect.bottom - gap - 12);
  const spaceAbove = Math.max(0, rect.top - gap - 12);
  const shouldOpenUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
  const usableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;

  root.classList.toggle("open-upward", shouldOpenUpward);
  menu.style.maxHeight = `${Math.max(120, Math.min(preferredHeight, usableSpace || preferredHeight))}px`;
}

function syncRoundedSelect(select) {
  if (!select?.dataset?.roundedEnhanced) return;
  const root = select.closest(".rounded-select");
  const trigger = root?.querySelector(".rounded-select-trigger span");
  const menu = root?.querySelector(".rounded-select-menu");
  if (!root || !trigger || !menu) return;

  const selectedOption = select.options[select.selectedIndex];
  trigger.textContent = selectedOption?.textContent || "";
  menu.innerHTML = Array.from(select.options).map(option => `
    <button
      type="button"
      class="rounded-select-option ${option.selected ? "is-selected" : ""}"
      data-value="${escHtml(option.value)}">
      ${escHtml(option.textContent || "")}
    </button>`).join("");
}

function enhanceRoundedSelects(scope = document) {
  const selects = scope.querySelectorAll("select[data-rounded-select]");
  selects.forEach(select => {
    if (!select.dataset.roundedEnhanced) {
      const wrapper = document.createElement("div");
      wrapper.className = "rounded-select";
      select.parentNode.insertBefore(wrapper, select);
      wrapper.appendChild(select);
      select.classList.add("rounded-select-native");
      select.dataset.roundedEnhanced = "true";

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "rounded-select-trigger";
      trigger.innerHTML = `<span></span>${uiIcon("chevronDown", "rounded-select-chevron")}`;

      const menu = document.createElement("div");
      menu.className = "rounded-select-menu";

      wrapper.append(trigger, menu);

      trigger.addEventListener("click", () => {
        const willOpen = !wrapper.classList.contains("is-open");
        closeRoundedSelects(wrapper);
        wrapper.classList.toggle("is-open", willOpen);
        if (willOpen) updateRoundedSelectPlacement(wrapper);
      });

      menu.addEventListener("click", e => {
        const optionBtn = e.target.closest("[data-value]");
        if (!optionBtn) return;
        const nextValue = optionBtn.dataset.value;
        if (select.value !== nextValue) {
          select.value = nextValue;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          syncRoundedSelect(select);
        }
        wrapper.classList.remove("is-open");
      });

      select.addEventListener("change", () => syncRoundedSelect(select));
    }

    syncRoundedSelect(select);
  });
}

document.addEventListener("click", e => {
  if (!e.target.closest(".rounded-select")) closeRoundedSelects();
});

window.addEventListener("resize", () => {
  document.querySelectorAll(".rounded-select.is-open").forEach(updateRoundedSelectPlacement);
});

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("#login-btn");
  const errEl = form.querySelector("#auth-error");
  const turnstileSlot = form.querySelector(".cf-turnstile-slot");
  const username = form.username.value.trim();
  const password = form.password.value;

  if (!username || !password) {
    showAuthError(errEl, "Kullanıcı adı ve şifre gereklidir.");
    return;
  }

  const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
  if (captchaToken == null) return;

  btn.disabled = true;
  btn.textContent = "Giriş yapılıyor...";
  errEl.classList.add("hidden");

  try {
    const user = await api.login({ username, password, captchaToken });
    store.clearPendingPhoneVerification();
    store.setUser(user);
    resetPhoneVerificationFlow();
    renderApp();
    showToast("Giriş başarılı! Hoş geldiniz.", "success");
  } catch (err) {
    showAuthError(errEl, err.message || "Giris basarisiz. Bilgileri kontrol edin.");
    resetTurnstile(turnstileSlot);
  } finally {
    btn.disabled = false;
    btn.textContent = "Giriş Yap";
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("#register-btn");
  const errEl = form.querySelector("#auth-error");
  const turnstileSlot = form.querySelector(".cf-turnstile-slot");

  const username = form.username.value.trim();
  const realName = form.realName.value.trim();
  const password = form.password.value;
  const passwordConfirm = form.passwordConfirm.value;
  const phone = normalizeTurkishPhone(form.phone.value);
  const roleKey = form.role.value;
  const city = form.city.value;
  const district = form.district.value;
  const accepted = form.acceptLegal.checked;

  if (!username || !realName || !password || !phone) {
    showAuthError(errEl, "Zorunlu alanları doldurun."); return;
  }
  if (!isValidTurkishPhone(phone)) {
    showAuthError(errEl, "Telefon numarası 05XX XXX XX XX formatında olmalı."); return;
  }
  if (password !== passwordConfirm) {
    showAuthError(errEl, "Şifreler eşleşmiyor."); return;
  }
  if (!accepted) {
    showAuthError(errEl, "Sözleşmeleri kabul etmeniz gerekiyor."); return;
  }

  const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
  if (captchaToken == null) return;

  btn.disabled = true;
  btn.textContent = "Kaydediliyor...";
  errEl.classList.add("hidden");

  try {
    const user = await api.register({
      username,
      realName,
      password,
      phoneNumber: phone,
      roleKey,
      city,
      district,
      captchaToken,
      acceptedLegal: accepted,
    });

    const registeredUser = {
      ...(user || {}),
      username: user?.username || username,
      realName: user?.realName || realName,
      phoneNumber: normalizeTurkishPhone(user?.phoneNumber || phone),
      role: user?.role || user?.roleName || roleKey,
      roleKey: user?.roleKey || roleKey,
      city: user?.city || city,
      district: user?.district || district,
      sessionToken: user?.sessionToken || "",
      sessionExpiresAtMillis: user?.sessionExpiresAtMillis || 0,
    };

    store.clearPendingPhoneVerification();
    store.setUser(registeredUser.sessionToken ? registeredUser : null);
    resetPhoneVerificationFlow();
    renderApp();
    showToast("Kayit tamamlandi. Telefon dogrulamasi gerekmeden giris yapabilirsin.", "success");
  } catch (err) {
    showAuthError(errEl, err.message || "Kayit basarisiz. Bilgileri kontrol edin.");
    resetTurnstile(turnstileSlot);
  } finally {
    btn.disabled = false;
    btn.textContent = "Devam Et";
  }
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

// ===================== MAIN APP SHELL ========================

function renderApp() {
  startSessionKeepAlive();

  if (store.requiresPhoneVerification) {
    renderPhoneVerificationScreen();
    return;
  }

  if (![0, 1, 2].includes(store.currentTab)) {
    store.currentTab = 0;
  }

  const root = document.getElementById("app-root");
  root.innerHTML = `
    <div id="main-screen">
      <div id="screen-content"></div>
      <nav class="bottom-nav" id="bottom-nav">
        <button class="nav-item ${store.currentTab === 0 ? "active" : ""}" data-tab="0">
          <span class="nav-icon">${uiIcon("home")}</span><span class="nav-label">Ana Sayfa</span>
        </button>
        <button class="nav-item ${store.currentTab === 1 ? "active" : ""}" data-tab="1">
          <span class="nav-icon">${uiIcon("heart")}</span><span class="nav-label">Favoriler</span>
        </button>
        <button class="nav-item ${store.currentTab === 2 ? "active" : ""}" data-tab="2">
          <span class="nav-icon">${uiIcon("settings")}</span><span class="nav-label">Ayarlar</span>
        </button>
      </nav>
    </div>`;

  document.getElementById("bottom-nav").addEventListener("click", e => {
    const item = e.target.closest("[data-tab]");
    if (!item) return;
    const tab = parseInt(item.dataset.tab);
    store.setTab(tab);
    renderCurrentTab();
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.tab == tab));
  });

  renderCurrentTab();
  window.setTimeout(openSharedShopFromUrl, 0);
}

let lastOpenedSharedShopUrl = "";

function findKnownShop(shopId) {
  const id = String(shopId || "").trim();
  if (!id) return null;
  const lists = [store.shops, homeState.shops, shopsState.shops];
  for (const list of lists) {
    const found = (list || []).find(shop =>
      String(shop?.id || "").trim() === id ||
      String(shop?.placeId || "").trim() === id
    );
    if (found) return found;
  }
  return null;
}

async function openSharedShopFromUrl() {
  const sharedShopId = readSharedShopIdFromUrl();
  if (!sharedShopId || lastOpenedSharedShopUrl === window.location.href) return;
  lastOpenedSharedShopUrl = window.location.href;

  const knownShop = findKnownShop(sharedShopId);
  if (knownShop) {
    showShopDetail(knownShop.id || knownShop.placeId);
    return;
  }

  try {
    showToast("Dükkan açılıyor...", "info");
    const shop = await api.fetchSharedShop(sharedShopId);
    if (!shop?.id) throw new Error("Paylaşılan dükkan bulunamadı.");
    store.mergeShops([shop]);
    showShopDetail(shop.id);
  } catch (err) {
    console.warn("Paylaşılan dükkan açılamadı:", err);
    showToast("Paylaşılan dükkan açılamadı.", "error");
  }
}

const SESSION_KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;
let sessionKeepAliveTimer = null;
let sessionRefreshInFlight = null;
let sessionKeepAliveToken = "";

function mergeSessionUser(existing, refreshed) {
  return {
    ...existing,
    ...refreshed,
    sessionToken: refreshed?.sessionToken || existing?.sessionToken || "",
    sessionExpiresAtMillis: refreshed?.sessionExpiresAtMillis || existing?.sessionExpiresAtMillis || 0,
  };
}

async function refreshStoredSession() {
  const existing = store.user;
  if (!existing?.sessionToken) return null;
  if (sessionRefreshInFlight) return sessionRefreshInFlight;

  sessionRefreshInFlight = (async () => {
    try {
      const refreshed = await api.fetchCurrentUser(existing.sessionToken);
      const merged = mergeSessionUser(existing, refreshed);
      if (merged.sessionToken && JSON.stringify(existing) !== JSON.stringify(merged)) {
        store.setUser(merged);
      }
      return merged;
    } catch (err) {
      console.warn("Oturum yenilenemedi:", err);
      return null;
    } finally {
      sessionRefreshInFlight = null;
    }
  })();

  return sessionRefreshInFlight;
}

function startSessionKeepAlive() {
  const token = store.user?.sessionToken || "";
  if (!token) {
    if (sessionKeepAliveTimer) window.clearInterval(sessionKeepAliveTimer);
    sessionKeepAliveTimer = null;
    sessionKeepAliveToken = "";
    return;
  }

  if (sessionKeepAliveTimer && sessionKeepAliveToken === token) return;
  if (sessionKeepAliveTimer) window.clearInterval(sessionKeepAliveTimer);
  sessionKeepAliveToken = token;
  window.setTimeout(refreshStoredSession, 0);
  sessionKeepAliveTimer = window.setInterval(refreshStoredSession, SESSION_KEEP_ALIVE_INTERVAL_MS);
}

function renderCurrentTab() {
  const content = document.getElementById("screen-content");
  if (!content) return;
  switch (store.currentTab) {
    case 0: renderHomeScreen(content); break;
    case 1: renderFavoritesScreen(content); break;
    case 2: renderSettingsScreen(content); break;
    default:
      store.currentTab = 0;
      renderHomeScreen(content);
      break;
  }
}

function requireLoginForAction(message = "Bu islem icin giris yapmalisin.") {
  if (store.isLoggedIn) return true;
  showToast(message, "warn");
  store.setTab(2);
  renderApp();
  return false;
}

// ===================== HOME SCREEN ========================

const HOME_DEFAULT_CATEGORY = "All";
const HOME_DEFAULT_COLLECTION = "DefaultFlow";
const HOME_QUICK_CATEGORY_KEYS = [
  "All",
  "OtoServis",
  "Kaporta",
  "Elektrik",
  "Lastik",
  "OtoYikama",
  "OtoEkspertiz",
];

let homeState = {
  loading: false,
  error: null,
  shops: [],
  selectedCategory: HOME_DEFAULT_CATEGORY,
  selectedBrand: "",
  selectedModel: "",
  selectedCollection: HOME_DEFAULT_COLLECTION,
  searchQuery: "",
  searchPage: 0,
  searchNextOffset: 0,
  searchTotal: 0,
  searchHasMore: false,
  _reqToken: 0,
  _rankings: null,
  _rankingsKey: null,
};

const ADSENSE_SCRIPT_ID = "adsense-script";
const ADSENSE_SHOP_DETAIL_COUNT_KEY = "ustabul_adsense_shop_detail_count";
let adsenseScriptPromise = null;
let adsenseAutoAdsInitialized = false;

function getAdsenseClientId() {
  return String(CONFIG.ADSENSE_CLIENT_ID || "").trim();
}

function getAdsenseInlineSlotId() {
  return String(CONFIG.ADSENSE_INLINE_SLOT_ID || "").trim();
}

function getAdsenseInlineFrequency() {
  const value = Number(CONFIG.ADSENSE_INLINE_FREQUENCY || 5);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 5;
}

function getAdsenseShopDetailThreshold() {
  const value = Number(CONFIG.ADSENSE_LOAD_AFTER_SHOP_DETAIL_OPENS || 3);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 3;
}

function shouldDisableAdsForCurrentHost() {
  if (window.location.protocol === "file:") return true;
  if (isLocalHostname() && !CONFIG.ADSENSE_ALLOW_ON_LOCALHOST) return true;
  return false;
}

function canUseAdsense() {
  return Boolean(CONFIG.ADSENSE_ENABLED && getAdsenseClientId() && !shouldDisableAdsForCurrentHost());
}

function canUseInlineAds() {
  return Boolean(canUseAdsense() && getAdsenseInlineSlotId());
}

function getShopDetailAdOpenCount() {
  try {
    const value = Number(window.sessionStorage.getItem(ADSENSE_SHOP_DETAIL_COUNT_KEY) || "0");
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function incrementShopDetailAdOpenCount() {
  const nextValue = getShopDetailAdOpenCount() + 1;
  try {
    window.sessionStorage.setItem(ADSENSE_SHOP_DETAIL_COUNT_KEY, String(nextValue));
  } catch {}
  return nextValue;
}

function initializeAdsenseAutoAds() {
  if (adsenseAutoAdsInitialized || !canUseAdsense()) return;
  if (!window.adsbygoogle || !Array.isArray(window.adsbygoogle)) return;
  try {
    window.adsbygoogle.push({
      google_ad_client: getAdsenseClientId(),
      enable_page_level_ads: true,
    });
    adsenseAutoAdsInitialized = true;
  } catch (err) {
    console.warn("AdSense auto ads init failed:", err);
  }
}

function ensureAdsenseScriptLoaded() {
  if (!canUseAdsense()) return Promise.resolve(false);
  if (adsenseScriptPromise) return adsenseScriptPromise;

  const existingScript = document.getElementById(ADSENSE_SCRIPT_ID);
  if (existingScript && window.adsbygoogle) {
    initializeAdsenseAutoAds();
    renderPendingInlineAds(document);
    return Promise.resolve(true);
  }

  adsenseScriptPromise = new Promise(resolve => {
    const script = existingScript || document.createElement("script");
    const finishSuccess = () => {
      window.adsbygoogle = window.adsbygoogle || [];
      initializeAdsenseAutoAds();
      renderPendingInlineAds(document);
      resolve(true);
    };

    if (!existingScript) {
      script.id = ADSENSE_SCRIPT_ID;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(getAdsenseClientId())}`;
      script.addEventListener("load", finishSuccess, { once: true });
      script.addEventListener("error", () => {
        console.warn("AdSense script failed to load.");
        adsenseScriptPromise = null;
        resolve(false);
      }, { once: true });
      document.head.appendChild(script);
      return;
    }

    existingScript.addEventListener("load", finishSuccess, { once: true });
    existingScript.addEventListener("error", () => {
      console.warn("AdSense script failed to load.");
      adsenseScriptPromise = null;
      resolve(false);
    }, { once: true });
  });

  return adsenseScriptPromise;
}

function renderPendingInlineAds(scope = document) {
  if (!canUseInlineAds() || !window.adsbygoogle || !Array.isArray(window.adsbygoogle)) return;
  scope.querySelectorAll(".js-inline-ad-slot:not([data-ad-rendered='1'])").forEach(slot => {
    try {
      window.adsbygoogle.push({});
      slot.dataset.adRendered = "1";
    } catch (err) {
      console.warn("Inline AdSense render failed:", err);
    }
  });
}

function inlineAdCardHtml(context = "shops") {
  if (!canUseInlineAds()) return "";
  return `
    <div class="ad-inline-card" data-ad-context="${escHtml(context)}" aria-label="Reklam">
      <div class="ad-inline-card-head">
        <span class="ad-inline-badge">Reklam</span>
        <span class="ad-inline-caption">Sponsorlu icerik</span>
      </div>
      <div class="ad-inline-slot-wrap">
        <ins
          class="adsbygoogle js-inline-ad-slot"
          style="display:block"
          data-ad-client="${escHtml(getAdsenseClientId())}"
          data-ad-slot="${escHtml(getAdsenseInlineSlotId())}"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
      </div>
    </div>`;
}

function shopCardsWithInlineAdsHtml(shops, showDistance = false, context = "shops") {
  const frequency = getAdsenseInlineFrequency();
  const fragments = [];
  shops.forEach((shop, index) => {
    fragments.push(shopCardHtml(shop, store.isFavorite(shop.id), showDistance));
    const shouldInsertAd = canUseInlineAds() &&
      (index + 1) % frequency === 0 &&
      index < shops.length - 1;
    if (shouldInsertAd) {
      fragments.push(inlineAdCardHtml(context));
    }
  });
  return fragments.join("");
}

function rankingsCacheKey() {
  return [
    store.selectedCity,
    homeState.selectedCollection,
    homeState.selectedCategory,
    homeState.selectedCategory === "OtoServis" ? homeState.selectedBrand.trim() : "",
    homeState.selectedCategory === "OtoServis" ? homeState.selectedModel.trim() : "",
  ].join("|");
}

function homeQuickCategories() {
  return [...HOME_QUICK_CATEGORY_KEYS, homeState.selectedCategory]
    .map(key => findCategory(key))
    .filter(Boolean)
    .filter((category, index, categories) =>
      categories.findIndex(candidate => candidate.key === category.key) === index);
}

function homeSurfaceCollections() {
  return HOME_ALGORITHMS.filter(option => option.key !== HOME_DEFAULT_COLLECTION);
}

function shouldShowHomeBrandFilter(categoryKey = homeState.selectedCategory) {
  return categoryKey === "OtoServis";
}

function shopThreadKey(shop) {
  return String(shop?.placeId || shop?.id || "").trim();
}

function uniqueShopsByThreadId(...groups) {
  const out = [];
  const seen = new Set();
  groups.flat().forEach(shop => {
    const key = shopThreadKey(shop);
    if (!key || seen.has(key)) return;
    out.push(shop);
    seen.add(key);
  });
  return out;
}

function sortShopsByThreadIds(shops, threadIds) {
  if (!Array.isArray(threadIds) || !threadIds.length || !Array.isArray(shops) || !shops.length) return [];
  const byKey = new Map();
  shops.forEach(shop => {
    const key = shopThreadKey(shop);
    if (key && !byKey.has(key)) byKey.set(key, shop);
  });

  return threadIds
    .map(id => byKey.get(String(id || "").trim()))
    .filter(Boolean);
}

function pickHomeCollectionShops(rankings, collection = homeState.selectedCollection) {
  if (!rankings) return [];
  const pool = rankings.rankedShops || [];
  switch (collection) {
    case "RecentlyLiked": {
      const ranked = sortShopsByThreadIds(pool, rankings.recentlyLikedThreadIds);
      return ranked.length ? ranked : pool;
    }
    case "WorstRated": {
      const ranked = sortShopsByThreadIds(pool, rankings.worstRatedThreadIds);
      return ranked.length ? ranked : pool;
    }
    case "DefaultFlow":
    default:
      return pool;
  }
}

function mergeShopLists(existingShops, incomingShops) {
  const merged = new Map();
  [...(existingShops || []), ...(incomingShops || [])].forEach(shop => {
    if (!shop) return;
    const key = shop.id || shop.placeId;
    if (!key) return;
    merged.set(key, { ...(merged.get(key) || {}), ...shop });
  });
  return Array.from(merged.values());
}

function homeResultsTitle() {
  if (isHomeSearchActive()) return `"${homeState.searchQuery.trim()}" arama sonuçları`;
  switch (homeState.selectedCollection) {
    case "RecentlyLiked":
      return "Memnuniyet oran\u0131 y\u00fcksek ustalar";
    case "WorstRated":
      return "Kullan\u0131c\u0131lar\u0131n sorun belirttikleri ustalar";
    case "DefaultFlow":
    default:
      return `${store.selectedCity}, ${store.selectedDistrict} b\u00f6lgesine yak\u0131n d\u00fckkanlar`;
  }
}

function homeEmptyStateSubtitle() {
  if (isHomeSearchActive()) return "Farklı bir dükkan adı veya arama kelimesi deneyin.";
  switch (homeState.selectedCollection) {
    case "RecentlyLiked":
    case "WorstRated":
      return "Bu geli\u015fmi\u015f filtre i\u00e7in sonu\u00e7 bulunamad\u0131.";
    case "DefaultFlow":
    default:
      return "Farkl\u0131 bir kategori, marka veya konum deneyin.";
  }
}

function isHomeSearchActive() {
  return homeState.searchQuery.trim().length > 0;
}

function resetHomeSearchPaging() {
  homeState.searchPage = 0;
  homeState.searchNextOffset = 0;
  homeState.searchTotal = 0;
  homeState.searchHasMore = false;
}

function resetHomeFiltersForSearch() {
  const alreadyDefault =
    homeState.selectedCategory === HOME_DEFAULT_CATEGORY &&
    homeState.selectedBrand === "" &&
    homeState.selectedModel === "" &&
    homeState.selectedCollection === HOME_DEFAULT_COLLECTION;
  if (alreadyDefault) return;
  homeState.selectedCategory = HOME_DEFAULT_CATEGORY;
  homeState.selectedBrand = "";
  homeState.selectedModel = "";
  homeState.selectedCollection = HOME_DEFAULT_COLLECTION;
  refreshHomeFilterCard();
}

function clearHomeSearchForFilters() {
  if (!homeState.searchQuery) return;
  homeState.searchQuery = "";
  resetHomeSearchPaging();
  syncHomeSearchInputs();
}

async function renderHomeScreen(container) {
  container.innerHTML = `
    <div class="screen-home">
      <div class="home-compact-bar" id="home-compact-bar" aria-hidden="true">
        <button class="home-compact-logo" id="home-compact-logo" type="button" aria-label="Ana sayfa üstüne dön">
          ${brandLogoHtml("sm")}
        </button>
        <div class="home-compact-search search-bar-wrap">
          ${uiIcon("search")}
          <input class="search-input home-search-input" id="home-compact-search" type="search" placeholder="Dükkan Ara" value="${escHtml(homeState.searchQuery)}">
          <button class="btn btn-primary btn-search" id="home-compact-search-submit">Ara</button>
        </div>
      </div>
      <section class="home-hero">
        <div class="home-logo-row">
          <div class="home-brand-stack">
            <div class="home-brand">
              <div class="home-brand-logo">${brandLogoHtml("lg")}</div>
              <span class="brand-beta">(Beta)</span>
            </div>
            <button class="location-hero home-location-hero" id="home-location-btn" aria-label="Konumu degistir">
              ${uiIcon("pin", "inline-icon")} <span id="location-label">${escHtml(store.selectedCity)} / ${escHtml(store.selectedDistrict)}</span>
            </button>
          </div>
          <div class="screen-divider home-header-divider" aria-hidden="true"></div>
        </div>
        <div class="home-search-wrap">
          <div class="search-bar-wrap">
            ${uiIcon("search")}
            <input class="search-input home-search-input" id="home-search" type="search" placeholder="Dükkan Ara" value="${escHtml(homeState.searchQuery)}">
            <button class="btn btn-primary btn-search" id="home-search-submit">Ara</button>
          </div>
        </div>
        <div id="home-filter-card-wrap">${homeFilterCardHtml()}</div>
        <button class="home-scroll-results-btn" id="home-scroll-results" type="button" aria-label="Dükkanlara git">
          ${uiIcon("chevronDown")}
        </button>
      </section>
      <div id="home-content">${loadingHtml("Ustalar yükleniyor...")}</div>
    </div>`;

  document.getElementById("home-location-btn")?.addEventListener("click", showLocationPicker);
  document.getElementById("home-scroll-results")?.addEventListener("click", scrollHomeToResults);
  document.getElementById("home-compact-logo")?.addEventListener("click", scrollHomeToTop);
  attachHomeCompactHeader();
  attachHomeSearchListeners();
  attachHomeFilterCardListeners();

  await loadHomeShops();
}

function scrollHomeToTop() {
  animateHomeScrollTo(0, 520);
}

function scrollHomeToResults() {
  const scroller = document.getElementById("screen-content");
  const target = document.getElementById("home-content");
  if (!scroller || !target) return;

  const targetTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  animateHomeScrollTo(targetTop, 620);
}

function animateHomeScrollTo(targetTop, duration = 620) {
  const scroller = document.getElementById("screen-content");
  if (!scroller) return;

  const start = scroller.scrollTop;
  const distance = targetTop - start;
  const startedAt = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function step(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    scroller.scrollTop = start + distance * easeOutCubic(progress);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function attachHomeCompactHeader() {
  const scroller = document.getElementById("screen-content");
  const screen = document.querySelector(".screen-home");
  const target = document.getElementById("home-content");
  if (!scroller || !screen || !target) return;

  if (scroller._homeCompactHeaderHandler) {
    scroller.removeEventListener("scroll", scroller._homeCompactHeaderHandler);
  }

  const update = () => {
    const scrollerTop = scroller.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const shouldShow = targetTop - scrollerTop < 92;
    screen.classList.toggle("home-compact-visible", shouldShow);
    document.getElementById("home-compact-bar")?.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  };

  scroller._homeCompactHeaderHandler = update;
  scroller.addEventListener("scroll", update, { passive: true });
  update();
}

function syncHomeSearchInputs() {
  document.querySelectorAll(".home-search-input").forEach(input => {
    input.value = homeState.searchQuery;
  });
}

function attachHomeSearchListeners() {
  const bindSearch = (input, submit) => {
    if (!input) return;
    const syncAndLoad = () => {
      const nextQuery = (input?.value || "").trim();
      if (homeState.searchQuery === nextQuery) {
        loadHomeShops();
        return;
      }
      homeState.searchQuery = nextQuery;
      resetHomeSearchPaging();
      syncHomeSearchInputs();
      if (nextQuery) resetHomeFiltersForSearch();
      loadHomeShops();
    };

    input.addEventListener("input", debounce(syncAndLoad, 400));
    input.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      syncAndLoad();
    });
    submit?.addEventListener("click", syncAndLoad);
  };

  bindSearch(document.getElementById("home-search"), document.getElementById("home-search-submit"));
  bindSearch(document.getElementById("home-compact-search"), document.getElementById("home-compact-search-submit"));
}

async function loadHomeShops() {
  if (isHomeSearchActive()) {
    await loadHomeSearchResults();
    return;
  }

  const key = rankingsCacheKey();
  if (homeState._rankings && homeState._rankingsKey === key) {
    homeState.loading = false;
    homeState.error = null;
    homeState.shops = pickHomeCollectionShops(homeState._rankings, homeState.selectedCollection);
    renderHomeShops();
    return;
  }

  const token = ++homeState._reqToken;
  homeState.loading = true;
  homeState.error = null;
  const content = document.getElementById("home-content");
  if (content) content.innerHTML = loadingHtml();
  try {
    const result = await api.fetchHomeRankings({
      city:         store.selectedCity,
      // Android ana sayfa ranking istegi backend tarafinda sehir kapsamli calisiyor.
      district:     "",
      category:     categoryKey(homeState.selectedCategory, HOME_DEFAULT_CATEGORY),
      serviceBrand: homeState.selectedBrand,
      serviceModel: homeState.selectedModel,
      algorithm:    homeState.selectedCollection,
    });
    if (token !== homeState._reqToken) return;
    homeState._rankings = result;
    homeState._rankingsKey = key;
    homeState.shops = pickHomeCollectionShops(result, homeState.selectedCollection);
    store.mergeShops(result.rankedShops);
  } catch (err) {
    if (token !== homeState._reqToken) return;
    homeState.error = err.message || "Ustalar yüklenemedi.";
    homeState.shops = [];
    resetHomeSearchPaging();
    homeState._rankings = null;
    homeState._rankingsKey = null;
  } finally {
    if (token === homeState._reqToken) {
      homeState.loading = false;
      renderHomeShops();
    }
  }
}

async function loadHomeSearchResults() {
  const token = ++homeState._reqToken;
  const isFirstPage = homeState.searchPage === 0;
  homeState.loading = true;
  homeState.error = null;
  const content = document.getElementById("home-content");
  if (content && isFirstPage) content.innerHTML = loadingHtml();

  try {
    const result = await api.fetchDirectory({
      city: store.selectedCity,
      district: store.selectedDistrict,
      category: HOME_DEFAULT_CATEGORY,
      serviceBrand: "",
      serviceModel: "",
      searchQuery: homeState.searchQuery.trim(),
      offset: isFirstPage ? 0 : homeState.searchNextOffset,
      limit: 50,
    });
    if (token !== homeState._reqToken) return;
    homeState.shops = isFirstPage
      ? result.shops
      : mergeShopLists(homeState.shops, result.shops);
    homeState.searchTotal = result.total || homeState.shops.length;
    homeState.searchNextOffset = result.nextOffset ?? homeState.shops.length;
    homeState.searchHasMore = result.hasMore;
    store.mergeShops(result.shops);
  } catch (err) {
    if (token !== homeState._reqToken) return;
    homeState.error = err.message || "Ustalar yüklenemedi.";
    if (isFirstPage) homeState.shops = [];
  } finally {
    if (token === homeState._reqToken) {
      homeState.loading = false;
      renderHomeShops();
    }
  }
}

function renderHomeShops() {
  const content = document.getElementById("home-content");
  if (!content) return;
  const searchActive = isHomeSearchActive();
  if (homeState.loading) {
    content.innerHTML = loadingHtml();
    return;
  }
  if (homeState.error) {
    content.innerHTML = `<div class="error-state">${uiIcon("warning", "inline-icon")} ${escHtml(homeState.error)}</div>`;
    return;
  }
  if (!homeState.shops.length) {
    content.innerHTML = emptyStateHtml(
      uiIcon("search", "empty-svg"),
      "Sonu\u00e7 bulunamad\u0131",
      homeEmptyStateSubtitle()
    );
    return;
  }
  content.innerHTML = `
    <div class="section-title section-title-large">
      ${escHtml(homeResultsTitle())}
      ${searchActive ? `<span class="count-badge">${homeState.shops.length}${homeState.searchTotal ? ` / ${homeState.searchTotal}` : ""}</span>` : ""}
    </div>
    <div class="shops-list" id="home-shops-list">
      ${shopCardsWithInlineAdsHtml(homeState.shops, !searchActive, "home")}
    </div>
    ${searchActive && homeState.searchHasMore ? `<button class="btn btn-secondary load-more-btn" id="home-search-load-more">Kalanları Yükle</button>` : ""}`;
  attachShopCardListeners(content);
  renderPendingInlineAds(content);
  document.getElementById("home-search-load-more")?.addEventListener("click", async () => {
    const btn = document.getElementById("home-search-load-more");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Yükleniyor...";
    }
    homeState.searchPage++;
    await loadHomeShops();
  });
}

function homeQuickBrandChipsHtml() {
  const selectedBrand = homeState.selectedBrand.trim();
  return [
    `<button class="chip ${selectedBrand === "" ? "chip-active" : ""}" data-home-brand="">T\u00fcm Markalar</button>`,
    ...SERVICE_BRANDS.map(brand =>
      `<button class="chip ${selectedBrand === brand ? "chip-active" : ""}" data-home-brand="${escHtml(brand)}">${escHtml(brand)}</button>`),
  ].join("");
}

function homeCollectionChipsHtml() {
  return homeSurfaceCollections().map(option => {
    const isActive = homeState.selectedCollection === option.key;
    return `<button class="chip ${isActive ? "chip-active" : ""}" data-home-collection="${escHtml(option.key)}">
      ${escHtml(option.label)}
    </button>`;
  }).join("");
}

function homeFilterCardHtml() {
  const showBrand = shouldShowHomeBrandFilter();
  return `
    <div class="home-filter-card">
      <button class="filter-primary-action" id="home-filter-btn">
        ${uiIcon("sliders")} <span>Detayl\u0131 Filtreleme</span>
      </button>
      <h2>H\u0131zl\u0131 Filtreler</h2>
      <div class="home-filter-chips category-scroll">
        ${homeQuickCategories().map(category => `
          <button class="chip ${category.key === homeState.selectedCategory ? "chip-active" : ""}" data-home-category="${escHtml(category.key)}">
            ${escHtml(category.label)}
          </button>`).join("")}
      </div>
      ${showBrand ? `<div class="home-filter-chips category-scroll">${homeQuickBrandChipsHtml()}</div>` : ""}
      <div class="home-filter-chips algorithm-row">${homeCollectionChipsHtml()}</div>
    </div>`;
}

function applyHomeFilters({ category, brand, model, collection }) {
  clearHomeSearchForFilters();
  const nextCategory = categoryKey(category ?? homeState.selectedCategory, HOME_DEFAULT_CATEGORY);
  homeState.selectedCategory = nextCategory;
  homeState.selectedBrand = shouldShowHomeBrandFilter(nextCategory)
    ? (brand ?? homeState.selectedBrand).trim()
    : "";
  homeState.selectedModel = shouldShowHomeBrandFilter(nextCategory) && homeState.selectedBrand
    ? (model ?? homeState.selectedModel).trim()
    : "";
  homeState.selectedCollection = collection ?? homeState.selectedCollection;
  refreshHomeFilterCard();
  loadHomeShops();
}

function attachHomeFilterCardListeners() {
  const wrap = document.getElementById("home-filter-card-wrap");
  if (!wrap) return;
  wrap.onclick = e => {
    if (e.target.closest("#home-filter-btn")) {
      showHomeFilterModal();
      return;
    }

    const categoryBtn = e.target.closest("[data-home-category]");
    if (categoryBtn) {
      applyHomeFilters({
        category: categoryBtn.dataset.homeCategory,
        brand: categoryBtn.dataset.homeCategory === "OtoServis" ? homeState.selectedBrand : "",
        model: categoryBtn.dataset.homeCategory === "OtoServis" ? homeState.selectedModel : "",
      });
      return;
    }

    const brandBtn = e.target.closest("[data-home-brand]");
    if (brandBtn && shouldShowHomeBrandFilter()) {
      applyHomeFilters({ brand: brandBtn.dataset.homeBrand || "", model: "" });
      return;
    }

    const collectionBtn = e.target.closest("[data-home-collection]");
    if (collectionBtn) {
      const nextCollection = collectionBtn.dataset.homeCollection;
      applyHomeFilters({
        collection: homeState.selectedCollection === nextCollection
          ? HOME_DEFAULT_COLLECTION
          : nextCollection,
      });
    }
  };
}

function refreshHomeFilterCard() {
  const wrap = document.getElementById("home-filter-card-wrap");
  if (!wrap) return;
  wrap.innerHTML = homeFilterCardHtml();
  attachHomeFilterCardListeners();
}

function showHomeFilterModal() {
  let draft = {
    category: homeState.selectedCategory,
    brand: homeState.selectedBrand,
    model: homeState.selectedModel,
    models: [],
    collection: homeState.selectedCollection,
  };
  const MODAL_ID = "home-filter-modal";

  async function syncDraftModels() {
    if (draft.category !== "OtoServis" || !draft.brand.trim()) {
      draft.models = [];
      draft.model = "";
      return;
    }
    draft.models = await api.fetchServiceModels({ brand: draft.brand, category: draft.category });
    if (draft.model && !draft.models.includes(draft.model)) {
      draft.model = "";
    }
  }

  function bodyHtml() {
    return `<div class="wizard-card">
      <div>
        <h3>Kategori</h3>
        <div class="category-groups">${categoryChipsHtml(draft.category, true)}</div>
      </div>
      ${shouldShowHomeBrandFilter(draft.category) ? `
      <div>
        <h3>Marka</h3>
        ${serviceBrandGridHtml(draft.brand)}
      </div>
      ${draft.brand.trim() ? `
      <div>
        <h3>Model</h3>
        ${serviceModelGridHtml(draft.models, draft.model)}
      </div>` : ""}` : ""}
      <div>
        <h3>S\u0131ralama</h3>
        ${algorithmGridHtml(draft.collection)}
      </div>
    </div>`;
  }

  function renderBody() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.querySelector(".modal-body").innerHTML = bodyHtml();
  }

  const modal = createModal(
    MODAL_ID,
    "Filtreler",
    bodyHtml(),
    `<button class="btn btn-secondary" id="hf-reset">S\u0131f\u0131rla</button>
     <button class="btn btn-primary" id="hf-apply">Filtreleri Uygula</button>`
  );

  modal.querySelector(".modal-body").onclick = e => {
    const modelBtn = e.target.closest("[data-model]");
    if (modelBtn) {
      e.preventDefault();
      draft.model = modelBtn.dataset.model || "";
      renderBody();
      return;
    }

    const categoryBtn = e.target.closest("[data-category]");
    if (categoryBtn) {
      e.preventDefault();
      draft.category = categoryBtn.dataset.category;
      if (!shouldShowHomeBrandFilter(draft.category)) {
        draft.brand = "";
        draft.model = "";
      }
      Promise.resolve(syncDraftModels()).then(renderBody);
      return;
    }

    const brandBtn = e.target.closest("[data-brand]");
    if (brandBtn) {
      e.preventDefault();
      draft.brand = brandBtn.dataset.brand || "";
      draft.model = "";
      Promise.resolve(syncDraftModels()).then(renderBody);
      return;
    }

    const algoBtn = e.target.closest("[data-algo]");
    if (algoBtn) {
      e.preventDefault();
      const nextCollection = algoBtn.dataset.algo;
      draft.collection = draft.collection === nextCollection
        ? HOME_DEFAULT_COLLECTION
        : nextCollection;
      renderBody();
    }
  };

  modal.querySelector("#hf-reset")?.addEventListener("click", () => {
    draft = {
      category: HOME_DEFAULT_CATEGORY,
      brand: "",
      model: "",
      models: [],
      collection: HOME_DEFAULT_COLLECTION,
    };
    renderBody();
  });

  modal.querySelector("#hf-apply")?.addEventListener("click", () => {
    applyHomeFilters({
      category: draft.category,
      brand: draft.brand,
      model: draft.model,
      collection: draft.collection,
    });
    closeModal(MODAL_ID);
  });

  syncDraftModels().then(renderBody);
}

// ===================== SHOPS SCREEN ========================

let shopsState = {
  loading: false,
  error: null,
  shops: [],
  selectedCategory: "All",
  selectedBrand: "",
  selectedModel: "",
  searchQuery: "",
  page: 0,
  nextOffset: 0,
  total: 0,
  hasMore: false,
  _reqToken: 0,
};

async function renderShopsScreen(container) {
  container.innerHTML = `
    <div class="screen-shops">
      <div class="directory-hero-card">
        <div class="directory-hero-head">
          <h1 class="screen-title">Dükkan Ara</h1>
          <button class="location-selector small" id="shops-location-btn" type="button">
            ${uiIcon("pin", "inline-icon")} <span>${escHtml(store.selectedCity)}</span>
          </button>
        </div>
        <div class="search-bar-wrap">
          ${uiIcon("search")}
          <input class="search-input" id="shops-search" type="search" placeholder="Dükkan Ara" value="${escHtml(shopsState.searchQuery)}">
          <button class="btn btn-primary btn-search" id="shops-search-submit">Ara</button>
        </div>
        <button class="selector-card" id="shops-category-open" type="button">
          <span><strong>Kategori seç</strong><small>${escHtml(categoryLabel(shopsState.selectedCategory))}</small></span>
          ${uiIcon("store")}
        </button>
        <div class="category-groups" id="shops-categories">
          ${categoryChipsHtml(shopsState.selectedCategory, true)}
        </div>
      </div>
      <div id="shops-brand-bar">${shopsBrandBarHtml()}</div>
      <div id="shops-content">${loadingHtml("Ustalar yükleniyor...")}</div>
    </div>`;

  document.getElementById("shops-location-btn")?.addEventListener("click", showLocationPicker);

  const searchInput = document.getElementById("shops-search");
  searchInput?.addEventListener("input", debounce(async e => {
    shopsState.searchQuery = e.target.value;
    shopsState.page = 0;
    shopsState.nextOffset = 0;
    await loadShops();
  }, 400));
  document.getElementById("shops-search-submit")?.addEventListener("click", () => loadShops());
  document.getElementById("shops-category-open")?.addEventListener("click", () => {
    const scroller = document.getElementById("shops-categories");
    scroller?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.getElementById("shops-categories")?.addEventListener("click", e => {
    const chip = e.target.closest("[data-category]");
    if (!chip) return;
    const nextCategory = categoryKey(chip.dataset.category, "All");
    shopsState.selectedCategory = nextCategory;
    shopsState.page = 0;
    shopsState.nextOffset = 0;
    if (nextCategory !== "OtoServis") {
      shopsState.selectedBrand = "";
      shopsState.selectedModel = "";
    }
    document.querySelectorAll("#shops-categories .chip").forEach(c => c.classList.toggle("chip-active", c.dataset.category === shopsState.selectedCategory));
    refreshShopsBrandBar();
    if (nextCategory === "OtoServis") {
      showServiceVehiclePicker();
    } else {
      loadShops();
    }
  });

  attachShopsBrandBarListeners();

  await loadShops();
}

function shopsBrandBarHtml() {
  if (shopsState.selectedCategory !== "OtoServis") return "";
  const brandLabel = shopsState.selectedBrand?.trim() ? shopsState.selectedBrand : "T\u00fcm Markalar";
  const modelLabel = shopsState.selectedModel?.trim() || "";
  const label = modelLabel ? `${brandLabel} / ${modelLabel}` : brandLabel;
  const isFiltered = !!shopsState.selectedBrand?.trim() || !!shopsState.selectedModel?.trim();
  return `
    <div class="brand-indicator">
      <span class="brand-indicator-label">${uiIcon("tag", "inline-icon")} Ara\u00e7:</span>
      <button class="brand-indicator-btn" id="shops-brand-change">${escHtml(label)}</button>
      ${isFiltered ? `<button class="brand-indicator-clear" id="shops-brand-clear" title="Se\u00e7imi temizle">&times;</button>` : ""}
    </div>`;
}

function refreshShopsBrandBar() {
  const bar = document.getElementById("shops-brand-bar");
  if (!bar) return;
  bar.innerHTML = shopsBrandBarHtml();
  attachShopsBrandBarListeners();
}

function attachShopsBrandBarListeners() {
  document.getElementById("shops-brand-change")?.addEventListener("click", showServiceVehiclePicker);
  document.getElementById("shops-brand-clear")?.addEventListener("click", () => {
    shopsState.selectedBrand = "";
    shopsState.selectedModel = "";
    shopsState.page = 0;
    shopsState.nextOffset = 0;
    refreshShopsBrandBar();
    loadShops();
  });
}

async function showServiceVehiclePicker() {
  const modalId = "service-vehicle-picker";
  let draftBrand = shopsState.selectedBrand;
  let draftModel = shopsState.selectedModel;
  let models = draftBrand ? await api.fetchServiceModels({ brand: draftBrand, category: "OtoServis" }) : [];
  const bodyHtml = () => `<p class="modal-subtitle">Oto Servis kategorisinde arama yapmak için marka ve istersen model seçin.</p>
     ${serviceBrandGridHtml(draftBrand)}
     ${draftBrand ? `<div class="modal-section"><h3>Model</h3>${serviceModelGridHtml(models, draftModel)}</div>` : ""}`;
  const modal = createModal(
    modalId,
    "Araç Bilgisi Seçin",
    bodyHtml(),
    `<button class="btn btn-secondary" id="shops-vehicle-clear">Sıfırla</button>
     <button class="btn btn-primary" id="shops-vehicle-apply">Uygula</button>`
  );
  modal.querySelector(".modal-body").addEventListener("click", e => {
    const brandChip = e.target.closest("[data-brand]");
    if (brandChip) {
      draftBrand = brandChip.dataset.brand || "";
      draftModel = "";
      Promise.resolve(api.fetchServiceModels({ brand: draftBrand, category: "OtoServis" })).then(nextModels => {
        models = draftBrand ? nextModels : [];
        modal.querySelector(".modal-body").innerHTML = bodyHtml();
      });
      return;
    }
    const modelChip = e.target.closest("[data-model]");
    if (!modelChip) return;
    draftModel = modelChip.dataset.model || "";
    modal.querySelector(".modal-body").innerHTML = bodyHtml();
  });
  modal.querySelector("#shops-vehicle-clear")?.addEventListener("click", () => {
    draftBrand = "";
    draftModel = "";
    models = [];
    modal.querySelector(".modal-body").innerHTML = bodyHtml();
  });
  modal.querySelector("#shops-vehicle-apply")?.addEventListener("click", () => {
    shopsState.selectedBrand = draftBrand.trim();
    shopsState.selectedModel = draftBrand.trim() ? draftModel.trim() : "";
    shopsState.page = 0;
    shopsState.nextOffset = 0;
    closeModal(modalId);
    refreshShopsBrandBar();
    loadShops();
  });
}

async function loadShops() {
  const token = ++shopsState._reqToken;
  const isFirstPage = shopsState.page === 0;
  shopsState.loading = true;
  shopsState.error = null;
  const content = document.getElementById("shops-content");
  if (content && isFirstPage) content.innerHTML = loadingHtml();

  try {
    const result = await api.fetchDirectory({
      city: store.selectedCity,
      district: store.selectedDistrict,
      category: categoryKey(shopsState.selectedCategory, "All"),
      serviceBrand: shopsState.selectedBrand,
      serviceModel: shopsState.selectedModel,
      searchQuery: shopsState.searchQuery,
      offset: isFirstPage ? 0 : shopsState.nextOffset,
      limit: 50,
    });
    if (token !== shopsState._reqToken) return;
    shopsState.shops = isFirstPage
      ? result.shops
      : mergeShopLists(shopsState.shops, result.shops);
    shopsState.total = result.total || shopsState.shops.length;
    shopsState.nextOffset = result.nextOffset ?? shopsState.shops.length;
    shopsState.hasMore = result.hasMore;
    store.mergeShops(result.shops);
  } catch (err) {
    if (token !== shopsState._reqToken) return;
    shopsState.error = err.message || "Ustalar yüklenemedi.";
  } finally {
    if (token === shopsState._reqToken) {
      shopsState.loading = false;
      renderShopsList();
    }
  }
}

async function loadAllRemainingShops() {
  while (shopsState.hasMore && !shopsState.loading) {
    const previousCount = shopsState.shops.length;
    const previousOffset = shopsState.nextOffset;
    shopsState.page++;
    await loadShops();
    if (shopsState.error) break;
    if (shopsState.shops.length === previousCount && shopsState.nextOffset === previousOffset) break;
  }
}

function renderShopsList() {
  const content = document.getElementById("shops-content");
  if (!content) return;
  if (shopsState.loading) { content.innerHTML = loadingHtml(); return; }
  if (shopsState.error) {
    content.innerHTML = `<div class="error-state">${uiIcon("warning", "inline-icon")} ${escHtml(shopsState.error)}</div>`;
    return;
  }
  if (!shopsState.shops.length) {
    content.innerHTML = emptyStateHtml(uiIcon("search", "empty-svg"), "Sonuç bulunamadı", "Farklı arama kriterleri deneyin.");
    return;
  }

  content.innerHTML = `
    <div class="section-title">
      Dükkanlar <span class="count-badge">${shopsState.shops.length}${shopsState.total ? ` / ${shopsState.total}` : ""}</span>
    </div>
    <div class="shops-list" id="shops-list-items">
      ${shopCardsWithInlineAdsHtml(shopsState.shops, false, "shops")}
    </div>
    ${shopsState.hasMore ? `<button class="btn btn-secondary load-more-btn" id="load-more-btn">Kalanları Yükle</button>` : ""}`;

  attachShopCardListeners(content);
  renderPendingInlineAds(content);
  document.getElementById("load-more-btn")?.addEventListener("click", async () => {
    const btn = document.getElementById("load-more-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Yükleniyor...";
    }
    await loadAllRemainingShops();
  });
}

// ===================== FAVORITES SCREEN ========================

function renderFavoritesScreen(container) {
  const favShops = store.favorites
    .map(id => store.shops.find(s => s.id === id))
    .filter(Boolean);

  container.innerHTML = `
    <div class="screen-favorites">
      <div class="screen-header">
        <h1 class="screen-title">Favorilerim</h1>
      </div>
      ${!store.favorites.length
        ? emptyStateHtml(uiIcon("heart", "empty-svg"), "Henüz favori yok", "Beğendiğiniz ustalar burada görünür.")
        : `<div class="shops-list">
            ${store.favorites.map(id => {
              const shop = favShops.find(s => s.id === id);
              if (!shop) return `<div class="shop-card-placeholder">ID: ${escHtml(id)}</div>`;
              return shopCardHtml(shop, true, false);
            }).join("")}
           </div>`
      }
    </div>`;

  attachShopCardListeners(container);
}

// ===================== SETTINGS SCREEN ========================

function userRoleLabel(role) {
  return role === "Owner" ? "İşletme Sahibi" : "Araç Sahibi";
}

function cleanUserValue(value, fallback = "Bilgi yok") {
  const text = String(value || "").trim();
  return text || fallback;
}

function userLocationLabel(user) {
  const city = String(user?.city || store.selectedCity || "").trim();
  const district = String(user?.district || store.selectedDistrict || "").trim();
  return [city, district].filter(Boolean).join(" / ") || "Konum bilgisi yok";
}

function needsUserProfileRefresh(user) {
  return Boolean(user?.sessionToken) && (
    !String(user?.username || "").trim() ||
    !String(user?.phoneNumber || "").trim() ||
    !String(user?.city || "").trim()
  );
}

async function refreshCurrentUserForSettings(container) {
  const existing = store.user;
  if (!needsUserProfileRefresh(existing) || store._profileRefreshAttempted) return;
  store._profileRefreshAttempted = true;
  try {
    const refreshed = await api.fetchCurrentUser(existing.sessionToken);
    const merged = {
      ...existing,
      ...refreshed,
      sessionToken: refreshed.sessionToken || existing.sessionToken,
      sessionExpiresAtMillis: refreshed.sessionExpiresAtMillis || existing.sessionExpiresAtMillis || 0,
    };
    if (JSON.stringify(existing) !== JSON.stringify(merged)) {
      store.setUser(merged);
      store._profileRefreshAttempted = true;
      renderSettingsScreen(container);
    }
  } catch (err) {
    console.warn("Kullanıcı profili yenilenemedi:", err);
  }
}

function renderSettingsScreen(container) {
  const user = store.user;
  if (!store.isLoggedIn) {
    container.innerHTML = `
      <div class="screen-settings">
        <div class="screen-header">
          <h1 class="screen-title">Ayarlar</h1>
        </div>
        <div class="settings-card">
          <div class="settings-section-title">Hesap</div>
          <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:12px">
            <div>
              <div class="settings-username">Giris yap veya kayit ol</div>
              <div class="settings-location">Dukkanlari gezebilirsin; yorum, oy ve hesap islemleri icin giris gerekir.</div>
            </div>
            <button class="btn btn-primary btn-full" id="settings-login-btn">Giris Yap / Kayit Ol</button>
          </div>
          <div class="settings-divider"></div>
          <div class="settings-section-title">Gorunum</div>
          <div class="settings-row settings-row-between">
            <span class="settings-row-label">${uiIcon("moon", "inline-icon")} Karanlik Mod</span>
            <label class="toggle-switch">
              <input type="checkbox" id="dark-mode-toggle" ${store.isDarkMode ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          ${CONFIG.PRIVACY_POLICY_URL || CONFIG.TERMS_OF_SERVICE_URL ? `
          <div class="settings-divider"></div>
          <div class="settings-links">
            ${CONFIG.PRIVACY_POLICY_URL ? `<a href="${escHtml(CONFIG.PRIVACY_POLICY_URL)}" target="_blank" rel="noopener noreferrer">Gizlilik Politikasi</a>` : ""}
            ${CONFIG.TERMS_OF_SERVICE_URL ? `<a href="${escHtml(CONFIG.TERMS_OF_SERVICE_URL)}" target="_blank" rel="noopener noreferrer">Kullanim Kosullari</a>` : ""}
          </div>` : ""}
        </div>
      </div>`;

    document.getElementById("settings-login-btn")?.addEventListener("click", renderAuthScreen);
    document.getElementById("dark-mode-toggle")?.addEventListener("change", e => {
      store.setDarkMode(e.target.checked);
    });
    return;
  }

  const username = cleanUserValue(user?.username);
  const realName = cleanUserValue(user?.realName);
  const phoneNumber = cleanUserValue(user?.phoneNumber);
  const locationLabel = userLocationLabel(user);
  const avatarText = (user?.realName || user?.username || "?").trim().slice(0, 1).toUpperCase();
  container.innerHTML = `
    <div class="screen-settings">
      <div class="screen-header">
        <h1 class="screen-title">Ayarlar</h1>
      </div>
      <div class="settings-card">
        <div class="settings-section-title">Hesap</div>
        <div class="settings-row">
          <div class="settings-avatar">${escHtml(avatarText)}</div>
          <div class="settings-user-info">
            <div class="settings-username">${escHtml(realName)}</div>
            <div class="settings-role">${user?.role === "Owner" ? "İşletme Sahibi" : "Araç Sahibi"}</div>
            <div class="settings-location">${uiIcon("pin", "inline-icon")} ${escHtml(locationLabel)}</div>
          </div>
        </div>
        <div class="settings-info-list">
          <div class="settings-info-row">
            <span class="settings-info-label">Kullanıcı adı</span>
            <span class="settings-info-value">@${escHtml(username)}</span>
          </div>
          <div class="settings-info-row">
            <span class="settings-info-label">Telefon</span>
            <span class="settings-info-value">${escHtml(phoneNumber === "Bilgi yok" ? phoneNumber : formatPhone(phoneNumber))}</span>
          </div>
        </div>
        <div class="settings-divider"></div>
        <div class="settings-section-title">Görünüm</div>
        <div class="settings-row settings-row-between">
          <span class="settings-row-label">${uiIcon("moon", "inline-icon")} Karanlık Mod</span>
          <label class="toggle-switch">
            <input type="checkbox" id="dark-mode-toggle" ${store.isDarkMode ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="settings-divider"></div>
        <div class="settings-section-title">Konum</div>
        <div class="settings-row settings-row-between">
          <span class="settings-row-label">${uiIcon("pin", "inline-icon")} ${escHtml(store.selectedCity)} / ${escHtml(store.selectedDistrict)}</span>
          <button class="btn btn-secondary btn-sm" id="change-location-btn">Değiştir</button>
        </div>
        ${store.user?.role === "Owner" ? `
        <div class="settings-divider"></div>
        <div class="settings-section-title">İşletme</div>
        <div class="settings-row">
          <button class="btn btn-secondary btn-full" id="add-shop-btn">${uiIcon("plus", "inline-icon")} İşletme Ekle</button>
        </div>` : ""}
        ${store.isModerator ? `
        <div class="settings-divider"></div>
        <div class="settings-section-title">Moderasyon</div>
        <div class="settings-row">
          <button class="btn btn-secondary btn-full" id="moderation-btn">${uiIcon("shield", "inline-icon")} Moderasyon Merkezi</button>
        </div>` : ""}
        <div class="settings-divider"></div>
        <div class="settings-section-title">Hesap İşlemleri</div>
        <div class="settings-row" style="flex-direction:column;gap:8px">
          <button class="btn btn-danger btn-full" id="logout-btn">${uiIcon("logout", "inline-icon")} Çıkış Yap</button>
          <button class="btn btn-danger btn-full" id="delete-account-btn">${uiIcon("trash", "inline-icon")} Hesabı Sil</button>
        </div>
        ${CONFIG.PRIVACY_POLICY_URL || CONFIG.TERMS_OF_SERVICE_URL ? `
        <div class="settings-divider"></div>
        <div class="settings-links">
          ${CONFIG.PRIVACY_POLICY_URL ? `<a href="${escHtml(CONFIG.PRIVACY_POLICY_URL)}" target="_blank" rel="noopener noreferrer">Gizlilik Politikası</a>` : ""}
          ${CONFIG.TERMS_OF_SERVICE_URL ? `<a href="${escHtml(CONFIG.TERMS_OF_SERVICE_URL)}" target="_blank" rel="noopener noreferrer">Kullanım Koşulları</a>` : ""}
        </div>` : ""}
      </div>
    </div>`;

  document.getElementById("dark-mode-toggle")?.addEventListener("change", e => {
    store.setDarkMode(e.target.checked);
  });

  document.getElementById("change-location-btn")?.addEventListener("click", showLocationPicker);

  document.getElementById("logout-btn")?.addEventListener("click", async () => {
    const ok = await confirmDialog("Çıkış yapmak istediğinizden emin misiniz?");
    if (!ok) return;
    resetPhoneVerificationFlow();
    try {
      if (store.user?.sessionToken) await api.revokeSession(store.user.sessionToken);
    } catch {}
    store.setUser(null);
    renderApp();
    showToast("Çıkış yapıldı.", "info");
  });

  document.getElementById("delete-account-btn")?.addEventListener("click", showDeleteAccountModal);
  document.getElementById("add-shop-btn")?.addEventListener("click", showAddShopModal);
  document.getElementById("moderation-btn")?.addEventListener("click", showModerationModal);
  refreshCurrentUserForSettings(container);
}

// ===================== LOCATION PICKER ========================

function showLocationPicker() {
  const body = `
    <div class="field-row">
      <div class="field-group field-half">
        <label>İl</label>
        <select id="lp-city" class="location-picker-select">
          ${CITIES.map(c => `<option value="${escHtml(c)}" ${c === store.selectedCity ? "selected" : ""}>${escHtml(c)}</option>`).join("")}
        </select>
      </div>
      <div class="field-group field-half">
        <label>İlçe</label>
        <select id="lp-district" class="location-picker-select">
          ${(CITY_DISTRICT_DATA[store.selectedCity] || []).map(d => `<option value="${escHtml(d)}" ${d === store.selectedDistrict ? "selected" : ""}>${escHtml(d)}</option>`).join("")}
        </select>
      </div>
    </div>`;

  const modal = createModal("location-modal", "Konum Seç", body,
    `<button class="btn btn-primary" id="lp-confirm">Uygula</button>`);

  const citySelect = modal.querySelector("#lp-city");
  const districtSelect = modal.querySelector("#lp-district");

  citySelect.addEventListener("change", () => {
    const districts = CITY_DISTRICT_DATA[citySelect.value] || [];
    districtSelect.innerHTML = districts.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join("");
    districtSelect.value = districts[0] || "";
  });

  modal.querySelector("#lp-confirm").addEventListener("click", () => {
    store.setLocation(citySelect.value, districtSelect.value);
    closeModal("location-modal");
    homeState.shops = [];
    homeState._rankings = null;
    homeState._rankingsKey = null;
    shopsState.shops = [];
    shopsState.page = 0;
    shopsState.nextOffset = 0;
    shopsState.total = 0;
    renderCurrentTab();
    const locLabel = document.getElementById("location-label");
    if (locLabel) locLabel.textContent = `${store.selectedCity} / ${store.selectedDistrict}`;
  });
}

// ===================== SHOP DETAIL ========================

function renderShopDetailRatingHtml(shop) {
  const rating = shopRatingValue(shop);
  const reviewCount = shopReviewCount(shop);
  if (rating == null) return "";
  return `<div class="shop-detail-rating">
    ${starsHtml(rating)}
    <span class="rating-value-lg">${formatRating(rating)}</span>
    ${reviewCount > 0 ? `<span class="review-count">(${reviewCount} değerlendirme)</span>` : ""}
  </div>`;
}

async function showShopDetail(shopId) {
  const shop = findKnownShop(shopId);
  if (!shop) { showToast("Usta bulunamadı.", "error"); return; }

  const shopDetailOpenCount = incrementShopDetailAdOpenCount();
  if (shopDetailOpenCount >= getAdsenseShopDetailThreshold()) {
    ensureAdsenseScriptLoaded();
  }

  window._currentShop = shop;
  const modal = createModal("shop-detail-modal", "", renderShopDetailBody(shop, [], {}), "");
  modal.querySelector(".modal-header").style.display = "none";
  modal.querySelector(".modal-body").style.padding = "0";

  loadShopComments(shop, modal);
}

function renderShopDetailBody(shop, comments, votes) {
  const isLoggedIn = store.isLoggedIn;
  const phoneArg = escHtml(JSON.stringify(shop.phone || ""));
  const nameArg = escHtml(JSON.stringify(shop.name || ""));
  const shareArg = escHtml(JSON.stringify({
    id: shop.id || "",
    placeId: shop.placeId || "",
    name: shop.name || "",
    address: shop.address || "",
  }));

  return `
    <div class="shop-detail">
      <div class="shop-detail-header">
        <button class="back-btn" onclick="closeModal('shop-detail-modal')">← Geri</button>
        <div class="shop-detail-actions">
          <button class="icon-btn" onclick="shareShop(window._currentShop)" title="Paylaş">${uiIcon("share")}</button>
          <button class="fav-btn-lg ${store.isFavorite(shop.id) ? "fav-active" : ""}" data-fav-id="${escHtml(shop.id)}" title="Favori">
            ${uiIcon("heart")}
          </button>
        </div>
      </div>
      ${(() => { const url = shopPhotoUrl(shop, 800); return url
        ? `<div class="shop-detail-photo"><img src="${escHtml(url)}" alt="" loading="lazy" data-photo-fallback="shop-detail-photo-placeholder"></div>`
        : `<div class="shop-detail-photo shop-detail-photo-placeholder"></div>`; })()}
      <div class="shop-detail-body">
        <h1 class="shop-detail-name">${escHtml(shop.name)}</h1>
        <div class="shop-detail-meta">
          ${(() => {
            const labels = displayCategoryLabels(shop.categoryName).slice(0, 2);
            return labels.map((label, index) =>
              `<span class="shop-category-badge">${uiIcon(index === 0 ? "store" : "tag", "inline-icon")} ${escHtml(label)}</span>`
            ).join("");
          })()}
          ${shop.isOpenNow === true ? `<span class="badge badge-open">Açık</span>` : shop.isOpenNow === false ? `<span class="badge badge-closed">Kapalı</span>` : ""}
        </div>
        <div id="shop-detail-rating-slot">${renderShopDetailRatingHtml(shop)}</div>
        <p class="shop-detail-address">${uiIcon("pin", "inline-icon")} ${escHtml(shop.address)}</p>
        ${shop.phone ? `<div class="shop-detail-actions-row">
          <button class="btn btn-primary" onclick="openPhone(${phoneArg})">${uiIcon("phone", "inline-icon")} Ara</button>
          <button class="btn btn-secondary" onclick="openGoogleMaps(${Number(shop.latitude)}, ${Number(shop.longitude)}, ${nameArg})">${uiIcon("map", "inline-icon")} Yol Tarifi</button>
          <button class="btn btn-secondary" onclick="shareShop(${shareArg})">${uiIcon("share", "inline-icon")} Paylaş</button>
        </div>` : `<div class="shop-detail-actions-row">
          <button class="btn btn-secondary" onclick="openGoogleMaps(${Number(shop.latitude)}, ${Number(shop.longitude)}, ${nameArg})">${uiIcon("map", "inline-icon")} Yol Tarifi</button>
          <button class="btn btn-secondary" onclick="shareShop(${shareArg})">${uiIcon("share", "inline-icon")} Paylaş</button>
        </div>`}
        <div class="shop-detail-divider"></div>
        <div class="reviews-section">
          <div class="reviews-header">
            <h2>Değerlendirmeler <span id="shop-detail-review-count" class="review-count-inline"></span></h2>
            ${isLoggedIn ? `<button class="btn btn-primary btn-sm" id="add-review-btn">${uiIcon("edit", "inline-icon")} Yorum Ekle</button>` : ""}
          </div>
          <div id="comments-list">${loadingHtml("Yorumlar yükleniyor...")}</div>
        </div>
      </div>
    </div>`;
}

async function loadShopComments(shop, modal) {
  const commentsList = modal.querySelector("#comments-list");
  if (!commentsList) return;

  const isFavBtn = modal.querySelector(`.fav-btn-lg[data-fav-id="${shop.id}"]`);
  if (isFavBtn) {
    isFavBtn.addEventListener("click", () => {
      store.toggleFavorite(shop.id);
      isFavBtn.innerHTML = uiIcon("heart");
      isFavBtn.classList.toggle("fav-active", store.isFavorite(shop.id));
    });
  }

  try {
    const [comments, votes, details] = await Promise.all([
      api.fetchCommentsForShop(shopCommentThreadId(shop), store.user?.sessionToken),
      store.isLoggedIn ? api.fetchCommentVotes(store.user.sessionToken) : Promise.resolve({}),
      shop.placeId ? api.fetchPlaceDetails(shop.placeId).catch(() => null) : Promise.resolve(null),
    ]);

    store.setComments(comments);
    store.setCommentVotes(votes);

    if (details) {
      Object.assign(shop, {
        displayRating: details.displayRating ?? details.display_rating ?? details.appDisplayRating ?? details.app_display_rating ?? shop.displayRating,
        displayReviewCount: details.displayReviewCount ?? details.display_review_count ?? details.appReviewCount ?? details.app_review_count ?? shop.displayReviewCount,
        googleRating: details.googleRating ?? details.google_rating ?? details.rating ?? shop.googleRating,
        googleReviewCount: details.googleReviewCount ?? details.google_review_count ?? details.userRatingsTotal ?? details.user_ratings_total ?? shop.googleReviewCount,
        googleReviews: Array.isArray(details.googleReviews) ? details.googleReviews : (details.google_reviews || shop.googleReviews || []),
        appCommentAverage: details.appCommentAverage ?? details.app_comment_average ?? shop.appCommentAverage,
        appCommentCount: details.appCommentCount ?? details.app_comment_count ?? shop.appCommentCount,
        overallRating: details.overallRating ?? details.overall_rating ?? shop.overallRating ?? null,
        overallReviewCount: details.overallReviewCount ?? details.overall_review_count ?? shop.overallReviewCount ?? 0,
      });
    }

    const googleReviews = (details?.googleReviews || details?.google_reviews || shop.googleReviews || shop.google_reviews || [])
      .filter(r => r.text && r.text.trim());
    const hasApp = comments.length > 0;
    const hasGoogle = googleReviews.length > 0;
    const reviewCountSlot = modal.querySelector("#shop-detail-review-count");
    const ratingSlot = modal.querySelector("#shop-detail-rating-slot");
    if (ratingSlot) {
      ratingSlot.innerHTML = renderShopDetailRatingHtml(shop);
    }
    if (reviewCountSlot) {
      const reviewCount = shopReviewCount(shop);
      reviewCountSlot.textContent = reviewCount > 0 ? `(${reviewCount})` : "";
    }

    if (!hasApp && !hasGoogle) {
      commentsList.innerHTML = emptyStateHtml(uiIcon("edit", "empty-svg"), "Henüz yorum yok", "İlk yorumu sen bırak!");
    } else {
      const appHtml = hasApp
        ? `<div class="comments-section-title">Uygulama Yorumları</div>
           <div class="comments-container">
             ${comments.map(c => commentCardHtml(c, votes[c.id] || null, store.isLoggedIn)).join("")}
           </div>`
        : "";
      const googleHtml = hasGoogle
        ? `<div class="comments-section-title">Google Yorumları</div>
           <div class="comments-container">
             ${googleReviews.map(r => googleReviewCardHtml(r)).join("")}
           </div>`
        : "";
      commentsList.innerHTML = appHtml + googleHtml;
    }

    attachCommentListeners(modal, shop);
  } catch (err) {
    commentsList.innerHTML = `<div class="error-state">${uiIcon("warning", "inline-icon")} ${escHtml(err.message || "Yorumlar yüklenemedi.")}</div>`;
  }

  const addReviewBtn = modal.querySelector("#add-review-btn");
  addReviewBtn?.addEventListener("click", () => {
    if (!requireLoginForAction("Yorum yazmak icin giris yapin.")) return;
    showAddReviewModal(shop);
  });
}

function attachCommentListeners(container, shop) {
  container.querySelectorAll(".vote-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!store.isLoggedIn) { showToast("Oy vermek için giriş yapın.", "warn"); return; }
      const commentId = btn.dataset.commentId;
      const voteType = btn.dataset.vote;
      try {
        if (voteType === "helpful") await api.toggleHelpful(commentId, store.user.sessionToken);
        else await api.toggleUnhelpful(commentId, store.user.sessionToken);
        showToast("Oyunuz kaydedildi.", "success");
      } catch (err) {
        showToast(err.message || "Oy verilemedi.", "error");
      }
    });
  });

  container.querySelectorAll(".report-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!store.isLoggedIn) { showToast("Şikayet için giriş yapın.", "warn"); return; }
      const commentId = btn.dataset.commentId;
      showReportModal(commentId, shop.id);
    });
  });
}

// ===================== ADD REVIEW MODAL ========================

function showAddReviewModal(shop) {
  const turnstileSlotId = createTurnstileSlotId("review");
  const body = `
    <form id="add-review-form">
      <div class="review-form-card">
        <h3>Fiyat</h3>
        <div class="star-input choice-input" id="price-stars" data-name="priceRating">
          ${[
            [5, "Uygun"],
            [4, "Makul"],
            [2, "Pahali"],
            [1, "Cok pahali"],
          ].map(([value, label]) => `<button type="button" class="star-btn choice-btn" data-val="${value}">${label}</button>`).join("")}
        </div>
        <input type="hidden" name="priceRating" value="0">
      </div>
      <div class="review-form-card">
        <h3>Memnuniyet</h3>
        <div class="star-input choice-input" id="satisfaction-stars" data-name="satisfactionRating">
          ${[1, 2, 3, 4, 5].map(i => `<button type="button" class="star-btn choice-btn" data-val="${i}">${i}*</button>`).join("")}
        </div>
        <input type="hidden" name="satisfactionRating" value="0">
      </div>
      <div class="review-form-card">
        <textarea name="text" rows="4" placeholder="Deneyiminizi paylasin..." required></textarea>
      </div>
      <div class="review-form-card proof-card">
        <button type="button" class="btn btn-secondary btn-full" id="proof-verify-btn">Yorumu dogrula</button>
        <p>E-fis (istege bagli)</p>
      </div>
      ${turnstileMarkup(turnstileSlotId)}
      <div id="review-error" class="auth-error hidden"></div>
    </form>`;

  const modal = createModal("add-review-modal", "Degerlendir", body,
    `<button class="btn btn-primary btn-full" id="submit-review-btn">Yorumu gonder</button>`);

  setupStarInputs(modal);
  ensureTurnstileMounted(modal.querySelector(`#${turnstileSlotId}`));
  modal.querySelector("#proof-verify-btn")?.addEventListener("click", () => showProofVerificationModal());

  modal.querySelector("#submit-review-btn").addEventListener("click", async () => {
    const form = modal.querySelector("#add-review-form");
    const errEl = modal.querySelector("#review-error");
    const turnstileSlot = modal.querySelector(`#${turnstileSlotId}`);
    const textValue = form.text.value.trim();
    const priceRating = parseInt(form.priceRating.value, 10) || 0;
    const satisfactionRating = parseInt(form.satisfactionRating.value, 10) || 0;

    if (!textValue) {
      errEl.textContent = "Yorum metni gereklidir.";
      errEl.classList.remove("hidden");
      return;
    }
    if (priceRating < 1 || satisfactionRating < 1) {
      errEl.textContent = "Lutfen her iki puani da verin.";
      errEl.classList.remove("hidden");
      return;
    }

    const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
    if (captchaToken == null) return;

    const btn = modal.querySelector("#submit-review-btn");
    btn.disabled = true;
    btn.textContent = "Gonderiliyor...";
    errEl.classList.add("hidden");

    try {
      await api.addComment({
        shopId: shopCommentThreadId(shop),
        text: textValue,
        priceRating,
        satisfactionRating,
        sessionToken: store.user.sessionToken,
        captchaToken,
      });
      closeModal("add-review-modal");
      showToast("Yorumunuz gonderildi!", "success");
    } catch (err) {
      errEl.textContent = err.message || "Yorum gonderilemedi.";
      errEl.classList.remove("hidden");
      resetTurnstile(turnstileSlot);
      btn.disabled = false;
      btn.textContent = "Yorumu gonder";
    }
  });
}

function showProofVerificationModal() {
  const turnstileSlotId = createTurnstileSlotId("proof");
  const body = `
    <div class="proof-flow">
      <h1>Belge dogrulama</h1>
      <div class="review-form-card">
        <h3>Fis ve belge yukleme</h3>
        <div class="choice-input">
          <button class="choice-btn" type="button">Belgesiz</button>
          <button class="choice-btn star-active" type="button">e-Arsiv / e-Fatura</button>
          <button class="choice-btn" type="button">Fis / OKC</button>
        </div>
      </div>
      <div class="review-form-card">
        <h3>Belge tipi</h3>
        <div class="choice-input">
          <button class="choice-btn star-active" type="button">e-Arsiv</button>
          <button class="choice-btn" type="button">e-Fatura</button>
        </div>
      </div>
      <div class="review-form-card">
        <h3>Doldurma yontemi</h3>
        <div class="choice-input">
          <button class="choice-btn star-active" type="button">Belgeden doldur</button>
          <button class="choice-btn" type="button">Elle gir</button>
        </div>
        <button class="btn btn-secondary btn-full" type="button">PDF veya gorsel sec</button>
      </div>
      ${turnstileMarkup(turnstileSlotId)}
      <div id="proof-error" class="auth-error hidden"></div>
      <p class="modal-subtitle">Web surumunde belge akisi hazirlaniyor. Bu dogrulama adimi sunucu tarafli yukleme icin hazir tutulur.</p>
    </div>`;

  const modal = createModal("proof-verification-modal", "Belge dogrulama", body,
    `<button class="btn btn-primary btn-full" id="proof-confirm-btn">Dogrula</button>`);

  ensureTurnstileMounted(modal.querySelector(`#${turnstileSlotId}`));
  modal.querySelector("#proof-confirm-btn").addEventListener("click", () => {
    const errEl = modal.querySelector("#proof-error");
    const turnstileSlot = modal.querySelector(`#${turnstileSlotId}`);
    const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
    if (captchaToken == null) return;
    closeModal("proof-verification-modal");
    showToast("Belge dogrulama adimi onaylandi.", "success");
  });
}

function setupStarInputs(container) {
  container.querySelectorAll(".star-input").forEach(starEl => {
    const fieldName = starEl.dataset.name;
    const hidden = starEl.closest("form").querySelector(`[name="${fieldName}"]`);
    let selected = 0;

    const buttons = starEl.querySelectorAll(".star-btn");
    function updateStars(val) {
      const isChoice = starEl.classList.contains("choice-input");
      buttons.forEach(b => {
        const btnValue = parseInt(b.dataset.val);
        b.classList.toggle("star-active", isChoice ? btnValue === val : btnValue <= val);
      });
    }

    buttons.forEach(btn => {
      if (!starEl.classList.contains("choice-input")) {
        btn.addEventListener("mouseenter", () => updateStars(parseInt(btn.dataset.val)));
        btn.addEventListener("mouseleave", () => updateStars(selected));
      }
      btn.addEventListener("click", () => {
        selected = parseInt(btn.dataset.val);
        hidden.value = selected;
        updateStars(selected);
      });
    });
  });
}

// ===================== REPORT MODAL ========================

function showReportModal(commentId, shopId) {
  const turnstileSlotId = createTurnstileSlotId("report");
  const body = `
    <p>Bu yorumu neden sikayet ediyorsunuz?</p>
    <div class="report-options">
      ${REPORT_REASONS.map(r => `<label class="radio-label">
        <input type="radio" name="reason" value="${r.key}"> ${escHtml(r.label)}
      </label>`).join("")}
    </div>
    ${turnstileMarkup(turnstileSlotId)}
    <div id="report-error" class="auth-error hidden"></div>`;

  const modal = createModal("report-modal", "Yorumu Sikayet Et", body,
    `<button class="btn btn-secondary" onclick="closeModal('report-modal')">Iptal</button>
     <button class="btn btn-primary" id="submit-report-btn">Gonder</button>`);

  ensureTurnstileMounted(modal.querySelector(`#${turnstileSlotId}`));
  modal.querySelector("#submit-report-btn").addEventListener("click", async () => {
    const selected = modal.querySelector("[name=reason]:checked");
    const errEl = modal.querySelector("#report-error");
    const turnstileSlot = modal.querySelector(`#${turnstileSlotId}`);
    if (!selected) {
      errEl.textContent = "Bir neden secin.";
      errEl.classList.remove("hidden");
      return;
    }

    const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
    if (captchaToken == null) return;

    const btn = modal.querySelector("#submit-report-btn");
    btn.disabled = true;
    btn.textContent = "Gonderiliyor...";

    try {
      await api.reportComment({
        commentId,
        shopId,
        reason: selected.value,
        sessionToken: store.user.sessionToken,
        captchaToken,
      });
      closeModal("report-modal");
      showToast("Sikayetiniz alindi.", "success");
    } catch (err) {
      errEl.textContent = err.message || "Sikayet gonderilemedi.";
      errEl.classList.remove("hidden");
      resetTurnstile(turnstileSlot);
      btn.disabled = false;
      btn.textContent = "Gonder";
    }
  });
}

// ===================== ADD SHOP MODAL ========================

function showAddShopModal() {
  const turnstileSlotId = createTurnstileSlotId("shop-request");
  const body = `
    <form id="add-shop-form">
      <div class="field-group">
        <label>Isletme adi</label>
        <input type="text" name="shopName" placeholder="Isletme adi" required>
      </div>
      <div class="field-group">
        <label>Adres</label>
        <input type="text" name="address" placeholder="Acik adres" required>
      </div>
      <div class="field-group">
        <label>Telefon</label>
        <input type="tel" name="phone" placeholder="05XX XXX XX XX" inputmode="tel" maxlength="17" pattern="^(\\+?90 ?)?0?5[0-9 ]{9,}$">
      </div>
      <div class="field-group">
        <label>Kategori</label>
        <select name="category" required>
          ${DISCOVERY_CATEGORIES.filter(category => category.key !== "All").map(category => `<option value="${category.key}">${escHtml(category.label)}</option>`).join("")}
        </select>
      </div>
      ${turnstileMarkup(turnstileSlotId)}
      <div id="add-shop-error" class="auth-error hidden"></div>
    </form>`;

  const modal = createModal("add-shop-modal", "Isletme ekle", body,
    `<button class="btn btn-secondary" onclick="closeModal('add-shop-modal')">Iptal</button>
     <button class="btn btn-primary" id="submit-shop-btn">Ekle</button>`);

  ensureTurnstileMounted(modal.querySelector(`#${turnstileSlotId}`));
  modal.querySelector("#submit-shop-btn").addEventListener("click", async () => {
    const form = modal.querySelector("#add-shop-form");
    const errEl = modal.querySelector("#add-shop-error");
    const turnstileSlot = modal.querySelector(`#${turnstileSlotId}`);
    const shopName = form.shopName.value.trim();
    const address = form.address.value.trim();
    const phone = normalizeTurkishPhone(form.phone.value);
    const category = form.category.value;

    if (!shopName || !address) {
      errEl.textContent = "Ad ve adres zorunludur.";
      errEl.classList.remove("hidden");
      return;
    }
    if (phone && !isValidTurkishPhone(phone)) {
      errEl.textContent = "Telefon numarası 05XX XXX XX XX formatında olmalı.";
      errEl.classList.remove("hidden");
      return;
    }

    const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
    if (captchaToken == null) return;

    const btn = modal.querySelector("#submit-shop-btn");
    btn.disabled = true;
    btn.textContent = "Ekleniyor...";

    try {
      await api.submitShopRequest({
        sessionToken: store.user.sessionToken,
        shopName,
        shopAddress: address,
        shopPhone: phone,
        shopCategoryName: categoryLabel(category),
        captchaToken,
      });
      closeModal("add-shop-modal");
      showToast("Isletme ekleme talebiniz alindi!", "success");
    } catch (err) {
      errEl.textContent = err.message || "Isletme eklenemedi.";
      errEl.classList.remove("hidden");
      resetTurnstile(turnstileSlot);
      btn.disabled = false;
      btn.textContent = "Ekle";
    }
  });
}

// ===================== DELETE ACCOUNT MODAL ========================

function showDeleteAccountModal() {
  const turnstileSlotId = createTurnstileSlotId("delete-account");
  const body = `
    <p class="text-warn">${uiIcon("warning", "inline-icon")} Bu islem geri alinamaz. Hesabiniz silinecek.</p>
    <div class="field-group">
      <label>Sifre</label>
      <input type="password" id="del-password" placeholder="Sifrenizi girin">
    </div>
    <div class="field-group">
      <label>Neden silmek istiyorsunuz?</label>
      <textarea id="del-reason" rows="3" placeholder="Nedeninizi yazin..."></textarea>
    </div>
    ${turnstileMarkup(turnstileSlotId)}
    <div id="del-error" class="auth-error hidden"></div>`;

  const modal = createModal("delete-account-modal", "Hesabi sil", body,
    `<button class="btn btn-secondary" onclick="closeModal('delete-account-modal')">Iptal</button>
     <button class="btn btn-danger" id="confirm-delete-btn">Hesabi sil</button>`);

  ensureTurnstileMounted(modal.querySelector(`#${turnstileSlotId}`));
  modal.querySelector("#confirm-delete-btn").addEventListener("click", async () => {
    const password = modal.querySelector("#del-password").value;
    const reason = modal.querySelector("#del-reason").value.trim();
    const errEl = modal.querySelector("#del-error");
    const turnstileSlot = modal.querySelector(`#${turnstileSlotId}`);

    if (!password) {
      errEl.textContent = "Sifre gereklidir.";
      errEl.classList.remove("hidden");
      return;
    }

    const captchaToken = requireTurnstileToken(turnstileSlot, errEl);
    if (captchaToken == null) return;

    const btn = modal.querySelector("#confirm-delete-btn");
    btn.disabled = true;
    btn.textContent = "Isleniyor...";

    try {
      await api.requestAccountDeletion({
        sessionToken: store.user.sessionToken,
        password,
        reason,
        captchaToken,
      });
      closeModal("delete-account-modal");
      showToast("Hesap silme talebiniz alindi.", "info");
    } catch (err) {
      errEl.textContent = err.message || "Islem basarisiz.";
      errEl.classList.remove("hidden");
      resetTurnstile(turnstileSlot);
      btn.disabled = false;
      btn.textContent = "Hesabi sil";
    }
  });
}

// ===================== MODERATION MODAL ========================

async function showModerationModal() {
  const modal = createModal("moderation-modal", "Moderasyon Merkezi",
    loadingHtml("Kuyruk yükleniyor..."), "");

  try {
    const [data, commentsResult] = await Promise.all([
      api.getModerationQueue(store.user.sessionToken),
      api.fetchAllComments(store.user.sessionToken)
        .then(comments => ({ ok: true, comments }))
        .catch(err => ({ ok: false, error: err })),
    ]);

    const timeValue = item => {
      const raw = item?.timestamp ?? item?.createdAt ?? item?.created_at ?? item?.submittedAt ?? item?.submitted_at ?? item?.requestedAt ?? item?.requested_at ?? item?.reportedAt ?? item?.reported_at;
      if (typeof raw === "number") return raw > 10000000000 ? raw : raw * 1000;
      if (!raw) return 0;
      const parsed = new Date(raw).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const newestFirst = (a, b) => timeValue(b) - timeValue(a);

    let proofReviews = [...(data.proofReviews || [])].sort(newestFirst);
    let reports = [...(data.commentReports || [])].sort(newestFirst);
    let deletions = [...(data.accountDeletionRequests || [])].sort(newestFirst);
    let shopRequests = [...(data.shopRequests || [])].sort(newestFirst);
    const latestComments = commentsResult.ok
      ? [...commentsResult.comments].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      : [];
    const commentsError = commentsResult.ok ? "" : (commentsResult.error?.message || "Yorumlar yüklenemedi.");

    const body = modal.querySelector(".modal-body");
    let activeKey = "comments";

    const tabs = () => [
      { key: "comments", label: "Son Yorumlar", count: latestComments.length, icon: "edit" },
      { key: "proof", label: "Belge İnceleme", count: proofReviews.length, icon: "shield" },
      { key: "reports", label: "Yorum Şikayetleri", count: reports.length, icon: "flag" },
      { key: "shops", label: "Dükkan Talepleri", count: shopRequests.length, icon: "store" },
      { key: "deletions", label: "Hesap Silme", count: deletions.length, icon: "trash" },
    ];

    const renderTabs = () => `<div class="mod-tabs">
      ${tabs().map(tab => `<button class="mod-tab-btn${tab.key === activeKey ? " mod-tab-active" : ""}" type="button" data-mod-tab="${escHtml(tab.key)}">
        <span>${uiIcon(tab.icon, "inline-icon")} ${escHtml(tab.label)}</span>
        <strong>${escHtml(tab.count)}</strong>
      </button>`).join("")}
    </div>`;

    const timeMeta = timestamp => {
      if (!timestamp) return "";
      const exact = new Date(timestamp).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
      return `<span>${escHtml(timeAgo(timestamp))} - ${escHtml(exact)}</span>`;
    };

    const commentShopLabel = comment => {
      const shopId = String(comment.shopId || "").trim();
      const knownShop = shopId
        ? store.shops.find(s => String(s.id || "") === shopId || String(s.placeId || "") === shopId)
        : null;
      return comment.shopName || knownShop?.name || shopId || "-";
    };

    const renderComments = () => {
      if (commentsError) return `<div class="error-state">${uiIcon("warning", "inline-icon")} ${escHtml(commentsError)}</div>`;
      if (!latestComments.length) return `<p class="empty-msg">Henüz yorum yok.</p>`;
      return latestComments.map(comment => {
        const rating = commentRatingValue(comment);
        return `<div class="mod-item mod-comment-item">
          <div class="mod-item-head">
            <strong>@${escHtml(comment.username || "Anonim")}</strong>
            <span>${timeMeta(comment.timestamp)}</span>
          </div>
          <p><strong>Dükkan:</strong> ${escHtml(commentShopLabel(comment))}</p>
          ${rating != null ? `<p><strong>Puan:</strong> ${escHtml(formatRating(rating))}/5</p>` : ""}
          <p class="mod-comment-text">${escHtml(comment.text || "")}</p>
          <div class="mod-actions">
            <button class="btn btn-sm btn-danger" data-mod-comment-delete="${escHtml(comment.id)}">Yorumu Sil</button>
          </div>
        </div>`;
      }).join("");
    };

    const renderProofReviews = () => !proofReviews.length ? `<p class="empty-msg">Bekleyen belge incelemesi yok.</p>` :
      proofReviews.map(p => {
        const id = p.reviewId || p.commentId || p.id;
        return `<div class="mod-item">
          <p><strong>Belge:</strong> ${escHtml(p.documentType === "official_invoice" ? "e-Arşiv / fatura" : "Fiş")}</p>
          <p><strong>Yorum:</strong> ${escHtml(p.commentBody || "")}</p>
          <p><strong>Yazar:</strong> @${escHtml(p.authorName || "")}</p>
          <p><strong>Dosya:</strong> ${escHtml(p.proofFileName || p.proofMimeType || "-")}</p>
          ${timeMeta(timeValue(p)) ? `<p><strong>Tarih:</strong> ${timeMeta(timeValue(p))}</p>` : ""}
          ${p.documentValidationStatus ? `<p><strong>Durum:</strong> ${escHtml(p.documentValidationStatus)}</p>` : ""}
          ${p.documentValidationDetail ? `<p><strong>Detay:</strong> ${escHtml(p.documentValidationDetail)}</p>` : ""}
          ${p.proofUrl ? `<p><a href="${escHtml(p.proofUrl)}" target="_blank" rel="noopener noreferrer">Belgeyi aç</a></p>` : ""}
          <div class="mod-actions">
            <button class="btn btn-sm btn-secondary" data-mod-proof="${escHtml(id)}" data-decision="approve">Onayla</button>
            <button class="btn btn-sm btn-danger" data-mod-proof="${escHtml(id)}" data-decision="reject">Reddet</button>
          </div>
        </div>`;
      }).join("");

    const renderReports = () => !reports.length ? `<p class="empty-msg">Bekleyen şikayet yok.</p>` :
      reports.map(r => {
        const id = r.reportId || r.id;
        return `<div class="mod-item">
          <p><strong>Yorum:</strong> ${escHtml(r.commentBody || r.commentText || r.comment_text || "")}</p>
          <p><strong>Neden:</strong> ${escHtml(r.reasonText || r.reasonCode || r.reason || "")}</p>
          <p><strong>Yazar:</strong> @${escHtml(r.authorName || "")}</p>
          <p><strong>Bildirim:</strong> ${escHtml(r.reportCount || 1)} adet</p>
          ${timeMeta(timeValue(r)) ? `<p><strong>Tarih:</strong> ${timeMeta(timeValue(r))}</p>` : ""}
          <div class="mod-actions">
            <button class="btn btn-sm btn-danger" data-mod-report="${escHtml(id)}" data-decision="hide">Yorumu Gizle</button>
            <button class="btn btn-sm btn-secondary" data-mod-report="${escHtml(id)}" data-decision="dismiss">Bildirimi Reddet</button>
          </div>
        </div>`;
      }).join("");

    const renderShopRequests = () => !shopRequests.length ? `<p class="empty-msg">Bekleyen dükkan talebi yok.</p>` :
      shopRequests.map(s => {
        const id = s.requestId || s.id;
        return `<div class="mod-item">
          <p><strong>Dükkan:</strong> ${escHtml(s.name || "")}</p>
          <p><strong>Kategori:</strong> ${escHtml(categoryLabel(s.categoryName || ""))}</p>
          <p><strong>Adres:</strong> ${escHtml(s.address || "")}</p>
          <p><strong>Telefon:</strong> ${escHtml(s.phone || "")}</p>
          <p><strong>Konum:</strong> ${escHtml([s.city, s.district].filter(Boolean).join(" / "))}</p>
          <p><strong>Talep Eden:</strong> @${escHtml(s.requesterUsername || "")}</p>
          ${timeMeta(timeValue(s)) ? `<p><strong>Tarih:</strong> ${timeMeta(timeValue(s))}</p>` : ""}
          ${s.photoUrl || s.photoUri ? `<p><a href="${escHtml(s.photoUrl || s.photoUri)}" target="_blank" rel="noopener noreferrer">Fotoğrafı aç</a></p>` : ""}
          <div class="mod-actions">
            <button class="btn btn-sm btn-secondary" data-mod-shop="${escHtml(id)}" data-decision="approve">Onayla</button>
            <button class="btn btn-sm btn-danger" data-mod-shop="${escHtml(id)}" data-decision="reject">Reddet</button>
          </div>
        </div>`;
      }).join("");

    const renderDeletions = () => !deletions.length ? `<p class="empty-msg">Bekleyen talep yok.</p>` :
      deletions.map(d => {
        const id = d.requestId || d.id;
        return `<div class="mod-item">
          <p><strong>Kullanıcı:</strong> @${escHtml(d.username || "")}</p>
          <p><strong>Neden:</strong> ${escHtml(d.reason || "")}</p>
          ${timeMeta(timeValue(d)) ? `<p><strong>Tarih:</strong> ${timeMeta(timeValue(d))}</p>` : ""}
          <div class="mod-actions">
            <button class="btn btn-sm btn-secondary" data-mod-deletion="${escHtml(id)}" data-decision="approve">Onayla</button>
            <button class="btn btn-sm btn-danger" data-mod-deletion="${escHtml(id)}" data-decision="reject">Reddet</button>
          </div>
        </div>`;
      }).join("");

    const pageContent = () => {
      if (activeKey === "proof") return { title: "Belge İnceleme", html: renderProofReviews() };
      if (activeKey === "reports") return { title: "Yorum Şikayetleri", html: renderReports() };
      if (activeKey === "shops") return { title: "Dükkan Talepleri", html: renderShopRequests() };
      if (activeKey === "deletions") return { title: "Hesap Silme Talepleri", html: renderDeletions() };
      return { title: "Son Yorumlar", html: renderComments() };
    };

    const runModerationAction = async (btn, request, onDone) => {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "İşleniyor...";
      try {
        await request();
        onDone();
        showToast("İşlem tamamlandı.", "success");
        renderPage(activeKey);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = originalText;
        showToast(err.message || "İşlem tamamlanamadı.", "error");
      }
    };

    const attachModerationListeners = () => {
      body.querySelectorAll("[data-mod-tab]").forEach(btn => {
        btn.addEventListener("click", () => renderPage(btn.dataset.modTab));
      });

      body.querySelectorAll("[data-mod-proof]").forEach(btn => {
        btn.addEventListener("click", () => runModerationAction(btn,
          () => api.moderateProofReview({ reviewId: btn.dataset.modProof, decision: btn.dataset.decision, sessionToken: store.user.sessionToken }),
          () => { proofReviews = proofReviews.filter(p => String(p.reviewId || p.commentId || p.id) !== btn.dataset.modProof); }
        ));
      });

      body.querySelectorAll("[data-mod-report]").forEach(btn => {
        btn.addEventListener("click", () => runModerationAction(btn,
          () => api.moderateCommentReport({ reportId: btn.dataset.modReport, decision: btn.dataset.decision, sessionToken: store.user.sessionToken }),
          () => { reports = reports.filter(r => String(r.reportId || r.id) !== btn.dataset.modReport); }
        ));
      });

      body.querySelectorAll("[data-mod-comment-delete]").forEach(btn => {
        btn.addEventListener("click", () => runModerationAction(btn,
          () => api.deleteCommentAsModerator({ commentId: btn.dataset.modCommentDelete, sessionToken: store.user.sessionToken }),
          () => {
            const deletedId = btn.dataset.modCommentDelete;
            for (let i = latestComments.length - 1; i >= 0; i -= 1) {
              if (String(latestComments[i]?.id) === deletedId) latestComments.splice(i, 1);
            }
            reports = reports.filter(r => {
              const reportCommentId = r.commentId || r.comment_id || r.targetCommentId || r.target_comment_id;
              return String(reportCommentId || "") !== deletedId;
            });
          }
        ));
      });

      body.querySelectorAll("[data-mod-deletion]").forEach(btn => {
        btn.addEventListener("click", () => runModerationAction(btn,
          () => api.moderateAccountDeletion({ requestId: btn.dataset.modDeletion, decision: btn.dataset.decision, sessionToken: store.user.sessionToken }),
          () => { deletions = deletions.filter(d => String(d.requestId || d.id) !== btn.dataset.modDeletion); }
        ));
      });

      body.querySelectorAll("[data-mod-shop]").forEach(btn => {
        btn.addEventListener("click", () => runModerationAction(btn,
          () => api.moderateShopRequest({ requestId: btn.dataset.modShop, decision: btn.dataset.decision, sessionToken: store.user.sessionToken }),
          () => { shopRequests = shopRequests.filter(s => String(s.requestId || s.id) !== btn.dataset.modShop); }
        ));
      });
    };

    function renderPage(nextKey = activeKey) {
      activeKey = nextKey;
      const page = pageContent();
      body.innerHTML = `
        ${renderTabs()}
        <div class="mod-page">
          <div class="mod-page-title">
            <h3>${escHtml(page.title)}</h3>
          </div>
          <div class="mod-section">${page.html}</div>
        </div>`;
      attachModerationListeners();
    }

    renderPage();
  } catch (err) {
    modal.querySelector(".modal-body").innerHTML = `<div class="error-state">${uiIcon("warning", "inline-icon")} ${escHtml(err.message)}</div>`;
  }
}

// ===================== SHOP CARD LISTENERS ========================

function attachShopCardListeners(container) {
  container.querySelectorAll(".shop-card").forEach(card => {
    const shopId = card.dataset.shopId;
    card.addEventListener("click", e => {
      if (e.target.closest(".fav-btn")) return;
      showShopDetail(shopId);
    });
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showShopDetail(shopId); }
    });
  });

  container.querySelectorAll(".fav-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.favId;
      store.toggleFavorite(id);
      btn.innerHTML = uiIcon("heart");
      btn.classList.toggle("fav-active", store.isFavorite(id));
    });
  });
}




