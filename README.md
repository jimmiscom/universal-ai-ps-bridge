# Universal AI PowerShell Bridge

A clipboard-based bidirectional bridge between any AI chat interface and PowerShell - no API key required, no subscriptions, works directly on the chat UI.

---

## What Is This and Why Does It Exist?

When you work with an AI to help you with scripts, files, or system tasks, the workflow is painfully manual:

- AI gives you a PowerShell command
- You copy it manually
- You switch to the terminal and paste it
- You copy the result manually
- You switch back to the chat and paste the result
- Repeat 20+ times per session...

**This bridge eliminates all of that.**

You click **Run** on the AI code block — the command executes in PowerShell automatically, and the result is sent back to the AI automatically. The AI reads it and gives you the next command. You just click Run each time and watch it work.

It is especially useful for:
- **Fixing and editing scripts** — let the AI read your files, find bugs, and apply fixes surgically
- **System administration** — AI guides you through complex tasks step by step
- **File management** — read, search, replace content in any file without touching the terminal
- **Debugging** — AI sees the real output and error messages and reacts intelligently

---

## How It Works

The clipboard acts as a structured message queue between the browser and PowerShell:

```
1. AI gives a PowerShell command in a code block
2. You click the Copy button on the code block
3. The extension intercepts - shows a "Run in PS" popup next to the button
4. You click Run
5. The PS listener executes the command and writes the result to clipboard
6. The extension detects the result and auto-pastes it into the AI chat input
7. The message is auto-sent - AI reads the result and decides the next step
```

No terminal switching. No manual copy-paste. The AI drives the loop.

---

## Repository Structure

```
universal-ai-ps-bridge/
├── ps_listener.ps1                  # PowerShell listener (runs on your PC)
├── tools.ps1                        # File editing tools loaded by the listener
├── ai_guide.txt                     # Operational guide to send to the AI at session start
├── README.md
└── universal_bridge_extension/
    ├── manifest.json                # Chrome extension manifest (MV3)
    └── content.js                   # Bridge logic injected into AI chat pages
```

---

## Requirements

- **Windows** (PowerShell 5.1+ with System.Windows.Forms)
- **Google Chrome**
- Any supported AI chat interface (see below)

---

## Supported AI Chat Interfaces

| Platform | URL |
|---|---|
| Claude | claude.ai |
| ChatGPT | chatgpt.com |
| Gemini | gemini.google.com |
| Microsoft Copilot | copilot.microsoft.com |
| Bing Chat | bing.com |
| DeepSeek | chat.deepseek.com |

---

## Installation

### Step 1 - Clone or Download

```
git clone https://github.com/jimmiscom/universal-ai-ps-bridge.git
```

Or download the ZIP and extract it.

### Step 2 - Load the Chrome Extension

1. Open Chrome and go to chrome://extensions
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `universal_bridge_extension` folder
5. The extension is now active - you will see the Universal Bridge panel in the bottom-right corner of any supported AI chat page

### Step 3 - Run the Listener

Open PowerShell and run:

```powershell
powershell -sta -File "C:\path\to\ps_listener.ps1"
```

> **Important:** The `-sta` flag (Single Thread Apartment) is required for clipboard access. The script auto-restarts itself in STA mode if needed.

You should see:
```
Bridge Tools loaded OK
Agent listener ACTIVE (Multi-Window Protocol v1)
```

---

## First-Time Setup

### Step 1 - Establish the Handshake

Before anything else, the extension and listener must handshake:

1. Make sure `ps_listener.ps1` is running in PowerShell
2. Open any supported AI chat page in Chrome
3. Look at the Universal Bridge panel (bottom right) - it will show `handshaking...`
4. **Click anywhere on the page** - this grants clipboard permission and completes the handshake
5. The panel turns green and shows `ready (ID: XXXX)` - the bridge is now active

> If the panel shows `click page to sync clip` just click anywhere on the page and it will connect.

### Step 2 - Capture the Selectors (One-Time Per Site)

The bridge needs to know which elements to click and type into. Here is the easiest way:

1. **Ask the AI to show you a simple PowerShell command**, for example:
   > "Show me a PowerShell command to get the current date"

2. The AI responds with a code block containing `Get-Date`

3. Click the **gear icon** on the bridge panel - the Setup Modal opens

