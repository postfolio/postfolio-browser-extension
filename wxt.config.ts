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
      "contextMenus",
      "scripting",
      "notifications"
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
    },
    content_security_policy: {
      extension_pages: import.meta.env.DEV 
        ? "script-src 'self' http://localhost:*; object-src 'self'; connect-src 'self' ws://localhost:* http://localhost:* https://*.firebaseapp.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com;"
        : "script-src 'self'; object-src 'self'; connect-src 'self' https://*.firebaseapp.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com;"
    }
  }
});
