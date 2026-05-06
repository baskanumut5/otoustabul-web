const ALLOWED_PREFIXES = ["/functions/v1/", "/rest/v1/"];
const SHOP_CATALOG_PATH = "/functions/v1/app-shop-catalog";
const PUBLIC_COMMENTS_RPC_PATH = "/rest/v1/rpc/get_public_comments_page";
const PUBLIC_REVIEW_STATS_RPC_PATH = "/rest/v1/rpc/get_public_shop_review_stats";
const CACHED_DETAILS_RPC_PATH = "/rest/v1/rpc/get_cached_shop_details";
const SAVE_DETAILS_CACHE_RPC_PATH = "/rest/v1/rpc/save_shop_details_cache";
const SAVE_SHOP_SNAPSHOTS_RPC_PATH = "/rest/v1/rpc/save_shop_snapshots_cache";
const REFRESH_REVIEW_STATS_RPC_PATH = "/rest/v1/rpc/refresh_shop_review_stats_from_comments";
const SECURE_ACTIONS_PATH = "/functions/v1/app-secure-actions";
const PHOTO_PROXY_PATHS = new Set([
  "/functions/v1/app-shop-catalog/photo",
  "/functions/v1/app-shop-photo",
]);
const CATALOG_CACHEABLE_ACTIONS = new Set([
  "get_directory",
  "get_home_rankings",
  "get_place_snapshot",
  "get_place_details",
]);
const CATALOG_AUGMENT_ACTIONS = new Set([
  "get_directory",
  "get_home_rankings",
  "get_place_details",
]);
const CATALOG_CACHE_VERSION = "vehicle-pool-v4-review-injection";
const DEFAULT_CATALOG_DATA_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_CATALOG_STALE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_CATALOG_REFRESH_LOCK_SECONDS = 90;
const DEFAULT_REVIEW_STATS_CACHE_TTL_SECONDS = 60;
const DEFAULT_PLACE_DETAILS_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_PHOTO_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_FILTER_POOL_LIMIT = 50;
const DEFAULT_DETAIL_ENRICH_LIMIT = 7;

const VEHICLE_BRAND_ALIASES = {
  renault: ["renault", "reno", "renoclass", "renotek", "renozen", "reno ege"],
  dacia: ["dacia"],
  fiat: ["fiat"],
  ford: ["ford"],
  volkswagen: ["volkswagen", "vw"],
  opel: ["opel"],
  toyota: ["toyota"],
  hyundai: ["hyundai"],
  peugeot: ["peugeot"],
  citroen: ["citroen", "citroën"],
  honda: ["honda"],
  nissan: ["nissan"],
  mercedes: ["mercedes", "mercedes benz"],
  bmw: ["bmw"],
  audi: ["audi"],
  skoda: ["skoda", "skoda"],
  seat: ["seat"],
  volvo: ["volvo"],
  kia: ["kia"],
  jeep: ["jeep"],
  "alfa romeo": ["alfa romeo"],
  chevrolet: ["chevrolet"],
  mini: ["mini"],
  "land rover": ["land rover"],
  suzuki: ["suzuki"],
  mazda: ["mazda"],
  mitsubishi: ["mitsubishi"],
  subaru: ["subaru"],
  porsche: ["porsche"],
  cupra: ["cupra"],
  lexus: ["lexus"],
  isuzu: ["isuzu"],
  iveco: ["iveco"],
  togg: ["togg"],
};

function envFlag(env, name, defaultValue = false) {
  const value = env?.[name];
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  return defaultValue;
}

function googleCostSaverEnabled(env) {
  return envFlag(env, "GOOGLE_COST_SAVER_MODE", true);
}

function googlePlaceDetailsEnabled(env) {
  return !googleCostSaverEnabled(env) && envFlag(env, "ENABLE_GOOGLE_PLACE_DETAILS", false);
}

function googleReviewsEnabled(env) {
  return !googleCostSaverEnabled(env) && envFlag(env, "ENABLE_GOOGLE_REVIEWS", false);
}

function googlePlacePhotosEnabled(env) {
  return !googleCostSaverEnabled(env) && envFlag(env, "ENABLE_GOOGLE_PLACES_PHOTOS", false);
}

function envInteger(env, name, defaultValue = 0) {
  const value = env?.[name];
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : defaultValue;
}

function googleDailyLimit(env, name) {
  return envInteger(env, name, 0);
}

function googlePlacePhotosAllowed(env) {
  return (
    googlePlacePhotosEnabled(env) ||
    envFlag(env, "ENABLE_GOOGLE_PLACES_PHOTO_FALLBACK", false)
  ) && googleDailyLimit(env, "GOOGLE_DAILY_PHOTO_LIMIT") > 0;
}

function photoReferenceFromUrl(url) {
  return String(
    url.searchParams.get("ref") ||
    url.searchParams.get("photo_reference") ||
    ""
  ).trim();
}

function placeIdFromUrl(url) {
  return String(
    url.searchParams.get("placeId") ||
    url.searchParams.get("place_id") ||
    ""
  ).trim();
}

function catalogCacheTtlSeconds(env, action = "") {
  if (String(action || "").trim() === "get_place_details") {
    return envInteger(env, "PLACE_DETAILS_CACHE_TTL_SECONDS", DEFAULT_PLACE_DETAILS_CACHE_TTL_SECONDS);
  }

  return envInteger(env, "CATALOG_DATA_CACHE_TTL_SECONDS", DEFAULT_CATALOG_DATA_CACHE_TTL_SECONDS);
}

function catalogStaleCacheTtlSeconds(env) {
  return envInteger(env, "CATALOG_STALE_CACHE_TTL_SECONDS", DEFAULT_CATALOG_STALE_CACHE_TTL_SECONDS);
}

function catalogRefreshLockSeconds(env) {
  return envInteger(env, "CATALOG_REFRESH_LOCK_SECONDS", DEFAULT_CATALOG_REFRESH_LOCK_SECONDS);
}

function reviewStatsCacheTtlSeconds(env) {
  return envInteger(env, "REVIEW_STATS_CACHE_TTL_SECONDS", DEFAULT_REVIEW_STATS_CACHE_TTL_SECONDS);
}

function clientCatalogCacheControl(env) {
  const ttl = envInteger(env, "CLIENT_CATALOG_CACHE_TTL_SECONDS", 0);
  return ttl > 0 ? `public, max-age=${ttl}` : "no-store";
}

function photoCacheTtlSeconds(env) {
  return envInteger(env, "GOOGLE_PHOTO_CACHE_TTL_SECONDS", DEFAULT_PHOTO_CACHE_TTL_SECONDS);
}

function filterPoolLimit(env) {
  return envInteger(env, "FILTER_POOL_LIMIT", DEFAULT_FILTER_POOL_LIMIT);
}

function detailEnrichLimit(env) {
  return envInteger(env, "DETAIL_ENRICH_LIMIT", DEFAULT_DETAIL_ENRICH_LIMIT);
}

function detailCacheWarmupEnabled(env) {
  return envFlag(env, "ENABLE_DETAIL_CACHE_WARMUP", false);
}

function isPhotoProxyPath(pathname) {
  return PHOTO_PROXY_PATHS.has(pathname);
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function withCors(res) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function jsonResponse(data, init = {}) {
  return withCors(new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  }));
}

function catalogResponse(data, init = {}) {
  const headers = {
    "X-UstaBul-Catalog-Version": CATALOG_CACHE_VERSION,
    ...(init.headers || {}),
  };
  return jsonResponse(data, { ...init, headers });
}

