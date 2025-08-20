# PRODUCT REQUIREMENTS DOCUMENT: GTA Pool Schedule Finder (API Version)

## PROJECT OVERVIEW
**Product Name:** GTA Pool Schedule Finder  
**Version:** 2.0 (API-Based)  
**Date:** August 20, 2025  
**Problem Statement:** Parent needs to quickly identify available child-appropriate swim sessions across multiple GTA municipalities without visiting 4+ different websites.

## KEY DISCOVERY
All three municipalities expose their schedule data via JSON APIs, eliminating the need for complex web scraping. This dramatically simplifies the solution.

## USERS & USE CASES
**Primary User:** Parent planning same-day pool visits with child (age 5, autism level II)  
**Key Use Case:** "It's 2pm on Saturday. Show me all child-friendly swim times today after 3pm, sorted by distance from home"

## SYSTEM ARCHITECTURE

### Two Components
1. **Data Collector** - Node.js script that calls APIs seasonally
2. **Pool Finder App** - Single HTML file for daily use

## API SPECIFICATIONS

### Oakville & Burlington (PerfectMind System)

Both municipalities use the same system with different IDs:

**Oakville:**
```
Base URL: https://townofoakville.perfectmind.com/24974
Calendar ID: be3ea5f4-ef36-101d-d685-729ff55fe6b0
Widget ID: 9defe1d4-77c5-443d-9302-4960d6d2ee7b
```

**Burlington:**
```
Base URL: https://cityofburlington.perfectmind.com/22818
Calendar ID: 598fc12b-1445-4708-8de3-4a997690a6a3
Widget ID: 9fa0aeb1-bf02-4386-8a83-3a6749a37571
```

**Process:**
1. GET the main page to extract RequestVerificationToken from HTML
2. POST to `/Clients/BookMe4BookingPagesV2/ClassesV2` with token

**Request Payload Structure:**
```javascript
{
  "calendarId": "[specific to municipality]",
  "widgetId": "[specific to municipality]",
  "page": 0,
  "values[1][Name]": "Date Range",
  "values[1][Value]": "2025-09-01T00:00:00.000Z",
  "values[1][Value2]": "2025-12-31T00:00:00.000Z",
  "values[1][ValueKind]": 6,
  "RequestVerificationToken": "[extracted from HTML]"
}
```

### Mississauga (ActiveNet System)

**Endpoint:** `https://anc.ca.apm.activecommunities.com/activemississauga/rest/activities/list?locale=en-US`  
**Method:** POST  
**Pagination:** 20 results per page (147 total = 8 pages)

**Request Payload:**
```javascript
{
  "activity_search_pattern": {
    "activity_select_param": 2,
    "activity_category_ids": ["42"],        // Swimming
    "activity_type_ids": ["7"],             // Drop-in
    "activity_other_category_ids": ["7","6"], // Child-friendly
    "date_after": "2025-09-01",
    "days_of_week": "0000000"
  },
  "activity_transfer_pattern": {}
}
```

### Milton
**Status:** To be investigated  
**Fallback:** Manual data entry if API not available

## DATA TRANSFORMATION

### Input Data Structure (from APIs)

**PerfectMind Response (Oakville/Burlington):**
```json
{
  "EventName": "Leisure Swim",
  "Location": "Lions Pool",
  "Address": {
    "Street": "159 Felan Ave.",
    "City": "Oakville",
    "PostalCode": "L6K 2X7"
  },
  "OccurrenceDate": "20250901",
  "FormattedStartTime": "2:30 PM",
  "FormattedEndTime": "4:00 PM",
  "AgeRestrictions": "",
  "Details": "All ages welcome..."
}
```

**ActiveNet Response (Mississauga):**
```json
{
  "name": "Fun Swim",
  "location": {
    "label": "River Grove Cmty Centre"
  },
  "age_description": "6 yrs +",
  "days_of_week": "Sat",
  "time_range": "12:30 PM - 1:55 PM",
  "date_range_start": "2025-09-20",
  "date_range_end": "2026-01-03"
}
```

