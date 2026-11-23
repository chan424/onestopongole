/* Admin tools shown on the same page when an admin is signed in.
   The backend (Apps Script) checks the Google sign-in and the admin e-mail list on every call. */
(function () {
  'use strict';
  var App = window.App, h = App.h, icon = App.icon, money = App.money;
  var A, site;
  var TABS = [['dashboard', 'Dashboard', 'grid'], ['orders', 'Orders', 'list'], ['catalogue', 'Catalogue', 'layers'], ['settings', 'Settings', 'gear']];
  var SETTINGS_FIELDS = [
    ['BUSINESS_NAME', 'Shop name'], ['BUSINESS_SUBTITLE', 'Subtitle'], ['TAGLINE', 'Tagline (hero heading)'], ['PHONE', 'Phone (10 digits)'], ['WHATSAPP', 'WhatsApp (10 digits)'],
    ['EMAIL', 'Shop e-mail'], ['ADDRESS', 'Address'], ['HOURS', 'Working hours'], ['MAP_LINK', 'Google Maps link'], ['PHONEPE_NUMBER', 'PhonePe number (for payments)'], ['UPI_ID', 'UPI ID (from PhonePe)'], ['UPI_NAME', 'UPI name'],
    ['SITE_URL', 'Website address (for tracking links in e-mails)'], ['ANNOUNCEMENT', 'Announcement bar text (leave empty to hide)'], ['ABOUT', 'About us text', 'textarea']
  ];
  function $(s) { return site.$(s); }
  function seenAt() { var v = App.store.get((App.demo ? 'oss_admin_seen_demo' : 'oss_admin_seen'), null); if (!v) { v = new Date(Date.now() - 86400000).toISOString(); App.store.set((App.demo ? 'oss_admin_seen_demo' : 'oss_admin_seen'), v); } return v; }
  function newOrders() { if (!A.data) return []; var s = seenAt(); return A.data.orders.filter(function (o) { return o.createdAt > s && o.source !== 'admin'; }); }
  function OPEN(o) { return o.status !== 'Completed' && o.status !== 'Cancelled'; }
  var PAY_STATUSES = ['COD', 'Awaiting payment', 'Paid - pending verification', 'Paid - verified'];
  function payPill(o) {
    var s = o.paymentStatus || 'COD', cls = s === 'Paid - verified' ? 'pill-ready' : s === 'Paid - pending verification' ? 'pill-in-progress' : s === 'Awaiting payment' ? 'pill-pending' : 'pill-confirmed';
    return '<span class="pill ' + cls + '">' + h(s === 'COD' ? 'COD' : s === 'Paid - verified' ? 'Paid' : s === 'Paid - pending verification' ? 'Check UTR' : 'Not paid') + '</span>';
  }

  App.markAdminSeen = function () {
    if (!A || !A.data || !A.data.orders.length) return;
    var max = A.data.orders.reduce(function (m, o) { return o.createdAt > m ? o.createdAt : m; }, '');
    App.store.set((App.demo ? 'oss_admin_seen_demo' : 'oss_admin_seen'), max); App.renderAdminBar(); updateTitle();
  };
  function updateTitle() { var n = A && A.data ? newOrders().length : 0; document.title = (n ? '(' + n + ') ' : '') + site.S().BUSINESS_NAME + ' - IT & Printing Services'; }

  App.loadAdmin = function (quiet) {
    if (!App.auth.isAdmin() || A.busy) return Promise.resolve();
    A.busy = true;
    if (!quiet && !A.data) App.renderAdmin();
    return App.api('adminData', {}, { retries: quiet ? 0 : 1 }).then(function (d) {
      A.busy = false;
      var before = A.data ? A.data.orders.map(function (o) { return o.orderId; }) : null;
      d.orders.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      if (before) d.orders.forEach(function (o) { if (before.indexOf(o.orderId) < 0 && o.source !== 'admin') App.toast('New order ' + o.orderId + ' from ' + o.name); });
      A.data = d; A.err = '';
      if (!A.draft || !A.dirty) A.draft = JSON.parse(JSON.stringify(d.catalogue));
      if (site.st.view === 'admin' && A.tab === 'orders') App.markAdminSeen();
      App.renderAdminBar(); updateTitle();
      if (site.st.view === 'admin' && !(quiet && (A.tab === 'settings' || (A.tab === 'catalogue' && A.dirty)))) App.renderAdmin();
    }, function (e) {
      A.busy = false;
      if (e.code === 'FORBIDDEN' || e.code === 'AUTH') { App.toast(e.message, 'err'); if (e.code === 'FORBIDDEN') App.auth.signOut(); return; }
      if (!quiet || !A.data) { A.err = e; App.renderAdmin(); }
    });
  };

  App.renderAdminBar = function () {
    var bar = $('#adminbar'); if (!bar) return;
    if (!App.auth.isAdmin()) { bar.innerHTML = ''; document.body.classList.remove('has-adminbar'); return; }
    document.body.classList.add('has-adminbar');
    var n = newOrders().length, inAdmin = site.st.view === 'admin', u = App.auth.user;
    bar.innerHTML = '<div class="abar"><div class="wrap abar-in"><span class="abar-t">' + icon('shield', 16) + ' <b>Admin</b><span class="hide-sm"> · ' + h(u.email) + (App.demo ? ' (demo)' : '') + '</span></span>' +
      '<nav class="abar-tabs"><button class="' + (!inAdmin ? 'on' : '') + '" data-act="gosite">' + icon('globe', 16) + ' Website</button>' +
      TABS.map(function (t) { return '<button class="' + (inAdmin && A.tab === t[0] ? 'on' : '') + '" data-act="goadmin" data-tab="' + t[0] + '">' + icon(t[2], 16) + ' ' + t[1] + (t[0] === 'orders' && n ? ' <span class="badge">' + n + '</span>' : '') + '</button>'; }).join('') + '</nav>' +
      '<button class="abar-out" data-act="signout" title="Sign out">' + icon('logout', 17) + '<span class="hide-sm"> Sign out</span></button></div></div>';
  };

  App.renderAdmin = function () {
    var box = $('#admin'); if (!box || site.st.view !== 'admin') return;
    if (!App.auth.isAdmin()) { box.innerHTML = ''; return; }
    var body;
    if (!A.data) {
      body = A.err ? '<div class="card pad center"><h3>Could not load admin data</h3><p class="muted" style="margin:8px 0 14px">' + h(A.err.message) + '</p>' +
        (A.err.code === 'OLD_BACKEND' || A.err.code === 'SETUP' ? '<p class="hint">Follow SETUP-GUIDE.md Part 1 and Part 2, then reload this page.</p>' : '') + '<button class="btn" data-a="reload">' + icon('refresh', 17) + ' Try again</button></div>'
        : '<div class="card pad center"><span class="spin dark big"></span><p class="muted" style="margin-top:10px">Loading dashboard...</p></div>';
    } else body = ({ dashboard: dashboard, orders: ordersTab, catalogue: catalogueTab, settings: settingsTab }[A.tab] || dashboard)();
    var title = (TABS.filter(function (t) { return t[0] === A.tab; })[0] || TABS[0])[1];
    box.innerHTML = '<div class="wrap"><div class="a-head"><div><h1>' + h(title) + '</h1><p class="muted small">' + (A.data ? 'Updated ' + App.fmtDateTime(new Date().toISOString()) + (App.demo ? ' · demo data' : '') : '') + '</p></div>' +
      '<div class="row">' + (A.tab === 'orders' || A.tab === 'dashboard' ? '<button class="btn sm" data-a="new-order">' + icon('plus', 16) + ' New order</button>' : '') +
      '<button class="btn ghost sm" data-a="reload">' + icon('refresh', 16) + ' Refresh</button></div></div>' + body + '</div>';
    if (A.tab === 'orders') renderOrderList();
    if (A.tab === 'catalogue') renderCatItems();
  };

  /* ============================== dashboard ============================== */
  function dashboard() {
    var o = A.data.orders, now = new Date(), mk = now.getFullYear() + '-' + App.pad(now.getMonth() + 1);
    var live = o.filter(function (x) { return x.status !== 'Cancelled'; });
    var paid = live.reduce(function (s, x) { return s + (Number(x.amountPaid) || 0); }, 0);
    var dues = live.reduce(function (s, x) { return s + (Number(x.balance) || 0); }, 0);
    var month = o.filter(function (x) { return (x.createdAt || '').slice(0, 7) === mk; });
    var monthRev = month.filter(function (x) { return x.status !== 'Cancelled'; }).reduce(function (s, x) { return s + (Number(x.amountPaid) || 0); }, 0);
    var nw = newOrders();
    var kpis = [['list', 'Total orders', o.length, 'blue'], ['clock', 'Open orders', o.filter(OPEN).length, 'orange'], ['bell', 'New orders', nw.length, 'red'],
      ['rupee', 'Revenue collected', money(paid), 'green'], ['receipt', 'Pending dues', money(dues), 'violet'], ['calendar', 'This month', money(monthRev), 'indigo', month.length + ' orders']];
    var maxS = Math.max.apply(null, App.STATUSES.map(function (s) { return o.filter(function (x) { return x.status === s; }).length; }).concat([1]));
    var byCat = {}; o.forEach(function (x) { var k = x.serviceName || x.service || 'Other'; byCat[k] = byCat[k] || { n: 0, r: 0 }; byCat[k].n++; byCat[k].r += Number(x.amountPaid) || 0; });
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b].n - byCat[a].n; }), maxC = Math.max.apply(null, cats.map(function (k) { return byCat[k].n; }).concat([1]));
    var days = []; for (var i = 13; i >= 0; i--) { var d = new Date(now.getTime() - i * 86400000); days.push(App.ymd(d)); }
    var perDay = days.map(function (d) { return o.filter(function (x) { return x.createdAt && App.ymd(new Date(x.createdAt)) === d; }).length; }), maxD = Math.max.apply(null, perDay.concat([1]));
    return (nw.length ? '<div class="alert-new">' + icon('bell', 20) + '<div><b>' + nw.length + ' new order' + (nw.length > 1 ? 's' : '') + '</b> since you last checked: ' + nw.slice(0, 3).map(function (x) { return h(x.orderId + ' (' + x.name + ')'); }).join(', ') + (nw.length > 3 ? '...' : '') + '</div><button class="btn sm" data-act="goadmin" data-tab="orders">View orders</button></div>' : '') +
      '<div class="kpis">' + kpis.map(function (k) { return '<div class="kpi tone-' + k[3] + '"><span class="kpi-ic">' + icon(k[0], 22) + '</span><div><small>' + k[1] + '</small><b>' + h(k[2]) + '</b>' + (k[4] ? '<em>' + h(k[4]) + '</em>' : '') + '</div></div>'; }).join('') + '</div>' +
      '<div class="dash-grid"><div class="card pad"><h3 class="card-t">Status breakdown</h3><div class="bars">' + App.STATUSES.map(function (s) {
        var n = o.filter(function (x) { return x.status === s; }).length;
        return '<button class="bar-row" data-a="filter-status" data-status="' + h(s) + '"><span class="bl">' + App.pill(s) + '</span><span class="bt"><i class="st-' + s.toLowerCase().replace(/\s+/g, '-') + '" style="width:' + Math.round(n / maxS * 100) + '%"></i></span><b>' + n + '</b></button>';
      }).join('') + '</div></div>' +
      '<div class="card pad"><h3 class="card-t">Orders - last 14 days</h3><div class="cols">' + perDay.map(function (n, i) {
        return '<div class="col" title="' + h(App.fmtDate(days[i]) + ': ' + n) + '"><span class="cv">' + (n || '') + '</span><i style="height:' + Math.max(3, Math.round(n / maxD * 100)) + '%"></i><small>' + days[i].slice(8) + '</small></div>';
      }).join('') + '</div></div>' +
      '<div class="card pad"><h3 class="card-t">By service type</h3><div class="bars">' + (cats.length ? cats.map(function (k) {
        return '<div class="bar-row"><span class="bl txt">' + h(k) + '</span><span class="bt"><i style="width:' + Math.round(byCat[k].n / maxC * 100) + '%"></i></span><b>' + byCat[k].n + '</b></div>';
      }).join('') : '<p class="muted">No orders yet.</p>') + '</div></div>' +
      '<div class="card pad"><h3 class="card-t">Recent orders <button class="linkbtn" data-act="goadmin" data-tab="orders">View all</button></h3><div class="recent">' + (o.slice(0, 6).map(function (x) {
        return '<button class="rec" data-a="open-order" data-id="' + h(x.orderId) + '"><div><b>' + h(x.orderId) + '</b> ' + h(x.name) + (nw.indexOf(x) >= 0 ? ' <span class="badge">New</span>' : '') + '<small>' + h(x.itemName || x.serviceName) + ' · ' + App.ago(x.createdAt) + '</small></div>' + App.pill(x.status) + '</button>';
      }).join('') || '<p class="muted">No orders yet.</p>') + '</div></div></div>';
  }

  /* ============================== orders ============================== */
  function ordersTab() {
    var o = A.data.orders;
    return '<div class="card pad"><div class="toolbar"><label class="search">' + icon('search', 18) + '<input id="a-oq" type="search" placeholder="Search name, mobile, order no..." value="' + h(A.oq) + '"></label>' +
      '<button class="btn ghost sm" data-a="csv">' + icon('download', 16) + ' Export CSV</button></div>' +
      '<div class="chips scroll">' + ['All', 'Open'].concat(App.STATUSES).map(function (s) {
        var n = s === 'All' ? o.length : s === 'Open' ? o.filter(OPEN).length : o.filter(function (x) { return x.status === s; }).length;
        return '<button class="chip' + (A.ofilter === s ? ' on' : '') + '" data-a="ofilter" data-status="' + h(s) + '">' + h(s) + ' <span class="cnt">' + n + '</span></button>';
      }).join('') + '</div><div id="olist"></div></div>';
  }
  function filteredOrders() {
    var q = A.oq.toLowerCase().trim();
    return A.data.orders.filter(function (x) {
      if (A.ofilter === 'Open' && !OPEN(x)) return false;
      if (A.ofilter !== 'All' && A.ofilter !== 'Open' && x.status !== A.ofilter) return false;
      return !q || [x.orderId, x.name, x.mobile, x.email, x.itemName, x.serviceName, x.description, x.paymentRef, x.paymentStatus].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderOrderList() {
    var box = $('#olist'); if (!box) return;
    var list = filteredOrders(), nw = newOrders();
    box.innerHTML = list.length ? '<table class="rtable"><thead><tr><th>Order</th><th>Customer</th><th>Service</th><th>Status</th><th class="right">Bill</th><th class="right">Paid</th><th>Payment</th><th>Placed</th><th></th></tr></thead><tbody>' +
      list.map(function (x) {
        return '<tr data-a="open-order" data-id="' + h(x.orderId) + '"><td data-l="Order"><b>' + h(x.orderId) + '</b>' + (nw.indexOf(x) >= 0 ? ' <span class="badge">New</span>' : '') + '</td>' +
          '<td data-l="Customer">' + h(x.name) + '<small class="muted d-block">' + h(x.mobile) + '</small></td><td data-l="Service">' + h(x.itemName || x.serviceName) + (x.quantity > 1 ? ' <span class="muted">x' + h(x.quantity) + '</span>' : '') + '</td>' +
          '<td data-l="Status">' + App.pill(x.status) + '</td><td data-l="Bill" class="right">' + (x.amountQuoted ? money(x.amountQuoted) : (x.estimate ? '<span class="muted">~' + money(x.estimate) + '</span>' : '-')) + '</td>' +
          '<td data-l="Paid" class="right">' + (x.amountPaid ? money(x.amountPaid) : '-') + '</td><td data-l="Payment">' + payPill(x) + (x.paymentRef ? '<small class="muted d-block">UTR ' + h(x.paymentRef) + '</small>' : '') + '</td><td data-l="Placed">' + h(App.fmtDate(x.createdAt)) + '</td><td class="right act-c"><span class="btn ghost sm">Open</span></td></tr>';
      }).join('') + '</tbody></table>' : '<div class="empty">' + icon('list', 28) + '<p>No orders match.</p></div>';
  }
  function byId(id) { for (var i = 0; i < A.data.orders.length; i++) if (A.data.orders[i].orderId === id) return A.data.orders[i]; return null; }
  function waStatusText(o) {
    var S = site.S(), link = site.trackLink(o.orderId, o.trackKey);
    return 'Hello ' + o.name + ', this is ' + S.BUSINESS_NAME + '. Your order ' + o.orderId + ' (' + (o.itemName || o.serviceName) + ') is now: ' + o.status + '.' +
      (o.amountQuoted ? '\nBill: ' + money(o.amountQuoted) + ', Paid: ' + money(o.amountPaid) + ', Balance: ' + money(o.balance) + '.' : '') + (o.status === 'Ready' ? '\nPlease collect it from our shop.' : '') + (link ? '\nTrack: ' + link : '') + '\nThank you!';
  }
  function openOrder(id) {
    var o = byId(id); if (!o) return;
    A.detail = id;
    var mob = o.mobile;
    App.modal('<div class="modal-h"><div><h3>' + h(o.orderId) + ' ' + App.pill(o.status) + '</h3><small class="muted">' + h(App.fmtDateTime(o.createdAt)) + ' · ' + h(o.source || 'website') + '</small></div><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div>' +
      '<div class="modal-b od"><div class="od-l"><div class="cust"><span class="avatar">' + h((o.name || '?').charAt(0).toUpperCase()) + '</span><div><b>' + h(o.name) + '</b><small>' + h(mob) + (o.email ? ' · ' + h(o.email) : '') + '</small></div></div>' +
      '<div class="row">' + (mob ? '<a class="btn ghost sm" href="tel:+91' + h(mob) + '">' + icon('phone', 15) + ' Call</a><a class="btn wa sm" target="_blank" rel="noopener" href="' + h(App.waLink(mob, waStatusText(o))) + '">' + icon('chat', 15) + ' WhatsApp customer</a>' : '') +
      (o.email ? '<a class="btn ghost sm" href="mailto:' + h(o.email) + '?subject=' + encodeURIComponent('Order ' + o.orderId) + '">' + icon('mail', 15) + ' E-mail</a>' : '') +
      (o.trackKey ? '<button class="btn ghost sm" data-copy="' + h(site.trackLink(o.orderId, o.trackKey)) + '">' + icon('link', 15) + ' Tracking link</button>' : '') + '</div>' +
      '<dl class="kv"><dt>Payment</dt><dd>' + payPill(o) + ' ' + h(o.paymentMethod === 'PhonePe' ? 'PhonePe / UPI' : 'Cash on Delivery') + (o.paymentRef ? '<small class="muted d-block">UTR / transaction no: <b>' + h(o.paymentRef) + '</b></small>' : '') + '</dd>' +
      '<dt>Service</dt><dd>' + h(o.itemName || '-') + '<small class="muted d-block">' + h(o.serviceName) + '</small></dd><dt>Quantity</dt><dd>' + h(o.quantity) + (o.unitPrice ? ' × ' + money(o.unitPrice) + ' ' + h(o.unit) : '') + '</dd>' +
      (o.estimate ? '<dt>Estimate</dt><dd>' + money(o.estimate) + '</dd>' : '') + (o.description ? '<dt>Work</dt><dd>' + App.nl2br(o.description) + '</dd>' : '') +
      (o.preferredDate ? '<dt>Preferred</dt><dd>' + h(App.fmtDate(o.preferredDate)) + ' ' + h(App.fmtClock(o.preferredTime)) + '</dd>' : '') + (o.address ? '<dt>Address</dt><dd>' + h(o.address) + '</dd>' : '') +
      (o.customerEmail ? '<dt>Signed in as</dt><dd>' + h(o.customerEmail) + '</dd>' : '') + '</dl><h4 class="sub-h">Timeline</h4>' + site.timeline(o.timeline || []) + '</div>' +
      '<form class="od-r" id="uf" novalidate><h4 class="sub-h first">Update order</h4><div class="field"><label>Status</label><div class="status-pick">' + App.STATUSES.map(function (s) {
        return '<label class="sp' + (o.status === s ? ' on' : '') + '"><input type="radio" name="u-status" value="' + h(s) + '"' + (o.status === s ? ' checked' : '') + '>' + h(s) + '</label>';
      }).join('') + '</div></div>' +
      '<div class="grid2 keep"><div class="field"><label for="u-bill">Bill amount (₹)</label><input class="input" id="u-bill" type="number" min="0" step="1" inputmode="decimal" value="' + (o.amountQuoted || '') + '" placeholder="' + (o.estimate || '') + '"></div>' +
      '<div class="field"><label for="u-paid">Total paid (₹)</label><input class="input" id="u-paid" type="number" min="0" step="1" inputmode="decimal" value="' + (o.amountPaid || '') + '"></div></div>' +
      '<div class="field"><label for="u-pay">Payment status</label><select class="input" id="u-pay">' + PAY_STATUSES.map(function (s) { return '<option value="' + h(s) + '"' + ((o.paymentStatus || 'COD') === s ? ' selected' : '') + '>' + h(s === 'COD' ? 'COD - not paid yet' : s === 'Paid - verified' ? 'Paid (verified)' : s) + '</option>'; }).join('') + '</select>' +
        (o.paymentRef ? '<p class="hint">Check UTR <b>' + h(o.paymentRef) + '</b> in your PhonePe app, then choose "Paid (verified)" and fill "Total paid".</p>' : '') + '</div>' +
      '<div class="field"><label for="u-msg">Message to customer <span class="opt">(optional)</span></label><textarea class="input" id="u-msg" maxlength="1000" placeholder="e.g. Your laptop is ready. Please collect after 5 PM."></textarea></div>' +
      '<label class="check"><input type="checkbox" id="u-notify" checked> E-mail the customer about this update' + (o.email || o.customerEmail ? '' : ' <span class="muted">(no e-mail on this order)</span>') + '</label>' +
      '<label class="check"><input type="checkbox" id="u-internal"> Internal note only (customer will not see the message)</label>' +
      '<div class="field"><label for="u-notes">Private admin notes</label><textarea class="input" id="u-notes" maxlength="3000" placeholder="Only admins see this">' + h(o.adminNotes || '') + '</textarea></div>' +
      '<div class="err" id="u-err"></div><button class="btn block lg" id="u-save" type="submit">' + icon('check', 18) + ' Save update</button></form></div>', 'wide');
  }
  function saveOrder() {
    var o = byId(A.detail); if (!o) return;
    var stEl = document.querySelector('input[name="u-status"]:checked');
    var p = { orderId: o.orderId, rev: o.updatedAt, notify: $('#u-notify').checked, visible: !$('#u-internal').checked };
    if (stEl && stEl.value !== o.status) p.status = stEl.value;
    var bill = $('#u-bill').value.trim(), paid = $('#u-paid').value.trim(), msg = $('#u-msg').value.trim(), notes = $('#u-notes').value;
    if (bill !== '' && Number(bill) !== Number(o.amountQuoted)) { if (!(Number(bill) >= 0)) return ($('#u-err').textContent = 'Bill amount is not valid.'); p.amountQuoted = Number(bill); }
    if (paid !== '' && Number(paid) !== Number(o.amountPaid)) { if (!(Number(paid) >= 0)) return ($('#u-err').textContent = 'Paid amount is not valid.'); p.amountPaid = Number(paid); }
    if (msg) p.message = msg;
    if (notes !== (o.adminNotes || '')) p.adminNotes = notes;
    var pay = $('#u-pay') ? $('#u-pay').value : ''; if (pay && pay !== (o.paymentStatus || 'COD')) p.paymentStatus = pay;
    if (Object.keys(p).length <= 4) return ($('#u-err').textContent = 'Nothing changed. Change the status, payment, amounts, notes or type a message.');
    var btn = $('#u-save'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
    App.api('updateOrder', p).then(function (no) {
      for (var i = 0; i < A.data.orders.length; i++) if (A.data.orders[i].orderId === no.orderId) A.data.orders[i] = no;
      App.toast('Order ' + no.orderId + ' saved' + (no.notified ? ' - customer e-mailed' + (App.demo ? ' (demo)' : '') : '') + '.');
      App.renderAdmin(); openOrder(no.orderId);
      if (p.status && no.mobile && confirmWa()) window.open(App.waLink(no.mobile, waStatusText(no)), '_blank', 'noopener');
    }, function (e) {
      btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Save update';
      $('#u-err').textContent = e.message;
      if (e.code === 'CONFLICT') App.loadAdmin(true).then(function () { openOrder(o.orderId); });
    });
  }
  function confirmWa() { return false; } // keep it manual: use the "WhatsApp customer" button

  /* walk-in / phone order created by an admin */
  function newOrderModal() {
    var cat = A.data.catalogue;
    App.modal('<div class="modal-h"><h3>New order (walk-in / phone)</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b"><form id="nf" novalidate>' +
      '<div class="field"><label for="n-item">Service</label><select class="input" id="n-item">' + cat.categories.map(function (c) {
        return '<optgroup label="' + h(c.name) + '"><option value="cat:' + h(c.id) + '">' + h(c.name) + ' - other</option>' + cat.items.filter(function (i) { return i.category === c.id; }).map(function (i) { return '<option value="' + h(i.id) + '">' + h(i.name) + ' - ' + money(i.price) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></div>' +
      '<div class="grid2 keep"><div class="field"><label for="n-qty">Quantity</label><input class="input" id="n-qty" type="number" min="1" value="1"></div><div class="field"><label for="n-mobile">Mobile</label><input class="input" id="n-mobile" type="tel" inputmode="numeric" maxlength="14"></div></div>' +
      '<div class="grid2"><div class="field"><label for="n-name">Customer name</label><input class="input" id="n-name" maxlength="80"></div><div class="field"><label for="n-email">E-mail <span class="opt">(optional)</span></label><input class="input" id="n-email" type="email"></div></div>' +
      '<div class="field"><label for="n-desc">Work details</label><textarea class="input" id="n-desc" maxlength="2000"></textarea></div><div class="err" id="n-err"></div>' +
      '<button class="btn block" id="n-go" type="submit">' + icon('check', 18) + ' Create order</button></form></div>', 'narrow');
  }
  function saveNewOrder() {
    var v = $('#n-item').value, isCat = v.indexOf('cat:') === 0, it = null;
    A.data.catalogue.items.forEach(function (i) { if (i.id === v) it = i; });
    var p = { asAdmin: true, service: isCat ? v.slice(4) : (it && it.category), itemId: isCat ? '' : v, quantity: $('#n-qty').value, name: $('#n-name').value.trim(), mobile: $('#n-mobile').value, email: $('#n-email').value.trim(),
      description: $('#n-desc').value.trim() || (it ? it.name : 'Walk-in order'), clientRef: App.uid('a') };
    var btn = $('#n-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
    App.api('createOrder', p).then(function (res) {
      App.toast('Order ' + res.orderId + ' created'); App.closeModal();
      App.loadAdmin(true).then(function () { A.tab = 'orders'; site.go('admin', 'orders'); setTimeout(function () { openOrder(res.orderId); }, 60); });
    }, function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Create order'; $('#n-err').textContent = e.message; });
  }
  function exportCsv() {
    var cols = ['orderId', 'createdAt', 'status', 'name', 'mobile', 'email', 'serviceName', 'itemName', 'quantity', 'estimate', 'amountQuoted', 'amountPaid', 'balance', 'paymentMethod', 'paymentStatus', 'paymentRef', 'description', 'address', 'adminNotes'];
    var cell = function (v) { v = String(v === null || v === undefined ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = [cols.join(',')].concat(filteredOrders().map(function (o) { return cols.map(function (c) { return cell(o[c]); }).join(','); })).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'orders-' + App.ymd(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ============================== catalogue editor ============================== */
  function D() { return A.draft; }
  function catName(id) { var c = D().categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : '(no category)'; }
  function catalogueTab() {
    var d = D();
    return (A.dirty ? '<div class="savebar">' + icon('info', 18) + '<span>You have unsaved catalogue changes.</span><button class="btn ghost sm" data-a="cat-discard">Discard</button><button class="btn sm green" data-a="cat-save">' + icon('check', 16) + ' Save catalogue</button></div>' : '') +
      '<div class="cat-admin"><div class="card pad"><h3 class="card-t">Categories <button class="btn sm" data-a="cat-add">' + icon('plus', 15) + ' Add</button></h3><ul class="clist">' +
      d.categories.map(function (c, i) {
        var n = d.items.filter(function (x) { return x.category === c.id; }).length;
        return '<li class="' + (c.active === false ? 'off' : '') + '"><span class="c-ic tone-' + h(c.tone || 'blue') + '">' + icon(c.icon, 18) + '</span><div class="c-t"><b>' + h(c.name) + '</b><small>' + n + ' services' + (c.active === false ? ' · hidden' : '') + '</small></div>' +
          '<div class="c-act"><button class="icon-btn sm" data-a="cat-up" data-i="' + i + '" title="Move up"' + (i ? '' : ' disabled') + '>' + icon('up', 16) + '</button><button class="icon-btn sm" data-a="cat-down" data-i="' + i + '" title="Move down"' + (i < d.categories.length - 1 ? '' : ' disabled') + '>' + icon('down', 16) + '</button>' +
          '<button class="icon-btn sm" data-a="cat-toggle" data-i="' + i + '" title="' + (c.active === false ? 'Show' : 'Hide') + '">' + icon(c.active === false ? 'eyeoff' : 'eye', 16) + '</button><button class="icon-btn sm" data-a="cat-edit" data-i="' + i + '" title="Edit">' + icon('edit', 16) + '</button>' +
          '<button class="icon-btn sm danger" data-a="cat-del" data-i="' + i + '" title="Delete">' + icon('trash', 16) + '</button></div></li>';
      }).join('') + '</ul></div>' +
      '<div class="card pad"><h3 class="card-t">Services &amp; prices <span class="row"><button class="btn ghost sm" data-a="bulk-open">' + icon('download', 15) + ' Bulk upload (Excel / paste)</button><button class="btn sm" data-a="item-add">' + icon('plus', 15) + ' Add service</button></span></h3>' +
      '<div class="toolbar"><select class="input sm-in" id="a-ccat"><option value="all">All categories (' + d.items.length + ')</option>' + d.categories.map(function (c) { return '<option value="' + h(c.id) + '"' + (A.ccat === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('') + '</select>' +
      '<label class="search">' + icon('search', 18) + '<input id="a-cq" type="search" placeholder="Search services..." value="' + h(A.cq || '') + '"></label></div><div id="citems"></div></div></div>';
  }
  function renderCatItems() {
    var box = $('#citems'); if (!box) return;
    var d = D(), q = (A.cq || '').toLowerCase();
    var list = d.items.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) { return (A.ccat === 'all' || x.it.category === A.ccat) && (!q || (x.it.name + ' ' + x.it.desc).toLowerCase().indexOf(q) >= 0); });
    box.innerHTML = list.length ? '<table class="rtable items-t"><thead><tr><th>Service</th><th>Category</th><th class="right">Price</th><th>Visible</th><th>Popular</th><th></th></tr></thead><tbody>' + list.map(function (x) {
      var it = x.it;
      return '<tr class="' + (it.active === false ? 'off' : '') + '"><td data-l="Service"><b>' + h(it.name) + '</b><small class="muted d-block">' + h(it.desc || '') + '</small></td><td data-l="Category">' + h(catName(it.category)) + '</td>' +
        '<td data-l="Price" class="right nowrap"><b>' + money(it.price) + '</b><small class="muted d-block">' + h(it.unit || '') + '</small></td>' +
        '<td data-l="Visible"><label class="switch"><input type="checkbox" data-a2="item-active" data-i="' + x.i + '"' + (it.active !== false ? ' checked' : '') + '><span></span></label></td>' +
        '<td data-l="Popular"><label class="switch"><input type="checkbox" data-a2="item-popular" data-i="' + x.i + '"' + (it.popular ? ' checked' : '') + '><span></span></label></td>' +
        '<td class="right act-c nowrap"><button class="btn ghost sm" data-a="item-edit" data-i="' + x.i + '">' + icon('edit', 15) + ' Edit</button> <button class="icon-btn sm danger" data-a="item-del" data-i="' + x.i + '" title="Delete">' + icon('trash', 16) + '</button></td></tr>';
    }).join('') + '</tbody></table>' : '<div class="empty">' + icon('layers', 28) + '<p>No services here yet.</p></div>';
  }
  function dirty() { A.dirty = true; App.renderAdmin(); }
  function itemModal(i) {
    var d = D(), it = i === -1 ? { id: '', category: A.ccat !== 'all' ? A.ccat : (d.categories[0] || {}).id, name: '', price: '', unit: 'per item', desc: '', active: true, popular: false, onsite: false } : d.items[i];
    App.modal('<div class="modal-h"><h3>' + (i === -1 ? 'Add service' : 'Edit service') + '</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b"><form id="if" data-i="' + i + '" novalidate>' +
      '<div class="field"><label for="i-name">Service name</label><input class="input" id="i-name" maxlength="120" value="' + h(it.name) + '"></div>' +
      '<div class="field"><label for="i-cat">Category</label><select class="input" id="i-cat">' + d.categories.map(function (c) { return '<option value="' + h(c.id) + '"' + (c.id === it.category ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="grid2 keep"><div class="field"><label for="i-price">Price (₹)</label><input class="input" id="i-price" type="number" min="0" step="1" inputmode="decimal" value="' + h(it.price) + '"></div>' +
      '<div class="field"><label for="i-unit">Unit</label><input class="input" id="i-unit" maxlength="40" list="units" value="' + h(it.unit || '') + '"><datalist id="units"><option>per page<option>per device<option>per item<option>per visit<option>per camera<option>per sq.ft<option>per book<option>complete<option>starting from</datalist></div></div>' +
      '<div class="field"><label for="i-desc">Short description</label><textarea class="input" id="i-desc" maxlength="600">' + h(it.desc || '') + '</textarea></div>' +
      '<label class="check"><input type="checkbox" id="i-active"' + (it.active !== false ? ' checked' : '') + '> Visible on website</label>' +
      '<label class="check"><input type="checkbox" id="i-popular"' + (it.popular ? ' checked' : '') + '> Mark as popular</label>' +
      '<label class="check"><input type="checkbox" id="i-onsite"' + (it.onsite ? ' checked' : '') + '> On-site service (ask customer for address)</label>' +
      '<div class="err" id="i-err"></div><button class="btn block" type="submit">' + icon('check', 18) + ' Done</button><p class="hint center">Remember to press "Save catalogue" after editing.</p></form></div>', 'narrow');
  }
  function saveItemModal(form) {
    var i = Number(form.getAttribute('data-i')), d = D();
    var it = { name: $('#i-name').value.trim(), category: $('#i-cat').value, price: Number($('#i-price').value), unit: $('#i-unit').value.trim(), desc: $('#i-desc').value.trim(),
      active: $('#i-active').checked, popular: $('#i-popular').checked, onsite: $('#i-onsite').checked };
    if (it.name.length < 2) return ($('#i-err').textContent = 'Please enter a service name.');
    if (!(it.price >= 0) || $('#i-price').value === '') return ($('#i-err').textContent = 'Please enter a price (0 or more).');
    if (i === -1) { it.id = (it.category || 'x').slice(0, 3) + '-' + App.slug(it.name).slice(0, 18) + '-' + Date.now().toString(36).slice(-4); d.items.push(it); }
    else { it.id = d.items[i].id; d.items[i] = it; }
    App.closeModal(); dirty();
  }
  function catModal(i) {
    var c = i === -1 ? { id: '', name: '', desc: '', icon: 'layers', tone: 'blue', active: true } : D().categories[i];
    App.modal('<div class="modal-h"><h3>' + (i === -1 ? 'Add category' : 'Edit category') + '</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b"><form id="cf" data-i="' + i + '" novalidate>' +
      '<div class="field"><label for="c-name">Category name</label><input class="input" id="c-name" maxlength="80" value="' + h(c.name) + '"></div>' +
      '<div class="field"><label for="c-desc">Short description</label><textarea class="input" id="c-desc" maxlength="400">' + h(c.desc || '') + '</textarea></div>' +
      '<div class="field"><label>Icon</label><div class="icon-pick">' + App.ICONS_FOR_CATEGORIES.map(function (n) { return '<label class="ip' + (c.icon === n ? ' on' : '') + '"><input type="radio" name="c-icon" value="' + n + '"' + (c.icon === n ? ' checked' : '') + '>' + icon(n, 22) + '</label>'; }).join('') + '</div></div>' +
      '<div class="field"><label>Colour</label><div class="icon-pick">' + App.TONES.map(function (t) { return '<label class="ip tone-' + t + (c.tone === t ? ' on' : '') + '"><input type="radio" name="c-tone" value="' + t + '"' + (c.tone === t ? ' checked' : '') + '><span class="swatch"></span></label>'; }).join('') + '</div></div>' +
      '<label class="check"><input type="checkbox" id="c-active"' + (c.active !== false ? ' checked' : '') + '> Visible on website</label>' +
      '<div class="err" id="c-err"></div><button class="btn block" type="submit">' + icon('check', 18) + ' Done</button></form></div>', 'narrow');
  }
  function saveCatModal(form) {
    var i = Number(form.getAttribute('data-i')), d = D(), pick = function (n) { var e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
    var c = { name: $('#c-name').value.trim(), desc: $('#c-desc').value.trim(), icon: pick('c-icon') || 'layers', tone: pick('c-tone') || 'blue', active: $('#c-active').checked };
    if (c.name.length < 2) return ($('#c-err').textContent = 'Please enter a category name.');
    if (i === -1) { c.id = App.slug(c.name) || ('cat' + Date.now().toString(36)); while (d.categories.some(function (x) { return x.id === c.id; })) c.id += '1'; d.categories.push(c); }
    else { c.id = d.categories[i].id; d.categories[i] = c; }
    App.closeModal(); dirty();
  }
  function saveCatalogue() {
    var btn = root().querySelector('[data-a="cat-save"]'); if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...'; }
    App.api('saveCatalogue', { categories: D().categories, items: D().items }).then(function (cat) {
      A.data.catalogue = cat; A.draft = JSON.parse(JSON.stringify(cat)); A.dirty = false;
      App.toast('Catalogue saved. The website now shows the new prices.');
      site.refreshPublic().then(function () { App.renderAdmin(); });
    }, function (e) { App.toast(e.message, 'err'); App.renderAdmin(); });
  }
  function root() { return document.getElementById('app'); }

  /* ============================== bulk upload (Excel / CSV / paste) ============================== */
  // Columns of the bulk-upload template (assets/items-template.csv / "Excel template" button). Only Item Name, Category and Price are required.
  var BULK_COLS = [
    ['name', 'Item Name', /^(item|service|product)?\s*name$|^item$|^service$/],
    ['category', 'Category', /^categ/],
    ['price', 'Price (Rs)', /price|cost|rate|amount|₹/],
    ['unit', 'Unit', /^unit|^per$/],
    ['active', 'Available (Yes/No)', /avail|stock|active|visible|show/],
    ['desc', 'Description', /^desc|details/],
    ['popular', 'Popular (Yes/No)', /popular/],
    ['onsite', 'On-site (Yes/No)', /on.?site/]
  ];
  var SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var xlsxLib = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLib) xlsxLib = new Promise(function (ok, no) {
      var sc = document.createElement('script'); sc.src = SHEETJS; sc.onload = function () { ok(window.XLSX); }; sc.onerror = function () { xlsxLib = null; no(new Error('Could not load the Excel reader. Check your internet, or save the file as CSV / paste the rows instead.')); };
      document.head.appendChild(sc);
    });
    return xlsxLib;
  }
  // CSV / tab-separated text -> rows of cells (handles "quoted, values")
  function parseText(text) {
    text = String(text || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    var first = text.split('\n')[0] || '', sep = first.indexOf('\t') >= 0 ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (q) { if (ch === '"') { if (text.charAt(i + 1) === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"' && cell === '') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function yesNo(v) {
    var t = String(v === undefined || v === null ? '' : v).trim().toLowerCase();
    if (t === '') return '';
    if (/^(y|yes|true|1|available|in stock|show|visible)$/.test(t)) return true;
    if (/^(n|no|false|0|not available|out of stock|hide|hidden)$/.test(t)) return false;
    return null;   // not understood
  }
  // rows of cells -> checked items for the preview
  function rowsToItems(rows) {
    rows = rows.filter(function (r) { return r && r.some(function (c) { return String(c === undefined || c === null ? '' : c).trim() !== ''; }); });
    if (!rows.length) return [];
    var map = BULK_COLS.map(function (c, i) { return i; }), head = rows[0].map(function (c) { return String(c || '').trim().toLowerCase(); });
    var hasHead = head.some(function (c) { return /name|categ|price|cost/.test(c); }) && !head.some(function (c) { return /^\s*[₹rs.\s]*[\d,]+(\.\d+)?\s*$/.test(c); });
    if (hasHead) {
      map = BULK_COLS.map(function (c) { for (var i = 0; i < head.length; i++) if (c[2].test(head[i])) return i; return -1; });
      if (map[0] < 0) map[0] = head.findIndex(function (x) { return /name|item|service/.test(x); });
      rows = rows.slice(1);
    }
    var cats = A.data.catalogue.categories, items = A.data.catalogue.items, seen = {};
    return rows.map(function (r, n) {
      var g = function (k) { var i = map[k]; var v = i >= 0 ? r[i] : ''; return String(v === undefined || v === null ? '' : v).trim(); };
      var it = { line: n + 1 + (hasHead ? 1 : 0), name: g(0), category: g(1), unit: g(3), desc: g(5), errs: [] };
      var pr = g(2).replace(/[₹,\s]|rs\.?|inr|\/-/gi, '');
      it.price = pr === '' ? NaN : Number(pr);
      ['active', 'popular', 'onsite'].forEach(function (k, j) { var v = yesNo(g([4, 6, 7][j])); if (v === null) it.errs.push(BULK_COLS[[4, 6, 7][j]][1] + ' must be Yes or No'); else it[k] = v; });
      if (it.name.length < 2) it.errs.push('Item name missing');
      if (!it.category) it.errs.push('Category missing');
      if (!(it.price >= 0)) it.errs.push('Price must be a number');
      var key = it.name.toLowerCase();
      if (seen[key]) it.errs.push('Same name as line ' + seen[key]); else seen[key] = it.line;
      it.isNewCat = !!it.category && !cats.some(function (c) { return c.name.toLowerCase() === it.category.toLowerCase() || c.id.toLowerCase() === it.category.toLowerCase(); });
      it.isUpdate = items.some(function (x) { return String(x.name).toLowerCase() === key; });
      return it;
    });
  }
  function bulkModal() {
    if (A.dirty) { App.toast('Please save or discard your catalogue changes first.', 'err'); return; }
    A.bulk = A.bulk || { rows: [], text: '' };
    App.modal('<div class="modal-h"><h3>Bulk upload items &amp; prices</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b bulk">' +
      '<p class="muted small">Add many services at once. A row whose <b>Item Name</b> already exists updates that service (price, category and the other filled columns); other rows are added as new services. A new category name creates a new category.</p>' +
      '<div class="note"><span>' + icon('info', 16) + ' Columns: <b>' + BULK_COLS.map(function (c) { return h(c[1]); }).join(', ') + '</b>. Only the first three are required.</span>' +
      '<span class="row"><button class="btn ghost sm" type="button" data-a="bulk-template">' + icon('download', 15) + ' Excel template</button><a class="btn ghost sm" href="assets/items-template.csv" download>' + icon('download', 15) + ' CSV template</a><button class="btn ghost sm" type="button" data-a="bulk-export">' + icon('download', 15) + ' Current price list</button></span></div>' +
      '<div class="grid2"><div class="field"><label for="b-file">1. Upload an Excel or CSV file</label><input class="input" id="b-file" type="file" accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"></div>' +
      '<div class="field"><label for="b-text">2. ...or paste rows (copy from Excel / Google Sheets)</label><textarea class="input" id="b-text" rows="4" placeholder="Item Name\tCategory\tPrice (Rs)\tUnit\nColour print (A3)\tPrinting (B/W &amp; Colour)\t30\tper page">' + h(A.bulk.text) + '</textarea><button class="btn ghost sm" type="button" data-a="bulk-paste" style="margin-top:8px">' + icon('check', 15) + ' Check pasted rows</button></div></div>' +
      '<div class="err" id="b-err"></div><div id="b-prev"></div></div>', 'wide');
    renderBulkPreview();
  }
  function renderBulkPreview() {
    var box = $('#b-prev'); if (!box) return;
    var rows = A.bulk.rows; if (!rows.length) { box.innerHTML = ''; return; }
    var ok = rows.filter(function (r) { return !r.errs.length; }), bad = rows.length - ok.length;
    var nAdd = ok.filter(function (r) { return !r.isUpdate; }).length, nUpd = ok.length - nAdd;
    var newCats = {}; ok.forEach(function (r) { if (r.isNewCat) newCats[r.category] = 1; });
    var yn = function (v) { return v === '' || v === undefined ? '<span class="muted">-</span>' : v ? 'Yes' : 'No'; };
    box.innerHTML = '<h4 class="sub-h">Preview: ' + rows.length + ' rows - <span class="ok-t">' + nAdd + ' new</span>, <span class="ok-t">' + nUpd + ' update</span>' + (bad ? ', <span class="bad-t">' + bad + ' with errors (will be skipped)</span>' : '') + '</h4>' +
      (Object.keys(newCats).length ? '<p class="hint">New categories will be created: ' + Object.keys(newCats).map(h).join(', ') + '</p>' : '') +
      '<div class="prev-wrap"><table class="rtable bulk-t"><thead><tr><th>#</th><th>Item name</th><th>Category</th><th class="right">Price</th><th>Unit</th><th>Available</th><th>Result</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="' + (r.errs.length ? 'bad-r' : '') + '"><td data-l="Line">' + r.line + '</td><td data-l="Item"><b>' + h(r.name || '-') + '</b>' + (r.desc ? '<small class="muted d-block">' + h(r.desc) + '</small>' : '') + '</td>' +
          '<td data-l="Category">' + h(r.category || '-') + (r.isNewCat ? ' <span class="tag">new</span>' : '') + '</td><td data-l="Price" class="right">' + (r.price >= 0 ? money(r.price) : '-') + '</td><td data-l="Unit">' + h(r.unit || '-') + '</td><td data-l="Available">' + yn(r.active) + '</td>' +
          '<td data-l="Result">' + (r.errs.length ? '<span class="bad-t">' + h(r.errs.join('; ')) + '</span>' : r.isUpdate ? '<span class="tag">Update</span>' : '<span class="tag pop">New</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row end" style="margin-top:14px"><button class="btn ghost" data-a="bulk-clear">Clear</button><button class="btn green" data-a="bulk-save"' + (ok.length ? '' : ' disabled') + '>' + icon('check', 17) + ' Save ' + ok.length + ' item' + (ok.length === 1 ? '' : 's') + ' to website</button></div>';
  }
  function bulkFile(file) {
    var err = $('#b-err'); err.textContent = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { err.textContent = 'The file is too big (5 MB at most).'; return; }
    var isCsv = /\.(csv|txt)$/i.test(file.name);
    var rd = new FileReader();
    rd.onload = function () {
      if (isCsv) { A.bulk.rows = rowsToItems(parseText(rd.result)); return afterParse(); }
      loadXlsx().then(function (X) {
        var wb = X.read(new Uint8Array(rd.result), { type: 'array' });
        var name = wb.SheetNames.filter(function (n) { return !/instruction|help|read ?me/i.test(n); })[0] || wb.SheetNames[0];
        A.bulk.rows = rowsToItems(X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' })); afterParse();
      }).catch(function (e) { err.textContent = e.message || 'Could not read this file.'; });
    };
    rd.onerror = function () { err.textContent = 'Could not read this file.'; };
    if (isCsv) rd.readAsText(file); else rd.readAsArrayBuffer(file);
  }
  function afterParse() {
    if (!A.bulk.rows.length) $('#b-err').textContent = 'No rows found. Use the template columns: ' + BULK_COLS.slice(0, 3).map(function (c) { return c[1]; }).join(', ') + '.';
    renderBulkPreview();
  }
  function bulkSave() {
    var ok = A.bulk.rows.filter(function (r) { return !r.errs.length; });
    var rows = ok.map(function (r) { var o = { name: r.name, category: r.category, price: r.price, unit: r.unit, desc: r.desc }; ['active', 'popular', 'onsite'].forEach(function (k) { if (r[k] !== '' && r[k] !== undefined) o[k] = r[k]; }); return o; });
    var btn = root().querySelector('[data-a="bulk-save"]'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
    var done = function (r) {
      A.data.catalogue = r.catalogue; A.draft = JSON.parse(JSON.stringify(r.catalogue)); A.dirty = false; A.bulk = null;
      App.closeModal(); App.toast('Saved: ' + r.added + ' new, ' + r.updated + ' updated' + (r.newCategories.length ? ', ' + r.newCategories.length + ' new categor' + (r.newCategories.length > 1 ? 'ies' : 'y') : '') + '.');
      site.refreshPublic().then(function () { App.renderAdmin(); });
    };
    App.api('bulkUpsertItems', { rows: rows }).then(done, function (e) {
      if (e.code !== 'OLD_BACKEND') { btn.disabled = false; btn.innerHTML = icon('check', 17) + ' Try again'; $('#b-err').textContent = e.message; return; }
      // backend not redeployed yet: merge here and save the whole catalogue (same result)
      var m = window.DemoBackend.mergeItems(A.data.catalogue, rows);
      App.api('saveCatalogue', { categories: m.catalogue.categories, items: m.catalogue.items }).then(function (cat) { m.catalogue = cat; done(m); },
        function (e2) { btn.disabled = false; btn.innerHTML = icon('check', 17) + ' Try again'; $('#b-err').textContent = e2.message; });
    });
  }
  // Excel template, made in the browser (same columns and samples as assets/items-template.csv)
  function bulkTemplate() {
    var data = [BULK_COLS.map(function (c) { return c[1]; }),
      ['B/W xerox (A4)', 'Xerox & Binding', 2, 'per page', 'Yes', 'Single side. Both sides Rs 3.', 'Yes', 'No'],
      ['Colour print (A3)', 'Printing (B/W & Colour)', 30, 'per page', 'Yes', 'High quality colour on 130 GSM paper.', 'No', 'No'],
      ['Wi-Fi router setup', 'Networking & Wi-Fi', 300, 'per router', 'Yes', 'Router configuration and password security.', 'Yes', 'Yes'],
      ['USB pen drive 32 GB', 'Accessories', 450, 'per item', 'Yes', 'New category example: this creates "Accessories".', 'No', 'No']];
    var help = [['How to fill the "Items" sheet'], [''],
      ['Item Name', 'Required. If the name already exists on the website, that item is UPDATED; otherwise it is ADDED.'],
      ['Category', 'Required. Existing category name (' + A.data.catalogue.categories.map(function (c) { return c.name; }).join(', ') + '). A new name creates a new category.'],
      ['Price (Rs)', 'Required. Number only, e.g. 250.'], ['Unit', 'Optional, e.g. per page, per item, per device, per visit.'],
      ['Available (Yes/No)', 'Optional. No = hidden from the website. Empty = Yes for new items / unchanged for existing ones.'],
      ['Description', 'Optional. Short text shown under the name.'], ['Popular (Yes/No)', 'Optional. Yes shows a "Popular" tag.'],
      ['On-site (Yes/No)', 'Optional. Yes asks the customer for an address.'], [''],
      ['Delete the sample rows before uploading. Only the "Items" sheet is read.'], ['Upload: Admin > Catalogue > Bulk upload (Excel / paste).']];
    loadXlsx().then(function (X) {
      var ws = X.utils.aoa_to_sheet(data); ws['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 11 }, { wch: 16 }, { wch: 18 }, { wch: 60 }, { wch: 16 }, { wch: 16 }];
      var hs = X.utils.aoa_to_sheet(help); hs['!cols'] = [{ wch: 22 }, { wch: 110 }];
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Items'); X.utils.book_append_sheet(wb, hs, 'Instructions'); X.writeFile(wb, 'items-template.xlsx');
    }).catch(function (e) { App.toast(e.message, 'err'); });
  }
  function bulkExport() {
    var cat = A.data.catalogue, name = function (id) { var c = cat.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; };
    var yn = function (v) { return v ? 'Yes' : 'No'; };
    var data = [BULK_COLS.map(function (c) { return c[1]; })].concat(cat.items.map(function (i) { return [i.name, name(i.category), Number(i.price) || 0, i.unit || '', yn(i.active !== false), i.desc || '', yn(i.popular), yn(i.onsite)]; }));
    loadXlsx().then(function (X) {
      var ws = X.utils.aoa_to_sheet(data); ws['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 11 }, { wch: 16 }, { wch: 18 }, { wch: 60 }, { wch: 16 }, { wch: 16 }];
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Items'); X.writeFile(wb, 'price-list-' + App.ymd(new Date()) + '.xlsx');
    }).catch(function (e) { App.toast(e.message, 'err'); });
  }

  /* ============================== settings ============================== */
  function settingsTab() {
    var S = site.S(), s = A.data.settings || {}, ch = A.data.channels || {};
    var chan = [['E-mail (Gmail, free)', ch.email, 'Admins get new orders; customers get confirmations & status updates.'], ['CallMeBot WhatsApp alert to admin (free)', ch.callmebot, 'Script property CALLMEBOT_PHONE + CALLMEBOT_APIKEY'],
      ['WhatsApp Cloud API to customers (Meta, paid per message)', ch.whatsappCloud, 'Script properties WA_CLOUD_TOKEN + WA_CLOUD_PHONE_ID'], ['Fast2SMS SMS to customers (paid)', ch.fast2sms, 'Script property FAST2SMS_APIKEY']];
    return '<div class="set-grid"><form class="card pad" id="sf" novalidate><h3 class="card-t">Shop details</h3><p class="muted small" style="margin-bottom:14px">Shown on the website. Leave a box empty to use the value from config.js.</p><div class="grid2">' +
      SETTINGS_FIELDS.map(function (f) {
        var v = s[f[0]] !== undefined ? s[f[0]] : '', ph = S[f[0]] && !s[f[0]] ? String(S[f[0]]) : '';
        return '<div class="field' + (f[2] ? ' span2' : '') + '"><label for="s-' + f[0] + '">' + h(f[1]) + '</label>' + (f[2] ? '<textarea class="input" id="s-' + f[0] + '" placeholder="' + h(ph) + '">' + h(v) + '</textarea>' : '<input class="input" id="s-' + f[0] + '" value="' + h(v) + '" placeholder="' + h(ph) + '">') + '</div>';
      }).join('') + '</div><button class="btn" type="submit" id="s-go">' + icon('check', 18) + ' Save settings</button></form>' +
      '<div><div class="card pad"><h3 class="card-t">Notifications</h3><ul class="chan">' + chan.map(function (c) { return '<li><span class="dotc ' + (c[1] ? 'on' : '') + '"></span><div><b>' + c[0] + '</b><small>' + (c[1] ? 'On' : 'Off') + ' · ' + c[2] + '</small></div></li>'; }).join('') + '</ul>' +
      (A.data.emailQuota !== undefined ? '<p class="hint">E-mails left today: ' + h(A.data.emailQuota) + '</p>' : '') + '<button class="btn ghost sm" data-a="test-mail">' + icon('mail', 15) + ' Send me a test e-mail</button></div>' +
      '<div class="card pad"><h3 class="card-t">Admins</h3><ul class="ticks">' + (A.data.admins || []).map(function (e) { return '<li>' + icon('shield', 15) + ' ' + h(e) + '</li>'; }).join('') + '</ul><p class="hint">To change admins, edit ADMIN_EMAILS in apps-script/Code.gs and config.js, then deploy a new version.</p></div>' +
      (App.demo ? '<div class="card pad"><h3 class="card-t">Demo notification log</h3>' + ((A.data.outbox || []).length ? '<ul class="outbox">' + A.data.outbox.slice(0, 12).map(function (m) { return '<li><b>' + h(m.subject) + '</b><small>' + h(m.via) + ' to ' + h(m.to) + ' · ' + App.ago(m.at) + '</small></li>'; }).join('') + '</ul>' : '<p class="muted">No messages yet. Place an order to see one.</p>') +
        '<button class="btn red sm" data-a="demo-reset">' + icon('refresh', 15) + ' Reset demo data</button></div>' : '') + '</div></div>';
  }
  function saveSettings() {
    var s = {}; SETTINGS_FIELDS.forEach(function (f) { s[f[0]] = $('#s-' + f[0]).value.trim(); });
    var btn = $('#s-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
    App.api('saveSettings', { settings: s }).then(function (ns) {
      A.data.settings = ns; App.toast('Settings saved.');
      site.refreshPublic().then(function () { App.renderAdmin(); });
    }, function (e) { btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Save settings'; App.toast(e.message, 'err'); });
  }

  /* ============================== events ============================== */
  App.adminClick = function (t, ev) {
    var a = t.getAttribute('data-a'), i = Number(t.getAttribute('data-i')), d = A.draft;
    switch (a) {
      case 'reload': A.err = ''; A.data = A.dirty ? A.data : null; App.loadAdmin(); break;
      case 'open-order': openOrder(t.getAttribute('data-id')); break;
      case 'filter-status': A.ofilter = t.getAttribute('data-status'); site.go('admin', 'orders'); break;
      case 'ofilter': A.ofilter = t.getAttribute('data-status'); root().querySelectorAll('[data-a="ofilter"]').forEach(function (c) { c.classList.toggle('on', c === t); }); renderOrderList(); break;
      case 'new-order': newOrderModal(); break;
      case 'csv': exportCsv(); break;
      case 'cat-add': catModal(-1); break;
      case 'cat-edit': catModal(i); break;
      case 'cat-up': if (i > 0) { var x = d.categories.splice(i, 1)[0]; d.categories.splice(i - 1, 0, x); dirty(); } break;
      case 'cat-down': if (i < d.categories.length - 1) { var y = d.categories.splice(i, 1)[0]; d.categories.splice(i + 1, 0, y); dirty(); } break;
      case 'cat-toggle': d.categories[i].active = d.categories[i].active === false; dirty(); break;
      case 'cat-del': {
        var c = d.categories[i], n = d.items.filter(function (z) { return z.category === c.id; }).length;
        if (n) { App.toast('Move or delete the ' + n + ' services in "' + c.name + '" first, or hide the category instead.', 'err'); break; }
        if (window.confirm('Delete category "' + c.name + '"?')) { d.categories.splice(i, 1); dirty(); }
        break;
      }
      case 'item-add': itemModal(-1); break;
      case 'item-edit': itemModal(i); break;
      case 'item-del': if (window.confirm('Delete "' + d.items[i].name + '"?')) { d.items.splice(i, 1); dirty(); } break;
      case 'cat-save': saveCatalogue(); break;
      case 'bulk-open': bulkModal(); break;
      case 'bulk-paste': A.bulk.text = $('#b-text').value; $('#b-err').textContent = ''; A.bulk.rows = rowsToItems(parseText(A.bulk.text)); afterParse(); break;
      case 'bulk-clear': A.bulk = { rows: [], text: '' }; bulkModal(); break;
      case 'bulk-save': bulkSave(); break;
      case 'bulk-export': bulkExport(); break;
      case 'bulk-template': bulkTemplate(); break;
      case 'cat-discard': A.draft = JSON.parse(JSON.stringify(A.data.catalogue)); A.dirty = false; App.renderAdmin(); break;
      case 'test-mail': App.api('testNotify', {}).then(function (r) { App.toast('Test e-mail sent to ' + r.sentTo + (App.demo ? ' (demo)' : '')); if (App.demo) App.loadAdmin(true); }, function (e) { App.toast(e.message, 'err'); }); break;
      case 'demo-reset': if (window.confirm('Reset all demo orders and catalogue?')) { window.DemoBackend.reset(); App.store.del('oss_public_cache_demo'); App.store.del((App.demo ? 'oss_admin_seen_demo' : 'oss_admin_seen')); location.reload(); } break;
    }
  };
  App.adminChange = function (ev) {
    var t = ev.target, a2 = t.getAttribute('data-a2');
    if (a2 === 'item-active' || a2 === 'item-popular') { var it = A.draft.items[Number(t.getAttribute('data-i'))]; if (a2 === 'item-active') it.active = t.checked; else it.popular = t.checked; dirty(); return; }
    if (t.id === 'a-ccat') { A.ccat = t.value; renderCatItems(); return; }
    if (t.id === 'b-file') { bulkFile(t.files && t.files[0]); t.value = ''; return; }
    if (t.name === 'u-status') { document.querySelectorAll('.status-pick .sp').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); return; }
    if (t.name === 'c-icon' || t.name === 'c-tone') { document.querySelectorAll('input[name="' + t.name + '"]').forEach(function (r) { r.parentNode.classList.toggle('on', r.checked); }); }
  };
  App.adminInput = function (ev) {
    if (ev.target.id === 'a-oq') { A.oq = ev.target.value; renderOrderList(); }
    if (ev.target.id === 'a-cq') { A.cq = ev.target.value; renderCatItems(); }
  };
  App.adminSubmit = function (ev) {
    var id = ev.target.id;
    if (id === 'uf') saveOrder();
    else if (id === 'nf') saveNewOrder();
    else if (id === 'if') saveItemModal(ev.target);
    else if (id === 'cf') saveCatModal(ev.target);
    else if (id === 'sf') saveSettings();
  };
  App.editItem = function (id) {
    if (!A.draft) return;
    for (var i = 0; i < A.draft.items.length; i++) if (A.draft.items[i].id === id) return itemModal(i);
  };

  App.initAdmin = function () { site = App.site; A = site.st.admin; };
})();
