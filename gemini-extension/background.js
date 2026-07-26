// background.js (Manifest V3 service worker)
// Handles all calls to the Gemini API so the API key and network logic
// live in one place, away from the UI code.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function getApiKey() {
  const { geminiApiKey } = await chrome.storage.sync.get("geminiApiKey");
  if (!geminiApiKey) {
    throw new Error(
      "No Gemini API key set. Open the extension's Options page and paste your key."
    );
  }
  return geminiApiKey;
}

function buildSummaryPrompt({ title, url, text }, targetLanguage) {
  return [
    "You are an accessibility-focused summarization assistant.",
    `Summarize the following web page for a user who wants the key points quickly.`,
    `Page title: ${title}`,
    `Page URL: ${url}`,
    "",
    `Write the ENTIRE summary in ${targetLanguage}, regardless of the source language of the text below.`,
    "Format your response as:",
    "1) A one-sentence overview.",
    "2) 3-6 bullet points with the most important facts.",
    "Keep language simple and plain, suitable for text-to-speech playback.",
    "",
    "PAGE TEXT:",
    text,
  ].join("\n");
}

async function callGemini(promptText) {
  const apiKey = await getApiKey();
  const response = await fetch(GEMINI_URL(GEMINI_MODEL, apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const outText = parts.map((p) => p.text || "").join("").trim();
  if (!outText) throw new Error("Gemini returned an empty response.");
  return outText;
}

async function summarizePage(pageData, targetLanguage) {
  const prompt = buildSummaryPrompt(pageData, targetLanguage);
  return callGemini(prompt);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SUMMARIZE") {
    summarizePage(message.pageData, message.targetLanguage)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
});