function cloneResponseWithCacheControl(response, ttlSeconds) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${Math.max(0, Math.floor(ttlSeconds || 0))}`);
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function logCostDebug(event, metadata = {}) {
  try {
    console.log(JSON.stringify({
      level: "info",
      scope: "ustabul-api-proxy",
      event,
      ...metadata,
    }));
  } catch {}
}

function isAllowedPath(pathname) {
  return ALLOWED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function upstreamHeaders(request, supabaseAnonKey) {
  const incomingAuth = request.headers.get("Authorization") || "";
  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
  headers.set("apikey", supabaseAnonKey);
  headers.set("Authorization", incomingAuth.startsWith("Bearer ") ? incomingAuth : `Bearer ${supabaseAnonKey}`);
  return headers;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function textIncludesPhrase(text, phrase) {
  const haystack = ` ${normalizeSearchText(text)} `;
  const needle = ` ${normalizeSearchText(phrase)} `;
  return needle.trim() ? haystack.includes(needle) : false;
}

function categoryLabelFromKey(category) {
  const normalized = String(category || "").trim();
  const labels = {
    All: "",
    OtoServis: "Oto Servis",
    Kaporta: "Oto Kaporta Merkezi",
    Boya: "Oto Boya Merkezi",
    Elektrik: "Oto Elektrik",
    Lastik: "Lastik Rot Balans Servisi",
    OtoYikama: "Oto Yıkama",
    OtoEkspertiz: "Oto Ekspertiz",
  };
  return labels[normalized] || normalized;
}

function requestedCategory(requestBody) {
  return String(requestBody?.category || "").trim() || "All";
}

function requestedBrand(requestBody) {
  return String(requestBody?.serviceBrand || requestBody?.service_brand || "").trim();
}

function requestedModel(requestBody) {
  return String(requestBody?.serviceModel || requestBody?.service_model || "").trim();
}

function shopSearchBlob(shop) {
  return [
    shop?.name,
    shop?.address,
    shop?.categoryName,
    shop?.category_name,
    shop?.serviceBrand,
    shop?.service_brand,
    shop?.serviceModel,
    shop?.service_model,
  ].filter(Boolean).join(" ");
}

function brandAliases(brand) {
  const normalized = normalizeSearchText(brand);
  if (!normalized) return [];
  return VEHICLE_BRAND_ALIASES[normalized] || [normalized];
}

function shopMatchesVehicleBrand(shop, brand) {
  const aliases = brandAliases(brand);
  if (!aliases.length) return true;
  const blob = shopSearchBlob(shop);
  return aliases.some(alias => textIncludesPhrase(blob, alias));
}

function shopMatchesVehicleModel(shop, model) {
  const normalizedModel = normalizeSearchText(model);
  if (!normalizedModel) return true;
  return textIncludesPhrase(shopSearchBlob(shop), normalizedModel);
}

function inferCategoryKey(shop) {
  const blob = shopSearchBlob(shop);
  if (textIncludesPhrase(blob, "kaporta") || textIncludesPhrase(blob, "gocuk") || textIncludesPhrase(blob, "pdr")) return "Kaporta";
  if (textIncludesPhrase(blob, "boya")) return "Boya";
  if (textIncludesPhrase(blob, "elektrik") || textIncludesPhrase(blob, "aku") || textIncludesPhrase(blob, "oto elektronik")) return "Elektrik";
  if (textIncludesPhrase(blob, "lastik") || textIncludesPhrase(blob, "rot balans") || textIncludesPhrase(blob, "jant")) return "Lastik";
  if (textIncludesPhrase(blob, "yikama") || textIncludesPhrase(blob, "yıkama") || textIncludesPhrase(blob, "detailing") || textIncludesPhrase(blob, "kuafor")) return "OtoYikama";
  if (textIncludesPhrase(blob, "ekspertiz")) return "OtoEkspertiz";
  const hasVehicleServiceSignal = textIncludesPhrase(blob, "oto servis") ||
    textIncludesPhrase(blob, "auto service") ||
    textIncludesPhrase(blob, "servis") ||
    Object.values(VEHICLE_BRAND_ALIASES).flat().some(alias => textIncludesPhrase(blob, alias));
  return hasVehicleServiceSignal ? "OtoServis" : "";
}

function ensureShopClassification(shop, requestBody = {}) {
  if (!shop || typeof shop !== "object") return shop;
  const category = requestedCategory(requestBody);
  const existingCategory = String(shop.categoryName || shop.category_name || "").trim();
  const inferredCategory = inferCategoryKey(shop);
  if (!existingCategory && inferredCategory) {
    shop.categoryName = categoryLabelFromKey(inferredCategory);
    shop.categoryKey = inferredCategory;
  } else if (category !== "All" && !textIncludesPhrase(existingCategory, categoryLabelFromKey(category))) {
    const inferredMatches = inferredCategory === category ||
      (category === "OtoServis" && inferredCategory === "OtoServis");
    if (inferredMatches) {
      shop.categoryName = categoryLabelFromKey(category);
      shop.categoryKey = category;
    }
  }

  const brand = requestedBrand(requestBody);
  if (brand && shopMatchesVehicleBrand(shop, brand)) {
    shop.serviceBrand = brand;
  }

  const model = requestedModel(requestBody);
  if (model && shopMatchesVehicleModel(shop, model)) {
    shop.serviceModel = model;
  }

  return shop;
}

function shopMatchesRequestedFilters(shop, requestBody = {}) {
  const category = requestedCategory(requestBody);
  const brand = requestedBrand(requestBody);
  const model = requestedModel(requestBody);
  ensureShopClassification(shop, requestBody);

  if (category !== "All") {
    const inferredCategory = shop.categoryKey || inferCategoryKey(shop);
    const categoryText = String(shop.categoryName || shop.category_name || "").trim();
    const categoryMatches = inferredCategory === category ||
      textIncludesPhrase(categoryText, categoryLabelFromKey(category)) ||
      (category === "OtoServis" && (inferredCategory === "OtoServis" || shopMatchesVehicleBrand(shop, brand)));
    if (!categoryMatches) return false;
  }

  if (brand && !shopMatchesVehicleBrand(shop, brand)) return false;
  if (model && !shopMatchesVehicleModel(shop, model)) return false;
  return true;
}

function vehicleFilterNeedsExpansion(requestBody) {
  const action = catalogActionName(requestBody);
  return ["get_directory", "get_home_rankings"].includes(action) &&
    requestedCategory(requestBody) === "OtoServis" &&
    Boolean(requestedBrand(requestBody) || requestedModel(requestBody));
}

function vehicleSearchQuery(requestBody) {
  return [
    requestedBrand(requestBody),
    requestedModel(requestBody),
    String(requestBody?.searchQuery || requestBody?.search_query || "").trim(),
  ].filter(Boolean).join(" ");
}

function hasOwnValue(object, key) {
  return object != null &&
    Object.prototype.hasOwnProperty.call(object, key) &&
    object[key] !== null &&
    object[key] !== undefined;
}

function visibleDisplayReviewCount(shop) {
  if (!shop || typeof shop !== "object") return null;
  if (hasOwnValue(shop, "displayReviewCount")) {
    return Math.max(0, Math.floor(Number(shop.displayReviewCount) || 0));
  }
  if (hasOwnValue(shop, "display_review_count")) {
    return Math.max(0, Math.floor(Number(shop.display_review_count) || 0));
  }
  const appCount = firstPositiveNumber(
    shop.appReviewCount,
    shop.app_review_count,
    shop.appCommentCount,
    shop.app_comment_count,
  ) || 0;
  if (appCount > 0) return Math.floor(appCount);
  return null;
}

function appVisibleReviewCount(shop) {
  return firstPositiveNumber(
    shop?.appReviewCount,
    shop?.app_review_count,
    shop?.appCommentCount,
    shop?.app_comment_count,
  ) || 0;
}

function appOnlyDisplayRating(shop, rating) {
  const normalized = clampRating(rating);
  if (normalized == null) return null;
  return (visibleDisplayReviewCount(shop) || appVisibleReviewCount(shop)) > 0 ? normalized : null;
}

function clampRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(5, Math.max(1, number));
}

function commentRating(comment) {
  const price = clampRating(comment?.priceRating ?? comment?.price_rating);
  const satisfaction = clampRating(comment?.satisfactionRating ?? comment?.satisfaction_rating);
  if (price != null && satisfaction != null) return (price + satisfaction) / 2;
  if (price != null || satisfaction != null) return price ?? satisfaction;

  const directRating = clampRating(comment?.rating ?? comment?.starRating ?? comment?.star_rating);
  if (directRating != null) return directRating;

  return clampRating(comment?.averageRating ?? comment?.average_rating);
}

function emptyStats() {
  return {
    count: 0,
    sum: 0,
    oneStarCount: 0,
    minRating: null,
  };
}

function addRating(stats, rating) {
  if (rating == null) return stats;
  stats.count += 1;
  stats.sum += rating;
  stats.oneStarCount += rating <= 1.5 ? 1 : 0;
  stats.minRating = stats.minRating == null ? rating : Math.min(stats.minRating, rating);
  return stats;
}

function mergeStats(...statsList) {
  const merged = emptyStats();
  for (const stats of statsList) {
    if (!stats || stats.count <= 0) continue;
    merged.count += stats.count;
    merged.sum += stats.sum;
    merged.oneStarCount += stats.oneStarCount;
    merged.minRating = merged.minRating == null
      ? stats.minRating
      : Math.min(merged.minRating, stats.minRating);
  }
  return merged.count > 0 ? merged : null;
}

function summarizeReviewList(reviews) {
  const stats = emptyStats();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    addRating(stats, commentRating(review));
  }
  return stats.count > 0 ? stats : null;
}

function conservativeDisplayRating(average, reviewCount, oneStarCount = 0, minRating = null) {
  const normalizedAverage = clampRating(average);
  const count = Math.max(0, Math.floor(Number(reviewCount || 0)));
  if (normalizedAverage == null || count <= 0) return null;

  const numericMinRating = Number(minRating);
  const hasMinRating = minRating !== null &&
    minRating !== undefined &&
    Number.isFinite(numericMinRating) &&
    numericMinRating > 0;
  const hasOneStar = Number(oneStarCount || 0) > 0 || (hasMinRating && numericMinRating <= 1.5);
  if (hasOneStar) return Math.min(2, normalizedAverage);

  const priorMean = 3.45;
  const priorWeight = 6;
  const score = ((normalizedAverage * count) + (priorMean * priorWeight)) / (count + priorWeight);

  if (count < 3) return Math.min(score, 4.2);
  if (count < 8) return Math.min(score, 4.5);
  if (count < 20) return Math.min(score, 4.7);
  return Math.min(score, 4.9);
}

function threadKeyFromShop(shop) {
  return String(shop?.placeId || shop?.place_id || shop?.id || "").trim();
}

function threadKeyFromComment(comment) {
  return String(comment?.shopId || comment?.shop_id || comment?.placeId || comment?.place_id || "").trim();
}

function normalizeStatsText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function shopNameStatsKey(value) {
  const normalized = normalizeStatsText(value);
  return normalized ? `name:${normalized}` : "";
}

function statsKeysFromShop(shop, extraThreadKeys = []) {
  return [...new Set([
    threadKeyFromShop(shop),
    shop?.shopKey,
    shop?.shop_key,
    shop?.placeId,
    shop?.place_id,
    shop?.id,
    ...extraThreadKeys,
    shopNameStatsKey(shop?.name),
  ].map(key => String(key || "").trim()).filter(Boolean))];
}

function statsKeysFromComment(comment) {
  return [...new Set([
    threadKeyFromComment(comment),
    comment?.shopKey,
    comment?.shop_key,
    comment?.placeId,
    comment?.place_id,
    comment?.shopId,
    comment?.shop_id,
    shopNameStatsKey(comment?.shopName || comment?.shop_name),
  ].map(key => String(key || "").trim()).filter(Boolean))];
}

function summarizeComments(comments) {
  const statsByThread = new Map();
  for (const comment of Array.isArray(comments) ? comments : []) {
    const keys = statsKeysFromComment(comment);
    const rating = commentRating(comment);
    if (!keys.length || rating == null) continue;

    const primaryStats = emptyStats();
    addRating(primaryStats, rating);
    for (const key of keys) {
      const stats = statsByThread.get(key) || emptyStats();
      stats.count += primaryStats.count;
      stats.sum += primaryStats.sum;
      stats.oneStarCount += primaryStats.oneStarCount;
      stats.minRating = stats.minRating == null
        ? primaryStats.minRating
        : Math.min(stats.minRating, primaryStats.minRating);
      statsByThread.set(key, stats);
    }
  }
  return statsByThread;
}

function scoreFromStats(stats) {
  if (!stats || stats.count <= 0) return null;
  const average = stats.sum / stats.count;
  return {
    average,
    count: stats.count,
    oneStarCount: stats.oneStarCount,
    minRating: stats.minRating,
    displayRating: clampRating(stats.displayRating) ??
      conservativeDisplayRating(average, stats.count, stats.oneStarCount, stats.minRating),
    displayReviewCount: Math.max(0, Math.floor(Number(stats.displayReviewCount || stats.count) || 0)),
  };
}

function statsForShop(statsByThread, shop, extraThreadKeys = []) {
  const keys = statsKeysFromShop(shop, extraThreadKeys);
  const direct = keys.map(key => statsByThread.get(key)).find(Boolean);
  if (direct) return direct;

  const nameKey = shopNameStatsKey(shop?.name);
  const normalizedName = normalizeSearchText(String(nameKey).replace(/^name:/, ""));
  if (!normalizedName) return null;
  for (const [key, stats] of statsByThread.entries()) {
    if (!String(key).startsWith("name:")) continue;
    const normalizedCandidate = normalizeSearchText(String(key).replace(/^name:/, ""));
    if (!normalizedCandidate) continue;
    if (normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName)) {
      return stats;
    }
  }
  return null;
}

function existingBackendRating(shop) {
  return clampRating(firstPositiveNumber(
    shop?.displayRating,
    shop?.display_rating,
    shop?.appDisplayRating,
    shop?.app_display_rating,
    shop?.overallRating,
    shop?.overall_rating,
    shop?.backendRating,
    shop?.backend_rating,
    shop?.calculatedRating,
    shop?.calculated_rating
  ));
}

function detailReviews(details, shop) {
  return details?.googleReviews ||
    details?.google_reviews ||
    shop?.googleReviews ||
    shop?.google_reviews ||
    [];
}

function normalizePhotoReferencesValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return normalizePhotoReferencesValue(JSON.parse(raw));
    } catch {}
  }
  return raw.split(",").map(item => item.trim()).filter(Boolean);
}

function photoReferencesFrom(value) {
  return normalizePhotoReferencesValue(value?.photoReferences ?? value?.photo_references ?? []);
}

function isBackendPlaceIdPhotoUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const isBackendPhotoFunction =
      url.pathname.includes("/functions/v1/app-shop-photo") ||
      url.pathname.includes("/functions/v1/app-shop-catalog/photo");
    return isBackendPhotoFunction && !photoReferenceFromUrl(url) && Boolean(placeIdFromUrl(url));
  } catch {
    return false;
  }
}

function exteriorPhotoUrlFrom(value) {
  const url = String(value?.exteriorPhotoUrl || value?.exterior_photo_url || "").trim();
  return url;
}

function hasUsablePhoto(value) {
  return Boolean(
    exteriorPhotoUrlFrom(value) ||
    photoReferencesFrom(value).length > 0
  );
}

function mergeCachedDetailsIntoShop(shop, details) {
  if (!shop || !details || typeof details !== "object") return shop;
  const shopPhotoReferences = photoReferencesFrom(shop);
  const detailPhotoReferences = photoReferencesFrom(details);
  Object.assign(shop, {
    categoryName: shop.categoryName || shop.category_name || details.categoryName || details.category_name || "",
    phone: shop.phone || details.phone || "",
    exteriorPhotoUrl: exteriorPhotoUrlFrom(shop) || exteriorPhotoUrlFrom(details) || null,
    photoReferences: shopPhotoReferences.length ? shopPhotoReferences : detailPhotoReferences,
    photoCount: shop.photoCount || shop.photo_count || details.photoCount || details.photo_count || 0,
    isOpenNow: shop.isOpenNow ?? shop.is_open_now ?? details.isOpenNow ?? details.is_open_now ?? null,
    placeDetailsLoaded: true,
  });
  return shop;
}

function applyRatingToShop(shop, statsByThread, extraThreadKeys = [], details = null, options = {}) {
  if (!shop || typeof shop !== "object") return shop;
  const appStats = statsForShop(statsByThread, shop, extraThreadKeys);
  const googleWrittenStats = options.includeGoogleReviews
    ? summarizeReviewList(detailReviews(details, shop))
    : null;
  const stats = mergeStats(appStats, googleWrittenStats);
  const score = scoreFromStats(stats);
  const appScore = scoreFromStats(appStats);
  const fallbackRating = existingBackendRating(shop);
  const hasAppEvidence = Boolean(appStats && appStats.count > 0) ||
    appVisibleReviewCount(shop) > 0;

  if (score?.displayRating != null) {
    const displayRating = hasAppEvidence
      ? score.displayRating
      : Math.min(3, score.displayRating);
    Object.assign(shop, {
      displayRating,
      displayReviewCount: score.displayReviewCount,
      appDisplayRating: appScore?.displayRating ?? firstNumber(shop.appDisplayRating, shop.app_display_rating) ?? null,
      appReviewCount: appScore?.displayReviewCount ?? firstNumber(shop.appReviewCount, shop.app_review_count) ?? 0,
      appCommentAverage: appScore?.average ?? firstNumber(shop.appCommentAverage, shop.app_comment_average) ?? null,
      appCommentCount: appScore?.count ?? firstNumber(shop.appCommentCount, shop.app_comment_count) ?? 0,
      appOneStarCount: appScore?.oneStarCount ?? firstNumber(shop.appOneStarCount, shop.app_one_star_count) ?? 0,
      appMinRating: appScore?.minRating ?? firstNumber(shop.appMinRating, shop.app_min_rating) ?? null,
      overallRating: displayRating,
      overallReviewCount: score.displayReviewCount,
    });
  } else {
    const rawDisplayRating = firstPositiveNumber(
      shop.displayRating,
      shop.display_rating,
      shop.appDisplayRating,
      shop.app_display_rating,
      shop.overallRating,
      shop.overall_rating,
      fallbackRating,
    );
    const displayRating = appOnlyDisplayRating(shop, rawDisplayRating);
    const displayReviewCount = visibleDisplayReviewCount(shop) || 0;
    Object.assign(shop, {
      displayRating,
      displayReviewCount,
      appCommentCount: firstNumber(shop.appCommentCount, shop.app_comment_count) || 0,
      overallRating: firstPositiveNumber(shop.overallRating, shop.overall_rating, displayRating),
      overallReviewCount: firstNumber(shop.overallReviewCount, shop.overall_review_count, displayReviewCount) || 0,
    });
  }
  return shop;
}

function sortByScore(shops, direction = "desc") {
  return [...(shops || [])]
    .filter(shop => firstPositiveNumber(
      visibleDisplayReviewCount(shop),
      shop.appCommentCount,
      shop.app_comment_count,
    ) > 0)
    .sort((left, right) => {
      const leftRating = firstPositiveNumber(left.displayRating, left.display_rating, left.overallRating, left.overall_rating) || 0;
      const rightRating = firstPositiveNumber(right.displayRating, right.display_rating, right.overallRating, right.overall_rating) || 0;
      if (leftRating !== rightRating) {
        return direction === "asc" ? leftRating - rightRating : rightRating - leftRating;
      }
      const leftCount = visibleDisplayReviewCount(left) || 0;
      const rightCount = visibleDisplayReviewCount(right) || 0;
      return rightCount - leftCount;
    });
}

function rankedWithFallback(sortedShops, allShops) {
  const ranked = [];
  const seen = new Set();
  [...(sortedShops || []), ...(allShops || [])].forEach(shop => {
    const key = threadKeyFromShop(shop);
    if (!key || seen.has(key)) return;
    ranked.push(shop);
    seen.add(key);
  });
  return ranked;
}

function normalizeVisibleRatingFields(shop) {
  if (!shop || typeof shop !== "object") return shop;
  const rawDisplayRating = firstPositiveNumber(
    shop.displayRating,
    shop.display_rating,
    shop.appDisplayRating,
    shop.app_display_rating,
    shop.overallRating,
    shop.overall_rating,
  );
  const displayRating = appOnlyDisplayRating(shop, rawDisplayRating);
  const displayReviewCount = visibleDisplayReviewCount(shop);
  shop.displayRating = displayRating;
  shop.displayReviewCount = displayReviewCount || 0;
  return shop;
}

function normalizeCatalogResponseRatings(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data.shops)) data.shops = data.shops.map(normalizeVisibleRatingFields);
  if (data.details && typeof data.details === "object") normalizeVisibleRatingFields(data.details);
  const rankings = data.rankings;
  if (rankings && typeof rankings === "object") {
    if (Array.isArray(rankings.rankedShops)) {
      rankings.rankedShops = rankings.rankedShops.map(normalizeVisibleRatingFields);
    }
    if (Array.isArray(rankings.shops)) {
      rankings.shops = rankings.shops.map(normalizeVisibleRatingFields);
    }
  }
  return data;
}

async function fetchPublicComments(supabaseUrl, supabaseAnonKey) {
  const comments = [];
  const pageSize = 500;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const res = await fetch(`${supabaseUrl}${PUBLIC_COMMENTS_RPC_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ p_limit: pageSize, p_offset: offset }),
    });
    if (!res.ok) throw new Error(`Comment stats RPC failed: ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    comments.push(...page);
    if (page.length < pageSize) break;
  }
  return comments;
}

function statsMapToRows(statsByThread) {
  return [...statsByThread.entries()].map(([shopKey, stats]) => {
    const score = scoreFromStats(stats);
    return {
      shopKey,
      appReviewCount: score?.displayReviewCount ?? stats.count ?? 0,
      appAverageRating: score?.average ?? null,
      displayRating: score?.displayRating ?? null,
      displayReviewCount: score?.displayReviewCount ?? stats.count ?? 0,
      oneStarCount: stats.oneStarCount ?? 0,
      minRating: stats.minRating ?? null,
    };
  });
}

function statsMapFromRows(rows) {
  const statsByThread = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const count = Math.max(0, Math.floor(Number(
      row.appReviewCount ?? row.app_review_count ?? row.displayReviewCount ?? row.display_review_count ?? 0
    ) || 0));
    const average = clampRating(row.appAverageRating ?? row.app_average_rating ?? row.averageRating ?? row.average_rating);
    const displayRating = clampRating(row.displayRating ?? row.display_rating);
    const displayReviewCount = Math.max(0, Math.floor(Number(
      row.displayReviewCount ?? row.display_review_count ?? count
    ) || 0));
    if (count <= 0 || average == null) continue;

    const stats = {
      count,
      sum: average * count,
      oneStarCount: Math.max(0, Math.floor(Number(row.oneStarCount ?? row.one_star_count ?? 0) || 0)),
      minRating: clampRating(row.minRating ?? row.min_rating),
      displayRating,
      displayReviewCount,
      shopKey: String(row.shopKey ?? row.shop_key ?? "").trim(),
      placeId: String(row.placeId ?? row.place_id ?? "").trim(),
      shopId: String(row.shopId ?? row.shop_id ?? "").trim(),
      shopName: String(row.shopName ?? row.shop_name ?? "").trim(),
      shopNameKey: String(row.shopNameKey ?? row.shop_name_key ?? "").trim(),
    };
    const keys = [
      row.shopKey,
      row.shop_key,
      row.placeId,
      row.place_id,
      row.shopId,
      row.shop_id,
      shopNameStatsKey(row.shopName || row.shop_name),
    ].map(key => String(key || "").trim()).filter(Boolean);
    for (const key of new Set(keys)) statsByThread.set(key, stats);
  }
  return statsByThread;
}

async function fetchPublicShopReviewStats(supabaseUrl, supabaseAnonKey) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const res = await fetch(`${supabaseUrl}${PUBLIC_REVIEW_STATS_RPC_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ p_limit: pageSize, p_offset: offset }),
    });
    if (!res.ok) throw new Error(`Review stats RPC failed: ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function reviewStatsCacheKey(requestUrl) {
  return new Request(`${requestUrl.origin}${SHOP_CATALOG_PATH}?review_stats_cache=${CATALOG_CACHE_VERSION}`, {
    method: "GET",
  });
}

async function readReviewStatsCache(requestUrl, env) {
  if (typeof caches === "undefined") return null;
  if (reviewStatsCacheTtlSeconds(env) <= 0) return null;
  try {
    const cached = await caches.default.match(reviewStatsCacheKey(requestUrl));
    if (!cached) return null;
    const data = await cached.json();
    return Array.isArray(data?.rows) ? data.rows : null;
  } catch {
    return null;
  }
}

async function writeReviewStatsCache(requestUrl, env, rows) {
  if (typeof caches === "undefined") return;
  const ttl = reviewStatsCacheTtlSeconds(env);
  if (ttl <= 0 || !Array.isArray(rows)) return;
  try {
    const response = jsonResponse({ rows }, {
      headers: { "Cache-Control": `public, max-age=${ttl}` },
    });
    await caches.default.put(reviewStatsCacheKey(requestUrl), response);
  } catch {}
}

async function fetchReviewStatsMap(supabaseUrl, supabaseAnonKey, requestUrl, env) {
  const cachedRows = await readReviewStatsCache(requestUrl, env);
  if (cachedRows) return statsMapFromRows(cachedRows);

  let rows = [];
  try {
    rows = await fetchPublicShopReviewStats(supabaseUrl, supabaseAnonKey);
    if (!rows.length) {
      const comments = await fetchPublicComments(supabaseUrl, supabaseAnonKey);
      rows = statsMapToRows(summarizeComments(comments));
    }
  } catch {
    const comments = await fetchPublicComments(supabaseUrl, supabaseAnonKey);
    rows = statsMapToRows(summarizeComments(comments));
  }
  await writeReviewStatsCache(requestUrl, env, rows);
  return statsMapFromRows(rows);
}

async function readCachedPlaceDetailsForShop(requestUrl, env, shop) {
  const placeId = threadKeyFromShop(shop);
  if (!placeId || !cacheableCatalogAction({ action: "get_place_details" })) return null;
  const bodyText = JSON.stringify({ action: "get_place_details", placeId });
  const cached = await readCatalogCache(requestUrl, bodyText, env, { action: "get_place_details" });
  return cached?.envelope?.data?.details || null;
}

async function fetchDbCachedDetailsMap(supabaseUrl, supabaseAnonKey, shops) {
  const shopKeys = [...new Set((shops || []).map(threadKeyFromShop).filter(Boolean))];
  if (!shopKeys.length) return new Map();
  const res = await fetch(`${supabaseUrl}${CACHED_DETAILS_RPC_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ p_shop_keys: shopKeys }),
  });
  if (!res.ok) return new Map();
  const payload = await res.json();
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.value)
      ? payload.value
      : [];
  const map = new Map();
  for (const row of rows) {
    const details = row.details || row.cached_details;
    if (!details || typeof details !== "object") continue;
    [row.shopKey, row.shop_key, row.placeId, row.place_id].forEach(key => {
      const normalized = String(key || "").trim();
      if (normalized) map.set(normalized, details);
    });
  }
  return map;
}

