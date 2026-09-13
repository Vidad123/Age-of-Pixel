document.addEventListener('DOMContentLoaded', () => {
  redirectIfLoggedIn();

  const loginForm = document.querySelector('#loginForm');
  if (loginForm) {
    getSession(); // primes the csrf_token cookie
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.querySelector('#formErrors');
      try {
        const result = await apiPost('api/login.php', {
          identifier: loginForm.identifier.value,
          password: loginForm.password.value,
        });
        if (result.ok) {
          window.location.href = 'dashboard.html';
        } else {
          showErrors(errBox, result.errors);
        }
      } catch (err) {
        showErrors(errBox, [err.message]);
      }
    });
  }

  const registerForm = document.querySelector('#registerForm');
  if (registerForm) {
    getSession(); // primes the csrf_token cookie
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.querySelector('#formErrors');
      try {
        const result = await apiPost('api/register.php', {
          username: registerForm.username.value,
          email: registerForm.email.value,
          password: registerForm.password.value,
          confirm_password: registerForm.confirm_password.value,
        });
        if (result.ok) {
          window.location.href = 'login.html?registered=1';
        } else {
          showErrors(errBox, result.errors);
        }
      } catch (err) {
        showErrors(errBox, [err.message]);
      }
    });
  }
});
