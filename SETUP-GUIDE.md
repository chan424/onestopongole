# YOUR ONE STOP SOLUTION – Website Setup Guide

This guide is written for the shop owner. No programming knowledge is needed. Do the parts in order the first time. Later you will only need Part 3 (updating) now and then.

**What the website does**

* **One page for everyone.** Customers see the shop website: services, price list, order form, order tracking, "My orders", contact details, and WhatsApp and call buttons.
* **Admins sign in on the same page.** When **dataongole@gmail.com** or **rajub.369@gmail.com** signs in with Google, a dark admin bar appears with these tabs:
  * **Dashboard**: order counts, money collected, money still due, status breakdown, a chart of the last 14 days and recent orders.
  * **Orders**: change the status, bill amount and amount paid, message the customer, keep private notes, open WhatsApp, and export to Excel (CSV).
  * **Catalogue**: add, edit, hide or delete services, categories and prices.
  * **Settings**: shop name, phone, WhatsApp, address, hours, PhonePe / UPI and announcement.
* **Customers can sign in** with Google (or just name + mobile) to see "My orders". A red badge appears when the shop updates one of their orders.
* **E-mails are sent automatically** (free, through Gmail):
  * Both admins get an e-mail for every new order.
  * The customer gets a confirmation e-mail, and another e-mail every time you change the status.
* **The data is kept in your Google Sheet**, which has 3 tabs: `Orders`, `Catalogue` and `Settings`.

**Files in this project**

| File | What it is |
|---|---|
| `index.html` | The website (the only page). |
| `admin.html` | Old admin address. It now opens `index.html#admin` automatically. |
| `config.js` | **Your settings.** This is the main file you edit. |
| `assets/` | Design and program files (`style.css`, `core.js`, `app.js`, `admin.js`, `catalogue.js`, `demo-backend.js`). You normally don't touch these. |
| `apps-script/Code.gs` | The "backend" program. You paste it into Google Apps Script. |
| `SETUP-GUIDE.md` | This guide. |

---

## Part 0 – Try it first (Demo mode, no setup needed)

Open the website with `?demo=1` at the end of the address, for example:

* `https://chan424.github.io/onestopongole/?demo=1`
* or, on your computer, open `index.html?demo=1`

You will see a yellow **Demo mode** bar. Click **Sign in**, then **Demo admin login** to try the dashboard, orders and catalogue editor. You can also click **Demo customer login** to see the customer's "My orders" view.

In demo mode everything is saved only in that browser, and e-mails are only *pretended* (you will see them under Admin → Settings → "Demo notification log"). To leave demo mode, remove `?demo=1` from the address. You can also use `?demo=0`.

> If `API_URL` in `config.js` is empty, or `DEMO_MODE: true`, the whole site runs in demo mode.

---

## Part 1 – Google Sheet + Apps Script (the backend)

You already have an Apps Script web app, because its address is in `config.js` as `API_URL`. You now need to **replace its code with the new `Code.gs`** and **deploy a new version**. The web address stays the same.

### 1A. Make a backup (1 minute)
1. Open the Google Sheet that stores your orders.
2. Click **File → Make a copy**. This keeps your old data safe.

### 1B. Paste the new code
1. In the Sheet, click **Extensions → Apps Script**.
2. Open `Code.gs` on the left. Select everything (Ctrl+A) and delete it.
3. On GitHub, open `apps-script/Code.gs`, click the **Copy raw file** button, and paste it into Apps Script.
4. Near the top of the code, check these lines:
   * `ADMIN_EMAILS` already has `dataongole@gmail.com` and `rajub.369@gmail.com`. **This list is the real security check.** Only these Google accounts can use the admin tools.
   * `GOOGLE_CLIENT_ID`: paste your Client ID here after Part 2.
5. Click the **Save** icon (💾).

> Starting fresh? Create a new Google Sheet, then do **Extensions → Apps Script** and follow the same steps.