async function cachedDetailsAllowPlaceIdPhoto(supabaseUrl, supabaseAnonKey, placeId) {
  const normalizedPlaceId = String(placeId || "").trim();
  if (!normalizedPlaceId) return false;
  const detailsMap = await fetchDbCachedDetailsMap(
    supabaseUrl,
    supabaseAnonKey,
    [{ placeId: normalizedPlaceId }]
  ).catch(() => new Map());
  const details = detailsMap.get(normalizedPlaceId);
  if (!details || typeof details !== "object") return false;
  return hasUsablePhoto(details);
}

async function saveDbCachedDetails(supabaseUrl, supabaseAnonKey, requestBody, data) {
  const details = data?.details;
  if (!details || typeof details !== "object") return;
  const placeId = String(requestBody?.placeId || requestBody?.place_id || details.placeId || details.place_id || details.id || "").trim();
  if (!placeId) return;
  await fetch(`${supabaseUrl}${SAVE_DETAILS_CACHE_RPC_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      p_shop_key: placeId,
      p_place_id: placeId,
      p_details: details,
    }),
  }).catch(() => null);
}

function compactShopSnapshot(shop) {
  if (!shop || typeof shop !== "object") return null;
  const placeId = threadKeyFromShop(shop);
  if (!placeId) return null;
  const snapshot = {
    id: shop.id || shop.placeId || shop.place_id || placeId,
    placeId,
    name: shop.name || "",
    address: shop.address || "",
    phone: shop.phone || "",
    latitude: shop.latitude ?? shop.lat ?? null,
    longitude: shop.longitude ?? shop.lng ?? null,
    categoryName: shop.categoryName || shop.category_name || "",
    resolvedCategory: shop.resolvedCategory || shop.resolved_category || "",
    categoryKey: shop.categoryKey || shop.category_key || "",
    serviceBrand: shop.serviceBrand || shop.service_brand || "",
    serviceModel: shop.serviceModel || shop.service_model || "",
    photoReferences: photoReferencesFrom(shop),
    exteriorPhotoUrl: exteriorPhotoUrlFrom(shop) || null,
    photoCount: shop.photoCount ?? shop.photo_count ?? 0,
    isOpenNow: shop.isOpenNow ?? shop.is_open_now ?? null,
    googleReviews: Array.isArray(shop.googleReviews || shop.google_reviews)
      ? (shop.googleReviews || shop.google_reviews)
      : [],
    googleRating: shop.googleRating ?? shop.google_rating ?? shop.rating ?? null,
    googleReviewCount: shop.googleReviewCount ?? shop.google_review_count ?? shop.userRatingsTotal ?? shop.user_ratings_total ?? 0,
  };
  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== "" && value !== null && value !== undefined));
}

async function saveDbShopSnapshots(supabaseUrl, supabaseAnonKey, shops) {
  const snapshots = (shops || [])
    .map(compactShopSnapshot)
    .filter(snapshot => snapshot && (snapshot.name || snapshot.address));
  if (!snapshots.length) return;
  await fetch(`${supabaseUrl}${SAVE_SHOP_SNAPSHOTS_RPC_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ p_shops: snapshots }),
  }).catch(() => null);
}

