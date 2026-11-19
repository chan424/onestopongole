/**
 * =====================================================================
 *  YOUR ONE STOP SOLUTION - website backend (Google Apps Script)
 * =====================================================================
 *  Stores orders, the service catalogue and shop settings in a Google
 *  Sheet, verifies Google Sign-In for admins and customers, and sends
 *  e-mail (and optional WhatsApp / SMS) notifications.
 *
 *  HOW TO INSTALL (full steps in SETUP-GUIDE.md, Part 1):
 *   1. Open your Google Sheet > Extensions > Apps Script.
 *   2. Delete everything in Code.gs and paste this whole file.
 *   3. Fill in GOOGLE_CLIENT_ID below (same value as in config.js).
 *   4. Choose the function "setup" at the top and press Run (allow access).
 *   5. Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy.
 *      (First time: Deploy > New deployment > Web app, Execute as: Me,
 *       Who has access: Anyone.)  Copy the /exec URL into config.js API_URL.
 * =====================================================================
 */

/* ------------------------- 1. YOUR SETTINGS ------------------------- */

// ONLY these Google accounts get admin powers. This is the real security check.
var ADMIN_EMAILS = ['dataongole@gmail.com', 'rajub.369@gmail.com'];

// Google Sign-In Client ID (from Google Cloud Console). Must match config.js.
var GOOGLE_CLIENT_ID = '439773724689-sj1744d6adfq7qn7mr1h0nhtqa212j8g.apps.googleusercontent.com';

// Leave '' if this script was opened from the Sheet (Extensions > Apps Script).
// Otherwise paste the Sheet ID (the long code in the Sheet's web address).
var SHEET_ID = '';

// Order numbers look like SR-0001
var ORDER_PREFIX = 'SR-';

// E-mail notifications (free, uses your Gmail: about 100 e-mails per day)
var EMAIL_ADMINS_ON_NEW_ORDER = true;
var EMAIL_CUSTOMER_ON_NEW_ORDER = true;
var EMAIL_CUSTOMER_ON_STATUS_CHANGE = true;

/*
 * OPTIONAL automatic WhatsApp / SMS (all OFF by default).
 * Do NOT type secret keys in this file if you keep a copy on GitHub.
 * Put them in Apps Script > Project Settings (gear) > Script properties:
 *
 *   CALLMEBOT_PHONE   e.g. +919876543210  (admin's own WhatsApp number)
 *   CALLMEBOT_APIKEY  the key CallMeBot sends you            -> free, alerts YOU about new orders
 *
 *   WA_CLOUD_TOKEN, WA_CLOUD_PHONE_ID, WA_CLOUD_TEMPLATE (e.g. order_update), WA_CLOUD_LANG (e.g. en)
 *                                                            -> Meta WhatsApp Cloud API, messages customers
 *
 *   FAST2SMS_APIKEY                                          -> Fast2SMS (India), SMS to customers (paid)
 *
 * A channel switches on automatically when its keys are present.
 */

/* -------------------- 2. NOTHING TO CHANGE BELOW -------------------- */

var VERSION = '2.0';
var STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Ready', 'Completed', 'Cancelled'];
var ORDER_COLS = ['orderId', 'createdAt', 'updatedAt', 'status', 'service', 'serviceName', 'itemId', 'itemName', 'unitPrice', 'unit',
  'quantity', 'estimate', 'description', 'preferredDate', 'preferredTime', 'address', 'name', 'mobile', 'email', 'customerEmail',
  'source', 'amountQuoted', 'amountPaid', 'adminNotes', 'timeline', 'trackKey', 'clientRef'];
var CAT_COLS = ['type', 'id', 'category', 'name', 'price', 'unit', 'desc', 'icon', 'tone', 'order', 'active', 'popular', 'onsite'];
var SETTING_KEYS = ['BUSINESS_NAME', 'BUSINESS_SUBTITLE', 'TAGLINE', 'PHONE', 'WHATSAPP', 'EMAIL', 'ADDRESS', 'HOURS', 'MAP_LINK',
  'UPI_ID', 'UPI_NAME', 'ABOUT', 'ANNOUNCEMENT', 'SITE_URL'];

/* ---------- entry points ---------- */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'getPublic') return reply_(function () { return getPublic_(); });
  return reply_(function () { return { service: 'One Stop Solution API', version: VERSION, time: new Date().toISOString() }; });
}

function doPost(e) {
  return reply_(function () {
    var p;
    try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { throw err_('INVALID', 'Bad request.'); }
    switch (p.action) {
      case 'ping': return { version: VERSION };
      case 'getPublic': return getPublic_();
      case 'whoami': return whoami_(p);
      case 'createOrder': return createOrder_(p);
      case 'trackOrder': return trackOrder_(p);
      case 'myOrders': return myOrders_(p);
      case 'adminData': requireAdmin_(p); return adminData_();
      case 'updateOrder': return updateOrder_(p, requireAdmin_(p));
      case 'saveCatalogue': requireAdmin_(p); return saveCatalogue_(p);
      case 'saveSettings': requireAdmin_(p); return saveSettings_(p);
      case 'testNotify': return testNotify_(requireAdmin_(p));
      default: throw err_('INVALID', 'Unknown action: ' + p.action);
    }
  });
}

