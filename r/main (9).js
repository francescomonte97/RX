const WORKER_BASE_URL = 'https://crimson-firefly-cf7f.montefortefrancesco50.workers.dev';


const ELEVENLABS_API_KEY = "sk_55b4a8f4877874db16e8e4812fdc141cf00a7e4aadaab79d";
const VOICE_ID = "3nl8Zsm1cUwx1jH59GZo";



// =========================
// CONFIG
// =========================

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

// =========================
// DOM
// =========================
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const recordBtn = document.getElementById('record-btn');
const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');

const waveform = document.getElementById('waveform');
const recordingStatus = document.getElementById('recording-status');
const recordingTime = document.getElementById('recording-time');
const recordingUI = document.getElementById('recording-ui');

// =========================
// STATE
// =========================
let workingMemory = JSON.parse(localStorage.getItem('lipu_working_memory')) || [];
let longTermMemory = null;

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingInterval = null;
let recordingSeconds = 0;
let lastAudioBlob = null;
let stopRecordingResolver = null;

// =========================
// INIT
// =========================
async function init() {
  await loadLongTermMemory();
  restoreWorkingMemoryUI();
  bindEvents();
}

async function loadLongTermMemory() {
  try {
    const response = await fetch('./lipu-memory.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    longTermMemory = await response.json();
  } catch (err) {
    console.error('Errore caricamento JSON:', err);
    longTermMemory = null;
  }
}

function restoreWorkingMemoryUI() {
  for (const msg of workingMemory) {
    if (msg.role === 'user' && msg.type === 'audio' && msg.audioDataUrl) {
      renderAudioMessage('user', msg.audioDataUrl);
    } else if (msg.role === 'user' && msg.type === 'text') {
      renderMessage('user', msg.content);
    } else if (msg.role === 'user' && msg.type === 'image' && msg.imageDataUrl) {
      renderImageMessage('user', msg.imageDataUrl);
    } else if (msg.role === 'lipu' && msg.type === 'audio' && msg.audioDataUrl) {
      renderAudioMessage('lipu', msg.audioDataUrl);
    }
  }
}

// =========================
// RENDER
// =========================
function renderMessage(role, text) {
  const safeRole = role === 'user' ? 'user' : 'lipu';
  const safeText = typeof text === 'string' ? text : String(text ?? '');

  const row = document.createElement('div');
  row.className = `message-row ${safeRole} message-enter`;

  if (safeRole === 'lipu') {
    row.appendChild(createAvatar());
  }

  const msg = document.createElement('div');
  msg.className = `message ${safeRole === 'user' ? 'user-msg' : 'lipu-msg'}`;
  msg.textContent = safeText;

  row.appendChild(msg);
  appendToChat(row);
}

function renderImageMessage(role, imageSource) {
  const safeRole = role === 'user' ? 'user' : 'lipu';

  const row = document.createElement('div');
  row.className = `message-row ${safeRole} message-enter`;

  if (safeRole === 'lipu') {
    row.appendChild(createAvatar());
  }

  const bubble = document.createElement('div');
  bubble.className = `message ${safeRole === 'user' ? 'user-msg' : 'lipu-msg'}`;

  const img = document.createElement('img');
  img.src = imageSource;
  img.alt = 'Immagine inviata';
  img.className = 'chat-image';

  bubble.appendChild(img);
  row.appendChild(bubble);

  appendToChat(row);
}

function renderAudioMessage(role, audioSource) {
  const safeRole = role === 'user' ? 'user' : 'lipu';

  const row = document.createElement('div');
  row.className = `message-row ${safeRole} message-enter`;

  if (safeRole === 'lipu') {
    row.appendChild(createAvatar());
  }

  const bubble = document.createElement('div');
  bubble.className = `message ${safeRole === 'user' ? 'user-msg' : 'lipu-msg'}`;

  const customPlayer = createCustomAudioPlayer(audioSource);
  bubble.appendChild(customPlayer);

  row.appendChild(bubble);
  appendToChat(row);
}

function renderLIPULoadingMessage(text = 'Lipu sta registrando...') {
  removeLIPULoadingMessage();

  const row = document.createElement('div');
  row.className = 'message-row lipu message-enter';
  row.id = 'lipu-loading-row';

  const avatar = createAvatar();

  const bubble = document.createElement('div');
  bubble.className = 'message lipu-msg lipu-loading';

  const loadingText = document.createElement('div');
  loadingText.className = 'lipu-loading-text';
  loadingText.textContent = text;

  const dots = document.createElement('div');
  dots.className = 'lipu-loading-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  bubble.appendChild(loadingText);
  bubble.appendChild(dots);

  row.appendChild(avatar);
  row.appendChild(bubble);

  appendToChat(row);
}

function removeLIPULoadingMessage() {
  const existing = document.getElementById('lipu-loading-row');
  if (existing) {
    existing.remove();
  }
}

function createAvatar() {
  const avatar = document.createElement('img');
  avatar.src = './lipu-profile.png';
  avatar.alt = 'LIPU';
  avatar.className = 'message-avatar';
  return avatar;
}

function appendToChat(node) {
  chatBox.appendChild(node);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// =========================
// AUDIO PLAYER
// =========================
function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function createPlayIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5-10-6.5Z"></path>
    </svg>
  `;
}

function createPauseIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5h4v14H7zM13 5h4v14h-4z"></path>
    </svg>
  `;
}

function createCustomAudioPlayer(audioSource) {
  const player = document.createElement('div');
  player.className = 'audio-player';

  const audio = document.createElement('audio');
  audio.src = audioSource;
  audio.preload = 'metadata';

  const playBtn = document.createElement('button');
  playBtn.className = 'audio-play-btn';
  playBtn.type = 'button';
  playBtn.innerHTML = createPlayIcon();

  const main = document.createElement('div');
  main.className = 'audio-player-main';

  const topRow = document.createElement('div');
  topRow.className = 'audio-top-row';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'audio-progress-wrap';

  const progress = document.createElement('div');
  progress.className = 'audio-progress';
  progressWrap.appendChild(progress);

  const time = document.createElement('div');
  time.className = 'audio-time';
  time.textContent = '0:00 / 0:00';

  topRow.appendChild(progressWrap);
  topRow.appendChild(time);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'audio-bottom-row';

  const eq = document.createElement('div');
  eq.className = 'audio-eq';
  eq.innerHTML = '<span></span><span></span><span></span><span></span>';

  bottomRow.appendChild(eq);

  main.appendChild(topRow);
  main.appendChild(bottomRow);

  player.appendChild(playBtn);
  player.appendChild(main);
  player.appendChild(audio);

  function updateTimeUI() {
    const current = formatAudioTime(audio.currentTime);
    const total = formatAudioTime(audio.duration);
    time.textContent = `${current} / ${total}`;

    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progress.style.width = `${pct}%`;
  }

  function setPlayingUI(isPlaying) {
    if (isPlaying) {
      player.classList.add('playing');
      playBtn.innerHTML = createPauseIcon();
    } else {
      player.classList.remove('playing');
      playBtn.innerHTML = createPlayIcon();
    }
  }

  playBtn.addEventListener('click', async () => {
    try {
      stopAllOtherPlayers(audio, player);

      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      console.error('Errore play audio:', err);
    }
  });

  audio.addEventListener('play', () => setPlayingUI(true));
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => {
    setPlayingUI(false);
    audio.currentTime = 0;
    updateTimeUI();
  });
  audio.addEventListener('loadedmetadata', updateTimeUI);
  audio.addEventListener('timeupdate', updateTimeUI);

  progressWrap.addEventListener('click', event => {
    const rect = progressWrap.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));

    if (Number.isFinite(audio.duration)) {
      audio.currentTime = pct * audio.duration;
      updateTimeUI();
    }
  });

  return player;
}

