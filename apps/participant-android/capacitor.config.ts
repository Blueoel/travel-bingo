import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.co.travelbingo.app",
  appName: "Travel Bingo",
  webDir: "www",
  server: {
    url: "https://app.travelbingo.kr",
    cleartext: false,
    allowNavigation: ["app.travelbingo.kr"],
    errorPath: "offline.html"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
