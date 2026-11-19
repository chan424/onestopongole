/* Built-in sample (dummy) catalogue.
 * Used in demo mode, when the backend cannot be reached, and to fill the
 * "Catalogue" sheet the first time the Apps Script runs.
 * After setup, admins edit the catalogue from the website (Admin > Catalogue). */
window.DEFAULT_CATALOGUE = {
  categories: [
    { id: 'computer', name: 'Computer & Laptop Service', icon: 'laptop', tone: 'blue', order: 1, active: true, desc: 'Repairs, upgrades, OS installation and data recovery for laptops and desktops.' },
    { id: 'network', name: 'Networking & Wi-Fi', icon: 'network', tone: 'green', order: 2, active: true, desc: 'LAN cabling, Wi-Fi routers, office networks and internet troubleshooting.' },
    { id: 'cctv', name: 'CCTV Installation', icon: 'cctv', tone: 'indigo', order: 3, active: true, desc: 'HD camera packages for homes, shops and offices with mobile viewing.' },
    { id: 'xerox', name: 'Xerox & Binding', icon: 'copy', tone: 'violet', order: 4, active: true, desc: 'Fast photocopies, lamination, spiral and record binding.' },
    { id: 'printing', name: 'Printing (B/W & Colour)', icon: 'printer', tone: 'red', order: 5, active: true, desc: 'Documents, project reports, photos and certificates on quality paper.' },
    { id: 'design', name: 'Design Work', icon: 'pen', tone: 'purple', order: 6, active: true, desc: 'Visiting cards, flex banners, ID cards, stickers, invitations and logos.' }
  ],
  items: [
    { id: 'c-diag', category: 'computer', name: 'Laptop / Desktop check-up & diagnosis', price: 200, unit: 'per device', desc: 'Full hardware and software check. Amount adjusted in the final bill if you repair with us.', active: true, popular: true, onsite: false },
    { id: 'c-os', category: 'computer', name: 'Windows OS installation with drivers', price: 500, unit: 'per device', desc: 'Windows 10/11 install, drivers, basic software and updates.', active: true, popular: true, onsite: false },
    { id: 'c-format', category: 'computer', name: 'Format + data backup', price: 700, unit: 'per device', desc: 'Backup of your files, clean install and restore.', active: true, onsite: false },
    { id: 'c-virus', category: 'computer', name: 'Virus removal & speed-up', price: 400, unit: 'per device', desc: 'Remove malware, clean start-up, make your PC fast again.', active: true, onsite: false },
    { id: 'c-ssd', category: 'computer', name: 'SSD upgrade (fitting charge)', price: 300, unit: 'per device', desc: 'Fit a new SSD and move your system to it. SSD cost extra.', active: true, onsite: false },
    { id: 'c-recovery', category: 'computer', name: 'Data recovery (HDD / pen drive)', price: 1500, unit: 'starting from', desc: 'Recover deleted or lost files. Final price after inspection.', active: true, onsite: false },
    { id: 'c-screen', category: 'computer', name: 'Laptop screen / keyboard replacement', price: 800, unit: 'labour + parts', desc: 'Genuine and compatible parts. Price depends on model.', active: true, onsite: false },
    { id: 'n-wifi', category: 'network', name: 'Wi-Fi router setup', price: 300, unit: 'per router', desc: 'Router configuration, password security and coverage check.', active: true, popular: true, onsite: true },
    { id: 'n-lan', category: 'network', name: 'LAN cabling point (Cat6)', price: 450, unit: 'per point', desc: 'Cat6 cable laying with RJ45 and I/O box, up to 15 m.', active: true, onsite: true },
    { id: 'n-office', category: 'network', name: 'Small office network (up to 5 PCs)', price: 3500, unit: 'per site', desc: 'Switch, cabling, printer and file sharing setup.', active: true, onsite: true },
    { id: 'n-trouble', category: 'network', name: 'Internet / network troubleshooting', price: 350, unit: 'per visit', desc: 'On-site fix for slow or no internet problems.', active: true, onsite: true },
    { id: 'v-4cam', category: 'cctv', name: 'CCTV 4-camera HD package', price: 14999, unit: 'complete', desc: '4 x 2MP cameras, 4-channel DVR, 1 TB HDD, cabling, power supply, mobile view setup.', active: true, popular: true, onsite: true },
    { id: 'v-8cam', category: 'cctv', name: 'CCTV 8-camera HD package', price: 26999, unit: 'complete', desc: '8 x 2MP cameras, 8-channel DVR, 2 TB HDD, cabling and installation.', active: true, onsite: true },
    { id: 'v-ip', category: 'cctv', name: 'Wi-Fi smart camera installation', price: 2999, unit: 'per camera', desc: 'Indoor Wi-Fi camera with app setup and SD card.', active: true, onsite: true },
    { id: 'v-amc', category: 'cctv', name: 'CCTV service / maintenance visit', price: 500, unit: 'per visit', desc: 'Camera cleaning, DVR check and repairs (parts extra).', active: true, onsite: true },
    { id: 'x-bw', category: 'xerox', name: 'B/W xerox (A4)', price: 2, unit: 'per page', desc: 'Single side. Both sides Rs 3.', active: true, popular: true, onsite: false },
    { id: 'x-colour', category: 'xerox', name: 'Colour xerox (A4)', price: 10, unit: 'per page', desc: 'Bright colour copies of documents and certificates.', active: true, onsite: false },
    { id: 'x-lam', category: 'xerox', name: 'Lamination (A4)', price: 30, unit: 'per sheet', desc: 'Thick glossy lamination. ID size Rs 15.', active: true, onsite: false },
    { id: 'x-spiral', category: 'xerox', name: 'Spiral binding', price: 40, unit: 'per book', desc: 'Up to 100 pages with plastic covers.', active: true, popular: true, onsite: false },
    { id: 'x-record', category: 'xerox', name: 'Record / project hard binding', price: 150, unit: 'per book', desc: 'Hard cover with golden lettering.', active: true, onsite: false },
    { id: 'p-bw', category: 'printing', name: 'B/W laser print (A4)', price: 3, unit: 'per page', desc: 'From PDF, Word or WhatsApp files.', active: true, onsite: false },
    { id: 'p-colour', category: 'printing', name: 'Colour print (A4)', price: 15, unit: 'per page', desc: 'High quality colour on 100 GSM paper.', active: true, popular: true, onsite: false },
    { id: 'p-photo', category: 'printing', name: 'Photo print (4x6)', price: 20, unit: 'per photo', desc: 'Glossy photo paper.', active: true, onsite: false },
    { id: 'p-passport', category: 'printing', name: 'Passport size photos (8 nos)', price: 60, unit: 'per set', desc: 'With background change if needed.', active: true, onsite: false },
    { id: 'd-vcard', category: 'design', name: 'Visiting card design + print (100)', price: 350, unit: 'per 100 cards', desc: 'Custom design, 300 GSM card, single side.', active: true, popular: true, onsite: false },
    { id: 'd-flex', category: 'design', name: 'Flex banner design + print', price: 12, unit: 'per sq.ft', desc: 'Shop boards, events and functions. Design free above 30 sq.ft.', active: true, onsite: false },
    { id: 'd-id', category: 'design', name: 'PVC ID card with design', price: 80, unit: 'per card', desc: 'School, college and office ID cards with lanyard.', active: true, onsite: false },
    { id: 'd-invite', category: 'design', name: 'Invitation / pamphlet design', price: 500, unit: 'per design', desc: 'Wedding cards, event pamphlets and posters.', active: true, onsite: false },
    { id: 'd-logo', category: 'design', name: 'Logo design', price: 1500, unit: 'per logo', desc: '3 concepts and 2 revisions, all file formats.', active: true, onsite: false }
  ]
};
