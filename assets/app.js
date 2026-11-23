/* YOUR ONE STOP SOLUTION - one page for customers and admins.
   Everyone sees the shop website. When an admin (see ADMIN_EMAILS) signs in,
   the same page shows admin tools: dashboard, orders, catalogue and settings. */
(function () {
  'use strict';
  var App = window.App, h = App.h, icon = App.icon, money = App.money;
  var K = function (k) { return App.demo ? k + '_demo' : k; };
  var PUBKEY = App.demo ? 'oss_public_cache_demo' : 'oss_public_cache';
  var root, S = {}, POLL = App.demo ? 15000 : 60000;
  var st = {
    cat: null, catSource: 'default', backendOld: false, apiVersion: '', filter: 'all', q: '', sort: 'default', only: '',
    form: { category: '', itemId: '', qty: 1, pay: 'COD' }, sending: false, clientRef: App.uid(),
    me: App.store.get('oss_me', { name: '', mobile: '', email: '' }),
    device: App.store.get(K('oss_my_orders'), []),        // [{orderId, key}]
    seen: App.store.get(K('oss_seen'), {}),               // orderId -> updatedAt the customer has seen
    my: [], myBusy: false, myErr: '', track: null, trackArgs: null,
    view: 'site', admin: { tab: 'dashboard', data: null, err: '', busy: false, ofilter: 'All', oq: '', draft: null, dirty: false, ccat: 'all' }
  };
  App.state = st;

  var $ = function (s) { return root.querySelector(s); };
  function nonEmpty(o) { var r = {}; Object.keys(o || {}).forEach(function (k) { if (o[k] !== '' && o[k] !== null && o[k] !== undefined) r[k] = o[k]; }); return r; }
  function applySettings(s) {
    S = Object.assign({}, App.cfg, nonEmpty(s));
    S.PHONE = String(S.PHONE || '').replace(/\D/g, '').slice(-10);
    S.WHATSAPP = String(S.WHATSAPP || '').replace(/\D/g, '').slice(-10);
    S.PHONEPE_NUMBER = String(S.PHONEPE_NUMBER || '').replace(/\D/g, '').slice(-10);
  }
  /* ============================== payment (PhonePe / UPI) ============================== */
  function payOn() { return !!(S.PHONEPE_NUMBER || S.UPI_ID); }
  function upiLink(amount, note) {
    if (!S.UPI_ID) return '';
    return 'upi://pay?pa=' + encodeURIComponent(S.UPI_ID).replace(/%40/g, '@') + '&pn=' + encodeURIComponent(S.UPI_NAME || S.BUSINESS_NAME || 'Shop') +
      (amount > 0 ? '&am=' + (Math.round(amount * 100) / 100).toFixed(2) : '') + '&cu=INR' + (note ? '&tn=' + encodeURIComponent(note) : '');
  }
  // payment instructions box; amount may be 0 (= amount to be confirmed by the shop)
  function payBox(amount, note) {
    var link = upiLink(amount, note);
    return '<div class="paybox"><div class="pay-main"><span class="pay-ic">' + icon('phone', 20) + '</span><div><small>Pay to PhonePe number</small><b>' + h(S.PHONEPE_NUMBER || S.PHONE) + '</b>' +
      '<span class="muted small">' + (amount > 0 ? 'Amount: <b>' + money(amount) + '</b>' : 'Pay the amount the shop confirms') + (S.UPI_NAME ? ' · Name: ' + h(S.UPI_NAME) : '') + '</span></div>' +
      '<button class="btn ghost sm" type="button" data-copy="' + h(S.PHONEPE_NUMBER || S.PHONE) + '">Copy</button></div>' +
      (link ? '<div class="pay-alt"><div class="qr" data-qr="' + h(link) + '"></div><div><p class="small">Scan with PhonePe, Google Pay, Paytm or any UPI app' + (S.UPI_ID ? ' (UPI ID <code>' + h(S.UPI_ID) + '</code>)' : '') + ', or on your phone:</p>' +
        '<a class="btn sm" href="' + h(link) + '">' + icon('rupee', 16) + ' Open PhonePe / UPI app</a></div></div>' : '') +
      '<p class="hint">After paying, note the <b>UTR / transaction ID</b> shown in PhonePe (12 digits) and enter it below. The shop checks the payment and marks your order as paid.</p></div>';
  }
  // draw QR codes with the small qrcode-generator library (loaded only when needed)
  var qrLib = null;
  function drawQrs() {
    var nodes = root.querySelectorAll('[data-qr]:not(.drawn)'); if (!nodes.length) return;
    if (!qrLib) qrLib = new Promise(function (ok, no) {
      if (window.qrcode) return ok();
      var sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'; sc.onload = ok; sc.onerror = function () { qrLib = null; no(); }; document.head.appendChild(sc);
    });
    qrLib.then(function () {
      root.querySelectorAll('[data-qr]:not(.drawn)').forEach(function (el) {
        try { var q = window.qrcode(0, 'M'); q.addData(el.getAttribute('data-qr')); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); el.classList.add('drawn'); } catch (e) { el.classList.add('hide'); }
      });
    }, function () { root.querySelectorAll('[data-qr]').forEach(function (el) { el.classList.add('hide'); }); });
  }
  function payLabel(o) {
    var m = o.paymentMethod === 'PhonePe' ? 'PhonePe / UPI' : 'Cash on Delivery';
    return m + (o.paymentStatus && o.paymentStatus !== 'COD' ? ' - ' + o.paymentStatus : '') + (o.paymentRef ? ' (UTR ' + o.paymentRef + ')' : '');
  }
  applySettings(App.store.get(PUBKEY, {}).settings);
  st.cat = (App.store.get(PUBKEY, {}).catalogue) || JSON.parse(JSON.stringify(window.DEFAULT_CATALOGUE));

  /* ============================== data ============================== */
  function activeCats() { return (st.cat.categories || []).filter(function (c) { return c.active !== false; }); }
  function activeItems() { return (st.cat.items || []).filter(function (i) { return i.active !== false; }); }
  function catById(id) { var all = st.cat.categories || []; for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function itemById(id) { var all = st.cat.items || []; for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }

  function loadPublic() {
    var cached = App.store.get(PUBKEY, null);
    return App.api('getPublic', {}, { retries: 1 }).then(function (d) {
      if (d && d.catalogue && d.catalogue.categories && d.catalogue.categories.length) { st.cat = d.catalogue; st.catSource = 'live'; }
      st.apiVersion = String((d && d.version) || '');
      applySettings(d.settings || {});
      App.store.set(PUBKEY, { catalogue: st.cat, settings: d.settings || {} });
    }, function (e) {
      if (e.code === 'OLD_BACKEND') st.backendOld = true;
      if (!cached) st.cat = JSON.parse(JSON.stringify(window.DEFAULT_CATALOGUE));
      st.catSource = 'default';
    });
  }

  /* ============================== shell ============================== */
  function mount(el) {
    root = el;
    root.innerHTML =
      '<div id="topbar"></div><div id="adminbar"></div>' +
      '<header class="hdr" id="hdr"></header>' +
      '<main id="site"></main><main id="admin" class="admin hide"></main>' +
      '<footer class="ftr" id="ftr"></footer>' +
      '<div class="fab" id="fab"></div><div id="modal"></div>';
    renderAll();
    loadPublic().then(function () { renderAll(); openTrackLinkFromUrl(); });
    App.auth.onChange(function (u, why) {
      if (why === 'signin' || why === 'verified') {
        closeModal();
        if (u && u.isAdmin) { App.toast('Welcome ' + (u.name || u.email) + ' - admin tools are on.'); go('admin', st.admin.tab); loadAdmin(); }
        else if (u) { App.toast('Signed in as ' + (u.name || u.email)); if (u.mobile || u.email) { st.me = Object.assign({}, st.me, nonEmpty({ name: u.name, mobile: u.mobile, email: u.kind !== 'phone' ? u.email : '' })); App.store.set('oss_me', st.me); } }
      }
      if (why === 'signout' || why === 'expired') { st.admin.data = null; st.my = []; if (st.view === 'admin') go('site'); }
      renderAll(); loadMy(true);
    });
    window.addEventListener('hashchange', route);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    setInterval(function () { if (document.visibilityState === 'hidden') return; loadMy(true); if (App.auth.isAdmin()) loadAdmin(true); }, POLL);
    route();
    loadMy(true);
    if (App.auth.isAdmin()) loadAdmin();
  }

  function route() {
    var m = /^#admin(?:\/(\w+))?/.exec(location.hash);
    if (m) {
      if (!App.auth.isAdmin()) { st.view = 'site'; showViews(); openSignIn(true); return; }
      st.view = 'admin'; st.admin.tab = m[1] || st.admin.tab || 'dashboard';
      if (st.admin.tab === 'orders') markAdminSeen();
    } else st.view = 'site';
    var changed = st.lastView !== st.view || st.lastTab !== st.admin.tab;
    st.lastView = st.view; st.lastTab = st.admin.tab;
    showViews(); renderAdminBar(); renderAdmin();
    if (changed && st.view === 'admin') window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function go(view, tab) {
    if (view === 'admin') location.hash = '#admin/' + (tab || 'dashboard');
    else if (/^#admin/.test(location.hash)) { history.pushState(null, '', location.pathname + location.search); route(); }
    window.scrollTo(0, 0);
  }
  function showViews() {
    $('#site').classList.toggle('hide', st.view === 'admin');
    $('#ftr').classList.toggle('hide', st.view === 'admin');
    $('#fab').classList.toggle('hide', st.view === 'admin');
    $('#admin').classList.toggle('hide', st.view !== 'admin');
    document.body.classList.toggle('in-admin', st.view === 'admin');
  }
  function renderAll() {
    renderTopbar(); renderAdminBar(); renderHeader(); renderSite(); renderFooter(); renderFab(); showViews();
    if (st.view === 'admin') renderAdmin();
  }

  function renderTopbar() {
    var parts = [];
    if (App.demo) parts.push('<div class="demo-bar">' + icon('info', 16) + ' <b>Demo mode</b><span class="dm-long"> - orders and changes are saved only in this browser.</span> <button class="linkbtn light" data-act="signin">Try the admin login</button></div>');
    if (S.ANNOUNCEMENT) parts.push('<div class="announce">' + icon('bell', 16) + ' ' + h(S.ANNOUNCEMENT) + '</div>');
    $('#topbar').innerHTML = parts.join('');
  }

  function unseenCount() { return st.my.filter(isUnseen).length; }
  function isUnseen(o) { var s = st.seen[o.orderId]; return s !== undefined && s !== o.updatedAt; }
  function renderHeader() {
    var u = App.auth.user, n = unseenCount();
    var nav = [['services', 'Services'], ['catalogue', 'Browse'], ['order', 'Order'], ['track', 'Track'], ['about', 'About'], ['contact', 'Contact']];
    var userBtn = u
      ? '<div class="umenu"><button class="avatar-btn" data-act="usermenu" aria-label="Account menu">' + avatar(u) + (n ? '<span class="dot-badge">' + n + '</span>' : '') + '</button>' +
        '<div class="umenu-pop hide" id="umenu"><div class="umenu-h"><b>' + h(u.name || 'Customer') + '</b><span class="muted small">' + h(u.email || u.mobile || '') + '</span>' + (u.isAdmin ? '<span class="tag admin-tag">Admin</span>' : '') + '</div>' +
        (u.isAdmin ? '<button data-act="goadmin" data-tab="dashboard">' + icon('grid', 18) + ' Admin dashboard</button>' : '') +
        '<button data-go="myorders">' + icon('list', 18) + ' My orders' + (n ? ' <span class="badge">' + n + '</span>' : '') + '</button>' +
        '<button data-act="signout">' + icon('logout', 18) + ' Sign out</button></div></div>'
      : '<button class="btn ghost sm" data-act="signin">' + icon('user', 17) + '<span class="hide-xs"> Sign in</span></button>';
    $('#hdr').innerHTML = '<div class="wrap hdr-in">' +
      '<a class="brand" href="#" data-act="home"><span class="logo">' + icon('logo', 26) + '</span><span class="brand-t"><b>' + h(S.BUSINESS_NAME) + '</b><small>' + h(S.BUSINESS_SUBTITLE) + '</small></span></a>' +
      '<nav class="nav" id="nav">' + nav.map(function (x) { return '<a href="#' + x[0] + '" data-go="' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="hdr-act">' + (u && u.isAdmin && st.view !== 'admin' ? '<button class="btn sm dark" data-act="goadmin" data-tab="dashboard">' + icon('grid', 16) + '<span class="hide-xs"> Admin</span></button>' : '') +
      userBtn + '<button class="btn sm hide-sm" data-go="order">Order now</button>' +
      '<button class="icon-btn menu-btn" data-act="menu" aria-label="Menu">' + icon('menu', 24) + '</button></div></div>';
  }
  function avatar(u) {
    if (u.picture) return '<img class="avatar" src="' + h(u.picture) + '" alt="" referrerpolicy="no-referrer">';
    return '<span class="avatar">' + h(String(u.name || u.email || '?').charAt(0).toUpperCase()) + '</span>';
  }

  /* ============================== customer site ============================== */
  function renderSite() {
    if (!st.cat) return;
    var cats = activeCats();
    $('#site').innerHTML = hero() + servicesSection(cats) + catalogueSection(cats) + howSection() +
      '<section class="sec alt" id="order"><div class="wrap"><div class="sec-h"><span class="eyebrow">Book a service</span><h2>Place your order</h2><p class="muted">Tell us what you need. We confirm quickly by phone or WhatsApp.</p></div>' +
      '<div class="order-grid"><div class="card" id="orderbox"></div><aside class="side">' + sideCards() + '</aside></div></div></section>' +
      '<section class="sec" id="track"><div class="wrap narrow"><div class="sec-h"><span class="eyebrow">Live status</span><h2>Track your order</h2></div><div class="card" id="trackbox"></div></div></section>' +
      '<section class="sec alt' + (showMy() ? '' : ' hide') + '" id="myorders"><div class="wrap"><div id="mybox"></div></div></section>' +
      aboutSection() + contactSection();
    renderOrderForm(); renderTrack(); renderMy(); renderItems();
  }
  function showMy() { return !!App.auth.user || st.device.length > 0; }

  function hero() {
    var stats = [[String(activeCats().length), 'Service categories'], [String(activeItems().length), 'Services with prices'], ['Same day', 'Printing & xerox'], ['Live', 'Online order tracking']];
    return '<section class="hero"><div class="wrap hero-in"><div class="hero-copy">' +
      '<span class="hero-badge">' + icon('pin', 15) + ' Ongole, Andhra Pradesh</span>' +
      '<h1>' + h(S.TAGLINE) + '</h1>' +
      '<p class="lead">Computer &amp; laptop service, networking, CCTV installation, xerox, printing and design work - all under one roof. Order online, track live, pay at the shop.</p>' +
      '<div class="hero-cta"><button class="btn lg" data-go="order">' + icon('cart', 19) + ' Order a service</button><button class="btn lg ghost-light" data-go="catalogue">' + icon('list', 19) + ' See price list</button></div>' +
      '<div class="hero-quick">' + (S.PHONE ? '<a href="tel:+91' + S.PHONE + '">' + icon('phone', 16) + ' +91 ' + h(S.PHONE) + '</a>' : '') +
      (S.WHATSAPP ? '<a target="_blank" rel="noopener" href="' + h(App.waLink(S.WHATSAPP, 'Hello, I need help with a service.')) + '">' + icon('chat', 16) + ' WhatsApp us</a>' : '') +
      (S.HOURS ? '<span>' + icon('clock', 16) + ' ' + h(S.HOURS) + '</span>' : '') + '</div></div>' +
      '<div class="hero-art" aria-hidden="true"><div class="glass main-card"><div class="mc-h"><span class="mc-dot"></span><b>Order SR-0124</b><span class="pill pill-in-progress">In Progress</span></div>' +
      '<div class="mc-row">' + icon('cctv', 22) + '<div><b>CCTV 4-camera HD package</b><small>Installation today, 4:00 PM</small></div></div>' +
      '<div class="mini-steps"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></div><div class="mc-f"><span>Bill ₹14,999</span><span class="ok">Advance paid</span></div></div>' +
      '<div class="glass chip-card c1">' + icon('printer', 20) + ' Colour prints ready</div>' +
      '<div class="glass chip-card c2">' + icon('laptop', 20) + ' Laptop repaired ' + icon('check', 16) + '</div>' +
      '<div class="glass chip-card c3">' + icon('network', 20) + ' Wi-Fi setup done</div></div></div>' +
      '<div class="wrap"><div class="stats">' + stats.map(function (s) { return '<div><b>' + h(s[0]) + '</b><span>' + h(s[1]) + '</span></div>'; }).join('') + '</div></div></section>';
  }

  function servicesSection(cats) {
    return '<section class="sec" id="services"><div class="wrap"><div class="sec-h"><span class="eyebrow">What we do</span><h2>Our services</h2><p class="muted">Professional IT support and printing for homes, students, shops and offices.</p></div>' +
      '<div class="svc-grid">' + cats.map(function (c) {
        var n = activeItems().filter(function (i) { return i.category === c.id; });
        var from = n.length ? Math.min.apply(null, n.map(function (i) { return Number(i.price) || 0; })) : 0;
        return '<button class="svc tone-' + h(c.tone || 'blue') + '" data-pick-cat="' + h(c.id) + '"><span class="svc-ic">' + icon(c.icon, 28) + '</span><h3>' + h(c.name) + '</h3><p>' + h(c.desc || '') + '</p>' +
          '<span class="svc-f"><span>' + n.length + ' services' + (from ? ' · from ' + money(from) : '') + '</span>' + icon('arrow', 18) + '</span></button>';
      }).join('') + '</div></div></section>';
  }

  function catalogueSection(cats) {
    var cnt = function (id) { return activeItems().filter(function (i) { return id === 'all' || i.category === id; }).length; };
    var sorts = [['default', 'Recommended'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name: A to Z']];
    return '<section class="sec alt" id="catalogue"><div class="wrap"><div class="sec-h"><span class="eyebrow">Transparent pricing</span><h2>Browse services &amp; prices</h2><p class="muted">Search, filter by category and sort by price. Prices are starting rates; the final bill is confirmed before work begins.</p></div>' +
      '<div class="cat-tools"><div class="chips" role="tablist"><button class="chip' + (st.filter === 'all' ? ' on' : '') + '" data-filter="all">All <span class="cnt">' + cnt('all') + '</span></button>' +
      cats.map(function (c) { return '<button class="chip' + (st.filter === c.id ? ' on' : '') + '" data-filter="' + h(c.id) + '">' + icon(c.icon, 16) + ' ' + h(c.name) + ' <span class="cnt">' + cnt(c.id) + '</span></button>'; }).join('') + '</div>' +
      '<div class="browse-row"><label class="search">' + icon('search', 18) + '<input id="cat-q" type="search" placeholder="Search services..." value="' + h(st.q) + '"></label>' +
      '<select class="input sort-in" id="cat-sort" aria-label="Sort">' + sorts.map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>Sort: ' + o[1] + '</option>'; }).join('') + '</select>' +
      '<select class="input sort-in" id="cat-only" aria-label="Show"><option value="">Show: all services</option><option value="popular"' + (st.only === 'popular' ? ' selected' : '') + '>Show: popular only</option><option value="onsite"' + (st.only === 'onsite' ? ' selected' : '') + '>Show: on-site services</option><option value="shop"' + (st.only === 'shop' ? ' selected' : '') + '>Show: at-shop services</option></select></div></div>' +
      '<p class="muted small" id="items-n"></p><div class="items" id="items"></div>' + (st.catSource === 'default' && !App.demo ? '<p class="hint center" style="margin-top:14px">Showing the standard price list.</p>' : '') + '</div></section>';
  }
  function renderItems() {
    var box = $('#items'); if (!box) return;
    var q = st.q.toLowerCase(), isAdm = App.auth.isAdmin();
    var list = activeItems().filter(function (i) {
      var c = catById(i.category); if (c && c.active === false) return false;
      if (st.only === 'popular' && !i.popular) return false;
      if (st.only === 'onsite' && !i.onsite) return false;
      if (st.only === 'shop' && i.onsite) return false;
      return (st.filter === 'all' || i.category === st.filter) && (!q || (i.name + ' ' + (i.desc || '') + ' ' + (c ? c.name : '')).toLowerCase().indexOf(q) >= 0);
    });
    if (st.sort === 'price-asc') list.sort(function (a, b) { return (Number(a.price) || 0) - (Number(b.price) || 0); });
    else if (st.sort === 'price-desc') list.sort(function (a, b) { return (Number(b.price) || 0) - (Number(a.price) || 0); });
    else if (st.sort === 'name') list.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var n = $('#items-n'); if (n) n.textContent = list.length + ' service' + (list.length === 1 ? '' : 's') + ' found' + (st.filter !== 'all' && catById(st.filter) ? ' in ' + catById(st.filter).name : '');
    box.innerHTML = list.length ? list.map(function (i) {
      var c = catById(i.category) || {};
      return '<article class="item tone-' + h(c.tone || 'blue') + '"><div class="item-top"><span class="item-ic">' + icon(c.icon, 22) + '</span>' +
        (i.popular ? '<span class="tag pop">' + icon('star', 13) + ' Popular</span>' : '') + (i.onsite ? '<span class="tag">On-site</span>' : '') +
        (isAdm ? '<button class="icon-btn sm edit-fab" data-act="edit-item" data-id="' + h(i.id) + '" title="Edit in admin">' + icon('edit', 16) + '</button>' : '') + '</div>' +
        '<h3>' + h(i.name) + '</h3><p>' + h(i.desc || '') + '</p><div class="item-f"><div class="price"><b>' + money(i.price) + '</b><small>' + h(i.unit || '') + '</small></div>' +
        '<button class="btn sm" data-order-item="' + h(i.id) + '">Order</button></div></article>';
    }).join('') : '<div class="empty">' + icon('search', 28) + '<p>No services match your search.</p></div>';
  }

  function howSection() {
    var steps = [['cart', 'Choose & order', 'Pick a service from the price list and place your order online in a minute.'],
      ['phone', 'We confirm', 'Our team calls or WhatsApps you to confirm the details and final price.'],
      ['wrench', 'Work done', 'We complete the work at our shop or at your place for on-site services.'],
      ['search', 'Track & collect', 'Follow live status online and get updates by e-mail.']];
    return '<section class="sec" id="how"><div class="wrap"><div class="sec-h"><span class="eyebrow">Simple process</span><h2>How it works</h2></div><div class="steps">' +
      steps.map(function (s, i) { return '<div class="step"><span class="step-n">' + (i + 1) + '</span><span class="step-ic">' + icon(s[0], 24) + '</span><h3>' + s[1] + '</h3><p>' + s[2] + '</p></div>'; }).join('') + '</div></div></section>';
  }

  function aboutSection() {
    var why = [['award', 'Experienced technicians', 'Trained staff for hardware, software, networking and CCTV.'], ['rupee', 'Fair, clear prices', 'Published rates and the final bill confirmed before work.'],
      ['bolt', 'Fast turnaround', 'Same-day xerox, printing and most software jobs.'], ['shield', 'Trusted & local', 'Genuine parts, warranty on work and support after service.']];
    return '<section class="sec alt" id="about"><div class="wrap about"><div><span class="eyebrow">About us</span><h2>' + h(S.BUSINESS_NAME) + '</h2>' +
      '<p class="lead dark">' + h(S.ABOUT || 'Your trusted neighbourhood shop in Ongole for everything IT and printing. From repairing a laptop to installing CCTV for your shop, from a single xerox to a full flex banner, we do it with care and at honest prices.') + '</p>' +
      '<div class="why">' + why.map(function (w) { return '<div class="why-i"><span>' + icon(w[0], 22) + '</span><div><b>' + w[1] + '</b><p>' + w[2] + '</p></div></div>'; }).join('') + '</div></div>' +
      '<div class="about-card"><h3>Serving Ongole for</h3><div class="big">' + icon('users', 30) + ' homes, students, shops &amp; offices</div><ul class="ticks">' +
      ['Computer &amp; laptop repair', 'Networking &amp; Wi-Fi', 'CCTV supply &amp; installation', 'Xerox, printing &amp; binding', 'Visiting cards, flex &amp; ID cards'].map(function (x) { return '<li>' + icon('check', 16) + ' ' + x + '</li>'; }).join('') +
      '</ul><button class="btn block" data-go="order">Book a service</button></div></div></section>';
  }

  function contactSection() {
    var cards = [];
    if (S.PHONE) cards.push(['phone', 'Call us', '+91 ' + S.PHONE, 'tel:+91' + S.PHONE]);
    if (S.WHATSAPP) cards.push(['chat', 'WhatsApp', '+91 ' + S.WHATSAPP, App.waLink(S.WHATSAPP, 'Hello, I need help with a service.')]);
    if (S.EMAIL) cards.push(['mail', 'E-mail', S.EMAIL, 'mailto:' + S.EMAIL]);
    if (S.ADDRESS) cards.push(['pin', 'Visit us', S.ADDRESS, S.MAP_LINK || 'https://www.google.com/maps/search/' + encodeURIComponent(S.BUSINESS_NAME + ' ' + S.ADDRESS)]);
    if (S.HOURS) cards.push(['clock', 'Working hours', S.HOURS, '']);
    return '<section class="sec" id="contact"><div class="wrap"><div class="sec-h"><span class="eyebrow">Get in touch</span><h2>Contact us</h2></div><div class="contact-grid">' +
      cards.map(function (c) {
        var inner = '<span class="cc-ic">' + icon(c[0], 22) + '</span><div><small>' + c[1] + '</small><b>' + h(c[2]) + '</b></div>';
        return c[3] ? '<a class="cc" href="' + h(c[3]) + '"' + (/^http/.test(c[3]) ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>' : '<div class="cc">' + inner + '</div>';
      }).join('') + '</div></div></section>';
  }

  function sideCards() {
    var out = '<div class="card side-c"><h3>' + icon('info', 18) + ' Good to know</h3><ul class="ticks"><li>' + icon('check', 15) + ' Cash on Delivery, or pay online by PhonePe / UPI</li><li>' + icon('check', 15) + ' Final price confirmed before work</li><li>' + icon('check', 15) + ' Send files for printing on WhatsApp' + (S.EMAIL ? ' or e-mail' : '') + '</li><li>' + icon('check', 15) + ' Track your order any time</li></ul></div>';
    if (payOn()) {
      out += '<div class="card side-c"><h3>' + icon('rupee', 18) + ' Pay by PhonePe</h3><p class="muted small">Optional - you can also pay cash on delivery. Choose "Pay now" in the order form.</p><div class="upi"><span>PhonePe: <b>' + h(S.PHONEPE_NUMBER || S.PHONE) + '</b></span><button class="btn ghost sm" data-copy="' + h(S.PHONEPE_NUMBER || S.PHONE) + '">Copy</button></div></div>';
    }
    if (S.WHATSAPP || S.PHONE) out += '<div class="card side-c help"><h3>Need help choosing?</h3><p class="muted small">Talk to us - we will suggest the right service.</p><div class="row">' +
      (S.PHONE ? '<a class="btn ghost sm" href="tel:+91' + S.PHONE + '">' + icon('phone', 16) + ' Call</a>' : '') +
      (S.WHATSAPP ? '<a class="btn wa sm" target="_blank" rel="noopener" href="' + h(App.waLink(S.WHATSAPP, 'Hello, I need help choosing a service.')) + '">' + icon('chat', 16) + ' WhatsApp</a>' : '') + '</div></div>';
    return out;
  }

  /* ------------------------------ order form ------------------------------ */
  function renderOrderForm() {
    var box = $('#orderbox'); if (!box) return;
    var F = st.form, cats = activeCats(), u = App.auth.user;
    var items = activeItems().filter(function (i) { return i.category === F.category; });
    var it = itemById(F.itemId);
    var me = st.me;
    var signHint = !u ? '<div class="note"><span>' + icon('user', 16) + ' <b>Sign in</b> to see all your orders in one place and get updates.</span><button class="btn ghost sm" type="button" data-act="signin">Sign in</button></div>' : '';
    box.innerHTML = '<form id="of" novalidate autocomplete="on">' + signHint +
      '<div class="grid2"><div class="field"><label for="f-category">Service type</label><select class="input" id="f-category"><option value="">Choose...</option>' +
      cats.map(function (c) { return '<option value="' + h(c.id) + '"' + (F.category === c.id ? ' selected' : '') + '>' + h(c.name) + '</option>'; }).join('') + '</select><div class="err" data-e="service"></div></div>' +
      '<div class="field"><label for="f-item">Service</label><select class="input" id="f-item"' + (F.category ? '' : ' disabled') + '><option value="">' + (F.category ? 'Other / not listed' : 'Choose service type first') + '</option>' +
      items.map(function (i) { return '<option value="' + h(i.id) + '"' + (F.itemId === i.id ? ' selected' : '') + '>' + h(i.name) + ' - ' + money(i.price) + '</option>'; }).join('') + '</select></div></div>' +
      '<div id="est"></div>' +
      '<div class="grid3"><div class="field"><label for="f-quantity">Quantity</label><input class="input" id="f-quantity" type="number" min="1" step="1" inputmode="numeric" value="' + h(F.qty) + '"><div class="err" data-e="quantity"></div></div>' +
      '<div class="field"><label for="f-preferredDate">Preferred date <span class="opt">(optional)</span></label><input class="input" id="f-preferredDate" type="date" min="' + App.ymd(new Date()) + '"></div>' +
      '<div class="field"><label for="f-preferredTime">Time <span class="opt">(optional)</span></label><input class="input" id="f-preferredTime" type="time"></div></div>' +
      '<div class="field"><label for="f-description">Describe the work</label><textarea class="input" id="f-description" maxlength="2000" placeholder="' + h(it ? 'Any details for: ' + it.name : 'e.g. Laptop not starting / 40 pages both sides spiral / 4 cameras for shop') + '"></textarea><div class="err" data-e="description"></div></div>' +
      '<div class="field' + (it && it.onsite ? '' : ' hide') + '" id="addr-f"><label for="f-address">Address for on-site visit</label><input class="input" id="f-address" maxlength="300" autocomplete="street-address"></div>' +
      '<div class="grid2"><div class="field"><label for="f-name">Your name</label><input class="input" id="f-name" maxlength="80" autocomplete="name" value="' + h(me.name || (u && u.name) || '') + '"><div class="err" data-e="name"></div></div>' +
      '<div class="field"><label for="f-mobile">Mobile number</label><input class="input" id="f-mobile" type="tel" inputmode="numeric" maxlength="14" autocomplete="tel" value="' + h(me.mobile || (u && u.mobile) || '') + '"><div class="err" data-e="mobile"></div></div></div>' +
      '<div class="field"><label for="f-email">E-mail <span class="opt">(optional - for order updates)</span></label><input class="input" id="f-email" type="email" autocomplete="email" value="' + h(me.email || (u && u.kind !== 'phone' ? u.email : '') || '') + '"><div class="err" data-e="email"></div></div>' +
      (payOn() ? '<div class="field"><label>Payment</label><div class="pay-pick">' +
        '<label class="pp' + (F.pay !== 'PhonePe' ? ' on' : '') + '"><input type="radio" name="f-pay" value="COD"' + (F.pay !== 'PhonePe' ? ' checked' : '') + '><span><b>Cash on Delivery</b><small>Pay cash when the work is done / delivered</small></span></label>' +
        '<label class="pp' + (F.pay === 'PhonePe' ? ' on' : '') + '"><input type="radio" name="f-pay" value="PhonePe"' + (F.pay === 'PhonePe' ? ' checked' : '') + '><span><b>Pay now by PhonePe / UPI</b><small>Optional - pay to ' + h(S.PHONEPE_NUMBER || S.PHONE) + '</small></span></label></div></div>' +
        '<div id="pay-now"></div>' : '') +
      '<input class="hp" id="f-website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="err" id="form-err" style="margin-bottom:10px"></div><button class="btn lg block" id="submit" type="submit">' + icon('check', 19) + ' Place order</button>' +
      '<p class="hint center" style="margin-top:10px">By ordering you agree to be contacted about this order by phone, WhatsApp or e-mail.</p></form>';
    renderEstimate();
  }
  function estimateNow() { var it = itemById(st.form.itemId), q = Math.max(1, Math.floor(Number(st.form.qty) || 1)); return it ? it.price * q : 0; }
  function renderPayNow() {
    var el = $('#pay-now'); if (!el) return;
    var keep = $('#f-paymentRef') ? $('#f-paymentRef').value : '';
    el.innerHTML = st.form.pay === 'PhonePe' ? payBox(estimateNow(), 'Order from ' + (val('name') || 'website')) +
      '<div class="field"><label for="f-paymentRef">UPI transaction / UTR number <span class="opt">(optional - you can also pay after placing the order)</span></label><input class="input" id="f-paymentRef" maxlength="40" placeholder="e.g. 412345678901" value="' + h(keep) + '"><div class="err" data-e="paymentRef"></div></div>' : '';
    drawQrs();
  }
  function renderEstimate() {
    var el = $('#est'); if (!el) return;
    var it = itemById(st.form.itemId), q = Math.max(1, Math.floor(Number(st.form.qty) || 1));
    renderPayNow();
    el.innerHTML = it ? '<div class="estimate"><div><small>Selected</small><b>' + h(it.name) + '</b><span class="muted small">' + money(it.price) + ' ' + h(it.unit || '') + '</span></div><div class="right"><small>Estimate</small><b class="big">' + money(it.price * q) + '</b></div></div>' : '';
  }
  function val(id) { var e = $('#f-' + id); return e ? String(e.value).trim() : ''; }
  function showErrors(errs) {
    var nodes = root.querySelectorAll('#of [data-e]'), first = null;
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute('data-e'); nodes[i].textContent = errs[k] || '';
      var inp = $('#f-' + (k === 'service' ? 'category' : k)); if (inp) inp.classList.toggle('bad', !!errs[k]);
      if (errs[k] && !first) first = inp;
    }
    if (first) { try { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
  }
  function submitOrder() {
    if (st.sending) return;
    var it = itemById(val('item'));
    var d = { service: val('category'), itemId: val('item'), description: val('description'), quantity: val('quantity'), preferredDate: val('preferredDate'), preferredTime: val('preferredTime'),
      address: val('address'), name: val('name'), mobile: val('mobile'), email: val('email'), website: val('website'), clientRef: st.clientRef,
      paymentMethod: payOn() && st.form.pay === 'PhonePe' ? 'PhonePe' : 'COD', paymentRef: st.form.pay === 'PhonePe' ? val('paymentRef').replace(/[^\w\- ]/g, '') : '' };
    var e = {};
    if (!d.service) e.service = 'Please choose a service type.';
    if (!it && d.description.length < 5) e.description = 'Please describe the work in a few words.';
    var q = Number(d.quantity); if (!(q >= 1 && q <= 100000) || Math.floor(q) !== q) e.quantity = 'Enter a whole number, 1 or more.';
    if (d.name.length < 2) e.name = 'Please enter your name.';
    if (!App.mobileOk(d.mobile)) e.mobile = 'Enter a valid 10-digit mobile number.';
    if (d.email && !App.emailOk(d.email)) e.email = 'This e-mail address does not look right.';
    if (d.paymentRef && d.paymentRef.length < 6) e.paymentRef = 'The UTR number looks too short. Leave it empty if you have not paid yet.';
    showErrors(e); $('#form-err').textContent = '';
    if (Object.keys(e).length) return;
    if (it && (st.backendOld || st.catSource === 'default')) d.description = 'Item: ' + it.name + ' (' + money(it.price) + ' ' + (it.unit || '') + ')' + (d.description ? '\n' + d.description : '');
    if (!d.description && it) d.description = it.name;
    // older backend (before v2.1) has no payment columns: keep the payment choice in the work details
    if (!App.demo && st.apiVersion && st.apiVersion < '2.1' && d.paymentMethod === 'PhonePe') d.description += '\nPayment: PhonePe / UPI' + (d.paymentRef ? ', UTR ' + d.paymentRef : ' (not paid yet)');
    st.sending = true;
    var btn = $('#submit'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Placing your order...';
    App.api('createOrder', d).then(function (res) {
      st.sending = false;
      st.me = { name: d.name, mobile: App.mobileOk(d.mobile), email: d.email }; App.store.set('oss_me', st.me);
      st.device = [{ orderId: res.orderId, key: res.trackKey, at: new Date().toISOString() }].concat(st.device.filter(function (x) { return x.orderId !== res.orderId; })).slice(0, 20);
      App.store.set(K('oss_my_orders'), st.device);
      if (res.order) { st.seen[res.orderId] = res.order.updatedAt; App.store.set(K('oss_seen'), st.seen); }
      st.clientRef = App.uid();
      if (App.demo && res.demoNotified) App.toast('Demo: e-mail notification sent to ' + res.demoNotified + '.');
      renderDone(res, d, it);
      var mo = $('#myorders'); if (mo) mo.classList.remove('hide');
      loadMy(true);
    }, function (err) {
      st.sending = false; btn.disabled = false; btn.innerHTML = icon('check', 19) + ' Place order';
      if (err.code === 'INVALID' && err.data && err.data.field) { var o = {}; o[err.data.field] = err.message; showErrors(o); }
      else $('#form-err').textContent = err.message;
    });
  }
  function trackLink(orderId, key) { return key ? location.origin + location.pathname.replace(/index\.html$/, '') + '?t=' + encodeURIComponent(orderId + '.' + key) : ''; }
  function orderWaText(res, d, it) {
    var link = trackLink(res.orderId, res.trackKey), q = Number(d.quantity) || 1, total = it ? it.price * q : 0;
    var pay = d.paymentMethod === 'PhonePe' ? 'PhonePe / UPI' + (d.paymentRef ? ' - UTR ' + d.paymentRef : ' - not paid yet') : 'Cash on Delivery (COD)';
    return 'Hello ' + S.BUSINESS_NAME + ', I placed an order.\nOrder ID: ' + res.orderId + '\nName: ' + d.name + '\nPhone: ' + d.mobile + (d.address ? '\nAddress: ' + d.address : '') +
      '\nItem: ' + (it ? it.name + ' x ' + q + ' @ ' + money(it.price) + ' ' + (it.unit || '') : ((catById(d.service) || {}).name || d.service) + ' x ' + q) +
      '\nTotal: ' + (total ? money(total) : 'to be confirmed') + '\nPayment: ' + pay + (d.description && (!it || d.description !== it.name) ? '\nDetails: ' + d.description.slice(0, 300) : '') + (link ? '\nTrack: ' + link : '');
  }
  function renderDone(res, d, it) {
    st.lastDone = { res: res, d: d, it: it }; st.form.pay = 'COD';
    var link = trackLink(res.orderId, res.trackKey);
    var wa = '<a class="btn wa" target="_blank" rel="noopener" href="' + h(App.waLink(S.WHATSAPP, orderWaText(res, d, it))) + '">' + icon('chat', 18) + ' Send order on WhatsApp</a>';
    var total = it ? it.price * (Number(d.quantity) || 1) : 0;
    var pay = d.paymentMethod === 'PhonePe' ? '<div class="pay-done">' + (d.paymentRef ? '<div class="note">' + icon('check', 16) + ' Thank you! We received your UTR <b>' + h(d.paymentRef) + '</b>. The shop will verify the payment.</div>' :
      '<h4 class="sub-h">Pay now by PhonePe</h4>' + payBox(total, 'Order ' + res.orderId) +
      '<form id="payf" data-id="' + h(res.orderId) + '" data-key="' + h(res.trackKey || '') + '" novalidate><div class="grid2 keep"><div class="field"><label for="pay-ref">UTR / transaction number</label><input class="input" id="pay-ref" maxlength="40" placeholder="e.g. 412345678901"></div>' +
      '<div class="field"><label class="hide-sm">&nbsp;</label><button class="btn block" id="pay-go" type="submit">' + icon('check', 17) + ' I have paid</button></div></div><div class="err" id="pay-err"></div></form>') + '</div>'
      : '<p class="muted small">Payment: <b>Cash on Delivery</b>.</p>';
    $('#orderbox').innerHTML = '<div class="done"><div class="tick">' + icon('check', 34) + '</div><h3>Order placed. Thank you, ' + h(d.name) + '!</h3><p class="muted">Your order number is</p><div class="oid">' + h(res.orderId) + '</div>' +
      '<p class="muted">' + (d.email ? (res.emailed ? 'A confirmation has been e-mailed to you. ' : '') : '') + 'Keep this number to track your order. ' + (S.WHATSAPP ? 'Send it to us on WhatsApp with your files for faster service.' : '') + '</p>' + pay +
      '<div class="row center">' + (S.WHATSAPP ? wa : '') + '<button class="btn" data-track-id="' + h(res.orderId) + '" data-track-key="' + h(res.trackKey || '') + '">' + icon('search', 18) + ' Track this order</button>' +
      (link ? '<button class="btn ghost" data-copy="' + h(link) + '">' + icon('link', 18) + ' Copy tracking link</button>' : '') +
      '<button class="btn ghost" data-act="again">' + icon('plus', 18) + ' Place another order</button></div></div>';
    drawQrs();
    try { $('#order').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }
  function submitPayment(form) {
    var ref = $('#pay-ref').value.trim().replace(/[^\w\- ]/g, ''), err = $('#pay-err');
    if (ref.length < 6) { err.textContent = 'Please enter the UTR / transaction number from PhonePe (usually 12 digits).'; return; }
    var btn = $('#pay-go'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
    App.api('submitPayment', { orderId: form.getAttribute('data-id'), key: form.getAttribute('data-key'), paymentRef: ref }).then(function () {
      var box = form.closest('.pay-done') || form;
      box.innerHTML = '<div class="note">' + icon('check', 16) + ' Thank you! We received your UTR <b>' + h(ref) + '</b>. The shop will verify the payment.</div>';
      var L = st.lastDone, wa = $('#orderbox a.wa');
      if (L && wa && L.res.orderId === form.getAttribute('data-id')) { L.d.paymentRef = ref; wa.href = App.waLink(S.WHATSAPP, orderWaText(L.res, L.d, L.it)); }
      loadMy(true);
    }, function (e) {
      btn.disabled = false; btn.innerHTML = icon('check', 17) + ' I have paid';
      err.textContent = e.code === 'OLD_BACKEND' ? 'Could not save the UTR online. Please send it to us on WhatsApp.' : e.message;
    });
  }

  /* ------------------------------ tracking ------------------------------ */
  function renderTrack() {
    var box = $('#trackbox'); if (!box) return;
    box.innerHTML = '<form id="tf" novalidate><div class="grid3 track-f"><div class="field"><label for="t-id">Order number</label><input class="input" id="t-id" placeholder="e.g. SR-0012" maxlength="14" autocapitalize="characters"></div>' +
      '<div class="field"><label for="t-mobile">Mobile number</label><input class="input" id="t-mobile" type="tel" inputmode="numeric" maxlength="14" value="' + h(st.me.mobile || '') + '"></div>' +
      '<div class="field"><label class="hide-sm">&nbsp;</label><button class="btn block" id="t-go" type="submit">' + icon('search', 18) + ' Check status</button></div></div></form><div class="err" id="t-err"></div><div id="t-result"></div>';
    renderTrackResult();
  }
  function orderView(o) {
    var flow = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed'], at = flow.indexOf(o.status);
    var stepper = o.status === 'Cancelled' ? '<div class="note warn">This order was cancelled. Please contact the shop if this is unexpected.</div>' :
      '<div class="stepper">' + flow.map(function (s, i) {
        var cls = i < at || o.status === 'Completed' ? 'done-s' : (i === at ? 'now' : '');
        return '<div class="st ' + cls + '"><div class="dot">' + (cls === 'done-s' ? icon('check', 14) : '') + '</div><span>' + (s === 'Pending' ? 'Received' : s) + '</span></div>';
      }).join('') + '</div>';
    var amounts = '<div class="amounts"><div><small>Bill amount</small><b>' + (o.amountQuoted > 0 ? money(o.amountQuoted) : (o.estimate ? '~' + money(o.estimate) : 'To be confirmed')) + '</b></div>' +
      '<div class="paid"><small>Paid</small><b>' + money(o.amountPaid) + '</b></div><div class="due"><small>Balance</small><b>' + (o.amountQuoted > 0 ? money(o.balance) : '-') + '</b></div></div>';
    return '<div class="ov"><div class="ov-h"><h3>' + h(o.orderId) + '</h3>' + App.pill(o.status) + '</div><p class="muted">' + h(App.STATUS_TEXT[o.status] || '') + '</p>' + stepper + amounts +
      '<dl class="kv"><dt>Payment</dt><dd>' + h(payLabel(o)) + '</dd><dt>Service</dt><dd>' + h(o.itemName || o.service) + (o.itemName && o.service ? ' <span class="muted">(' + h(o.service) + ')</span>' : '') + '</dd><dt>Quantity</dt><dd>' + h(o.quantity) + '</dd>' +
      (o.description ? '<dt>Work</dt><dd>' + App.nl2br(o.description) + '</dd>' : '') +
      (o.preferredDate ? '<dt>Preferred</dt><dd>' + h(App.fmtDate(o.preferredDate)) + (o.preferredTime ? ', ' + h(App.fmtClock(o.preferredTime)) : '') + '</dd>' : '') +
      '<dt>Placed on</dt><dd>' + h(App.fmtDateTime(o.createdAt)) + '</dd></dl>' +
      '<h4 class="sub-h">Updates</h4>' + timeline(o.timeline || []) + '</div>';
  }
  function timeline(tl) {
    return '<ul class="timeline">' + tl.slice().reverse().map(function (t) {
      var title = t.type === 'created' ? 'Order placed' : t.type === 'payment' ? 'Payment' : t.status ? 'Status: ' + t.status : 'Message from the shop';
      return '<li' + (t.visible === false ? ' class="internal"' : '') + '><b>' + h(title) + (t.visible === false ? ' <span class="tag">internal</span>' : '') + '</b><div class="when">' + h(App.fmtDateTime(t.at)) + (t.by ? ' · ' + h(t.by) : '') + '</div>' + (t.message ? '<div>' + App.nl2br(t.message) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function renderTrackResult() {
    var box = $('#t-result'); if (!box) return;
    box.innerHTML = st.track ? '<div class="track-res"><div class="row end"><button class="btn ghost sm" data-act="track-refresh">' + icon('refresh', 15) + ' Refresh</button></div>' + orderView(st.track) + '</div>' : '';
  }
  function loadTrack(args) {
    st.trackArgs = args;
    var btn = $('#t-go'), err = $('#t-err');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Checking...'; }
    if (err) err.textContent = '';
    App.api('trackOrder', args).then(function (o) {
      st.track = o; renderTrack();
      var idb = $('#t-id'); if (idb) idb.value = o.orderId;
      try { $('#trackbox').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }, function (e) {
      if (btn) { btn.disabled = false; btn.innerHTML = icon('search', 18) + ' Check status'; }
      st.track = null; renderTrackResult(); if (err) err.textContent = e.message;
    });
  }
  function openTrackLinkFromUrl() {
    var m = /[?&]t=([^&#]+)/.exec(location.search);
    if (!m) return;
    var parts = decodeURIComponent(m[1]).split('.');
    if (parts.length === 2) { loadTrack({ orderId: parts[0], key: parts[1] }); }
  }

  /* ------------------------------ my orders + customer notifications ------------------------------ */
  function loadMy(quiet) {
    var u = App.auth.user;
    if (!u && !st.device.length) { st.my = []; renderMy(); return; }
    if (st.myBusy) return;
    st.myBusy = true;
    var server = u && (u.kind === 'google' || u.kind === 'demo') ? App.api('myOrders', {}, { retries: 0 }).then(function (d) { return d.orders; }, function (e) { st.myErr = e.code === 'OLD_BACKEND' ? '' : e.message; return []; }) : Promise.resolve([]);
    var local = Promise.all(st.device.slice(0, 12).map(function (x) { return App.api('trackOrder', { orderId: x.orderId, key: x.key }, { retries: 0 }).catch(function () { return null; }); }));
    Promise.all([server, local]).then(function (r) {
      st.myBusy = false;
      var map = {}, list = [];
      r[0].concat(r[1]).forEach(function (o) { if (o && !map[o.orderId]) { map[o.orderId] = 1; list.push(o); } });
      list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      var changed = [];
      list.forEach(function (o) {
        if (st.seen[o.orderId] === undefined) st.seen[o.orderId] = o.updatedAt;     // first time we see it: nothing new
        else if (st.seen[o.orderId] !== o.updatedAt && !st.my.some(function (p) { return p.orderId === o.orderId && p.updatedAt === o.updatedAt; })) changed.push(o);
      });
      App.store.set(K('oss_seen'), st.seen);
      st.my = list;
      changed.forEach(function (o) { App.toast('Update: order ' + o.orderId + ' is now ' + o.status + '.'); });
      renderMy(); renderHeader();
      if (!quiet && !list.length) App.toast('No orders found yet.');
    });
  }
  function renderMy() {
    var box = $('#mybox'), sec = $('#myorders'); if (!box) return;
    sec.classList.toggle('hide', !showMy());
    var u = App.auth.user, n = unseenCount();
    box.innerHTML = '<div class="sec-h left"><div><span class="eyebrow">Your account</span><h2>My orders ' + (n ? '<span class="badge lg">' + n + ' new update' + (n > 1 ? 's' : '') + '</span>' : '') + '</h2>' +
      '<p class="muted">' + (u ? 'Signed in as <b>' + h(u.email || u.mobile) + '</b>' + (u.kind === 'phone' ? ' (orders placed on this device)' : '') : 'Orders placed on this device.') + '</p></div>' +
      '<div class="row">' + (n ? '<button class="btn ghost sm" data-act="mark-seen">' + icon('check', 15) + ' Mark all as read</button>' : '') + '<button class="btn ghost sm" data-act="my-refresh">' + icon('refresh', 15) + ' Refresh</button>' + (!u ? '<button class="btn sm" data-act="signin">Sign in</button>' : '') + '</div></div>' +
      (st.myErr ? '<div class="note warn">' + h(st.myErr) + '</div>' : '') +
      (st.my.length ? '<div class="my-grid">' + st.my.map(function (o) {
        var flow = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed'], pct = o.status === 'Cancelled' ? 100 : Math.round((flow.indexOf(o.status) + 1) / flow.length * 100);
        return '<button class="my-card' + (isUnseen(o) ? ' unseen' : '') + '" data-my="' + h(o.orderId) + '"><div class="my-h"><b>' + h(o.orderId) + '</b>' + App.pill(o.status) + (isUnseen(o) ? '<span class="badge">New update</span>' : '') + '</div>' +
          '<div class="my-t">' + h(o.itemName || o.service) + '</div><div class="bar"><i style="width:' + pct + '%"' + (o.status === 'Cancelled' ? ' class="x"' : '') + '></i></div>' +
          '<div class="my-f"><span>' + h(App.fmtDate(o.createdAt)) + '</span><span>' + (o.amountQuoted ? money(o.amountQuoted) : o.estimate ? '~' + money(o.estimate) : '') + '</span></div></button>';
      }).join('') + '</div>' : '<div class="empty">' + icon('list', 28) + '<p>' + (st.myBusy ? 'Loading your orders...' : 'No orders yet. Place your first order above.') + '</p></div>');
  }
  function openMyOrder(id) {
    var o = null; st.my.forEach(function (x) { if (x.orderId === id) o = x; });
    if (!o) return;
    st.seen[id] = o.updatedAt; App.store.set(K('oss_seen'), st.seen);
    modal('<div class="modal-h"><h3>Order ' + h(id) + '</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b">' + orderView(o) +
      (S.WHATSAPP ? '<a class="btn wa block" target="_blank" rel="noopener" href="' + h(App.waLink(S.WHATSAPP, 'Hello, about my order ' + id + ' (' + o.status + ').')) + '">' + icon('chat', 18) + ' Ask about this order on WhatsApp</a>' : '') + '</div>');
    renderMy(); renderHeader();
  }

  /* ------------------------------ footer + floating buttons ------------------------------ */
  function renderFooter() {
    $('#ftr').innerHTML = '<div class="wrap ftr-in"><div><div class="brand light"><span class="logo">' + icon('logo', 24) + '</span><span class="brand-t"><b>' + h(S.BUSINESS_NAME) + '</b><small>' + h(S.BUSINESS_SUBTITLE) + '</small></span></div>' +
      '<p class="muted-l">' + h(S.TAGLINE) + '</p></div>' +
      '<div><h4>Services</h4><ul>' + activeCats().map(function (c) { return '<li><a href="#catalogue" data-pick-cat="' + h(c.id) + '">' + h(c.name) + '</a></li>'; }).join('') + '</ul></div>' +
      '<div><h4>Quick links</h4><ul><li><a href="#order" data-go="order">Place an order</a></li><li><a href="#track" data-go="track">Track order</a></li><li><a href="#catalogue" data-go="catalogue">Price list</a></li><li><a href="#admin" data-act="signin-admin">Staff login</a></li></ul></div>' +
      '<div><h4>Contact</h4><ul>' + (S.PHONE ? '<li><a href="tel:+91' + S.PHONE + '">+91 ' + h(S.PHONE) + '</a></li>' : '') + (S.EMAIL ? '<li><a href="mailto:' + h(S.EMAIL) + '">' + h(S.EMAIL) + '</a></li>' : '') + (S.ADDRESS ? '<li>' + h(S.ADDRESS) + '</li>' : '') + (S.HOURS ? '<li>' + h(S.HOURS) + '</li>' : '') + '</ul></div></div>' +
      '<div class="wrap copy">© ' + new Date().getFullYear() + ' ' + h(S.BUSINESS_NAME) + '. All rights reserved.</div>';
  }
  function renderFab() {
    $('#fab').innerHTML = (S.WHATSAPP ? '<a class="fab-b wa" target="_blank" rel="noopener" aria-label="WhatsApp" href="' + h(App.waLink(S.WHATSAPP, 'Hello, I need help with a service.')) + '">' + icon('chat', 26) + '</a>' : '') +
      (S.PHONE ? '<a class="fab-b call" aria-label="Call" href="tel:+91' + S.PHONE + '">' + icon('phone', 24) + '</a>' : '') +
      (!S.WHATSAPP && !S.PHONE ? '<button class="fab-b" aria-label="Order" data-go="order">' + icon('cart', 24) + '</button>' : '');
  }

  /* ------------------------------ sign-in ------------------------------ */
  function openSignIn(adminHint) {
    var demo = App.demo;
    var g = !demo && App.clientIdOk();
    modal('<div class="modal-h"><h3>' + (adminHint ? 'Admin sign in' : 'Sign in') + '</h3><button class="icon-btn" data-act="close" aria-label="Close">' + icon('x', 22) + '</button></div><div class="modal-b signin">' +
      '<p class="muted">' + (adminHint ? 'Admins sign in with their Google account. Admin tools appear on this same page.' : 'Sign in to see all your orders and get status updates.') + '</p>' +
      (App.auth.wasGoogle ? '<div class="note">Your previous sign-in expired. Please sign in again.</div>' : '') +
      (demo ? '<div class="demo-login"><button class="btn block" data-act="demo-admin">' + icon('shield', 18) + ' Demo admin login</button><button class="btn ghost block" data-act="demo-customer">' + icon('user', 18) + ' Demo customer login</button><p class="hint">Demo mode: signs in as ' + h(App.cfg.ADMIN_EMAILS[0] || 'admin') + ' / demo.customer@gmail.com without Google.</p></div>'
        : (g ? '<div id="gbtn" class="gbtn"><span class="spin dark"></span></div>' : '<div class="note warn">Google Sign-In is not set up yet. The shop owner must add the Client ID in config.js (SETUP-GUIDE.md, Part 2).</div>')) +
      (adminHint ? '' : '<div class="or"><span>or continue with mobile number</span></div><form id="pf" novalidate><div class="grid2"><div class="field"><label for="p-name">Name</label><input class="input" id="p-name" maxlength="80" value="' + h(st.me.name || '') + '"></div>' +
        '<div class="field"><label for="p-mobile">Mobile</label><input class="input" id="p-mobile" type="tel" inputmode="numeric" maxlength="14" value="' + h(st.me.mobile || '') + '"></div></div><div class="err" id="p-err"></div>' +
        '<button class="btn ghost block" type="submit">' + icon('phone', 17) + ' Continue</button><p class="hint">With mobile sign-in you see orders placed on this device. Use Google to see all your orders on any device.</p></form>') + '</div>', 'narrow');
    if (g) App.auth.renderGoogleButton($('#gbtn')).catch(function (e) { var b = $('#gbtn'); if (b) b.innerHTML = '<div class="note warn">' + h(e.message) + '</div>'; });
  }
  function demoLogin(email, name) { App.auth.set({ kind: 'demo', email: email, name: name, token: 'demo:' + email, isAdmin: App.isAdminEmail(email) }, 'signin'); }

  /* ------------------------------ modal ------------------------------ */
  function modal(html, size) {
    var box = $('#modal');
    box.innerHTML = '<div class="modal-bg" data-act="close-bg"><div class="modal ' + (size || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
  }
  function closeModal() { var b = $('#modal'); if (b && b.innerHTML) { b.innerHTML = ''; document.body.style.overflow = ''; st.admin.detail = null; } }
  App.modal = modal; App.closeModal = closeModal;

  /* ------------------------------ events ------------------------------ */
  function scrollToId(id) {
    if (st.view === 'admin') { go('site'); setTimeout(function () { scrollToId(id); }, 50); return; }
    var el = document.getElementById(id); if (!el) return;
    var nav = $('#nav'); if (nav) nav.classList.remove('open');
    var y = el.getBoundingClientRect().top + window.pageYOffset - ($('#hdr').offsetHeight + 6);
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  function onClick(ev) {
    var t = ev.target.closest('[data-act],[data-go],[data-filter],[data-pick-cat],[data-order-item],[data-copy],[data-track-id],[data-my],[data-a]');
    var pop = $('#umenu');
    if (pop && !ev.target.closest('.umenu')) pop.classList.add('hide');
    if (!t) return;
    if (t.hasAttribute('data-a')) return App.adminClick && App.adminClick(t, ev);
    if (t.hasAttribute('data-go')) { ev.preventDefault(); if (t.getAttribute('data-go') === 'myorders') { $('#myorders').classList.remove('hide'); } return scrollToId(t.getAttribute('data-go')); }
    if (t.hasAttribute('data-filter')) { st.filter = t.getAttribute('data-filter'); root.querySelectorAll('[data-filter]').forEach(function (c) { c.classList.toggle('on', c === t); }); return renderItems(); }
    if (t.hasAttribute('data-pick-cat')) { ev.preventDefault(); st.filter = t.getAttribute('data-pick-cat'); if (st.view === 'admin') go('site'); root.querySelectorAll('[data-filter]').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-filter') === st.filter); }); renderItems(); return scrollToId('catalogue'); }
    if (t.hasAttribute('data-order-item')) {
      var it = itemById(t.getAttribute('data-order-item'));
      if (it) { st.form.category = it.category; st.form.itemId = it.id; st.form.qty = 1; renderOrderForm(); scrollToId('order'); }
      return;
    }
    if (t.hasAttribute('data-copy')) return App.copy(t.getAttribute('data-copy'));
    if (t.hasAttribute('data-track-id')) { var k = t.getAttribute('data-track-key'); loadTrack(k ? { orderId: t.getAttribute('data-track-id'), key: k } : { orderId: t.getAttribute('data-track-id'), mobile: st.me.mobile }); return scrollToId('track'); }
    if (t.hasAttribute('data-my')) return openMyOrder(t.getAttribute('data-my'));
    var a = t.getAttribute('data-act');
    switch (a) {
      case 'home': ev.preventDefault(); if (st.view === 'admin') go('site'); window.scrollTo({ top: 0, behavior: 'smooth' }); break;
      case 'menu': $('#nav').classList.toggle('open'); break;
      case 'usermenu': pop.classList.toggle('hide'); break;
      case 'signin': openSignIn(false); break;
      case 'signin-admin': ev.preventDefault(); if (App.auth.isAdmin()) go('admin', 'dashboard'); else openSignIn(true); break;
      case 'signout': App.auth.signOut(); App.toast('You have been signed out.'); break;
      case 'goadmin': go('admin', t.getAttribute('data-tab') || 'dashboard'); break;
      case 'gosite': go('site'); break;
      case 'demo-admin': demoLogin(App.cfg.ADMIN_EMAILS[0] || 'admin@example.com', 'Shop Admin'); break;
      case 'demo-customer': demoLogin('demo.customer@gmail.com', 'Demo Customer'); break;
      case 'close': closeModal(); break;
      case 'close-bg': if (ev.target === t) closeModal(); break;
      case 'again': renderOrderForm(); break;
      case 'track-refresh': if (st.trackArgs) loadTrack(st.trackArgs); break;
      case 'my-refresh': loadMy(false); break;
      case 'mark-seen': st.my.forEach(function (o) { st.seen[o.orderId] = o.updatedAt; }); App.store.set(K('oss_seen'), st.seen); renderMy(); renderHeader(); break;
      case 'edit-item': go('admin', 'catalogue'); setTimeout(function () { App.editItem && App.editItem(t.getAttribute('data-id')); }, 80); break;
    }
  }
  function onChange(ev) {
    var id = ev.target.id;
    if (id === 'f-category') { st.form.category = ev.target.value; st.form.itemId = ''; keepForm(renderOrderForm); }
    else if (id === 'f-item') { st.form.itemId = ev.target.value; keepForm(renderOrderForm); }
    else if (ev.target.name === 'f-pay') { st.form.pay = ev.target.value; root.querySelectorAll('.pay-pick .pp').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); renderPayNow(); }
    else if (id === 'cat-sort') { st.sort = ev.target.value; renderItems(); }
    else if (id === 'cat-only') { st.only = ev.target.value; renderItems(); }
    else if (App.adminChange) App.adminChange(ev);
  }
  // re-render the order form but keep what the customer already typed
  function keepForm(fn) {
    var keep = ['quantity', 'preferredDate', 'preferredTime', 'description', 'address', 'name', 'mobile', 'email', 'paymentRef'], v = {};
    keep.forEach(function (k) { v[k] = val(k); });
    fn();
    keep.forEach(function (k) { var e = $('#f-' + k); if (e && v[k] !== '') e.value = v[k]; });
  }
  function onInput(ev) {
    var id = ev.target.id;
    if (id === 'cat-q') { st.q = ev.target.value; renderItems(); }
    else if (id === 'f-quantity') { st.form.qty = ev.target.value; renderEstimate(); }
    else if (App.adminInput) App.adminInput(ev);
  }
  function onSubmit(ev) {
    var id = ev.target.id;
    ev.preventDefault();
    if (id === 'of') return submitOrder();
    if (id === 'payf') return submitPayment(ev.target);
    if (id === 'tf') {
      var oid = $('#t-id').value.trim().toUpperCase(), mob = $('#t-mobile').value, err = $('#t-err');
      if (!oid) { err.textContent = 'Please enter your order number.'; return; }
      if (!App.mobileOk(mob)) { err.textContent = 'Please enter the 10-digit mobile number used for the order.'; return; }
      return loadTrack({ orderId: oid, mobile: mob });
    }
    if (id === 'pf') {
      var nm = $('#p-name').value.trim(), mb = App.mobileOk($('#p-mobile').value);
      if (nm.length < 2 || !mb) { $('#p-err').textContent = 'Please enter your name and a valid 10-digit mobile number.'; return; }
      App.auth.set({ kind: 'phone', name: nm, mobile: mb, email: '', isAdmin: false }, 'signin');
      return;
    }
    if (App.adminSubmit) App.adminSubmit(ev);
  }

  /* hooks used by admin.js */
  App.site = {
    S: function () { return S; }, applySettings: applySettings, st: st, $: function (s) { return $(s); }, go: go, renderAll: renderAll, renderSite: renderSite,
    timeline: timeline, catById: catById, trackLink: trackLink, refreshPublic: function () { return loadPublic().then(renderAll); }
  };
  function renderAdminBar() { if (App.renderAdminBar) App.renderAdminBar(); else $('#adminbar').innerHTML = ''; }
  function renderAdmin() { if (App.renderAdmin) App.renderAdmin(); }
  function loadAdmin(q) { if (App.loadAdmin) App.loadAdmin(q); }
  function markAdminSeen() { if (App.markAdminSeen) App.markAdminSeen(); }

  App.mount = mount;
})();
