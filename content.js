/**
 * AI Prompt Saver - Content Script
 * * Architecture:
 * - Adapters: Abstract site-specific DOM logic (Strategy Pattern).
 * - Manager: Handles state, storage, and event delegation (Singleton).
 * - Obfuscation: Base64 encoding for basic privacy (not encryption).
 */

const CONFIG = {
  DEBOUNCE_MS: 500,
  STORAGE_PREFIX: 'draft_',
};

// --- UTILS ---

const Utils = {
  // Obfuscation (Base64) - Not true encryption, just prevents casual snooping
  obfuscate: (text) => {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch { return text; }
  },

  deobfuscate: (encoded) => {
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch { return ""; }
  },

  getStorageKey: () => {
    // Includes hostname + path to separate different chats
    return `${CONFIG.STORAGE_PREFIX}${location.hostname}${location.pathname}`;
  },

  showToast: (message) => {
    const id = "ai-saver-toast";
    let toast = document.getElementById(id);
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = id;
    toast.innerText = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// --- ADAPTERS (Strategy Pattern) ---

class BaseAdapter {
  constructor(element) { this.el = element; }
  getValue() { throw new Error("Method not implemented"); }
  setValue(val) { throw new Error("Method not implemented"); }
  bindInput(callback) { this.el.addEventListener('input', callback); }
  bindSubmit(callback) { this.el.addEventListener('keydown', callback); }
}

class TextAreaAdapter extends BaseAdapter {
  getValue() { return this.el.value; }

  setValue(val) {
    this.el.value = val;
    // React/Vue require dispatching an input event to update virtual DOM
    this.el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

class ContentEditableAdapter extends BaseAdapter {
  getValue() { return this.el.innerText; }

  setValue(val) {
    this.el.innerText = val;
    // Simulating input for rich text editors like Gemini
    this.el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Factory to select the right adapter based on the element type
const AdapterFactory = {
  create: (element) => {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return new TextAreaAdapter(element);
    }
    if (element.getAttribute('contenteditable') === 'true' || element.classList.contains('ql-editor')) {
      return new ContentEditableAdapter(element);
    }
    return null;
  }
};

// --- MAIN CONTROLLER ---

class DraftManager {
  constructor() {
    this.currentInput = null;
    this.adapter = null;
    this.typingTimer = null;
    this.isSubmitting = false; // Gatekeeper flag to prevent race conditions
    this.globalClickListenerAttached = false;

    this.selectors = {
      "chatgpt.com": "#prompt-textarea",
      "gemini.google.com": ".ql-editor, textarea, [contenteditable='true']",
      "www.perplexity.ai": "textarea"
    };
  }

  init() {
    this.observeDOM();
    this.observeURL();
    this.attachGlobalClickListener();
  }

  // Single global listener to detect "Send" button clicks
  attachGlobalClickListener() {
    if (this.globalClickListenerAttached) return;

    document.addEventListener("click", (e) => {
      // Heuristic: If user clicks something and input clears shortly after, it was a submit.
      // We wait slightly to allow the site's JS to process the click and clear the input.
      setTimeout(() => {
        if (this.adapter) {
          const text = this.adapter.getValue();
          if (!text || text.trim() === "") {
            this.handleSendSuccess();
          }
        }
      }, 500);
    }, { capture: true });

    this.globalClickListenerAttached = true;
  }

  handleInput() {
    if (this.isSubmitting) return;

    clearTimeout(this.typingTimer);
    const text = this.adapter.getValue();

    this.typingTimer = setTimeout(() => {
      if (!this.isSubmitting) this.saveDraft(text);
    }, CONFIG.DEBOUNCE_MS);
  }

  handleKeydown(e) {
    // Detect Enter without Shift (standard submit)
    if (e.key === 'Enter' && !e.shiftKey) {
      this.isSubmitting = true;
      clearTimeout(this.typingTimer); // Cancel any pending saves
      this.handleSendSuccess();

      // Reset flag after a delay in case submit failed/was prevented
      setTimeout(() => { this.isSubmitting = false; }, 2000);
    }
  }

  handleSendSuccess() {
    const key = Utils.getStorageKey();
    chrome.storage.local.remove(key);
  }

  saveDraft(text) {
    const key = Utils.getStorageKey();
    if (!text || text.trim() === "") {
      chrome.storage.local.remove(key);
      return;
    }
    const encoded = Utils.obfuscate(text);
    chrome.storage.local.set({ [key]: encoded });
  }

  restoreDraft() {
    const key = Utils.getStorageKey();
    chrome.storage.local.get([key], (result) => {
      if (result[key] && this.adapter) {
        const currentText = this.adapter.getValue();
        // Only restore if strictly empty to avoid overwriting user
        if (!currentText || currentText.trim() === "") {
          const text = Utils.deobfuscate(result[key]);
          if (text) {
            this.adapter.setValue(text);
            Utils.showToast("Draft restored ✅");
          }
        }
      }
    });
  }

  // Detects when the specific input box appears on the page
  observeDOM() {
    const observer = new MutationObserver(() => {
      const selector = this.selectors[location.hostname];
      if (!selector) return;

      const box = document.querySelector(selector);

      // If we found a NEW box that is different from the current one
      if (box && box !== this.currentInput) {
        this.currentInput = box;
        this.adapter = AdapterFactory.create(box);

        if (this.adapter) {
          this.restoreDraft();

          // Attach listeners using the adapter interface
          // We bind 'this' to maintain context
          this.adapter.bindInput(this.handleInput.bind(this));
          this.adapter.bindSubmit(this.handleKeydown.bind(this));
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Handles SPA navigation (URL changes)
  observeURL() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.currentInput = null; // Reset to force re-detection on new page
        // The DOM observer will pick up the "new" input shortly
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  }
}

// --- BOOTSTRAP ---

const manager = new DraftManager();
manager.init();
