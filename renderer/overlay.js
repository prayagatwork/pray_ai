const transcriptEl = document.getElementById('transcript-content');
const aiContentEl = document.getElementById('ai-content');
const manualInput = document.getElementById('manual-input');
const snapshotBtn = document.getElementById('snapshot-btn');
const sendBtn = document.getElementById('send-btn');
const copyAllBtn = document.getElementById('copy-all-btn');
const recordingDot = document.getElementById('recording-dot');
const aiDot = document.getElementById('ai-dot');
const modeIndicator = document.getElementById('mode-indicator');

const agentIndicator = document.getElementById('agent-indicator');

let currentTranscript = '';
let aiResponseBuffer = '';
let isStreaming = false;
let activeAgent = {
  name: 'General Co-pilot',
  icon: '\u{1F680}',
  systemPrompt: 'You are an elite real-time co-pilot. Keep responses concise, formatted in bullet points, and highly readable within 2 seconds of glancing. Use markdown formatting. Be direct and actionable.',
};

function renderMarkdown(text) {
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-btn copy-code-btn">Copy</button></div><pre><code data-raw="${encodeURIComponent(code.trim())}">${escaped}</code></pre></div>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
    return '<ul>' + match + '</ul>';
  });

  return html;
}

function flashCopyButton(btn, success) {
  const original = btn.textContent;
  btn.textContent = success ? 'Copied!' : 'Failed';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('copied');
  }, 1500);
}

copyAllBtn.addEventListener('click', async () => {
  if (!aiResponseBuffer) return;
  try {
    await window.prayAPI.copyToClipboard(aiResponseBuffer);
    flashCopyButton(copyAllBtn, true);
  } catch {
    flashCopyButton(copyAllBtn, false);
  }
});

aiContentEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-code-btn');
  if (!btn) return;
  const wrapper = btn.closest('.code-block-wrapper');
  const codeEl = wrapper?.querySelector('code[data-raw]');
  if (!codeEl) return;
  try {
    const raw = decodeURIComponent(codeEl.getAttribute('data-raw'));
    await window.prayAPI.copyToClipboard(raw);
    flashCopyButton(btn, true);
  } catch {
    flashCopyButton(btn, false);
  }
});

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

// --- AI Stream Handling ---

window.prayAPI.onAiStreamChunk((chunk) => {
  if (!isStreaming) {
    isStreaming = true;
    aiResponseBuffer = '';
    aiContentEl.innerHTML = '';
    aiDot.classList.add('active');
  }
  aiResponseBuffer += chunk;
  aiContentEl.innerHTML = renderMarkdown(aiResponseBuffer);
  aiContentEl.classList.add('loading-cursor');
  scrollToBottom(aiContentEl);
});

window.prayAPI.onAiStreamDone(() => {
  isStreaming = false;
  aiContentEl.classList.remove('loading-cursor');
  aiDot.classList.remove('active');
});

// --- Transcript Updates ---

window.prayAPI.onTranscriptUpdate((data) => {
  currentTranscript = data.fullTranscript || currentTranscript;
  transcriptEl.innerHTML = renderMarkdown(currentTranscript);
  if (data.isRecording) {
    recordingDot.classList.add('recording');
  } else {
    recordingDot.classList.remove('recording');
  }
  scrollToBottom(transcriptEl);
});

// --- Agent Selection ---

window.prayAPI.onAgentChanged((data) => {
  activeAgent = {
    name: data.name,
    icon: data.icon || '',
    systemPrompt: data.systemPrompt,
  };
  agentIndicator.textContent = `${data.icon || ''} ${data.name}`;
  agentIndicator.classList.add('visible');
});

// --- Interactive Mode ---

window.prayAPI.onInteractiveMode((interactive) => {
  if (interactive) {
    modeIndicator.classList.add('interactive');
    manualInput.focus();
  } else {
    modeIndicator.classList.remove('interactive');
  }
});

// --- Manual Input ---

async function sendManualQuery() {
  const text = manualInput.value.trim();
  if (!text) return;

  manualInput.value = '';
  aiContentEl.innerHTML = '<p style="color: rgba(255,255,255,0.4);">Thinking...</p>';
  aiDot.classList.add('active');

  const screenshot = await window.prayAPI.captureScreen();

  const messages = [
    {
      role: 'system',
      content: activeAgent.systemPrompt,
    },
  ];

  if (currentTranscript) {
    messages.push({
      role: 'user',
      content: `[Live transcript of conversation]\n${currentTranscript}`,
    });
  }

  messages.push({
    role: 'user',
    content: text + (screenshot ? '\n\n[Screenshot of current screen attached]' : ''),
  });

  await window.prayAPI.chatCompletion({
    messages,
    imageBase64: screenshot,
  });
}

sendBtn.addEventListener('click', sendManualQuery);

manualInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendManualQuery();
  }
});

// --- Snapshot ---

async function takeSnapshot() {
  aiContentEl.innerHTML = '<p style="color: rgba(255,255,255,0.4);">Capturing & analyzing screen...</p>';
  aiDot.classList.add('active');

  const screenshot = await window.prayAPI.captureScreen();
  if (!screenshot) {
    aiContentEl.innerHTML = '<p style="color: #f44336;">Failed to capture screen. Check permissions.</p>';
    aiDot.classList.remove('active');
    return;
  }

  const messages = [
    {
      role: 'system',
      content: activeAgent.systemPrompt,
    },
  ];

  if (currentTranscript) {
    messages.push({
      role: 'user',
      content: `[Current transcript]\n${currentTranscript}`,
    });
  }

  messages.push({
    role: 'user',
    content: 'Analyze this screenshot and provide relevant help, suggestions, or answers based on what you see. [Screenshot attached]',
  });

  await window.prayAPI.chatCompletion({
    messages,
    imageBase64: screenshot,
  });
}

snapshotBtn.addEventListener('click', takeSnapshot);
window.prayAPI.onTriggerSnapshot(takeSnapshot);

// Fetch active agent on load (control panel may have set one before overlay was ready)
(async () => {
  const agent = await window.prayAPI.getActiveAgent();
  if (agent && agent.systemPrompt) {
    activeAgent = {
      name: agent.name,
      icon: agent.icon || '',
      systemPrompt: agent.systemPrompt,
    };
    agentIndicator.textContent = `${agent.icon || ''} ${agent.name}`;
    agentIndicator.classList.add('visible');
  }
})();
