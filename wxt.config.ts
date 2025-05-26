import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Save to Postfolio",
    description: "Save web content to your Postfolio with ease.",
    permissions: [
      "activeTab",
      "tabs",
      "storage",
      "contextMenus"
    ],
    action: {
      default_title: "Save to Postfolio",
      default_popup: "popup.html",
      default_icon: {
        "16": "/icon/icon-16.png",
        "32": "/icon/icon-32.png", 
        "48": "/icon/icon-48.png",
        "128": "/icon/icon-128.png"
      }
    },
    icons: {
      "16": "/icon/icon-16.png",
      "32": "/icon/icon-32.png", 
      "48": "/icon/icon-48.png",
      "128": "/icon/icon-128.png"
    }
  }
});
