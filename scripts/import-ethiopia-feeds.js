#!/usr/bin/env node

/**
 * Import Ethiopia Feeds from Excel to Feed Formulation Database
 * 
 * This script:
 * 1. Reads the Excel file with Ethiopia feed data
 * 2. Transforms data to match database schema
 * 3. Imports via Admin Bulk Upload API
 */

import XLSX from 'xlsx';
import fetch from 'node-fetch';
import 'dotenv/config';

const EXCEL_FILE = '../Analysed chemical composition of feeds (highlighted for compound feeds, horticultural wastes and agroindustrial byproducts).xls';
const API_BASE_URL = process.env.FEED_API_BASE_URL || 'http://47.128.1.51:8000';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''; // Admin user UUID
const ETHIOPIA_COUNTRY_ID = process.env.ETHIOPIA_COUNTRY_ID || ''; // Ethiopia UUID (need to get/create)

// Map sheet names to feed types
const SHEET_TO_FEED_TYPE = {
  'Compound feed': 'Concentrate',
  'Crop residues': 'Forage',
  'Hay': 'Forage',
  'Improved forage': 'Forage',
  'Indigenous browse spp': 'Forage',
  'Natural pature': 'Forage',
  'Horticultural by-products': 'Forage',
  'Other agricultural by-products': 'Concentrate',
  'Agro-industrial by-products': 'Concentrate',
  'Grains and grain screenings': 'Concentrate'
};

// Find feed name column (handles variations)
function findFeedNameColumn(columns) {
  const namePatterns = [
    'common name',
    'Common name',
    'Common/Local name',
    'Vernacular/common name',
    'Vernacular name',
    'common'
  ];
  
  for (const pattern of namePatterns) {
    const col = columns.find(c => 
      c.toLowerCase().includes(pattern.toLowerCase())
    );
    if (col) return col;
  }
  
  return null;
}

// Transform Excel row to database format
function transformRow(row, sheetName, rowIndex) {
  const columns = Object.keys(row);
  const nameCol = findFeedNameColumn(columns);
  
  // Get feed name
  let feedName = row[nameCol] || 
                 row['Scientific name'] || 
                 row['Vernacular name'] ||
                 `${sheetName} ${rowIndex + 1}`;
  
  // Clean feed name
  feedName = String(feedName).trim();
  if (!feedName || feedName === 'null' || feedName === 'undefined') {
    feedName = `${sheetName} Feed ${rowIndex + 1}`;
  }
  
  // Get feed type (from Category column or sheet name)
  const feedType = row['Category'] 
    ? (row['Category'].toLowerCase().includes('compound') || 
       row['Category'].toLowerCase().includes('concentrate') ||
       row['Category'].toLowerCase().includes('grain') ||
       row['Category'].toLowerCase().includes('industrial'))
      ? 'Concentrate' 
      : 'Forage'
    : SHEET_TO_FEED_TYPE[sheetName] || 'Forage';
  
  // Get category
  const category = row['Sub-category'] || 
                   row['Sub-category '] || 
                   sheetName || 
                   '';
  
  // Extract nutritional values (handle variations)
  const getValue = (colPatterns) => {
    for (const pattern of colPatterns) {
      const col = columns.find(c => 
        c.toLowerCase().includes(pattern.toLowerCase())
      );
      if (col && row[col] !== null && row[col] !== undefined && row[col] !== '') {
        const val = parseFloat(row[col]);
        return isNaN(val) ? null : val;
      }
    }
    return null;
  };
  
  const feedData = {
    fd_name: feedName,
    fd_type: feedType,
    fd_category: String(category).trim() || feedType,
    fd_country_name: 'Ethiopia',
    fd_country_cd: 'ETH',
    fd_dm: getValue(['DM(%)', 'DM']),
    fd_ash: getValue(['ASH(%)', 'ASH']),
    fd_cp: getValue(['CP(%)', 'CP (%)', 'CP']),
    fd_ndf: getValue(['NDF(%)', 'NDF']),
    fd_adf: getValue(['ADF(%)', 'ADF']),
    fd_lg: getValue(['ADL(%)', 'ADL']),
    fd_ee: null,
    fd_st: null,
    fd_cf: null,
    fd_nfe: null,
    fd_hemicellulose: null,
    fd_cellulose: null,
    fd_ndin: null,
    fd_adin: null,
    fd_ca: null,
    fd_p: null,
    fd_npn_cp: 0,
    fd_season: '',
    fd_orginin: row['Reference'] || '',
    fd_ipb_local_lab: ''
  };
  
  return feedData;
}

