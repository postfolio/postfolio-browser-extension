export default defineBackground(() => {
  console.log('Save to Postfolio extension loaded', { id: browser.runtime.id });

  // Create context menu item
  chrome.contextMenus.create({
    id: "save-to-postfolio",
    title: "Save to Postfolio",
    contexts: ["page", "selection", "image", "link"]
  });

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-to-postfolio") {
      // Open the extension popup
      chrome.action.openPopup();
    }
  });
});
