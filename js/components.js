// ============================================================
// UstaBul Web - Yeniden kullanilabilir bilesenler
// ============================================================

function brandLogoHtml(size = "md") {
  const cls = size === "lg" ? "brand-logo-lg" : size === "sm" ? "brand-logo-sm" : "brand-logo-md";
  return `<div class="brand-logo ${cls}">
    <img class="brand-logo-img" src="assets/ustabul-logo.png" alt="UstaBul" draggable="false">
  </div>`;
}

document.addEventListener("error", e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const fallbackClass = img.dataset.photoFallback;
  if (!fallbackClass) return;
  img.parentElement?.classList.add(fallbackClass);
  img.remove();
}, true);

function uiIcon(name, extraClass = "") {
  const paths = {
    home: `<path d="m3 10.8 9-7.2 9 7.2"/><path d="M5.5 10.5V20h4.8v-5.7h3.4V20h4.8v-9.5"/>`,
    store: `<path d="M4.5 10h15"/><path d="m5.5 10 .9-5h11.2l.9 5"/><path d="M6.5 10v9h11v-9"/><path d="M9.5 19v-5h5v5"/>`,
    heart: `<path d="M20.3 5.4a5.2 5.2 0 0 0-7.4 0l-.9.9-.9-.9a5.2 5.2 0 0 0-7.4 7.4l.9.9L12 21l7.4-7.3.9-.9a5.2 5.2 0 0 0 0-7.4Z"/>`,
    settings: `<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8h.6a1.6 1.6 0 0 1 1.6 1.3l.2 1.1a7.9 7.9 0 0 1 1.5.9l1.1-.4a1.6 1.6 0 0 1 1.9.7l.3.5a1.6 1.6 0 0 1-.3 2l-.9.7a7.8 7.8 0 0 1 0 1.8l.9.7a1.6 1.6 0 0 1 .3 2l-.3.5a1.6 1.6 0 0 1-1.9.7l-1.1-.4a7.9 7.9 0 0 1-1.5.9l-.2 1.1a1.6 1.6 0 0 1-1.6 1.3h-1.2a1.6 1.6 0 0 1-1.6-1.3l-.2-1.1a7.9 7.9 0 0 1-1.5-.9l-1.1.4a1.6 1.6 0 0 1-1.9-.7l-.3-.5a1.6 1.6 0 0 1 .3-2l.9-.7a7.8 7.8 0 0 1 0-1.8l-.9-.7a1.6 1.6 0 0 1-.3-2l.3-.5a1.6 1.6 0 0 1 1.9-.7l1.1.4a7.9 7.9 0 0 1 1.5-.9l.2-1.1a1.6 1.6 0 0 1 1.6-1.3h.6Z"/>`,
    pin: `<path d="M12 21s6-5.4 6-11a6 6 0 0 0-12 0c0 5.6 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/>`,
    search: `<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>`,
    tag: `<path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8" cy="8" r="1.3"/>`,
    phone: `<path d="M6.5 4.5 9 4l1.4 4-1.8 1.1a12 12 0 0 0 6.3 6.3l1.1-1.8 4 1.4-.5 2.5c-.2 1-1 1.6-2 1.5C10.5 18.5 5.5 13.5 5 6.5c-.1-1 .5-1.8 1.5-2Z"/>`,
    map: `<path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z"/><path d="M9 4v14M15 6v14"/>`,
    share: `<path d="M8 12h8"/><path d="m13 8 4 4-4 4"/><path d="M5 5h6M5 19h6"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    shield: `<path d="M12 3 19 6v5c0 5-3.2 8-7 10-3.8-2-7-5-7-10V6l7-3Z"/>`,
    logout: `<path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4"/><path d="M8 12h9"/>`,
    trash: `<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M8 7l1 13h6l1-13"/>`,
    edit: `<path d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Z"/><path d="m14 7 2.5 2.5"/>`,
    eye: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>`,
    eyeOff: `<path d="M4 4l16 16"/><path d="M9.5 5.6A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3 3.7"/><path d="M14.1 14.1A3 3 0 0 1 9.9 9.9"/><path d="M6.1 7.8A16 16 0 0 0 2.5 12s3.5 7 9.5 7c1.1 0 2.1-.2 3-.6"/>`,
    warning: `<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>`,
    moon: `<path d="M20 14.4A7.5 7.5 0 0 1 9.6 4 8 8 0 1 0 20 14.4Z"/>`,
    check: `<path d="m5 12 4 4L19 6"/>`,
    thumbsUp: `<path d="M7 10v10H4V10h3Z"/><path d="M7 10l4-6h2l-1 5h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7"/>`,
    thumbsDown: `<path d="M7 14V4H4v10h3Z"/><path d="M7 14l4 6h2l-1-5h6a2 2 0 0 0 2-2l-1-7a2 2 0 0 0-2-2H7"/>`,
    flag: `<path d="M5 21V4h11l-1 4 1 4H5"/>`,
    sliders: `<path d="M4 7h10"/><path d="M18 7h2"/><path d="M14 5v4"/><path d="M4 17h2"/><path d="M10 17h10"/><path d="M8 15v4"/>`,
    clock: `<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>`,
    star: `<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>`,
    chevronDown: `<path d="m6 9 6 6 6-6"/>`,
    arrowLeft: `<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>`,
    close: `<path d="M6 6l12 12"/><path d="M18 6 6 18"/>`,
  };
  const body = paths[name] || paths.search;
  return `<svg class="ui-icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

function loadingHtml(text = "Yükleniyor...") {
  return `<div class="loading-state">
    <div class="spinner"></div>
    <p>${escHtml(text)}</p>
  </div>`;
}

function emptyStateHtml(icon, title, subtitle = "") {
  return `<div class="empty-state">
    <span class="empty-icon">${icon}</span>
    <h3>${escHtml(title)}</h3>
    ${subtitle ? `<p>${escHtml(subtitle)}</p>` : ""}
  </div>`;
}

function shopCardHtml(shop, isFavorite, showDistance = false) {
  const rating = shopRatingValue(shop);
  const reviewCount = shopReviewCount(shop);
  const categoryLabels = displayCategoryLabels(shop.categoryName).slice(0, 2);
  const openBadge = shop.isOpenNow === true
    ? `<span class="badge badge-open">${uiIcon("clock", "inline-icon")} Açık</span>`
    : shop.isOpenNow === false
    ? `<span class="badge badge-closed">${uiIcon("clock", "inline-icon")} Kapalı</span>`
    : "";
  const distText = showDistance && shop.distanceMeters != null
    ? `<span class="shop-distance">${uiIcon("pin", "inline-icon")} ${shop.distanceMeters < 1000
        ? `${Math.round(shop.distanceMeters)} m`
        : `${(shop.distanceMeters / 1000).toFixed(1)} km`}</span>`
    : "";
  const photoUrl = shopPhotoUrl(shop, 420);
  const photo = photoUrl
    ? `<div class="shop-card-photo"><img src="${escHtml(photoUrl)}" alt="" loading="lazy" data-photo-fallback="shop-card-photo-placeholder"></div>`
    : `<div class="shop-card-photo shop-card-photo-placeholder"><span>${escHtml(categoryIcon(shop.categoryName))}</span></div>`;
  const ratingPill = rating != null
    ? `<div class="rating-pill">${uiIcon("star", "inline-icon rating-star")} <strong>${formatRating(rating)}</strong>${reviewCount > 0 ? `<span>${reviewCount} yorum</span>` : ""}</div>`
    : "";

  return `<div class="shop-card" data-shop-id="${escHtml(shop.id)}" role="button" tabindex="0">
    ${photo}
    <button class="fav-btn ${isFavorite ? "fav-active" : ""}" data-fav-id="${escHtml(shop.id)}" title="${isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}">
      ${uiIcon("heart")}
    </button>
    <div class="shop-card-body">
      <div class="shop-card-kicker">
        ${categoryLabels.length ? `<div class="shop-category-badges">
          ${categoryLabels.map((label, index) => `
            <span class="shop-category-badge">${uiIcon(index === 0 ? "store" : "tag", "inline-icon")} ${escHtml(label)}</span>
          `).join("")}
        </div>` : ""}
        ${ratingPill}
      </div>
      <h3 class="shop-name">${escHtml(shop.name)}</h3>
      <p class="shop-address">${escHtml(shop.address)}</p>
      <div class="shop-meta">${openBadge}${distText}</div>
    </div>
  </div>`;
}

function commentCardHtml(comment, voteType = null, isLoggedIn = false) {
  const avg = formatRating(commentRatingValue(comment));
  const badges = [];
  if (comment.isOfficiallyVerified) badges.push(`<span class="badge badge-verified">Fatura doğrulandı</span>`);
  else if (comment.isVerified) badges.push(`<span class="badge badge-verified-light">Belge var</span>`);
  if (comment.authorHasVerifiedBadge) badges.push(`<span class="badge badge-author">Onaylı üye</span>`);

  return `<div class="comment-card" data-comment-id="${escHtml(comment.id)}">
    <div class="comment-header">
      <div class="comment-author">
        <span class="comment-avatar">${escHtml((comment.username || "?").slice(0, 1).toUpperCase())}</span>
        <div>
          <span class="comment-username">${escHtml(comment.username || "Anonim")}</span>
          <span class="comment-time">${comment.timestamp ? timeAgo(comment.timestamp) : ""}</span>
        </div>
      </div>
      <div class="comment-ratings">${uiIcon("star", "inline-icon rating-star")} <span title="Genel">${avg}</span></div>
    </div>
    ${badges.length ? `<div class="comment-badges">${badges.join("")}</div>` : ""}
    <div class="comment-ratings-detail">
      <span>Fiyat <strong>${comment.priceRating}/5</strong></span>
      <span>Memnuniyet <strong>${comment.satisfactionRating}/5</strong></span>
    </div>
    <p class="comment-text">${escHtml(comment.text)}</p>
    ${isLoggedIn ? `<div class="comment-actions">
      <button class="vote-btn ${voteType === "helpful" ? "vote-active" : ""}" data-vote="helpful" data-comment-id="${escHtml(comment.id)}">
        ${uiIcon("thumbsUp", "inline-icon")} <span class="vote-count">${comment.helpfulCount || 0}</span>
      </button>
      <button class="vote-btn ${voteType === "unhelpful" ? "vote-active-neg" : ""}" data-vote="unhelpful" data-comment-id="${escHtml(comment.id)}">
        ${uiIcon("thumbsDown", "inline-icon")} <span class="vote-count">${comment.unhelpfulCount || 0}</span>
      </button>
      <button class="report-btn" data-comment-id="${escHtml(comment.id)}">${uiIcon("flag", "inline-icon")} Şikayet</button>
    </div>` : `<div class="comment-actions">
      <span class="vote-display">${uiIcon("thumbsUp", "inline-icon")} ${comment.helpfulCount || 0}</span>
      <span class="vote-display">${uiIcon("thumbsDown", "inline-icon")} ${comment.unhelpfulCount || 0}</span>
    </div>`}
  </div>`;
}

function googleReviewCardHtml(review) {
  const rating = review.rating ?? null;
  return `<div class="comment-card google-review-card">
    <div class="comment-header">
      <div class="comment-author">
        <span class="comment-avatar google-avatar">G</span>
        <div>
          <span class="comment-username">${escHtml(review.authorName || "Anonim")}</span>
          <span class="comment-time">${escHtml(review.relativeTimeDescription || "")}</span>
        </div>
      </div>
      ${rating != null ? `<div class="comment-ratings">${uiIcon("star", "inline-icon rating-star")} <span title="Google puani">${rating}/5</span></div>` : ""}
    </div>
    <div class="comment-badges"><span class="badge badge-google">Google yorumu</span></div>
    <p class="comment-text">${escHtml(review.text || "")}</p>
    <div class="comment-actions">
      <span class="vote-display" style="font-size:12px;color:var(--on-surface-muted)">Google Maps üzerinden</span>
    </div>
  </div>`;
}

function createModal(id, title, bodyHtml, footerHtml = "") {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const modal = document.createElement("div");
  const fullScreenIds = new Set([
    "shop-detail-modal",
    "home-filter-modal",
    "add-review-modal",
    "delete-account-modal",
    "add-shop-modal",
    "moderation-modal",
    "proof-verification-modal",
  ]);
  modal.id = id;
  modal.className = `modal-overlay${fullScreenIds.has(id) ? " modal-fullscreen" : ""}`;
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2>${escHtml(title)}</h2>
        <button class="modal-close" data-modal-id="${id}" aria-label="Kapat">${uiIcon("close")}</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
    </div>`;
  document.body.appendChild(modal);
  document.body.classList.add("modal-open");
  modal.querySelector(".modal-close").addEventListener("click", () => closeModal(id));
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(id); });
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
  return modal;
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("modal-visible");
  setTimeout(() => {
    modal.remove();
    if (!document.querySelector(".modal-overlay")) document.body.classList.remove("modal-open");
  }, 250);
}

function confirmDialog(message) {
  return new Promise(resolve => {
    const modal = createModal("confirm-dialog", "Onay",
      `<p>${escHtml(message)}</p>`,
      `<button class="btn btn-secondary" id="confirm-no">İptal</button>
       <button class="btn btn-primary" id="confirm-yes">Evet</button>`
    );
    modal.querySelector("#confirm-yes").onclick = () => { closeModal("confirm-dialog"); resolve(true); };
    modal.querySelector("#confirm-no").onclick = () => { closeModal("confirm-dialog"); resolve(false); };
  });
}

function categoryChipsHtml(selectedKey, includeAll = true) {
  const activeKey = categoryKey(selectedKey, includeAll ? "All" : "");
  const visibleCategories = includeAll
    ? DISCOVERY_CATEGORIES
    : DISCOVERY_CATEGORIES.filter(category => category.key !== "All");
  const visibleKeys = new Set(visibleCategories.map(category => category.key));

  return CATEGORY_GROUPS.map(group => {
    const categories = group.keys
      .filter(key => visibleKeys.has(key))
      .map(key => visibleCategories.find(category => category.key === key))
      .filter(Boolean);

    if (!categories.length) return "";

    return `
      <section class="category-group">
        <div class="category-group-title">
          <span>${escHtml(group.title)}</span>
          ${group.note ? `<small>${escHtml(group.note)}</small>` : ""}
        </div>
        <div class="category-chip-grid">
          ${categories.map(c => `
            <button class="chip ${c.key === activeKey ? "chip-active" : ""}" type="button" data-category="${c.key}">
              ${escHtml(c.label)}
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function algorithmGridHtml(selectedKey) {
  const visibleAlgorithms = HOME_ALGORITHMS.filter(a => a.key !== "DefaultFlow");
  return `<div class="algo-grid">
    ${visibleAlgorithms.map(a => `
      <button class="algo-card ${a.key === selectedKey ? "algo-card-active" : ""}" type="button" data-algo="${escHtml(a.key)}">
        <span class="algo-icon">${escHtml(a.icon || "UB")}</span>
        <span class="algo-label">${escHtml(a.label)}</span>
      </button>`).join("")}
  </div>`;
}

function serviceBrandGridHtml(selectedBrand) {
  const trimmed = (selectedBrand || "").trim();
  const all = `<button class="chip ${trimmed === "" ? "chip-active" : ""}" type="button" data-brand="">Tüm Markalar</button>`;
  const brands = SERVICE_BRANDS.map(b =>
    `<button class="chip ${trimmed === b ? "chip-active" : ""}" type="button" data-brand="${escHtml(b)}">${escHtml(b)}</button>`
  ).join("");
  return `<div class="brand-grid">${all}${brands}</div>`;
}

function serviceModelGridHtml(models, selectedModel) {
  const trimmed = (selectedModel || "").trim();
  const all = `<button class="chip ${trimmed === "" ? "chip-active" : ""}" type="button" data-model="">Tüm Modeller</button>`;
  const modelButtons = (models || []).map(model =>
    `<button class="chip ${trimmed === model ? "chip-active" : ""}" type="button" data-model="${escHtml(model)}">${escHtml(model)}</button>`
  ).join("");
  return `<div class="brand-grid">${all}${modelButtons}</div>`;
}
