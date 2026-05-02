const ALLOWED_PREFIXES = ["/functions/v1/", "/rest/v1/"];
const SHOP_CATALOG_PATH = "/functions/v1/app-shop-catalog";
const PUBLIC_COMMENTS_RPC_PATH = "/rest/v1/rpc/get_public_comments_page";

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

function clampRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(5, Math.max(1, number));
}

function commentRating(comment) {
  const explicitAverage = clampRating(comment?.averageRating ?? comment?.average_rating);
  if (explicitAverage != null) return explicitAverage;

  const directRating = clampRating(comment?.rating ?? comment?.starRating ?? comment?.star_rating);
  if (directRating != null) return directRating;

  const price = clampRating(comment?.priceRating ?? comment?.price_rating);
  const satisfaction = clampRating(comment?.satisfactionRating ?? comment?.satisfaction_rating);
  if (price != null && satisfaction != null) return (price + satisfaction) / 2;
  return price ?? satisfaction;
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

function summarizeComments(comments) {
  const statsByThread = new Map();
  for (const comment of Array.isArray(comments) ? comments : []) {
    const threadKey = threadKeyFromComment(comment);
    const rating = commentRating(comment);
    if (!threadKey || rating == null) continue;

    const stats = statsByThread.get(threadKey) || emptyStats();
    addRating(stats, rating);
    statsByThread.set(threadKey, stats);
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
    displayRating: conservativeDisplayRating(average, stats.count, stats.oneStarCount, stats.minRating),
    displayReviewCount: stats.count,
  };
}

function existingBackendRating(shop) {
  return clampRating(firstPositiveNumber(
    shop?.displayRating,
    shop?.display_rating,
    shop?.appDisplayRating,
    shop?.app_display_rating,
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

function applyRatingToShop(shop, statsByThread, extraThreadKeys = [], details = null) {
  if (!shop || typeof shop !== "object") return shop;
  const keys = [threadKeyFromShop(shop), ...extraThreadKeys.map(key => String(key || "").trim())].filter(Boolean);
  const appStats = keys.map(key => statsByThread.get(key)).find(Boolean);
  const googleWrittenStats = summarizeReviewList(detailReviews(details, shop));
  const stats = mergeStats(appStats, googleWrittenStats);
  const score = scoreFromStats(stats);
  const fallbackRating = existingBackendRating(shop);

  if (score?.displayRating != null) {
    Object.assign(shop, {
      displayRating: score.displayRating,
      displayReviewCount: score.displayReviewCount,
      appDisplayRating: score.displayRating,
      appReviewCount: score.displayReviewCount,
      appCommentAverage: score.average,
      appCommentCount: score.count,
      appOneStarCount: score.oneStarCount,
      appMinRating: score.minRating,
      overallRating: score.displayRating,
      overallReviewCount: score.displayReviewCount,
    });
  } else {
    Object.assign(shop, {
      displayRating: firstPositiveNumber(shop.displayRating, shop.display_rating, fallbackRating),
      displayReviewCount: firstNumber(
        shop.displayReviewCount,
        shop.display_review_count,
        shop.appReviewCount,
        shop.app_review_count,
        shop.appCommentCount,
        shop.app_comment_count
      ) || 0,
      appCommentCount: firstNumber(shop.appCommentCount, shop.app_comment_count) || 0,
      overallRating: null,
      overallReviewCount: 0,
    });
  }
  return shop;
}

function sortByScore(shops, direction = "desc") {
  return [...(shops || [])]
    .filter(shop => firstPositiveNumber(shop.displayReviewCount, shop.display_review_count, shop.appCommentCount, shop.app_comment_count) > 0)
    .sort((left, right) => {
      const leftRating = firstPositiveNumber(left.displayRating, left.display_rating, left.overallRating, left.overall_rating) || 0;
      const rightRating = firstPositiveNumber(right.displayRating, right.display_rating, right.overallRating, right.overall_rating) || 0;
      if (leftRating !== rightRating) {
        return direction === "asc" ? leftRating - rightRating : rightRating - leftRating;
      }
      const leftCount = firstPositiveNumber(left.displayReviewCount, left.display_review_count, left.appCommentCount, left.app_comment_count) || 0;
      const rightCount = firstPositiveNumber(right.displayReviewCount, right.display_review_count, right.appCommentCount, right.app_comment_count) || 0;
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

async function fetchPlaceDetails(supabaseUrl, supabaseAnonKey, placeId) {
  const id = String(placeId || "").trim();
  if (!id) return null;
  const res = await fetch(`${supabaseUrl}${SHOP_CATALOG_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ action: "get_place_details", placeId: id }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.details || null;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function fetchDetailsForShops(shops, supabaseUrl, supabaseAnonKey) {
  const uniqueIds = [];
  const seen = new Set();
  for (const shop of shops || []) {
    const key = threadKeyFromShop(shop);
    if (!key || seen.has(key)) continue;
    uniqueIds.push(key);
    seen.add(key);
  }

  const detailEntries = await mapWithConcurrency(uniqueIds, 6, async id => [
    id,
    await fetchPlaceDetails(supabaseUrl, supabaseAnonKey, id).catch(() => null),
  ]);
  return new Map(detailEntries);
}

async function augmentCatalogResponse(data, requestBody, supabaseUrl, supabaseAnonKey) {
  const comments = await fetchPublicComments(supabaseUrl, supabaseAnonKey);
  const statsByThread = summarizeComments(comments);
  const directoryShops = Array.isArray(data?.shops) ? data.shops : [];
  const rankings = data?.rankings;
  const rankedShops = rankings && typeof rankings === "object"
    ? Array.isArray(rankings.rankedShops)
      ? rankings.rankedShops
      : Array.isArray(rankings.shops)
        ? rankings.shops
        : []
    : [];
  const detailMap = await fetchDetailsForShops([...directoryShops, ...rankedShops], supabaseUrl, supabaseAnonKey);

  if (directoryShops.length) {
    data.shops = directoryShops.map(shop => applyRatingToShop(
      shop,
      statsByThread,
      [],
      detailMap.get(threadKeyFromShop(shop))
    ));
  }

  if (rankings && typeof rankings === "object") {
    const augmentedShops = rankedShops.map(shop => applyRatingToShop(
      shop,
      statsByThread,
      [],
      detailMap.get(threadKeyFromShop(shop))
    ));
    const best = rankedWithFallback(sortByScore(augmentedShops, "desc"), augmentedShops);
    const worst = rankedWithFallback(sortByScore(augmentedShops, "asc"), augmentedShops);
    rankings.rankedShops = augmentedShops;
    if (Array.isArray(rankings.shops)) rankings.shops = augmentedShops;
    rankings.recentlyLikedThreadIds = best.map(threadKeyFromShop).filter(Boolean);
    rankings.worstRatedThreadIds = worst.map(threadKeyFromShop).filter(Boolean);

    if (requestBody?.algorithm === "RecentlyLiked") {
      rankings.rankedShops = best;
      if (Array.isArray(rankings.shops)) rankings.shops = best;
    } else if (requestBody?.algorithm === "WorstRated") {
      rankings.rankedShops = worst;
      if (Array.isArray(rankings.shops)) rankings.shops = worst;
    }
  }

  if (data?.details && typeof data.details === "object") {
    applyRatingToShop(data.details, statsByThread, [requestBody?.placeId, requestBody?.place_id], data.details);
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

export default {
  async fetch(request, env) {
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

    const upstream = new URL(supabaseUrl + url.pathname);
    upstream.search = url.search;
    const headers = upstreamHeaders(request, supabaseAnonKey);

    if (url.pathname === SHOP_CATALOG_PATH && request.method === "POST") {
      const bodyText = await request.text();
      const res = await proxyToSupabase(request, upstream, headers, bodyText);
      if (!res.ok) return withCors(res);

      let data;
      let requestBody;
      try {
        data = await res.clone().json();
        requestBody = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        return withCors(res);
      }

      try {
        const augmented = await augmentCatalogResponse(data, requestBody, supabaseUrl, supabaseAnonKey);
        return jsonResponse(augmented, { status: res.status, statusText: res.statusText });
      } catch {
        return jsonResponse(data, { status: res.status, statusText: res.statusText });
      }
    }

    const res = await proxyToSupabase(request, upstream, headers);
    return withCors(res);
  },
};
