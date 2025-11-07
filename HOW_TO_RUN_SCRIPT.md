# How to Run Database Check Script

## Quick Start (Copy & Paste)

Open Terminal and run:

```bash
cd /Users/eagleisbatman/digitalgreen_projects/GAP_PROTOTYPE/feed-formulation-mcp-server
node scripts/check-database.js
```

That's it! The script will show you all database information.

## What You'll See

- Connection status
- Total feeds count  
- Countries with feeds
- Feed types breakdown
- All registered countries

## If Connection Times Out

The database IP (172.17.0.1) is a Docker bridge IP, so it might not be accessible from your location. That's okay - we can check via the API instead (see below).

## Alternative: Check via API

```bash
# Countries with feeds
curl -s "http://47.128.1.51:8000/feeds/?limit=1000" | jq '[group_by(.fd_country_name) | .[] | {country: .[0].fd_country_name, feed_count: length}]'

# Total feeds
curl -s "http://47.128.1.51:8000/feeds/?limit=1000" | jq 'length'
```