function stopAllOtherPlayers(currentAudio, currentPlayer) {
  document.querySelectorAll('.audio-player audio').forEach(otherAudio => {
    if (otherAudio !== currentAudio) {
      otherAudio.pause();
    }
  });

  document.querySelectorAll('.audio-player').forEach(otherPlayer => {
    if (otherPlayer !== currentPlayer) {
      otherPlayer.classList.remove('playing');
      const otherBtn = otherPlayer.querySelector('.audio-play-btn');
      if (otherBtn) otherBtn.innerHTML = createPlayIcon();
    }
  });
}

// =========================
// MEMORY
// =========================
function saveTextToMemory(role, content) {
  workingMemory.push({
    role: normalizeRole(role),
    content: normalizeString(content),
    type: 'text'
  });

  trimMemory();
}

function saveAudioToMemory(role, audioDataUrl) {
  workingMemory.push({
    role: normalizeRole(role),
    type: 'audio',
    audioDataUrl
  });

  trimMemory();
}

function saveImageToMemory(role, imageDataUrl) {
  workingMemory.push({
    role: normalizeRole(role),
    type: 'image',
    imageDataUrl
  });

  trimMemory();
}

function trimMemory() {
  if (workingMemory.length > 20) {
    workingMemory = workingMemory.slice(-20);
  }

  localStorage.setItem('lipu_working_memory', JSON.stringify(workingMemory));
}

