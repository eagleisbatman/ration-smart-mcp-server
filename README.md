# Ration Smart MCP Server

MCP Server for Ration Smart Feed Library - Dairy Cattle Nutrition Optimization via Model Context Protocol

## 🎯 Overview

This MCP (Model Context Protocol) server provides dairy cattle nutrition optimization tools via the Ration Smart Feed Library API. It enables AI agents to:

- **Evaluate diets** - Analyze existing feed mixes for nutritional adequacy
- **Get diet recommendations** - Generate optimized least-cost diet plans
- **Search feeds** - Find feeds by type, category, or country
- **Get feed details** - Retrieve nutritional information for specific feeds

## 🔗 Related Repositories

- **[ration-smart-feed-library](https://github.com/eagleisbatman/ration-smart-feed-library)** - Backend API and Admin Dashboard
  - Backend API for feed data and diet calculations
  - Admin dashboard for feed management and API key management

## ✨ Features

- ✅ 4 MCP tools for comprehensive feed analysis
- ✅ API Key authentication (recommended for organizations)
- ✅ Email + PIN authentication (backward compatible)
- ✅ User ID caching for performance
- ✅ Comprehensive error handling
- ✅ TypeScript with full type safety
- ✅ StreamableHTTP transport for MCP

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Create a `.env` file:

```env
# Backend API URL
FEED_API_BASE_URL=http://localhost:8000

# Authentication (choose one method)

# Option 1: API Key (Recommended for organizations)
FEED_API_KEY=ff_live_xxxxxxxxxxxx
FEED_API_USER_ID=your-service-account-user-id
FEED_API_COUNTRY_ID=default-country-id

# Option 2: Email + PIN (Backward compatible)
FEED_API_EMAIL=your_email@example.com  # Email address (NOT phone number)
FEED_API_PIN=1234                       # 4-digit PIN

# Server Configuration
PORT=3005
ALLOWED_ORIGINS=*
```

**Important:** 
- `FEED_API_EMAIL` must be a valid email address, not a phone number
- API Key authentication is recommended for production use
- Get API keys from the [Admin Dashboard](https://github.com/eagleisbatman/ration-smart-feed-library)

## 🚀 Development

```bash
# Install dependencies
npm install

# Development mode (with auto-reload)
npm run dev

# Build
npm run build

# Start production server
npm start
```

## 🔧 MCP Tools

### 1. `evaluate_diet`
Analyze an existing diet for nutritional adequacy.

**Parameters:**
- `cattle_info`: Cattle information (weight, milk production, etc.)
- `feed_evaluation`: List of feeds with quantities

**Returns:** Comprehensive diet analysis including nutritional values, deficiencies, and recommendations.

### 2. `get_diet_recommendation`
Generate an optimized least-cost diet plan.

**Parameters:**
- `cattle_info`: Cattle information
- `feed_selection`: Available feeds with prices

**Returns:** Optimized diet plan with feed quantities and costs.

### 3. `search_feeds`
Search for feeds by various criteria.

**Parameters:**
- `query`: Search query (optional)
- `feed_type`: Filter by type (Forage/Concentrate)
- `country_id`: Filter by country
- `limit`: Maximum results

**Returns:** List of matching feeds.

### 4. `get_feed_info`
Get detailed information about a specific feed.

**Parameters:**
- `feed_id`: Feed ID

**Returns:** Complete feed information including nutritional values.

## 🌐 MCP Integration

### Using with Claude Desktop

Add to `~/.cursor/mcp.json` or Claude Desktop config:

```json
{
  "mcpServers": {
    "ration-smart": {
      "command": "node",
      "args": ["/path/to/ration-smart-mcp-server/dist/index.js"],
      "env": {
        "FEED_API_BASE_URL": "https://your-backend.railway.app",
        "FEED_API_KEY": "ff_live_xxxxxxxxxxxx"
      }
    }
  }
}
```

### Using with StreamableHTTP

The server exposes an HTTP endpoint for MCP over HTTP:

```
POST http://localhost:3005/mcp
```

## 📚 API Authentication

### API Key (Recommended)

1. Create an organization in the Admin Dashboard
2. Generate an API key
3. Use the key in `FEED_API_KEY` environment variable

### Email + PIN (Legacy)

1. Register/login via the backend API
2. Use email and PIN in environment variables

## 🚢 Deployment

### Railway

The server is configured for Railway deployment:

```bash
# Deploy to Railway
railway up
```

Railway will automatically:
- Build the TypeScript code
- Start the server on the configured PORT
- Use environment variables from Railway dashboard

## 📝 License

MIT

## 🔗 Links

- **Backend & Admin**: [ration-smart-feed-library](https://github.com/eagleisbatman/ration-smart-feed-library)
- **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io)
