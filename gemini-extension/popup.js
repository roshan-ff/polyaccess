// popup.js
// Wires up the popup UI: summarization, voice commands, and read-aloud.

const langSelect = document.getElementById("langSelect");
const summarizeBtn = document.getElementById("summarizeBtn");
const voiceBtn = document.getElementById("voiceBtn");
const voiceBtnLabel = document.getElementById("voiceBtnLabel");
const statusLine = document.getElementById("statusLine");
const summaryText = document.getElementById("summaryText");
const readAloudBtn = document.getElementById("readAloudBtn");
const stopReadBtn = document.getElementById("stopReadBtn");
const openOptionsBtn = document.getElementById("openOptions");

// Maps the friendly language names shown in the dropdown to BCP-47 codes,
// used for speech recognition and speech synthesis.
const LANG_CODES = {
  English: "en-US",
  Spanish: "es-ES",
  French: "fr-FR",
  German: "de-DE",
  Hindi: "hi-IN",
  Tamil: "ta-IN",
  "Mandarin Chinese": "zh-CN",
  Arabic: "ar-SA",
  Portuguese: "pt-PT",
  Japanese: "ja-JP",
};

let recognition = null;
let listening = false;

function setStatus(msg, isError = false) {
  statusLine.textContent = msg;
  statusLine.style.color = isError ? "#b3261e" : "#445";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getPageDataFromActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active tab found.");
  return chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_TEXT" });
}

async function sendNavCommand(command) {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "NAV_COMMAND", command });
}

async function summarizeCurrentPage() {
  try {
    summarizeBtn.disabled = true;
    setStatus("Reading the page…");
    const pageData = await getPageDataFromActiveTab();

    setStatus("Asking Gemini for a summary…");
    const targetLanguage = langSelect.value;
    const response = await chrome.runtime.sendMessage({
      type: "SUMMARIZE",
      pageData,
      targetLanguage,
    });

    if (!response.ok) throw new Error(response.error);

    summaryText.textContent = response.summary;
    readAloudBtn.disabled = false;
    setStatus("Summary ready.");
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    summarizeBtn.disabled = false;
  }
}

function readSummaryAloud() {
  if (!summaryText.textContent.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(summaryText.textContent);
  utterance.lang = LANG_CODES[langSelect.value] || "en-US";
  stopReadBtn.disabled = false;
  utterance.onend = () => {
    stopReadBtn.disabled = true;
  };
  window.speechSynthesis.speak(utterance);
}

function stopReading() {
  window.speechSynthesis.cancel();
  stopReadBtn.disabled = true;
}

// ---- Voice command handling ----

function findLanguageMention(transcript) {
  const lower = transcript.toLowerCase();
  for (const name of Object.keys(LANG_CODES)) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return null;
}

function handleVoiceCommand(rawTranscript) {
  const transcript = rawTranscript.trim().toLowerCase();
  setStatus(`Heard: "${rawTranscript}"`);

  if (transcript.includes("switch to")) {
    const lang = findLanguageMention(transcript);
    if (lang) {
      langSelect.value = lang;
      setStatus(`Language set to ${lang}.`);
    }
    return;
  }
  if (transcript.includes("summarize")) {
    summarizeCurrentPage();
    return;
  }
  if (transcript.includes("read")) {
    readSummaryAloud();
    return;
  }
  if (transcript.includes("stop")) {
    stopReading();
    return;
  }
  if (transcript.includes("scroll down")) {
    sendNavCommand("scroll_down");
    return;
  }
  if (transcript.includes("scroll up")) {
    sendNavCommand("scroll_up");
    return;
  }
  if (transcript.includes("top")) {
    sendNavCommand("scroll_top");
    return;
  }
  if (transcript.includes("bottom")) {
    sendNavCommand("scroll_bottom");
    return;
  }
  if (transcript.includes("go back") || transcript.includes("back")) {
    sendNavCommand("go_back");
    return;
  }
  if (transcript.includes("go forward") || transcript.includes("forward")) {
    sendNavCommand("go_forward");
    return;
  }
  if (transcript.includes("open link") || transcript.includes("click link")) {
    sendNavCommand("click_first_link");
    return;
  }

  setStatus(`Command not recognized: "${rawTranscript}"`, true);
}

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function startVoiceControl() {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    setStatus(
      "Speech recognition isn't available in this browser context.",
      true
    );
    return;
  }

  recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US"; // commands are spoken in English; summary language is separate

  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last[0].transcript;
    handleVoiceCommand(transcript);
  };

  recognition.onerror = (event) => {
    setStatus(`Voice recognition error: ${event.error}`, true);
  };

  recognition.onend = () => {
    // Auto-restart while the user still has voice control toggled on,
    // since the browser stops recognition after periods of silence.
    if (listening) recognition.start();
  };

  recognition.start();
  listening = true;
  voiceBtn.setAttribute("aria-pressed", "true");
  voiceBtnLabel.textContent = "Stop voice control";
  setStatus("Listening… try saying \"summarize\".");
}

function stopVoiceControl() {
  listening = false;
  recognition?.stop();
  voiceBtn.setAttribute("aria-pressed", "false");
  voiceBtnLabel.textContent = "Start voice control";
  setStatus("Voice control stopped.");
}

// ---- Event wiring ----

summarizeBtn.addEventListener("click", summarizeCurrentPage);
readAloudBtn.addEventListener("click", readSummaryAloud);
stopReadBtn.addEventListener("click", stopReading);
openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

voiceBtn.addEventListener("click", () => {
  if (listening) stopVoiceControl();
  else startVoiceControl();
});

// Restore last-used language, if any
chrome.storage.sync.get("preferredLanguage").then(({ preferredLanguage }) => {
  if (preferredLanguage && LANG_CODES[preferredLanguage]) {
    langSelect.value = preferredLanguage;
  }
});
langSelect.addEventListener("change", () => {
  chrome.storage.sync.set({ preferredLanguage: langSelect.value });
});
