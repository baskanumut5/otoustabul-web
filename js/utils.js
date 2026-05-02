// ============================================================
// UstaBul Web - Yardımcı Fonksiyonlar
// ============================================================

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length <= 12) {
    return `+90 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`.trim();
  }
  if (digits.startsWith("0") && digits.length <= 11) {
    return `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`.trim();
  }
  return raw;
}

function normalizeTurkishPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  return digits;
}

function isValidTurkishPhone(raw) {
  return /^05\d{9}$/.test(normalizeTurkishPhone(raw));
}

function timeAgo(timestampMs) {
  const diff = Date.now() - timestampMs;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  return `${Math.floor(months / 12)} yıl önce`;
}

function formatRating(val, decimals = 1) {
  if (val == null || isNaN(val)) return "—";
  return Number(val).toFixed(decimals);
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function firstNonNegativeNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 0) return num;
  }
  return null;
}

function clampRatingValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(5, Math.max(1, num));
}

function shopRatingMetrics(shop) {
  const rating = clampRatingValue(firstPositiveNumber(
    shop?.displayRating,
    shop?.display_rating,
    shop?.appDisplayRating,
    shop?.app_display_rating,
    shop?.backendRating,
    shop?.backend_rating,
    shop?.calculatedRating,
    shop?.calculated_rating
  ));
  const reviewCount = Math.max(0, Math.floor(Number(firstNonNegativeNumber(
    shop?.displayReviewCount,
    shop?.display_review_count,
    shop?.appReviewCount,
    shop?.app_review_count,
    shop?.appCommentCount,
    shop?.app_comment_count
  ) || 0)));
  return { rating, reviewCount };
}

function shopRatingValue(shop) {
  return shopRatingMetrics(shop).rating;
}

function shopReviewCount(shop) {
  return Math.max(0, Math.floor(Number(shopRatingMetrics(shop).reviewCount || 0)));
}

function commentRatingValue(comment) {
  const price = clampRatingValue(comment?.priceRating ?? comment?.price_rating);
  const satisfaction = clampRatingValue(comment?.satisfactionRating ?? comment?.satisfaction_rating);
  if (price != null && satisfaction != null) return (price + satisfaction) / 2;
  if (price != null || satisfaction != null) return price ?? satisfaction;

  return clampRatingValue(firstPositiveNumber(
    comment?.rating,
    comment?.starRating,
    comment?.star_rating,
    comment?.averageRating,
    comment?.average_rating
  ));
}

function starsHtml(rating, max = 5) {
  const pct = Math.max(0, Math.min(max, rating || 0)) / max * 100;
  return `<span class="stars" title="${formatRating(rating)}">
    <span class="stars-filled" style="width:${pct}%">★★★★★</span>
    <span class="stars-empty">★★★★★</span>
  </span>`;
}

function categoryLabel(key) {
  const labels = displayCategoryLabels(key);
  return labels.length ? labels.join(", ") : key;
}

function categoryIcon(key) {
  const primaryLabel = displayCategoryLabels(key)[0];
  if (primaryLabel) return findCategory(primaryLabel)?.icon || "UB";
  const primaryValue = primaryCategoryValue(key);
  return findCategory(primaryValue)?.icon || "UB";
}

function categoryKey(value, fallback = "") {
  return resolveCategoryKey(value) || fallback;
}