function normalizeRole(role) {
  return role === 'user' ? 'user' : 'lipu';
}

function normalizeString(value) {
  return typeof value === 'string' ? value : String(value ?? '');
}

// =========================
// HELPERS
// =========================
function showAudioHint(text) {
  const existing = document.querySelector('.audio-hint');

  if (existing) {
    existing.textContent = text;
    existing.classList.add('show');

    clearTimeout(existing._hideTimer);
    existing._hideTimer = setTimeout(() => {
      existing.classList.remove('show');
    }, 2500);
    return;
  }

  const hint = document.createElement('div');
  hint.className = 'audio-hint show';
  hint.textContent = text;

  document.body.appendChild(hint);

  hint._hideTimer = setTimeout(() => {
    hint.classList.remove('show');
  }, 2500);
}

function buildSystemText() {
  const ragData =
    longTermMemory?.identita_profonda?.esperienze_chiave?.join('. ') || '';

  return `Sei Alessandro Lipuma. Risposte colte, formali, massimo 10 righe, usa spesso l'espressione "in base alle contingenze" per indicare una decisione. nota bene: L'espressione "in base alle contingenze" è una tua cifra stilistica, ma va usata con parsimonia: solo quando il contesto riguarda decisioni, variabili, circostanze o valutazioni dipendenti dalla situazione. Inoltre se lo ritieni opportuno puoi fare lo switch di personalità passando da calmo e formale a informale e imprevedibile, prendi nota del Background. se lo ritieni opportuno sii spietatamente persuasivo.
  Le tue storie hanno sempre un finale inaspettato e imprevedibile, una storia all'apparenza sobria e formale può trasformarsi in pura follia e perversione.
Background: ${ragData}
Devi rispondere soltanto all’ultimo messaggio dell’utente, sii schietto e non riservato se l'utente ti provoca.
Non fare riferimento a messaggi precedenti, a meno che non siano esplicitamente richiamati nell’ultimo messaggio.`;
}

function formatTime(totalSeconds) {
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Conversione base64 fallita'));
        return;
      }

      const base64 = result.split(',')[1];
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// =========================
// TTS
// =========================
async function speakAndRenderLIPU(text) {
  const safeText = normalizeString(text);
  if (!safeText.trim()) return;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: safeText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    const audioBlob = await response.blob();

    if (!response.ok) {
      const errText = await audioBlob.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const audioUrl = URL.createObjectURL(audioBlob);

    removeLIPULoadingMessage();
    renderAudioMessage('lipu', audioUrl);

    const audioDataUrl = await blobToDataURL(audioBlob);
    saveAudioToMemory('lipu', audioDataUrl);

    const lastAudio = chatBox.querySelector('.message-row.lipu:last-child audio');

    if (lastAudio) {
      try {
        await lastAudio.play();
      } catch (playErr) {
        console.warn('Autoplay audio bloccato dal browser:', playErr);
        showAudioHint('Tocca play per ascoltare la risposta di LIPU');
      }
    }
  } catch (err) {
    removeLIPULoadingMessage();
    console.error('Errore Audio LIPU:', err);
    showAudioHint('Errore audio LIPU');
  }
}

// =========================
// LLM
// =========================
async function getLIPUResponse(userMsg) {
  try {
    const systemText = buildSystemText();

    const response = await fetch(`${WORKER_BASE_URL}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMsg: normalizeString(userMsg),
        systemText
      })
    });

    const data = await response.json();
    console.log('Claude worker response:', data);

    if (!response.ok) {
      throw new Error(data?.error || 'Errore Claude');
    }

    if (typeof data?.text === 'string' && data.text.trim()) {
      return data.text.trim();
    }

    console.warn('Claude senza testo utile:', data);
    return 'Nessuna risposta testuale generata.';
  } catch (err) {
    console.error('Errore Claude dettagliato:', err);
    return 'Si è verificato un errore nelle comunicazioni formali.';
  }
}

// =========================
// STT / OCR
// =========================
async function transcribeAudioWithGemini(audioBlob) {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || 'audio/webm';

    const response = await fetch(`${WORKER_BASE_URL}/api/gemini-stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Audio, mimeType })
    });

    const data = await response.json();
    console.log('STT response:', data);

    if (!response.ok) {
      console.error('Errore STT Gemini:', data);
      throw new Error(data?.error || 'Errore STT Gemini');
    }

    return data?.text?.trim() || '';
  } catch (err) {
    console.error('Errore trascrizione Gemini:', err);
    return '';
  }
}

