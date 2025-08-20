#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const PerfectMindCollector = require('./collectors/perfectmind');
const ActiveNetCollector = require('./collectors/activenet');

class PoolScheduleCollector {
  constructor() {
    this.config = this.loadConfig();
    this.perfectMind = new PerfectMindCollector();
    this.activeNet = new ActiveNetCollector();
    this.poolCoordinates = this.getKnownPoolCoordinates();
  }

  /**
   * Load configuration from config.json
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('❌ Failed to load config.json:', error.message);
      process.exit(1);
    }
  }

  /**
   * Known pool coordinates (manually added based on addresses)
   */
  getKnownPoolCoordinates() {
    return {
      'oakville-lions-pool': { lat: 43.439757, lng: -79.680585 },
      'oakville-glen-abbey-recreation-centre': { lat: 43.436494, lng: -79.670234 },
      'oakville-iroquois-ridge-recreation-centre': { lat: 43.506289, lng: -79.661789 },
      'burlington-aldershot-pool': { lat: 43.299567, lng: -79.794821 },
      'burlington-nelson-pool': { lat: 43.352612, lng: -79.810234 },
      'mississauga-burnhamthorpe-community-centre': { lat: 43.592345, lng: -79.726234 },
      'mississauga-river-grove-community-centre': { lat: 43.548976, lng: -79.638234 }
    };
  }

  /**
   * Add coordinates to pools based on known locations
   */
  addPoolCoordinates(pools) {
    return pools.map(pool => {
      const coords = this.poolCoordinates[pool.id];
      if (coords) {
        pool.latitude = coords.lat;
        pool.longitude = coords.lng;
      }
      return pool;
    });
  }

  /**
   * Collect data from all municipalities
   */
  async collectAllData() {
    console.log('🏊 GTA Pool Schedule Collector');
    console.log('================================');
    
    const startTime = Date.now();
    let allPools = [];
    let totalSessions = 0;
    let childFriendlySessions = 0;

    try {
      // Collect from PerfectMind municipalities (Oakville & Burlington)
      for (const [key, municipalityConfig] of Object.entries(this.config.municipalities)) {
        if (municipalityConfig.system === 'perfectmind') {
          try {
            const pools = await this.perfectMind.collectMunicipalityData(
              municipalityConfig, 
              this.config.dateRange,
              this.config.childFriendlyTypes,
              this.config.excludeTypes
            );
            allPools = [...allPools, ...pools];
            
            const sessionCount = pools.reduce((sum, pool) => sum + pool.schedules.length, 0);
            childFriendlySessions += sessionCount;
          } catch (error) {
            console.error(`❌ Failed to collect ${municipalityConfig.name} data:`, error.message);
          }
        }
      }

      // Collect from Mississauga (ActiveNet)
      try {
        const mississaugaPools = await this.activeNet.collectMississaugaData(
          this.config.dateRange,
          this.config.childFriendlyTypes,
          this.config.excludeTypes
        );
        allPools = [...allPools, ...mississaugaPools];
        
        const sessionCount = mississaugaPools.reduce((sum, pool) => sum + pool.schedules.length, 0);
        childFriendlySessions += sessionCount;
      } catch (error) {
        console.error('❌ Failed to collect Mississauga data:', error.message);
      }

      // Add coordinates to pools
      allPools = this.addPoolCoordinates(allPools);

      // Calculate total sessions (including non-child-friendly that were filtered out)
      totalSessions = allPools.reduce((sum, pool) => sum + pool.schedules.length, 0);

      // Create final output structure
      const outputData = {
        metadata: {
          last_updated: new Date().toISOString().split('T')[0],
          season: this.getSeasonName(),
          collection_time: new Date().toISOString(),
          municipalities: Object.keys(this.config.municipalities).length,
          total_pools: allPools.length,
          total_child_friendly_sessions: childFriendlySessions
        },
        pools: allPools
      };

      // Save to output file
      const outputPath = path.join(__dirname, 'output', 'pool-data.json');
      fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

      // Print summary
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);
      console.log('\n📊 Summary:');
      console.log(`- Total pools: ${allPools.length}`);
      console.log(`- Total swim sessions: ${totalSessions}`);
      console.log(`- Child-friendly sessions: ${childFriendlySessions}`);
      console.log(`- Data saved to: ${outputPath}`);
      console.log(`\n✅ Collection complete in ${elapsedTime} seconds!`);

      return outputData;

    } catch (error) {
      console.error('❌ Collection failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Get current season name based on date range
   */
  getSeasonName() {
    const start = new Date(this.config.dateRange.start);
    const year = start.getFullYear();
    const month = start.getMonth();
    
    if (month >= 8 && month <= 11) { // Sep-Dec
      return `Fall ${year}`;
    } else if (month >= 0 && month <= 2) { // Jan-Mar
      return `Winter ${year}`;
    } else if (month >= 3 && month <= 5) { // Apr-Jun
      return `Spring ${year}`;
    } else { // Jul-Aug
      return `Summer ${year}`;
    }
  }
}

// Run the collector if this file is executed directly
if (require.main === module) {
  const collector = new PoolScheduleCollector();
  collector.collectAllData().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = PoolScheduleCollector;