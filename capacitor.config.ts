import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.KAIRO_IOS_APP_URL || "https://kairo.despacho.io";

const config: CapacitorConfig = {
  appId: "com.despacho.kairo",
  appName: "Kairo",
  webDir: "public",
  server: {
    url: appUrl,
    cleartext: false,
    allowNavigation: ["kairo.despacho.io"],
  },
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    scheme: "Kairo",
  },
};

export default config;
