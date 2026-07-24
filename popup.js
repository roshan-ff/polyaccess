// popup.js

const recordBtn = document.getElementById("recordBtn");
const summarizeBtn = document.getElementById("summarizeBtn");
const outputDiv = document.getElementById("output");
const languageSelect = document.getElementById("language");

let isRecording = false;
let recognition;

// ✅ Initialize Speech Recognition (browser's API)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Your browser does not support speech recognition.");
    return null;
  }

  const recog = new SpeechRecognition();
  recog.lang = languageSelect.value === "ta" ? "ta-IN" :
               languageSelect.value === "hi" ? "hi-IN" : "en-US";
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  return recog;
}

// 🎤 Start / Stop Recording
recordBtn.addEventListener("click", () => {
  if (!isRecording) {
    recognition = initSpeechRecognition();
    if (!recognition) return;

    recognition.start();
    recordBtn.textContent = "🛑 Stop";
    isRecording = true;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      outputDiv.textContent = "You said: " + transcript;
    };

    recognition.onerror = (err) => {
      outputDiv.textContent = "Error: " + err.error;
    };

    recognition.onend = () => {
      recordBtn.textContent = "🎤 Speak";
      isRecording = false;
    };
  } else {
    recognition.stop();
    recordBtn.textContent = "🎤 Speak";
    isRecording = false;
  }
});

// 📄 Summarize current page
summarizeBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: () => document.body.innerText
      },
      (results) => {
        const text = results[0].result;
        const summary = text.split(". ").slice(0, 3).join(". ") + "...";
        outputDiv.textContent = "Summary: " + summary;
      }
    );
  });
});
