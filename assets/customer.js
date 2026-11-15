/* Customer site: choose a service, place an order, track an order. */
(function () {
  'use strict';
  var App = window.App, h = App.h, icon = App.icon, cfg = App.cfg;

  App.mountCustomer = function (root) {
    var st = {
      service: '', paid: 'no', clientRef: App.uid(), sending: false,
      me: App.store.get('oss_me', {}), mine: App.store.get('oss_my_orders', []),
      track: null, trackArgs: null, trackBusy: false, trackErr: '', timer: null
    };
    var $ = function (sel) { return root.querySelector(sel); };

    /* ------------------------------ page shell ------------------------------ */
    function shell() {
      var contact = [];
      if (cfg.PHONE) contact.push('<a href="tel:+91' + h(cfg.PHONE) + '">' + icon('phone', 16) + ' ' + h(cfg.PHONE) + '</a>');
      if (cfg.EMAIL) contact.push('<a href="mailto:' + h(cfg.EMAIL) + '">' + icon('mail', 16) + ' ' + h(cfg.EMAIL) + '</a>');
      root.innerHTML =
        (App.demo ? '<div class="demo-bar"><b>Preview mode</b> - orders are stored only in this browser and no real e-mail is sent.</div>' : '') +
        '<header class="c-top"><div class="c-top-in">' +
          '<a class="brand" href="#top"><span class="brand-logo">' + icon('logo', 30) + '</span><span><div class="brand-name">' + h(cfg.BUSINESS_NAME) + '</div><div class="brand-sub">' + h(cfg.BUSINESS_SUBTITLE) + '</div></span></a>' +
          '<button class="btn ghost sm" data-go="track">' + icon('search', 16) + ' Track order</button>' +
        '</div></header>' +
        (App.isConfigured() ? '' : App.setupBanner()) +
        '<section class="hero" id="top"><div class="c-wrap"><h1>' + h(cfg.TAGLINE) + '</h1>' +
          '<p>Order computer service, networking, CCTV, xerox, printing and design work online. We confirm it, do the work and keep you updated at every step.</p>' +
          '<div class="hero-cta"><button class="btn orange" data-go="order">' + icon('cart', 18) + ' Place an order</button>' +
          '<button class="btn ghost" data-go="track">' + icon('search', 18) + ' Track my order</button></div></div></section>' +
        '<main class="c-wrap c-main">' +
          '<section class="card"><div class="card-h">' + icon('layers') + '<h3>Our services <span class="muted small">- tap one to order</span></h3></div><div class="card-b"><div class="tiles" id="tiles"></div></div></section>' +
          '<section class="card" id="order"></section>' +
          '<section class="card" id="track"></section>' +
          '<section class="card"><div class="card-h">' + icon('check') + '<h3>How it works</h3></div><div class="card-b"><div class="steps">' +
            '<div><b>1</b><span><strong>Tell us the work.</strong><br>Choose the service, describe the work, the count and any advance paid.</span></div>' +
            '<div><b>2</b><span><strong>We confirm and start.</strong><br>The shop accepts your order, tells you the bill amount and begins the work.</span></div>' +
            '<div><b>3</b><span><strong>You stay updated.</strong><br>Track the status here any time. Updates also reach you by e-mail or WhatsApp.</span></div>' +
          '</div></div></section>' +
        '</main>' +
        '<footer class="c-foot"><div class="c-wrap cols"><div><b style="color:#fff">' + h(cfg.BUSINESS_NAME) + '</b><br>' + h(cfg.BUSINESS_SUBTITLE) + (cfg.ADDRESS ? '<br>' + icon('pin', 14) + ' ' + h(cfg.ADDRESS) : '') + '</div>' +
          '<div style="display:flex;gap:16px;flex-wrap:wrap">' + contact.join('') + '</div>' +
          '<div><a href="admin.html" data-admin>Staff login</a></div></div></footer>';
      renderTiles(); renderOrder(); renderTrack();
    }

    function renderTiles() {
      $('#tiles').innerHTML = App.SERVICES.map(function (s) {
        return '<button type="button" class="tile tone-' + s.tone + (st.service === s.id ? ' on' : '') + '" data-service="' + s.id + '">' + icon(s.icon, 38) + '<span>' + h(s.name) + '</span></button>';
      }).join('');
    }

    /* ------------------------------ order form ------------------------------ */
    function renderOrder() {
      var today = App.ymd(new Date());
      var upi = cfg.UPI_ID ? '<div class="pay-box"><div class="lbl">Pay advance by UPI (optional)</div><div style="margin:6px 0"><code id="upi-id">' + h(cfg.UPI_ID) + '</code>' + (cfg.UPI_NAME ? ' <span class="muted small">(' + h(cfg.UPI_NAME) + ')</span>' : '') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" data-copy-upi>' + icon('copy', 15) + ' Copy UPI ID</button><a class="btn ghost sm" id="upi-link" href="#">' + icon('rupee', 15) + ' Open UPI app</a></div>' +
        '<div class="hint" style="margin-top:6px">After paying, choose "Yes" below and enter the amount and the UPI reference number.</div></div>' : '';
      $('#order').innerHTML =
        '<div class="card-h">' + icon('cart') + '<h3>Place an order</h3></div><div class="card-b"><form id="f" novalidate>' +
          '<div class="field"><label for="f-service">Service required</label><select class="input" id="f-service"><option value="">Choose a service...</option>' +
            App.SERVICES.map(function (s) { return '<option value="' + s.id + '"' + (st.service === s.id ? ' selected' : '') + '>' + h(s.name) + '</option>'; }).join('') + '</select><div class="err" data-e="service"></div></div>' +
          '<div class="field"><label for="f-description">Describe the work</label><textarea class="input" id="f-description" maxlength="2000" placeholder="What exactly do you need?"></textarea><div class="hint" id="desc-hint"></div><div class="err" data-e="description"></div></div>' +
          '<div class="grid3">' +
            '<div class="field"><label for="f-quantity">Count <span class="opt" id="unit"></span></label><input class="input" id="f-quantity" type="number" inputmode="numeric" min="1" max="100000" value="1"><div class="err" data-e="quantity"></div></div>' +
            '<div class="field"><label for="f-preferredDate">Preferred date <span class="opt">(optional)</span></label><input class="input" id="f-preferredDate" type="date" min="' + today + '"><div class="err" data-e="preferredDate"></div></div>' +
            '<div class="field"><label for="f-preferredTime">Preferred time <span class="opt">(optional)</span></label><input class="input" id="f-preferredTime" type="time"><div class="err" data-e="preferredTime"></div></div>' +
          '</div>' +
          '<div class="field"><label for="f-address">Address / location <span class="opt" id="addr-opt">(optional - for work at your place)</span></label><input class="input" id="f-address" maxlength="300" autocomplete="street-address"></div>' +
          '<h4 class="sub-h">Your contact details</h4>' +
          '<div class="grid3">' +
            '<div class="field"><label for="f-name">Your name</label><input class="input" id="f-name" maxlength="80" autocomplete="name" value="' + h(st.me.name || '') + '"><div class="err" data-e="name"></div></div>' +
            '<div class="field"><label for="f-mobile">Mobile number</label><input class="input" id="f-mobile" type="tel" inputmode="numeric" maxlength="14" autocomplete="tel-national" placeholder="10-digit mobile" value="' + h(st.me.mobile || '') + '"><div class="err" data-e="mobile"></div></div>' +
            '<div class="field"><label for="f-email">E-mail <span class="opt">(optional - for updates)</span></label><input class="input" id="f-email" type="email" maxlength="120" autocomplete="email" value="' + h(st.me.email || '') + '"><div class="err" data-e="email"></div></div>' +
          '</div>' +
          '<h4 class="sub-h">Payment details</h4>' + upi +
          '<div class="field"><span class="lbl">Have you paid any advance?</span><div><div class="seg" role="group"><button type="button" data-paid="no" class="' + (st.paid === 'no' ? 'on' : '') + '">No</button><button type="button" data-paid="yes" class="' + (st.paid === 'yes' ? 'on' : '') + '">Yes</button></div></div></div>' +
          '<div id="pay-fields" class="' + (st.paid === 'yes' ? '' : 'hide') + '"><div class="grid3">' +
            '<div class="field"><label for="f-advanceClaimed">Advance amount paid (₹)</label><input class="input" id="f-advanceClaimed" type="number" inputmode="decimal" min="1" step="any"><div class="err" data-e="advanceClaimed"></div></div>' +
            '<div class="field"><label for="f-advanceMode">Paid by</label><select class="input" id="f-advanceMode"><option value="">Choose...</option>' + App.PAY_MODES.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select><div class="err" data-e="advanceMode"></div></div>' +
            '<div class="field"><label for="f-advanceRef">Reference / UTR no. <span class="opt">(optional)</span></label><input class="input" id="f-advanceRef" maxlength="60"></div>' +
          '</div><div class="hint" style="margin:-6px 0 12px">The shop will verify the advance and it will then show as "Paid" in your order.</div></div>' +
          '<div class="sr" aria-hidden="true"><label>Leave this empty <input id="f-website" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="err" id="form-err" style="margin-bottom:10px"></div>' +
          '<button class="btn orange block" id="submit" type="submit">' + icon('check', 18) + ' Place order</button>' +
          '<p class="hint" style="margin-top:10px;text-align:center">The final bill amount is confirmed by the shop after seeing your request.</p>' +
        '</form></div>';
      syncService();
    }

    function syncService() {
      var s = null;
      App.SERVICES.forEach(function (x) { if (x.id === st.service) s = x; });
      var unit = $('#unit'), hint = $('#desc-hint'), sel = $('#f-service'), addr = $('#addr-opt');
      if (sel) sel.value = st.service;
      if (unit) unit.textContent = s ? '(' + s.unit + ')' : '';
      if (hint) hint.textContent = s ? s.hint : '';
      if (addr) addr.textContent = s && s.onsite ? '(where the work is to be done)' : '(optional - for work at your place)';
      var tiles = root.querySelectorAll('#tiles .tile');
      for (var i = 0; i < tiles.length; i++) tiles[i].classList.toggle('on', tiles[i].getAttribute('data-service') === st.service);
    }

    function val(id) { var e = $('#f-' + id); return e ? String(e.value).trim() : ''; }
    function showErrors(errs) {
      var nodes = root.querySelectorAll('#f [data-e]'), first = null;
      for (var i = 0; i < nodes.length; i++) {
        var k = nodes[i].getAttribute('data-e'); nodes[i].textContent = errs[k] || '';
        var inp = $('#f-' + k); if (inp) inp.classList.toggle('bad', !!errs[k]);
        if (errs[k] && !first) first = inp;
      }
      if (first) { first.focus(); try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
    }

    function submitOrder() {
      if (st.sending) return;
      var d = {
        service: val('service'), description: val('description'), quantity: val('quantity'),
        preferredDate: val('preferredDate'), preferredTime: val('preferredTime'), address: val('address'),
        name: val('name'), mobile: val('mobile'), email: val('email'), website: val('website'),
        advanceClaimed: st.paid === 'yes' ? val('advanceClaimed') : '', advanceMode: st.paid === 'yes' ? val('advanceMode') : '', advanceRef: st.paid === 'yes' ? val('advanceRef') : '',
        clientRef: st.clientRef
      };
      var e = {};
      if (!d.service) e.service = 'Please choose a service.';
      if (d.description.length < 5) e.description = 'Please describe the work in a few words.';
      var q = Number(d.quantity);
      if (!(q >= 1 && q <= 100000) || Math.floor(q) !== q) e.quantity = 'Enter a whole number, 1 or more.';
      if (d.preferredDate && d.preferredDate < App.ymd(new Date())) e.preferredDate = 'Please choose today or a later date.';
      if (d.name.length < 2) e.name = 'Please enter your name.';
      if (!App.mobileOk(d.mobile)) e.mobile = 'Enter a valid 10-digit mobile number.';
      if (d.email && !App.emailOk(d.email)) e.email = 'This e-mail address does not look right.';
      if (st.paid === 'yes') {
        if (!(Number(d.advanceClaimed) > 0)) e.advanceClaimed = 'Enter the amount you paid.';
        if (!d.advanceMode) e.advanceMode = 'Choose how you paid.';
      }
      showErrors(e);
      $('#form-err').textContent = '';
      if (Object.keys(e).length) return;

      st.sending = true;
      var btn = $('#submit'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Placing your order...';
      App.api('createOrder', d).then(function (res) {
        st.sending = false;
        st.me = { name: d.name, mobile: App.mobileOk(d.mobile), email: d.email }; App.store.set('oss_me', st.me);
        st.mine = [{ orderId: res.orderId, key: res.trackKey, service: d.service, at: new Date().toISOString() }].concat(st.mine).slice(0, 12);
        App.store.set('oss_my_orders', st.mine);
        st.clientRef = App.uid();
        renderDone(res, d);
      }, function (err) {
        st.sending = false; btn.disabled = false; btn.innerHTML = icon('check', 18) + ' Place order';
        if (err.code === 'INVALID' && err.data && err.data.field) { var o = {}; o[err.data.field] = err.message; showErrors(o); }
        else $('#form-err').textContent = err.message;
      });
    }

    function trackLink(orderId, key) {
      if (App.demo || !key) return '';
      return location.origin + location.pathname.replace(/index\.html$/, '') + '?t=' + encodeURIComponent(orderId + '.' + key);
    }

    function renderDone(res, d) {
      var link = trackLink(res.orderId, res.trackKey);
      var wa = cfg.WHATSAPP ? '<a class="btn wa" target="_blank" rel="noopener" href="' + h(App.waLink(cfg.WHATSAPP, 'Order ' + res.orderId + ' - ' + d.name + '. I am sending the files / details for this order.')) + '">' + icon('chat', 18) + ' Send files on WhatsApp</a>' : '';
      $('#order').innerHTML = '<div class="done"><div class="tick">' + icon('check', 34) + '</div>' +
        '<h3>Order placed. Thank you, ' + h(d.name) + '!</h3><p class="muted">Your order number is</p><div class="oid" id="new-oid">' + h(res.orderId) + '</div>' +
        '<p class="muted">Please keep this number. ' + (d.email ? (res.emailed ? 'A confirmation has been e-mailed to you.' : 'Your order is saved (the confirmation e-mail could not be sent just now).') : 'Use it with your mobile number to check the status any time.') + '</p>' +
        '<div class="row"><button class="btn" data-track-new="' + h(res.orderId) + '">' + icon('search', 18) + ' Track this order</button>' + wa +
        (link ? '<button class="btn ghost" data-copy="' + h(link) + '">' + icon('link', 18) + ' Copy tracking link</button>' : '') +
        '<button class="btn ghost" data-again>' + icon('plus', 18) + ' Place another order</button></div></div>';
      try { $('#order').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      renderTrack();
    }

    /* ------------------------------ tracking ------------------------------ */
    function renderTrack() {
      var mine = st.mine.length ? '<div class="hint" style="margin-top:12px">Your recent orders on this device:</div><div class="mine">' + st.mine.map(function (m, i) {
        return '<button type="button" class="chip" data-mine="' + i + '">' + h(m.orderId) + '</button>';
      }).join('') + '</div>' : '';
      $('#track').innerHTML = '<div class="card-h">' + icon('search') + '<h3>Track your order</h3></div><div class="card-b">' +
        '<form id="tf" novalidate><div class="grid3"><div class="field"><label for="t-id">Order number</label><input class="input" id="t-id" placeholder="e.g. SR-0012" maxlength="14" autocapitalize="characters"></div>' +
        '<div class="field"><label for="t-mobile">Mobile number used for the order</label><input class="input" id="t-mobile" type="tel" inputmode="numeric" maxlength="14" value="' + h(st.me.mobile || '') + '"></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn block" id="t-go" type="submit">' + icon('search', 18) + ' Check status</button></div></div></form>' +
        '<div class="err" id="t-err">' + h(st.trackErr) + '</div>' + mine + '<div id="t-result"></div></div>';
      renderTrackResult();
    }

    function renderTrackResult() {
      var box = $('#t-result'); if (!box) return;
      var o = st.track;
      if (!o) { box.innerHTML = ''; return; }
      var flow = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed'], at = flow.indexOf(o.status);
      var stepper = o.status === 'Cancelled' ? '<div class="note warn" style="margin:14px 0">This order was cancelled. Please contact the shop if this is unexpected.</div>' :
        '<div class="stepper">' + flow.map(function (s, i) {
          var cls = i < at || o.status === 'Completed' ? 'done-s' : (i === at ? 'now' : '');
          return '<div class="st ' + cls + '"><div class="dot">' + (cls === 'done-s' ? icon('check', 15) : '') + '</div>' + (s === 'Pending' ? 'Received' : s) + '</div>';
        }).join('') + '</div>';
      var amounts = (o.amountQuoted > 0 || o.amountPaid > 0) ? '<div class="amounts"><div><span class="muted small">Bill amount</span><b>' + (o.amountQuoted > 0 ? App.money(o.amountQuoted) : 'To be confirmed') + '</b></div>' +
        '<div class="paid"><span class="muted small">Paid</span><b>' + App.money(o.amountPaid) + '</b></div><div class="due"><span class="muted small">Balance</span><b>' + (o.amountQuoted > 0 ? App.money(o.balance) : '-') + '</b></div></div>' : '';
      var adv = o.advanceClaimed > 0 && !o.advanceVerified ? '<div class="note" style="margin:10px 0">Advance of <b>' + App.money(o.advanceClaimed) + '</b> reported by you is being verified by the shop.</div>' : '';
      box.innerHTML = '<div style="border-top:1px solid var(--line);margin-top:16px;padding-top:16px">' +
        '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="font-size:20px">' + h(o.orderId) + '</h3>' + App.pill(o.status) + '<span class="sp" style="flex:1"></span>' +
        '<button class="btn ghost sm" data-track-refresh>' + icon('refresh', 15) + ' Refresh</button></div>' +
        '<p class="muted" style="margin-top:4px">' + h(App.STATUS_TEXT[o.status] || '') + '</p>' + stepper + amounts + adv +
        '<dl class="kv" style="margin:12px 0 16px"><dt>Service</dt><dd>' + h(o.service) + '</dd><dt>Count</dt><dd>' + h(o.quantity) + '</dd><dt>Work</dt><dd>' + App.nl2br(o.description) + '</dd>' +
        (o.preferredDate ? '<dt>Preferred</dt><dd>' + h(App.fmtDate(o.preferredDate)) + (o.preferredTime ? ', ' + h(App.fmtClock(o.preferredTime)) : '') + '</dd>' : '') +
        '<dt>Placed on</dt><dd>' + h(App.fmtDateTime(o.createdAt)) + '</dd></dl>' +
        '<h4 class="sub-h" style="margin-top:0">Updates</h4><ul class="timeline">' + o.timeline.slice().reverse().map(function (t) {
          var title = t.type === 'created' ? 'Order placed' : t.type === 'payment' ? 'Payment' : t.status ? 'Status: ' + t.status : 'Message from the shop';
          return '<li><b>' + h(title) + '</b><div class="when">' + h(App.fmtDateTime(t.at)) + '</div>' + (t.message ? '<div>' + App.nl2br(t.message) + '</div>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }

    function loadTrack(args, quiet) {
      if (st.trackBusy) return;
      st.trackBusy = true; st.trackArgs = args;
      var btn = $('#t-go'); if (btn && !quiet) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Checking...'; }
      var err = $('#t-err'); if (err && !quiet) err.textContent = '';
      App.api('trackOrder', args).then(function (o) {
        st.trackBusy = false; st.track = o; st.trackErr = '';
        if (btn) { btn.disabled = false; btn.innerHTML = icon('search', 18) + ' Check status'; }
        var idBox = $('#t-id'); if (idBox && !idBox.value) idBox.value = o.orderId;
        renderTrackResult();
        if (!quiet) { try { $('#t-result').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }
        clearInterval(st.timer);
        if (o.status !== 'Completed' && o.status !== 'Cancelled') st.timer = setInterval(function () { if (document.visibilityState !== 'hidden' && st.trackArgs) loadTrack(st.trackArgs, true); }, 60000);
      }, function (e) {
        st.trackBusy = false;
        if (btn) { btn.disabled = false; btn.innerHTML = icon('search', 18) + ' Check status'; }
        if (!quiet) { st.track = null; renderTrackResult(); if (err) err.textContent = e.message; }
      });
    }

    function go(id) { var el = $('#' + id); if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); } } }

    /* ------------------------------ events ------------------------------ */
    root.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-go],[data-service],[data-paid],[data-track-new],[data-copy],[data-again],[data-mine],[data-track-refresh],[data-copy-upi],#upi-link,.brand');
      if (!t) return;
      if (t.classList.contains('brand')) { ev.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (t.hasAttribute('data-go')) return go(t.getAttribute('data-go'));
      if (t.hasAttribute('data-service')) {
        st.service = t.getAttribute('data-service');
        if (!$('#f')) renderOrder(); else syncService();
        go('order'); var d = $('#f-description'); if (d) setTimeout(function () { d.focus({ preventScroll: true }); }, 450);
        return;
      }
      if (t.hasAttribute('data-paid')) {
        st.paid = t.getAttribute('data-paid');
        var b = root.querySelectorAll('[data-paid]'); for (var i = 0; i < b.length; i++) b[i].classList.toggle('on', b[i] === t);
        $('#pay-fields').classList.toggle('hide', st.paid !== 'yes');
        return;
      }
      if (t.hasAttribute('data-track-new')) { var m = st.mine[0]; loadTrack({ orderId: m.orderId, key: m.key }); go('track'); return; }
      if (t.hasAttribute('data-mine')) { var x = st.mine[+t.getAttribute('data-mine')]; if (x) loadTrack({ orderId: x.orderId, key: x.key }); return; }
      if (t.hasAttribute('data-copy')) return App.copy(t.getAttribute('data-copy'), 'Tracking link copied');
      if (t.hasAttribute('data-copy-upi')) return App.copy(cfg.UPI_ID, 'UPI ID copied');
      if (t.hasAttribute('data-again')) { st.paid = 'no'; renderOrder(); go('order'); return; }
      if (t.hasAttribute('data-track-refresh')) { if (st.trackArgs) loadTrack(st.trackArgs); return; }
      if (t.id === 'upi-link') {
        var amt = Number(val('advanceClaimed')) > 0 ? '&am=' + encodeURIComponent(Number(val('advanceClaimed')).toFixed(2)) : '';
        t.setAttribute('href', 'upi://pay?pa=' + encodeURIComponent(cfg.UPI_ID) + '&pn=' + encodeURIComponent(cfg.UPI_NAME || cfg.BUSINESS_NAME) + amt + '&cu=INR');
      }
    });
    root.addEventListener('change', function (ev) { if (ev.target.id === 'f-service') { st.service = ev.target.value; syncService(); } });
    root.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (ev.target.id === 'f') return submitOrder();
      if (ev.target.id === 'tf') {
        var id = $('#t-id').value.trim(), mob = $('#t-mobile').value.trim(), err = $('#t-err');
        if (!id) { err.textContent = 'Please enter your order number.'; return; }
        if (!App.mobileOk(mob)) { err.textContent = 'Please enter the 10-digit mobile number used for the order.'; return; }
        loadTrack({ orderId: id, mobile: mob });
      }
    });

    shell();

    // open a tracking link such as  .../?t=SR-0012.abcdef...
    try {
      var m = /[?&]t=([^&#]+)/.exec(location.search);
      if (m) {
        var parts = decodeURIComponent(m[1]).split('.');
        if (parts.length === 2) { loadTrack({ orderId: parts[0], key: parts[1] }); setTimeout(function () { go('track'); }, 300); }
      }
    } catch (e) {}
  };
})();
