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