async function refreshDbReviewStats(supabaseUrl, supabaseAnonKey, shopId, shopName = "") {
  const id = String(shopId || "").trim();
  if (!id) return;
  await fetch(`${supabaseUrl}${REFRESH_REVIEW_STATS_RPC_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      p_shop_id: id,
      p_shop_name: String(shopName || "").trim(),
    }),
  }).catch(() => null);
}

async function fetchAndCachePlaceDetailsForShop(requestUrl, env, supabaseUrl, supabaseAnonKey, shop) {
  const placeId = threadKeyFromShop(shop);
  if (!placeId) return null;

  const detailsRequestBody = { action: "get_place_details", placeId };
  const bodyText = JSON.stringify(detailsRequestBody);
  const cached = await readCatalogCache(requestUrl, bodyText, env, detailsRequestBody);
  const cachedDetails = cached?.envelope?.data?.details || null;
  if (cachedDetails) return cachedDetails;

  if (await readCatalogRefreshLock(requestUrl, bodyText)) return null;
  await writeCatalogRefreshLock(requestUrl, bodyText, env);

  const res = await fetch(`${supabaseUrl}${SHOP_CATALOG_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: bodyText,
  });
  if (!res.ok) return null;

  let detailData = null;
  try {
    detailData = await res.json();
  } catch {
    return null;
  }
  const details = detailData?.details;
  if (!details || typeof details !== "object") return null;

  await Promise.all([
    writeCatalogCache(requestUrl, bodyText, env, detailsRequestBody, detailData),
    saveDbCachedDetails(supabaseUrl, supabaseAnonKey, detailsRequestBody, detailData),
  ]);
  return details;
}

