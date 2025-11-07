import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { FeedFormulationClient, CattleInfo, FeedWithPrice, FeedEvaluationItem } from './feed-client.js';

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  exposedHeaders: ['Mcp-Session-Id'],
  allowedHeaders: ['Content-Type', 'mcp-session-id', 'Authorization']
}));

// Environment variables
const FEED_API_BASE_URL = process.env.FEED_API_BASE_URL || 'http://47.128.1.51:8000';
const FEED_API_KEY = process.env.FEED_API_KEY || ''; // API key (recommended for organizations)
const FEED_API_EMAIL = process.env.FEED_API_EMAIL || ''; // Email address (alternative to API key)
const FEED_API_PIN = process.env.FEED_API_PIN || ''; // 4-digit PIN (required if using email)
const FEED_API_USER_ID = process.env.FEED_API_USER_ID || ''; // Service account user ID (for API key auth)
const FEED_API_COUNTRY_ID = process.env.FEED_API_COUNTRY_ID || ''; // Default country ID (for API key auth)
const PORT = process.env.PORT || 3005;

// Warn if credentials are missing
if (!FEED_API_KEY && (!FEED_API_EMAIL || !FEED_API_PIN)) {
  console.warn('⚠️  WARNING: Authentication credentials are not set!');
  console.warn('⚠️  Use either FEED_API_KEY (recommended) or FEED_API_EMAIL + FEED_API_PIN');
  console.warn('⚠️  Server will start but MCP tools will not work until credentials are configured.');
}

