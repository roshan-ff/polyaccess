// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("PolyAccess Whisper Extension Installed ✅");
});

// Optional: listen for messages (future Whisper AI integration)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "summarize") {
    console.log("Summarization request received in background.");
    sendResponse({ status: "Background received summarize request" });
  }

  if (message.type === "voiceCommand") {
    console.log("Voice command received:", message.command);
    // Here we can add navigation logic
    sendResponse({ status: "Command executed" });
  }
});
