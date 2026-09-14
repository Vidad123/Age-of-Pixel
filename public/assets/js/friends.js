const friendsPageStyle = document.createElement('link');
friendsPageStyle.rel = 'stylesheet';
friendsPageStyle.href = 'assets/css/friends-page.css';
document.head.appendChild(friendsPageStyle);
const friendsPageFixStyle = document.createElement('link');
friendsPageFixStyle.rel = 'stylesheet';
friendsPageFixStyle.href = 'assets/css/friends-page-fix.css';
document.head.appendChild(friendsPageFixStyle);

document.addEventListener('DOMContentLoaded', async () => {
  const sidebar = document.querySelector('.social-page-sidebar');
  const backButton = document.querySelector('.page-back');
  if (sidebar && backButton) sidebar.insertBefore(backButton, sidebar.firstChild);

  const user = await requireSession();
  if (!user) return;

  const status = document.querySelector('#friendsStatus');
  const letter = person => ((person.display_name || person.username || '?')[0] || '?').toUpperCase();
  const avatar = person => `<span class="mini-avatar" style="background:${escapeHtml(person.avatar_color || '#9b672e')}">${escapeHtml(letter(person))}</span>`;
  const empty = text => `<div class="empty-state">${escapeHtml(text)}</div>`;
  const setStatus = (text, error = false) => {
    status.textContent = text || '';
    status.classList.toggle('error', error);
  };

  function showPane(name, updateHash = true) {
    const selected = name === 'requests' ? 'requests' : 'friends';
    document.querySelectorAll('[data-social-view]').forEach(button => button.classList.toggle('active', button.dataset.socialView === selected));
    document.querySelectorAll('[data-social-pane]').forEach(pane => { pane.hidden = pane.dataset.socialPane !== selected; });
    if (updateHash) history.replaceState(null, '', `#${selected}`);
  }

  async function load() {
    try {
      const data = await apiGet('api/social.php?action=bootstrap');
      if (!data.ok) throw new Error((data.errors || ['Unable to load friends.'])[0]);
      document.querySelector('#friendsPageCount').textContent = String(data.friends.length);
      document.querySelector('#requestsPageCount').textContent = String(data.requests.length);
      document.querySelector('#friendRequests').innerHTML = data.requests.length
        ? data.requests.map(person => `<article class="social-card">${avatar(person)}<span><b>${escapeHtml(person.display_name || person.username)}</b><small>@${escapeHtml(person.username)} wants to be friends.</small></span><span class="social-actions"><button data-action="accept" data-id="${person.id}">Accept</button><button class="danger" data-action="decline" data-id="${person.id}">Decline</button></span></article>`).join('')
        : empty('No pending requests.');
      document.querySelector('#friendsList').innerHTML = data.friends.length
        ? data.friends.map(person => `<article class="social-card"><span class="friend-page-avatar-wrap">${avatar(person)}<i class="page-presence ${person.online ? 'online' : ''}"></i></span><span><b>${escapeHtml(person.display_name || person.username)}</b><small>@${escapeHtml(person.username)}${person.bio ? ' · ' + escapeHtml(person.bio) : ''}</small></span><span class="social-actions"><a class="chat-action" href="chat.html?friend=${person.id}">Chat</a><button class="danger" data-action="remove" data-id="${person.id}">Remove</button></span></article>`).join('')
        : empty('You have not added any friends yet. Use Search on the dashboard.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function act(action, id) {
    setStatus('Updating…');
    try {
      const data = await apiPost('api/social.php', { action, target_user_id: Number(id) });
      if (!data.ok) throw new Error((data.errors || ['Unable to update friends.'])[0]);
      setStatus(data.message || 'Updated.');
      await load();
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  document.querySelector('.social-hub').addEventListener('click', event => {
    const view = event.target.closest('[data-social-view]');
    if (view) { showPane(view.dataset.socialView); return; }
    const action = event.target.closest('[data-action]');
    if (action) act(action.dataset.action, action.dataset.id);
  });
  window.addEventListener('hashchange', () => showPane(location.hash.slice(1), false));

  await load();
  showPane(location.hash.slice(1), false);
  document.body.classList.add('auth-ready');
});
