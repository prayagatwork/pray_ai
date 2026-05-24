Here is a comprehensive TASK.md file optimized for building a real-time multimodal assistant similar to Parakeet AI. It covers audio capture (Speech-to-Text), screen analysis (Vision), and overlay rendering using OpenAI's API capabilities.
Markdown
# Task Board: Multimodal Screen & Audio AI Assistant

This document outlines the system architecture, technology stack, and phase-by-step implementation tasks required to build a real-time desktop copilot. The tool will capture screen state, transcribe system/microphone audio, and stream context-aware help using OpenAI APIs.

---

## 🛠️ System Architecture & Tech Stack

[System/Mic Audio] ──> [Audio Capturer] ──> [Whisper API / Realtime API] ──┐
v
[Desktop Screen]    ──> [Screen Capturer] ──> [OpenAI GPT-4o Vision] ──> [Core Engine] ──> [Transparent Overlay UI]
^
[User Text Input]   ───────────────────────────────────────────────────────┘

* **Runtime/Language:** Node.js (Electron) OR Python (PyQt/PySide). *Electron is highly recommended for building undetectable, click-through transparent desktop overlays.*
* **Audio Capture:** `desktopCapturer` (Electron) or `sounddevice` / `pyaudio` (Python).
* **Screen Capture:** `robotjs` / `screenshot-desktop` (Node) or `mss` / `Pillow` (Python).
* **AI Engine:** OpenAI API (`gpt-4o` for multimodal vision/text, `whisper-1` for batch STT, or OpenAI Realtime API for ultra-low latency voice/text streaming).

---

## 📋 Phase 1: Environment Setup & Foundation
- [ ] Initialize project repository (Electron/Node.js or Python).
- [ ] Set up secure local environment variable management for the `OPENAI_API_KEY`.
- [ ] Implement the basic application window:
    - [ ] Main control panel dashboard (for configuring settings, uploading context/resumes).
    - [ ] An always-on-top, semi-transparent, click-through overlay window to display real-time AI suggestions without blocking user clicks on the underlying website or meeting.

---

## 🎙️ Phase 2: Audio Capture & Real-time Transcription
- [ ] Implement dual-channel audio recording:
    - [ ] Channel A: Microphone input (User's voice).
    - [ ] Channel B: System loopback audio (Interviewer's or website's audio output).
- [ ] Implement a **Voice Activity Detection (VAD)** system (e.g., using `silero-vad` or WebRTC VAD) to detect when a question starts and ends, avoiding continuous empty API streaming.
- [ ] Connect audio chunks to OpenAI:
    - [ ] *Option A (Low Latency):* Establish a WebSockets connection to the **OpenAI Realtime API** for live speech-to-text token streaming.
    - [ ] *Option B (Chunked):* Send audio slices dynamically to the `v1/audio/transcriptions` (Whisper) endpoint upon detecting natural conversational pauses.

---

## 📸 Phase 3: Screen Capture & Visual State Processing
- [ ] Build a high-performance screen scraper capable of taking silent, background screenshots of a targeted window (e.g., Google Chrome, Zoom, Google Meet) or the entire primary monitor.
- [ ] Implement optimization triggers for screen capture to save OpenAI vision tokens:
    - [ ] **On-Demand:** Take a screenshot instantly when a hotkey is pressed or a text/voice query is received.
    - [ ] **Interval-based:** Take a screenshot every X seconds *only* if significant pixel variations are detected on the screen (e.g., code changes on LeetCode or slides advancing).
- [ ] Format and compress images (JPEG, low-to-medium quality) to match OpenAI's vision input payload standards.

---

## 🧠 Phase 4: Core Orchestration & OpenAI Pipeline
- [ ] Create the core prompt construction engine. The prompt must inject:
    - [ ] **System Role:** "You are an elite real-time co-pilot. Keep responses concise, formatted in bullet points, and highly readable within 2 seconds of glancing."
    - [ ] **Context:** User-uploaded data (e.g., User's resume, documentation, or Job Description).
    - [ ] **State:** Live transcription text string + Screen screenshot payload.
- [ ] Wire up the OpenAI `v1/chat/completions` endpoint utilizing the `gpt-4o` multimodal model.
- [ ] Enable **Streaming (`stream: true`)** so tokens are sent to the desktop client interface instantly as they are generated, minimizing end-to-end latency.

---

## 💻 Phase 5: UI Overlay & Streaming Display
- [ ] Design the floating overlay UI layout:
    - [ ] Left column: Live running transcript of what the AI is hearing.
    - [ ] Right column: Live, streaming markdown response pane for solutions, code snippets, or navigation instructions.
- [ ] Implement smooth auto-scrolling to keep up with streaming AI text tokens.
- [ ] Add explicit manual override features:
    - [ ] A hidden text box where the user can manually type a prompt override (e.g., *"/code fix the edge case"* or *"/help tell me where to click"*).
    - [ ] A dedicated quick-trigger manual "Snapshot" button.

---

## 🔒 Phase 6: Optimization, Stealth & Privacy
- [ ] Optimize end-to-end latency to aim for < 3 seconds (Audio Captured -> STT -> LLM -> Rendered text).
- [ ] Implement window styling rules to prevent the overlay UI from leaking during screen shares:
    - [ ] If using Electron: Use `win.setContentProtection(true)` on Windows/macOS to make the overlay completely invisible to screen capturing software like Zoom, Discord, or Google Meet.
- [ ] Add local context caching mechanisms to reduce repetitive calls for static screen frames.
