const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, systemPreferences } = require('electron');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

let overlayWindow = null;
let controlWindow = null;
let isOverlayInteractive = false;

let cursorDaemon = null;
let isCursorHidden = false;
let cursorTrackingInterval = null;
let activeAgentState = null;

function ensureCursorHelper() {
  if (process.platform !== 'darwin') return null;
  const helperPath = path.join(__dirname, 'cursor_helper');
  if (!fs.existsSync(helperPath)) {
    const srcPath = path.join(__dirname, 'src', 'cursor_helper.c');
    try {
      execSync(`cc -framework ApplicationServices "${srcPath}" -o "${helperPath}"`);
    } catch (e) {
      console.error('Failed to compile cursor helper:', e.message);
      return null;
    }
  }
  return helperPath;
}

function startCursorDaemon() {
  const helperPath = ensureCursorHelper();
  if (!helperPath) return;
  cursorDaemon = spawn(helperPath, [], { stdio: ['pipe', 'ignore', 'ignore'] });
  cursorDaemon.on('exit', () => { cursorDaemon = null; isCursorHidden = false; });
}

function hideCursor() {
  if (cursorDaemon && !isCursorHidden) {
    cursorDaemon.stdin.write('hide\n');
    isCursorHidden = true;
  }
}

function showCursor() {
  if (cursorDaemon && isCursorHidden) {
    cursorDaemon.stdin.write('show\n');
    isCursorHidden = false;
  }
}

function startCursorTracking() {
  cursorTrackingInterval = setInterval(() => {
    if (!overlayWindow || !overlayWindow.isVisible()) {
      if (isCursorHidden) showCursor();
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = overlayWindow.getBounds();
    const isInOverlay = (
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height
    );
    if (isInOverlay && !isCursorHidden) {
      hideCursor();
    } else if (!isInOverlay && isCursorHidden) {
      showCursor();
    }
  }, 50);
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: Math.floor(width * 0.35),
    height: height,
    x: width - Math.floor(width * 0.35),
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.setContentProtection(true);
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);

  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 700,
    height: 600,
    title: 'Pray AI - Control Panel',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  controlWindow.loadFile(path.join(__dirname, 'renderer', 'control.html'));

  controlWindow.on('closed', () => {
    controlWindow = null;
    if (overlayWindow) overlayWindow.close();
    app.quit();
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    if (micStatus !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  }

  createControlWindow();
  createOverlayWindow();

  startCursorDaemon();
  startCursorTracking();

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (overlayWindow) {
      overlayWindow.webContents.send('trigger-snapshot');
    }
  });

  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        overlayWindow.show();
      }
    }
  });

  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (overlayWindow) {
      isOverlayInteractive = !isOverlayInteractive;
      if (isOverlayInteractive) {
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.webContents.send('interactive-mode', true);
      } else {
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.webContents.send('interactive-mode', false);
      }
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  clearInterval(cursorTrackingInterval);
  showCursor();
  if (cursorDaemon) cursorDaemon.kill();
});

app.on('window-all-closed', () => {
  app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('copy-to-clipboard', (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('get-builtin-agents', () => {
  const { builtInAgents } = require('./src/agents');
  return builtInAgents;
});

ipcMain.handle('load-custom-agents', () => {
  const agentsPath = path.join(__dirname, 'agents.json');
  try {
    if (fs.existsSync(agentsPath)) {
      return JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load custom agents:', e.message);
  }
  return [];
});

ipcMain.handle('save-custom-agents', (event, agents) => {
  const agentsPath = path.join(__dirname, 'agents.json');
  try {
    fs.writeFileSync(agentsPath, JSON.stringify(agents, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save custom agents:', e.message);
    return false;
  }
});

ipcMain.handle('get-api-key', () => {
  return process.env.OPENAI_API_KEY || '';
});

ipcMain.handle('save-api-key', (event, key) => {
  process.env.OPENAI_API_KEY = key;
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, `OPENAI_API_KEY=${key}\n`);
  return true;
});

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({ id: s.id, name: s.name }));
});

ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (!sources || sources.length === 0) {
      console.error('No screen sources found');
      return null;
    }

    const primarySource = sources[0];
    const thumbnail = primarySource.thumbnail;

    if (thumbnail.isEmpty()) {
      console.error('Screen capture returned empty image — grant Screen Recording permission to Electron in System Preferences > Privacy & Security > Screen Recording');
      return null;
    }

    const sharp = require('sharp');
    const pngBuffer = thumbnail.toPNG();
    const compressed = await sharp(pngBuffer)
      .resize(1280, 720, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();
    return compressed.toString('base64');
  } catch (err) {
    console.error('Screen capture error:', err);
    return null;
  }
});

ipcMain.on('send-to-overlay', (event, channel, data) => {
  if (channel === 'agent-changed') {
    activeAgentState = data;
  }
  if (overlayWindow) {
    overlayWindow.webContents.send(channel, data);
  }
});

ipcMain.handle('get-active-agent', () => {
  return activeAgentState;
});

ipcMain.on('set-overlay-interactive', (event, interactive) => {
  if (overlayWindow) {
    isOverlayInteractive = interactive;
    if (interactive) {
      overlayWindow.setIgnoreMouseEvents(false);
    } else {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  }
});

ipcMain.handle('transcribe-audio', async (event, audioBase64) => {
  const OpenAI = require('openai');
  const fs = require('fs');
  const os = require('os');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'No API key configured' };

  const client = new OpenAI({ apiKey });
  const tmpPath = path.join(os.tmpdir(), `pray_audio_${Date.now()}.webm`);

  try {
    fs.writeFileSync(tmpPath, Buffer.from(audioBase64, 'base64'));
    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: fs.createReadStream(tmpPath),
    });
    return { text: transcription.text };
  } catch (err) {
    console.error('Transcription error:', err);
    return { error: err.message };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

ipcMain.handle('chat-completion', async (event, { messages, imageBase64 }) => {
  const OpenAI = require('openai');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: 'No API key configured' };

  const client = new OpenAI({ apiKey });

  const apiMessages = messages.map(m => {
    if (m.role === 'user' && imageBase64 && m === messages[messages.length - 1]) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
          },
        ],
      };
    }
    return m;
  });

  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: apiMessages,
      stream: true,
      max_tokens: 2048,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullResponse += delta;
        if (overlayWindow) {
          overlayWindow.webContents.send('ai-stream-chunk', delta);
        }
      }
    }
    overlayWindow?.webContents.send('ai-stream-done');
    return { text: fullResponse };
  } catch (err) {
    console.error('Chat completion error:', err);
    return { error: err.message };
  }
});
