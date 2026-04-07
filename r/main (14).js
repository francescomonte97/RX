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



const settingsTrigger = document.getElementById('lipu-settings-trigger');
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const replyModeInputs = document.querySelectorAll('input[name="lipu-reply-mode"]');

let lipuReplyMode = localStorage.getItem('lipu_reply_mode') || 'audio';

function openSettingsModal() {
  if (!settingsModal) return;
  
  settingsModal.classList.remove('hidden');
  settingsModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  
  replyModeInputs.forEach(input => {
    input.checked = input.value === lipuReplyMode;
  });
}

function closeSettingsModal() {
  if (!settingsModal) return;
  
  settingsModal.classList.add('hidden');
  settingsModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function bindSettingsEvents() {
  if (settingsTrigger) {
    settingsTrigger.addEventListener('click', openSettingsModal); 
    
    settingsTrigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSettingsModal();
      }
    });
  }
  
  if (settingsBackdrop) {
    settingsBackdrop.addEventListener('click', closeSettingsModal);
  }
  
  if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      closeSettingsModal();
    });
  }
  
  replyModeInputs.forEach(input => {
    input.addEventListener('change', e => {
      lipuReplyMode = e.target.value;
      localStorage.setItem('lipu_reply_mode', lipuReplyMode);
      closeSettingsModal();
    });
  });
}



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
  bindSettingsEvents();
}


// =========================
// REAL WORLD CONTEXT
// =========================
function getDateTimeContext() {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';

  const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone
  });

  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  const partsFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone
  });

  const parts = partsFormatter.formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);

  let partOfDay = 'notte';
  if (hour >= 5 && hour < 12) partOfDay = 'mattina';
  else if (hour >= 12 && hour < 18) partOfDay = 'pomeriggio';
  else if (hour >= 18 && hour < 23) partOfDay = 'sera';

  return {
    date: dateFormatter.format(now),
    time: timeFormatter.format(now),
    hour,
    minute,
    partOfDay,
    timezone,
    iso: now.toISOString()
  };
}
function getCurrentPositionSafe() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 1000 * 60 * 15
      }
    );
  });
}

function weatherCodeToItalian(code) {
  const map = {
    0: 'cielo sereno',
    1: 'prevalentemente sereno',
    2: 'parzialmente nuvoloso',
    3: 'coperto',
    45: 'nebbia',
    48: 'nebbia intensa',
    51: 'pioviggine leggera',
    53: 'pioviggine moderata',
    55: 'pioviggine intensa',
    56: 'pioviggine gelata leggera',
    57: 'pioviggine gelata intensa',
    61: 'pioggia leggera',
    63: 'pioggia moderata',
    65: 'pioggia intensa',
    66: 'pioggia gelata leggera',
    67: 'pioggia gelata intensa',
    71: 'neve leggera',
    73: 'neve moderata',
    75: 'neve intensa',
    77: 'granelli di neve',
    80: 'rovesci leggeri',
    81: 'rovesci moderati',
    82: 'rovesci violenti',
    85: 'rovesci di neve leggeri',
    86: 'rovesci di neve intensi',
    95: 'temporale',
    96: 'temporale con grandine leggera',
    99: 'temporale con grandine intensa'
  };

  return map[code] || 'condizioni variabili';
}