async function enrichFromCachedDetails(data, requestBody, requestUrl, env, supabaseUrl, supabaseAnonKey, options = {}) {
  const shops = responseShops(data, requestBody);
  if (!shops.length) return data;
  const candidates = shops.slice(0, detailEnrichLimit(env));
  const dbDetails = await fetchDbCachedDetailsMap(supabaseUrl, supabaseAnonKey, candidates).catch(() => new Map());
  const detailsList = await Promise.all(candidates.map(shop =>
    Promise.resolve(dbDetails.get(threadKeyFromShop(shop)) || null)
      .then(details => details || readCachedPlaceDetailsForShop(requestUrl, env, shop).catch(() => null))
  ));
  if (options.warmMissingDetails === true && detailCacheWarmupEnabled(env)) {
    for (let index = 0; index < candidates.length; index += 1) {
      if (hasUsablePhoto(candidates[index]) || hasUsablePhoto(detailsList[index])) continue;
      detailsList[index] = await fetchAndCachePlaceDetailsForShop(
        requestUrl,
        env,
        supabaseUrl,
        supabaseAnonKey,
        candidates[index]
      ).catch(() => null);
    }
  }
  detailsList.forEach((details, index) => {
    if (details) mergeCachedDetailsIntoShop(candidates[index], details);
  });
  return data;
}

