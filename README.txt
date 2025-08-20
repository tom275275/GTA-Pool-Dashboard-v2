GTA POOL SCHEDULE FINDER v2.0
=============================

WHAT IT DOES:
Find child-friendly swim times across Oakville, Burlington, and Mississauga
- Shows only swims suitable for ages 5 and under
- Sorts pools by distance from your home (Mississauga)
- Works offline once loaded
- Perfect for same-day pool planning with Penelope

QUICK START:
1. Double-click: pool-finder.html
2. Click "Find Available Swims"
3. Adjust time and day filters as needed

FILES IN THIS PROJECT:
======================

📱 MAIN APP (for daily use):
   pool-finder.html - The app you'll use every day

🔧 DATA COLLECTOR (run seasonally):
   data-collector/
   ├── index.js - Main collector script
   ├── config.json - API settings and filters
   ├── package.json - Dependencies
   ├── collectors/
   │   ├── perfectmind.js - Oakville & Burlington collector
   │   └── activenet.js - Mississauga collector
   └── output/
       └── pool-data.json - Collected schedule data

SEASONAL DATA UPDATES:
=====================

When new pool schedules are published (typically September, January, April):

1. Open Command Prompt in data-collector folder
2. Run: npm install (first time only)
3. Run: node index.js
4. Wait 20-30 seconds for data collection
5. Copy the new pool-data.json content into pool-finder.html

APP FEATURES:
============

✓ Distance Sorting - Closest pools first
✓ Time Filtering - Only show swims after your chosen time
✓ Day Selection - Any day of the week
✓ Child-Friendly Only - Ages 5 and under welcome
✓ Auto-Save Settings - Remembers your preferences
✓ Mobile Responsive - Works on phone and tablet
✓ Offline Ready - No internet needed after loading
✓ Print Friendly - Print schedules for the fridge

PERFECT FOR ADHD/AUTISM SUPPORT:
================================

✓ Big, clear buttons
✓ Simple one-purpose interface
✓ Visual feedback for all actions
✓ No complex settings or menus
✓ Consistent layout and colors
✓ Instant results (no waiting)

CUSTOMIZATION:
=============

To change home location:
- Edit HOME_COORDS in pool-finder.html (lines ~125)

To add new pool types as child-friendly:
- Edit childFriendlyTypes in config.json

To change municipalities:
- Add new API endpoints to config.json
- Create collector module if needed

TECHNICAL DETAILS:
==================

The system uses real API endpoints from each municipality:
- Oakville & Burlington: PerfectMind booking system
- Mississauga: ActiveNet recreation system
- No web scraping = faster and more reliable

Data is refreshed seasonally, not daily, because:
- Pool schedules don't change frequently
- Reduces server load on municipal systems
- App works instantly offline

SUPPORT:
========

If pools seem outdated:
1. Check the "last updated" date in the app
2. Run the data collector to refresh
3. Most schedules are published 2-4 weeks before season starts

If a pool is missing:
1. Check if it offers child-friendly programs
2. Verify the municipality is supported (Oakville/Burlington/Mississauga)
3. Some pools may be missed if they use different booking systems

BACKUP:
=======

Your schedule data is stored in the HTML file itself.
Click "Export Pool Data" to save a backup copy.
No cloud accounts or external services needed.

PRIVACY:
========

✓ No personal data collected
✓ No tracking or analytics
✓ No internet connection required for daily use
✓ All data stays on your device

VERSION HISTORY:
===============

v2.0 (August 2025):
- Complete rewrite using API endpoints
- Added Mississauga support
- Faster data collection (30 seconds vs 10+ minutes)
- More reliable (no website changes can break it)
- Better mobile responsiveness
- Improved ADHD/autism support features

BUILT FOR YOUR FAMILY:
=====================

This app was specifically designed for:
- Quick decision making (ADHD-friendly)
- Visual clarity (autism-friendly) 
- Family pool outings with a 5-year-old
- Same-day planning ("what's available now?")
- Busy parent schedules (lawyer time constraints)

Enjoy your family swim time! 🏊‍♀️👨‍👩‍👧