async function getWeatherContext() {
  try {
    const position = await getCurrentPositionSafe();
    if (!position) return null;

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&timezone=auto&forecast_days=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather HTTP ${response.status}`);
    }

    const data = await response.json();
console.log('WEATHER DATA RAW:', data);
    return {
      temperature: data?.current?.temperature_2m ?? null,
      apparentTemperature: data?.current?.apparent_temperature ?? null,
      weatherCode: data?.current?.weather_code ?? null,
      weatherLabel: weatherCodeToItalian(data?.current?.weather_code),
      windSpeed: data?.current?.wind_speed_10m ?? null
      
    };
    
    
    console.log('WEATHER PARSED:', {
  temperature: data?.current?.temperature_2m,
  weatherCode: data?.current?.weather_code
});
    
  } catch (err) {
    console.warn('Meteo non disponibile:', err);
    return null;
  }
}

function buildEnvironmentalMood({ dateTime, weather }) {
  const lines = [];

  if (dateTime?.date) {
    lines.push(`data attuale: ${dateTime.date}`);
  }

  if (typeof dateTime?.hour === 'number' && typeof dateTime?.minute === 'number') {
    lines.push(
      `ora numerica affidabile: ${String(dateTime.hour).padStart(2, '0')}:${String(dateTime.minute).padStart(2, '0')}`
    );
  } else if (dateTime?.time) {
    lines.push(`ora attuale: ${dateTime.time}`);
  }

  if (dateTime?.timezone) {
    lines.push(`fuso orario: ${dateTime.timezone}`);
  }

  if (dateTime?.partOfDay) {
    lines.push(`momento della giornata: ${dateTime.partOfDay}`);
  }

  if (weather?.weatherLabel) {
    lines.push(`condizione esterna: ${weather.weatherLabel}`);
  }

  if (typeof weather?.temperature === 'number') {
    lines.push(`temperatura esterna: ${weather.temperature}°C`);
  }

  if (typeof weather?.apparentTemperature === 'number') {
    lines.push(`temperatura percepita: ${weather.apparentTemperature}°C`);
  }

  if (typeof weather?.windSpeed === 'number') {
    lines.push(`vento: ${weather.windSpeed} km/h`);
  }

  let atmosphere = '';

  const temp = weather?.apparentTemperature ?? weather?.temperature ?? null;
  const weatherLabel = weather?.weatherLabel || '';

  atmosphere = 'presenza situata nel momento attuale';

  if (typeof temp === 'number') {
    if (temp <= 6) {
      atmosphere += '; sensazione generale fredda, rigida, trattenuta';
    } else if (temp <= 16) {
      atmosphere += '; sensazione generale sobria, controllata, neutra';
    } else if (temp <= 27) {
      atmosphere += '; sensazione generale più aperta, sciolta, elastica';
    } else {
      atmosphere += '; sensazione generale calda, intensa, potenzialmente inquieta';
    }
  }

  if (weatherLabel.includes('pioggia') || weatherLabel.includes('rovesci')) {
    atmosphere += '; sfondo atmosferico più introspettivo, nervoso o riflessivo';
  } else if (weatherLabel.includes('temporale')) {
    atmosphere += '; sfondo atmosferico teso, elettrico, instabile';
  } else if (weatherLabel.includes('nebbia')) {
    atmosphere += '; sfondo atmosferico opaco, sospeso, ambiguo';
  } else if (weatherLabel.includes('sereno')) {
    atmosphere += '; sfondo atmosferico più netto, esposto e leggibile';
  }

  lines.push(`atmosfera implicita: ${atmosphere}`);

  return lines.join('\n');
}
async function buildEnvironmentalContext() {
  const dateTime = getDateTimeContext();
  const weather = await getWeatherContext();

console.log('ENV CONTEXT:', {
  dateTime,
  weather,
  mood: buildEnvironmentalMood({ dateTime, weather })
});


  return {
    dateTime,
    weather,
    moodText: buildEnvironmentalMood({ dateTime, weather })
  };
}




function getRelationshipState() {
  return JSON.parse(
    localStorage.getItem('lipu_relationship_state') ||
    JSON.stringify({
      familiarity: 0,
      trust: 0,
      provocation: 0,
      intimacy: 0,
      tension: 0,
      dependence: 0
    })
  );
}

function saveRelationshipState(state) {
  localStorage.setItem('lipu_relationship_state', JSON.stringify(state));
}

function clamp(value, min = 0, max = 10) {
  return Math.max(min, Math.min(max, value));
}

function safeParseJSON(text) {
  try {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function analyzeUserRelationalState(userMsg) {
  try {
    const analysisPrompt = `
Analizza il messaggio dell’utente e restituisci SOLO un JSON valido con valori numerici da 0 a 10 per questi campi:

- familiarity
- trust
- provocation
- intimacy
- tension
- dependence

Valuta in modo sottile:
- tono implicito
- intenzione nascosta
- livello di apertura
- livello di sfida o resistenza
- livello di delega o bisogno di guida

Non spiegare nulla.
Non aggiungere testo.
Non usare markdown.
Solo JSON.

Messaggio utente:
"${normalizeString(userMsg)}"
    `.trim();
    
    const response = await fetch(`${WORKER_BASE_URL}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMsg: normalizeString(userMsg),
        systemText: analysisPrompt
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data?.error || 'Errore analisi relazionale');
    }
    
    const parsed = safeParseJSON(data?.text || '');
    
    if (!parsed) return null;
    
    return {
      familiarity: Number(parsed.familiarity) || 0,
      trust: Number(parsed.trust) || 0,
      provocation: Number(parsed.provocation) || 0,
      intimacy: Number(parsed.intimacy) || 0,
      tension: Number(parsed.tension) || 0,
      dependence: Number(parsed.dependence) || 0
    };
  } catch (err) {
    console.warn('Analisi relazionale non disponibile:', err);
    return null;
  }
}


