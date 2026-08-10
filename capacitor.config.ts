import type { CapacitorConfig } from "@capacitor/cli";

// server.url menunjuk ke deployment produksi di Vercel — APK ini memuat
// data langsung dari sana, TIDAK dari komputer rumah. HP tidak perlu
// terhubung ke jaringan/WiFi yang sama dengan komputer ini, dan dev server
// lokal tidak perlu menyala.
const config: CapacitorConfig = {
  appId: "com.mhtprep.app",
  appName: "MHT Prep",
  webDir: "android-www",
  server: {
    url: "https://mht-prep.vercel.app",
  },
};

export default config;