function displayCategoryLabels(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const seen = new Set();
  return raw
    .split(",")
    .map(part => String(part || "").trim())
    .filter(Boolean)
    .filter(part => !HIDDEN_DISPLAY_CATEGORY_NORMALIZED_LABELS.has(normalizeText(part)))
    .map(part => {
      const category = findCategory(part);
      if (category && NON_SELECTABLE_CATEGORY_KEYS.has(category.key)) return "";
      return category?.label || part;
    })
    .filter(label => {
      const normalized = normalizeText(label);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function primaryCategoryValue(value) {
  return String(value || "")
    .split(",")
    .map(part => String(part || "").trim())
    .find(Boolean) || "";
}

function normalizePhotoReferences(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizePhotoReferences(parsed);
    } catch {}
  }
  return raw.split(",").map(v => v.trim()).filter(Boolean);
}

function findCategory(value) {
  const key = resolveCategoryKey(value);
  if (!key) return null;
  return CATEGORIES.find(category => category.key === key) || null;
}

function resolveCategoryKey(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const legacyKey = LEGACY_CATEGORY_KEY_MAP[normalized];
  if (legacyKey) return legacyKey;

  const exactMatch = CATEGORIES.find(category =>
    normalizeText(category.key) === normalized ||
    normalizeText(category.label) === normalized
  );
  if (exactMatch) return exactMatch.key;

  const fuzzyMatch = CATEGORIES.find(category =>
    normalized.includes(normalizeText(category.label)) ||
    normalizeText(category.label).includes(normalized)
  );
  return fuzzyMatch?.key || "";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ");
}

const LEGACY_CATEGORY_KEY_MAP = {
  "rotbalans": "Lastik",
  "rot & balans servisi": "Lastik",
  "rot balans servisi": "Lastik",
  "rot balans": "Lastik",
  "lastikci": "Lastik",
  "lastik rot balans servisi": "Lastik",
  "yedekparca": "YedekParca",
  "yedek parca": "YedekParca",
  "yedek parca / aksesuar": "YedekParca",
  "yedek parca aksesuar": "YedekParca",
};

const HIDDEN_DISPLAY_CATEGORY_NORMALIZED_LABELS = new Set([
  "AracElektronik",
  "YolYardim",
  "AracTestKontrol",
  "FiloKiralama",
  "TransferSirketi",
  "Sunroof",
  "Mekanik",
  "OtoBakim",
  "SesSistemi",
  "Ses Sistemi / Multimedya",
  "Oto Bakım",
].map(normalizeText));

function normalizedPhotoWidth(maxWidth = 400) {
  return Math.max(80, Math.min(1200, Math.round(Number(maxWidth) || 400)));
}

function backendPhotoProxyBaseUrl() {
  return String(CONFIG?.API_BASE_URL || CONFIG?.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function backendPhotoProxyUrl(params, maxWidth = 400) {
  const baseUrl = backendPhotoProxyBaseUrl();
  if (!baseUrl) return null;
  const url = new URL(`${baseUrl}/functions/v1/app-shop-catalog/photo`);
  url.searchParams.set("maxwidth", String(normalizedPhotoWidth(maxWidth)));
  Object.entries(params || {}).forEach(([key, value]) => {
    const normalizedValue = String(value || "").trim();
    if (normalizedValue) url.searchParams.set(key, normalizedValue);
  });
  return url.toString();
}

function proxiedBackendPhotoUrl(rawUrl, maxWidth = 400) {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const isBackendPhotoFunction =
      url.pathname.includes("/functions/v1/app-shop-photo") ||
      url.pathname.includes("/functions/v1/app-shop-catalog/photo");
    if (!isBackendPhotoFunction) return value;
    const photoReference = url.searchParams.get("ref") ||
      url.searchParams.get("photo_reference");
    const placeId = url.searchParams.get("placeId") ||
      url.searchParams.get("place_id");
    if (photoReference) {
      return backendPhotoProxyUrl({ ref: photoReference }, maxWidth);
    }
    if (placeId) {
      return backendPhotoProxyUrl({ placeId }, maxWidth);
    }
  } catch {}
  return value;
}

function googlePhotoUrl(photoReference, maxWidth = 400) {
  const ref = String(photoReference || "").trim();
  if (!ref) return null;
  return backendPhotoProxyUrl({ ref }, maxWidth);
}

function shopPhotoUrl(shop, maxWidth = 400) {
  const exteriorUrl = proxiedBackendPhotoUrl(shop.exteriorPhotoUrl, maxWidth);
  if (exteriorUrl) return exteriorUrl;
  const ref = normalizePhotoReferences(shop.photoReferences)[0];
  if (ref) return googlePhotoUrl(ref, maxWidth);
  if (shop.placeId) return backendPhotoProxyUrl({ placeId: shop.placeId }, maxWidth);
  return null;
}

function shopCommentThreadId(shop) {
  if (shop.placeId?.trim()) return shop.placeId.trim();
  const norm = s => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `${norm(shop.name)}|${norm(shop.address)}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  setTimeout(() => {
    el.classList.remove("toast-visible");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function openGoogleMaps(lat, lng, name) {
  const q = encodeURIComponent(name ? `${name} ${lat},${lng}` : `${lat},${lng}`);
  const win = window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  if (win) win.opener = null;
}

function openPhone(phone) {
  window.open(`tel:${phone.replace(/\s/g, "")}`, "_self");
}

function shareShop(shop) {
  if (!shop?.name) {
    showToast("Paylaşılacak usta bilgisi bulunamadı.", "warn");
    return;
  }
  const text = `${shop.name} - ${shop.address}`;
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: shop.name, text, url });
  } else {
    navigator.clipboard?.writeText(`${text}\n${url}`);
    showToast("Bağlantı kopyalandı!", "success");
  }
}