### Output Data Structure (pool-data.json)

```json
{
  "metadata": {
    "last_updated": "2025-08-20",
    "season": "Fall 2025"
  },
  "pools": [
    {
      "id": "oakville-lions-pool",
      "name": "Lions Pool",
      "municipality": "Oakville",
      "province": "ON",
      "address": "159 Felan Ave., Oakville, ON L6K 2X7",
      "latitude": 43.439757,
      "longitude": -79.680585,
      "schedules": [
        {
          "day_of_week": "Monday",
          "swim_type": "Leisure Swim",
          "is_child_friendly": true,
          "start_time": "14:30",
          "end_time": "16:00",
          "age_restriction": "All ages",
          "date_range": {
            "start": "2025-09-01",
            "end": "2025-12-31"
          }
        }
      ]
    }
  ]
}
```

## SWIM TYPE CLASSIFICATION

### Child-Friendly (Include)
- "Fun Swim" 
- "Leisure Swim" (when all ages)
- "Public Swim"
- "Family Swim"
- "Parent and Tot"
- "Parent & Tot"
- "Combo Swim"
- Any swim with "All ages" or age minimum ≤ 5

### Not Child-Friendly (Exclude)
- "Adult Leisure Swim" (16+)
- "Lane Swim"
- "Length Swim"
- "Adult Swim"
- "Aquafit"
- Any swim with age minimum > 6

## IMPLEMENTATION SPECIFICATIONS

### Data Collector (Node.js)

**File Structure:**
```
/data-collector
  - index.js              # Main orchestrator
  - collectors/
    - perfectmind.js      # Oakville & Burlington
    - activenet.js        # Mississauga
  - config.json           # API endpoints and IDs
  - output/
    - pool-data.json      # Final output
```

**Key Functions:**

```javascript
// perfectmind.js
async function collectPerfectMindData(config) {
  // 1. Fetch HTML page to get token
  const html = await fetch(config.baseUrl);
  const token = extractToken(html);
  
  // 2. Call API with token
  const response = await fetch(`${config.baseUrl}/ClassesV2`, {
    method: 'POST',
    body: buildPayload(config, token, dateRange)
  });
  
  // 3. Transform to standard format
  return transformPerfectMindData(response);
}

// activenet.js
async function collectActiveNetData() {
  const allResults = [];
  
  // Loop through pages (147 results / 20 per page = 8 pages)
  for (let page = 1; page <= 8; page++) {
    const response = await fetch(ACTIVENET_URL, {
      method: 'POST',
      body: buildActiveNetPayload(page)
    });
    allResults.push(...response.body.activity_items);
  }
  
  return transformActiveNetData(allResults);
}
```

### Pool Finder App (HTML/JavaScript)

**Single file: index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <title>GTA Pool Schedule Finder</title>
  <style>
    /* All CSS embedded here */
  </style>
</head>
<body>
  <div id="app">
    <h1>Pool Schedule Finder</h1>
    <div id="controls">
      <button onclick="showTodayPools()">Today's Swims</button>
      <input type="time" id="afterTime" value="14:00">
    </div>
    <div id="results"></div>
  </div>
  
  <script>
    // Embed pool data
    const poolData = /* pool-data.json content */;
    
    // Distance calculation
    const HOME = { lat: 43.5890, lng: -79.7300 }; // Mississauga
    
    function getDistance(pool) {
      // Haversine formula
    }
    
    function showTodayPools() {
      const today = new Date().getDay();
      const currentTime = document.getElementById('afterTime').value;
      
      // Filter and sort pools
      const available = poolData.pools
        .filter(pool => hasSwimToday(pool, today, currentTime))
        .sort((a, b) => getDistance(a) - getDistance(b));
      
      // Display results
      displayPools(available);
    }
  </script>