/** Run once by hand (choose "setup" and press Run). Safe to run again. */
function setup() {
  var ss = book_();
  PropertiesService.getScriptProperties().deleteProperty('ORDERS_FMT');
  ordersSheet_();
  var cat = sheet_('Catalogue', CAT_COLS);
  if (cat.getLastRow() < 2) writeCatalogue_(DEFAULT_CATALOGUE);
  var st = sheet_('Settings', ['key', 'value']);
  if (st.getLastRow() < 2) {
    st.getRange(2, 1, 4, 2).setValues([['BUSINESS_NAME', 'YOUR ONE STOP SOLUTION'], ['BUSINESS_SUBTITLE', 'IT & PRINTING SERVICES'],
      ['TAGLINE', 'One Place. Every IT & Printing Solution.'], ['ADDRESS', 'Ongole, Andhra Pradesh']]);
  }
  // ask for e-mail and internet permissions now, so the first real order does not fail
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.getRequest('https://oauth2.googleapis.com/tokeninfo');
  Logger.log('Setup complete for sheet: ' + ss.getName() + '. E-mails left today: ' + MailApp.getRemainingDailyQuota());
}

/* ---------- helpers: replies & errors ---------- */
function err_(code, message, data) { var e = new Error(message); e.code = code; e.data = data; return e; }
function reply_(fn) {
  var out;
  try { out = { ok: true, data: fn() }; }
  catch (e) {
    if (!e.code) Logger.log(e && e.stack || e);
    out = { ok: false, error: { code: e.code || 'SERVER', message: e.code ? e.message : 'Server error: ' + e.message, data: e.data || null } };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw err_('BUSY', 'The server is busy. Please try again.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function str_(v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 500); }
function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function bool_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1' || v === 'yes'; }
function mobile_(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
function emailOk_(e) { return /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(String(e || '')); }
function randKey_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inr_(n) { return 'Rs ' + Math.round(num_(n) * 100) / 100; }
function cellSafe_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }

/* ---------- helpers: sheets ---------- */
function book_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
/** Gets a tab, creating it and adding any missing header columns (keeps your existing columns). */
function sheet_(name, cols) {
  var ss = book_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); }
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (head.length === 1 && head[0] === '') { head = []; }
  if (missing.length) {
    sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]);
    sh.getRange(1, 1, 1, head.length + missing.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function readRows_(sh) {
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (last < 2) return [];
  var vals = sh.getRange(1, 1, last, lastCol).getValues(), head = vals[0].map(String), out = [];
  for (var r = 1; r < vals.length; r++) {
    var o = { _row: r + 1 };
    for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = vals[r][c];
    out.push(o);
  }
  return out;
}
function writeRow_(sh, obj, rowNum) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var row = head.map(function (k) { var v = obj[k]; return v === undefined ? '' : cellSafe_(v); });
  if (rowNum) sh.getRange(rowNum, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

/* ---------- Google Sign-In verification (never trust the browser) ---------- */
function verifyToken_(idToken) {
  if (!idToken) throw err_('AUTH', 'Please sign in with Google.');
  if (GOOGLE_CLIENT_ID.indexOf('PASTE_') === 0) throw err_('SETUP', 'Google Sign-In is not set up yet: put your Client ID in Code.gs (GOOGLE_CLIENT_ID).');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw err_('AUTH', 'Your sign-in has expired. Please sign in again.');
  var p = JSON.parse(res.getContentText());
  var now = Math.floor(Date.now() / 1000);
  if (p.aud !== GOOGLE_CLIENT_ID) throw err_('AUTH', 'This sign-in was not made for this website.');
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') throw err_('AUTH', 'Invalid sign-in.');
  if (String(p.email_verified) !== 'true') throw err_('AUTH', 'Your Google e-mail is not verified.');
  if (!(Number(p.exp) > now)) throw err_('AUTH', 'Your sign-in has expired. Please sign in again.');
  var user = { email: String(p.email).toLowerCase(), name: p.name || '', picture: p.picture || '' };
  user.isAdmin = isAdminEmail_(user.email);
  cache.put(key, JSON.stringify(user), Math.max(1, Math.min(600, Number(p.exp) - now)));
  return user;
}
function isAdminEmail_(email) {
  email = String(email || '').toLowerCase();
  return ADMIN_EMAILS.some(function (a) { return String(a).toLowerCase() === email; });
}
function requireAdmin_(p) {
  var u = verifyToken_(p.idToken);
  if (!u.isAdmin) throw err_('FORBIDDEN', 'This Google account (' + u.email + ') is not an admin.');
  return u;
}
function optionalUser_(p) { if (!p.idToken) return null; try { return verifyToken_(p.idToken); } catch (e) { return null; } }
function whoami_(p) { return verifyToken_(p.idToken); }

/* ---------- catalogue & settings ---------- */
function readCatalogue_() {
  var rows = readRows_(sheet_('Catalogue', CAT_COLS));
  if (!rows.length) {
    var d = JSON.parse(JSON.stringify(DEFAULT_CATALOGUE));
    d.categories.forEach(function (c, i) { c.order = i + 1; c.active = true; });
    d.items.forEach(function (it) { it.active = true; it.popular = !!it.popular; it.onsite = !!it.onsite; });
    return d;
  }
  var cats = [], items = [];
  rows.forEach(function (r) {
    if (!r.id) return;
    if (String(r.type) === 'category') cats.push({ id: str_(r.id), name: str_(r.name), desc: str_(r.desc, 1000), icon: str_(r.icon) || 'layers', tone: str_(r.tone) || 'blue', order: num_(r.order), active: bool_(r.active) });
    else items.push({ id: str_(r.id), category: str_(r.category), name: str_(r.name), price: num_(r.price), unit: str_(r.unit), desc: str_(r.desc, 1000), order: num_(r.order), active: bool_(r.active), popular: bool_(r.popular), onsite: bool_(r.onsite) });
  });
  cats.sort(function (a, b) { return a.order - b.order; });
  return { categories: cats, items: items };
}
function writeCatalogue_(cat) {
  var sh = sheet_('Catalogue', CAT_COLS);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var rows = [];
  (cat.categories || []).forEach(function (c, i) { rows.push({ type: 'category', id: c.id, name: c.name, desc: c.desc, icon: c.icon, tone: c.tone, order: c.order || i + 1, active: c.active !== false }); });
  (cat.items || []).forEach(function (it, i) { rows.push({ type: 'item', id: it.id, category: it.category, name: it.name, price: num_(it.price), unit: it.unit, desc: it.desc, order: i + 1, active: it.active !== false, popular: !!it.popular, onsite: !!it.onsite }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(function (o) { return head.map(function (k) { return o[k] === undefined ? '' : cellSafe_(o[k]); }); }));
}
function saveCatalogue_(p) {
  var cats = Array.isArray(p.categories) ? p.categories : [], items = Array.isArray(p.items) ? p.items : [];
  if (!cats.length) throw err_('INVALID', 'Add at least one category.');
  if (cats.length > 50 || items.length > 500) throw err_('INVALID', 'Catalogue is too big.');
  var ids = {};
  var clean = {
    categories: cats.map(function (c, i) {
      var id = str_(c.id, 40).replace(/[^\w-]/g, '') || ('cat' + (i + 1));
      if (ids[id]) throw err_('INVALID', 'Two categories have the same id: ' + id); ids[id] = 1;
      if (!str_(c.name)) throw err_('INVALID', 'Every category needs a name.');
      return { id: id, name: str_(c.name, 80), desc: str_(c.desc, 400), icon: str_(c.icon, 20) || 'layers', tone: str_(c.tone, 20) || 'blue', order: i + 1, active: c.active !== false };
    }),
    items: items.map(function (it, i) {
      if (!str_(it.name)) throw err_('INVALID', 'Every service needs a name.');
      return { id: str_(it.id, 40).replace(/[^\w-]/g, '') || ('i' + Date.now().toString(36) + i), category: str_(it.category, 40), name: str_(it.name, 120),
        price: Math.max(0, num_(it.price)), unit: str_(it.unit, 40), desc: str_(it.desc, 600), active: it.active !== false, popular: !!it.popular, onsite: !!it.onsite };
    })
  };
  withLock_(function () { writeCatalogue_(clean); });
  return readCatalogue_();
}
function readSettings_() {
  var out = {};
  readRows_(sheet_('Settings', ['key', 'value'])).forEach(function (r) { if (SETTING_KEYS.indexOf(String(r.key)) >= 0) out[r.key] = str_(r.value, 2000); });
  return out;
}
function saveSettings_(p) {
  var s = p.settings || {};
  withLock_(function () {
    var sh = sheet_('Settings', ['key', 'value']);
    var rows = SETTING_KEYS.filter(function (k) { return s[k] !== undefined; }).map(function (k) { return [k, cellSafe_(str_(s[k], 2000))]; });
    var old = readSettings_();
    SETTING_KEYS.forEach(function (k) { if (s[k] === undefined && old[k] !== undefined) rows.push([k, cellSafe_(old[k])]); });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  });
  return readSettings_();
}
function getPublic_() {
  var cat = readCatalogue_();
  return {
    catalogue: { categories: cat.categories.filter(function (c) { return c.active; }), items: cat.items.filter(function (i) { return i.active; }) },
    settings: readSettings_(), version: VERSION
  };
}

/* ---------- orders ---------- */
function ordersSheet_() {
  var sh = sheet_('Orders', ORDER_COLS);
  // keep dates, times, mobiles and keys as plain text so Sheets does not convert them
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ORDERS_FMT') !== VERSION) {
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    ['orderId', 'createdAt', 'updatedAt', 'preferredDate', 'preferredTime', 'mobile', 'trackKey', 'clientRef', 'timeline'].forEach(function (k) {
      var c = head.indexOf(k); if (c >= 0) sh.getRange(2, c + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
    props.setProperty('ORDERS_FMT', VERSION);
  }
  return sh;
}
function parseTimeline_(v) { try { var t = JSON.parse(v || '[]'); return Array.isArray(t) ? t : []; } catch (e) { return []; } }
function iso_(v) { if (!v) return ''; if (v instanceof Date) return v.toISOString(); return String(v); }
function dateOnly_(v) { if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return str_(v, 10); }
function timeOnly_(v) { if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm'); return str_(v, 5); }

function rowToOrder_(r) {
  var quoted = num_(r.amountQuoted), paid = num_(r.amountPaid);
  return {
    orderId: str_(r.orderId), createdAt: iso_(r.createdAt), updatedAt: iso_(r.updatedAt), status: STATUSES.indexOf(String(r.status)) >= 0 ? String(r.status) : 'Pending',
    service: str_(r.service), serviceName: str_(r.serviceName) || str_(r.service), itemId: str_(r.itemId), itemName: str_(r.itemName), unitPrice: num_(r.unitPrice), unit: str_(r.unit),
    quantity: num_(r.quantity) || 1, estimate: num_(r.estimate), description: str_(r.description, 3000), preferredDate: dateOnly_(r.preferredDate), preferredTime: timeOnly_(r.preferredTime),
    address: str_(r.address), name: str_(r.name), mobile: str_(r.mobile), email: str_(r.email), customerEmail: str_(r.customerEmail), source: str_(r.source) || 'website',
    amountQuoted: quoted, amountPaid: paid, balance: Math.max(0, quoted - paid), adminNotes: str_(r.adminNotes, 3000),
    timeline: parseTimeline_(r.timeline), trackKey: str_(r.trackKey), _row: r._row
  };
}
function publicOrder_(o) {
  return { orderId: o.orderId, createdAt: o.createdAt, updatedAt: o.updatedAt, status: o.status, service: o.serviceName, itemName: o.itemName, unitPrice: o.unitPrice,
    unit: o.unit, quantity: o.quantity, estimate: o.estimate, description: o.description, preferredDate: o.preferredDate, preferredTime: o.preferredTime,
    amountQuoted: o.amountQuoted, amountPaid: o.amountPaid, balance: o.balance, trackKey: o.trackKey,
    timeline: o.timeline.filter(function (t) { return t.visible !== false; }).map(function (t) { return { at: t.at, type: t.type, status: t.status || '', message: t.message || '' }; }) };
}
function adminOrder_(o) { var c = JSON.parse(JSON.stringify(o)); delete c._row; return c; }
function allOrders_() { return readRows_(ordersSheet_()).filter(function (r) { return r.orderId; }).map(rowToOrder_); }
function findOrder_(id) {
  id = str_(id, 20).toUpperCase();
  var list = allOrders_();
  for (var i = 0; i < list.length; i++) if (list[i].orderId.toUpperCase() === id) return list[i];
  return null;
}
function nextOrderId_(list) {
  var max = 0;
  list.forEach(function (o) { var m = /(\d+)$/.exec(o.orderId); if (m) max = Math.max(max, Number(m[1])); });
  var n = String(max + 1); while (n.length < 4) n = '0' + n;
  return ORDER_PREFIX + n;
}

function createOrder_(p) {
  if (p.website) throw err_('INVALID', 'Request rejected.');           // spam trap
  var user = optionalUser_(p);
  var admin = user && user.isAdmin && p.asAdmin;
  var cat = readCatalogue_();
  var item = null;
  cat.items.forEach(function (i) { if (i.id === str_(p.itemId)) item = i; });
  var serviceId = str_(p.service, 40) || (item && item.category) || '';
  var category = null;
  cat.categories.forEach(function (c) { if (c.id === serviceId || c.name === serviceId) category = c; });
  var d = {
    service: serviceId, serviceName: category ? category.name : serviceId, itemId: item ? item.id : '', itemName: item ? item.name : str_(p.itemName, 120),
    unitPrice: item ? item.price : 0, unit: item ? item.unit : '', quantity: Math.floor(num_(p.quantity)),
    description: str_(p.description, 3000), preferredDate: str_(p.preferredDate, 10), preferredTime: str_(p.preferredTime, 5), address: str_(p.address, 300),
    name: str_(p.name, 80), mobile: mobile_(p.mobile), email: str_(p.email, 120).toLowerCase()
  };
  if (!d.service && !d.itemId) throw err_('INVALID', 'Please choose a service.', { field: 'service' });
  if (d.description.length < 3 && !d.itemId) throw err_('INVALID', 'Please describe the work in a few words.', { field: 'description' });
  if (!(d.quantity >= 1 && d.quantity <= 100000)) throw err_('INVALID', 'Enter a whole number, 1 or more.', { field: 'quantity' });
  if (d.name.length < 2) throw err_('INVALID', 'Please enter your name.', { field: 'name' });
  if (!d.mobile) throw err_('INVALID', 'Enter a valid 10-digit mobile number.', { field: 'mobile' });
  if (d.email && !emailOk_(d.email)) throw err_('INVALID', 'This e-mail address does not look right.', { field: 'email' });
  if (!d.email && user && !admin) d.email = user.email;

  // simple flood protection: 15 orders per mobile per hour
  var cache = CacheService.getScriptCache(), ck = 'rate_' + d.mobile, cnt = Number(cache.get(ck) || 0);
  if (!admin && cnt >= 15) throw err_('LIMIT', 'Too many orders from this number. Please call the shop.');

  var res = withLock_(function () {
    var list = allOrders_();
    var ref = str_(p.clientRef, 40);
    if (ref) { var raw = readRows_(ordersSheet_()); for (var i = 0; i < raw.length; i++) if (String(raw[i].clientRef) === ref) return { dup: rowToOrder_(raw[i]) }; }
    var now = new Date().toISOString();
    var o = Object.assign({}, d, {
      orderId: nextOrderId_(list), createdAt: now, updatedAt: now, status: 'Pending',
      estimate: d.unitPrice ? Math.round(d.unitPrice * d.quantity * 100) / 100 : 0,
      customerEmail: user && !admin ? user.email : '', source: admin ? 'admin' : 'website', amountQuoted: '', amountPaid: 0, adminNotes: '',
      timeline: JSON.stringify([{ at: now, type: 'created', status: 'Pending', message: '', visible: true }]), trackKey: randKey_(), clientRef: ref
    });
    writeRow_(ordersSheet_(), o);
    return { order: findOrder_(o.orderId) };
  });
  if (res.dup) return { orderId: res.dup.orderId, trackKey: res.dup.trackKey, emailed: false, order: publicOrder_(res.dup), duplicate: true };
  cache.put(ck, String(cnt + 1), 3600);
  var o = res.order, emailed = false;
  try { notifyAdminsNewOrder_(o); } catch (e) { Logger.log('admin notify failed: ' + e); }
  try { emailed = notifyCustomer_(o, 'created', ''); } catch (e) { Logger.log('customer notify failed: ' + e); }
  return { orderId: o.orderId, trackKey: o.trackKey, emailed: emailed, order: admin ? adminOrder_(o) : publicOrder_(o) };
}

function trackOrder_(p) {
  var o = findOrder_(p.orderId);
  var fail = err_('NOT_FOUND', 'No order found with that number and mobile. Please check and try again.');
  if (!o) throw fail;
  if (p.key) { if (String(p.key) !== o.trackKey) throw fail; }
  else if (!mobile_(p.mobile) || mobile_(p.mobile) !== mobile_(o.mobile)) throw fail;
  return publicOrder_(o);
}

function myOrders_(p) {
  var u = verifyToken_(p.idToken);
  var list = allOrders_().filter(function (o) { return o.customerEmail.toLowerCase() === u.email || o.email.toLowerCase() === u.email; });
  list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  return { user: u, orders: list.slice(0, 100).map(publicOrder_) };
}

function adminData_() {
  var list = allOrders_().map(adminOrder_);
  list.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  return { orders: list, catalogue: readCatalogue_(), settings: readSettings_(), admins: ADMIN_EMAILS,
    channels: channels_(), emailQuota: MailApp.getRemainingDailyQuota(), version: VERSION };
}

function updateOrder_(p, admin) {
  var result = withLock_(function () {
    var o = findOrder_(p.orderId);
    if (!o) throw err_('NOT_FOUND', 'Order not found.');
    if (p.rev && o.updatedAt && String(p.rev) !== String(o.updatedAt)) throw err_('CONFLICT', 'This order was changed by someone else. The latest version has been loaded.');
    var now = new Date().toISOString(), tl = o.timeline, changed = false, statusChanged = false;
    if (p.status !== undefined && p.status !== o.status) {
      if (STATUSES.indexOf(p.status) < 0) throw err_('INVALID', 'Unknown status.');
      o.status = p.status; statusChanged = true; changed = true;
    }
    if (p.amountQuoted !== undefined && p.amountQuoted !== '' && num_(p.amountQuoted) !== o.amountQuoted) { o.amountQuoted = Math.max(0, num_(p.amountQuoted)); changed = true; }
    if (p.amountPaid !== undefined && p.amountPaid !== '' && num_(p.amountPaid) !== o.amountPaid) {
      var diff = num_(p.amountPaid) - o.amountPaid; o.amountPaid = Math.max(0, num_(p.amountPaid)); changed = true;
      tl.push({ at: now, type: 'payment', message: (diff >= 0 ? 'Payment received: ' : 'Payment corrected: ') + inr_(Math.abs(diff)) + '. Total paid ' + inr_(o.amountPaid), visible: true, by: admin.email });
    }
    if (p.adminNotes !== undefined && str_(p.adminNotes, 3000) !== o.adminNotes) { o.adminNotes = str_(p.adminNotes, 3000); changed = true; }
    var msg = str_(p.message, 1000);
    if (statusChanged || msg) { tl.push({ at: now, type: statusChanged ? 'status' : 'note', status: statusChanged ? o.status : '', message: msg, visible: p.visible !== false, by: admin.email }); changed = true; }
    if (!changed) throw err_('INVALID', 'Nothing to save.');
    o.updatedAt = now;
    var row = o._row, copy = Object.assign({}, o, { timeline: JSON.stringify(tl) });
    delete copy._row; delete copy.balance;
    var sh = ordersSheet_(), raw = readRows_(sh).filter(function (r) { return r._row === row; })[0];
    writeRow_(sh, Object.assign({}, raw, copy), row);
    return { order: findOrder_(o.orderId), statusChanged: statusChanged, msg: msg };
  });
  var o = result.order, notified = false;
  if (p.notify !== false && p.visible !== false && (result.statusChanged || result.msg)) {
    try { notified = notifyCustomer_(o, result.statusChanged ? 'status' : 'note', result.msg); } catch (e) { Logger.log('notify failed: ' + e); }
  }
  var out = adminOrder_(o); out.notified = notified;
  return out;
}

/* ---------- notifications ---------- */
function shopName_() { return readSettings_().BUSINESS_NAME || 'YOUR ONE STOP SOLUTION'; }
function trackUrl_(o) { var base = readSettings_().SITE_URL; return base ? base.replace(/\/?$/, '/') + '?t=' + encodeURIComponent(o.orderId + '.' + o.trackKey) : ''; }
function props_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function channels_() {
  return { email: true, callmebot: !!(props_('CALLMEBOT_PHONE') && props_('CALLMEBOT_APIKEY')),
    whatsappCloud: !!(props_('WA_CLOUD_TOKEN') && props_('WA_CLOUD_PHONE_ID')), fast2sms: !!props_('FAST2SMS_APIKEY') };
}
function orderTable_(o) {
  var rows = [['Order number', o.orderId], ['Status', o.status], ['Service', o.serviceName], ['Item', o.itemName], ['Quantity', o.quantity],
    ['Estimate', o.estimate ? inr_(o.estimate) : ''], ['Bill amount', o.amountQuoted ? inr_(o.amountQuoted) : ''], ['Paid', o.amountPaid ? inr_(o.amountPaid) : ''],
    ['Work', o.description], ['Preferred', [o.preferredDate, o.preferredTime].join(' ').trim()], ['Name', o.name], ['Mobile', o.mobile], ['E-mail', o.email], ['Address', o.address]];
  return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + rows.filter(function (r) { return r[1] !== '' && r[1] !== undefined; }).map(function (r) {
    return '<tr><td style="padding:6px 12px;color:#5d6b85;border-bottom:1px solid #eee">' + esc_(r[0]) + '</td><td style="padding:6px 12px;border-bottom:1px solid #eee"><b>' + esc_(r[1]).replace(/\n/g, '<br>') + '</b></td></tr>';
  }).join('') + '</table>';
}
function notifyAdminsNewOrder_(o) {
  var shop = shopName_();
  if (EMAIL_ADMINS_ON_NEW_ORDER && MailApp.getRemainingDailyQuota() > 0) {
    MailApp.sendEmail({ to: ADMIN_EMAILS.join(','), subject: 'New order ' + o.orderId + ' - ' + o.name + ' (' + (o.itemName || o.serviceName) + ')',
      name: shop + ' Website', replyTo: o.email || ADMIN_EMAILS[0],
      htmlBody: '<p>A new order was placed on the website.</p>' + orderTable_(o) + '<p>Open the website and sign in as admin to manage it.</p>' });
  }
  var cmb = props_('CALLMEBOT_PHONE'), key = props_('CALLMEBOT_APIKEY');
  if (cmb && key) {
    var text = 'New order ' + o.orderId + '\n' + o.name + ' ' + o.mobile + '\n' + (o.itemName || o.serviceName) + ' x' + o.quantity + '\n' + o.description.slice(0, 200);
    UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(cmb) + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(key), { muteHttpExceptions: true });
  }
}
function customerText_(o, kind, msg) {
  var shop = shopName_();
  if (kind === 'created') return 'Thank you ' + o.name + '! Your order ' + o.orderId + ' at ' + shop + ' is received. We will confirm soon.';
  return shop + ': Order ' + o.orderId + ' is now "' + o.status + '".' + (msg ? ' ' + msg : '') + (o.amountQuoted ? ' Bill: ' + inr_(o.amountQuoted) + ', Balance: ' + inr_(o.balance) + '.' : '');
}
/** Returns true if an e-mail was sent. */
function notifyCustomer_(o, kind, msg) {
  var sent = false, shop = shopName_(), to = o.email || o.customerEmail;
  var wanted = kind === 'created' ? EMAIL_CUSTOMER_ON_NEW_ORDER : EMAIL_CUSTOMER_ON_STATUS_CHANGE;
  if (wanted && to && emailOk_(to) && MailApp.getRemainingDailyQuota() > 0) {
    var link = trackUrl_(o);
    MailApp.sendEmail({ to: to, name: shop, replyTo: ADMIN_EMAILS[0],
      subject: kind === 'created' ? 'Order ' + o.orderId + ' received - ' + shop : 'Order ' + o.orderId + ' update: ' + o.status + ' - ' + shop,
      htmlBody: '<p>Dear ' + esc_(o.name) + ',</p><p>' + esc_(customerText_(o, kind, msg)) + '</p>' + orderTable_(o) +
        (link ? '<p><a href="' + esc_(link) + '">Track your order online</a></p>' : '<p>Track it on our website with your order number and mobile number.</p>') +
        '<p>Thank you,<br>' + esc_(shop) + '</p>' });
    sent = true;
  }
  var text = customerText_(o, kind, msg);
  try { sendWhatsAppCloud_(o, text); } catch (e) { Logger.log('WhatsApp Cloud failed: ' + e); }
  try { sendFast2Sms_(o, text); } catch (e) { Logger.log('Fast2SMS failed: ' + e); }
  return sent;
}
/* WhatsApp Cloud API (Meta). Business-initiated messages need an APPROVED template.
   Template body example (3 variables): "Hello {{1}}, your order {{2}} is now {{3}}. - One Stop Solution" */
function sendWhatsAppCloud_(o, text) {
  var token = props_('WA_CLOUD_TOKEN'), phoneId = props_('WA_CLOUD_PHONE_ID');
  if (!token || !phoneId || !o.mobile) return;
  var tpl = props_('WA_CLOUD_TEMPLATE') || 'order_update', lang = props_('WA_CLOUD_LANG') || 'en';
  UrlFetchApp.fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: '91' + o.mobile, type: 'template',
      template: { name: tpl, language: { code: lang }, components: [{ type: 'body', parameters: [{ type: 'text', text: o.name }, { type: 'text', text: o.orderId }, { type: 'text', text: o.status }] }] } })
  });
}
/* Fast2SMS (India). Paid per SMS; "q" = Quick SMS route. DLT route is cheaper but needs DLT registration. */
function sendFast2Sms_(o, text) {
  var key = props_('FAST2SMS_APIKEY');
  if (!key || !o.mobile) return;
  UrlFetchApp.fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { authorization: key },
    payload: JSON.stringify({ route: 'q', message: text.slice(0, 300), language: 'english', flash: 0, numbers: o.mobile })
  });
}
function testNotify_(admin) {
  MailApp.sendEmail({ to: admin.email, subject: 'Test e-mail from your website', body: 'E-mail notifications are working. Channels: ' + JSON.stringify(channels_()) });
  return { sentTo: admin.email, channels: channels_() };
}

/* ---------- sample catalogue used by setup() the first time ---------- */
var DEFAULT_CATALOGUE = {
  categories: [
    { id: 'computer', name: 'Computer & Laptop Service', icon: 'laptop', tone: 'blue', active: true, desc: 'Repairs, upgrades, OS installation and data recovery for laptops and desktops.' },
    { id: 'network', name: 'Networking & Wi-Fi', icon: 'network', tone: 'green', active: true, desc: 'LAN cabling, Wi-Fi routers, office networks and internet troubleshooting.' },
    { id: 'cctv', name: 'CCTV Installation', icon: 'cctv', tone: 'indigo', active: true, desc: 'HD camera packages for homes, shops and offices with mobile viewing.' },
    { id: 'xerox', name: 'Xerox & Binding', icon: 'copy', tone: 'violet', active: true, desc: 'Fast photocopies, lamination, spiral and record binding.' },
    { id: 'printing', name: 'Printing (B/W & Colour)', icon: 'printer', tone: 'red', active: true, desc: 'Documents, project reports, photos and certificates on quality paper.' },
    { id: 'design', name: 'Design Work', icon: 'pen', tone: 'purple', active: true, desc: 'Visiting cards, flex banners, ID cards, stickers, invitations and logos.' }
  ],
  items: [
    { id: 'c-diag', category: 'computer', name: 'Laptop / Desktop check-up & diagnosis', price: 200, unit: 'per device', desc: 'Full hardware and software check. Amount adjusted in the final bill if you repair with us.', popular: true },
    { id: 'c-os', category: 'computer', name: 'Windows OS installation with drivers', price: 500, unit: 'per device', desc: 'Windows 10/11 install, drivers, basic software and updates.', popular: true },
    { id: 'c-format', category: 'computer', name: 'Format + data backup', price: 700, unit: 'per device', desc: 'Backup of your files, clean install and restore.' },
    { id: 'c-virus', category: 'computer', name: 'Virus removal & speed-up', price: 400, unit: 'per device', desc: 'Remove malware, clean start-up, make your PC fast again.' },
    { id: 'c-ssd', category: 'computer', name: 'SSD upgrade (fitting charge)', price: 300, unit: 'per device', desc: 'Fit a new SSD and move your system to it. SSD cost extra.' },
    { id: 'c-recovery', category: 'computer', name: 'Data recovery (HDD / pen drive)', price: 1500, unit: 'starting from', desc: 'Recover deleted or lost files. Final price after inspection.' },
    { id: 'c-screen', category: 'computer', name: 'Laptop screen / keyboard replacement', price: 800, unit: 'labour + parts', desc: 'Genuine and compatible parts. Price depends on model.' },
    { id: 'n-wifi', category: 'network', name: 'Wi-Fi router setup', price: 300, unit: 'per router', desc: 'Router configuration, password security and coverage check.', popular: true, onsite: true },
    { id: 'n-lan', category: 'network', name: 'LAN cabling point (Cat6)', price: 450, unit: 'per point', desc: 'Cat6 cable laying with RJ45 and I/O box, up to 15 m.', onsite: true },
    { id: 'n-office', category: 'network', name: 'Small office network (up to 5 PCs)', price: 3500, unit: 'per site', desc: 'Switch, cabling, printer and file sharing setup.', onsite: true },
    { id: 'n-trouble', category: 'network', name: 'Internet / network troubleshooting', price: 350, unit: 'per visit', desc: 'On-site fix for slow or no internet problems.', onsite: true },
    { id: 'v-4cam', category: 'cctv', name: 'CCTV 4-camera HD package', price: 14999, unit: 'complete', desc: '4 x 2MP cameras, 4-channel DVR, 1 TB HDD, cabling, power supply, mobile view setup.', popular: true, onsite: true },
    { id: 'v-8cam', category: 'cctv', name: 'CCTV 8-camera HD package', price: 26999, unit: 'complete', desc: '8 x 2MP cameras, 8-channel DVR, 2 TB HDD, cabling and installation.', onsite: true },
    { id: 'v-ip', category: 'cctv', name: 'Wi-Fi smart camera installation', price: 2999, unit: 'per camera', desc: 'Indoor Wi-Fi camera with app setup and SD card.', onsite: true },
    { id: 'v-amc', category: 'cctv', name: 'CCTV service / maintenance visit', price: 500, unit: 'per visit', desc: 'Camera cleaning, DVR check and repairs (parts extra).', onsite: true },
    { id: 'x-bw', category: 'xerox', name: 'B/W xerox (A4)', price: 2, unit: 'per page', desc: 'Single side. Both sides Rs 3.', popular: true },
    { id: 'x-colour', category: 'xerox', name: 'Colour xerox (A4)', price: 10, unit: 'per page', desc: 'Bright colour copies of documents and certificates.' },
    { id: 'x-lam', category: 'xerox', name: 'Lamination (A4)', price: 30, unit: 'per sheet', desc: 'Thick glossy lamination. ID size Rs 15.' },
    { id: 'x-spiral', category: 'xerox', name: 'Spiral binding', price: 40, unit: 'per book', desc: 'Up to 100 pages with plastic covers.', popular: true },
    { id: 'x-record', category: 'xerox', name: 'Record / project hard binding', price: 150, unit: 'per book', desc: 'Hard cover with golden lettering.' },
    { id: 'p-bw', category: 'printing', name: 'B/W laser print (A4)', price: 3, unit: 'per page', desc: 'From PDF, Word or WhatsApp files.' },
    { id: 'p-colour', category: 'printing', name: 'Colour print (A4)', price: 15, unit: 'per page', desc: 'High quality colour on 100 GSM paper.', popular: true },
    { id: 'p-photo', category: 'printing', name: 'Photo print (4x6)', price: 20, unit: 'per photo', desc: 'Glossy photo paper.' },
    { id: 'p-passport', category: 'printing', name: 'Passport size photos (8 nos)', price: 60, unit: 'per set', desc: 'With background change if needed.' },
    { id: 'd-vcard', category: 'design', name: 'Visiting card design + print (100)', price: 350, unit: 'per 100 cards', desc: 'Custom design, 300 GSM card, single side.', popular: true },
    { id: 'd-flex', category: 'design', name: 'Flex banner design + print', price: 12, unit: 'per sq.ft', desc: 'Shop boards, events and functions. Design free above 30 sq.ft.' },
    { id: 'd-id', category: 'design', name: 'PVC ID card with design', price: 80, unit: 'per card', desc: 'School, college and office ID cards with lanyard.' },
    { id: 'd-invite', category: 'design', name: 'Invitation / pamphlet design', price: 500, unit: 'per design', desc: 'Wedding cards, event pamphlets and posters.' },
    { id: 'd-logo', category: 'design', name: 'Logo design', price: 1500, unit: 'per logo', desc: '3 concepts and 2 revisions, all file formats.' }
  ]
};
