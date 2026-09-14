document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession(); if (!user) return;
  const status = document.querySelector('#profileStatus');
  const letter = value => (String(value || user.username || '?').trim()[0] || '?').toUpperCase();
  async function load() {
    try {
      const data = await apiGet('api/social.php?action=bootstrap');
      if (!data.ok) throw new Error((data.errors || ['Unable to load profile.'])[0]);
      const p = data.profile;
      document.querySelector('#profileUsername').textContent = '@' + p.username;
      document.querySelector('#profileDisplayName').value = p.display_name || p.username;
      document.querySelector('#profileBio').value = p.bio || '';
      document.querySelector('#profileColor').value = p.avatar_color || '#9b672e';
      const avatar = document.querySelector('#profileAvatar'); avatar.textContent = letter(p.display_name); avatar.style.background = p.avatar_color || '#9b672e';
    } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  }
  document.querySelector('#profileForm').addEventListener('submit', async event => {
    event.preventDefault(); status.textContent = 'Saving…'; status.classList.remove('error');
    try {
      const data = await apiPost('api/social.php',{action:'update_profile',display_name:document.querySelector('#profileDisplayName').value,bio:document.querySelector('#profileBio').value,avatar_color:document.querySelector('#profileColor').value});
      if (!data.ok) throw new Error((data.errors || ['Unable to save profile.'])[0]);
      status.textContent = 'Profile saved.'; await load();
    } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  });
  await load(); document.body.classList.add('auth-ready');
});
