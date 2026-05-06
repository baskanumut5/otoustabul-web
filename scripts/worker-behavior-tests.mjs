import assert from "node:assert/strict";
import worker from "../worker/src/index.js";

function makeMemoryCache() {
  const entries = new Map();
  const keyFor = request => typeof request === "string" ? request : request.url;
  return {
    async match(request) {
      const entry = entries.get(keyFor(request));
      if (!entry) return undefined;
      return new Response(entry.body, {
        status: entry.status,
        statusText: entry.statusText,
        headers: new Headers(entry.headers),
      });
    },
    async put(request, response) {
      entries.set(keyFor(request), {
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()],
        body: await response.clone().text(),
      });
    },
    clear() {
      entries.clear();
    },
  };
}

const cache = makeMemoryCache();
globalThis.caches = { default: cache };

const env = {
  SUPABASE_URL: "https://supabase.test",
  SUPABASE_ANON_KEY: "anon",
  GOOGLE_COST_SAVER_MODE: "true",
  ENABLE_GOOGLE_REVIEWS: "false",
  CATALOG_DATA_CACHE_TTL_SECONDS: "2592000",
  CATALOG_STALE_CACHE_TTL_SECONDS: "2592000",
  REVIEW_STATS_CACHE_TTL_SECONDS: "60",
};

const requestBody = {
  action: "get_home_rankings",
  city: "Denizli",
  district: "",
  category: "All",
  serviceBrand: "",
  serviceModel: "",
  algorithm: "RecentlyLiked",
};

