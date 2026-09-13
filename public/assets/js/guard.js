document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireSession();
  if (!user) return;
  document.querySelectorAll('[data-username]').forEach(el => {
    el.textContent = user.username;
  });
  document.body.classList.add('auth-ready');
  document.body.style.visibility = 'visible';
});