4. The modal has 4 tabs - configure them in order:

| Tab | What to capture | How |
|---|---|---|
| **COPY** | The copy button on AI code blocks | Click the copy button on the Get-Date code block |
| **PROMPT** | The chat input area | Click inside the chat input box |
| **SEND** | The send button | Click the send/submit button |
| **METHOD** | How messages are submitted | Pick M1 (Enter), M2 (Multi-key), M3 (Click Btn), or M4 (Form) |

5. For each tab, click the element on the page - the selector is captured automatically
6. Use **Bubble Parent** if the wrong element was captured - it moves up the DOM tree
7. Click **SAVE & LOCK** when all 4 tabs are configured

> Method tips:
> - Claude.ai: use Method 3 (Click Btn)
> - ChatGPT: try Method 1 (Enter) first
> - Gemini: try Method 3 (Click Btn)

### Step 3 - Test the Bridge

1. Ask the AI for `Get-Date`
2. When the code block appears, click the **Copy button**
3. A **"Run in PS"** popup appears next to the button
4. Click **Run in PS**
5. The result appears automatically in the chat and is sent
6. The AI receives the result and responds - the loop is complete!

> Selectors are saved per domain - you only need to set them up once per AI platform.

---

## Built-in Tools (tools.ps1)

`tools.ps1` is loaded automatically by the listener at startup. It provides a set of surgical file-editing tools that the AI can use to read, search, and modify files on your system — safely and with previews before any changes are applied.

This is the core power of the bridge: instead of just running one-off commands, the AI can work through complex multi-step tasks like reading a file, finding a bug, previewing a fix, and applying it — all without you touching the terminal.

### bridge_read
Read a file with line numbers.
```powershell
bridge_read -Path "file.js" -Start 1 -End 50
```

### bridge_find
Search for text with context lines. Shows >> marker on matches.
```powershell
bridge_find -Path "file.js" -Text "function init" -Before 2 -After 3
```

### patch_draft
Preview a replacement before applying it. Shows a diff of what will change.
```powershell
# By anchor text
patch_draft -File "file.js" -StartAnchor "function old" -EndAnchor "}" -Replace "function new() { }"
# By exact text match
patch_draft -File "file.js" -Find "const x = 1" -Replace "const x = 2"
```

### patch_apply
Execute the pending draft. Auto-creates a backup of the original file first.
```powershell
patch_apply -id 1234
```

### patch_list
Show the currently pending draft.
```powershell
patch_list
```

### patch_void
Cancel and clear the pending draft.
```powershell
patch_void
```

---

## Starting a Session — AI Guide

The file `ai_guide.txt` included in this repo is an operational guide for the AI. It tells the AI exactly how to use the bridge, the tools, and the patching protocol correctly.

**At the start of every new session, upload or paste `ai_guide.txt` to the AI before giving it any tasks.** This ensures the AI understands the loop, the tools, and the rules without you having to explain anything.

---

## Golden Rules for the AI

When starting a session, paste these rules to the AI so it follows the bridge protocol correctly:

```
1. Always give ONE code block at a time
2. Wait for [PS_RESULT] before giving the next command
3. Never give multiple separate code blocks in one message
4. Empty result = success (no output = no error)
5. Wait for the response to finish before clicking Copy
```

Results arrive in this format:
```
[PS_RESULT id=N]
...output here...
[/PS_RESULT]
```

---

## Tips

- **Large output** is automatically truncated at 3000 characters to prevent clipboard failures
- **Base64 encoding** is used for commands to safely handle special characters, quotes, and Unicode
- **The listener clears the clipboard** immediately after reading a command for security
- If the listener is restarted mid-session, the extension will automatically re-handshake
- You can run the bridge on **multiple AI tabs at the same time** - each gets its own session token

---

## Contributing

Pull requests are welcome! Some ideas:
- Firefox extension support (MV3 compatible)
- Additional tool functions for tools.ps1
- Selector presets for popular AI sites
- Linux/macOS version using xclip or pbcopy

---

## License

MIT License - free to use, modify, and distribute.

---

## Author
Created by **jimmiscom** - https://github.com/jimmiscom

---

## If this helped you

Give it a star on GitHub - it helps others find the project and motivates further development!