async function augmentCatalogResponse(data, requestBody, supabaseUrl, supabaseAnonKey, requestUrl, env, options = {}) {
  await enrichFromCachedDetails(data, requestBody, requestUrl, env, supabaseUrl, supabaseAnonKey, options);
  const statsByThread = await fetchReviewStatsMap(supabaseUrl, supabaseAnonKey, requestUrl, env);
  const directoryShops = Array.isArray(data?.shops) ? data.shops : [];
  const rankings = data?.rankings;
  const rankedShops = rankings && typeof rankings === "object"
    ? Array.isArray(rankings.rankedShops)
      ? rankings.rankedShops
      : Array.isArray(rankings.shops)
        ? rankings.shops
        : []
    : [];
  const ratingOptions = { includeGoogleReviews: Boolean(options.includeGoogleReviews) };

  if (directoryShops.length) {
    data.shops = directoryShops.map(shop => applyRatingToShop(
      shop,
      statsByThread,
      [],
      null,
      ratingOptions
    ));
  }

  if (rankings && typeof rankings === "object") {
    const algorithm = String(requestBody?.algorithm || "").trim();
    const prioritizeReviewed = algorithm !== "WorstRated";
    const rankingPool = prioritizeReviewed
      ? await injectReviewedShopsFromCache(rankedShops, statsByThread, requestBody, supabaseUrl, supabaseAnonKey)
      : rankedShops;
    const augmentedShops = rankingPool.map(shop => applyRatingToShop(
      shop,
      statsByThread,
      [],
      null,
      ratingOptions
    ));
    const best = rankedWithFallback(sortByScore(augmentedShops, "desc"), augmentedShops);
    const worst = rankedWithFallback(sortByScore(augmentedShops, "asc"), augmentedShops);
    rankings.rankedShops = augmentedShops;
    if (Array.isArray(rankings.shops)) {
      rankings.shops = rankings.shops.map(shop => applyRatingToShop(
        shop,
        statsByThread,
        [],
        null,
        ratingOptions
      ));
    }
    rankings.recentlyLikedThreadIds = best.map(threadKeyFromShop).filter(Boolean);
    rankings.worstRatedThreadIds = worst.map(threadKeyFromShop).filter(Boolean);

    if (prioritizeReviewed) {
      rankings.rankedShops = best;
      if (Array.isArray(rankings.shops)) rankings.shops = best;
    } else {
      rankings.rankedShops = worst;
      if (Array.isArray(rankings.shops)) rankings.shops = worst;
    }
  }

  if (data?.details && typeof data.details === "object") {
    applyRatingToShop(data.details, statsByThread, [requestBody?.placeId, requestBody?.place_id], data.details, ratingOptions);
  }

  return data;
}

async function proxyToSupabase(request, upstream, headers, body) {
  return await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : body ?? request.body,
  });
}

function catalogPoolRequestBody(requestBody, env) {
  if (!vehicleFilterNeedsExpansion(requestBody)) return { ...requestBody };
  const limit = Math.max(
    filterPoolLimit(env),
    Math.floor(Number(requestBody?.limit || 0) || 0),
    detailEnrichLimit(env)
  );
  return {
    ...requestBody,
    action: "get_directory",
    category: "All",
    serviceBrand: "",
    serviceModel: "",
    searchQuery: vehicleSearchQuery(requestBody),
    offset: 0,
    limit,
  };
}

function catalogCacheRequestBody(requestBody, env) {
  if (!vehicleFilterNeedsExpansion(requestBody)) return { ...requestBody };
  const copy = { ...requestBody };
  delete copy.offset;
  delete copy.limit;
  copy.poolLimit = filterPoolLimit(env);
  return copy;
}

function responseShops(data, requestBody) {
  const action = catalogActionName(requestBody);
  if (action === "get_home_rankings") {
    const rankings = data?.rankings;
    if (!rankings || typeof rankings !== "object") return [];
    return Array.isArray(rankings.rankedShops)
      ? rankings.rankedShops
      : Array.isArray(rankings.shops)
        ? rankings.shops
        : [];
  }
  return Array.isArray(data?.shops) ? data.shops : [];
}

