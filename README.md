# YOUR ONE STOP SOLUTION – IT & Printing Services, Ongole

This is the shop website for computer service, networking, CCTV installation, xerox, printing and design work. It is a single static page with a Google Apps Script + Google Sheets backend.

* **Customers:** browse services and prices (category chips, search, sort by price or name), place orders with **Cash on Delivery or PhonePe / UPI** (optional, with UTR), track them live, send the order on WhatsApp, and see "My orders" after signing in with Google or with name + mobile.
* **Contact:** phone / WhatsApp 9989481720, e-mail rajub.369@gmail.com (set in `config.js`).
* **Admins** (`dataongole@gmail.com`, `rajub.369@gmail.com`): sign in with Google on the **same page** to get the dashboard, order management (incl. payment status), catalogue editor with **Excel / paste bulk upload** (format: `assets/items-template.csv`, see SETUP-GUIDE.md → Changing prices) and shop settings.
* **Notifications:** e-mail through Gmail, one-tap WhatsApp links, and optional automatic WhatsApp/SMS (CallMeBot, WhatsApp Cloud API, Fast2SMS).
* **Demo mode:** add `?demo=1` to the address to try everything without any setup.

👉 **Start here: [SETUP-GUIDE.md](SETUP-GUIDE.md)**

| Path | Purpose |
|---|---|
| `index.html` | The single page (customer and admin) |
| `config.js` | Settings: `API_URL`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, `DEMO_MODE`, contact details |
| `assets/core.js` | Helpers, API client, Google Sign-In |
| `assets/app.js` | Customer website |
| `assets/admin.js` | Admin dashboard, orders, catalogue and settings |
| `assets/catalogue.js` | Built-in sample price list (demo / fallback) |
| `assets/demo-backend.js` | In-browser backend for demo mode |
| `apps-script/Code.gs` | Google Apps Script backend (Orders / Catalogue / Settings sheets, token verification, notifications) |
| `assets/items-template.csv` | Template for the admin bulk upload (the Excel version is made by the "Excel template" button) |
| `admin.html` | Redirects to `index.html#admin` |

> Backend changes (`apps-script/Code.gs`, now v2.1) need: paste the new code → run `setup` once → **Deploy → Manage deployments → Edit → New version**. See SETUP-GUIDE.md, Part 1D-2.

To test locally, run `python3 -m http.server 8000` and open `http://localhost:8000/?demo=1`.
