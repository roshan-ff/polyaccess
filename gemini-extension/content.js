// content.js
// Runs inside every page. Responsible for:
//  1. Extracting readable text from the page (for summarization)
//  2. Executing simple navigation commands sent from the popup (scroll, links, etc.)

function extractPageText() {
  // Prefer <article> or <main> if present, since it's usually the real content
  const preferred = document.querySelector("article, main");
  const root = preferred || document.body;

  // Clone so we can strip noisy elements without touching the live page
  const clone = root.cloneNode(true);
  clone.querySelectorAll(
    "script, style, noscript, nav, header, footer, aside, iframe, svg, form"
  ).forEach((el) => el.remove());

  let text = clone.innerText || "";
  text = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // Gemini has a context limit; keep this reasonable for a summarization prompt
  const MAX_CHARS = 15000;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n...[content truncated]";
  }
  return {
    title: document.title,
    url: location.href,
    text,
  };
}

function handleNavCommand(command) {
  const amount = Math.round(window.innerHeight * 0.8);
  switch (command) {
    case "scroll_down":
      window.scrollBy({ top: amount, behavior: "smooth" });
      break;
    case "scroll_up":
      window.scrollBy({ top: -amount, behavior: "smooth" });
      break;
    case "scroll_top":
      window.scrollTo({ top: 0, behavior: "smooth" });
      break;
    case "scroll_bottom":
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      break;
    case "go_back":
      history.back();
      break;
    case "go_forward":
      history.forward();
      break;
    case "click_first_link": {
      const link = document.querySelector("a[href]");
      if (link) link.click();
      break;
    }
    default:
      break;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_TEXT") {
    sendResponse(extractPageText());
    return true;
  }
  if (message.type === "NAV_COMMAND") {
    handleNavCommand(message.command);
    sendResponse({ ok: true });
    return true;
  }
});