### 1C. Run setup once
1. In the toolbar, choose the function **`setup`** from the drop-down and click **Run**.
2. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced → Go to (project) (unsafe)** → **Allow**.
   * This is normal for your own script. It asks to use your Sheet, send e-mail as you, and connect to the internet, which is needed to check Google sign-ins.
3. Go back to the Sheet. You will see the tabs **Orders**, **Catalogue** (already filled with the sample price list) and **Settings**.

If your Sheet already has an `Orders` tab, `setup` keeps your existing columns and only adds the new ones it needs.

### 1D. Deploy a new version (the address stays the same)
1. Click **Deploy → Manage deployments**.
2. Select your existing **Web app** deployment and click the ✏️ pencil (Edit).
3. Under **Version**, choose **New version**. Check these settings:
   * **Execute as:** Me
   * **Who has access:** Anyone
4. Click **Deploy**. The `/exec` address stays the same, so you don't need to change `API_URL`.

First time, with no deployment yet? Click **Deploy → New deployment → ⚙️ → Web app**, use the same settings as above, then **Deploy**. Copy the **Web app URL** (it ends with `/exec`) and paste it into `config.js` as `API_URL`.

> ⚠️ **Every time you change `Code.gs`, you must deploy a new version (step 1D).** Otherwise the website keeps using the old code.

### 1D-2. Update for version 2.1 (payments + bulk upload) – do this once
Version 2.1 of `Code.gs` adds online payment details on orders (`paymentMethod`, `paymentStatus`, `paymentRef` columns), the "I have paid" UTR form and the admin **Bulk upload**. After the website change is merged:
1. Paste the new `apps-script/Code.gs` into Apps Script (step 1B) and click Save.
2. Run **`setup`** once (step 1C). It adds the 3 new columns to the `Orders` tab and keeps all your data.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (step 1D). Same `/exec` address, so `config.js` does not change.

