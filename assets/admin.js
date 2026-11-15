/* Admin dashboard: login, dashboard, service requests, customers, billing, reports. */
(function () {
  'use strict';
  var App = window.App, h = App.h, icon = App.icon, cfg = App.cfg, money = App.money;

  App.mountAdmin = function (root) {
    var st = {
      session: App.store.get('oss_admin', null),
      login: { step: 'email', email: '', busy: false, err: '', msg: '' },
      data: null, loadErr: '', lastSync: 0, syncing: false,
      page: 'dashboard', range: { preset: 'month', from: '', to: '' }, chartRange: 'month',
      req: { q: '', status: 'All', service: '', limit: 50 }, cust: { q: '' }, bill: { filter: 'All' },
      detail: null, newOrder: null, timer: null
    };
    var $ = function (sel) { return root.querySelector(sel); };
    var PAGES = [
      { id: 'dashboard', label: 'Dashboard', icon: 'home' }, { id: 'requests', label: 'Service Requests', icon: 'wrench' },
      { id: 'customers', label: 'Customers', icon: 'users' }, { id: 'billing', label: 'Orders & Billing', icon: 'receipt' },
      { id: 'reports', label: 'Reports', icon: 'chart' }, { id: 'setup', label: 'Settings', icon: 'gear' }
    ];
    var OPEN = function (o) { return o.status !== 'Completed' && o.status !== 'Cancelled'; };

    /* =============================== data =============================== */
    function call(action, payload, opts) {
      return App.api(action, Object.assign({ token: st.session && st.session.token }, payload || {}), opts).catch(function (e) {
        if (e.code === 'AUTH' && st.session) { signOut(e.message); }
        throw e;
      });
    }
    function signOut(msg) {
      App.store.del('oss_admin'); st.session = null; st.data = null; st.detail = null; st.newOrder = null;
      clearInterval(st.timer); st.login = { step: 'email', email: '', busy: false, err: '', msg: msg || '' };
      render();
    }
    function loadData(quiet) {
      if (st.syncing) return Promise.resolve();
      st.syncing = true; if (!quiet) markSync();
      return call('adminData').then(function (d) {
        var before = st.data ? st.data.orders.map(function (o) { return o.orderId; }) : null;
        d.orders.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; });
        var first = !st.data;
        st.data = d; st.loadErr = ''; st.lastSync = Date.now(); st.syncing = false;
        if (before) d.orders.forEach(function (o) { if (before.indexOf(o.orderId) < 0 && o.source !== 'admin') App.toast('New order ' + o.orderId + ' from ' + o.name); });
        if (first) render(); else { renderNav(); renderBody(); markSync(); }
        if (st.detail && !st.detail.busy) {
          var cur = byId(st.detail.order.orderId);
          if (cur && cur.updatedAt !== st.detail.order.updatedAt) { st.detail.stale = true; var s = $('#stale'); if (s) s.classList.remove('hide'); }
        }
      }, function (e) {
        st.syncing = false;
        if (!st.session) return;
        if (!st.data) { st.loadErr = e.message; render(); } else { markSync(e.message); }
      });
    }
    function byId(id) { for (var i = 0; i < st.data.orders.length; i++) if (st.data.orders[i].orderId === id) return st.data.orders[i]; return null; }
    function putOrder(o) { for (var i = 0; i < st.data.orders.length; i++) if (st.data.orders[i].orderId === o.orderId) { st.data.orders[i] = o; return; } st.data.orders.unshift(o); }
    function markSync(err) {
      var el = $('#sync'); if (!el) return;
      el.innerHTML = st.syncing ? '<span class="spin" style="width:12px;height:12px;border:2px solid #c5d2e8;border-top-color:var(--blue);border-radius:50%;display:inline-block;animation:spin .7s linear infinite"></span> Updating...'
        : err ? '<span style="color:var(--red)">Could not refresh - showing last loaded data</span>'
        : 'Updated ' + App.fmtClock(App.pad(new Date(st.lastSync).getHours()) + ':' + App.pad(new Date(st.lastSync).getMinutes()));
    }

    /* ============================ date ranges ============================ */
    function rangeOf(r) {
      var now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      var from, to, label;
      switch (r.preset) {
        case 'today': from = new Date(y, m, d); to = new Date(y, m, d + 1); label = 'Today'; break;
        case '7d': from = new Date(y, m, d - 6); to = new Date(y, m, d + 1); label = 'Last 7 days'; break;
        case '30d': from = new Date(y, m, d - 29); to = new Date(y, m, d + 1); label = 'Last 30 days'; break;
        case 'lastmonth': from = new Date(y, m - 1, 1); to = new Date(y, m, 1); label = 'Last month'; break;
        case 'year': from = new Date(y, 0, 1); to = new Date(y + 1, 0, 1); label = 'This year'; break;
        case 'all': from = new Date(2000, 0, 1); to = new Date(y + 5, 0, 1); label = 'All time'; break;
        case 'custom':
          from = r.from ? new Date(r.from + 'T00:00:00') : new Date(y, m, 1);
          to = r.to ? new Date(new Date(r.to + 'T00:00:00').getTime() + 86400000) : new Date(y, m, d + 1);
          if (to <= from) to = new Date(from.getTime() + 86400000);
          label = 'Custom'; break;
        default: from = new Date(y, m, 1); to = new Date(y, m + 1, 1); label = 'This month';
      }
      var span = to - from, prevFrom = null, prevTo = null;
      if (r.preset === 'month') { prevFrom = new Date(y, m - 1, 1); prevTo = from; }
      else if (r.preset === 'lastmonth') { prevFrom = new Date(y, m - 2, 1); prevTo = from; }
      else if (r.preset === 'year') { prevFrom = new Date(y - 1, 0, 1); prevTo = from; }
      else if (r.preset !== 'all') { prevFrom = new Date(from.getTime() - span); prevTo = from; }
      var lastDay = new Date(to.getTime() - 86400000);
      return { from: from, to: to, prevFrom: prevFrom, prevTo: prevTo, label: label, text: App.fmtDate(App.ymd(from)) + ' – ' + App.fmtDate(App.ymd(lastDay)) };
    }
    function within(iso, a, b) { var t = new Date(iso).getTime(); return t >= a.getTime() && t < b.getTime(); }
    function summarise(a, b) {
      var orders = st.data.orders.filter(function (o) { return within(o.createdAt, a, b); });
      var mob = {}; orders.forEach(function (o) { mob[o.mobile] = 1; });
      var revenue = 0, byService = {};
      var svc = {}; st.data.orders.forEach(function (o) { svc[o.orderId] = o.service; });
      st.data.payments.forEach(function (p) { if (within(p.at, a, b)) { revenue += p.amount; var s = svc[p.orderId] || 'Other'; byService[s] = (byService[s] || 0) + p.amount; } });
      return { orders: orders, customers: Object.keys(mob).length, requests: orders.length,
        completed: orders.filter(function (o) { return o.status === 'Completed'; }).length, revenue: Math.round(revenue * 100) / 100, byService: byService };
    }
    function delta(cur, prev) {
      if (prev === null || prev === undefined) return '';
      if (!prev) return cur ? '<span class="d">' + icon('up', 14) + 'new</span>' : '';
      var p = Math.round((cur - prev) / prev * 100);
      return '<span class="d' + (p < 0 ? ' neg' : '') + '">' + icon(p < 0 ? 'down' : 'up', 14) + (p < 0 ? '' : '+') + p + '%</span>';
    }

    /* ============================== charts ============================== */
    function niceMax(v) {
      if (v <= 0) return 100;
      var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p;
      var m = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
      return m * p;
    }
    function shortMoney(v) {
      if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
      if (v >= 100000) return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
      if (v >= 1000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      return '₹' + Math.round(v);
    }
    function barChart(items, W) {
      W = W || 380; var H = 250, L = 64, R = 8, T = 18, B = 30;
      var max = niceMax(Math.max.apply(null, items.map(function (i) { return i.value; }).concat([0])));
      var pw = W - L - R, ph = H - T - B, slot = pw / items.length, bw = Math.min(46, slot * 0.62), s = '';
      for (var i = 0; i <= 5; i++) {
        var y = T + ph - ph * i / 5, v = max * i / 5;
        s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + (i ? '#e6ecf5' : '#8a97ad') + '" stroke-width="1"/>' +
          '<text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#33415c">' + h(money(v)) + '</text>';
      }
      items.forEach(function (it, k) {
        var bh = max ? ph * it.value / max : 0, x = L + slot * k + (slot - bw) / 2, y = T + ph - bh;
        s += '<g><title>' + h(it.label + ': ' + money(it.value)) + '</title>' +
          (bh > 0 ? '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="#1a73e8"/>' : '') +
          (it.value > 0 ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="10" fill="#33415c">' + h(shortMoney(it.value)) + '</text>' : '') +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10.5" fill="#15233c">' + h(it.label) + '</text></g>';
      });
      return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Bar chart">' + s + '</svg>';
    }

    /* =============================== login =============================== */
    function renderLogin() {
      var L = st.login;
      root.innerHTML = (App.demo ? '<div class="demo-bar"><b>Preview mode</b> - use dataongole@gmail.com; the login code appears in the yellow "Preview inbox" box.</div>' : '') +
        '<div class="login-bg"><div class="card login">' +
        '<div class="brand"><span class="brand-logo">' + icon('logo', 30) + '</span><span><div class="brand-name">' + h(cfg.BUSINESS_NAME) + '</div><div class="brand-sub">ADMIN LOGIN</div></span></div>' +
        (App.isConfigured() ? '' : App.setupBanner()) +
        (L.msg ? '<div class="note" style="margin-bottom:12px">' + h(L.msg) + '</div>' : '') +
        (L.step === 'email'
          ? '<form id="lf1" novalidate><div class="field"><label for="l-email">Admin e-mail address</label><input class="input" id="l-email" type="email" autocomplete="username" value="' + h(L.email) + '" placeholder="you@gmail.com"></div>' +
            '<div class="err" style="margin-bottom:10px">' + h(L.err) + '</div><button class="btn block" type="submit"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? '<span class="spin"></span> Sending code...' : icon('mail', 18) + ' Send login code') + '</button>' +
            '<p class="hint" style="margin-top:12px">A 6-digit code will be e-mailed to you. No password is needed.</p></form>'
          : '<form id="lf2" novalidate><p style="margin-bottom:12px">Enter the 6-digit code sent to <b>' + h(L.email) + '</b>. It can take a minute; check Spam too.</p>' +
            '<div class="field"><label for="l-code" class="sr">Login code</label><input class="input otp" id="l-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="------"></div>' +
            '<div class="err" style="margin-bottom:10px">' + h(L.err) + '</div><button class="btn block" type="submit"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? '<span class="spin"></span> Checking...' : icon('check', 18) + ' Log in') + '</button>' +
            '<p style="margin-top:12px;text-align:center"><button type="button" class="linkbtn" data-act="login-back">Use a different e-mail / send a new code</button></p></form>') +
        '<p class="hint" style="margin-top:16px;text-align:center"><a href="index.html" data-customer>Back to the customer website</a></p></div></div>';
      var f = $(L.step === 'email' ? '#l-email' : '#l-code'); if (f) f.focus();
    }
    function sendCode() {
      var L = st.login, email = $('#l-email').value.trim().toLowerCase();
      if (!App.emailOk(email)) { L.err = 'Please enter a valid e-mail address.'; L.email = email; return renderLogin(); }
      L.email = email; L.busy = true; L.err = ''; L.msg = ''; renderLogin();
      App.api('requestOtp', { email: email }).then(function () { L.busy = false; L.step = 'code'; renderLogin(); },
        function (e) { L.busy = false; L.err = e.message; renderLogin(); });
    }
    function checkCode() {
      var L = st.login, code = $('#l-code').value.replace(/\D/g, '');
      if (code.length !== 6) { L.err = 'Please enter all 6 digits.'; return renderLogin(); }
      L.busy = true; L.err = ''; renderLogin();
      App.api('verifyOtp', { email: L.email, code: code }, { retries: 0 }).then(function (s) {
        st.session = s; App.store.set('oss_admin', s); L.busy = false; start();
      }, function (e) { L.busy = false; L.err = e.message; renderLogin(); });
    }

    /* =============================== shell =============================== */
    function render() {
      if (!st.session) return renderLogin();
      if (!st.data) {
        root.innerHTML = '<div class="login-bg"><div class="card login" style="text-align:center">' + (st.loadErr
          ? '<p class="err" style="margin-bottom:12px">' + h(st.loadErr) + '</p><button class="btn" data-act="retry">' + icon('refresh', 18) + ' Try again</button> <button class="btn ghost" data-act="logout">Log out</button>'
          : '<p><span class="spin" style="display:inline-block;width:22px;height:22px;border:3px solid #c5d2e8;border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite"></span></p><p class="muted" style="margin-top:10px">Loading your dashboard...</p>') + '</div></div>';
        return;
      }
      root.innerHTML = (App.demo ? '<div class="demo-bar"><b>Preview mode</b> - sample data stored only in this browser.</div>' : '') +
        '<div class="adm" id="adm"><header class="a-top">' +
          '<button class="icon-btn menu-btn" data-act="menu" aria-label="Menu">' + icon('menu', 24) + '</button>' +
          '<span class="brand" style="flex:none"><span class="brand-logo">' + icon('logo', 30) + '</span><span><div class="brand-name">' + h(cfg.BUSINESS_NAME) + '</div><div class="brand-sub">' + h(cfg.BUSINESS_SUBTITLE) + '</div></span></span>' +
          '<span class="tagline">' + h(cfg.TAGLINE) + '</span><span class="sp"></span>' +
          '<button class="icon-btn" data-act="bell" aria-label="Pending requests" title="Pending requests">' + icon('bell', 24) + '<span class="badge hide" id="bell-n"></span></button>' +
          '<span class="who" title="' + h(st.data.me) + '"><span class="av">' + icon('user', 20) + '</span><span class="nm">' + h(st.data.me.split('@')[0]) + '</span></span>' +
        '</header><div class="scrim" data-act="menu"></div><nav class="a-side" id="nav"></nav><main class="a-main" id="main"></main></div><div id="modal"></div>';
      renderNav(); renderPage();
    }
    function renderNav() {
      var pending = st.data.orders.filter(function (o) { return o.status === 'Pending'; }).length;
      $('#nav').innerHTML = PAGES.map(function (p) {
        return '<button class="nav-item' + (st.page === p.id ? ' on' : '') + '" data-page="' + p.id + '">' + icon(p.icon, 22) + '<span>' + p.label + '</span>' +
          (p.id === 'requests' && pending ? '<span class="badge">' + pending + '</span>' : '') + '</button>';
      }).join('') + '<span class="grow"></span><a class="nav-item" href="index.html" data-customer>' + icon('eye', 22) + '<span>Customer website</span></a>' +
        '<button class="nav-item logout" data-act="logout">' + icon('power', 22) + '<span>Logout</span></button>';
      var b = $('#bell-n'); b.textContent = pending; b.classList.toggle('hide', !pending);
      try { document.title = (pending ? '(' + pending + ') ' : '') + 'Admin - ' + cfg.BUSINESS_NAME; } catch (e) {}
    }
    function rangeControl() {
      var r = st.range, opts = [['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom dates']];
      var R = rangeOf(r);
      return '<div class="range">' + icon('calendar', 20) + '<select id="rg" aria-label="Date range">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (r.preset === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        (r.preset === 'custom' ? '<input type="date" id="rg-from" value="' + h(r.from || App.ymd(R.from)) + '" aria-label="From"><span>–</span><input type="date" id="rg-to" value="' + h(r.to || App.ymd(new Date(R.to.getTime() - 86400000))) + '" aria-label="To">'
          : r.preset === 'all' ? '' : '<span class="small muted nowrap">' + h(R.text) + '</span>') + '</div>';
    }
    function pageHead(ic, title, sub, extra) {
      return '<div class="page-h"><div><h2>' + icon(ic, 30) + ' ' + h(title) + '</h2><div class="sub">' + h(sub) + '</div></div><span class="sp"></span>' +
        '<span class="updated"><span id="sync"></span><button class="btn ghost sm" data-act="refresh" title="Refresh now">' + icon('refresh', 15) + '</button></span>' + (extra || '') + '</div>';
    }
    function renderPage() {
      var m = $('#main'), head = '';
      if (st.page === 'dashboard') head = pageHead('chart', 'Dashboard', 'Business Overview - ' + cfg.BUSINESS_NAME, rangeControl());
      else if (st.page === 'requests') head = pageHead('wrench', 'Service Requests', 'All orders placed by customers', '<button class="btn" data-act="new">' + icon('plus', 18) + ' New request</button>') +
        '<div class="toolbar"><div class="search">' + icon('search', 18) + '<input class="input" id="q" placeholder="Search order no., name, mobile or work" value="' + h(st.req.q) + '"></div>' +
        '<select class="input" id="svc" aria-label="Service"><option value="">All services</option>' + App.SERVICES.map(function (s) { return '<option' + (st.req.service === s.name ? ' selected' : '') + ' value="' + h(s.name) + '">' + h(s.short) + '</option>'; }).join('') + '</select></div>';
      else if (st.page === 'customers') head = pageHead('users', 'Customers', 'Everyone who has placed an order') +
        '<div class="toolbar"><div class="search">' + icon('search', 18) + '<input class="input" id="q" placeholder="Search name, mobile or e-mail" value="' + h(st.cust.q) + '"></div></div>';
      else if (st.page === 'billing') head = pageHead('receipt', 'Orders & Billing', 'Bill amounts, payments received and balances', '<button class="btn ghost" data-act="csv-orders">' + icon('download', 18) + ' Export</button>');
      else if (st.page === 'reports') head = pageHead('chart', 'Reports', 'Summary for the selected period', rangeControl());
      else head = pageHead('gear', 'Settings', 'Connection, admins and business details');
      m.innerHTML = head + '<div id="body"></div>';
      renderBody(); markSync();
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    function renderBody() {
      var b = $('#body'); if (!b) return;
      b.innerHTML = st.page === 'dashboard' ? dashboard() : st.page === 'requests' ? requests() : st.page === 'customers' ? customers() : st.page === 'billing' ? billing() : st.page === 'reports' ? reports() : settings();
    }

    /* ============================= dashboard ============================= */
    function workText(o, n) { var s = App.serviceByName(o.service).short + ' – ' + o.description.replace(/\s+/g, ' '); return s.length > (n || 46) ? s.slice(0, (n || 46) - 1) + '…' : s; }
    function orderRows(list, cols) {
      return list.map(function (o) {
        return '<tr data-order="' + h(o.orderId) + '"><td data-l="Order" class="nowrap"><b>' + h(o.orderId) + '</b></td><td data-l="Customer">' + h(o.name) + '</td><td data-l="Work"><span>' + h(workText(o)) + (o.quantity > 1 ? ' <span class="muted">×' + h(o.quantity) + '</span>' : '') + '</span></td>' +
          '<td data-l="Date" class="nowrap">' + h(App.fmtDate(o.createdAt)) + '</td><td data-l="Status">' + App.pill(o.status) + '</td>' +
          (cols === 'money' ? '<td data-l="Bill" class="num">' + (o.amountQuoted ? money(o.amountQuoted) : '-') + '</td><td data-l="Paid" class="num">' + money(o.amountPaid) + '</td><td data-l="Balance" class="num">' + (o.amountQuoted ? money(Math.max(0, o.amountQuoted - o.amountPaid)) : '-') + '</td>' : '') +
          '<td class="act"><span class="eye">' + icon('eye', 18) + '</span></td></tr>';
      }).join('');
    }
    function orderTable(list, cols, foot) {
      if (!list.length) return '<div class="empty">No orders to show here.</div>';
      return '<table class="tbl stack"><thead><tr><th>#</th><th>Customer</th><th>Service / work</th><th>Date</th><th>Status</th>' + (cols === 'money' ? '<th class="num">Bill</th><th class="num">Paid</th><th class="num">Balance</th>' : '') + '<th>Action</th></tr></thead><tbody>' + orderRows(list, cols) + '</tbody>' + (foot || '') + '</table>';
    }
    function chartItems(byService) { return App.SERVICES.map(function (s) { return { label: s.chart || s.short, value: byService[s.name] || 0 }; }); }
    function dashboard() {
      var R = rangeOf(st.range), cur = summarise(R.from, R.to), prev = R.prevFrom ? summarise(R.prevFrom, R.prevTo) : null;
      var today = App.ymd(new Date());
      var appts = st.data.orders.filter(function (o) { return o.preferredDate === today && OPEN(o); }).sort(function (a, b) { return (a.preferredTime || '99') < (b.preferredTime || '99') ? -1 : 1; });
      var upcoming = st.data.orders.filter(function (o) { return o.preferredDate > today && OPEN(o); }).sort(function (a, b) { return (a.preferredDate + a.preferredTime) < (b.preferredDate + b.preferredTime) ? -1 : 1; }).slice(0, 4);
      var apptRow = function (o, withDate) {
        return '<div class="appt" data-order="' + h(o.orderId) + '"><span class="tm">' + h(withDate ? App.fmtDate(o.preferredDate).replace(/ \d{4}$/, '') : (App.fmtClock(o.preferredTime) || 'Any time')) + '</span><span>' + h(App.serviceByName(o.service).short + ' – ' + o.name) + '</span>' + App.pill(o.status) + '</div>';
      };
      var CR = rangeOf({ preset: st.chartRange === 'same' ? st.range.preset : st.chartRange, from: st.range.from, to: st.range.to }), chart = summarise(CR.from, CR.to);
      var stat = function (cls, ic, title, value, d) { return '<div class="stat ' + cls + '">' + icon(ic, 44) + '<div style="min-width:0"><div class="t">' + title + '</div><div class="v">' + value + ' ' + d + '</div></div></div>'; };
      return '<div class="stats">' +
          stat('s-blue', 'users', 'Total Customers', cur.customers, delta(cur.customers, prev && prev.customers)) +
          stat('s-green', 'wrench', 'Total Service Requests', cur.requests, delta(cur.requests, prev && prev.requests)) +
          stat('s-orange', 'cart', 'Completed Services', cur.completed, delta(cur.completed, prev && prev.completed)) +
          stat('s-purple', 'rupee', 'Total Revenue', money(cur.revenue), delta(cur.revenue, prev && prev.revenue)) + '</div>' +
        '<div class="cols-2"><section class="card"><div class="card-h">' + icon('layers') + '<h3>Our Services (Quick Access)</h3></div><div class="card-b"><div class="tiles">' +
          App.SERVICES.map(function (s) {
            var n = st.data.orders.filter(function (o) { return o.service === s.name && OPEN(o); }).length;
            return '<button class="tile tone-' + s.tone + '" data-svc="' + h(s.name) + '">' + icon(s.icon, 38) + '<span>' + h(s.name) + '</span><span class="small muted" style="font-weight:600">' + n + ' open</span></button>';
          }).join('') + '</div></div></section>' +
        '<section class="card"><div class="card-h">' + icon('calendar') + '<h3>Today\'s Appointments</h3><button class="linkbtn" data-page="requests">View All</button></div><div class="card-b">' +
          (appts.length ? appts.map(function (o) { return apptRow(o); }).join('') : '<div class="empty" style="padding:10px">Nothing booked for today.</div>') +
          (upcoming.length ? '<div class="hint" style="margin:10px 0 4px;font-weight:700">COMING UP</div>' + upcoming.map(function (o) { return apptRow(o, true); }).join('') : '') + '</div></section></div>' +
        '<div class="cols-2"><section class="card"><div class="card-h">' + icon('wrench') + '<h3>Recent Service Requests</h3><button class="linkbtn" data-page="requests">View All</button></div><div class="card-b">' + orderTable(st.data.orders.slice(0, 6)) + '</div></section>' +
        '<section class="card"><div class="card-h">' + icon('chart') + '<h3>Revenue Overview</h3><select class="input" id="chart-range" style="width:auto;min-height:36px;padding:4px 8px;font-size:14px" aria-label="Chart period">' +
          [['month', 'This Month'], ['lastmonth', 'Last Month'], ['year', 'This Year'], ['all', 'All Time']].map(function (o) { return '<option value="' + o[0] + '"' + (st.chartRange === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="card-b chart">' + barChart(chartItems(chart.byService)) + '<div class="hint" style="text-align:center">Payments received, by service: <b>' + money(chart.revenue) + '</b></div></div></section></div>';
    }

    /* ============================== requests ============================== */
    function requests() {
      var f = st.req, q = f.q.trim().toLowerCase();
      var base = st.data.orders.filter(function (o) {
        if (f.service && o.service !== f.service) return false;
        if (!q) return true;
        return (o.orderId + ' ' + o.name + ' ' + o.mobile + ' ' + o.email + ' ' + o.service + ' ' + o.description).toLowerCase().indexOf(q) >= 0 || o.orderId.replace('-', '').toLowerCase().indexOf(q) >= 0;
      });
      var counts = { All: base.length }; App.STATUSES.forEach(function (s) { counts[s] = 0; }); base.forEach(function (o) { counts[o.status]++; });
      var list = f.status === 'All' ? base : base.filter(function (o) { return o.status === f.status; });
      return '<div class="chips">' + ['All'].concat(App.STATUSES).map(function (s) { return '<button class="chip' + (f.status === s ? ' on' : '') + '" data-status="' + s + '">' + s + ' <span class="n">' + counts[s] + '</span></button>'; }).join('') + '</div>' +
        '<section class="card"><div class="card-b" style="padding-top:16px">' + orderTable(list.slice(0, f.limit), 'money') +
        (list.length > f.limit ? '<p style="text-align:center;margin-top:12px"><button class="btn ghost" data-act="more">Show more (' + (list.length - f.limit) + ' more)</button></p>' : '') + '</div></section>';
    }

    /* ============================== customers ============================== */
    function customerList() {
      var map = {};
      st.data.orders.slice().reverse().forEach(function (o) {
        var c = map[o.mobile] || (map[o.mobile] = { name: o.name, mobile: o.mobile, email: '', orders: 0, open: 0, billed: 0, paid: 0, last: '' });
        c.name = o.name; if (o.email) c.email = o.email; c.orders++; if (OPEN(o)) c.open++;
        if (o.status !== 'Cancelled') c.billed += o.amountQuoted; c.paid += o.amountPaid; if (o.createdAt > c.last) c.last = o.createdAt;
      });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    }
    function customers() {
      var q = st.cust.q.trim().toLowerCase();
      var list = customerList().filter(function (c) { return !q || (c.name + ' ' + c.mobile + ' ' + c.email).toLowerCase().indexOf(q) >= 0; });
      if (!list.length) return '<section class="card"><div class="empty">No customers found.</div></section>';
      return '<section class="card"><div class="card-b" style="padding-top:16px"><table class="tbl stack"><thead><tr><th>Customer</th><th>Mobile</th><th>E-mail</th><th class="num">Orders</th><th class="num">Open</th><th class="num">Billed</th><th class="num">Paid</th><th>Last order</th></tr></thead><tbody>' +
        list.slice(0, 300).map(function (c) {
          return '<tr data-cust="' + h(c.mobile) + '"><td data-l="Customer"><b>' + h(c.name) + '</b></td><td data-l="Mobile" class="nowrap">' + h(c.mobile) + '</td><td data-l="E-mail">' + h(c.email || '-') + '</td><td data-l="Orders" class="num">' + c.orders + '</td><td data-l="Open" class="num">' + c.open + '</td><td data-l="Billed" class="num">' + money(c.billed) + '</td><td data-l="Paid" class="num">' + money(c.paid) + '</td><td data-l="Last order" class="nowrap">' + h(App.fmtDate(c.last)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }

    /* =============================== billing =============================== */
    function billing() {
      var live = st.data.orders.filter(function (o) { return o.status !== 'Cancelled'; });
      var due = function (o) { return o.amountQuoted > 0 ? Math.max(0, o.amountQuoted - o.amountPaid) : 0; };
      var sets = {
        'All': st.data.orders,
        'Balance due': live.filter(function (o) { return due(o) > 0; }),
        'Advance to verify': live.filter(function (o) { return o.advanceClaimed > 0 && !o.advanceVerified; }),
        'Bill not set': live.filter(function (o) { return !o.amountQuoted; }),
        'Paid in full': live.filter(function (o) { return o.amountQuoted > 0 && due(o) === 0; })
      };
      var list = sets[st.bill.filter] || sets.All;
      var sum = function (arr, fn) { return arr.reduce(function (s, o) { return s + fn(o); }, 0); };
      var foot = '<tfoot><tr><td colspan="5">Total of ' + list.length + ' order(s) shown</td><td class="num">' + money(sum(list, function (o) { return o.amountQuoted; })) + '</td><td class="num">' + money(sum(list, function (o) { return o.amountPaid; })) + '</td><td class="num">' + money(sum(list, due)) + '</td><td></td></tr></tfoot>';
      return '<div class="minis"><div class="mini"><b>' + money(sum(live, function (o) { return o.amountQuoted; })) + '</b><span>Total billed</span></div><div class="mini"><b style="color:var(--green)">' + money(sum(st.data.orders, function (o) { return o.amountPaid; })) + '</b><span>Received</span></div>' +
        '<div class="mini"><b style="color:var(--orange)">' + money(sum(live, due)) + '</b><span>Balance due</span></div><div class="mini"><b>' + sets['Advance to verify'].length + '</b><span>Advances to verify</span></div></div>' +
        '<div class="chips">' + Object.keys(sets).map(function (k) { return '<button class="chip' + (st.bill.filter === k ? ' on' : '') + '" data-bill="' + k + '">' + k + ' <span class="n">' + sets[k].length + '</span></button>'; }).join('') + '</div>' +
        '<section class="card"><div class="card-b" style="padding-top:16px">' + orderTable(list.slice(0, 300), 'money', foot) + '</div></section>';
    }

    /* =============================== reports =============================== */
    function reports() {
      var R = rangeOf(st.range), cur = summarise(R.from, R.to);
      var svcRows = App.SERVICES.map(function (s) {
        var os = cur.orders.filter(function (o) { return o.service === s.name; });
        return '<tr style="cursor:default"><td data-l="Service"><b>' + h(s.name) + '</b></td><td data-l="Requests" class="num">' + os.length + '</td><td data-l="Completed" class="num">' + os.filter(function (o) { return o.status === 'Completed'; }).length + '</td><td data-l="Payments received" class="num">' + money(cur.byService[s.name] || 0) + '</td></tr>';
      }).join('');
      var months = [], now = new Date();
      for (var i = 11; i >= 0; i--) { var a = new Date(now.getFullYear(), now.getMonth() - i, 1), b = new Date(now.getFullYear(), now.getMonth() - i + 1, 1); months.push({ label: App.MON[a.getMonth()], value: summarise(a, b).revenue }); }
      var modes = {}; st.data.payments.forEach(function (p) { if (within(p.at, R.from, R.to)) modes[p.mode || 'Other'] = (modes[p.mode || 'Other'] || 0) + p.amount; });
      return '<div class="minis"><div class="mini"><b>' + cur.requests + '</b><span>Requests</span></div><div class="mini"><b>' + cur.completed + '</b><span>Completed</span></div><div class="mini"><b>' + cur.customers + '</b><span>Customers</span></div><div class="mini"><b style="color:var(--green)">' + money(cur.revenue) + '</b><span>Payments received</span></div></div>' +
        '<div class="cols-2"><section class="card"><div class="card-h">' + icon('layers') + '<h3>By service</h3></div><div class="card-b"><table class="tbl stack"><thead><tr><th>Service</th><th class="num">Requests</th><th class="num">Completed</th><th class="num">Payments received</th></tr></thead><tbody>' + svcRows + '</tbody>' +
          '<tfoot><tr><td>Total</td><td class="num">' + cur.requests + '</td><td class="num">' + cur.completed + '</td><td class="num">' + money(cur.revenue) + '</td></tr></tfoot></table></div></section>' +
        '<section class="card"><div class="card-h">' + icon('wrench') + '<h3>By status</h3></div><div class="card-b">' + App.STATUSES.map(function (s) {
          return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">' + App.pill(s) + '<b>' + cur.orders.filter(function (o) { return o.status === s; }).length + '</b></div>';
        }).join('') + '<h4 class="sub-h">Payments by mode</h4>' + (Object.keys(modes).length ? Object.keys(modes).map(function (k) { return '<div style="display:flex;justify-content:space-between;padding:5px 0"><span>' + h(k) + '</span><b>' + money(modes[k]) + '</b></div>'; }).join('') : '<div class="muted small">No payments in this period.</div>') + '</div></section></div>' +
        '<section class="card" style="margin-bottom:16px"><div class="card-h">' + icon('chart') + '<h3>Payments received - last 12 months</h3></div><div class="card-b chart">' + barChart(months, 760) + '</div></section>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" data-act="csv-orders">' + icon('download', 18) + ' Export all orders (CSV)</button><button class="btn ghost" data-act="csv-payments">' + icon('download', 18) + ' Export all payments (CSV)</button></div>';
    }

    /* =============================== settings =============================== */
    function settings() {
      var s = st.data.settings;
      var row = function (k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; };
      return '<div class="d-grid"><section class="card"><div class="card-h">' + icon('check') + '<h3>Connection</h3></div><div class="card-b"><dl class="kv">' +
          row('Backend', '<span class="pill pill-completed">Connected</span>') + row('Logged in as', h(st.data.me)) +
          row('Admins', h(s.admins.join(', '))) +
          row('Customer e-mails', s.emailCustomers ? 'On' : 'Off') +
          row('E-mails left today', s.mailQuota < 0 ? 'Unknown' : h(s.mailQuota) + (s.mailQuota <= 10 ? ' <span class="pill pill-pending">Low</span>' : '')) +
          row('Website address', s.siteUrl ? h(s.siteUrl) : '<span style="color:var(--red)">Not set</span>') + '</dl>' +
          (s.siteUrl ? '' : '<div class="note warn" style="margin-top:12px">E-mails and WhatsApp messages will not contain a tracking link until you type your website address into the <b>site_url</b> row of the <b>Settings</b> tab in the Google Sheet.</div>') +
          (s.sheetUrl ? '<p style="margin-top:14px"><a class="btn ghost" target="_blank" rel="noopener" href="' + h(s.sheetUrl) + '">' + icon('layers', 18) + ' Open the Google Sheet (all data)</a></p>' : '') + '</div></section>' +
        '<section class="card"><div class="card-h">' + icon('users') + '<h3>Users & roles</h3></div><div class="card-b"><p>Only the admin e-mail addresses listed here can log in. To add or remove an admin, open the Google Sheet, go to the <b>Settings</b> tab and edit the <b>admin_emails</b> row (separate addresses with commas). The change applies immediately.</p>' +
          '<h4 class="sub-h">Business details on the website</h4><dl class="kv">' + row('Name', h(cfg.BUSINESS_NAME)) + row('Phone', h(cfg.PHONE || '-')) + row('WhatsApp', h(cfg.WHATSAPP || '-')) + row('E-mail', h(cfg.EMAIL || '-')) + row('UPI ID', h(cfg.UPI_ID || '-')) + '</dl>' +
          '<p class="hint" style="margin-top:10px">These are edited in the <code>config.js</code> file of the website.</p></div></section></div>';
    }

    /* ============================ order detail ============================ */
    function openOrder(id) {
      var o = byId(id); if (!o) return;
      st.detail = { order: o, activity: null, trackUrl: '', busy: false, result: null, stale: false, payRef: App.uid() };
      renderDetail();
      call('orderDetail', { orderId: id }).then(function (d) {
        if (!st.detail || st.detail.order.orderId !== id) return;
        st.detail.activity = d.activity; st.detail.trackUrl = d.trackUrl;
        if (d.order.updatedAt !== st.detail.order.updatedAt) { st.detail.order = d.order; putOrder(d.order); renderDetail(); }
        else { var t = $('#tl'); if (t) t.innerHTML = timeline(d.activity); }
      }, function (e) { var t = $('#tl'); if (t) t.innerHTML = '<div class="err">' + h(e.message) + '</div>'; });
    }
    function timeline(list) {
      if (!list) return '<div class="muted small">Loading history...</div>';
      return '<ul class="timeline">' + list.slice().reverse().map(function (t) {
        var title = t.type === 'created' ? 'Order placed' : t.type === 'payment' ? 'Payment ' + money(t.amount) + (t.mode ? ' (' + t.mode + ')' : '') : t.status ? 'Status: ' + t.status : t.visible ? 'Message to customer' : 'Internal note';
        return '<li class="' + (t.visible ? '' : 'internal') + '"><b>' + h(title) + '</b>' + (t.visible ? '' : '<span class="tag">INTERNAL</span>') + '<div class="when">' + h(App.fmtDateTime(t.at)) + ' · ' + h(t.by) + (t.ref ? ' · ref ' + h(t.ref) : '') + '</div>' + (t.message ? '<div>' + App.nl2br(t.message) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    function renderDetail() {
      var D = st.detail, box = $('#modal');
      if (!D) { box.innerHTML = ''; document.body.style.overflow = ''; return; }
      document.body.style.overflow = 'hidden';
      var o = D.order, bal = o.amountQuoted > 0 ? Math.max(0, o.amountQuoted - o.amountPaid) : 0;
      var next = { 'Pending': [['Confirmed', 'Accept order', 'green']], 'Confirmed': [['In Progress', 'Start work', '']], 'In Progress': [['Ready', 'Mark ready', '']], 'Ready': [['Completed', 'Mark completed', 'green']], 'Completed': [], 'Cancelled': [['Pending', 'Re-open order', 'ghost']] }[o.status] || [];
      var res = '';
      if (D.result) {
        var r = D.result;
        res = '<div class="note ok result" id="result"><b>Saved.</b> ' + (r.emailed ? 'An e-mail was sent to the customer.' : r.emailNote ? 'E-mail was not sent (' + h(r.emailNote) + ').' : r.customerText ? (o.email ? 'No e-mail was sent.' : 'This customer gave no e-mail address - use WhatsApp to inform them.') : 'Internal note saved (customer not informed).') +
          (r.customerText ? '<div class="row"><a class="btn wa sm" target="_blank" rel="noopener" href="' + h(App.waLink(o.mobile, r.customerText)) + '">' + icon('chat', 16) + ' Send this update on WhatsApp</a><button class="btn ghost sm" data-act="copy-msg">' + icon('copy', 16) + ' Copy message</button></div>' : '') + '</div>';
      }
      var adv = o.advanceClaimed > 0 && !o.advanceVerified ? '<div class="note warn" style="margin-bottom:10px">Customer says <b>' + money(o.advanceClaimed) + '</b> advance was paid by <b>' + h(o.advanceMode) + '</b>' + (o.advanceRef ? ', ref <b>' + h(o.advanceRef) + '</b>' : '') + '. Check your account, then:<div style="margin-top:8px"><button class="btn green sm" data-act="verify-adv">' + icon('check', 16) + ' Verified - record ' + money(o.advanceClaimed) + '</button></div></div>' : '';
      box.innerHTML = '<div class="modal-bg" data-act="close-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Order ' + h(o.orderId) + '">' +
        '<div class="modal-h"><h3>' + h(o.orderId) + ' ' + App.pill(o.status) + '<span class="muted small" style="font-weight:400">placed ' + h(App.fmtDateTime(o.createdAt)) + (o.source === 'admin' ? ' · entered by staff' : '') + '</span></h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div>' +
        '<div class="modal-b"><div class="note warn' + (D.stale ? '' : ' hide') + '" id="stale" style="margin-bottom:12px">This order was changed elsewhere. <button class="linkbtn" data-act="reload-detail">Reload it</button></div>' + res +
        '<div class="d-grid" style="margin-top:' + (res ? '12px' : '0') + '">' +
          '<div class="panel work"><h4>Work requested</h4><dl class="kv"><dt>Service</dt><dd>' + h(o.service) + '</dd><dt>Count</dt><dd>' + h(o.quantity) + ' ' + h(App.serviceByName(o.service).unit) + '</dd><dt>Work</dt><dd>' + App.nl2br(o.description) + '</dd>' +
            (o.preferredDate ? '<dt>Preferred</dt><dd>' + h(App.fmtDate(o.preferredDate)) + (o.preferredTime ? ', ' + h(App.fmtClock(o.preferredTime)) : '') + '</dd>' : '') + (o.address ? '<dt>Address</dt><dd>' + App.nl2br(o.address) + '</dd>' : '') +
            (o.assignedTo ? '<dt>Handled by</dt><dd>' + h(o.assignedTo) + '</dd>' : '') + '</dl></div>' +
          '<div class="panel work"><h4>Update this order</h4>' +
            '<div class="quick" style="margin-top:0">' + next.map(function (n) { return '<button class="btn ' + n[2] + '" data-next="' + n[0] + '" data-busy>' + icon('check', 17) + ' ' + n[1] + '</button>'; }).join('') +
            (OPEN(o) ? '<button class="btn red" data-act="cancel-order" data-busy>' + icon('x', 17) + ' Cancel order</button>' : '') + '</div>' +
            '<form id="uf" novalidate style="margin-top:12px"><div class="grid2"><div class="field"><label for="u-status">Status</label><select class="input" id="u-status">' + App.STATUSES.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label for="u-bill">Bill amount (₹)</label><input class="input" id="u-bill" type="number" inputmode="decimal" min="0" step="any" value="' + (o.amountQuoted || '') + '" placeholder="Total charge for this work"></div></div>' +
            '<div class="field"><label for="u-msg">Message to the customer <span class="opt">(optional)</span></label><textarea class="input" id="u-msg" maxlength="1000" style="min-height:70px" placeholder="e.g. Your prints will be ready by 5 pm today."></textarea></div>' +
            (o.email ? '<label class="check"><input type="checkbox" id="u-notify" checked> <span>E-mail this update to the customer (' + h(o.email) + ')</span></label>' : '<div class="hint" style="margin-bottom:6px">No e-mail address on this order - after saving you will get a WhatsApp button.</div>') +
            '<label class="check"><input type="checkbox" id="u-internal"> <span>Internal note only - the customer will not see this</span></label>' +
            '<button class="btn block" type="submit" style="margin-top:8px" data-busy>' + icon('check', 18) + ' Save update</button></form></div>' +
          '<div class="panel"><h4>Customer</h4><div style="font-size:17px;font-weight:700">' + h(o.name) + '</div><div>' + h(o.mobile) + (o.email ? ' · ' + h(o.email) : '') + '</div><div class="contact">' +
            '<a class="btn ghost sm" href="tel:+91' + h(o.mobile) + '">' + icon('phone', 16) + ' Call</a><a class="btn wa sm" target="_blank" rel="noopener" href="' + h(App.waLink(o.mobile, 'Hello ' + o.name + ', this is ' + cfg.BUSINESS_NAME + ' regarding your order ' + o.orderId + '.')) + '">' + icon('chat', 16) + ' WhatsApp</a>' +
            (o.email ? '<a class="btn ghost sm" href="mailto:' + h(o.email) + '?subject=' + encodeURIComponent('Order ' + o.orderId) + '">' + icon('mail', 16) + ' E-mail</a>' : '') + '</div></div>' +
          '<div class="panel"><h4>Payment</h4>' + adv + '<div class="amounts" style="margin:0 0 10px"><div><span class="muted small">Bill</span><b>' + (o.amountQuoted ? money(o.amountQuoted) : 'Not set') + '</b></div><div class="paid"><span class="muted small">Paid</span><b>' + money(o.amountPaid) + '</b></div><div class="due"><span class="muted small">Balance</span><b>' + (o.amountQuoted ? money(bal) : '-') + '</b></div></div>' +
            '<form id="pf" novalidate><div class="grid3 keep" style="grid-template-columns:1fr 1fr"><div class="field"><label for="p-amt">Amount received (₹)</label><input class="input" id="p-amt" type="number" inputmode="decimal" step="any" placeholder="' + (bal ? bal : '0') + '"></div>' +
            '<div class="field"><label for="p-mode">Mode</label><select class="input" id="p-mode">' + App.PAY_MODES.map(function (m) { return '<option' + (m === 'Cash' ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div></div>' +
            '<div class="field"><label for="p-ref">Reference <span class="opt">(optional)</span></label><input class="input" id="p-ref" maxlength="60"></div>' +
            '<button class="btn ghost block" type="submit" data-busy>' + icon('rupee', 17) + ' Record payment</button><div class="hint" style="margin-top:6px">To correct a mistake, record a minus amount (e.g. -100).</div></form></div>' +
          '<div class="panel work"><h4>History</h4><div id="tl">' + timeline(D.activity) + '</div></div>' +
        '</div></div></div></div>';
    }
    function setBusy(on) {
      if (!st.detail) return; st.detail.busy = on;
      var b = root.querySelectorAll('#modal [data-busy]'); for (var i = 0; i < b.length; i++) b[i].disabled = on;
    }
    function afterSave(res) {
      var id = res.order.orderId;
      putOrder(res.order);
      st.detail = { order: res.order, activity: st.detail ? st.detail.activity : null, trackUrl: res.trackUrl, busy: false, result: res, stale: false, payRef: App.uid() };
      renderDetail(); renderNav(); renderBody();
      var bg = $('.modal-bg'); if (bg) bg.scrollTop = 0;
      call('orderDetail', { orderId: id }).then(function (d) { if (st.detail && st.detail.order.orderId === id) { st.detail.activity = d.activity; var t = $('#tl'); if (t) t.innerHTML = timeline(d.activity); } }, function () {});
    }
    function saveFail(e) {
      setBusy(false);
      if (e.code === 'CONFLICT' || e.code === 'NOT_FOUND') { App.toast(e.message, 'err'); if (st.detail) { var id = st.detail.order.orderId; loadData(true).then(function () { if (byId(id)) openOrder(id); }); } }
      else App.toast(e.message, 'err');
    }
    function saveUpdate(statusOverride) {
      var D = st.detail; if (!D || D.busy) return;
      var o = D.order, status = statusOverride || $('#u-status').value, bill = $('#u-bill').value.trim(), msg = $('#u-msg').value.trim();
      var internal = $('#u-internal').checked, nf = $('#u-notify');
      var p = { orderId: o.orderId, rev: o.updatedAt, visible: !internal, notify: !!(nf && nf.checked) };
      if (status !== o.status) p.status = status;
      if (bill !== '') { var b = Number(bill); if (!(b >= 0)) return App.toast('The bill amount is not valid.', 'err'); if (b !== o.amountQuoted) p.amountQuoted = b; }
      if (msg) p.message = msg;
      if (!p.status && p.amountQuoted === undefined && !msg) return App.toast('Nothing to save - change the status or bill, or type a message.', 'err');
      setBusy(true);
      call('updateOrder', p).then(afterSave, saveFail);
    }
    function savePayment(fromAdvance) {
      var D = st.detail; if (!D || D.busy) return;
      var o = D.order, nf = $('#u-notify');
      var p = { orderId: o.orderId, clientRef: D.payRef, notify: !!(nf && nf.checked) };
      if (fromAdvance) { p.amount = o.advanceClaimed; p.mode = App.PAY_MODES.indexOf(o.advanceMode) >= 0 ? o.advanceMode : 'Other'; p.ref = o.advanceRef; p.fromAdvance = true; }
      else {
        p.amount = Number($('#p-amt').value); p.mode = $('#p-mode').value; p.ref = $('#p-ref').value.trim();
        if (!p.amount) return App.toast('Enter the amount received.', 'err');
      }
      setBusy(true);
      call('addPayment', p).then(afterSave, saveFail);
    }

    /* ========================= new (walk-in) request ========================= */
    function renderNew() {
      var box = $('#modal'), N = st.newOrder;
      if (!N) { box.innerHTML = ''; document.body.style.overflow = ''; return; }
      document.body.style.overflow = 'hidden';
      box.innerHTML = '<div class="modal-bg" data-act="close-bg"><div class="modal narrow" role="dialog" aria-modal="true" aria-label="New request"><div class="modal-h"><h3>New request (walk-in / phone)</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div>' +
        '<div class="modal-b"><form id="nf" novalidate>' +
        '<div class="field"><label for="n-service">Service</label><select class="input" id="n-service">' + App.SERVICES.map(function (s) { return '<option value="' + s.id + '">' + h(s.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="n-description">Work</label><textarea class="input" id="n-description" maxlength="2000"></textarea></div>' +
        '<div class="grid3"><div class="field"><label for="n-quantity">Count</label><input class="input" id="n-quantity" type="number" min="1" value="1"></div><div class="field"><label for="n-preferredDate">Date <span class="opt">(optional)</span></label><input class="input" id="n-preferredDate" type="date"></div><div class="field"><label for="n-preferredTime">Time <span class="opt">(optional)</span></label><input class="input" id="n-preferredTime" type="time"></div></div>' +
        '<div class="grid2"><div class="field"><label for="n-name">Customer name</label><input class="input" id="n-name" maxlength="80"></div><div class="field"><label for="n-mobile">Mobile</label><input class="input" id="n-mobile" type="tel" inputmode="numeric" maxlength="14"></div></div>' +
        '<div class="field"><label for="n-email">E-mail <span class="opt">(optional)</span></label><input class="input" id="n-email" type="email"></div>' +
        '<div class="field"><label for="n-address">Address <span class="opt">(optional)</span></label><input class="input" id="n-address" maxlength="300"></div>' +
        '<div class="err" id="n-err" style="margin-bottom:10px"></div><button class="btn block" type="submit" id="n-go">' + icon('check', 18) + ' Create request</button></form></div></div></div>';
    }
    function saveNew() {
      var N = st.newOrder; if (!N || N.busy) return;
      var g = function (k) { return $('#n-' + k).value.trim(); };
      var p = { service: g('service'), description: g('description'), quantity: g('quantity'), preferredDate: g('preferredDate'), preferredTime: g('preferredTime'), name: g('name'), mobile: g('mobile'), email: g('email'), address: g('address'), clientRef: N.ref };
      N.busy = true; var btn = $('#n-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
      call('createOrder', p).then(function (res) {
        st.newOrder = null; if (res.order) putOrder(res.order);
        renderNew(); renderNav(); renderBody(); App.toast('Request ' + res.orderId + ' created');
        if (res.order) openOrder(res.orderId);
      }, function (e) { N.busy = false; btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Create request'; var er = $('#n-err'); if (er) er.textContent = e.message; });
    }

    /* =============================== export =============================== */
    function csvCell(v) { v = String(v === null || v === undefined ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    function download(name, rows) {
      if (App.demo) return App.toast('Downloads are switched off in this preview. They work on your hosted website.', 'err');
      try {
        var blob = new Blob(['\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 500);
      } catch (e) { App.toast('Could not create the file on this device.', 'err'); }
    }
    function exportOrders() {
      var rows = [['Order', 'Placed on', 'Status', 'Service', 'Customer', 'Mobile', 'E-mail', 'Work', 'Count', 'Preferred date', 'Address', 'Bill', 'Paid', 'Balance', 'Advance reported', 'Advance verified', 'Handled by', 'Source']];
      st.data.orders.forEach(function (o) { rows.push([o.orderId, App.fmtDateTime(o.createdAt), o.status, o.service, o.name, o.mobile, o.email, o.description, o.quantity, o.preferredDate, o.address, o.amountQuoted, o.amountPaid, o.amountQuoted ? Math.max(0, o.amountQuoted - o.amountPaid) : '', o.advanceClaimed || '', o.advanceVerified ? 'yes' : '', o.assignedTo, o.source]); });
      download('orders-' + App.ymd(new Date()) + '.csv', rows);
    }
    function exportPayments() {
      var rows = [['Date', 'Order', 'Customer', 'Service', 'Amount', 'Mode']];
      st.data.payments.forEach(function (p) { var o = byId(p.orderId) || {}; rows.push([App.fmtDateTime(p.at), p.orderId, o.name || '', o.service || '', p.amount, p.mode]); });
      download('payments-' + App.ymd(new Date()) + '.csv', rows);
    }

    /* =============================== events =============================== */
    function closeModal() { st.detail = null; st.newOrder = null; $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
    function goPage(p) { st.page = p; var a = $('#adm'); if (a) a.classList.remove('open'); renderNav(); renderPage(); }

    root.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act],[data-page],[data-order],[data-svc],[data-status],[data-bill],[data-cust],[data-next]');
      if (!t) return;
      if (t.hasAttribute('data-page')) return goPage(t.getAttribute('data-page'));
      if (t.hasAttribute('data-order')) return openOrder(t.getAttribute('data-order'));
      if (t.hasAttribute('data-svc')) { st.req = { q: '', status: 'All', service: t.getAttribute('data-svc'), limit: 50 }; return goPage('requests'); }
      if (t.hasAttribute('data-status')) { st.req.status = t.getAttribute('data-status'); st.req.limit = 50; return renderBody(); }
      if (t.hasAttribute('data-bill')) { st.bill.filter = t.getAttribute('data-bill'); return renderBody(); }
      if (t.hasAttribute('data-cust')) { st.req = { q: t.getAttribute('data-cust'), status: 'All', service: '', limit: 50 }; return goPage('requests'); }
      if (t.hasAttribute('data-next')) return saveUpdate(t.getAttribute('data-next'));
      switch (t.getAttribute('data-act')) {
        case 'menu': $('#adm').classList.toggle('open'); break;
        case 'bell': st.req = { q: '', status: 'Pending', service: '', limit: 50 }; goPage('requests'); break;
        case 'logout': var s = st.session; signOut('You have been logged out.'); if (s) App.api('logout', { token: s.token }, { retries: 0 }).catch(function () {}); break;
        case 'refresh': loadData(); break;
        case 'retry': st.loadErr = ''; render(); loadData(); break;
        case 'more': st.req.limit += 100; renderBody(); break;
        case 'new': st.newOrder = { ref: App.uid(), busy: false }; renderNew(); break;
        case 'close': closeModal(); break;
        case 'close-bg': if (ev.target === t) closeModal(); break;
        case 'login-back': st.login.step = 'email'; st.login.err = ''; renderLogin(); break;
        case 'verify-adv': savePayment(true); break;
        case 'copy-msg': if (st.detail && st.detail.result) App.copy(st.detail.result.customerText, 'Message copied'); break;
        case 'reload-detail': if (st.detail) openOrder(st.detail.order.orderId); break;
        case 'cancel-order':
          if (t.classList.contains('armed')) saveUpdate('Cancelled');
          else { t.classList.add('armed'); t.innerHTML = icon('x', 17) + ' Tap again to cancel this order'; setTimeout(function () { if (t.isConnected) { t.classList.remove('armed'); t.innerHTML = icon('x', 17) + ' Cancel order'; } }, 5000); }
          break;
        case 'csv-orders': exportOrders(); break;
        case 'csv-payments': exportPayments(); break;
      }
    });
    root.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var id = ev.target.id;
      if (id === 'lf1') sendCode(); else if (id === 'lf2') checkCode(); else if (id === 'uf') saveUpdate(); else if (id === 'pf') savePayment(false); else if (id === 'nf') saveNew();
    });
    root.addEventListener('input', function (ev) {
      if (ev.target.id !== 'q') return;
      if (st.page === 'requests') { st.req.q = ev.target.value; st.req.limit = 50; } else st.cust.q = ev.target.value;
      renderBody();
    });
    root.addEventListener('change', function (ev) {
      var id = ev.target.id;
      if (id === 'rg') { st.range.preset = ev.target.value; renderPage(); }
      else if (id === 'rg-from') { st.range.from = ev.target.value; renderPage(); }
      else if (id === 'rg-to') { st.range.to = ev.target.value; renderPage(); }
      else if (id === 'chart-range') { st.chartRange = ev.target.value; renderBody(); }
      else if (id === 'svc') { st.req.service = ev.target.value; renderBody(); }
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && (st.detail || st.newOrder) && !(st.detail && st.detail.busy)) closeModal(); });

    function start() {
      render();
      loadData();
      clearInterval(st.timer);
      st.timer = setInterval(function () { if (st.session && st.data && document.visibilityState !== 'hidden') loadData(true); }, 60000);
    }
    if (st.session && st.session.expires && new Date(st.session.expires) < new Date()) { st.session = null; App.store.del('oss_admin'); }
    if (st.session) start(); else render();
  };
})();
