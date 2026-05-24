const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const keyStatus = document.getElementById('key-status');
const startMicBtn = document.getElementById('start-mic-btn');
const stopMicBtn = document.getElementById('stop-mic-btn');
const micStatus = document.getElementById('mic-status');
const statusLog = document.getElementById('status-log');
const contextInput = document.getElementById('context-input');
const saveContextBtn = document.getElementById('save-context-btn');
const testCaptureBtn = document.getElementById('test-capture-btn');
const autoCaptureToggle = document.getElementById('auto-capture-toggle');
const captureIntervalInput = document.getElementById('capture-interval');

const agentGrid = document.getElementById('agent-grid');
const customAgentList = document.getElementById('custom-agent-list');
const toggleAgentFormBtn = document.getElementById('toggle-agent-form-btn');
const agentForm = document.getElementById('agent-form');
const agentNameInput = document.getElementById('agent-name-input');
const agentDescInput = document.getElementById('agent-desc-input');
const agentPromptInput = document.getElementById('agent-prompt-input');
const saveAgentBtn = document.getElementById('save-agent-btn');
const cancelAgentBtn = document.getElementById('cancel-agent-btn');

let mediaRecorder = null;
let audioChunks = [];
let fullTranscript = '';
let isRecording = false;
let autoCaptureTimer = null;
let savedContext = '';

let builtInAgents = [];
let customAgents = [];
let activeAgentId = 'general';
let activeAgentPrompt = '';

// --- API Key ---

async function loadApiKey() {
  const key = await window.prayAPI.getApiKey();
  if (key) {
    apiKeyInput.value = key;
    keyStatus.innerHTML = '<span class="status-badge connected">Key configured</span>';
  }
}

saveKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await window.prayAPI.saveApiKey(key);
  keyStatus.innerHTML = '<span class="status-badge connected">Key saved</span>';
});

// --- Audio Recording ---

function log(msg) {
  statusLog.textContent = msg;
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    audioChunks = [];
    isRecording = true;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (audioChunks.length === 0) return;
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      if (blob.size < 1000) {
        log('Audio chunk too small, skipping...');
        if (isRecording) restartRecording();
        return;
      }

      log('Transcribing...');
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const result = await window.prayAPI.transcribeAudio(base64);

      if (result.text && result.text.trim()) {
        fullTranscript += (fullTranscript ? '\n' : '') + result.text.trim();
        log('Transcribed: ' + result.text.trim().substring(0, 80) + '...');

        window.prayAPI.sendToOverlay('transcript-update', {
          fullTranscript,
          newText: result.text.trim(),
          isRecording,
        });
      } else if (result.error) {
        log('Transcription error: ' + result.error);
      }

      if (isRecording) restartRecording();
    };

    mediaRecorder.start();
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 5000);

    startMicBtn.disabled = true;
    stopMicBtn.disabled = false;
    micStatus.textContent = 'Recording';
    micStatus.className = 'status-badge connected';
    log('Mic recording started');

    window.prayAPI.sendToOverlay('transcript-update', {
      fullTranscript,
      isRecording: true,
    });
  } catch (err) {
    log('Mic error: ' + err.message);
  }
}

function restartRecording() {
  if (!isRecording) return;
  try {
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
  } catch {}
  startRecording();
}

function stopRecording() {
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (mediaRecorder && mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  }

  startMicBtn.disabled = false;
  stopMicBtn.disabled = true;
  micStatus.textContent = 'Inactive';
  micStatus.className = 'status-badge disconnected';
  log('Mic recording stopped');

  window.prayAPI.sendToOverlay('transcript-update', {
    fullTranscript,
    isRecording: false,
  });
}

startMicBtn.addEventListener('click', startRecording);
stopMicBtn.addEventListener('click', stopRecording);

// --- Context ---

saveContextBtn.addEventListener('click', () => {
  savedContext = contextInput.value.trim();
  saveContextBtn.textContent = savedContext ? 'Context saved!' : 'Save Context';
  setTimeout(() => {
    saveContextBtn.textContent = 'Save Context';
  }, 2000);
});

// --- Screen Capture ---

testCaptureBtn.addEventListener('click', async () => {
  testCaptureBtn.textContent = 'Capturing...';
  const result = await window.prayAPI.captureScreen();
  testCaptureBtn.textContent = result ? 'Captured!' : 'Failed - check permissions';
  setTimeout(() => {
    testCaptureBtn.textContent = 'Test Screenshot';
  }, 2000);
});

