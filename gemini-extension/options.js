// options.js
const apiKeyInput = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const savedLabel = document.getElementById("saved");

chrome.storage.sync.get("geminiApiKey").then(({ geminiApiKey }) => {
  if (geminiApiKey) apiKeyInput.value = geminiApiKey;
});

saveBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  await chrome.storage.sync.set({ geminiApiKey: key });
  savedLabel.hidden = false;
  setTimeout(() => (savedLabel.hidden = true), 2000);
});