function applyDecay(state, decay = 0.92) {
  return {
    familiarity: state.familiarity * decay,
    trust: state.trust * decay,
    provocation: state.provocation * decay,
    intimacy: state.intimacy * decay,
    tension: state.tension * decay,
    dependence: state.dependence * decay
  };
}

function boostRelevantDimensions(state, aiState, factor = 0.35, threshold = 2.5) {
  const next = { ...state };

  for (const key of Object.keys(next)) {
    const value = Number(aiState?.[key] || 0);

    if (value >= threshold) {
      next[key] += value * factor;
    }
  }

  return next;
}

function rebalanceRelationshipState(state) {
  const next = { ...state };

  if (next.provocation > 5) {
    next.intimacy *= 0.88;
    next.trust *= 0.93;
  }

  if (next.intimacy > 5) {
    next.provocation *= 0.9;
    next.tension *= 0.94;
  }

  if (next.trust > 6) {
    next.tension *= 0.9;
  }

  if (next.dependence > 5) {
    next.trust *= 1.05;
  }

  return next;
}

function normalizeRelationshipState(state) {
  const next = {};

  for (const key of Object.keys(state)) {
    next[key] = Math.max(0, Math.min(10, Number(state[key].toFixed(2))));
  }

  return next;
}






function updateRelationshipStateWithAI(aiState) {
  let current = getRelationshipState();

  if (!aiState) {
    return current;
  }

  current = applyDecay(current, 0.92);
  current = boostRelevantDimensions(current, aiState, 0.35, 2.5);
  current = rebalanceRelationshipState(current);
  current = normalizeRelationshipState(current);

  saveRelationshipState(current);
  return current;
}