Until you do this, orders still work (the payment choice is written into the order's work details), and Bulk upload still works (it saves the whole catalogue instead), but the payment status column and the "I have paid" button need the new backend.

### 1D-3. Update for version 2.2 (customer document upload) – do this once
Version 2.2 lets customers **upload documents for printing / Xerox** with their order, and lets admins **download them from the admin panel** with one click. The files are saved privately in **your Google Drive**, in a folder called **"One Stop Solution - Customer documents"** (one sub-folder per order, e.g. `SR-0012`). After the website change is merged:
1. Paste the new `apps-script/Code.gs` into Apps Script (step 1B) and click Save.
2. Run **`setup`** once (step 1C). Google asks for permission again because the script now also uses **Google Drive**: click **Review permissions → your account → Advanced → Go to (project) → Allow**. `setup` adds the `documents` column to the `Orders` tab (your data is kept) and creates the Drive folder. The other admin e-mail in `ADMIN_EMAILS` is added as an editor of the folder.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** (step 1D). Same `/exec` address, so `config.js` does not change.

Rules built in: PDF, Word (DOC/DOCX), JPG, PNG, Excel and PowerPoint files; up to **10 MB per file** and **10 files per order** (change `MAX_UPLOAD_MB` / `MAX_FILES_PER_ORDER` at the top of `Code.gs`). The backend checks the real file type, not just the name. Customers can add files while placing the order, or later from **Track order / My orders** until the order is Completed or Cancelled. Only the customer with the order's private tracking link / mobile number can upload, and only admins can download.

Until you do this, orders still work, but uploads show "The shop has not switched on online uploads yet" and customers can send files on WhatsApp instead.

### 1E. Optional: tracking links in e-mails
On the website, go to Admin → **Settings** and fill in **Website address**, for example `https://www.yourshop.in/`. Customer e-mails will then include a "Track your order" link.

---

## Part 2 – Google Sign-In "Client ID"

Google Sign-In needs a free **OAuth Client ID**. Admins need it, and so do customers who want to sign in with Google.

1. Go to **https://console.cloud.google.com/** and sign in as **dataongole@gmail.com**.
2. At the top, click the project picker, then **New project**. Name it `One Stop Website` and click **Create**, then select it.
3. In the menu, go to **APIs & Services → OAuth consent screen**. Newer screens call this **Google Auth Platform → Branding / Audience**.
   * **User type:** External
   * **App name:** YOUR ONE STOP SOLUTION
   * **Support e-mail and developer e-mail:** dataongole@gmail.com
   * Save.
   * Under **Audience** (or **Publishing status**), click **Publish app / In production**. The site only asks for name, e-mail and photo, so Google does **not** need to review it. If you leave it in "Testing", only the test users you add can sign in.
4. Go to **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
   * **Application type:** Web application
   * **Name:** Website
   * **Authorised JavaScript origins:** add every address where the site will open. Use `https://` and **no** slash or path at the end:
     * `https://chan424.github.io`
     * `https://yourdomain.com` (after you buy a domain, see Part 5)
     * `https://www.yourdomain.com`
     * `http://localhost:8000` (only if you test on your own computer)
   * You can leave **Authorised redirect URIs** empty.
   * Click **Create**.
5. Copy the **Client ID**. It looks like `1234567890-abc123def.apps.googleusercontent.com`.
6. Paste it in **two places**:
   * In `config.js` (on GitHub, see Part 3): `GOOGLE_CLIENT_ID: "1234567890-abc123def.apps.googleusercontent.com",`
   * In Apps Script `Code.gs`: `var GOOGLE_CLIENT_ID = '1234567890-abc123def.apps.googleusercontent.com';` Then **deploy a new version** (Part 1D).
7. Open the website, click **Sign in**, and sign in with dataongole@gmail.com. The dark **Admin** bar should appear.

**How the security works (in short):** Google gives the browser a signed "ID token". Every admin action sends this token to your Apps Script. The script asks Google (`oauth2.googleapis.com/tokeninfo`) whether the token is genuine. It also checks that the token was made for *your* Client ID, that the e-mail is verified, and that the e-mail is in `ADMIN_EMAILS`. Someone who edits the website in their own browser still cannot see or change orders.

**To add or remove an admin:** edit `ADMIN_EMAILS` in `Code.gs` and deploy a new version. That list is the real check. Also update `ADMIN_EMAILS` in `config.js`, which only decides which buttons are shown.

---

## Part 3 – How to update the website on GitHub

Your files are at **https://github.com/chan424/onestopongole**. GitHub Pages updates the live site about 1 minute after every change.

### Option A – Edit one file in the browser (easiest)
1. Open the repository and click the file, for example `config.js`.
2. Click the ✏️ **pencil** (Edit this file).
3. Make your change, for example paste the Client ID or a phone number.
4. Click **Commit changes…**, write a short note such as "Add phone number", and click **Commit changes**.

### Option B – Upload new or changed files
1. Open the repository and click **Add file → Upload files**.
2. Drag the files or folders in. Keep the same names and folders, for example `assets/style.css`. A file with the same name is replaced.
3. Click **Commit changes**.

### Option C – With Git on a computer (for later)
```bash
git clone https://github.com/chan424/onestopongole.git   # first time only
cd onestopongole
git pull                      # get the latest version
# ... edit files ...
git add .
git commit -m "Update prices"
git push                      # site updates in about 1 minute
```

### About this new version (pull request)
The new version is on the branch **`professional-v2`**, with a **pull request** to `main`. To make it live:
1. Open the repository and go to **Pull requests**, then open "Professional single-page version with admin login".
2. Check the **Files changed** tab. When you are happy, click **Merge pull request → Confirm merge**.
3. Do **Part 1** (new `Code.gs` + new deployment) and **Part 2** (Client ID) **at the same time**, so the new website and new backend match.

> Until the backend is updated, the customer order form and tracking still work. The price list uses the built-in list, and admin sign-in shows a message asking you to update the backend.

### Changing prices
You don't need GitHub for this. Sign in as admin, go to **Catalogue**, edit the prices, then click **Save catalogue**.

#### Many items at once: Excel upload or paste
In Admin → **Catalogue**, click **Bulk upload (Excel / paste)**.
1. Click **Excel template** (downloads `items-template.xlsx`) or **CSV template** (`assets/items-template.csv`) to download the format, or **Current price list** to download everything already on the website and edit it.
2. Fill one row per item. Columns (keep the header row):

| Column | Required | Example | Notes |
|---|---|---|---|
| **Item Name** | yes | `Colour print (A3)` | If the name already exists on the website, that item is **updated**; otherwise it is **added**. |
| **Category** | yes | `Printing (B/W & Colour)` | Use an existing category name. A new name creates a new category. |
| **Price (Rs)** | yes | `30` | Number only (`₹`, `Rs` and commas are ignored). |
| **Unit** | no | `per page` | e.g. per item, per device, per visit. |
| **Available (Yes/No)** | no | `Yes` | `No` hides it from the website. Empty = Yes for new items, unchanged for existing ones. |
| **Description** | no | `130 GSM paper` | Short text under the name. |
| **Popular (Yes/No)** | no | `No` | Shows a "Popular" tag. |
| **On-site (Yes/No)** | no | `No` | Yes asks the customer for an address. |

3. Either **choose the file** (.xlsx, .xls or .csv), or select the rows in Excel / Google Sheets, copy (Ctrl+C) and **paste** them into the box, then click **Check pasted rows**. Without a header row, columns are read in the order above.
4. Check the **preview**: each row shows *New*, *Update* or the error. Rows with errors are skipped.
5. Click **Save … items to website**.

### Payments (Cash on Delivery or PhonePe)
* Customers choose **Cash on Delivery** (default) or **Pay now by PhonePe / UPI** when ordering. PhonePe shows the number **9989481720**, the amount, a QR code and an "Open PhonePe / UPI app" button. They can type the **UTR / transaction number** in the form, or after placing the order ("I have paid").
* In Admin → **Orders**, the *Payment* column shows **COD**, **Not paid**, **Check UTR** or **Paid**. Open the order, check the UTR in your PhonePe app, set **Payment status → Paid (verified)**, fill **Total paid**, and click **Save update**.
* The UPI ID in `config.js` (`UPI_ID`) is a guess (`9989481720@ybl`). Open PhonePe → your profile → copy your real UPI ID, and put it in `config.js` or in Admin → **Settings → UPI ID**. The change is saved in the `Catalogue` tab of your Sheet. The built-in list in `assets/catalogue.js` is only used in demo mode or when the backend can't be reached.

---

## Part 4 – Host free on GitHub Pages

1. Open the repository and go to **Settings → Pages** (left menu).
2. Under **Build and deployment**, set:
   * **Source:** Deploy from a branch
   * **Branch:** `main`, folder `/ (root)`, then click **Save**.
3. Wait 1–2 minutes. The page shows the address: **https://chan424.github.io/onestopongole/**
4. Make sure `https://chan424.github.io` is in your Client ID's **Authorised JavaScript origins** (Part 2).

---

## Part 5 – Use your own domain (e.g. `yourshop.in`)

Buy a domain from GoDaddy, Hostinger, BigRock, Namecheap or any registrar. Then connect it like this.

### 5A. Tell GitHub your domain
1. Open the repository and go to **Settings → Pages → Custom domain**. Type `www.yourshop.in` (recommended) or `yourshop.in` and click **Save**.
   * GitHub then adds a file called **`CNAME`** to your repository, containing just your domain. You can also create this file yourself: **Add file → Create new file**, name it `CNAME`, write `www.yourshop.in` in it, and commit.
2. Optional but recommended: verify the domain under GitHub **Settings (your profile) → Pages → Add a domain**. This stops anyone else from using it.

### 5B. Add DNS records at your domain company
Open the domain's **DNS / Manage DNS** page. Delete any old "parked" **A** records for `@`, then add these records:

| Type | Name / Host | Value / Points to | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | default / 1 hour |
| A | `@` | `185.199.109.153` | default |
| A | `@` | `185.199.110.153` | default |
| A | `@` | `185.199.111.153` | default |
| CNAME | `www` | `chan424.github.io` | default |

The IP addresses above are GitHub Pages' official addresses, checked on GitHub's help page "Managing a custom domain for your GitHub Pages site". Optional IPv6 (AAAA) records for `@` are `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` and `2606:50c0:8003::153`.

Notes for each domain company:
* **GoDaddy:** go to *My Products → Domain → DNS*. Edit the existing `A @` record (it usually says "Parked"), then add 3 more. Edit the `www` CNAME to `chan424.github.io`.
* **Hostinger:** go to *Domains → Manage → DNS / Nameservers*. Delete the default `A @` and `CNAME www` records, then add the ones above.
* **BigRock:** go to *Manage Domain → DNS Management → Manage DNS*. Add the A records on the "A Records" tab and the CNAME on the "CNAME Records" tab.
* Do **not** add a wildcard record (`*`).

### 5C. Wait, then turn on HTTPS
* DNS changes can take a few minutes, and sometimes up to 24 hours.
* Go back to **Settings → Pages**. When the DNS check turns green, tick **Enforce HTTPS**. This can take up to 24 hours to become available.
* Add `https://yourshop.in` and `https://www.yourshop.in` to your Client ID's **Authorised JavaScript origins** (Part 2).
* In Admin → **Settings**, set **Website address** to `https://www.yourshop.in/`.

### Other free hosting options
* **Netlify** (netlify.com): click *Add new site → Import from GitHub* and choose `onestopongole`. Leave the build command empty and set the publish directory to `/`. Then go to *Domain settings → Add custom domain* and follow Netlify's DNS instructions.
* **Cloudflare Pages** (pages.cloudflare.com): click *Create → Pages → Connect to Git*. No build command is needed; set the output directory to `/`. Then go to *Custom domains → Set up a domain*. If you move your domain's nameservers to Cloudflare, it sets up DNS and HTTPS for you.
* With either one, add the new site address to the Client ID's **Authorised JavaScript origins**.

---

## Part 6 – Notifications: e-mail, WhatsApp and SMS

### Free and already working: e-mail
* Both admins get an e-mail for every new order.
* Customers get a confirmation e-mail when they give an e-mail address or sign in with Google.
* Customers get another e-mail every time you change the status or send them a message.
* Turn these on or off at the top of `Code.gs`: `EMAIL_ADMINS_ON_NEW_ORDER`, `EMAIL_CUSTOMER_ON_NEW_ORDER` and `EMAIL_CUSTOMER_ON_STATUS_CHANGE`.
* Gmail lets a normal account send about **100 e-mails a day**. Admin → Settings shows how many are left today.
* To check that it works, go to Admin → Settings and click **Send me a test e-mail**.

### Free WhatsApp (manual, one tap)
* After a customer places an order, they can tap **Send on WhatsApp**. It opens WhatsApp with the order details already typed, addressed to your shop number.
* In Admin → Orders → open an order → **WhatsApp customer** opens WhatsApp with a ready-made status message for that customer.
* This needs your **WHATSAPP** number. Put it in `config.js`, or in Admin → Settings.

### Optional automatic messages (all OFF until you add keys)
Put keys in **Apps Script → Project Settings (⚙️) → Script properties**, **not** in the code, because the code is public on GitHub. Each channel switches on as soon as its keys exist. Admin → Settings shows which channels are on.

| Channel | What it does | Cost (check current price) | Script properties |
|---|---|---|---|
| **CallMeBot** | WhatsApp alert to **your own** phone for every new order | Free (personal use) | `CALLMEBOT_PHONE` (e.g. `+919876543210`), `CALLMEBOT_APIKEY` |
| **WhatsApp Cloud API** (Meta) | Automatic WhatsApp to **customers** (order received / status) | Meta charges per message. "Utility" messages to India are about **₹0.12 each** (Meta's rate card from Oct 2026). You also need a Meta Business account, a phone number, and an **approved template**. | `WA_CLOUD_TOKEN`, `WA_CLOUD_PHONE_ID`, `WA_CLOUD_TEMPLATE` (default `order_update`), `WA_CLOUD_LANG` (default `en`) |
| **Fast2SMS** | SMS to customers | "Quick SMS" (no registration): about **₹7 per SMS**. DLT route: about ₹0.11–₹0.25 per SMS, but you must register on DLT first. Minimum recharge ₹100. | `FAST2SMS_APIKEY` |

**CallMeBot setup:**
1. Save the CallMeBot number `+34 644 51 95 23` in your phone contacts (check the current number on callmebot.com, as it sometimes changes).
2. Send it the WhatsApp message `I allow callmebot to send me messages`.
3. It replies with your API key. Add `CALLMEBOT_PHONE` and `CALLMEBOT_APIKEY` as script properties.

**WhatsApp Cloud API setup:**
1. On developers.facebook.com, click *Create app → Business → WhatsApp*.
2. Add your business phone number and create a permanent access token.
3. Create a **Utility** template named `order_update`, with body text such as `Hello {{1}}, your order {{2}} is now {{3}}. - One Stop Solution`.
4. Wait for Meta to approve the template.
5. Add the script properties.

**Fast2SMS setup:**
1. Sign up at fast2sms.com and recharge.
2. Copy your API key from *Dev API*.
3. Add `FAST2SMS_APIKEY` as a script property.

After adding properties you don't need to redeploy, because properties are read every time. You **do** need to redeploy after changing `Code.gs` itself.

### In-app notifications (built in)
* **Customers:** "My orders" shows a red **New update** badge and a small pop-up message when the shop changes an order. The website checks every minute while it is open.
* **Admins:** the **Orders** tab shows a red number for new orders since you last looked, and the Dashboard shows a "new orders" banner. A pop-up appears when a new order arrives while the page is open.

---

## Part 7 – Everyday use (admins)

1. Open the website, click **Sign in** (or **Staff login** in the footer), and choose your Google account.
2. **Dashboard:** today's picture.
3. **Orders:** a 📎 number in the *Service* column means the customer uploaded documents. Open the order and use **Download** next to each file (or **Download all**) under **Customer documents**. **Open in Drive** opens the same file in Google Drive. Then choose a status (Pending → Confirmed → In Progress → Ready → Completed), enter the bill amount and amount paid, type a message for the customer if you like, and tap **Save update**. The customer is e-mailed automatically. Tap **WhatsApp customer** to send them a WhatsApp too.
4. **New order:** for walk-in or phone customers.
5. **Catalogue:** edit prices, add services, and hide anything not available today. Then tap **Save catalogue**.
6. **Settings:** phone, WhatsApp, address, hours, UPI and announcement bar.
7. **Website** tab: go back to the normal customer view. You stay signed in. A Google sign-in lasts about 1 hour; after that, just sign in again.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Google Sign-In is not set up yet" | Put the Client ID in `config.js` (Part 2). |
| Google button says *origin not allowed* / error 400 | Add the exact site address (e.g. `https://chan424.github.io`) to **Authorised JavaScript origins**, then wait 5 minutes. |
| "The Apps Script backend is an older version" | Paste the new `Code.gs` and **deploy a new version** (Part 1D). |
| "This sign-in was not made for this website" | The Client ID in `Code.gs` and `config.js` don't match. |
| "This Google account is not an admin" | Sign in with dataongole@gmail.com or rajub.369@gmail.com, or add the e-mail to `ADMIN_EMAILS` in `Code.gs` and redeploy. |
| Changes on GitHub don't show | Wait 1–2 minutes, then hard-refresh with Ctrl+F5. On a phone, close and reopen the tab. |
| Customer upload says "not switched on yet" / Download says "Update the Apps Script backend" | Do Part 1D-3 (paste `Code.gs` v2.2, run `setup`, allow Drive, deploy a new version). |
| Download says the file was not found in Google Drive | The file was deleted or is in the Drive trash. Restore it from the Drive trash, or ask the customer to upload it again. |
| E-mails not arriving | Check the Spam folder. In Apps Script, open **Executions** to see errors. The daily Gmail limit may be reached. |
