(function () {
  var tabs = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.panel');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var tab = t.getAttribute('data-tab');
      tabs.forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-tab') === tab); });
      panels.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-panel') === tab); });
    });
  });

  var loginForm = document.getElementById('login-form');
  var loginMsg = document.getElementById('login-message');
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginMsg.textContent = '';
    loginMsg.className = 'message';
    var username = loginForm.username.value.trim();
    if (!username) { loginMsg.textContent = 'Enter a username.'; loginMsg.classList.add('error'); return; }
    loginMsg.textContent = 'Go to Play and enter this username to join.';
    loginMsg.classList.add('success');
    window.location.href = '/game';
  });

  var signupForm = document.getElementById('signup-form');
  var signupMsg = document.getElementById('signup-message');
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    signupMsg.textContent = '';
    signupMsg.className = 'message';
    var username = signupForm.username.value.trim();
    var password = signupForm.password.value;
    var confirm = signupForm.confirm.value;
    if (!username) { signupMsg.textContent = 'Enter a username.'; signupMsg.classList.add('error'); return; }
    if (password !== confirm) { signupMsg.textContent = 'Passwords do not match.'; signupMsg.classList.add('error'); return; }
    signupMsg.textContent = 'Creating account…';

    fetch('/user/' + encodeURIComponent(username), { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.exists) {
          signupMsg.textContent = 'Username already taken.';
          signupMsg.classList.add('error');
          return;
        }
        return fetch('/user/' + encodeURIComponent(username), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: password })
        });
      })
      .then(function (r) {
        if (!r) return;
        if (r.ok) {
          signupMsg.textContent = 'Account created. Go to Play!';
          signupMsg.classList.add('success');
          setTimeout(function () { window.location.href = '/game'; }, 1200);
        } else {
          signupMsg.textContent = 'Sign up failed. Try again.';
          signupMsg.classList.add('error');
        }
      })
      .catch(function () {
        signupMsg.textContent = 'Network error. Try again.';
        signupMsg.classList.add('error');
      });
  });
})();