function uniqueStatsList(statsByThread) {
  const seen = new Set();
  const statsList = [];
  for (const stats of statsByThread.values()) {
    if (!stats || stats.displayReviewCount <= 0) continue;
    const key = String(stats.placeId || stats.shopId || stats.shopKey || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    statsList.push(stats);
  }
  return statsList;
}

function shopFromCachedSnapshot(stats, details) {
  if (!stats || !details || typeof details !== "object") return null;
  const placeId = String(details.placeId || details.place_id || stats.placeId || stats.shopId || stats.shopKey || "").trim();
  const name = String(details.name || details.shopName || details.shop_name || stats.shopName || "").trim();
  if (!placeId || !name) return null;
  return {
    id: String(details.id || placeId).trim(),
    placeId,
    name,
    address: details.address || "",
    phone: details.phone || "",
    latitude: details.latitude ?? details.lat ?? 0,
    longitude: details.longitude ?? details.lng ?? 0,
    categoryName: details.categoryName || details.category_name || details.resolvedCategory || details.resolved_category || "",
    resolvedCategory: details.resolvedCategory || details.resolved_category || "",
    categoryKey: details.categoryKey || details.category_key || "",
    serviceBrand: details.serviceBrand || details.service_brand || "",
    serviceModel: details.serviceModel || details.service_model || "",
    photoReferences: photoReferencesFrom(details),
    exteriorPhotoUrl: exteriorPhotoUrlFrom(details) || null,
    photoCount: details.photoCount ?? details.photo_count ?? 0,
    isOpenNow: details.isOpenNow ?? details.is_open_now ?? null,
    placeDetailsLoaded: true,
  };
}

async function injectReviewedShopsFromCache(shops, statsByThread, requestBody, supabaseUrl, supabaseAnonKey) {
  const current = Array.isArray(shops) ? [...shops] : [];
  const existingKeys = new Set(current.flatMap(shop => statsKeysFromShop(shop)).filter(Boolean));
  const statsList = uniqueStatsList(statsByThread)
    .filter(stats => ![stats.placeId, stats.shopId, stats.shopKey].some(key => existingKeys.has(String(key || "").trim())));
  if (!statsList.length) return current;

  const lookupKeys = statsList.flatMap(stats => [stats.placeId, stats.shopId, stats.shopKey])
    .map(key => String(key || "").trim())
    .filter(Boolean);
  const detailsMap = await fetchDbCachedDetailsMap(
    supabaseUrl,
    supabaseAnonKey,
    lookupKeys.map(key => ({ placeId: key }))
  ).catch(() => new Map());

  for (const stats of statsList) {
    const details = [stats.placeId, stats.shopId, stats.shopKey]
      .map(key => detailsMap.get(String(key || "").trim()))
      .find(Boolean);
    const shop = ensureShopClassification(shopFromCachedSnapshot(stats, details), requestBody);
    if (!shop) continue;
    if (!shopMatchesRequestedFilters(shop, requestBody)) continue;
    current.push(shop);
    statsKeysFromShop(shop).forEach(key => existingKeys.add(key));
  }
  return current;
}

function assignResponseShops(data, requestBody, shops) {
  const action = catalogActionName(requestBody);
  if (action === "get_home_rankings") {
    data.rankings = data.rankings && typeof data.rankings === "object" ? data.rankings : {};
    data.rankings.rankedShops = shops;
    data.rankings.shops = shops;
    return data;
  }
  data.shops = shops;
  return data;
}

function convertDirectoryToRankings(data) {
  const shops = Array.isArray(data?.shops) ? data.shops : [];
  return {
    rankings: {
      rankedShops: shops,
      shops,
      recentlyLikedThreadIds: [],
      ustaBulSelectedThreadIds: [],
      worstRatedThreadIds: [],
    },
    totalCount: data?.totalCount ?? data?.total ?? shops.length,
    source: data?.source || "directory_pool",
  };
}

function paginateDirectoryResponse(data, requestBody) {
  if (catalogActionName(requestBody) !== "get_directory") return data;
  const shops = Array.isArray(data?.shops) ? data.shops : [];
  const offset = Math.max(0, Math.floor(Number(requestBody?.offset || 0) || 0));
  const requestedLimit = requestBody?.limit == null
    ? shops.length
    : Math.max(0, Math.floor(Number(requestBody.limit) || 0));
  const limit = requestedLimit > 0 ? requestedLimit : shops.length;
  data.totalCount = shops.length;
  data.total = shops.length;
  data.shops = shops.slice(offset, offset + limit);
  data.nextOffset = offset + data.shops.length < shops.length ? offset + data.shops.length : null;
  data.hasMore = data.nextOffset !== null;
  return data;
}

function prepareCatalogDataForRequest(data, requestBody, upstreamRequestBody) {
  let prepared = cloneJson(data) || {};
  if (catalogActionName(requestBody) === "get_home_rankings" && catalogActionName(upstreamRequestBody) === "get_directory") {
    prepared = convertDirectoryToRankings(prepared);
  }

  let shops = responseShops(prepared, requestBody)
    .map(shop => ensureShopClassification(shop, requestBody))
    .filter(shop => shopMatchesRequestedFilters(shop, requestBody));
  prepared = assignResponseShops(prepared, requestBody, shops);
  prepared.filterSource = vehicleFilterNeedsExpansion(requestBody) ? "backend_expanded_vehicle_pool" : (prepared.filterSource || "backend");
  return prepared;
}

function catalogViewForRequest(data, requestBody) {
  const viewed = cloneJson(data) || {};
  if (vehicleFilterNeedsExpansion(requestBody) && catalogActionName(requestBody) === "get_directory") {
    return paginateDirectoryResponse(viewed, requestBody);
  }
  return viewed;
}

function catalogActionName(requestBody) {
  return String(requestBody?.action || "").trim();
}

function cacheableCatalogAction(requestBody) {
  return CATALOG_CACHEABLE_ACTIONS.has(catalogActionName(requestBody));
}

function augmentableCatalogAction(requestBody) {
  return CATALOG_AUGMENT_ACTIONS.has(catalogActionName(requestBody));
}

async function catalogCacheKey(requestUrl, bodyText) {
  const hash = await sha256Hex(`${CATALOG_CACHE_VERSION}\n${requestUrl.pathname}\n${requestUrl.search}\n${bodyText || ""}`);
  return new Request(`${requestUrl.origin}${requestUrl.pathname}?catalog_cache=${hash}`, {
    method: "GET",
  });
}

async function catalogRefreshLockKey(requestUrl, bodyText) {
  const hash = await sha256Hex(`${CATALOG_CACHE_VERSION}\nrefresh-lock\n${requestUrl.pathname}\n${requestUrl.search}\n${bodyText || ""}`);
  return new Request(`${requestUrl.origin}${requestUrl.pathname}?catalog_refresh_lock=${hash}`, {
    method: "GET",
  });
}

function cloneJson(value) {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function catalogDataEnvelope(data, env, requestBody, now = Date.now()) {
  const action = catalogActionName(requestBody);
  const freshTtl = catalogCacheTtlSeconds(env, action);
  const staleTtl = catalogStaleCacheTtlSeconds(env);
  return {
    version: CATALOG_CACHE_VERSION,
    action,
    cachedAt: new Date(now).toISOString(),
    freshUntil: new Date(now + freshTtl * 1000).toISOString(),
    staleUntil: new Date(now + (freshTtl + staleTtl) * 1000).toISOString(),
    data: cloneJson(data),
  };
}

function catalogEnvelopeState(envelope, now = Date.now()) {
  if (!envelope?.data || envelope.version !== CATALOG_CACHE_VERSION) return null;
  const freshUntilMs = Date.parse(envelope.freshUntil || "");
  const staleUntilMs = Date.parse(envelope.staleUntil || envelope.freshUntil || "");
  if (!Number.isFinite(freshUntilMs) || !Number.isFinite(staleUntilMs)) return null;
  if (now <= freshUntilMs) return "hit";
  if (now <= staleUntilMs) return "stale";
  return null;
}

async function readCatalogCache(requestUrl, bodyText, env, requestBody) {
  if (typeof caches === "undefined") return null;
  if (catalogCacheTtlSeconds(env, catalogActionName(requestBody)) <= 0) return null;
  try {
    const cached = await caches.default.match(await catalogCacheKey(requestUrl, bodyText));
    if (!cached) return null;
    const envelope = await cached.json();
    const state = catalogEnvelopeState(envelope);
    if (!state) return null;
    return { envelope, state };
  } catch {
    return null;
  }
}

async function writeCatalogCache(requestUrl, bodyText, env, requestBody, data) {
  if (typeof caches === "undefined") return;
  const freshTtl = catalogCacheTtlSeconds(env, catalogActionName(requestBody));
  if (freshTtl <= 0) return;
  const cacheTtl = freshTtl + catalogStaleCacheTtlSeconds(env);
  try {
    const envelope = catalogDataEnvelope(data, env, requestBody);
    const cached = jsonResponse(envelope, {
      headers: { "Cache-Control": `public, max-age=${cacheTtl}` },
    });
    await caches.default.put(await catalogCacheKey(requestUrl, bodyText), cached);
  } catch {}
}

async function readCatalogRefreshLock(requestUrl, bodyText) {
  if (typeof caches === "undefined") return false;
  try {
    const cached = await caches.default.match(await catalogRefreshLockKey(requestUrl, bodyText));
    return Boolean(cached);
  } catch {
    return false;
  }
}

async function writeCatalogRefreshLock(requestUrl, bodyText, env) {
  if (typeof caches === "undefined") return;
  const ttl = catalogRefreshLockSeconds(env);
  if (ttl <= 0) return;
  try {
    const response = jsonResponse(
      { lockedUntil: new Date(Date.now() + ttl * 1000).toISOString() },
      { headers: { "Cache-Control": `public, max-age=${ttl}` } },
    );
    await caches.default.put(await catalogRefreshLockKey(requestUrl, bodyText), response);
  } catch {}
}

async function refreshCatalogCache(request, upstream, headers, upstreamBodyText, cacheBodyText, requestUrl, env, requestBody, upstreamRequestBody) {
  if (await readCatalogRefreshLock(requestUrl, cacheBodyText)) return;
  await writeCatalogRefreshLock(requestUrl, cacheBodyText, env);
  const res = await proxyToSupabase(request, upstream, headers, upstreamBodyText);
  if (!res.ok) return;
  try {
    const data = await res.clone().json();
    const prepared = prepareCatalogDataForRequest(data, requestBody, upstreamRequestBody);
    await writeCatalogCache(requestUrl, cacheBodyText, env, requestBody, prepared);
  } catch {}
}

function catalogCacheMeta(status, envelope = null) {
  return {
    cacheStatus: status || "miss",
    cacheExpiresAt: envelope?.freshUntil || null,
  };
}

function applyCatalogCacheMeta(data, meta) {
  if (!data || typeof data !== "object" || !meta) return data;
  const assign = shop => {
    if (!shop || typeof shop !== "object") return shop;
    shop.cacheStatus = meta.cacheStatus;
    shop.cacheExpiresAt = meta.cacheExpiresAt;
    return shop;
  };
  if (Array.isArray(data.shops)) data.shops = data.shops.map(assign);
  if (data.details && typeof data.details === "object") assign(data.details);
  const rankings = data.rankings;
  if (rankings && typeof rankings === "object") {
    if (Array.isArray(rankings.rankedShops)) rankings.rankedShops = rankings.rankedShops.map(assign);
    if (Array.isArray(rankings.shops)) rankings.shops = rankings.shops.map(assign);
  }
  data.cacheStatus = meta.cacheStatus;
  data.cacheExpiresAt = meta.cacheExpiresAt;
  return data;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || "").trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Proxy not configured" }, { status: 500 });
    }

    if (!isAllowedPath(url.pathname)) {
      return jsonResponse({ error: "Not found" }, { status: 404 });
    }

    if (isPhotoProxyPath(url.pathname) && !googlePlacePhotosAllowed(env)) {
      return jsonResponse(
        { error: "Google Places fotograflari production maliyet modu nedeniyle kapali.", disabled: "google_place_photos_disabled" },
        { status: 404 },
      );
    }

    if (isPhotoProxyPath(url.pathname) && request.method === "GET" && !photoReferenceFromUrl(url)) {
      const placeId = placeIdFromUrl(url);
      const allowCachedPlaceIdPhoto = await cachedDetailsAllowPlaceIdPhoto(
        supabaseUrl,
        supabaseAnonKey,
        placeId
      );
      if (allowCachedPlaceIdPhoto) {
        logCostDebug("photo_place_id_allowed_from_cached_details", {
          endpoint: url.pathname,
          placeId,
        });
      } else {
      return jsonResponse(
        { error: "PlaceId ile fotografa bakma kapali; yalnizca kayitli photoReference kullanilir.", disabled: "place_id_photo_lookup_disabled" },
        { status: 404 },
      );
      }
    }

    const upstream = new URL(supabaseUrl + url.pathname);
    upstream.search = url.search;
    const headers = upstreamHeaders(request, supabaseAnonKey);

    if (isPhotoProxyPath(url.pathname) && request.method === "GET") {
      const ttl = photoCacheTtlSeconds(env);
      if (ttl > 0 && typeof caches !== "undefined") {
        try {
          const cached = await caches.default.match(request);
          if (cached) {
            logCostDebug("photo_cache_hit", {
              endpoint: url.pathname,
              cacheHit: true,
            });
            return withCors(cached);
          }
        } catch {}
      }

      const res = await proxyToSupabase(request, upstream, headers);
      if (!res.ok) return withCors(res);
      if (ttl <= 0 || typeof caches === "undefined") return withCors(res);

      try {
        const cached = cloneResponseWithCacheControl(res, ttl);
        await caches.default.put(request, cached.clone());
        return withCors(cached);
      } catch {
        return withCors(res);
      }
    }

    if (url.pathname === SHOP_CATALOG_PATH && request.method === "POST") {
      const bodyText = await request.text();
      let requestBody = {};
      try {
        requestBody = bodyText ? JSON.parse(bodyText) : {};
      } catch {}
      const cacheRequestBody = catalogCacheRequestBody(requestBody, env);
      const cacheBodyText = JSON.stringify(cacheRequestBody);
      const upstreamRequestBody = catalogPoolRequestBody(requestBody, env);
      const upstreamBodyText = JSON.stringify(upstreamRequestBody);

      let data = null;
      let upstreamStatus = 200;
      let upstreamStatusText = "OK";
      let cacheMeta = catalogCacheMeta("bypass");

      if (cacheableCatalogAction(requestBody)) {
        const cached = await readCatalogCache(url, cacheBodyText, env, requestBody);
        if (cached?.envelope?.data) {
          data = catalogViewForRequest(cached.envelope.data, requestBody);
          cacheMeta = catalogCacheMeta(cached.state === "stale" ? "stale_refreshing" : "hit", cached.envelope);
          logCostDebug("catalog_cache_hit", {
            action: catalogActionName(requestBody),
            endpoint: url.pathname,
            stale: cached.state === "stale",
            cacheHit: true,
            detailsCallsForResults: 0,
          });
          if (cached.state === "stale") {
            const refresh = refreshCatalogCache(
              request,
              upstream,
              headers,
              upstreamBodyText,
              cacheBodyText,
              url,
              env,
              requestBody,
              upstreamRequestBody
            ).catch(error => {
              logCostDebug("catalog_stale_refresh_failed", {
                action: catalogActionName(requestBody),
                endpoint: url.pathname,
                message: error?.message || "refresh failed",
              });
            });
            if (ctx && typeof ctx.waitUntil === "function") {
              ctx.waitUntil(refresh);
            } else {
              await refresh;
            }
          }
        }
      }

      if (!data) {
        const res = await proxyToSupabase(request, upstream, headers, upstreamBodyText);
        if (!res.ok) return withCors(res);
        upstreamStatus = res.status;
        upstreamStatusText = res.statusText;

        try {
          data = await res.clone().json();
        } catch {
          return withCors(res);
        }

        data = prepareCatalogDataForRequest(data, requestBody, upstreamRequestBody);
        const saveSnapshots = saveDbShopSnapshots(supabaseUrl, supabaseAnonKey, responseShops(data, requestBody));
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(saveSnapshots);
        } else {
          await saveSnapshots;
        }
        if (catalogActionName(requestBody) === "get_place_details") {
          const saveDetails = saveDbCachedDetails(supabaseUrl, supabaseAnonKey, requestBody, data);
          if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(saveDetails);
          } else {
            await saveDetails;
          }
        }
        if (cacheableCatalogAction(requestBody)) {
          await writeCatalogCache(url, cacheBodyText, env, requestBody, data);
          cacheMeta = catalogCacheMeta("miss", catalogDataEnvelope(data, env, requestBody));
        }
        data = catalogViewForRequest(data, requestBody);
      }

      if (!augmentableCatalogAction(requestBody)) {
        normalizeCatalogResponseRatings(data);
        applyCatalogCacheMeta(data, cacheMeta);
        return catalogResponse(data, {
          status: upstreamStatus,
          statusText: upstreamStatusText,
          headers: { "Cache-Control": clientCatalogCacheControl(env) },
        });
      }

      try {
        logCostDebug("catalog_proxy_cost_flags", {
          action: catalogActionName(requestBody),
          endpoint: url.pathname,
          includeDetails: false,
          includeGoogleReviews: googleReviewsEnabled(env),
          listDetailFanoutEnabled: false,
          cacheHit: cacheMeta.cacheStatus === "hit",
          cacheStatus: cacheMeta.cacheStatus,
        });
        const augmented = await augmentCatalogResponse(data, requestBody, supabaseUrl, supabaseAnonKey, url, env, {
          includeGoogleReviews: googleReviewsEnabled(env),
          warmMissingDetails: cacheMeta.cacheStatus === "miss",
        });
        normalizeCatalogResponseRatings(augmented);
        applyCatalogCacheMeta(augmented, cacheMeta);
        return catalogResponse(augmented, {
          status: upstreamStatus,
          statusText: upstreamStatusText,
          headers: { "Cache-Control": clientCatalogCacheControl(env) },
        });
      } catch {
        normalizeCatalogResponseRatings(data);
        applyCatalogCacheMeta(data, cacheMeta);
        return catalogResponse(data, {
          status: upstreamStatus,
          statusText: upstreamStatusText,
          headers: { "Cache-Control": clientCatalogCacheControl(env) },
        });
      }
    }

    if (url.pathname === SECURE_ACTIONS_PATH && request.method === "POST") {
      const bodyText = await request.text();
      let requestBody = {};
      try {
        requestBody = bodyText ? JSON.parse(bodyText) : {};
      } catch {}

      const action = String(requestBody?.action || "").trim();
      const isAddComment = action === "add_comment";
      const secureActionBody = { ...requestBody };
      delete secureActionBody.shopSnapshot;
      delete secureActionBody.shopName;
      if (isAddComment) {
        const commentText = String(requestBody.text || requestBody.body || "").trim();
        secureActionBody.text = commentText;
        secureActionBody.body = commentText;
      }
      const upstreamBodyText = isAddComment
        ? JSON.stringify(secureActionBody)
        : bodyText;
      const res = await proxyToSupabase(request, upstream, headers, upstreamBodyText);

      if (isAddComment && res.ok) {
        const snapshot = compactShopSnapshot(requestBody.shopSnapshot || {});
        const afterComment = Promise.all([
          snapshot ? saveDbShopSnapshots(supabaseUrl, supabaseAnonKey, [snapshot]) : Promise.resolve(),
          refreshDbReviewStats(
            supabaseUrl,
            supabaseAnonKey,
            requestBody.shopId,
            snapshot?.name || requestBody.shopName || ""
          ),
        ]).catch(() => null);
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(afterComment);
        } else {
          await afterComment;
        }
      }

      return withCors(res);
    }

    const res = await proxyToSupabase(request, upstream, headers);
    return withCors(res);
  },
};