// Initialize Feed Formulation Client
const feedClient = (FEED_API_KEY || (FEED_API_EMAIL && FEED_API_PIN))
  ? new FeedFormulationClient(
      FEED_API_BASE_URL,
      FEED_API_KEY || undefined,
      FEED_API_EMAIL || undefined,
      FEED_API_PIN || undefined
    )
  : null;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ration-smart-mcp-server',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    apiConfigured: !!feedClient
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Ration Smart MCP Server',
    version: '1.0.0',
    description: 'Dairy cattle nutrition optimization via Ration Smart Feed Library API',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)'
    },
    tools: [
      'evaluate_diet',
      'get_diet_recommendation',
      'get_feed_info',
      'search_feeds'
    ]
  });
});

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless
    });

    const server = new McpServer({
  name: 'ration-smart',
  version: '1.0.0',
      description: 'Dairy cattle nutrition optimization - diet recommendations and feed analysis'
    });

    if (!feedClient) {
      server.tool(
        'error',
        'Server not configured - missing credentials',
        {},
        async () => {
          return {
            content: [{
              type: 'text',
              text: 'Ration Smart API credentials not configured. Please set FEED_API_KEY (recommended) or FEED_API_EMAIL and FEED_API_PIN environment variables.'
            }],
            isError: true
          };
        }
      );
    } else {
      // Tool 1: Evaluate Diet
      server.tool(
        'evaluate_diet',
        'Evaluate a dairy cattle diet based on feed selection and animal characteristics. Returns comprehensive analysis including milk production, intake, cost, methane emissions, and nutrient balance.',
        {
          body_weight: z.number().min(100).max(1000).describe('Body weight in kg'),
          breed: z.string().describe('Cattle breed (e.g., "Holstein cross")'),
          lactating: z.boolean().describe('Whether the cow is lactating'),
          milk_production: z.number().min(0).max(100).describe('Milk production in liters per day'),
          days_in_milk: z.number().int().min(0).max(400).describe('Days in milk'),
          parity: z.number().int().min(1).max(10).describe('Parity number'),
          days_of_pregnancy: z.number().int().min(0).max(300).describe('Days of pregnancy'),
          tp_milk: z.number().min(2).max(5).describe('True protein percentage in milk'),
          fat_milk: z.number().min(2).max(6).describe('Fat percentage in milk'),
          temperature: z.number().min(-10).max(50).describe('Environmental temperature in Celsius'),
          topography: z.enum(['Flat', 'Hilly']).describe('Topography'),
          distance: z.number().min(0).max(10).describe('Distance in km'),
          calving_interval: z.number().int().min(300).max(500).describe('Calving interval in days'),
          feeds: z.array(z.object({
            feed_id: z.string().describe('Feed UUID'),
            quantity_as_fed: z.number().min(0.1).describe('Quantity in kg/day (as-fed basis)'),
            price_per_kg: z.number().min(0).describe('Price per kg in local currency')
          })).min(1).describe('Array of feeds with quantities and prices')
        },
        async (params) => {
          try {
            const cattleInfo: CattleInfo = {
              body_weight: params.body_weight,
              breed: params.breed,
              lactating: params.lactating,
              milk_production: params.milk_production,
              days_in_milk: params.days_in_milk,
              parity: params.parity,
              days_of_pregnancy: params.days_of_pregnancy,
              tp_milk: params.tp_milk,
              fat_milk: params.fat_milk,
              temperature: params.temperature,
              topography: params.topography,
              distance: params.distance,
              calving_interval: params.calving_interval
            };

            const feedEvaluation: FeedEvaluationItem[] = params.feeds.map(f => ({
              feed_id: f.feed_id,
              quantity_as_fed: f.quantity_as_fed,
              price_per_kg: f.price_per_kg
            }));

            const result = await feedClient!.evaluateDiet(
              cattleInfo,
              feedEvaluation,
              FEED_API_COUNTRY_ID || undefined, // countryId - use env var or cached
              undefined, // currency - will use cached or default
              FEED_API_USER_ID || undefined // userId for API key auth
            );

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          } catch (error: any) {
            console.error('[MCP Tool] Error in evaluate_diet:', error);
            return {
              content: [{
                type: 'text',
                text: `Failed to evaluate diet: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );

      // Tool 2: Get Diet Recommendation
      server.tool(
        'get_diet_recommendation',
        'Generate optimized least-cost diet recommendation for dairy cattle. Requires 6-10 feeds (mix of forage and concentrate types). Returns optimized feed quantities, costs, and environmental impact.',
        {
          body_weight: z.number().min(100).max(1000).describe('Body weight in kg'),
          breed: z.string().describe('Cattle breed (e.g., "Holstein cross")'),
          lactating: z.boolean().describe('Whether the cow is lactating'),
          milk_production: z.number().min(0).max(100).describe('Milk production in liters per day'),
          days_in_milk: z.number().int().min(0).max(400).describe('Days in milk'),
          parity: z.number().int().min(1).max(10).describe('Parity number'),
          days_of_pregnancy: z.number().int().min(0).max(300).describe('Days of pregnancy'),
          tp_milk: z.number().min(2).max(5).describe('True protein percentage in milk'),
          fat_milk: z.number().min(2).max(6).describe('Fat percentage in milk'),
          temperature: z.number().min(-10).max(50).describe('Environmental temperature in Celsius'),
          topography: z.enum(['Flat', 'Hilly']).describe('Topography'),
          distance: z.number().min(0).max(10).describe('Distance in km'),
          calving_interval: z.number().int().min(300).max(500).describe('Calving interval in days'),
          feeds: z.array(z.object({
            feed_id: z.string().describe('Feed UUID'),
            price_per_kg: z.number().min(0).describe('Price per kg in local currency')
          })).min(6).max(20).describe('Array of 6-10 feeds with prices (mix of forage and concentrate)')
        },
        async (params) => {
          try {
            const cattleInfo: CattleInfo = {
              body_weight: params.body_weight,
              breed: params.breed,
              lactating: params.lactating,
              milk_production: params.milk_production,
              days_in_milk: params.days_in_milk,
              parity: params.parity,
              days_of_pregnancy: params.days_of_pregnancy,
              tp_milk: params.tp_milk,
              fat_milk: params.fat_milk,
              temperature: params.temperature,
              topography: params.topography,
              distance: params.distance,
              calving_interval: params.calving_interval
            };

            const feedSelection: FeedWithPrice[] = params.feeds.map(f => ({
              feed_id: f.feed_id,
              price_per_kg: f.price_per_kg
            }));

            const result = await feedClient!.getDietRecommendation(
              cattleInfo,
              feedSelection,
              FEED_API_USER_ID || undefined // userId for API key auth
            );

            return {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }]
            };
          } catch (error: any) {
            console.error('[MCP Tool] Error in get_diet_recommendation:', error);
            return {
              content: [{
                type: 'text',
                text: `Failed to get diet recommendation: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );

      // Tool 3: Get Feed Info
      server.tool(
        'get_feed_info',
        'Get detailed nutritional information for a specific feed by ID',
        {
          feed_id: z.string().describe('Feed UUID')
        },
        async ({ feed_id }) => {
          try {
            const feed = await feedClient!.getFeedById(feed_id);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(feed, null, 2)
              }]
            };
          } catch (error: any) {
            console.error('[MCP Tool] Error in get_feed_info:', error);
            return {
              content: [{
                type: 'text',
                text: `Failed to get feed info: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );

      // Tool 4: Search Feeds
      server.tool(
        'search_feeds',
        'Search for feeds with optional filters (country, type, category). Returns list of feeds with nutritional information.',
        {
          country_id: z.string().optional().describe('Country UUID to filter by'),
          feed_type: z.enum(['Forage', 'Concentrate']).optional().describe('Feed type filter'),
          feed_category: z.string().optional().describe('Feed category filter'),
          limit: z.number().int().min(1).max(100).default(20).optional().describe('Maximum number of feeds to return'),
          offset: z.number().int().min(0).default(0).optional().describe('Number of feeds to skip')
        },
        async (params) => {
          try {
            const feeds = await feedClient!.searchFeeds({
              country_id: params.country_id,
              feed_type: params.feed_type,
              feed_category: params.feed_category,
              limit: params.limit,
              offset: params.offset
            });

            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  count: feeds.length,
                  feeds: feeds
                }, null, 2)
              }]
            };
          } catch (error: any) {
            console.error('[MCP Tool] Error in search_feeds:', error);
            return {
              content: [{
                type: 'text',
                text: `Failed to search feeds: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );
    }

    // Connect and handle the request
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error('[MCP] Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: null
    });
  }
});

// Start server
const HOST = '0.0.0.0';
const server = app.listen(Number(PORT), HOST, () => {
  console.log('');
  console.log('🚀 =========================================');
  console.log('   Ration Smart MCP Server');
  console.log('   Version 1.0.0');
  console.log('=========================================');
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌾 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔑 API Credentials: ${feedClient ? '✅ Configured' : '⚠️  NOT CONFIGURED'}`);
  console.log(`🛠️  Tools: 4 (evaluate_diet, get_diet_recommendation, get_feed_info, search_feeds)`);
  console.log('=========================================');
  console.log('📝 Dairy cattle nutrition optimization');
  console.log('=========================================');
  console.log('');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

