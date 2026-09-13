/**
 * Shared helpers used by every page: reading the CSRF cookie, calling the
 * JSON API, and guarding pages that require a signed-in session.
 */

function readCookie(name) {
  const match = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
  return match ? decodeURIComponent(match[1]) : null;
}

/** Shows a visible error banner instead of leaving the page blank. */
function showFatalError(message) {
  document.documentElement.style.visibility = 'visible';
  document.body.style.visibility = 'visible';
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#5a1f1a;color:#ffd9d1;border-bottom:3px solid #a84438;padding:14px 18px;font:14px Georgia,serif;text-align:center';
  box.textContent = message;
  document.body.prepend(box);
}

async function apiGet(path) {
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin' });
  } catch (e) {
    throw new Error('Could not reach the server at ' + path + '. Is Apache running?');
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(
      'Server returned an unexpected (non-JSON) response from ' + path +
      (res.status ? ' (HTTP ' + res.status + ')' : '') +
      '. Open that URL directly in your browser to see the real PHP error — ' +
      'it is usually a database connection problem (MySQL not running, or the AOP database/credentials in src/config.php are wrong).'
    );
  }
  return data;
}

async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': readCookie('csrf_token') || '',
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Could not reach the server at ' + path + '. Is Apache running?');
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(
      'Server returned an unexpected (non-JSON) response from ' + path +
      (res.status ? ' (HTTP ' + res.status + ')' : '') +
      '. Open the browser console/Network tab for the raw response.'
    );
  }
  return data;
}

/** Call on every page load to prime the CSRF cookie + know auth state. */
async function getSession() {
  return apiGet('api/session.php');
}

/** Use on protected pages: redirects to login if not signed in. */
async function requireSession() {
  let session;
  try {
    session = await getSession();
  } catch (e) {
    showFatalError(e.message);
    return null;
  }
  if (!session.authenticated) {
    window.location.replace('login.html');
    return null;
  }
  return session.user;
}

/** Use on login/register pages: bounce straight to dashboard if already in. */
async function redirectIfLoggedIn() {
  let session;
  try {
    session = await getSession();
  } catch (e) {
    // Non-fatal here: the login form itself still works even if this check
    // fails, so just surface the error without blocking the page.
    showFatalError(e.message);
    return;
  }
  if (session.authenticated) {
    window.location.replace('dashboard.html');
  }
}

