document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;

  const name = document.querySelector('#username');
  if (name) name.textContent = user.username;
  const admin = document.querySelector('#adminMenuBtn');
  if (admin && user.is_admin) admin.hidden = false;

  const letter = value => (String(value || user.username || '?').trim()[0] || '?').toUpperCase();
  try {
    const data = await apiGet('api/social.php?action=bootstrap');
    if (data.ok) {
      const profile = data.profile || {};
      const avatar = document.querySelector('#profileAvatar');
      if (avatar) {
        avatar.textContent = letter(profile.display_name || profile.username);
        avatar.style.background = profile.avatar_color || '#9b672e';
      }
      const tagline = document.querySelector('#profileTagline');
      if (tagline) tagline.textContent = profile.bio || 'Ready for battle';
      const friends = data.friends || [];
      const requests = data.requests || [];
      const count = document.querySelector('#friendCount');
      if (count) count.textContent = `${friends.length} companion${friends.length === 1 ? '' : 's'}`;
      const badge = document.querySelector('#friendBadge');
      if (badge) { badge.textContent = String(requests.length); badge.hidden = requests.length === 0; }
      const preview = document.querySelector('#friendPreview');
      if (preview) preview.innerHTML = friends.length
        ? friends.slice(0, 5).map(person => {
            const tier = ['I', 'II', 'III'][Number(person.id || 0) % 3];
            const stars = (Number(person.id || 0) % 5) + 1;
            const online = Boolean(person.online);
            return `<a class="friend-preview-card ${online ? 'is-online' : 'is-away'}" href="chat.html?friend=${person.id}" aria-label="Chat with ${escapeHtml(person.display_name || person.username)}">
              <span class="mini-avatar friend-frame" style="background:${escapeHtml(person.avatar_color || '#9b672e')}"><i>${escapeHtml(letter(person.display_name || person.username))}</i></span>
              <span class="friend-preview-info"><span class="friend-name"><i class="presence-dot"></i><b>${escapeHtml(person.display_name || person.username)}</b></span><small><span class="rank-medal">⚜</span> Commander ${tier} <strong>★ ${stars}</strong></small></span>
              <span class="friend-row-action chat-row-icon" aria-hidden="true">✉</span>
            </a>`;
          }).join('')
        : '<div class="friend-preview-empty"><span>♟</span><b>No friends yet</b><small>Find another commander.</small></div>';
    }
  } catch (error) {
    const preview = document.querySelector('#friendPreview');
    if (preview) preview.innerHTML = '<p>Friends are unavailable.</p>';
  }

  const searchOverlay = document.querySelector('#friendSearchOverlay');
  const searchInput = document.querySelector('#dashboardFriendSearchInput');
  const searchStatus = document.querySelector('#dashboardFriendSearchStatus');
  const searchResults = document.querySelector('#dashboardFriendSearchResults');
  const setSearchStatus = (message, error = false) => {
    if (!searchStatus) return;
    searchStatus.textContent = message || '';
    searchStatus.classList.toggle('error', error);
  };
  const closeSearch = () => {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('open');
    window.setTimeout(() => { searchOverlay.hidden = true; }, 140);
  };
  document.querySelector('#openFriendSearch')?.addEventListener('click', () => {
    if (!searchOverlay) return;
    searchOverlay.hidden = false;
    requestAnimationFrame(() => searchOverlay.classList.add('open'));
    window.setTimeout(() => searchInput?.focus(), 80);
  });
  document.querySelector('#friendSearchClose')?.addEventListener('click', closeSearch);
  searchOverlay?.addEventListener('click', event => { if (event.target === searchOverlay) closeSearch(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !searchOverlay?.hidden) closeSearch(); });
  document.querySelector('#dashboardFriendSearchForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const query = searchInput?.value.trim() || '';
    if (query.length < 2) { setSearchStatus('Enter at least 2 characters.', true); return; }
    setSearchStatus('Searching…');
    if (searchResults) searchResults.innerHTML = '';
    try {
      const data = await apiGet(`api/social.php?action=search&q=${encodeURIComponent(query)}`);
      if (!data.ok) throw new Error((data.errors || ['Search failed.'])[0]);
      const people = data.results || [];
      if (searchResults) searchResults.innerHTML = people.length ? people.map(person => {
        const relationship = person.relationship || 'none';
        const action = relationship === 'none' ? `<button type="button" data-search-add="${person.id}">＋ Add</button>` : `<span class="search-relationship">${relationship === 'friends' ? 'Friends' : 'Pending'}</span>`;
        return `<article class="friend-search-result"><span class="mini-avatar" style="background:${escapeHtml(person.avatar_color || '#9b672e')}">${escapeHtml(letter(person.display_name || person.username))}</span><span><b>${escapeHtml(person.display_name || person.username)}</b><small>@${escapeHtml(person.username)}</small></span>${action}</article>`;
      }).join('') : '<div class="friend-search-empty">No commanders found.</div>';
      setSearchStatus(`${people.length} result${people.length === 1 ? '' : 's'}`);
    } catch (error) { setSearchStatus(error.message, true); }
  });
  searchResults?.addEventListener('click', async event => {
    const button = event.target.closest('[data-search-add]');
    if (!button) return;
    button.disabled = true;
    setSearchStatus('Sending request…');
    try {
      const data = await apiPost('api/social.php', { action: 'send', target_user_id: Number(button.dataset.searchAdd) });
      if (!data.ok) throw new Error((data.errors || ['Could not send request.'])[0]);
      button.replaceWith(Object.assign(document.createElement('span'), { className: 'search-relationship', textContent: 'Pending' }));
      setSearchStatus(data.message || 'Friend request sent.');
    } catch (error) { button.disabled = false; setSearchStatus(error.message, true); }
  });

  document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    try { await apiPost('api/logout.php', {}); } catch (error) {}
    location.href = 'login.html';
  });
  document.body.classList.add('auth-ready');
  document.body.style.visibility = 'visible';
});
