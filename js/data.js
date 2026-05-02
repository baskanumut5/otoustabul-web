// ============================================================
// Sabit veriler: Kategoriler, Sehirler, Ilceler, Markalar
// ============================================================

const CATEGORIES = [
  { key: "All", label: "T\u00fcm\u00fc", icon: "ALL" },
  { key: "OtoServis", label: "Oto Servis", icon: "OS" },
  { key: "TicariAracServisi", label: "Ticari Ara\u00e7 Servisi", icon: "TA" },
  { key: "AgirVasitaServisi", label: "A\u011f\u0131r Vas\u0131ta Servisi", icon: "AV" },
  { key: "KaravanServisi", label: "Karavan Servisi", icon: "KV" },
  { key: "Motorsiklet", label: "Motosiklet Servisi", icon: "MS" },
  { key: "YedekParca", label: "Yedek Par\u00e7a / Aksesuar", icon: "YP" },
  { key: "TurboServisi", label: "Turbo Servisi", icon: "TB" },
  { key: "PompaEnjektorServisi", label: "Pompa & Enjekt\u00f6r Servisi", icon: "PE" },
  { key: "OtoSanziman", label: "\u015eanz\u0131man Servisi", icon: "SZ" },
  { key: "Egzozcu", label: "Egzoz Servisi", icon: "EG" },
  { key: "MotorYenileme", label: "Motor Yenileme Merkezi", icon: "MY" },
  { key: "Kaporta", label: "Oto Kaporta Merkezi", icon: "KP" },
  { key: "Boya", label: "Oto Boya Merkezi", icon: "BY" },
  { key: "BoyasizGocukDuzeltme", label: "Boyas\u0131z G\u00f6\u00e7\u00fck (PDR) Merkezi", icon: "PDR" },
  { key: "Elektrik", label: "Oto Elektrik", icon: "EL" },
  { key: "OtoKlima", label: "Oto Klima Servisi", icon: "KL" },
  { key: "AracElektronik", label: "Ara\u00e7 Elektronik Servisi", icon: "AE" },
  { key: "Beyin", label: "Chip Tuning & Yaz\u0131l\u0131m Merkezi", icon: "CT" },
  { key: "OtoCam", label: "Oto Cam Servisi", icon: "CM" },
  { key: "OtoCilingir", label: "Oto \u00c7ilingir", icon: "CL" },
  { key: "OtoCekiciKurtarma", label: "Oto Kurtarma & \u00c7ekici", icon: "CK" },
  { key: "YolYardim", label: "Yol Yard\u0131m Servisi", icon: "YY" },
  { key: "AkuServisi", label: "Ak\u00fc Servisi", icon: "AK" },
  { key: "Lastik", label: "Lastik Rot Balans Servisi", icon: "LT" },
  { key: "JantOnarim", label: "Jant Onar\u0131m Merkezi", icon: "JT" },
  { key: "OtoDoseme", label: "Oto D\u00f6\u015feme Merkezi", icon: "DS" },
  { key: "VipIcMekanTasarim", label: "VIP \u0130\u00e7 Mekan Tasar\u0131m", icon: "VIP" },
  { key: "OtoYikama", label: "Oto Y\u0131kama", icon: "YK" },
  { key: "Detailing", label: "Oto Kuaf\u00f6r", icon: "DK" },
  { key: "AracKaplama", label: "Ara\u00e7 Kaplama Merkezi", icon: "AKP" },
  { key: "CamFilmi", label: "Cam Filmi Uygulama", icon: "CF" },
  { key: "OtoEkspertiz", label: "Oto Ekspertiz", icon: "EX" },
  { key: "AracTestKontrol", label: "Ara\u00e7 Test & Kontrol", icon: "TK" },
  { key: "AracKiralama", label: "Ara\u00e7 Kiralama", icon: "KR" },
  { key: "FiloKiralama", label: "Filo Kiralama", icon: "FL" },
  { key: "TransferSirketi", label: "Transfer \u015eirketi", icon: "TR" },
];

const NON_SELECTABLE_CATEGORY_KEYS = new Set([
  "AracElektronik",
  "YolYardim",
  "AracTestKontrol",
  "FiloKiralama",
  "TransferSirketi",
]);

const DISCOVERY_CATEGORIES = CATEGORIES.filter(category =>
  category.key === "All" || !NON_SELECTABLE_CATEGORY_KEYS.has(category.key)
);