function showErrors(el, errors) {
  if (!errors || !errors.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = '<ul>' + errors.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Shared player preferences used by the dashboard and every battle.
const AOP_SETTINGS_KEY = 'ageofpixel-settings';
const AOP_DEFAULT_SETTINGS = Object.freeze({
  musicEnabled: true,
  soundEffectsEnabled: true,
  masterVolume: 1,
  musicVolume: 0.42,
  soundEffectsVolume: 0.8,
  graphicsQuality: 'medium',
  animationSpeed: 'normal',
  uiScale: 'normal',
});

function getGameSettings() {
  try {
    return { ...AOP_DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(AOP_SETTINGS_KEY) || '{}') };
  } catch (e) {
    return { ...AOP_DEFAULT_SETTINGS };
  }
}

function saveGameSettings(changes) {
  const settings = { ...getGameSettings(), ...changes };
  localStorage.setItem(AOP_SETTINGS_KEY, JSON.stringify(settings));
  applyGameSettings(settings);
  window.dispatchEvent(new CustomEvent('aop-settings-changed', { detail: settings }));
  return settings;
}

function applyGameSettings(settings = getGameSettings()) {
  const allowedGraphics = ['low', 'medium', 'high'];
  const allowedSpeeds = ['slow', 'normal', 'fast'];
  const allowedScales = ['small', 'normal', 'large'];
  const graphics = allowedGraphics.includes(settings.graphicsQuality) ? settings.graphicsQuality : 'medium';
  const speed = allowedSpeeds.includes(settings.animationSpeed) ? settings.animationSpeed : 'normal';
  const scale = allowedScales.includes(settings.uiScale) ? settings.uiScale : 'normal';
  document.documentElement.dataset.graphicsQuality = graphics;
  document.documentElement.dataset.animationSpeed = speed;
  document.documentElement.dataset.uiScale = scale;
  document.documentElement.style.setProperty('--ui-scale', scale === 'small' ? '.9' : scale === 'large' ? '1.12' : '1');
}

const AOPAudio = (() => {
  let music = null;
  let currentTrackId = '';
  let unlocked = sessionStorage.getItem('ageofpixel-music-unlocked') === '1';
  let lastStoredSecond = -1;
  const script = [...document.scripts].find(el => /(?:^|\/)assets\/js\/app\.js(?:\?|$)/.test(el.src));
  const musicUrl = script ? new URL('../audio/celtic-impulse.mp3', script.src).href : 'assets/audio/celtic-impulse.mp3';

  function playlist() {
    let custom = {};
    try { custom = JSON.parse(localStorage.getItem('ageofpixel-admin-content') || '{}'); } catch (e) {}
    const tracks = [];
    if (!custom.defaultMusicPaused) tracks.push({ id: 'celtic-impulse', name: 'Celtic Impulse', src: musicUrl });
    (custom.music || []).filter(track => !track.paused && track.data).forEach(track => tracks.push({ id: track.id, name: track.name, src: track.data }));
    return tracks;
  }

  function pickTrack(preferredId = '') {
    const tracks = playlist();
    if (!tracks.length) return null;
    const preferred = tracks.find(track => track.id === preferredId);
    if (preferred) return preferred;
    const alternatives = tracks.filter(track => track.id !== currentTrackId);
    return (alternatives.length ? alternatives : tracks)[Math.floor(Math.random() * (alternatives.length || tracks.length))];
  }

  function loadTrack(track, resume = false) {
    if (!track) { if (music) music.pause(); currentTrackId = ''; return null; }
    if (music && currentTrackId === track.id) return music;
    if (music) music.pause();
    currentTrackId = track.id;
    music = new Audio(track.src);
    music.loop = false;
    music.preload = 'metadata';
    music.addEventListener('loadedmetadata', () => {
      const storedTrack = sessionStorage.getItem('ageofpixel-music-track');
      const stored = Number(sessionStorage.getItem('ageofpixel-music-time')) || 0;
      if (resume && storedTrack === track.id && stored > 0 && Number.isFinite(music.duration)) music.currentTime = stored % music.duration;
    }, { once: true });
    music.addEventListener('ended', () => { loadTrack(pickTrack()); sync(); });
    music.addEventListener('timeupdate', () => {
      const second = Math.floor(music.currentTime);
      if (second !== lastStoredSecond && second % 3 === 0) {
        lastStoredSecond = second;
        sessionStorage.setItem('ageofpixel-music-track', currentTrackId);
        sessionStorage.setItem('ageofpixel-music-time', String(music.currentTime));
      }
    });
    return music;
  }

  function ensureMusic() {
    if (music && playlist().some(track => track.id === currentTrackId)) return music;
    return loadTrack(pickTrack(sessionStorage.getItem('ageofpixel-music-track') || ''), true);
  }

  function sync(settings = getGameSettings()) {
    const track = ensureMusic();
    if (!track) return;
    track.volume = Math.max(0, Math.min(1, Number(settings.masterVolume) * Number(settings.musicVolume)));
    if (!settings.musicEnabled) track.pause(); else if (unlocked) track.play().catch(() => {});
  }

  function unlock() {
    unlocked = true;
    sessionStorage.setItem('ageofpixel-music-unlocked', '1');
    sync();
  }

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('aop-settings-changed', event => sync(event.detail));
  window.addEventListener('aop-music-library-changed', () => { ensureMusic(); sync(); });
  window.addEventListener('storage', event => { if (event.key === 'ageofpixel-admin-content') { ensureMusic(); sync(); } });
  window.addEventListener('pagehide', () => {
    if (music) sessionStorage.setItem('ageofpixel-music-time', String(music.currentTime));
  });
  if (unlocked) setTimeout(() => sync(), 0);
  return { sync, unlock, next: () => { loadTrack(pickTrack()); sync(); } };
})();

window.AOPSettings = { get: getGameSettings, save: saveGameSettings, defaults: AOP_DEFAULT_SETTINGS };
window.AOPAudio = AOPAudio;
applyGameSettings();

// Floating music switch shared by the login, registration, and dashboard screens.
function installMusicToggle() {
  if (!/(?:^|\/)(?:dashboard|login|register)(?:\.html)?$/.test(location.pathname) || document.querySelector('#globalMusicToggle')) return;
  const style = document.createElement('style');
  style.textContent = `.global-music-toggle{position:fixed;left:18px;bottom:18px;z-index:90;width:48px;height:48px;border:3px ridge #d89c35;border-radius:50%;display:grid;place-items:center;padding:0;background:radial-gradient(circle at 35% 28%,#41617d,#17283a 62%,#09131e);color:#ffd66e;font:bold 24px/1 Georgia,serif;cursor:pointer;box-shadow:inset 0 2px #fff4,0 5px 13px #000b;text-shadow:0 2px 2px #000;transition:transform .14s,filter .14s}.global-music-toggle:hover{filter:brightness(1.2);transform:translateY(-2px)}.global-music-toggle:active{transform:translateY(1px)}.global-music-toggle.music-off{color:#9d9380;filter:saturate(.3)}.global-music-toggle.music-off::after{content:'';position:absolute;width:32px;height:3px;background:#c7493d;transform:rotate(-42deg);box-shadow:0 1px #2b0b08}.global-music-toggle:focus-visible{outline:3px solid #fff0b1;outline-offset:4px}@media(max-width:600px){.global-music-toggle{left:12px;bottom:12px;width:42px;height:42px;font-size:21px}}`;
  document.head.append(style);
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'globalMusicToggle';
  button.className = 'global-music-toggle';
  button.innerHTML = '<span aria-hidden="true">♫</span>';
  const refresh = () => {
    const enabled = Boolean(getGameSettings().musicEnabled);
    button.classList.toggle('music-off', !enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Turn background music off' : 'Turn background music on');
    button.title = enabled ? 'Music: On' : 'Music: Off';
  };
  button.addEventListener('click', () => {
    const enabled = !getGameSettings().musicEnabled;
    saveGameSettings({ musicEnabled: enabled });
    if (enabled) AOPAudio.unlock();
    refresh();
  });
  window.addEventListener('aop-settings-changed', refresh);
  refresh();
  document.body.append(button);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installMusicToggle); else installMusicToggle();

// Installable PWA support. The button appears on entry screens when the app is not installed.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; document.querySelector('#installAopButton')?.removeAttribute('hidden'); });
async function installAopApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.querySelector('#installAopButton')?.setAttribute('hidden','');
    return;
  }
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  alert(isiOS ? 'To install: tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home screen.');
}
function installPwaSupport() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  if (!/(?:^|\/)(?:dashboard|login|register)(?:\.html)?$/.test(location.pathname) || matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  const button=document.createElement('button');button.type='button';button.id='installAopButton';button.className='global-install-button';button.hidden=true;button.innerHTML='<span aria-hidden="true">⇩</span>';button.title='Install Age of Pixel';button.setAttribute('aria-label','Install Age of Pixel application');button.onclick=installAopApp;
  const style=document.createElement('style');style.textContent='.global-install-button{position:fixed;left:78px;bottom:18px;z-index:90;width:48px;height:48px;border:3px ridge #d89c35;border-radius:50%;display:grid;place-items:center;padding:0;background:radial-gradient(circle at 35% 28%,#744927,#2d1b0d 68%,#140b05);color:#ffd66e;font:bold 27px/1 Georgia,serif;cursor:pointer;box-shadow:inset 0 2px #fff4,0 5px 13px #000b}.global-install-button:hover{filter:brightness(1.2);transform:translateY(-2px)}.global-install-button:focus-visible{outline:3px solid #fff0b1;outline-offset:4px}@media(max-width:600px){.global-install-button{left:64px;bottom:12px;width:42px;height:42px;font-size:23px}}';document.head.append(style);document.body.append(button);
  if (deferredInstallPrompt || /iphone|ipad|ipod/i.test(navigator.userAgent)) button.hidden=false;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPwaSupport);else installPwaSupport();
