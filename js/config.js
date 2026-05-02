// ============================================================
// UstaBul Web - KonfigÃ¼rasyon
// Bu deÄŸerleri kendi projenize gÃ¶re doldurun
// ============================================================
const CONFIG = {
  // Supabase projenizin URL'i (proxy worker bunu kullanÄ±r)
  SUPABASE_URL: "https://rfoatwcfqcwyfyffahbx.supabase.co",

  // GÃ¼venlik: web client'ta Supabase anon key tutmayÄ±n.
  // Bunun yerine Supabase Ã§aÄŸrÄ±larÄ±nÄ± bir proxy (Ã¶r. Cloudflare Worker) Ã¼zerinden yapÄ±n.
  // Ã–rnek: "https://ustabul-api.<kullanici>.workers.dev"
  API_BASE_URL: "https://ustabul-api-proxy.app-ustabul.workers.dev",

  // Sadece local/test amaÃ§lÄ±: doÄŸrudan Supabase'e baÄŸlanmak isterseniz aÃ§Ä±n.
  USE_SUPABASE_DIRECT: false,
  SUPABASE_ANON_KEY: "",

  // Cloudflare Turnstile (kayÄ±t iÃ§in)
  TURNSTILE_SITE_KEY: "0x4AAAAAACv2tWcY9Pa6fZI_",
  // Local geliştirme için Cloudflare'in resmi test site key'i.
  // Bunu ancak backend de test secret ile doğrulama yapıyorsa açın.
  TURNSTILE_DEV_SITE_KEY: "1x00000000000000000000AA",
  TURNSTILE_USE_TEST_KEY_ON_LOCALHOST: false,
  // Gerekirse hostname bazlı key eşlemesi yapın.
  // Örnek:
  // TURNSTILE_SITE_KEY_BY_HOST: {
  //   "ustabul.com": "0x4AAAA....",
  //   "www.ustabul.com": "0x4AAAA....",
  // },
  TURNSTILE_SITE_KEY_BY_HOST: {},

  // Google AdSense
  // Reklamlari actirmadan once kendi ca-pub ve ad slot degerlerinizi girin.
  ADSENSE_ENABLED: false,
  ADSENSE_CLIENT_ID: "",
  ADSENSE_INLINE_SLOT_ID: "",
  ADSENSE_INLINE_FREQUENCY: 5,
  ADSENSE_LOAD_AFTER_SHOP_DETAIL_OPENS: 3,
  ADSENSE_ALLOW_ON_LOCALHOST: false,

  PRIVACY_POLICY_URL: "https://baskanumut5.github.io/ustabul-account-delete/privacy-policy.html",
  TERMS_OF_SERVICE_URL: "",
  PRIVACY_POLICY_VERSION: "2026-04-17",
  TERMS_OF_SERVICE_VERSION: "2026-04-17",
  ACCOUNT_DELETION_URL: "https://baskanumut5.github.io/ustabul-account-delete/",

  FIREBASE_CONFIG: {
    apiKey: "AIzaSyBtUoXrrzR4DzQLoXB166TCVv9yR0sfi_U",
    authDomain: "ustabul-app.firebaseapp.com",
    projectId: "ustabul-app",
    storageBucket: "ustabul-app.firebasestorage.app",
    messagingSenderId: "492021547167",
    appId: "1:492021547167:web:493a4886dbc62d0e7622aa",
  },

  // DIKKAT: Google Places API anahtari web client'a konmaz.
  // Dukkan fotograflari backend/proxy uzerinden alinir.
  ENABLE_GOOGLE_PLACES_PHOTOS: false,
  GOOGLE_PLACES_API_KEY: "",

  MODERATOR_USERNAMES: ["mehmetsattuf"],
  DEFAULT_CITY: "Denizli",
  DEFAULT_DISTRICT: "Merkezefendi",
};
