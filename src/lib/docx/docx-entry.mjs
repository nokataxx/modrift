// Runs inside the docx WebView (FR-42): takes the .docx bytes handed in via
// window.CONFIG, converts them to HTML with mammoth, and drops the result into
// the page.
//
// A SECOND bundle rather than a branch inside editor-entry.mjs, on purpose:
// mammoth is ~536KB and opening a Markdown file must not pay for it (FR-21).
import mammoth from "mammoth";

function post(message) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

// The bytes arrive base64-encoded because that is what survives being embedded
// in the HTML string. atob gives a binary string; copy it out byte by byte.
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

(async () => {
  try {
    const arrayBuffer = base64ToArrayBuffer(window.CONFIG.base64);
    // Images come back as base64 data URIs by default, so nothing is fetched
    // over the network — which is what makes this work under the WebView's CSP.
    const result = await mammoth.convertToHtml({ arrayBuffer });
    document.getElementById("doc").innerHTML = result.value;
    post({ type: "ready" });
  } catch (error) {
    post({ type: "error", message: String((error && error.message) || error) });
  }
})();