function catalogRequest() {
  return new Request("https://app.otoustabul.com/functions/v1/app-shop-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
}

let catalogCalls = 0;
let reviewStatsCalls = 0;
let commentsCalls = 0;
let photoCalls = 0;
let detailsCalls = 0;
let cachedDetailsRows = [];

globalThis.fetch = async (url, init = {}) => {
  const href = String(url);

  if (href.endsWith("/rest/v1/rpc/get_public_shop_review_stats")) {
    reviewStatsCalls += 1;
    return new Response(JSON.stringify({ error: "not installed in fixture" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (href.endsWith("/rest/v1/rpc/get_public_comments_page")) {
    commentsCalls += 1;
    return Response.json([
      {
        id: "c1",
        shopId: "legacy-a",
        shopName: "Usta A",
        priceRating: 5,
        satisfactionRating: 5,
      },
      {
        id: "c2",
        shopId: "legacy-a",
        shopName: "Usta A",
        priceRating: 4,
        satisfactionRating: 4,
      },
    ]);
  }

  if (href.endsWith("/rest/v1/rpc/get_cached_shop_details")) {
    return Response.json({ value: cachedDetailsRows });
  }

  if (href.endsWith("/rest/v1/rpc/save_shop_details_cache")) {
    return Response.json(null);
  }

  if (href.endsWith("/functions/v1/app-shop-catalog")) {
    const body = JSON.parse(init.body || "{}");
    if (body.action === "get_place_details") {
      detailsCalls += 1;
      return Response.json({
        details: {
          placeId: body.placeId,
          photoReferences: [`photo-${body.placeId}`],
          photoCount: 1,
        },
      });
    }

    catalogCalls += 1;
    if (body.action === "get_directory" && body.category === "All" && String(body.searchQuery || "").toLowerCase() === "renault") {
      return Response.json({
        shops: [
          {
            id: "b",
            placeId: "b",
            name: "Generic Renault Service",
            categoryName: "OtoServis",
            googleRating: 5,
            googleReviewCount: 100,
          },
          {
            id: "a",
            placeId: "a",
            name: "Usta A Renault Servis",
            categoryName: "",
            googleRating: 1,
            googleReviewCount: 1,
          },
          {
            id: "x",
            placeId: "x",
            name: "Unrelated Mechanic",
            categoryName: "OtoServis",
          },
        ],
        totalCount: 3,
      });
    }

    assert.equal(body.action, "get_home_rankings");
    return Response.json({
      rankings: {
        rankedShops: [
          {
            id: "b",
            placeId: "b",
            name: "Google B",
            categoryName: "OtoServis",
            googleRating: 5,
            googleReviewCount: 100,
          },
          {
            id: "a",
            placeId: "a",
            name: "Usta A",
            categoryName: "OtoServis",
            googleRating: 1,
            googleReviewCount: 1,
          },
        ],
      },
    });
  }

  if (href.includes("/functions/v1/app-shop-catalog/photo")) {
    photoCalls += 1;
    return new Response("image", {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    });
  }

  throw new Error(`Unexpected fetch: ${href}`);
};

const firstResponse = await worker.fetch(catalogRequest(), env, { waitUntil: promise => promise });
assert.equal(firstResponse.status, 200);
const first = await firstResponse.json();
assert.equal(first.rankings.rankedShops[0].id, "a");
assert.equal(first.rankings.rankedShops[0].displayReviewCount, 2);
assert.equal(first.rankings.rankedShops[1].id, "b");
assert.equal(first.rankings.rankedShops[1].displayRating, null);
assert.equal(catalogCalls, 1);
assert.equal(commentsCalls, 1);
assert.equal(reviewStatsCalls, 1);

const secondResponse = await worker.fetch(catalogRequest(), env, { waitUntil: promise => promise });
assert.equal(secondResponse.status, 200);
const second = await secondResponse.json();
assert.equal(second.rankings.rankedShops[0].id, "a");
assert.equal(second.cacheStatus, "hit");
assert.equal(catalogCalls, 1);
assert.equal(commentsCalls, 1);

const vehicleRequestBody = {
  ...requestBody,
  category: "OtoServis",
  serviceBrand: "Renault",
};
function vehicleCatalogRequest() {
  return new Request("https://app.otoustabul.com/functions/v1/app-shop-catalog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vehicleRequestBody),
  });
}

const vehicleFirstResponse = await worker.fetch(vehicleCatalogRequest(), env, { waitUntil: promise => promise });
assert.equal(vehicleFirstResponse.status, 200);
const vehicleFirst = await vehicleFirstResponse.json();
assert.equal(vehicleFirst.rankings.rankedShops[0].id, "a");
assert.equal(vehicleFirst.rankings.rankedShops.length, 2);
assert.equal(vehicleFirst.filterSource, "backend_expanded_vehicle_pool");
assert.equal(catalogCalls, 2);

const vehicleSecondResponse = await worker.fetch(vehicleCatalogRequest(), env, { waitUntil: promise => promise });
const vehicleSecond = await vehicleSecondResponse.json();
assert.equal(vehicleSecond.cacheStatus, "hit");
assert.equal(vehicleSecond.rankings.rankedShops[0].id, "a");
assert.equal(catalogCalls, 2);

cache.clear();
catalogCalls = 0;
reviewStatsCalls = 0;
commentsCalls = 0;
detailsCalls = 0;
const vehicleWarmupResponse = await worker.fetch(
  vehicleCatalogRequest(),
  { ...env, ENABLE_DETAIL_CACHE_WARMUP: "true", DETAIL_ENRICH_LIMIT: "2" },
  { waitUntil: promise => promise },
);
assert.equal(vehicleWarmupResponse.status, 200);
const vehicleWarmup = await vehicleWarmupResponse.json();
assert.deepEqual(
  vehicleWarmup.rankings.rankedShops.map(shop => [shop.id, shop.photoReferences?.[0] || null]),
  [["a", "photo-a"], ["b", "photo-b"]],
);
assert.equal(catalogCalls, 1);
assert.equal(detailsCalls, 2);

const vehicleWarmupHitResponse = await worker.fetch(
  vehicleCatalogRequest(),
  { ...env, ENABLE_DETAIL_CACHE_WARMUP: "true", DETAIL_ENRICH_LIMIT: "2" },
  { waitUntil: promise => promise },
);
const vehicleWarmupHit = await vehicleWarmupHitResponse.json();
assert.equal(vehicleWarmupHit.cacheStatus, "hit");
assert.equal(catalogCalls, 1);
assert.equal(detailsCalls, 2);

const placeIdPhoto = await worker.fetch(
  new Request("https://app.otoustabul.com/functions/v1/app-shop-catalog/photo?placeId=a&maxwidth=420"),
  { ...env, ENABLE_GOOGLE_PLACES_PHOTO_FALLBACK: "true", GOOGLE_DAILY_PHOTO_LIMIT: "200" },
);
assert.equal(placeIdPhoto.status, 404);
assert.equal(photoCalls, 0);

cachedDetailsRows = [{
  shop_key: "a",
  details: {
    placeId: "a",
    exteriorPhotoUrl: "https://supabase.test/functions/v1/app-shop-catalog/photo?placeId=a&maxwidth=1200",
    photoCount: 1,
  },
}];
const cachedPlaceIdPhoto = await worker.fetch(
  new Request("https://app.otoustabul.com/functions/v1/app-shop-catalog/photo?placeId=a&maxwidth=420"),
  { ...env, ENABLE_GOOGLE_PLACES_PHOTO_FALLBACK: "true", GOOGLE_DAILY_PHOTO_LIMIT: "200" },
);
assert.equal(cachedPlaceIdPhoto.status, 200);
assert.equal(photoCalls, 1);
cachedDetailsRows = [];

const refPhoto = await worker.fetch(
  new Request("https://app.otoustabul.com/functions/v1/app-shop-catalog/photo?ref=photo-a&maxwidth=420"),
  { ...env, ENABLE_GOOGLE_PLACES_PHOTO_FALLBACK: "true", GOOGLE_DAILY_PHOTO_LIMIT: "200" },
);
assert.equal(refPhoto.status, 200);
assert.equal(photoCalls, 2);

console.log("worker behavior tests passed");
