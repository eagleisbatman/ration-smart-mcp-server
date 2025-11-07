#!/usr/bin/env node

/**
 * Database Query Script for Feed Formulation
 * Run this from your local machine or Docker host to check database
 */

import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: process.env.POSTGRES_HOST || '172.17.0.1',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'feed_formulation_user',
  password: process.env.POSTGRES_PASSWORD || 'feed_formulation_password369',
  database: process.env.POSTGRES_DB || 'feed_formulation_db',
  connectionTimeoutMillis: 10000
});

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${client.host}:${client.port}`);
    console.log(`   Database: ${client.database}`);
    console.log(`   User: ${client.user}\n`);

    await client.connect();
    console.log('✅ Connected successfully!\n');

    // 1. Check total feeds
    const totalFeeds = await client.query('SELECT COUNT(*) as total FROM feeds');
    console.log(`📊 Total feeds in database: ${totalFeeds.rows[0].total}\n`);

    // 2. Countries with feeds
    const countriesWithFeeds = await client.query(`
      SELECT 
        fd_country_name,
        fd_country_id,
        COUNT(*) as feed_count,
        COUNT(DISTINCT fd_type) as feed_types_count
      FROM feeds 
      GROUP BY fd_country_name, fd_country_id 
      ORDER BY feed_count DESC
    `);
    
    console.log('🌍 Countries with feeds:');
    console.log('='.repeat(60));
    countriesWithFeeds.rows.forEach(row => {
      console.log(`\n  Country: ${row.fd_country_name}`);
      console.log(`  Country ID: ${row.fd_country_id}`);
      console.log(`  Total Feeds: ${row.feed_count}`);
      console.log(`  Feed Types: ${row.feed_types_count}`);
    });
    console.log('\n');

    // 3. Feed breakdown by type
    const feedTypes = await client.query(`
      SELECT 
        fd_type,
        COUNT(*) as count
      FROM feeds 
      GROUP BY fd_type
      ORDER BY count DESC
    `);
    
    console.log('📦 Feed breakdown by type:');
    console.log('='.repeat(60));
    feedTypes.rows.forEach(row => {
      console.log(`  ${row.fd_type}: ${row.count} feeds`);
    });
    console.log('\n');

    // 4. All countries in system
    const allCountries = await client.query(`
      SELECT 
        id,
        name,
        country_code,
        currency,
        is_active
      FROM country 
      ORDER BY name
    `);
    
    console.log('🗺️  All countries registered in system:');
    console.log('='.repeat(60));
    allCountries.rows.forEach(row => {
      const status = row.is_active ? '✅ Active' : '❌ Inactive';
      console.log(`\n  ${row.name} (${row.country_code})`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Currency: ${row.currency}`);
      console(`    Status: ${status}`);
    });
    console.log('\n');

    // 5. Check which countries have feeds vs which are registered
    const countriesComparison = await client.query(`
      SELECT 
        c.id,
        c.name,
        c.country_code,
        c.currency,
        c.is_active,
        COUNT(f.feed_id) as feed_count
      FROM country c
      LEFT JOIN feeds f ON c.id = f.fd_country_id
      GROUP BY c.id, c.name, c.country_code, c.currency, c.is_active
      ORDER BY feed_count DESC, c.name
    `);
    
    console.log('📋 Countries: Registered vs Has Feeds');
    console.log('='.repeat(60));
    countriesComparison.rows.forEach(row => {
      const feedStatus = row.feed_count > 0 ? `✅ ${row.feed_count} feeds` : '❌ No feeds';
      const activeStatus = row.is_active ? 'Active' : 'Inactive';
      console.log(`\n  ${row.name} (${row.country_code})`);
      console.log(`    Status: ${activeStatus}`);
      console.log(`    Feeds: ${feedStatus}`);
      console.log(`    Currency: ${row.currency}`);
    });
    console.log('\n');

    // 6. Sample feeds from each country
    const sampleFeeds = await client.query(`
      SELECT DISTINCT ON (fd_country_id)
        fd_country_name,
        fd_name,
        fd_type,
        fd_category
      FROM feeds
      ORDER BY fd_country_id, fd_name
      LIMIT 10
    `);
    
    console.log('🔍 Sample feeds (first feed from each country):');
    console.log('='.repeat(60));
    sampleFeeds.rows.forEach(row => {
      console.log(`  ${row.fd_country_name}: ${row.fd_name} (${row.fd_type} - ${row.fd_category})`);
    });
    console.log('\n');

    await client.end();
    console.log('✅ Database check complete!');

  } catch (error) {
    console.error('\n❌ Error connecting to database:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. The IP 172.17.0.1 is a Docker bridge network IP');
      console.error('   2. Database is only accessible from:');
      console.error('      - Same Docker network');
      console.error('      - Docker host machine');
      console.error('      - Via SSH tunnel');
      console.error('\n   3. Try running this script from:');
      console.error('      - The Docker host machine');
      console.error('      - A container in the same Docker network');
      console.error('      - Via SSH tunnel: ssh -L 5432:172.17.0.1:5432 user@host');
    }
    
    process.exit(1);
  }
}

checkDatabase();