autoCaptureToggle.addEventListener('change', () => {
  if (autoCaptureToggle.checked) {
    const interval = parseInt(captureIntervalInput.value) || 10;
    autoCaptureTimer = setInterval(async () => {
      const screenshot = await window.prayAPI.captureScreen();
      if (screenshot) {
        const messages = [
          {
            role: 'system',
            content: activeAgentPrompt || 'You are an elite real-time co-pilot. Analyze the screen and provide brief, actionable help. Use bullet points. Be concise.',
          },
        ];
        if (savedContext) {
          messages.push({ role: 'user', content: `[User context]\n${savedContext}` });
        }
        if (fullTranscript) {
          messages.push({ role: 'user', content: `[Transcript]\n${fullTranscript}` });
        }
        messages.push({
          role: 'user',
          content: 'Analyze this screen and provide relevant help. [Screenshot attached]',
        });
        await window.prayAPI.chatCompletion({ messages, imageBase64: screenshot });
      }
    }, interval * 1000);
    log('Auto-capture started every ' + interval + 's');
  } else {
    clearInterval(autoCaptureTimer);
    autoCaptureTimer = null;
    log('Auto-capture stopped');
  }
});

// --- Agents ---

function selectAgent(agent) {
  activeAgentId = agent.id;
  activeAgentPrompt = agent.systemPrompt;

  document.querySelectorAll('.agent-card, .custom-agent-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.agent-card[data-id="${agent.id}"], .custom-agent-item[data-id="${agent.id}"]`);
  if (activeEl) activeEl.classList.add('active');

  window.prayAPI.sendToOverlay('agent-changed', {
    id: agent.id,
    name: agent.name,
    icon: agent.icon,
    systemPrompt: agent.systemPrompt,
  });
}

function renderAgentGrid() {
  agentGrid.innerHTML = builtInAgents.map(a => `
    <div class="agent-card ${a.id === activeAgentId ? 'active' : ''}" data-id="${a.id}">
      <div class="agent-icon">${a.icon}</div>
      <div class="agent-name">${a.name}</div>
      <div class="agent-desc">${a.description}</div>
    </div>
  `).join('');

  agentGrid.querySelectorAll('.agent-card').forEach(el => {
    el.addEventListener('click', () => {
      const agent = builtInAgents.find(a => a.id === el.dataset.id);
      if (agent) selectAgent(agent);
    });
  });
}

function renderCustomAgents() {
  if (customAgents.length === 0) {
    customAgentList.innerHTML = '<div class="no-custom-agents">No custom agents yet</div>';
    return;
  }
  customAgentList.innerHTML = customAgents.map((a, i) => `
    <div class="custom-agent-item ${a.id === activeAgentId ? 'active' : ''}" data-index="${i}" data-id="${a.id}">
      <div class="custom-agent-info">
        <span class="custom-agent-name">${a.name}</span>
        <span class="custom-agent-desc">${a.description}</span>
      </div>
      <button class="btn btn-tiny danger delete-agent-btn" data-index="${i}">Del</button>
    </div>
  `).join('');

  customAgentList.querySelectorAll('.custom-agent-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.delete-agent-btn')) return;
      const agent = customAgents[parseInt(el.dataset.index)];
      if (agent) selectAgent(agent);
    });
  });

  customAgentList.querySelectorAll('.delete-agent-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index);
      const removed = customAgents[index];
      customAgents.splice(index, 1);
      await window.prayAPI.saveCustomAgents(customAgents);
      renderCustomAgents();
      if (removed.id === activeAgentId) {
        selectAgent(builtInAgents[0]);
      }
    });
  });
}

toggleAgentFormBtn.addEventListener('click', () => {
  const visible = agentForm.style.display !== 'none';
  agentForm.style.display = visible ? 'none' : 'block';
  toggleAgentFormBtn.textContent = visible ? '+ Create' : 'Cancel';
});

cancelAgentBtn.addEventListener('click', () => {
  agentForm.style.display = 'none';
  toggleAgentFormBtn.textContent = '+ Create';
  agentNameInput.value = '';
  agentDescInput.value = '';
  agentPromptInput.value = '';
});

saveAgentBtn.addEventListener('click', async () => {
  const name = agentNameInput.value.trim();
  const description = agentDescInput.value.trim();
  const systemPrompt = agentPromptInput.value.trim();
  if (!name || !systemPrompt) return;

  const agent = {
    id: 'custom-' + Date.now(),
    name,
    icon: '\u{2728}',
    description: description || 'Custom agent',
    systemPrompt,
  };

  customAgents.push(agent);
  await window.prayAPI.saveCustomAgents(customAgents);
  renderCustomAgents();

  agentForm.style.display = 'none';
  toggleAgentFormBtn.textContent = '+ Create';
  agentNameInput.value = '';
  agentDescInput.value = '';
  agentPromptInput.value = '';

  selectAgent(agent);
});

async function loadAgents() {
  builtInAgents = await window.prayAPI.getBuiltInAgents();
  customAgents = await window.prayAPI.loadCustomAgents();
  renderAgentGrid();
  renderCustomAgents();

  const defaultAgent = builtInAgents.find(a => a.id === 'general') || builtInAgents[0];
  if (defaultAgent) {
    activeAgentPrompt = defaultAgent.systemPrompt;
    selectAgent(defaultAgent);
  }
}

// --- Init ---
loadApiKey();
loadAgents();
