/* Core helpers: settings, formatting, icons, backend calls and Google Sign-In.
   No external libraries (Google's sign-in script is loaded only when needed). */
(function () {
  'use strict';
  var App = window.App = {};
  var cfg = window.APP_CONFIG || {};
  var qs = location.search || '';

  function digits10(v) { return String(v || '').replace(/\D/g, '').slice(-10); }
  App.cfg = {
    API_URL: String(cfg.API_URL || '').trim(),
    GOOGLE_CLIENT_ID: String(cfg.GOOGLE_CLIENT_ID || '').trim(),
    ADMIN_EMAILS: (cfg.ADMIN_EMAILS || []).map(function (e) { return String(e).toLowerCase().trim(); }),
    BUSINESS_NAME: cfg.BUSINESS_NAME || 'YOUR ONE STOP SOLUTION',
    BUSINESS_SUBTITLE: cfg.BUSINESS_SUBTITLE || 'IT & PRINTING SERVICES',
    TAGLINE: cfg.TAGLINE || 'One Place. Every IT & Printing Solution.',
    PHONE: digits10(cfg.PHONE), WHATSAPP: digits10(cfg.WHATSAPP),
    EMAIL: String(cfg.EMAIL || '').trim(), ADDRESS: String(cfg.ADDRESS || '').trim(),
    HOURS: String(cfg.HOURS || '').trim(), MAP_LINK: String(cfg.MAP_LINK || '').trim(),
    UPI_ID: String(cfg.UPI_ID || '').trim(), UPI_NAME: String(cfg.UPI_NAME || '').trim(),
    ABOUT: '', ANNOUNCEMENT: '', SITE_URL: ''
  };
  /* Demo mode: no API_URL, DEMO_MODE true, or ?demo=1 in the address. ?demo=0 turns it off. */
  App.demo = /[?&]demo=0\b/.test(qs) ? false : (!!cfg.DEMO_MODE || !App.cfg.API_URL || /[?&]demo=1\b/.test(qs));
  if (App.demo) { try { sessionStorage.setItem('oss_demo', '1'); } catch (e) {} }
  App.clientIdOk = function () { return /\.apps\.googleusercontent\.com$/.test(App.cfg.GOOGLE_CLIENT_ID) && App.cfg.GOOGLE_CLIENT_ID.indexOf('PASTE_') !== 0; };
  App.isAdminEmail = function (e) { return App.cfg.ADMIN_EMAILS.indexOf(String(e || '').toLowerCase()) >= 0; };

  App.STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed', 'Cancelled'];
  App.STATUS_TEXT = {
    'Pending': 'Received - waiting for the shop to confirm', 'Confirmed': 'Accepted by the shop', 'In Progress': 'Work is going on',
    'Ready': 'Ready for pickup / delivery', 'Completed': 'Completed', 'Cancelled': 'Cancelled'
  };
  App.ICONS_FOR_CATEGORIES = ['laptop', 'network', 'cctv', 'copy', 'printer', 'pen', 'wrench', 'layers', 'shield', 'phone', 'cart', 'star'];
  App.TONES = ['blue', 'green', 'indigo', 'violet', 'red', 'purple', 'orange', 'teal'];

  /* ---------- text helpers ---------- */
  App.h = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  App.nl2br = function (s) { return App.h(s).replace(/\n/g, '<br>'); };
  App.money = function (n) {
    n = Number(n) || 0;
    var paise = Math.round(n * 100) % 100 !== 0;
    try { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 }); } catch (e) { return '₹' + n; }
  };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  App.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  App.ymd = function (d) { return d.getFullYear() + '-' + App.pad(d.getMonth() + 1) + '-' + App.pad(d.getDate()); };
  App.fmtDate = function (v) {
    if (!v) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
    return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  };
  App.fmtClock = function (hhmm) {
    var m = /^(\d{2}):(\d{2})/.exec(hhmm || ''); if (!m) return '';
    var h = +m[1];
    return App.pad(h % 12 === 0 ? 12 : h % 12) + ':' + m[2] + ' ' + (h < 12 ? 'AM' : 'PM');
  };
  App.fmtDateTime = function (v) {
    var d = new Date(v); if (!v || isNaN(d)) return '';
    return App.fmtDate(v) + ', ' + App.fmtClock(App.pad(d.getHours()) + ':' + App.pad(d.getMinutes()));
  };
  App.ago = function (v) {
    var s = (Date.now() - new Date(v).getTime()) / 1000; if (!(s >= 0)) return App.fmtDateTime(v);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 7 * 86400) return Math.floor(s / 86400) + ' d ago'; return App.fmtDate(v);
  };
  App.uid = function (prefix) {
    var s = '';
    try { var a = new Uint8Array(10); crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += a[i].toString(36); }
    catch (e) { s = Math.random().toString(36).slice(2); }
    return (prefix || 'c') + Date.now().toString(36) + s.replace(/[^a-z0-9]/g, '').slice(0, 10);
  };
  App.mobileOk = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  };
  App.emailOk = function (e) { return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(String(e || '')); };
  App.waLink = function (mobile10, text) { return 'https://wa.me/' + (mobile10 ? '91' + mobile10 : '') + (text ? '?text=' + encodeURIComponent(text) : ''); };
  App.slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); };

  App.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- backend calls ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  App.api = function (action, payload, opts) {
    opts = opts || {};
    var data = Object.assign({ action: action }, payload || {});
    if (App.auth.user && App.auth.user.token && data.idToken === undefined) data.idToken = App.auth.user.token;
    var body = JSON.stringify(data), max = opts.retries === undefined ? 2 : opts.retries;
    function once() {
      if (App.demo) return wait(180).then(function () { return window.DemoBackend.handle(body); });
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
      return fetch(App.cfg.API_URL, {
        method: 'POST', body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }   // "simple" request: no CORS pre-flight for Apps Script
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (t) { clearTimeout(timer); try { return JSON.parse(t); } catch (e) { throw new Error('Unreadable reply'); } },
          function (e) { clearTimeout(timer); throw e; });
    }
    function attempt(n) {
      return once().then(function (res) {
        if (res && res.ok) return res.data;
        var err = (res && res.error) || { code: 'SERVER', message: 'Unexpected reply from the server.' };
        if (/Unknown action/i.test(err.message || '')) err = { code: 'OLD_BACKEND', message: 'The Apps Script backend is an older version. Paste apps-script/Code.gs into Apps Script and deploy a new version (SETUP-GUIDE.md, Part 1).' };
        if (err.code === 'BUSY' && n < max) return wait(1200 * (n + 1)).then(function () { return attempt(n + 1); });
        if (err.code === 'AUTH' && App.auth.user) App.auth.expired(err.message);
        throw err;
      }, function () {
        if (n < max) return wait(1500 * (n + 1)).then(function () { return attempt(n + 1); });
        throw { code: 'NETWORK', message: (navigator.onLine === false ? 'You appear to be offline. ' : 'Could not reach the server. ') + 'Please check your internet connection and try again.' };
      });
    }
    return attempt(0);
  };

  /* ---------- sign-in (Google Identity Services; phone fallback; demo) ---------- */
  function decodeJwt(t) {
    try {
      var b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(b).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')));
    } catch (e) { return null; }
  }
  var listeners = [];
  App.auth = {
    user: null, // { kind: 'google'|'phone'|'demo', email, name, picture, mobile, token, exp, isAdmin }
    onChange: function (fn) { listeners.push(fn); },
    emit: function (why) { listeners.forEach(function (fn) { try { fn(App.auth.user, why); } catch (e) { console.warn(e); } }); },
    set: function (u, why) {
      App.auth.user = u;
      if (u) App.store.set('oss_user', u); else App.store.del('oss_user');
      App.auth.emit(why || 'change');
    },
    load: function () {
      var u = App.store.get('oss_user', null);
      if (!u) return;
      if (u.kind === 'demo' && !App.demo) return App.store.del('oss_user');
      if (u.kind === 'google' && (!u.exp || u.exp * 1000 < Date.now() + 60000)) { App.store.del('oss_user'); App.auth.wasGoogle = u.email; return; }
      App.auth.user = u;
    },
    signOut: function () {
      try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
      App.auth.set(null, 'signout');
    },
    expired: function (msg) { App.auth.wasGoogle = App.auth.user && App.auth.user.email; App.auth.set(null, 'expired'); App.toast(msg || 'Please sign in again.', 'err'); },
    isAdmin: function () { var u = App.auth.user; return !!(u && u.isAdmin); },
    fromGoogleCredential: function (cred) {
      var p = decodeJwt(cred); if (!p) return App.toast('Sign-in failed. Please try again.', 'err');
      var u = { kind: 'google', email: String(p.email || '').toLowerCase(), name: p.name || p.email, picture: p.picture || '', token: cred, exp: p.exp };
      u.isAdmin = App.isAdminEmail(u.email);   // UI only - the backend checks again on every admin action
      App.auth.set(u, 'signin');
      if (!App.demo) App.api('whoami', {}, { retries: 0 }).then(function (who) {
        if (App.auth.user && App.auth.user.token === cred && who.isAdmin !== u.isAdmin) { u.isAdmin = !!who.isAdmin; App.auth.set(u, 'verified'); }
      }, function (e) { if (e.code === 'SETUP' || e.code === 'OLD_BACKEND') App.toast(e.message, 'err'); });
    },
    loadGis: function () {
      if (App.auth._gis) return App.auth._gis;
      App.auth._gis = new Promise(function (resolve, reject) {
        if (!App.clientIdOk()) return reject({ message: 'Google Sign-In is not set up yet. Put your Client ID in config.js (see SETUP-GUIDE.md, Part 2).' });
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
        s.onload = function () {
          try {
            google.accounts.id.initialize({ client_id: App.cfg.GOOGLE_CLIENT_ID, callback: function (r) { App.auth.fromGoogleCredential(r.credential); }, auto_select: false, cancel_on_tap_outside: true, ux_mode: 'popup' });
            resolve();
          } catch (e) { reject({ message: 'Google Sign-In could not start.' }); }
        };
        s.onerror = function () { App.auth._gis = null; reject({ message: 'Could not load Google Sign-In. Check your internet connection.' }); };
        document.head.appendChild(s);
      });
      return App.auth._gis;
    },
    renderGoogleButton: function (el) {
      return App.auth.loadGis().then(function () {
        google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', width: Math.min(320, el.clientWidth || 300) });
      });
    }
  };
  App.auth.load();

  /* ---------- icons ---------- */
  var P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    chart: '<rect x="3" y="12" width="4" height="8"/><rect x="10" y="5" width="4" height="15"/><rect x="17" y="9" width="4" height="11"/>',
    gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    power: '<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5A8.5 8.5 0 1 1 21 11.5z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"/>',
    rupee: '<path d="M6 4h12M6 9h12M6 4h4a5 5 0 0 1 0 10H6l8 7"/>',
    laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    network: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="9" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v10M5 17v-4h14v4"/>',
    cctv: '<path d="M3 8.5 15 5l2 6.5-12 3.5z"/><path d="m17 8.5 4 1-1 3.5-3-.5"/><path d="M8 14.5V19H3"/><path d="M3 16v6"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><rect x="7" y="14" width="10" height="7"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    logo: '<rect x="2" y="4" width="16" height="11" rx="1.5"/><path d="M6 19h8M10 15v4"/><circle cx="18.5" cy="14.5" r="2"/><path d="M18.5 10.8v1.4M18.5 16.8v1.4M14.8 14.5h1.4M20.8 14.5h1.4M15.9 11.9l1 1M20.1 16.1l1 1M15.9 17.1l1-1M20.1 12.9l1-1"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    eyeoff: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2"/><path d="m2 2 20 20"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.2 7 22l5-3 5 3-1.2-8.8"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    whatsapp: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.2-1.8-1-1 .7a4 4 0 0 1-2.4-2.4l.7-1-1-1.8z"/>'
  };
  App.icon = function (name, size) {
    return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.layers) + '</svg>';
  };
  App.pill = function (status) { return '<span class="pill pill-' + String(status).toLowerCase().replace(/\s+/g, '-') + '">' + App.h(status) + '</span>'; };

  /* ---------- toasts ---------- */
  App.toast = function (text, kind) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok'); t.textContent = text;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, kind === 'err' ? 6500 : 4000);
  };
  App.copy = function (text, okMsg) {
    var done = function () { App.toast(okMsg || 'Copied'); };
    var fallback = function () {
      try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done(); }
      catch (e) { App.toast('Could not copy - please select and copy the text.', 'err'); }
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  };
})();