// Read and transform Excel data
function readExcelData() {
  console.log('📖 Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  const allFeeds = [];
  
  workbook.SheetNames.forEach((sheetName) => {
    console.log(`\n📋 Processing sheet: "${sheetName}"`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    console.log(`   Found ${data.length} rows`);
    
    data.forEach((row, index) => {
      try {
        const feedData = transformRow(row, sheetName, index);
        
        // Validate required fields
        if (!feedData.fd_name || !feedData.fd_dm) {
          console.log(`   ⚠️  Skipping row ${index + 1}: Missing required fields`);
          return;
        }
        
        allFeeds.push(feedData);
      } catch (error) {
        console.log(`   ❌ Error processing row ${index + 1}: ${error.message}`);
      }
    });
  });
  
  console.log(`\n✅ Total feeds prepared: ${allFeeds.length}`);
  return allFeeds;
}

// Upload feeds via Admin Add Feed API (batch processing)
async function uploadFeeds(feeds) {
  if (!ADMIN_USER_ID) {
    throw new Error('ADMIN_USER_ID environment variable is required');
  }
  
  if (!ETHIOPIA_COUNTRY_ID) {
    throw new Error('ETHIOPIA_COUNTRY_ID environment variable is required');
  }
  
  console.log('\n📤 Uploading feeds to API...');
  console.log(`   API: ${API_BASE_URL}/admin/add-feed`);
  console.log(`   Admin User ID: ${ADMIN_USER_ID}`);
  console.log(`   Ethiopia Country ID: ${ETHIOPIA_COUNTRY_ID}`);
  console.log(`   Total feeds: ${feeds.length}`);
  console.log(`   Processing in batches of 50...\n`);
  
  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;
  const failedFeeds = [];
  
  // Process in batches
  for (let i = 0; i < feeds.length; i += BATCH_SIZE) {
    const batch = feeds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(feeds.length / BATCH_SIZE);
    
    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (feeds ${i + 1}-${Math.min(i + BATCH_SIZE, feeds.length)})...`);
    
    // Process batch in parallel (with rate limiting)
    const batchPromises = batch.map(async (feed, batchIndex) => {
      const feedData = {
        ...feed,
        fd_country_id: ETHIOPIA_COUNTRY_ID
      };
      
      try {
        const response = await fetch(`${API_BASE_URL}/admin/add-feed?admin_user_id=${ADMIN_USER_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(feedData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.detail || JSON.stringify(result));
        }
        
        return { success: true, feed: feed.fd_name };
      } catch (error) {
        return { 
          success: false, 
          feed: feed.fd_name, 
          error: error.message 
        };
      }
    });
    
    // Wait for batch with small delay between requests
    const batchResults = await Promise.all(
      batchPromises.map((promise, idx) => 
        new Promise(resolve => 
          setTimeout(() => resolve(promise), idx * 100) // 100ms delay between requests
        )
      )
    );
    
    // Count results
    batchResults.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        failedFeeds.push(result);
      }
    });
    
    console.log(`   ✅ Success: ${batchResults.filter(r => r.success).length}, ❌ Failed: ${batchResults.filter(r => !r.success).length}`);
    
    // Small delay between batches
    if (i + BATCH_SIZE < feeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 Upload Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  
  if (failedFeeds.length > 0) {
    console.log('\n❌ Failed feeds (first 10):');
    failedFeeds.slice(0, 10).forEach((fail, i) => {
      console.log(`   ${i + 1}. ${fail.feed}: ${fail.error}`);
    });
  }
  
  return {
    success: failCount === 0,
    total: feeds.length,
    successful: successCount,
    failed: failCount,
    failedFeeds: failedFeeds.slice(0, 20) // Return first 20 failures
  };
}

// Main function
async function main() {
  try {
    console.log('🚀 Ethiopia Feeds Import Script');
    console.log('='.repeat(70));
    
    // Step 1: Read Excel
    const feeds = readExcelData();
    
    if (feeds.length === 0) {
      console.log('\n❌ No feeds to import');
      return;
    }
    
    // Step 2: Show sample
    console.log('\n📝 Sample feed (first one):');
    console.log(JSON.stringify(feeds[0], null, 2));
    
    // Step 3: Upload
    if (ADMIN_USER_ID && ETHIOPIA_COUNTRY_ID) {
      await uploadFeeds(feeds);
    } else {
      console.log('\n⚠️  Skipping upload (missing credentials)');
      console.log('   Set ADMIN_USER_ID and ETHIOPIA_COUNTRY_ID to upload');
      console.log('\n📋 Prepared feeds (first 5):');
      feeds.slice(0, 5).forEach((feed, i) => {
        console.log(`\n${i + 1}. ${feed.fd_name} (${feed.fd_type})`);
        console.log(`   DM: ${feed.fd_dm}%, CP: ${feed.fd_cp}%`);
      });
    }
    
    console.log('\n✅ Import process complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

