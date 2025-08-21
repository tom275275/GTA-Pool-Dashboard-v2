const https = require('https');
const { JSDOM } = require('jsdom');

class PerfectMindCollector {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Fetch verification token from the HTML page
   */
  async fetchVerificationToken(pageUrl) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      };

      https.get(pageUrl, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const dom = new JSDOM(data);
            const tokenInput = dom.window.document.querySelector('input[name="__RequestVerificationToken"]');
            if (tokenInput) {
              resolve(tokenInput.value);
            } else {
              reject(new Error('Verification token not found in HTML'));
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Build the POST payload for PerfectMind API
   */
  buildPayload(config, token, dateRange) {
    const params = new URLSearchParams();
    params.append('calendarId', config.calendarId);
    params.append('widgetId', config.widgetId);
    params.append('page', '0');
    params.append('values[1][Name]', 'Date Range');
    params.append('values[1][Value]', `${dateRange.start}T00:00:00.000Z`);
    params.append('values[1][Value2]', `${dateRange.end}T00:00:00.000Z`);
    params.append('values[1][ValueKind]', '6');
    params.append('RequestVerificationToken', token);
    
    return params.toString();
  }

  /**
   * Make API call to fetch schedule data
   */
  async fetchScheduleData(config, token, dateRange) {
    const payload = this.buildPayload(config, token, dateRange);
    
    return new Promise((resolve, reject) => {
      const url = new URL(config.apiUrl);
      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': this.userAgent,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': config.pageUrl
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
            reject(new Error(`Failed to parse JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
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
   * Check if swim type is child-friendly
   */
  isChildFriendly(eventName, ageRestrictions, childFriendlyTypes, excludeTypes) {
    const name = eventName.toLowerCase();
    const restrictions = ageRestrictions.toLowerCase();
    
    // Check exclude list first
    for (const excludeType of excludeTypes) {
      if (name.includes(excludeType.toLowerCase())) {
        return false;
      }
    }
    
    // Check include list
    for (const friendlyType of childFriendlyTypes) {
      if (name.includes(friendlyType.toLowerCase())) {
        return true;
      }
    }
    
    // Check age restrictions
    if (restrictions.includes('all ages') || restrictions.includes('all welcome')) {
      return true;
    }
    
    // Check for specific age minimums
    const ageMatch = restrictions.match(/(\d+)\s*(?:yrs?|years?)\s*\+/);
    if (ageMatch) {
      const minAge = parseInt(ageMatch[1]);
      return minAge <= 5;
    }
    
    return false;
  }

  /**
   * Transform PerfectMind data to standard format
   */
  transformData(rawData, municipality, childFriendlyTypes, excludeTypes) {
    const pools = new Map();
    
    // Handle both 'Classes' and 'classes' properties
    const classes = rawData?.Classes || rawData?.classes;
    if (!rawData || !classes) {
      return [];
    }
    
    for (const event of classes) {
      if (!this.isChildFriendly(event.EventName, event.AgeRestrictions || '', childFriendlyTypes, excludeTypes)) {
        continue;
      }
      
      const poolId = `${municipality.toLowerCase()}-${event.Location.toLowerCase().replace(/\s+/g, '-')}`;
      
      if (!pools.has(poolId)) {
        pools.set(poolId, {
          id: poolId,
          name: event.Location,
          municipality: municipality,
          province: 'ON',
          address: event.Address ? `${event.Address.Street}, ${event.Address.City}, ON ${event.Address.PostalCode}` : '',
          latitude: null, // Will be populated manually or via geocoding
          longitude: null,
          schedules: []
        });
      }
      
      const pool = pools.get(poolId);
      const eventDate = new Date(event.OccurrenceDate.substring(0, 4) + '-' + 
                                 event.OccurrenceDate.substring(4, 6) + '-' + 
                                 event.OccurrenceDate.substring(6, 8));
      
      pool.schedules.push({
        day_of_week: eventDate.toLocaleDateString('en-US', { weekday: 'long' }),
        swim_type: event.EventName,
        is_child_friendly: true,
        start_time: this.parseTime(event.FormattedStartTime),
        end_time: this.parseTime(event.FormattedEndTime),
        age_restriction: event.AgeRestrictions || 'All ages',
        date_range: {
          start: eventDate.toISOString().split('T')[0],
          end: eventDate.toISOString().split('T')[0]
        }
      });
    }
    
    return Array.from(pools.values());
  }

  /**
   * Collect data from a PerfectMind municipality
   */
  async collectMunicipalityData(config, dateRange, childFriendlyTypes, excludeTypes) {
    console.log(`✓ Fetching ${config.name} token...`);
    const token = await this.fetchVerificationToken(config.pageUrl);
    
    console.log(`✓ Collecting ${config.name} schedules...`);
    const rawData = await this.fetchScheduleData(config, token, dateRange);
    
    // Debug: log what we got back
    console.log(`  Raw response keys:`, Object.keys(rawData || {}));
    if (rawData && rawData.Classes && rawData.Classes.length === 0) {
      console.log(`  No classes found in date range ${dateRange.start} to ${dateRange.end}`);
    }
    
    const pools = this.transformData(rawData, config.name, childFriendlyTypes, excludeTypes);
    const totalSessions = (rawData?.Classes || rawData?.classes)?.length || 0;
    console.log(`  (${totalSessions} total sessions, ${pools.reduce((sum, pool) => sum + pool.schedules.length, 0)} child-friendly)`);
    
    return pools;
  }
}

module.exports = PerfectMindCollector;