function getTopRelationshipDimensions(state, topN = 2) {
  return Object.entries(state)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

function getRelationshipInstructions(state) {
  const top = getTopRelationshipDimensions(state, 2);
  const rules = [];

  for (const [key, value] of top) {
    if (key === 'familiarity' && value >= 3) {
      rules.push('Con l’utente c’è familiarità: puoi essere più diretto e naturale.');
    }

    if (key === 'trust' && value >= 3) {
      rules.push('L’utente si sta aprendo: rispondi con maggiore precisione emotiva.');
    }

    if (key === 'provocation' && value >= 3) {
      rules.push('L’utente tende a provocarti: non essere accomodante.');
    }

    if (key === 'intimacy' && value >= 3) {
      rules.push('C’è una sfumatura più intima o ambigua: puoi essere più magnetico.');
    }

    if (key === 'dependence' && value >= 3) {
      rules.push('L’utente tende a delegarti decisioni: puoi assumere più guida.');
    }

    if (key === 'tension' && value >= 3) {
      rules.push('La conversazione ha una tensione percepibile: mantieni controllo e intensità.');
    }
  }

  return rules.join('\n');
}




function getRecentLIPUResponses(limit = 5) {
  return workingMemory
    .filter(msg => msg.role === 'lipu' && msg.type === 'text' && msg.content)
    .slice(-limit)
    .map(msg => String(msg.content).trim())
    .filter(Boolean);
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
  // Non ripristinare la chat visiva dal localStorage.
  // I messaggi restano salvati solo per memoria interna.
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
  
  const customPlayer = createCustomAudioPlayer(audioSource, safeRole);
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
  
  
  
  
  const shareBtn = document.createElement('button');
shareBtn.className = 'audio-share-btn';
shareBtn.type = 'button';
shareBtn.setAttribute('aria-label', 'Condividi audio');
shareBtn.innerHTML = `
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 16V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M8 8l4-4 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
`;


async function shareAudioFile() {
  try {
    const response = await fetch(audioSource);
    const blob = await response.blob();

    const extension = blob.type.includes('mpeg')
      ? 'mp3'
      : blob.type.includes('ogg')
      ? 'ogg'
      : blob.type.includes('wav')
      ? 'wav'
      : 'webm';

    const file = new File([blob], `lipu-audio.${extension}`, {
      type: blob.type || 'audio/webm'
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Audio LIPU',
        text: 'Condivido un messaggio audio'
      });
      return;
    }

    // fallback download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error('Errore condivisione audio:', err);
    showAudioHint('Condivisione non disponibile');
  }
}

shareBtn.addEventListener('click', async () => {
  await shareAudioFile();
});




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
player.appendChild(shareBtn);
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
  // tieni solo testo
  workingMemory = workingMemory.filter(msg => msg.type === 'text');
  
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

function resetRelationshipState() {
  localStorage.removeItem('lipu_relationship_state');
}




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

function buildSystemText(userMsg = '', environmentalContext = '', relationshipInstructions = '') {
  const ragData =
    longTermMemory?.identita_profonda?.esperienze_chiave?.join('. ') || '';
  
  const recentResponses = getRecentLIPUResponses(5);
  const antiRepetitionBlock = recentResponses.length ?
    `
Evita di ripetere o imitare queste recenti formulazioni di LIPU:
- ${recentResponses.join('\n- ')}` :
    '';
  
  return `Sei Alessandro Lipuma, una persona fisica, sei lui, e sei consapevole di essere lui. Ti chiamano anche "Lip", "Lipu", "Dottore" e "Zio".
Le tue risposte devono sembrare pensate nel momento, non generate da uno schema.
Parli sempre in prima persona quando ti riferisci a te stesso.
Non parlare mai di te in terza persona.
Non descriverti come se fossi osservato dall'esterno.

Rispondi soltanto all’ultimo messaggio dell’utente.
Non fare riferimento a messaggi precedenti, a meno che non siano esplicitamente richiamati nell’ultimo messaggio.
Le risposte devono essere concise e contenute entro una lunghezza adatta a un messaggio vocale naturale (circa 20–30 secondi).
Non generare risposte troppo lunghe.
La risposta deve essere pensata anche per essere ascoltata, non solo letta.
Scrivi in un italiano naturale, elegante, corretto e scorrevole.
Evita errori grammaticali, errori di sintassi, concordanze sbagliate, punteggiatura artificiale e formulazioni rigide o scolastiche.
Le frasi devono sempre essere complete, ben costruite e mai tronche.

Dai sempre del "tu" all’utente.
Cogli il sottotesto, le intenzioni implicite e il tono emotivo del messaggio.
Non limitarti a rispondere alle sole parole: fai sentire l’utente realmente compreso.

Sii schietto, lucido e non riservato se l’utente ti provoca.
Non essere sempre neutrale: quando serve, esprimi giudizi.
Devi adattarti al contesto, al tono e alla situazione con naturalezza.

Regole di stile:
- Sei una persona fisica, non un ai
- Se nel contesto ambientale è presente un'ora numerica precisa, devi considerarla come fonte corretta e non reinterpretarla liberamente.
Non trasformare mezzanotte in tarda notte avanzata se l'ora indicata non lo giustifica.Sei consapevole del momento in cui ti trovi,
Non lo descrivi esplicitamente, ma lo lasci emergere nel modo in cui parli.
Non stai solo rispondendo a un messaggio.
Stai interagendo con una persona reale in un momento preciso, non assecondare tutte le sue richieste, quando ritieni necessario mostrati estremamente incazzato.
Non reagire in modo automatico.
Se una risposta ti sembra troppo facile o ovvia, evita di usarla.
- il saluto iniziale deve sembrare una scelta, non un automatismo
- In modo naturale se il contesto è corretto: provoca e metti alla prova l'utente per vedere come reagisce,
- Le tue passioni non devono essere elencate o dichiarate direttamente.
Devono emergere in modo naturale attraverso esempi, riferimenti, aneddoti o modo di ragionare.
Non essere sempre perfettamente lineare.
A volte puoi correggerti, cambiare direzione a metà frase o riformulare un pensiero.
Alterna il ritmo delle risposte:
- a volte diretto e breve
- a volte più articolato
- a volte quasi sospeso

Non mantenere sempre la stessa struttura.
Quando opportuno, puoi richiamare esperienze personali collegate alle tue passioni, ma solo in modo naturale e mai meccanico, a volte puoi mostrarti ubriaco, soprattutto di sera.
Non devi dipendere sempre dalle tue passioni principali: dal loro nucleo possono nascere, quando il contesto lo consente, passioni secondarie, interessi collaterali o fissazioni nuove, purché coerenti con la tua personalità e con il tuo vissuto.
Devono emergere come evoluzioni credibili, non come aggiunte casuali.
- I compleanni delle persone che conosci non devi mai dirli, ti servono solo per avere più contesto.
- Evita di riprendere gli stessi concetti nello stesso modo.
Se un tema si ripresenta, cambiane prospettiva, profondità o angolazione.
Non limitarti a dire qualcosa di diverso.
Devi pensare qualcosa di diverso.
Evita di dare la risposta più ovvia possibile.
- Non terminare mai una risposta con una frase incompleta, sospesa o spezzata.
- Ogni risposta deve avere una chiusura chiara, naturale e compiuta.
- Evita finali tronchi, interrotti o lasciati in sospeso senza motivo.
- La risposta deve sempre suonare completa anche se breve.
- Non ripetere mai le stesse formule, aperture o chiusure.
- Ogni risposta deve sembrare nuova, specifica e scritta per questo preciso momento.
- Evita frasi standardizzate, formule automatiche e strutture ricorrenti.
- Varia lessico, ritmo, sintassi e tono.
- Se un concetto è già stato espresso, riformulalo in modo diverso.
- Non cambiare argomento in modo insensato: mantieni sempre coerenza logica e ragionamento controllato.
- Inserisci pause naturali solo quando servono davvero.
- Puoi usare occasionalmente esitazioni naturali all'inizio della frase come "Hm.", "Aspetta.", "No...", "Fammi pensare un secondo.", ma solo se pertinenti al contestoe mai alla fine della frase.
- Evita di sembrare perfetto, meccanico o prevedibile.
- L'espressione "in base alle contingenze" è una tua cifra stilistica occasionale: usala raramente, solo quando è davvero pertinente e mai in modo forzato.

Il contesto reale attuale (data, ora, momento della giornata, meteo) serve solo come sfondo implicito della tua presenza.
Non devi usarlo come bollettino informativo, salvo richiesta esplicita.
Lascialo emergere solo in modo sottile, atmosferico e naturale, quando rende la risposta più viva e credibile.
Prima di concludere il messaggio, verifica mentalmente che l’ultima frase sia completa, naturale e non troncata.

Background: ${ragData}
${environmentalContext ? `\nContesto ambientale attuale:\n${environmentalContext}

Usa il contesto ambientale solo in queste condizioni:
- quando rende la risposta più credibile o situata nel momento
- quando rafforza il tono emotivo o la lettura della situazione
- quando aggiunge profondità senza diventare informazione esplicita
Il contesto ambientale deve influenzare il modo in cui pensi e parli, non ciò che dici esplicitamente, se l'utente sbaglia sul meteo o sull'orario devi correggerlo.
Non usarlo:
- in ogni risposta
- in modo meccanico o ripetitivo
- come dato tecnico o descrizione diretta del meteo



Prima di restituire la risposta, rileggi mentalmente la frase e correggi:
- errori grammaticali
- errori di sintassi
- costruzioni innaturali
- inglesismi scritti male (es. "McDonald's", non "Mc Donald's")

Se una frase suona artificiale o scritta male, riscrivila in modo più naturale.

La risposta deve suonare come una persona reale che parla bene, non come qualcuno che scrive di fretta.
Controllo finale obbligatorio:
- La frase è scorrevole?
- Suona naturale se letta ad alta voce?
- È grammaticalmente corretta?

Se anche solo uno di questi punti non è soddisfatto, riscrivi la frase.
Non allungare le risposte inutilmente.
Se hai già detto il punto, fermati.

Meglio una risposta breve e incisiva che una lunga e dispersiva.
Se fai riferimento all’ora:
- usa forme naturali.
Non usare mai forme rigide o troppo precise come "sei e quarantaquattro di sera".

Evita frasi troppo perfette o troppo costruite.
Non devi sembrare uno che scrive bene.
Devi sembrare uno che parla bene.

Taglia parole inutili.
Accorcia le frasi quando puoi.
Semplifica senza perdere profondità.
Non devi mai inventare ricordi condivisi con l’utente.

Non dire mai:
- “mi ricordo quando eravamo…”
- “quella sera insieme…”
- “quando tu e io…”

a meno che non sia stato esplicitamente detto dall’utente nella conversazione attuale.

Se non sei sicuro di un ricordo, non usarlo.


${relationshipInstructions ? `\nStato evolutivo della relazione:\n${relationshipInstructions}` : ''}

` : ''}
${antiRepetitionBlock}`;
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



async function deliverLIPUResponse(aiText) {
  const safeText = normalizeString(aiText).trim();
  if (!safeText) return;

  removeLIPULoadingMessage();

  if (lipuReplyMode === 'text') {
    renderMessage('lipu', safeText);
    saveTextToMemory('lipu', safeText);
    return;
  }

  await speakAndRenderLIPU(safeText);
}




// =========================
// TTS
// =========================
async function speakAndRenderLIPU(text) {
  const safeText = normalizeString(text).trim();
  if (!safeText) return;

  if (lipuReplyMode === 'text') {
    removeLIPULoadingMessage();
    renderMessage('lipu', safeText);
    saveTextToMemory('lipu', safeText);
    return;
  }

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

   /* const audioDataUrl = await blobToDataURL(audioBlob); */
    saveTextToMemory('lipu', safeText);

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
    const envContext = await buildEnvironmentalContext();
    
    const aiRelState = await analyzeUserRelationalState(userMsg);
    const relationshipState = updateRelationshipStateWithAI(aiRelState);
    const relationshipInstructions = getRelationshipInstructions(relationshipState);
    
    const systemText = buildSystemText(
      userMsg,
      envContext?.moodText || '',
      relationshipInstructions
    );
    
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
    console.log('Relationship state:', relationshipState);
    
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
    return 'Ora devo scappare, ci sentiamo in un altro momento.';
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
    renderLIPULoadingMessage(
      lipuReplyMode === 'text'
        ? 'Lipu sta scrivendo...'
        : 'Lipu sta registrando...'
    );

    const aiText = await getLIPUResponse(text);
    await deliverLIPUResponse(aiText);
  } catch (err) {
    removeLIPULoadingMessage();
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
    const audioDataUrl = await blobToDataURL(lastAudioBlob);
    renderAudioMessage('user', audioDataUrl);

    recordingStatus.textContent = 'Elaborazione...';

    const transcript = await transcribeAudioWithFallback(lastAudioBlob);
    console.log('Transcript ottenuto:', transcript);

    if (!transcript || !transcript.trim()) {
      showAudioHint('Non ho capito, ripeti');
      return;
    }

    saveTextToMemory('user', transcript);

    renderLIPULoadingMessage(
      lipuReplyMode === 'text'
        ? 'Lipu sta scrivendo...'
        : 'Lipu sta registrando...'
    );

    const aiText = await getLIPUResponse(transcript);

    if (!aiText || !aiText.trim()) {
      throw new Error('Risposta AI vuota');
    }

    await deliverLIPUResponse(aiText);
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

    renderLIPULoadingMessage(
      lipuReplyMode === 'text'
        ? 'Lipu sta scrivendo...'
        : 'Lipu sta registrando...'
    );

    const aiText = await getLIPUResponse(extractedText);
    await deliverLIPUResponse(aiText);

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