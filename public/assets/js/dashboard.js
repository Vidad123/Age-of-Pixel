document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;

  const nameEl = document.querySelector('#username');
  if (nameEl) nameEl.textContent = user.username;
  const modalNameEl = document.querySelector('#modalUsername');
  if (modalNameEl) modalNameEl.textContent = user.username;
  const adminMenuBtn = document.querySelector('#adminMenuBtn');
  if (adminMenuBtn && user.is_admin) adminMenuBtn.hidden = false;

  // --- Synthesized "paper scroll" rustle sound (no audio file needed) ---
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playScrollSound(opening) {
    const settings = window.AOPSettings?.get();
    if (settings && !settings.soundEffectsEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = opening ? 0.6 : 0.4;
    const master = ctx.createGain();
    master.gain.value = 0.52 * (settings?.masterVolume ?? 1) * (settings?.soundEffectsVolume ?? 0.8);
    master.connect(ctx.destination);

    // Layer 1: a quiet underlying "sheet moving" whoosh (broad noise, swept filter).
    const sheetSize = Math.floor(ctx.sampleRate * duration);
    const sheetBuf = ctx.createBuffer(1, sheetSize, ctx.sampleRate);
    const sheetData = sheetBuf.getChannelData(0);
    for (let i = 0; i < sheetSize; i++) sheetData[i] = Math.random() * 2 - 1;
    const sheetSrc = ctx.createBufferSource();
    sheetSrc.buffer = sheetBuf;
    const sheetFilter = ctx.createBiquadFilter();
    sheetFilter.type = 'bandpass';
    sheetFilter.Q.value = 0.6;
    if (opening) {
      sheetFilter.frequency.setValueAtTime(500, now);
      sheetFilter.frequency.linearRampToValueAtTime(1800, now + duration);
    } else {
      sheetFilter.frequency.setValueAtTime(1800, now);
      sheetFilter.frequency.linearRampToValueAtTime(500, now + duration);
    }
    const sheetGain = ctx.createGain();
    sheetGain.gain.setValueAtTime(0, now);
    sheetGain.gain.linearRampToValueAtTime(0.08, now + duration * 0.2);
    sheetGain.gain.linearRampToValueAtTime(0, now + duration);
    sheetSrc.connect(sheetFilter).connect(sheetGain).connect(master);
    sheetSrc.start(now);
    sheetSrc.stop(now + duration);

    // Layer 2: soft crackle "grains" — this is what reads as paper, kept gentle not staticky.
    const crackleCount = opening ? 34 : 20;
    for (let i = 0; i < crackleCount; i++) {
      const t = now + Math.pow(Math.random(), 1.3) * duration * (opening ? 1 : 0.85);
      const len = 0.012 + Math.random() * 0.024;
      const size = Math.max(1, Math.floor(ctx.sampleRate * len));
      const buf = ctx.createBuffer(1, size, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < size; j++) {
        // Softer attack/decay curve — rounded, not a sharp click.
        const pos = j / size;
        const envelope = Math.sin(Math.PI * pos) * (1 - pos * 0.3);
        d[j] = (Math.random() * 2 - 1) * envelope;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900 + Math.random() * 1400;
      bp.Q.value = 0.9;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      const g = ctx.createGain();
      const peak = (0.12 + Math.random() * 0.22) * (opening ? 1 : 0.7);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + len * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(bp).connect(lp).connect(g).connect(master);
      src.start(t);
      src.stop(t + len + 0.005);
    }
  }

  const backdrop = document.querySelector('#scrollBackdrop');
  const pages = {
    singleplayer: document.querySelector('#singleplayerPage'),
    savedgames: document.querySelector('#savedGamesPage'),
    multiplayer: document.querySelector('#multiplayerPage'),
    localmatch: document.querySelector('#localmatchPage'),
    options: document.querySelector('#optionsPage'),
    credits: document.querySelector('#creditsPage')
  };

  function renderSavedGames() {
    const list = document.querySelector('[data-saved-games]');
    if (!list) return;
    let active = null;
    try { active = JSON.parse(localStorage.getItem('ageofpixel-active-match') || 'null'); } catch (e) {}
    const saves = Object.keys(localStorage).filter(key => key.startsWith('ageofpixel-game-')).map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || 'null');
        if (!data) return null;
        const rawUrl = data.url || (active?.saveKey === key ? active.url : '');
        let url = '';
        try {
          const parsed = new URL(rawUrl, location.href);
          if (parsed.origin === location.origin && /\/play\.html$/.test(parsed.pathname)) url = parsed.href;
        } catch (e) {}
        return { key, data, url, name: data.mapName || (active?.saveKey === key ? active.mapName : 'Saved Battle') };
      } catch (e) { return null; }
    }).filter(Boolean).sort((a, b) => (b.data.updatedAt || 0) - (a.data.updatedAt || 0));

    if (!saves.length) {
      list.innerHTML = '<div class="saved-game-empty"><span>♜</span><b>No saved games</b><small>Start a battle and it will appear here automatically.</small></div>';
      return;
    }
    list.innerHTML = saves.map((save, index) => `<article class="saved-game-card" data-save-index="${index}"><div class="saved-game-icon">⚑</div><div><b>${escapeHtml(save.name)}</b><small>Turn ${Number(save.data.turn) || 1}${save.data.campaignWave ? ` · Wave ${Number(save.data.campaignWave)}` : ''}</small></div><div class="saved-game-actions">${save.url ? '<button type="button" data-resume>Resume</button>' : '<button type="button" disabled>Unavailable</button>'}<button type="button" class="delete-save" data-delete>Delete</button></div></article>`).join('');
    list.querySelectorAll('.saved-game-card').forEach(card => {
      const save = saves[Number(card.dataset.saveIndex)];
      card.querySelector('[data-resume]')?.addEventListener('click', () => { location.href = save.url; });
      card.querySelector('[data-delete]').addEventListener('click', () => {
        if (!confirm(`Delete the saved game “${save.name}”?`)) return;
        localStorage.removeItem(save.key);
        if (active?.saveKey === save.key) localStorage.removeItem('ageofpixel-active-match');
        renderSavedGames();
      });
    });
  }

  function openScroll(which) {
    Object.entries(pages).forEach(([k, el]) => { if (el) el.hidden = (k !== which); });
    if (which === 'savedgames') renderSavedGames();
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('open'));
    playScrollSound(true);
  }
  function closeScroll() {
    backdrop.classList.remove('open');
    playScrollSound(false);
    setTimeout(() => { backdrop.hidden = true; }, 260);
  }

  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openScroll(btn.dataset.modal);
    });
  });
  document.querySelector('#scrollClose').addEventListener('click', closeScroll);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeScroll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !backdrop.hidden) closeScroll(); });
  window.addEventListener('aop-saves-cleared', renderSavedGames);

  // --- Single Player setup: map, rules, and player roster ---
  let selectedMap = 'riverwatch';
  const mapNames = { riverwatch: 'Riverwatch Valley', emberfall: 'Emberfall Pass', frosthollow: 'Frosthollow Reach', sunscar: 'Sunscar Desert', verdant: 'Verdant Isles', blackwood: 'Blackwood', goldenplains: 'Golden Plains', shatteredcoast: 'Shattered Coast', moonfen: 'Moonfen Marsh', ironridge: 'Ironridge', infinite: 'Infinite Campaign', random: 'Random Map' };
  const colors = ['blue', 'red', 'yellow', 'green'];
  const playerDefaults = [
    { name: user.username || 'Player 1', control: 'human', color: 'blue', team: '-' },
    { name: 'Ironclad', control: 'ai-hard', color: 'red', team: '-' },
    { name: 'Sunward', control: 'ai-easy', color: 'yellow', team: '-' },
    { name: 'Greenvale', control: 'ai-easy', color: 'green', team: '-' }
  ];

  function selectCard(grid, selector, value) {
    grid.querySelectorAll('.setup-card').forEach(card => {
      card.classList.toggle('selected', card.dataset[selector] === value);
    });
  }

  const mapGrid = document.querySelector('#mapGrid');

  try {
    const custom = JSON.parse(localStorage.getItem('ageofpixel-admin-content') || '{}');
    (custom.deleted?.maps || []).forEach(id => {
      mapGrid?.querySelector(`[data-map="${CSS.escape(id)}"]`)?.remove();
      document.querySelectorAll(`#onlineMap option[value="${CSS.escape(id)}"],#localMap option[value="${CSS.escape(id)}"]`).forEach(option => option.remove());
    });
    (custom.maps || []).forEach(map => {
      if (!map?.id || !map?.name) return;
      mapNames[map.id] = map.name;
      let card = mapGrid.querySelector(`[data-map="${CSS.escape(map.id)}"]`);
      if (!card) { card = document.createElement('button'); card.type = 'button'; card.className = 'setup-card'; card.dataset.map = map.id; mapGrid.insertBefore(card, mapGrid.querySelector('[data-map="random"]')); }
      card.innerHTML = `<span class="setup-icon">▦</span><b>${escapeHtml(map.name)}</b><small>Admin-created custom battlefield.</small>`;
      const builtInMapIds=['riverwatch','emberfall','frosthollow','sunscar','verdant','blackwood','goldenplains','shatteredcoast','moonfen','ironridge'];
      (builtInMapIds.includes(map.id)?['onlineMap','localMap']:['localMap']).forEach(selectId=>{const select=document.querySelector('#'+selectId);let option=select?.querySelector(`option[value="${CSS.escape(map.id)}"]`);if(!option&&select){option=document.createElement('option');option.value=map.id;select.append(option)}if(option)option.textContent=map.name});
    });
  } catch (e) {}

  if (mapGrid) {
    selectCard(mapGrid, 'map', selectedMap);
    mapGrid.querySelectorAll('.setup-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedMap = card.dataset.map;
        const sizeSelect = document.querySelector('#mapSizeSelect');
        if (selectedMap === 'infinite') sizeSelect.value = 'infinite';
        else if (sizeSelect.value === 'infinite') sizeSelect.value = 'medium';
        selectCard(mapGrid, 'map', selectedMap);
      });
    });
  }

  const mapStep = document.querySelector('#mapStep');
  const featuresStep = document.querySelector('#featuresStep');
  const playerRoster = document.querySelector('#playerRoster');
  const playerCountSelect = document.querySelector('#playerCountSelect');

  function showSetupStep(step) {
    const onFeatures = step === 2;
    mapStep.hidden = onFeatures;
    featuresStep.hidden = !onFeatures;
    document.querySelectorAll('[data-step-dot]').forEach(dot => dot.classList.toggle('active', Number(dot.dataset.stepDot) <= step));
  }

  function selectOptions(values, selected) {
    return values.map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`).join('');
  }

  function renderRoster() {
    const count = Number(playerCountSelect.value);
    playerRoster.innerHTML = '';
    playerDefaults.slice(0, count).forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'player-row';
      row.dataset.player = index;
      row.innerHTML = `
        <span class="player-number">${index + 1}</span>
        <input class="player-name" aria-label="Player ${index + 1} name" maxlength="18" value="${player.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">
        <select class="player-control" aria-label="Player ${index + 1} control">${selectOptions([['human','Human'],['ai-hard','AI · Hard'],['ai-easy','AI · Easy']], player.control)}</select>
        <select class="player-color color-${player.color}" aria-label="Player ${index + 1} color">${selectOptions(colors.map(c => [c, c[0].toUpperCase() + c.slice(1)]), player.color)}</select>
        <select class="player-team" aria-label="Player ${index + 1} team">${selectOptions([['-','—'],['1','Team 1'],['2','Team 2'],['3','Team 3']], player.team)}</select>`;
      playerRoster.append(row);
    });
    playerRoster.querySelectorAll('input, select').forEach(control => {
      control.addEventListener('change', () => {
        const row = control.closest('.player-row');
        const player = playerDefaults[Number(row.dataset.player)];
        player.name = row.querySelector('.player-name').value.trim() || `Player ${Number(row.dataset.player) + 1}`;
        player.control = row.querySelector('.player-control').value;
        player.color = row.querySelector('.player-color').value;
        player.team = row.querySelector('.player-team').value;
        row.querySelector('.player-color').className = `player-color color-${player.color}`;
      });
    });
  }

  document.querySelector('#chooseFeaturesBtn')?.addEventListener('click', () => {
    document.querySelector('#chosenMapLabel').textContent = mapNames[selectedMap];
    showSetupStep(2);
  });
  document.querySelector('#backToMapsBtn')?.addEventListener('click', () => showSetupStep(1));
  playerCountSelect?.addEventListener('change', renderRoster);
  renderRoster();

  const startBattleBtn = document.querySelector('#startBattleBtn');
  if (startBattleBtn) {
    startBattleBtn.addEventListener('click', () => {
      playerRoster.querySelectorAll('.player-row').forEach(row => {
        const player = playerDefaults[Number(row.dataset.player)];
        player.name = row.querySelector('.player-name').value.trim() || `Player ${Number(row.dataset.player) + 1}`;
        player.control = row.querySelector('.player-control').value;
        player.color = row.querySelector('.player-color').value;
        player.team = row.querySelector('.player-team').value;
      });
      const count = Number(playerCountSelect.value);
      const availableMaps = Object.keys(mapNames).filter(name => !['random','infinite'].includes(name));
      const battleMap = selectedMap === 'random' ? availableMaps[Math.floor(Math.random() * availableMaps.length)] : selectedMap;
      const params = new URLSearchParams({
        map: battleMap,
        campaign: selectedMap === 'infinite' ? '1' : '0',
        random: selectedMap === 'random' ? '1' : '0',
        size: document.querySelector('#mapSizeSelect').value,
        visibility: document.querySelector('#visibilitySelect').value,
        units: document.querySelector('#unitsSelect').value,
        towns: document.querySelector('#townsSelect').value,
        players: String(count),
        game: Date.now().toString(36),
        roster: JSON.stringify(playerDefaults.slice(0, count))
      });
      window.location.href = 'play.html?' + params.toString();
    });
  }

  document.querySelector('#startLocalBtn')?.addEventListener('click', () => {
    const blue = document.querySelector('#localBlueName').value.trim() || 'Player 1';
    const red = document.querySelector('#localRedName').value.trim() || 'Player 2';
    const roster = [
      { name: blue, control: 'human', color: 'blue', team: '-' },
      { name: red, control: 'human', color: 'red', team: '-' }
    ];
    const params = new URLSearchParams({
      mode: 'local', map: document.querySelector('#localMap').value, size: 'medium',
      visibility: 'reveal', units: 'few', towns: 'normal', players: '2',
      game: Date.now().toString(36), roster: JSON.stringify(roster)
    });
    location.href = 'play.html?' + params.toString();
  });

  const roomResult = document.querySelector('#roomResult');
  function showRoomResult(message, error = false) {
    roomResult.textContent = message;
    roomResult.className = 'room-result ' + (error ? 'error' : 'success');
  }
  document.querySelector('#createRoomBtn')?.addEventListener('click', async () => {
    showRoomResult('Creating room…');
    try {
      const data = await apiPost('api/multiplayer.php', { action: 'create', map: document.querySelector('#onlineMap').value });
      if (!data.ok) return showRoomResult((data.errors || ['Could not create room.']).join(' '), true);
      location.href = `play.html?mode=online&room=${encodeURIComponent(data.room.code)}&slot=1&map=${encodeURIComponent(data.room.map)}&size=medium&visibility=reveal&units=few&towns=normal&players=2&game=${encodeURIComponent(data.room.game_id)}`;
    } catch (error) { showRoomResult(error.message, true); }
  });
  document.querySelector('#joinRoomBtn')?.addEventListener('click', async () => {
    const code = document.querySelector('#roomCodeInput').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return showRoomResult('Enter the 6-character room code.', true);
    showRoomResult('Joining room…');
    try {
      const data = await apiPost('api/multiplayer.php', { action: 'join', code });
      if (!data.ok) return showRoomResult((data.errors || ['Could not join room.']).join(' '), true);
      location.href = `play.html?mode=online&room=${encodeURIComponent(code)}&slot=${data.slot}&map=${encodeURIComponent(data.room.map)}&size=medium&visibility=reveal&units=few&towns=normal&players=2&game=${encodeURIComponent(data.room.game_id)}`;
    } catch (error) { showRoomResult(error.message, true); }
  });

  const logoutBtn = document.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await apiPost('api/logout.php', {});
      } catch (err) {
        // Even if the API call fails, still send them back to login.
      }
      window.location.href = 'login.html';
    });
  }

  document.body.classList.add('auth-ready');
  document.body.style.visibility = 'visible';
});
