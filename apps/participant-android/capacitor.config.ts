import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.co.travelbingo.app",
  appName: "Travel Bingo",
  webDir: "www",
  server: {
    url: "https://travel-bingo-walk.blueo03.chatgpt.site",
    cleartext: false,
    allowNavigation: ["travel-bingo-walk.blueo03.chatgpt.site"],
    errorPath: "offline.html"
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