async function extractTextFromImageWithGemini(imageBlob) {
  try {
    const base64Image = await blobToBase64(imageBlob);
    const mimeType = imageBlob.type || 'image/png';

    const response = await fetch(`${WORKER_BASE_URL}/api/gemini-ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mimeType })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Errore OCR Gemini:', data);
      throw new Error(data?.error || 'Errore OCR Gemini');
    }

    return data?.text?.trim() || '';
  } catch (err) {
    console.error('Errore OCR immagine:', err);
    return '';
  }
}

// =========================
// WEB SPEECH FALLBACK
// =========================
function transcribeWithWebSpeechAPI() {
  return new Promise((resolve, reject) => {
    if (!SpeechRecognition) {
      reject(new Error('Web Speech API non supportata'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event) => {
      finalTranscript = Array.from(event.results)
        .map(result => result[0]?.transcript || '')
        .join(' ')
        .trim();
    };

    recognition.onerror = (event) => {
      reject(new Error(event.error || 'Errore Web Speech API'));
    };

    recognition.onend = () => {
      if (finalTranscript) {
        resolve(finalTranscript);
      } else {
        reject(new Error('Trascrizione vuota'));
      }
    };

    recognition.start();
  });
}

async function transcribeAudioWithFallback(audioBlob) {
  const geminiTranscript = await transcribeAudioWithGemini(audioBlob);
  console.log('Gemini transcript:', geminiTranscript);

  if (geminiTranscript) return geminiTranscript;

  try {
    if (SpeechRecognition) {
      showAudioHint('Trascrizione cloud non disponibile. Ripeti il messaggio.');
      const browserTranscript = await transcribeWithWebSpeechAPI();
      console.log('Web Speech transcript:', browserTranscript);
      return browserTranscript;
    }
  } catch (err) {
    console.warn('Web Speech API fallita:', err);
  }

  return '';
}

// =========================
// RECORDING
// =========================
function startWaveUI() {
  waveform.classList.add('active');
  recordBtn.classList.add('recording');
  recordingUI.classList.add('active');
  userInput.style.display = 'none';

  recordingStatus.textContent = 'Registrazione...';
  recordingSeconds = 0;
  recordingTime.textContent = '00:00';

  clearInterval(recordingInterval);
  recordingInterval = setInterval(() => {
    recordingSeconds++;
    recordingTime.textContent = formatTime(recordingSeconds);
  }, 1000);
}

function stopWaveUI(hasAudio = true) {
  waveform.classList.remove('active');
  recordBtn.classList.remove('recording');
  clearInterval(recordingInterval);

  if (hasAudio) {
    recordingStatus.textContent = 'Audio pronto';
  } else {
    recordingStatus.textContent = 'Registrazione...';
    recordingTime.textContent = '00:00';
    recordingUI.classList.remove('active');
    userInput.style.display = 'block';
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    audioChunks = [];
    lastAudioBlob = null;
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      lastAudioBlob = new Blob(audioChunks, {
        type: mediaRecorder.mimeType || 'audio/webm'
      });

      stopWaveUI(true);
      isRecording = false;
      stream.getTracks().forEach(track => track.stop());

      if (stopRecordingResolver) {
        stopRecordingResolver();
        stopRecordingResolver = null;
      }
    };

    mediaRecorder.start();
    isRecording = true;
    startWaveUI();
  } catch (err) {
    console.error('Errore registrazione audio:', err);
    recordingStatus.textContent = 'Microfono non disponibile';
    stopWaveUI(false);
  }
}

function stopRecording() {
  return new Promise(resolve => {
    if (!mediaRecorder || !isRecording) {
      resolve();
      return;
    }

    stopRecordingResolver = resolve;
    mediaRecorder.stop();
  });
}

// =========================
// HANDLERS
// =========================
async function handleTextMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  renderMessage('user', text);
  saveTextToMemory('user', text);
  userInput.value = '';

  disableComposer(true);

  try {
    renderLIPULoadingMessage('Lipu sta registrando...');
    const aiText = await getLIPUResponse(text);
    await speakAndRenderLIPU(aiText);
  } catch (err) {
    removeLIPULoadingMessage?.();
    console.error('Errore handleTextMessage dettagliato:', err);
    console.error('Messaggio errore:', err?.message);
    showAudioHint(err?.message || 'Errore risposta testuale');
  } finally {
    disableComposer(false);
    userInput.focus();
  }
}
async function handleAudioMessage() {
  if (!lastAudioBlob) {
    console.error('handleAudioMessage: lastAudioBlob assente');
    showAudioHint('Nessun audio pronto da inviare');
    return;
  }

  disableComposer(true);

  try {
    console.log('1. Converto blob in dataURL...');
    const audioDataUrl = await blobToDataURL(lastAudioBlob);

    console.log('2. Render audio utente...');
    renderAudioMessage('user', audioDataUrl);
    saveAudioToMemory('user', audioDataUrl);

    recordingStatus.textContent = 'Elaborazione...';

    console.log('3. Trascrizione audio...');
    const transcript = await transcribeAudioWithFallback(lastAudioBlob);
    console.log('Transcript ottenuto:', transcript);

    if (!transcript || !transcript.trim()) {
      showAudioHint('Non ho capito, ripeti');
      return;
    }

    console.log('4. Chiamo LLM...');
    renderLIPULoadingMessage('Lipu sta ascoltando il vocale...');
    const aiText = await getLIPUResponse(transcript);
    console.log('Risposta LLM:', aiText);

    if (!aiText || !aiText.trim()) {
      throw new Error('Risposta AI vuota');
    }

    console.log('5. Genero audio LIPU...');
    await speakAndRenderLIPU(aiText);

    resetAudioComposerState();
  } catch (err) {
    removeLIPULoadingMessage();
    console.error('Errore invio audio dettagliato:', err);
    console.error('Messaggio errore:', err?.message);
    showAudioHint(err?.message || 'Errore invio audio');
  } finally {
    disableComposer(false);
  }
}

async function handleImageMessage(file) {
  if (!file) return;

  disableComposer(true);

  try {
    const imageDataUrl = await blobToDataURL(file);

    renderImageMessage('user', imageDataUrl);
    saveImageToMemory('user', imageDataUrl);

    recordingStatus.textContent = 'Analisi immagine...';

    const extractedText = await extractTextFromImageWithGemini(file);

    if (!extractedText) {
      throw new Error('Nessun testo estratto dall’immagine');
    }

    renderLIPULoadingMessage('Lipu sta guardando l’immagine...');
    const aiText = await getLIPUResponse(extractedText);
    await speakAndRenderLIPU(aiText);

    recordingStatus.textContent = 'Registrazione...';
    recordingTime.textContent = '00:00';
  } catch (err) {
    removeLIPULoadingMessage();
    console.error('Errore gestione immagine:', err);
    showAudioHint('Errore analisi immagine');
  } finally {
    disableComposer(false);
    userInput.focus();
  }
}

function resetAudioComposerState() {
  lastAudioBlob = null;
  recordingUI.classList.remove('active');
  userInput.style.display = 'block';
  recordingTime.textContent = '00:00';
  recordingStatus.textContent = 'Registrazione...';
}

// =========================
// COMPOSER
// =========================
function disableComposer(disabled) {
  if (sendBtn) sendBtn.disabled = disabled;
  if (recordBtn) recordBtn.disabled = disabled;
  if (userInput) userInput.disabled = disabled;
  if (imageBtn) imageBtn.disabled = disabled;
}

// =========================
// EVENTS
// =========================
function bindEvents() {
  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording();
    }
  });

  sendBtn.addEventListener('click', async () => {
    if (isRecording) {
      await stopRecording();
      await handleAudioMessage();
    } else if (lastAudioBlob) {
      await handleAudioMessage();
    } else {
      await handleTextMessage();
    }
  });

  userInput.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleTextMessage();
    }
  });

  if (imageBtn && imageInput) {
    imageBtn.addEventListener('click', () => {
      imageInput.click();
    });

    imageInput.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;

      await handleImageMessage(file);
      imageInput.value = '';
    });
  }
}

init();