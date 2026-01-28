<div align="center">
  <img src="promptsafelogo.png" alt="PromptSafe Logo" width="128" height="128">
  <h1>PromptSafe</h1>
</div>

**PromptSafe** is a lightweight Chrome extension designed to solve a specific pain point for AI power users: losing long, complex prompts due to accidental tab closures, browser crashes, or navigation errors.

It runs quietly in the background on **ChatGPT**, **Gemini**, and **Perplexity**, automatically saving your draft as you type. If you close the tab and return later, your text is instantly restored.

## Key Features

* **Universal Auto-Save:** Automatically persists your input text after you stop typing for 1 second.
* **Context-Aware Storage:** Distinguishes between different chat threads. A draft typed in one specific ChatGPT conversation will not overwrite a draft in a new chat.
* **Local & Private:** Data is stored exclusively in your browser's local storage (`chrome.storage.local`). No data is ever sent to an external server or cloud.
* **Smart Restoration:** Only restores text if the input box is empty, ensuring it never overwrites new text you have just typed.
* **Smart Clearing:** Automatically detects when you send a message (via Enter key or clicking the send button) and clears the saved draft to keep your storage clean.

## Supported Platforms

* **ChatGPT** (`chatgpt.com`)
* **Google Gemini** (`gemini.google.com`)
* **Perplexity AI** (`perplexity.ai`)

## How It Works

PromptSafe utilizes a robust **Content Script** architecture designed for Single Page Applications (SPAs).

1.  **DOM Observation:** The extension uses a `MutationObserver` to watch the page structure. Since modern AI sites render input boxes dynamically, PromptSafe waits until the specific input element (like a `textarea` or `contenteditable` div) appears in the DOM before attaching itself.

2.  **The Adapter Pattern:** Different sites use different HTML elements for input.
    * **ChatGPT/Perplexity:** Uses a `TextAreaAdapter` to handle standard HTML text areas.
    * **Gemini:** Uses a `ContentEditableAdapter` to handle rich-text divs.
    This abstraction ensures the extension interacts correctly with the site's internal JavaScript framework (React, Vue, etc.), triggering the necessary input events so the site recognizes the restored text.

3.  **Draft Management:**
    * **Debouncing:** To prevent performance issues, saving only occurs after the user has stopped typing for 1000ms.
    * **Obfuscation:** Saved text is Base64 encoded before storage to prevent plain text from being easily readable in the browser's raw data files.
    * **Race Condition Prevention:** The extension employs a "gatekeeper" flag (`isSubmitting`) to ensure that a delayed auto-save does not resurrect a draft immediately after the user has submitted it.

## Installation

1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked**.
5.  Select the folder containing this extension.

## Permissions

* `storage`: Required to save your drafts locally.
* `host_permissions`: Limits the extension to run only on the specific AI domains listed above.
