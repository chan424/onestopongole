/* DEMO MODE backend: behaves like apps-script/Code.gs but keeps everything in this
   browser (localStorage). Used when API_URL is empty, DEMO_MODE is true, or ?demo=1.
   Nothing here is shared with other people or devices. */
(function () {
  'use strict';
  var KEY = 'oss_demo_db_v2';
  var STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed', 'Cancelled'];
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function err(code, message, data) { return { ok: false, error: { code: code, message: message, data: data || null } }; }
  function now() { return new Date().toISOString(); }
  function key16() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); }
  function admins() { return ((window.APP_CONFIG || {}).ADMIN_EMAILS || []).map(function (e) { return String(e).toLowerCase(); }); }

  /* Same rules as bulkUpsertItems_ in Code.gs: match a service by name, a category by name or id. */
  function mergeItems(catalogue, rows) {
    var cat = clone(catalogue), added = 0, updated = 0, newCats = [];
    var tones = ['blue', 'green', 'indigo', 'violet', 'red', 'purple', 'orange', 'teal'];
    function slug(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }
    rows.forEach(function (r) {
      var cname = String(r.category || '').trim(), key = String(r.name || '').trim().toLowerCase(), c = null, it = null;
      cat.categories.forEach(function (x) { if (x.name.toLowerCase() === cname.toLowerCase() || x.id.toLowerCase() === cname.toLowerCase()) c = x; });
      if (!c) {
        var id = slug(cname) || ('cat' + (cat.categories.length + 1));
        while (cat.categories.some(function (x) { return x.id === id; })) id += '1';
        c = { id: id, name: cname, desc: '', icon: 'layers', tone: tones[cat.categories.length % tones.length], order: cat.categories.length + 1, active: true };
        cat.categories.push(c); newCats.push(cname);
      }
      cat.items.forEach(function (x) { if (String(x.name).toLowerCase() === key) it = x; });
      var v = { category: c.id, name: String(r.name).trim(), price: Math.round(Number(r.price) * 100) / 100 };
      if (r.unit) v.unit = String(r.unit); if (r.desc) v.desc = String(r.desc);
      if (r.active !== undefined && r.active !== '') v.active = r.active !== false;
      if (r.popular !== undefined && r.popular !== '') v.popular = !!r.popular;
      if (r.onsite !== undefined && r.onsite !== '') v.onsite = !!r.onsite;
      if (it) { Object.assign(it, v); updated++; }
      else { cat.items.push(Object.assign({ id: c.id.slice(0, 3) + '-' + slug(v.name).slice(0, 18) + '-' + Date.now().toString(36).slice(-4) + added, unit: 'per item', desc: '', active: true, popular: false, onsite: false }, v)); added++; }
    });
    return { catalogue: cat, added: added, updated: updated, newCategories: newCats };
  }

  function seed() {
    var cat = clone(window.DEFAULT_CATALOGUE);
    function item(id) { for (var i = 0; i < cat.items.length; i++) if (cat.items[i].id === id) return cat.items[i]; }
    function catName(id) { for (var i = 0; i < cat.categories.length; i++) if (cat.categories[i].id === id) return cat.categories[i].name; }
    var samples = [
      ['v-4cam', 1, 'Ravi Kumar', '9848012345', 'ravi@example.com', 'Shop CCTV with mobile view', 'In Progress', 14999, 5000, 9],
      ['c-os', 1, 'Lakshmi P', '9701234567', '', 'Laptop very slow, need fresh Windows 11', 'Ready', 500, 0, 4],
      ['x-spiral', 3, 'Sai Teja', '9912345678', 'demo.customer@gmail.com', 'Project report 3 copies, spiral', 'Completed', 120, 120, 6],
      ['d-flex', 18, 'Sri Venkateswara Traders', '9866012345', '', 'Shop opening flex 6x3 ft', 'Confirmed', 216, 100, 2],
      ['n-wifi', 1, 'Anjali Reddy', '9550123456', 'anjali@example.com', 'New router at home, coverage in 2 rooms', 'Pending', 0, 0, 0.2],
      ['p-colour', 40, 'Mahesh B', '9000012345', 'demo.customer@gmail.com', 'Colour print of seminar slides', 'Pending', 0, 0, 0.05],
      ['c-recovery', 1, 'Kiran', '9390012345', '', 'Pen drive not detected, need photos back', 'Cancelled', 0, 0, 12]
    ];
    var orders = samples.map(function (s, i) {
      var it = item(s[0]), created = new Date(Date.now() - s[9] * 86400000).toISOString();
      var tl = [{ at: created, type: 'created', status: 'Pending', message: '', visible: true }];
      if (s[6] !== 'Pending') tl.push({ at: new Date(Date.parse(created) + 3600000).toISOString(), type: 'status', status: s[6], message: s[6] === 'Ready' ? 'Your laptop is ready for pickup.' : '', visible: true });
      return { orderId: 'SR-' + ('000' + (i + 1)).slice(-4), createdAt: created, updatedAt: tl[tl.length - 1].at, status: s[6], service: it.category, serviceName: catName(it.category),
        itemId: it.id, itemName: it.name, unitPrice: it.price, unit: it.unit, quantity: s[1], estimate: it.price * s[1], description: s[5], preferredDate: '', preferredTime: '',
        address: it.onsite ? 'Kurnool Road, Ongole' : '', name: s[2], mobile: s[3], email: s[4], customerEmail: s[4] === 'demo.customer@gmail.com' ? s[4] : '', source: 'website',
        amountQuoted: s[7], amountPaid: s[8], adminNotes: '', timeline: tl, trackKey: key16(), clientRef: '' };
    });
    return { catalogue: cat, settings: {}, orders: orders, outbox: [] };
  }
  function load() { var d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} if (!d) { d = seed(); save(d); } return d; }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function user(token) {
    var m = /^demo:(.+)$/.exec(token || ''); if (!m) return null;
    var email = m[1].toLowerCase();
    return { email: email, name: email.split('@')[0], isAdmin: admins().indexOf(email) >= 0 };
  }
  function pub(o) {
    var q = Number(o.amountQuoted) || 0, p = Number(o.amountPaid) || 0;
    return { orderId: o.orderId, createdAt: o.createdAt, updatedAt: o.updatedAt, status: o.status, service: o.serviceName, itemName: o.itemName, unitPrice: o.unitPrice, unit: o.unit,
      quantity: o.quantity, estimate: o.estimate, description: o.description, preferredDate: o.preferredDate, preferredTime: o.preferredTime, amountQuoted: q, amountPaid: p,
      balance: Math.max(0, q - p), trackKey: o.trackKey, paymentMethod: o.paymentMethod || 'COD', paymentStatus: o.paymentStatus || 'COD', paymentRef: o.paymentRef || '', timeline: o.timeline.filter(function (t) { return t.visible !== false; }) };
  }
  function adm(o) { var c = clone(o); c.amountQuoted = Number(c.amountQuoted) || 0; c.amountPaid = Number(c.amountPaid) || 0; c.balance = Math.max(0, c.amountQuoted - c.amountPaid); return c; }
  function find(d, id) { id = String(id || '').trim().toUpperCase(); for (var i = 0; i < d.orders.length; i++) if (d.orders[i].orderId === id) return d.orders[i]; return null; }
  function mobile(v) { var x = String(v || '').replace(/\D/g, ''); if (x.length === 12 && x.indexOf('91') === 0) x = x.slice(2); return /^[6-9]\d{9}$/.test(x) ? x : ''; }
  function notify(d, to, subject, via) {
    d.outbox.unshift({ at: now(), to: to, subject: subject, via: via || 'E-mail' });
    d.outbox = d.outbox.slice(0, 50);
  }

  function handle(body) {
    var p = JSON.parse(body), d = load(), u = user(p.idToken), o;
    function needAdmin() { if (!u) return err('AUTH', 'Please sign in.'); if (!u.isAdmin) return err('FORBIDDEN', 'This account is not an admin.'); return null; }
    var deny;
    switch (p.action) {
      case 'ping': return { ok: true, data: { version: 'demo' } };
      case 'getPublic':
        return { ok: true, data: { catalogue: { categories: d.catalogue.categories.filter(function (c) { return c.active !== false; }), items: d.catalogue.items.filter(function (i) { return i.active !== false; }) }, settings: d.settings, version: 'demo' } };
      case 'whoami': return u ? { ok: true, data: u } : err('AUTH', 'Please sign in.');
      case 'createOrder': {
        if (p.website) return err('INVALID', 'Request rejected.');
        var it = null; d.catalogue.items.forEach(function (i) { if (i.id === p.itemId) it = i; });
        var svc = p.service || (it && it.category) || '', cn = svc;
        d.catalogue.categories.forEach(function (c) { if (c.id === svc) cn = c.name; });
        var q = Math.floor(Number(p.quantity));
        if (!svc) return err('INVALID', 'Please choose a service.', { field: 'service' });
        if (!(q >= 1)) return err('INVALID', 'Enter a whole number, 1 or more.', { field: 'quantity' });
        if (String(p.name || '').trim().length < 2) return err('INVALID', 'Please enter your name.', { field: 'name' });
        if (!mobile(p.mobile)) return err('INVALID', 'Enter a valid 10-digit mobile number.', { field: 'mobile' });
        if (p.clientRef) { for (var i = 0; i < d.orders.length; i++) if (d.orders[i].clientRef === p.clientRef) return { ok: true, data: { orderId: d.orders[i].orderId, trackKey: d.orders[i].trackKey, order: pub(d.orders[i]) } }; }
        var max = 0; d.orders.forEach(function (x) { var m = /(\d+)$/.exec(x.orderId); if (m) max = Math.max(max, +m[1]); });
        var asAdmin = u && u.isAdmin && p.asAdmin, t = now();
        o = { orderId: 'SR-' + ('000' + (max + 1)).slice(-4), createdAt: t, updatedAt: t, status: 'Pending', service: svc, serviceName: cn, itemId: it ? it.id : '', itemName: it ? it.name : '',
          unitPrice: it ? it.price : 0, unit: it ? it.unit : '', quantity: q, estimate: it ? it.price * q : 0, description: String(p.description || '').trim(), preferredDate: p.preferredDate || '',
          preferredTime: p.preferredTime || '', address: p.address || '', name: String(p.name).trim(), mobile: mobile(p.mobile), email: String(p.email || (u && !asAdmin ? u.email : '')).toLowerCase(),
          customerEmail: u && !asAdmin ? u.email : '', source: asAdmin ? 'admin' : 'website', amountQuoted: 0, amountPaid: 0, adminNotes: '',
          timeline: [{ at: t, type: 'created', status: 'Pending', message: '', visible: true }], trackKey: key16(), clientRef: p.clientRef || '',
          paymentMethod: p.paymentMethod === 'PhonePe' ? 'PhonePe' : 'COD', paymentRef: String(p.paymentRef || '').trim().slice(0, 60) };
        o.paymentStatus = o.paymentMethod === 'COD' ? 'COD' : (o.paymentRef ? 'Paid - pending verification' : 'Awaiting payment');
        o.timeline[0].message = o.paymentMethod === 'PhonePe' ? 'Payment: PhonePe / UPI' + (o.paymentRef ? ' (UTR ' + o.paymentRef + ') - waiting for the shop to verify.' : ' - not paid yet.') : 'Payment: Cash on Delivery';
        d.orders.unshift(o);
        notify(d, admins().join(', '), 'New order ' + o.orderId + ' - ' + o.name);
        if (o.email) notify(d, o.email, 'Order ' + o.orderId + ' received');
        save(d);
        return { ok: true, data: { orderId: o.orderId, trackKey: o.trackKey, emailed: !!o.email, order: asAdmin ? adm(o) : pub(o), demoNotified: o.email ? 'admins + customer' : 'admins' } };
      }
      case 'trackOrder':
        o = find(d, p.orderId);
        if (!o || (p.key ? p.key !== o.trackKey : mobile(p.mobile) !== o.mobile)) return err('NOT_FOUND', 'No order found with that number and mobile. Please check and try again.');
        return { ok: true, data: pub(o) };
      case 'submitPayment': {
        o = find(d, p.orderId);
        var ref = String(p.paymentRef || '').trim();
        if (ref.length < 6) return err('INVALID', 'Please enter the UPI transaction / UTR number (at least 6 characters).', { field: 'paymentRef' });
        if (!o || p.key !== o.trackKey) return err('NOT_FOUND', 'Order not found.');
        o.paymentMethod = 'PhonePe'; o.paymentStatus = 'Paid - pending verification'; o.paymentRef = ref; o.updatedAt = now();
        o.timeline.push({ at: o.updatedAt, type: 'payment', message: 'Customer paid by PhonePe / UPI. UTR: ' + ref + ' - waiting for the shop to verify.', visible: true });
        notify(d, admins().join(', '), 'Payment reported for ' + o.orderId + ' - UTR ' + ref); save(d);
        return { ok: true, data: pub(o) };
      }
      case 'myOrders':
        if (!u) return err('AUTH', 'Please sign in.');
        return { ok: true, data: { user: u, orders: d.orders.filter(function (x) { return x.customerEmail === u.email || x.email === u.email; }).map(pub) } };
      case 'adminData':
        if ((deny = needAdmin())) return deny;
        return { ok: true, data: { orders: d.orders.map(adm), catalogue: d.catalogue, settings: d.settings, admins: admins(), channels: { email: true, callmebot: false, whatsappCloud: false, fast2sms: false }, outbox: d.outbox, emailQuota: 100, version: 'demo' } };
      case 'updateOrder': {
        if ((deny = needAdmin())) return deny;
        o = find(d, p.orderId); if (!o) return err('NOT_FOUND', 'Order not found.');
        if (p.rev && p.rev !== o.updatedAt) return err('CONFLICT', 'This order was changed by someone else. The latest version has been loaded.');
        var t2 = now(), sc = false, ch = false, msg = String(p.message || '').trim();
        if (p.status !== undefined && p.status !== o.status) { if (STATUSES.indexOf(p.status) < 0) return err('INVALID', 'Unknown status.'); o.status = p.status; sc = ch = true; }
        if (p.amountQuoted !== undefined && p.amountQuoted !== '' && Number(p.amountQuoted) !== Number(o.amountQuoted)) { o.amountQuoted = Math.max(0, Number(p.amountQuoted) || 0); ch = true; }
        if (p.amountPaid !== undefined && p.amountPaid !== '' && Number(p.amountPaid) !== Number(o.amountPaid)) {
          var diff = Number(p.amountPaid) - Number(o.amountPaid || 0); o.amountPaid = Math.max(0, Number(p.amountPaid) || 0); ch = true;
          o.timeline.push({ at: t2, type: 'payment', message: 'Payment received: Rs ' + Math.abs(diff) + '. Total paid Rs ' + o.amountPaid, visible: true, by: u.email });
        }
        if (p.adminNotes !== undefined && p.adminNotes !== o.adminNotes) { o.adminNotes = String(p.adminNotes); ch = true; }
        if (p.paymentStatus !== undefined && p.paymentStatus !== (o.paymentStatus || 'COD')) {
          o.paymentStatus = p.paymentStatus; ch = true;
          o.timeline.push({ at: t2, type: 'payment', message: 'Payment status: ' + o.paymentStatus, visible: true, by: u.email });
        }
        if (sc || msg) { o.timeline.push({ at: t2, type: sc ? 'status' : 'note', status: sc ? o.status : '', message: msg, visible: p.visible !== false, by: u.email }); ch = true; }
        if (!ch) return err('INVALID', 'Nothing to save.');
        o.updatedAt = t2;
        var notified = false;
        if (p.notify !== false && p.visible !== false && (sc || msg) && (o.email || o.customerEmail)) { notify(d, o.email || o.customerEmail, 'Order ' + o.orderId + ' update: ' + o.status); notified = true; }
        save(d);
        var out = adm(o); out.notified = notified; return { ok: true, data: out };
      }
      case 'saveCatalogue':
        if ((deny = needAdmin())) return deny;
        if (!p.categories || !p.categories.length) return err('INVALID', 'Add at least one category.');
        d.catalogue = { categories: p.categories, items: p.items || [] }; save(d);
        return { ok: true, data: d.catalogue };
      case 'bulkUpsertItems': {
        if ((deny = needAdmin())) return deny;
        if (!p.rows || !p.rows.length) return err('INVALID', 'No rows to save.');
        var mr = mergeItems(d.catalogue, p.rows); d.catalogue = mr.catalogue; save(d);
        return { ok: true, data: mr };
      }
      case 'saveSettings':
        if ((deny = needAdmin())) return deny;
        d.settings = Object.assign({}, d.settings, p.settings || {}); save(d);
        return { ok: true, data: d.settings };
      case 'testNotify':
        if ((deny = needAdmin())) return deny;
        notify(d, u.email, 'Test e-mail from your website'); save(d);
        return { ok: true, data: { sentTo: u.email, channels: { email: true } } };
      case 'demoReset':
        localStorage.removeItem(KEY); load(); return { ok: true, data: true };
      default: return err('INVALID', 'Unknown action: ' + p.action);
    }
  }
  window.DemoBackend = { handle: handle, mergeItems: mergeItems, reset: function () { localStorage.removeItem(KEY); } };
})();
