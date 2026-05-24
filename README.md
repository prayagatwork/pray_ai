# 🚀 Pray AI — Real-time Multimodal AI Desktop Copilot

**Pray AI** is a powerful, real-time multimodal AI desktop copilot designed to assist with interviews, coding, dynamic problem solving, system design, and meeting summarization. 

Using an **always-on-top, click-through transparent overlay** that is completely invisible to screen-sharing software (like Zoom, Google Meet, or Discord), Pray AI captures your primary display and microphone audio, providing real-time, context-aware suggestions directly into your field of view.

---

## ✨ Features

- 🕵️‍♂️ **Undetectable Overlay:** Uses macOS window-level content protection so the AI suggestions overlay is completely invisible to screen-recording and video-conferencing software.
- 🖱️ **Interactive / Click-Through Modes:** Seamlessly switch between mouse click-through mode (transparent display) and interactive mode (to copy text, select agents, or edit settings).
- 🎙️ **Live Audio Transcriptions:** Dual-channel microphone capture combined with OpenAI Whisper API for near real-time voice recognition.
- 📸 **Multimodal Vision:** High-frequency screen scrapers automatically crop, compress, and forward visual state changes to `gpt-4o`.
- 🧠 **Role-Specific AI Agents:** Features specialized agents tailored for various tasks:
  - **General Co-pilot:** Quick, scannable general help.
  - **Coding Assistant:** Instant syntax corrections, debugging, and terminal logs parsing.
  - **Interview Coach:** Suggests behavioral responses using the **STAR** framework.
  - **DSA Problem Solver:** Recommends algorithm approaches, patterns, and time complexity.
  - **System Design Coach:** Distributed systems scalability, database trade-offs, and math.
  - **Meeting Summarizer:** Extracts action items, owners, and decisions in real-time.

---

## 🛠️ Prerequisites

Before setting up Pray AI locally, ensure you have:
- **macOS** (features like the cursor daemon and screen protection require macOS).
- **Node.js** (v18 or higher recommended).
- **npm** (comes packaged with Node).
- An **OpenAI API Key** (requires credits to access `gpt-4o` and `whisper-1`).

---

## 🚀 Local Setup Instructions

Follow these step-by-step instructions to get Pray AI running locally:

### 1. Clone the Repository
```bash
git clone https://github.com/prayagatwork/pray_ai.git
cd pray_ai
```

### 2. Install Dependencies
Install all core application and Native Node module dependencies:
```bash
npm install
```

> [!NOTE]
> The installation handles compiling native assets. The project relies on:
> - `electron` for the desktop environment and UI overlays.
> - `sharp` for high-performance screenshot resizing and JPEG compression.
> - `screenshot-desktop` for low-level display capture.

### 3. Configure Environment Variables
Create a `.env` file in the root directory of the project:
```bash
touch .env
```

Open the `.env` file and add your OpenAI API Key:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

---

## 🔒 macOS System Permissions & Setup

To capture screen pixels and audio loopback correctly, macOS requires explicit security authorizations:

1. **Screen Recording:** Go to `System Settings > Privacy & Security > Screen Recording` and ensure your Terminal / IDE or Electron app is toggled **ON**.
2. **Microphone Access:** Ensure microphone permissions are granted. The app will prompt for access on the first launch.
3. **Cursor Helper Build:** The application uses a custom compiled C daemon (`cursor_helper.c`) to hide/show the OS cursor under the overlay. This compiles automatically on `npm run dev` / `npm start` using your system's `cc` compiler. No manual compilation is required.

---

## 🎮 How to Run

Launch the application in development mode or production mode:

```bash
# Run in development mode (includes dev tools toggles)
npm run dev

# Run in production mode
npm start
```

Once launched:
1. **Control Panel:** A dashboard window will appear where you can enter your API Key, configure custom agents, and choose the active workspace settings.
2. **Overlay HUD:** An invisible click-through overlay will stick to the right side of your primary screen.

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd + Shift + H` | **Show / Hide** the AI Overlay Window |
| `Cmd + Shift + I` | **Toggle Interactive Mode** (Turns click-through off, allowing you to click, copy text, or scroll the overlay) |
| `Cmd + Shift + S` | **Trigger Manual Snapshot** (Force takes a visual screenshot of your monitor & sends it to the active AI agent) |

---

## 📁 Repository Structure

```
├── main.js             # Electron main process (IPC handlers, window creation, key bindings)
├── preload.js          # Electron preload bridge (safely exposes APIs to renderers)
├── package.json        # Node packaging and scripts
├── .env                # Private environment variables (ignored in Git)
├── .gitignore          # Git exclusion rules
├── task.md             # Development task tracker
├── src/
│   ├── agents.js       # Built-in agent configurations and system prompts
│   └── cursor_helper.c # Native C utility for cursor concealment on macOS
└── renderer/
    ├── control.html    # Control panel view (settings, config)
    ├── control.js      # Control panel script
    ├── overlay.html    # Overlay HUD view (transparent scannable list)
    └── overlay.js      # Overlay HUD script (transcription capture, markdown stream UI)
```
