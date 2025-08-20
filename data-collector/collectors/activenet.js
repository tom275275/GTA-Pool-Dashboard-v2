const https = require('https');

class ActiveNetCollector {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    this.baseUrl = 'https://anc.ca.apm.activecommunities.com/activemississauga/rest/activities/list?locale=en-US';
  }

  /**
   * Build the POST payload for ActiveNet API
   */
  buildPayload(page, dateRange) {
    return JSON.stringify({
      "activity_search_pattern": {
        "activity_select_param": 2,
        "activity_category_ids": ["42"],        // Swimming
        "activity_type_ids": ["7"],             // Drop-in
        "activity_other_category_ids": ["7","6"], // Child-friendly
        "date_after": dateRange.start,
        "days_of_week": "0000000"
      },
      "activity_transfer_pattern": {},
      "page": page
    });
  }

  /**
   * Fetch data from a specific page
   */
  async fetchPage(page, dateRange) {
    const payload = this.buildPayload(page, dateRange);
    
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://anc.ca.apm.activecommunities.com',
          'Referer': 'https://anc.ca.apm.activecommunities.com/activemississauga/'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON response from page ${page}: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Parse time range string (e.g., "12:30 PM - 1:55 PM")
   */
  parseTimeRange(timeRange) {
    const match = timeRange.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!match) return { start: '', end: '' };
    
    const [, startTime, endTime] = match;
    return {
      start: this.parseTime(startTime),
      end: this.parseTime(endTime)
    };
  }

  /**
   * Parse time string to 24-hour format
   */
  parseTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return timeStr;
    
    let [, hours, minutes, period] = match;
    hours = parseInt(hours);
    
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  /**
   * Get day of week from days_of_week string
   */
  parseDaysOfWeek(daysStr) {
    const dayMap = {
      'mon': 'Monday',
      'tue': 'Tuesday', 
      'wed': 'Wednesday',
      'thu': 'Thursday',
      'fri': 'Friday',
      'sat': 'Saturday',
      'sun': 'Sunday'
    };
    
    const lowerDays = daysStr.toLowerCase();
    for (const [abbrev, fullName] of Object.entries(dayMap)) {
      if (lowerDays.includes(abbrev)) {
        return fullName;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Check if swim type is child-friendly based on age description
   */
  isChildFriendly(name, ageDescription, childFriendlyTypes, excludeTypes) {
    const swimName = name.toLowerCase();
    const ageDesc = ageDescription.toLowerCase();
    
    // Check exclude list first
    for (const excludeType of excludeTypes) {
      if (swimName.includes(excludeType.toLowerCase())) {
        return false;
      }
    }
    
    // Check include list
    for (const friendlyType of childFriendlyTypes) {
      if (swimName.includes(friendlyType.toLowerCase())) {
        return true;
      }
    }
    
    // Check age restrictions
    if (ageDesc.includes('all ages') || ageDesc.includes('all welcome')) {
      return true;
    }
    
    // Parse age minimum (e.g., "6 yrs +")
    const ageMatch = ageDesc.match(/(\d+)\s*(?:yrs?|years?)\s*\+/);
    if (ageMatch) {
      const minAge = parseInt(ageMatch[1]);
      return minAge <= 5;
    }
    
    // Default to child-friendly if no clear restriction
    return true;
  }

  /**
   * Transform ActiveNet data to standard format
   */
  transformData(activities, childFriendlyTypes, excludeTypes) {
    const pools = new Map();
    
    for (const activity of activities) {
      if (!this.isChildFriendly(activity.name, activity.age_description || '', childFriendlyTypes, excludeTypes)) {
        continue;
      }
      
      const locationName = activity.location ? activity.location.label : 'Unknown Location';
      const poolId = `mississauga-${locationName.toLowerCase().replace(/\s+/g, '-')}`;
      
      if (!pools.has(poolId)) {
        pools.set(poolId, {
          id: poolId,
          name: locationName,
          municipality: 'Mississauga',
          province: 'ON',
          address: '', // Address not provided in ActiveNet response
          latitude: null,
          longitude: null,
          schedules: []
        });
      }
      
      const pool = pools.get(poolId);
      const timeRange = this.parseTimeRange(activity.time_range || '');
      
      pool.schedules.push({
        day_of_week: this.parseDaysOfWeek(activity.days_of_week || ''),
        swim_type: activity.name,
        is_child_friendly: true,
        start_time: timeRange.start,
        end_time: timeRange.end,
        age_restriction: activity.age_description || 'All ages',
        date_range: {
          start: activity.date_range_start || '',
          end: activity.date_range_end || ''
        }
      });
    }
    
    return Array.from(pools.values());
  }

  /**
   * Collect all Mississauga data by paginating through results
   */
  async collectMississaugaData(dateRange, childFriendlyTypes, excludeTypes) {
    console.log(`✓ Collecting Mississauga schedules...`);
    
    let allActivities = [];
    let page = 1;
    let hasMorePages = true;
    
    // First request to get total count
    const firstPage = await this.fetchPage(page, dateRange);
    
    if (firstPage.body && firstPage.body.activity_items) {
      allActivities = [...firstPage.body.activity_items];
      console.log(`  - Page ${page}/8... (${firstPage.body.activity_items.length} swims)`);
      
      const totalRecords = firstPage.body.total_records || 0;
      const totalPages = Math.ceil(totalRecords / 20);
      
      // Fetch remaining pages
      for (page = 2; page <= totalPages && page <= 8; page++) {
        try {
          const pageData = await this.fetchPage(page, dateRange);
          if (pageData.body && pageData.body.activity_items) {
            allActivities = [...allActivities, ...pageData.body.activity_items];
            console.log(`  - Page ${page}/${totalPages}... (${pageData.body.activity_items.length} swims)`);
          }
        } catch (error) {
          console.log(`  - Warning: Failed to fetch page ${page}: ${error.message}`);
          break;
        }
      }
    }
    
    console.log(`✓ Total Mississauga: ${allActivities.length} swims found`);
    
    const pools = this.transformData(allActivities, childFriendlyTypes, excludeTypes);
    const totalChildFriendly = pools.reduce((sum, pool) => sum + pool.schedules.length, 0);
    console.log(`  (${totalChildFriendly} child-friendly sessions)`);
    
    return pools;
  }
}

module.exports = ActiveNetCollector;