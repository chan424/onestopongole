/* Shared helpers for the customer site and the admin dashboard. No external libraries. */
(function () {
  'use strict';
  var App = window.App = {};

  var cfg = window.APP_CONFIG || {};
  App.cfg = {
    API_URL: String(cfg.API_URL || '').trim(),
    BUSINESS_NAME: cfg.BUSINESS_NAME || 'YOUR ONE STOP SOLUTION',
    BUSINESS_SUBTITLE: cfg.BUSINESS_SUBTITLE || 'IT & PRINTING SERVICES',
    TAGLINE: cfg.TAGLINE || 'One Place. Every IT & Printing Solution.',
    PHONE: String(cfg.PHONE || '').replace(/\D/g, '').slice(-10),
    WHATSAPP: String(cfg.WHATSAPP || '').replace(/\D/g, '').slice(-10),
    EMAIL: String(cfg.EMAIL || '').trim(),
    ADDRESS: String(cfg.ADDRESS || '').trim(),
    UPI_ID: String(cfg.UPI_ID || '').trim(),
    UPI_NAME: String(cfg.UPI_NAME || '').trim()
  };
  App.demo = !!window.__LOCAL_BACKEND__;
  App.isConfigured = function () { return App.demo || /^https:\/\/script\.google\.com\/.+\/exec$/.test(App.cfg.API_URL); };

  App.SERVICES = [
    { id: 'computer', name: 'Computer & Laptop Service', short: 'Computer', unit: 'device(s)', tone: 'blue', icon: 'laptop', hint: 'e.g. Laptop not starting, slow, screen broken, OS install' },
    { id: 'network', name: 'Networking & Wi-Fi', short: 'Networking', chart: 'Network', unit: 'point(s)', tone: 'green', icon: 'network', hint: 'e.g. Wi-Fi setup for office, 8 LAN points, router problem', onsite: true },
    { id: 'cctv', name: 'CCTV Installation', short: 'CCTV', unit: 'camera(s)', tone: 'indigo', icon: 'cctv', hint: 'e.g. 4 cameras for shop with DVR and mobile view', onsite: true },
    { id: 'xerox', name: 'Xerox Services', short: 'Xerox', unit: 'copies', tone: 'violet', icon: 'copy', hint: 'e.g. Record book 40 pages, both sides, spiral binding' },
    { id: 'printing', name: 'Printing (B/W & Colour)', short: 'Printing', unit: 'pages', tone: 'red', icon: 'printer', hint: 'e.g. Colour print A4, project report, 2 sets' },
    { id: 'design', name: 'Designing (IDs, Stickers, Flex, etc.)', short: 'Designing', chart: 'Design', unit: 'item(s)', tone: 'purple', icon: 'pen', hint: 'e.g. Flex banner 6x3 ft for shop opening, ID cards for staff' }
  ];
  App.serviceByName = function (name) {
    for (var i = 0; i < App.SERVICES.length; i++) if (App.SERVICES[i].name === name) return App.SERVICES[i];
    return { id: '', name: name || 'Other', short: name || 'Other', unit: 'item(s)', tone: 'blue', icon: 'layers' };
  };
  App.STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed', 'Cancelled'];
  App.PAY_MODES = ['UPI', 'Cash', 'Card', 'Bank Transfer', 'Other'];
  App.STATUS_TEXT = {
    'Pending': 'Received - waiting for the shop to confirm',
    'Confirmed': 'Accepted by the shop',
    'In Progress': 'Work is going on',
    'Ready': 'Ready for pickup / delivery',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled'
  };

  /* ---------- text helpers ---------- */
  App.h = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  App.nl2br = function (s) { return App.h(s).replace(/\n/g, '<br>'); };
  App.money = function (n) {
    n = Number(n) || 0;
    var hasPaise = Math.round(n * 100) % 100 !== 0;
    try { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 }); }
    catch (e) { return '₹' + n; }
  };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  App.MON = MON;
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
  App.uid = function () {
    var s = '';
    try { var a = new Uint8Array(12); crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += a[i].toString(36); }
    catch (e) { s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
    return 'c' + Date.now().toString(36) + s.replace(/[^a-z0-9]/g, '').slice(0, 16);
  };
  App.mobileOk = function (v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  };
  App.emailOk = function (e) { return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(String(e || '')); };
  App.waLink = function (mobile10, text) { return 'https://wa.me/91' + mobile10 + (text ? '?text=' + encodeURIComponent(text) : ''); };

  /* ---------- small storage wrapper (never throws) ---------- */
  App.store = {
    get: function (k, fallback) { try { var v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- talking to the backend ---------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  App.api = function (action, payload, opts) {
    opts = opts || {};
    var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
    var maxRetries = opts.retries === undefined ? 2 : opts.retries;

    function once() {
      if (window.__LOCAL_BACKEND__) return wait(220).then(function () { return window.__LOCAL_BACKEND__(body); });
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
      return fetch(App.cfg.API_URL, {
        method: 'POST', body: body, redirect: 'follow', signal: ctrl ? ctrl.signal : undefined,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }     // keeps the request "simple" so browsers allow it cross-site
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (t) {
        clearTimeout(timer);
        try { return JSON.parse(t); } catch (e) { throw new Error('Unreadable reply'); }
      }, function (e) { clearTimeout(timer); throw e; });
    }

    function attempt(n) {
      return once().then(function (res) {
        if (res && res.ok) return res.data;
        var err = (res && res.error) || { code: 'SERVER', message: 'Unexpected reply from the server.' };
        if (err.code === 'BUSY' && n < maxRetries) return wait(1200 * (n + 1)).then(function () { return attempt(n + 1); });
        throw err;
      }, function () {
        if (n < maxRetries) return wait(1500 * (n + 1)).then(function () { return attempt(n + 1); });
        throw { code: 'NETWORK', message: (navigator.onLine === false ? 'You appear to be offline. ' : 'Could not reach the server. ') + 'Please check your internet connection and try again.' };
      });
    }
    if (!App.isConfigured()) return Promise.reject({ code: 'SETUP', message: 'The website is not connected to its backend yet. Paste the Web App URL into config.js.' });
    return attempt(0);
  };

  /* ---------- icons (simple line drawings) ---------- */
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
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'
  };
  App.icon = function (name, size) {
    return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  };

  App.pill = function (status) {
    return '<span class="pill pill-' + String(status).toLowerCase().replace(/\s+/g, '-') + '">' + App.h(status) + '</span>';
  };

  /* ---------- toast messages ---------- */
  App.toast = function (text, kind) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.textContent = text;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, kind === 'err' ? 6000 : 3500);
  };

  App.copy = function (text, okMsg) {
    var done = function () { App.toast(okMsg || 'Copied'); };
    var fallback = function () {
      try {
        var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { App.toast('Could not copy - please select and copy the text.', 'err'); }
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  };

  App.setupBanner = function () {
    return '<div class="setup-banner"><b>Not connected yet.</b> Open <code>config.js</code> and paste your Google Apps Script Web App URL in place of <code>PASTE_YOUR_WEB_APP_URL_HERE</code>. See the hosting guide, Part B.</div>';
  };
})();
