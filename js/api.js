// ============================================================
// UstaBul Web - Supabase API Katmanı
// ============================================================

class UstaBulAPI {
  constructor() {
    this.proxyBaseUrl = String(CONFIG.API_BASE_URL || "").trim().replace(/\/+$/, "");
    this.direct = !this.proxyBaseUrl && Boolean(CONFIG.USE_SUPABASE_DIRECT);
    this.baseUrl = this.proxyBaseUrl || String(CONFIG.SUPABASE_URL || "").trim().replace(/\/+$/, "");
    this.anonKey = this.direct ? String(CONFIG.SUPABASE_ANON_KEY || "").trim() : "";
  }

  get isConfigured() {
    return Boolean(this.proxyBaseUrl) || (this.baseUrl && this.direct && this.anonKey);
  }

  async _callFunction(functionName, body, sessionToken = null) {
    const headers = { "Content-Type": "application/json" };
    if (this.direct) {
      headers.apikey = this.anonKey;
      headers.Authorization = `Bearer ${this._authBearer(sessionToken)}`;
    } else if (this._isJwt(sessionToken)) {
      headers.Authorization = `Bearer ${sessionToken.trim()}`;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}/functions/v1/${functionName}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (res.ok) return res.json();
        const err = await this._readError(res);
        if (attempt === 0 && this._isTransientError(err)) {
          await this._sleep(600);
          continue;
        }
        throw err;
      } catch (err) {
        if (attempt === 0 && this._isTransientError(err)) {
          await this._sleep(600);
          continue;
        }
        throw err;
      }
    }
  }

  async _callRpc(rpcName, params, sessionToken = null) {
    const headers = { "Content-Type": "application/json" };
    if (this.direct) {
      headers.apikey = this.anonKey;
      headers.Authorization = `Bearer ${this._authBearer(sessionToken)}`;
    } else if (this._isJwt(sessionToken)) {
      headers.Authorization = `Bearer ${sessionToken.trim()}`;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}/rest/v1/rpc/${rpcName}`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
        if (res.ok) return res.json();
        const err = await this._readError(res);
        if (attempt === 0 && this._isTransientError(err)) {
          await this._sleep(600);
          continue;
        }
        throw err;
      } catch (err) {
        if (attempt === 0 && this._isTransientError(err)) {
          await this._sleep(600);
          continue;
        }
        throw err;
      }
    }
  }

  async _readError(res) {
    const text = await res.text();
    const fallback = `HTTP ${res.status}`;
    try {
      const data = JSON.parse(text);
      const err = new Error(data.message || data.error || data.code || fallback);
      err.status = res.status;
      err.code = data.code || "";
      return err;
    } catch {
      const err = new Error(text || fallback);
      err.status = res.status;
      err.code = "";
      return err;
    }
  }

  _isTransientError(err) {
    return [502, 503, 504, 546].includes(Number(err?.status)) ||
      err?.code === "WORKER_RESOURCE_LIMIT" ||
      err?.message === "Failed to fetch" ||
      err?.name === "TypeError";
  }

  _authBearer(sessionToken) {
    return this._isJwt(sessionToken) ? sessionToken : this.anonKey;
  }

  _isJwt(value) {
    if (!value || typeof value !== "string") return false;
    const token = value.trim();
    return token.split(".").length === 3;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Auth ---

  async register({ username, realName, password, phoneNumber, roleKey, city, district, captchaToken, acceptedLegal = false }) {
    const privacyPolicyVersion = String(CONFIG.PRIVACY_POLICY_VERSION || "").trim();
    const termsOfServiceVersion = String(CONFIG.TERMS_OF_SERVICE_VERSION || "").trim();
    const acceptanceSource = "web_register";
    const data = await this._callFunction("register-with-captcha", {
      token: captchaToken,
      username,
      realName,
      password,
      phoneNumber,
      roleKey,
      city,
      district,
      acceptedLegal,
      privacyPolicyAccepted: acceptedLegal,
      termsOfServiceAccepted: acceptedLegal,
      privacyPolicyVersion,
      termsOfServiceVersion,
      acceptanceSource,
      privacy_policy_accepted: acceptedLegal,
      terms_of_service_accepted: acceptedLegal,
      privacy_policy_version: privacyPolicyVersion,
      terms_of_service_version: termsOfServiceVersion,
      acceptance_source: acceptanceSource,
    });
    return this._parseAuthResponse(data);
  }

  async login({ username, password, captchaToken = "" }) {
    const data = await this._callFunction("app-login", { username, password, captchaToken });
    return this._parseAuthResponse(data);
  }

  async revokeSession(sessionToken) {
    await this._callFunction("app-secure-actions", {
      action: "revoke_session",
      sessionToken,
    }, sessionToken);
  }

  async requestAccountDeletion({ sessionToken, password, reason, captchaToken = "" }) {
    await this._callFunction("app-secure-actions", {
      action: "request_account_deletion",
      sessionToken,
      password,
      reason,
      captchaToken,
      source: "web",
    }, sessionToken);
  }

  async fetchCurrentUser(sessionToken) {
    const data = await this._callFunction("app-secure-actions", {
      action: "get_current_user",
      sessionToken,
    }, sessionToken);
    return this._parseAuthResponse({ ...data, sessionToken });
  }

  _parseAuthResponse(data) {
    const user = data?.user || data?.appUser || data?.app_user || data;
    const sessionExpiresAt = data?.sessionExpiresAt || data?.session_expires_at ||
      user?.sessionExpiresAt || user?.session_expires_at || "";
    const rawSessionExpiresAtMillis = data?.sessionExpiresAtMillis ||
      data?.session_expires_at_millis ||
      user?.sessionExpiresAtMillis ||
      user?.session_expires_at_millis ||
      (sessionExpiresAt ? Date.parse(sessionExpiresAt) : 0);
    const verifiedBadgeStatus = user?.verifiedBadgeStatus || user?.verified_badge_status || "";
    if (!data) throw new Error("Sunucu boş yanıt döndürdü.");
    return {
      username: user?.username || data.username || "",
      realName: user?.realName || user?.real_name || data.realName || data.real_name || "",
      phoneNumber: user?.phoneNumber || user?.phone_number || data.phoneNumber || data.phone_number || "",
      role: user?.role || user?.roleKey || user?.role_key || data.role || data.roleKey || data.role_key || "Customer",
      city: user?.city || data.city || "",
      district: user?.district || data.district || "",
      sessionToken: data.sessionToken || data.session_token || user?.sessionToken || user?.session_token || "",
      sessionExpiresAtMillis: Number.isFinite(Number(rawSessionExpiresAtMillis)) ? Number(rawSessionExpiresAtMillis) : 0,
      hasVerifiedBadge: Boolean(data.hasVerifiedBadge || user?.hasVerifiedBadge || (verifiedBadgeStatus && verifiedBadgeStatus !== "none")),
      verifiedBadgeSource: user?.verifiedBadgeSource || user?.verified_badge_source || "",
      verifiedBadgeGrantedAt: user?.verifiedBadgeGrantedAt || user?.verified_badge_granted_at || "",
    };
  }

  // --- Shop Catalog ---

  async fetchDirectory({ city, district, category = "All", serviceBrand = "", serviceModel = "", searchQuery = "", offset = 0, limit = null }) {
    return await this._fetchDirectoryRaw({ city, district, category, serviceBrand, serviceModel, searchQuery, offset, limit });
  }

  async _fetchDirectoryRaw({ city, district, category = "All", serviceBrand = "", serviceModel = "", searchQuery = "", offset = 0, limit = null }) {
    const data = await this._callFunction("app-shop-catalog", {
      action: "get_directory",
      city,
      district,
      category,
      serviceBrand: serviceBrand.trim(),
      serviceModel: serviceModel.trim(),
      searchQuery: searchQuery.trim(),
      offset: Math.max(0, offset),
      limit,
    });
    return {
      shops: (data.shops || []).map(this._parseShop),
      total: data.totalCount ?? data.total ?? 0,
      nextOffset: data.nextOffset ?? null,
      hasMore: Boolean(data.hasMore),
      source: data.source || "",
    };
  }

  async fetchPlaceSnapshot(placeId) {
    const data = await this._callFunction("app-shop-catalog", {
      action: "get_place_snapshot",
      placeId,
    });
    return data.snapshot || null;
  }

  async fetchPlaceDetails(placeId) {
    const data = await this._callFunction("app-shop-catalog", {
      action: "get_place_details",
      placeId,
    });
    return data.details || null;
  }

  async fetchHomeRankings({ city, district, category, serviceBrand = "", serviceModel = "", algorithm = "" }) {
    const data = await this._callFunction("app-shop-catalog", {
      action: "get_home_rankings",
      city,
      district,
      category,
      serviceBrand: serviceBrand.trim(),
      serviceModel: serviceModel.trim(),
      algorithm: algorithm.trim(),
    });
    const r = data.rankings || {};
    return {
      rankedShops: (r.rankedShops || r.shops || []).map(s => this._parseShop(s)),
      recentlyLikedThreadIds: (r.recentlyLikedThreadIds || []).map(s => String(s).trim()).filter(Boolean),
      ustaBulSelectedThreadIds: (r.ustaBulSelectedThreadIds || []).map(s => String(s).trim()).filter(Boolean),
      worstRatedThreadIds: (r.worstRatedThreadIds || []).map(s => String(s).trim()).filter(Boolean),
    };
  }

  async fetchServiceModels({ brand, category = "OtoServis" }) {
    const data = await this._callFunction("app-shop-catalog", {
      action: "get_service_models",
      category,
      serviceBrand: String(brand || "").trim(),
    });
    return Array.isArray(data.models)
      ? data.models.map(model => String(model).trim()).filter(Boolean)
      : [];
  }

  _parseShop(s) {
    const googleRating = s.googleRating ?? s.google_rating ?? s.rating ?? s.placeRating ?? s.place_rating ?? s.googlePlaceRating ?? s.google_place_rating ?? null;
    const googleReviewCount = s.googleReviewCount ?? s.google_review_count ?? s.userRatingsTotal ?? s.user_ratings_total ?? s.googleUserRatingsTotal ?? s.google_user_ratings_total ?? s.ratingCount ?? s.rating_count ?? s.reviewCount ?? s.review_count ?? 0;
    const displayRating = s.displayRating ?? s.display_rating ?? s.appDisplayRating ?? s.app_display_rating ?? s.backendRating ?? s.backend_rating ?? s.calculatedRating ?? s.calculated_rating ?? null;
    const displayReviewCount = s.displayReviewCount ?? s.display_review_count ?? s.appReviewCount ?? s.app_review_count ?? s.backendReviewCount ?? s.backend_review_count ?? s.calculatedReviewCount ?? s.calculated_review_count ?? null;
    return {
      id: s.id || s.place_id || "",
      name: s.name || "",
      address: s.address || "",
      phone: s.phone || "",
      latitude: s.latitude || 0,
      longitude: s.longitude || 0,
      categoryName: s.categoryName || s.category_name || "",
      displayRating,
      displayReviewCount,
      googleRating,
      googleReviewCount,
      googleWrittenReviewAverage: s.googleWrittenReviewAverage ?? s.google_written_review_average ?? null,
      googleWrittenReviewCount: s.googleWrittenReviewCount || s.google_written_review_count || 0,
      appCommentAverage: s.appCommentAverage ?? s.app_comment_average ?? null,
      appCommentCount: s.appCommentCount || s.app_comment_count || 0,
      appOneStarCount: s.appOneStarCount ?? s.app_one_star_count ?? s.oneStarCount ?? s.one_star_count ?? 0,
      appMinRating: s.appMinRating ?? s.app_min_rating ?? s.minRating ?? s.min_rating ?? null,
      overallRating: s.overallRating ?? s.overall_rating ?? null,
      overallReviewCount: s.overallReviewCount ?? s.overall_review_count ?? 0,
      placeId: s.placeId || s.place_id || null,
      photoReferences: normalizePhotoReferences(s.photoReferences ?? s.photo_references ?? []),
      exteriorPhotoUrl: s.exteriorPhotoUrl || s.exterior_photo_url || null,
      photoCount: s.photoCount || s.photo_count || 0,
      isOpenNow: s.isOpenNow ?? s.is_open_now ?? null,
      distanceMeters: s.distanceMeters || s.distance_meters || null,
    };
  }

  // --- Comments ---

  async fetchCommentsForShop(shopId, sessionToken) {
    const data = await this._callRpc("get_public_comments_for_shop", { p_shop_id: shopId });
    return (data || [])
      .map(this._parseComment)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async fetchAllComments(sessionToken) {
    const data = await this._callRpc("get_public_comments_page", { p_limit: 500, p_offset: 0 });
    return (data || [])
      .map(this._parseComment)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async addComment({ shopId, text, priceRating, satisfactionRating, sessionToken, captchaToken = "" }) {
    await this._callFunction("app-secure-actions", {
      action: "add_comment",
      sessionToken,
      shopId,
      text,
      priceRating,
      satisfactionRating,
      captchaToken,
    }, sessionToken);
  }

  async toggleHelpful(commentId, sessionToken) {
    await this._callFunction("app-secure-actions", {
      action: "toggle_comment_feedback",
      sessionToken,
      commentId,
      helpful: true,
    }, sessionToken);
  }

  async toggleUnhelpful(commentId, sessionToken) {
    await this._callFunction("app-secure-actions", {
      action: "toggle_comment_feedback",
      sessionToken,
      commentId,
      helpful: false,
    }, sessionToken);
  }

  async reportComment({ commentId, shopId, reason, sessionToken, captchaToken = "" }) {
    await this._callFunction("app-secure-actions", {
      action: "report_comment",
      sessionToken,
      commentId,
      shopId,
      reportReasonCode: reason,
      reportReasonText: reason === "other" ? "Web bildirimi" : "",
      captchaToken,
    }, sessionToken);
  }

  async submitShopRequest({
    sessionToken,
    shopName,
    shopAddress,
    shopPhone,
    shopCategoryName,
    captchaToken = "",
  }) {
    await this._callFunction("app-secure-actions", {
      action: "submit_shop_request",
      sessionToken,
      shopName,
      shopAddress,
      shopPhone,
      shopCategoryName,
      shopPhotoUri: "",
      shopPhotoBase64: "",
      shopPhotoFileName: "",
      shopPhotoMimeType: "",
      captchaToken,
    }, sessionToken);
  }

  async fetchCommentVotes(sessionToken) {
    if (!sessionToken) return {};
    const data = await this._callFunction("app-secure-actions", {
      action: "get_comment_feedbacks",
      sessionToken,
    }, sessionToken);
    return (data.votes || []).reduce((acc, vote) => {
      const id = vote.commentId || vote.comment_id;
      const type = vote.voteType || vote.vote_type;
      if (id && type) acc[id] = type;
      return acc;
    }, {});
  }

  _parseComment(c) {
    const rawTimestamp = c.timestamp ?? c.createdAt ?? c.created_at ?? c.insertedAt ?? c.inserted_at ?? c.updatedAt ?? c.updated_at;
    let timestamp = 0;
    if (typeof rawTimestamp === "number") {
      timestamp = rawTimestamp > 10000000000 ? rawTimestamp : rawTimestamp * 1000;
    } else if (rawTimestamp) {
      const parsed = new Date(rawTimestamp).getTime();
      timestamp = Number.isFinite(parsed) ? parsed : 0;
    }

    return {
      id: c.id,
      shopId: c.shopId || c.shop_id || "",
      shopName: c.shopName || c.shop_name || c.shop?.name || "",
      username: c.username || c.author_name || "",
      text: c.text || c.body || "",
      priceRating: c.priceRating || c.price_rating || 0,
      satisfactionRating: c.satisfactionRating || c.satisfaction_rating || 0,
      rating: c.rating ?? null,
      starRating: c.starRating ?? c.star_rating ?? null,
      averageRating: c.averageRating ?? c.average_rating ?? null,
      isVerified: c.isVerified || c.is_verified || false,
      isOfficiallyVerified: c.isOfficiallyVerified || c.is_officially_verified || false,
      proofDocumentType: c.proofDocumentType || c.proof_document_type || "none",
      proofVerificationStatus: c.proofVerificationStatus || c.proof_verification_status || "none",
      authorHasVerifiedBadge: c.authorHasVerifiedBadge || c.author_has_verified_badge || false,
      helpfulCount: c.helpfulCount || c.helpful_count || 0,
      unhelpfulCount: c.unhelpfulCount || c.unhelpful_count || 0,
      timestamp,
    };
  }

  // --- Moderation ---

  async getModerationQueue(sessionToken) {
    const data = await this._callFunction("app-secure-actions", {
      action: "get_moderation_queue",
      sessionToken,
    }, sessionToken);
    return data || { proofReviews: [], commentReports: [], accountDeletionRequests: [], shopRequests: [] };
  }

  async moderateCommentReport({ reportId, decision, sessionToken }) {
    await this._callFunction("app-secure-actions", {
      action: "moderate_comment_report",
      sessionToken,
      moderationReportId: reportId,
      moderationDecision: decision,
      moderationNote: "web_moderation",
    }, sessionToken);
  }

  async deleteCommentAsModerator({ commentId, sessionToken }) {
    await this._callFunction("app-secure-actions", {
      action: "delete_comment",
      sessionToken,
      commentId,
      moderationNote: "web_moderation",
    }, sessionToken);
  }

  async moderateAccountDeletion({ requestId, decision, sessionToken }) {
    await this._callFunction("app-secure-actions", {
      action: "moderate_account_deletion",
      sessionToken,
      moderationRequestId: requestId,
      moderationDecision: decision,
      moderationNote: "web_moderation",
    }, sessionToken);
  }

  async moderateShopRequest({ requestId, decision, sessionToken }) {
    await this._callFunction("app-secure-actions", {
      action: "moderate_shop_request",
      sessionToken,
      moderationRequestId: requestId,
      moderationDecision: decision,
      moderationNote: "web_moderation",
    }, sessionToken);
  }

  async moderateProofReview({ reviewId, decision, sessionToken }) {
    await this._callFunction("app-secure-actions", {
      action: "moderate_proof_review",
      sessionToken,
      moderationRequestId: reviewId,
      moderationDecision: decision,
      moderationNote: "web_moderation",
    }, sessionToken);
  }
}

const api = new UstaBulAPI();
