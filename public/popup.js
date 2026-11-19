(function () {
  var ov = document.getElementById('ov');
  if (!ov) return;

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    ov.classList.add('on');
    document.body.style.overflow = 'hidden';
    var f = ov.querySelector('input, button');
    if (f) setTimeout(function () { f.focus(); }, 60);
  }

  function close() {
    ov.classList.remove('on');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function isOpen() { return ov.classList.contains('on'); }

  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close();
    if (e.key === 'Tab' && isOpen()) {
      var items = ov.querySelectorAll('input, button');
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  var x = ov.querySelector('.x');
  if (x) x.addEventListener('click', close);

  var go = ov.querySelector('.go');
  if (go) go.addEventListener('click', function () {
    var mail = ov.querySelector('input');
    if (!mail || !mail.value.trim()) return;
    fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail.value.trim() })
    }).catch(function () {});
    mail.value = '';
    close();
  });

  window.Popup = { open: open, close: close, isOpen: isOpen };

  var trigger = document.getElementById('open');
  if (trigger) trigger.addEventListener('click', open);
})();