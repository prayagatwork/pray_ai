const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prayAPI', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  getSources: () => ipcRenderer.invoke('get-sources'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  transcribeAudio: (audioBase64) => ipcRenderer.invoke('transcribe-audio', audioBase64),
  chatCompletion: (payload) => ipcRenderer.invoke('chat-completion', payload),

  sendToOverlay: (channel, data) => ipcRenderer.send('send-to-overlay', channel, data),
  setOverlayInteractive: (interactive) => ipcRenderer.send('set-overlay-interactive', interactive),

  onTriggerSnapshot: (cb) => ipcRenderer.on('trigger-snapshot', cb),
  onAiStreamChunk: (cb) => ipcRenderer.on('ai-stream-chunk', (_, data) => cb(data)),
  onAiStreamDone: (cb) => ipcRenderer.on('ai-stream-done', () => cb()),
  onInteractiveMode: (cb) => ipcRenderer.on('interactive-mode', (_, val) => cb(val)),
  onTranscriptUpdate: (cb) => ipcRenderer.on('transcript-update', (_, data) => cb(data)),
  onAgentChanged: (cb) => ipcRenderer.on('agent-changed', (_, data) => cb(data)),

  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),

  getActiveAgent: () => ipcRenderer.invoke('get-active-agent'),
  getBuiltInAgents: () => ipcRenderer.invoke('get-builtin-agents'),
  loadCustomAgents: () => ipcRenderer.invoke('load-custom-agents'),
  saveCustomAgents: (agents) => ipcRenderer.invoke('save-custom-agents', agents),
});
