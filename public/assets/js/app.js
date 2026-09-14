/**
 * Shared helpers used by every page: reading the CSRF cookie, calling the
 * JSON API, and guarding pages that require a signed-in session.
 */

// Load the shared classic-medieval button skin after each page's own styles.
(() => {
  if (document.querySelector('link[data-classic-buttons]')) return;
  const source = document.currentScript?.src;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.classicButtons = 'true';
  link.href = source ? new URL('../css/classic-buttons.css', source).href : 'assets/css/classic-buttons.css';
  document.head.append(link);
})();

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