</body>
</html>
```

## SUCCESS METRICS

- ✅ Collector runs in < 30 seconds (vs 10+ minutes for scraping)
- ✅ App shows only child-friendly swims
- ✅ Distance sorting accurate within 1km
- ✅ Works offline after loading
- ✅ Handles schedule date ranges properly
- ✅ Zero dependency on website UI changes

## ERROR HANDLING

### Token Expiration
- Retry with fresh token if 401/403 error
- Log token fetch failures

### API Changes
- Validate response structure
- Alert if expected fields missing
- Save partial data when possible

### Network Issues
- Retry failed requests (max 3)
- Continue with other municipalities if one fails

## TESTING CHECKLIST

- [ ] Token extraction works for PerfectMind sites
- [ ] All 8 pages fetched from Mississauga
- [ ] Child-friendly filtering correct
- [ ] Date range handling (current vs future)
- [ ] Distance calculations accurate
- [ ] Schedule display for "today only"
- [ ] Mobile responsive layout
- [ ] Offline functionality

## DEVELOPMENT PHASES

### Phase 1: Data Collector (2-3 hours)
1. Build PerfectMind collector (works for 2 cities)
2. Build ActiveNet collector for Mississauga
3. Test data transformation
4. Generate first pool-data.json

### Phase 2: Display App (1-2 hours)
1. Create HTML structure
2. Implement filtering logic
3. Add distance sorting
4. Style for mobile/desktop

### Phase 3: Testing & Polish (1 hour)
1. Test with real data
2. Verify child-friendly classifications
3. Add error messages
4. Create usage documentation

## SAMPLE COLLECTOR EXECUTION

```bash
$ node index.js

🏊 GTA Pool Schedule Collector
================================
✓ Fetching Oakville token...
✓ Collecting Oakville schedules... (234 swims found)
✓ Fetching Burlington token...
✓ Collecting Burlington schedules... (189 swims found)
✓ Collecting Mississauga schedules...
  - Page 1/8... (20 swims)
  - Page 2/8... (20 swims)
  - Page 3/8... (20 swims)
  - Page 4/8... (20 swims)
  - Page 5/8... (20 swims)
  - Page 6/8... (20 swims)
  - Page 7/8... (20 swims)
  - Page 8/8... (7 swims)
✓ Total Mississauga: 147 swims found

📊 Summary:
- Total pools: 28
- Total swim sessions: 570
- Child-friendly sessions: 412
- Data saved to: ./output/pool-data.json

✅ Collection complete in 18 seconds!
```

## NOTES FOR CODING AGENT

1. **Start with PerfectMind collector** - it handles 2 municipalities
2. **Token extraction:** Look for `<input name="__RequestVerificationToken"` in HTML
3. **Use native fetch() or axios** - no Puppeteer needed!
4. **For Mississauga pagination:** Calculate pages as `Math.ceil(totalRecords / 20)`
5. **Transform times to 24hr format** for consistent sorting
6. **Cache home coordinates** in localStorage
7. **Test with September 2025 data** (current season)

## APPENDIX: KEY URLS

```javascript
const API_ENDPOINTS = {
  oakville: {
    page: 'https://townofoakville.perfectmind.com/24974/Clients/BookMe4BookingPages/Classes',
    api: 'https://townofoakville.perfectmind.com/24974/Clients/BookMe4BookingPagesV2/ClassesV2',
    calendarId: 'be3ea5f4-ef36-101d-d685-729ff55fe6b0',
    widgetId: '9defe1d4-77c5-443d-9302-4960d6d2ee7b'
  },
  burlington: {
    page: 'https://cityofburlington.perfectmind.com/22818/Clients/BookMe4BookingPages/Classes',
    api: 'https://cityofburlington.perfectmind.com/22818/Clients/BookMe4BookingPagesV2/ClassesV2',
    calendarId: '598fc12b-1445-4708-8de3-4a997690a6a3',
    widgetId: '9fa0aeb1-bf02-4386-8a83-3a6749a37571'
  },
  mississauga: {
    api: 'https://anc.ca.apm.activecommunities.com/activemississauga/rest/activities/list?locale=en-US'
  }
};
```

---

**END OF PRD v2.0**

This API-based approach eliminates all the complexity of web scraping while providing faster, more reliable data collection.