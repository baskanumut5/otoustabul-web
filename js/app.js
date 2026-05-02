// ============================================================
// UstaBul Web - Uygulama Baslatici
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.setAttribute("data-theme", store.isDarkMode ? "dark" : "light");
  document.getElementById("theme-color-meta")?.setAttribute("content", store.isDarkMode ? "#000000" : "#1E5EFF");

  const hasProxy = Boolean(String(CONFIG.API_BASE_URL || "").trim());
  const hasDirect = Boolean(CONFIG.USE_SUPABASE_DIRECT && String(CONFIG.SUPABASE_ANON_KEY || "").trim());

  if (!hasProxy && !hasDirect) {
    document.getElementById("app-root").innerHTML = `
      <div class="config-warning-shell">
        <div class="config-warning-card">
          <img src="assets/ustabul-logo.png" alt="UstaBul" class="config-warning-logo">
          <h1 class="config-warning-title">UstaBul Web</h1>
          <p class="config-warning-text">
            Uygulamayi baslatmak icin <strong>js/config.js</strong> dosyasini duzenleyin.
          </p>
          <div class="config-warning-code">
            <div>SUPABASE_URL: <em>""</em></div>
            <div class="config-warning-code-row">API_BASE_URL: <strong>"&larr; Proxy URL (onerilen)"</strong></div>
            <div class="config-warning-code-row">TURNSTILE_SITE_KEY: <em>"&larr; Turnstile site key (kayit icin)"</em></div>
          </div>
          <p class="config-warning-note">
            Guvenlik icin Supabase anon key'i tarayiciya koymayin; bir proxy (Cloudflare Worker gibi) kullanin.
          </p>
        </div>
      </div>`;
    return;
  }

  renderApp();
});