const CATEGORY_GROUPS = [
  { title: "T\u00fcm Kategoriler", keys: ["All"] },
  { title: "Ara\u00e7 Servisleri", note: "Araba Modeli Se\u00e7ilebilir", keys: ["OtoServis", "TicariAracServisi", "AgirVasitaServisi", "KaravanServisi", "Motorsiklet", "YedekParca"] },
  { title: "Motor & Mekanik", keys: ["TurboServisi", "PompaEnjektorServisi", "OtoSanziman", "Egzozcu", "MotorYenileme"] },
  { title: "Kaporta, Boya & G\u00f6vde", keys: ["Kaporta", "Boya", "BoyasizGocukDuzeltme"] },
  { title: "Elektrik, Elektronik & Teknoloji", keys: ["Elektrik", "OtoKlima", "Beyin"] },
  { title: "Cam, Kilit & G\u00fcvenlik", keys: ["OtoCam", "OtoCilingir"] },
  { title: "Yol Yard\u0131m & Acil Hizmetler", keys: ["OtoCekiciKurtarma", "AkuServisi"] },
  { title: "Lastik & Jant", keys: ["Lastik", "JantOnarim"] },
  { title: "D\u00f6\u015feme & \u0130\u00e7 Tasar\u0131m", keys: ["OtoDoseme", "VipIcMekanTasarim"] },
  { title: "Temizlik, Koruma & Estetik", keys: ["OtoYikama", "Detailing", "AracKaplama", "CamFilmi"] },
  { title: "Ekspertiz, Test & Denetim", keys: ["OtoEkspertiz"] },
  { title: "Kiralama & Transfer", keys: ["AracKiralama"] },
];

const CITY_DISTRICT_DATA = {
  Denizli: ["Merkezefendi", "Pamukkale", "Ac\u0131payam", "\u00c7ivril", "Honaz", "Tavas"],
  "\u0130zmir": ["Bornova", "Buca", "\u00c7e\u015fme", "\u00c7i\u011fli", "Gaziemir", "Kar\u015f\u0131yaka", "Konak", "Menemen", "Torbal\u0131", "Urla"],
  "\u0130stanbul": ["Avc\u0131lar", "Ba\u011fc\u0131lar", "Be\u015fikta\u015f", "Beylikd\u00fcz\u00fc", "Fatih", "Kad\u0131k\u00f6y", "Kartal", "Pendik", "\u015ei\u015fli", "\u00dcmraniye", "\u00dcsk\u00fcdar"],
  Antalya: ["Alanya", "Kepez", "Konyaalt\u0131", "Muratpa\u015fa", "Serik"],
  Ankara: ["Alt\u0131nda\u011f", "\u00c7ankaya", "Etimesgut", "Ke\u00e7i\u00f6ren", "Mamak", "Sincan", "Yenimahalle"],
  Bursa: ["Gemlik", "\u0130neg\u00f6l", "Mudanya", "Nil\u00fcfer", "Osmangazi", "Y\u0131ld\u0131r\u0131m"],
};

const CITIES = Object.keys(CITY_DISTRICT_DATA);

const SERVICE_BRANDS = [
  "Fiat", "Renault", "Ford", "Volkswagen", "Opel", "Toyota", "Hyundai",
  "Peugeot", "Citroen", "Dacia", "Honda", "Nissan", "Mercedes", "BMW",
  "Audi", "Skoda", "Seat", "Volvo", "Kia", "Jeep", "Alfa Romeo",
  "Chevrolet", "Mini", "Land Rover", "Suzuki", "Mazda", "Mitsubishi",
  "Subaru", "Porsche", "Cupra", "Lexus", "Isuzu", "Iveco", "Togg",
];

const REPORT_REASONS = [
  { key: "abusive_language", label: "Hakaret / K\u00fcf\u00fcr" },
  { key: "fake_experience", label: "Sahte Deneyim" },
  { key: "personal_data", label: "Ki\u015fisel Veri Payla\u015f\u0131m\u0131" },
  { key: "spam", label: "Spam / Reklam" },
  { key: "other", label: "Di\u011fer" },
];

const HOME_ALGORITHMS = [
  { key: "DefaultFlow", label: "Varsay\u0131lan", icon: "DF" },
  { key: "RecentlyLiked", label: "Memnuniyet Oran\u0131 Y\u00fcksek (Beta)", icon: "UP" },
  { key: "WorstRated", label: "Kullan\u0131c\u0131lar\u0131n Sorun Belirttikleri", icon: "LOW" },
];
