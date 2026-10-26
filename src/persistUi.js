// Injected into every page before it loads. Makes the site's reading preferences (font size etc.)
// survive closing and reopening the app, whichever way the site stores them:
//   - sessionStorage keys that look like a preference are mirrored into localStorage and restored
//   - preference cookies without an expiry are given one (session cookies die with the app)
//   - font-size / zoom / font classes set directly on <html> or <body> are saved and re-applied
export const PERSIST_UI_JS = `
(function () {
  if (window.__srPersist) return;
  window.__srPersist = true;
  var KEY = '__sr_ui', MIRROR = '__sr_ss_', RE = /font|size|zoom|text|scale|a11y|access/i;
  function safe(fn) { try { return fn(); } catch (e) {} }

  safe(function () {
    var proto = Storage.prototype, set = proto.setItem, rem = proto.removeItem;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(MIRROR) === 0) {
        var name = k.slice(MIRROR.length);
        if (sessionStorage.getItem(name) === null) set.call(sessionStorage, name, localStorage.getItem(k));
      }
    }
    proto.setItem = function (k, v) {
      if (this === window.sessionStorage && RE.test(k)) safe(function () { set.call(localStorage, MIRROR + k, v); });
      return set.apply(this, arguments);
    };
    proto.removeItem = function (k) {
      if (this === window.sessionStorage) safe(function () { rem.call(localStorage, MIRROR + k); });
      return rem.apply(this, arguments);
    };
  });

  safe(function () {
    var d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (!d || !d.set) return;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: function () { return d.get.call(document); },
      set: function (v) {
        var n = String(v).split('=')[0];
        if (RE.test(n) && !/(max-age|expires)\\s*=/i.test(v)) v = v + '; max-age=31536000';
        d.set.call(document, v);
      }
    });
  });

  var saved = safe(function () { return JSON.parse(localStorage.getItem(KEY)); }) || {};
  var applying = false, lastGesture = 0, saveTimer, obs;
  function el(k) { return k === 'html' ? document.documentElement : document.body; }

  function snap(node) {
    var st = node.style, o = { fs: st.getPropertyValue('font-size'), zoom: st.getPropertyValue('zoom'), vars: {} };
    for (var i = 0; i < st.length; i++) {
      var p = st[i];
      if (p.indexOf('--') === 0 && RE.test(p)) o.vars[p] = st.getPropertyValue(p);
    }
    o.cls = [].filter.call(node.classList, function (c) { return RE.test(c); });
    return o;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function apply() {
    if (!saved.html && !saved.body) return;
    applying = true;
    ['html', 'body'].forEach(function (k) {
      var node = el(k), s = saved[k];
      if (!node || !s) return;
      var cur = snap(node);
      if (same(cur, s)) return;
      ['font-size', 'zoom'].forEach(function (p) {
        var val = p === 'zoom' ? s.zoom : s.fs;
        if (val) node.style.setProperty(p, val); else node.style.removeProperty(p);
      });
      Object.keys(cur.vars).forEach(function (p) { if (!(p in s.vars)) node.style.removeProperty(p); });
      Object.keys(s.vars).forEach(function (p) { node.style.setProperty(p, s.vars[p]); });
      cur.cls.forEach(function (c) { if (s.cls.indexOf(c) < 0) node.classList.remove(c); });
      s.cls.forEach(function (c) { node.classList.add(c); });
    });
    if (obs) obs.takeRecords();
    applying = false;
  }

  function onMutate() {
    if (applying) return;
    if (Date.now() - lastGesture < 1500) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saved = { html: snap(document.documentElement), body: document.body ? snap(document.body) : saved.body };
        safe(function () { localStorage.setItem(KEY, JSON.stringify(saved)); });
      }, 150);
    } else {
      apply(); // the page reset it on its own (e.g. during start-up): put the user's choice back
    }
  }

  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function () { lastGesture = Date.now(); }, true);
  });

  function start() {
    apply();
    obs = new MutationObserver(onMutate);
    var opts = { attributes: true, attributeFilter: ['style', 'class'] };
    obs.observe(document.documentElement, opts);
    if (document.body) obs.observe(document.body, opts);
    [300, 1000, 2500].forEach(function (ms) { setTimeout(apply, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Single-page sites: re-apply after in-app navigation.
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(apply, 300);
      return r;
    };
  });
  window.addEventListener('popstate', function () { setTimeout(apply, 300); });
})();
true;
`;
