/*
 * ============================================================
 *  SETTINGS FOR YOUR WEBSITE  -  this is the main file you edit
 * ============================================================
 *  Rules: keep the quotation marks " " and the comma at the end of
 *  every line. Change only the text between the quotes.
 *  Full help: see SETUP-GUIDE.md
 */
window.APP_CONFIG = {

  // 1. Google Apps Script Web App URL (it ends with /exec).
  //    Leave it "" to run the website in DEMO MODE (everything is saved only in your browser).
  API_URL: "https://script.google.com/macros/s/AKfycbyGBz0sXR0dwVMcqB9Auqde_GbpHUxRi09taFuhZRY6snXXKUaezo8_U6DNZl_Hiu58/exec",

  // 2. Google Sign-In "Client ID" (looks like 1234567890-abc123.apps.googleusercontent.com).
  //    Create it in Google Cloud Console - see SETUP-GUIDE.md, Part 2.
  //    Paste the SAME value into apps-script/Code.gs (GOOGLE_CLIENT_ID).
  GOOGLE_CLIENT_ID: "439773724689-sj1744d6adfq7qn7mr1h0nhtqa212j8g.apps.googleusercontent.com",

  // 3. Admin e-mails. This list only decides which buttons are SHOWN.
  //    The real security check is the ADMIN_EMAILS list inside apps-script/Code.gs.
  ADMIN_EMAILS: ["dataongole@gmail.com", "rajub.369@gmail.com"],

  // 4. DEMO MODE: true = try everything in the browser without Google setup.
  //    You can also open any page with  ?demo=1  at the end of the address to preview demo mode.
  DEMO_MODE: false,

  // 5. Shop name and tagline (admins can also change these from the website's Settings tab)
  BUSINESS_NAME: "YOUR ONE STOP SOLUTION",
  BUSINESS_SUBTITLE: "IT & PRINTING SERVICES",
  TAGLINE: "One Place. Every IT & Printing Solution.",

  // 6. Contact details shown to customers (leave "" to hide any of them)
  PHONE: "",          // shop phone, 10 digits, e.g. "9876543210"
  WHATSAPP: "",       // shop WhatsApp number, 10 digits
  EMAIL: "",
  ADDRESS: "Ongole, Prakasam District, Andhra Pradesh",
  HOURS: "Mon - Sat: 9:30 AM - 8:30 PM",
  MAP_LINK: "",       // optional Google Maps link to your shop

  // 7. Optional UPI ID so customers can pay an advance (leave "" to hide)
  UPI_ID: "",
  UPI_NAME: ""
};
