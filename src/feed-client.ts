/**
 * Ration Smart API Client - Updated for Multi-Tenant Support
 * 
 * Client for interacting with the Ration Smart Feed Library Backend API
 * Supports both API key (recommended) and email+PIN authentication
 */

import fetch from 'node-fetch';

export interface CattleInfo {
  body_weight: number;
  breed: string;
  lactating: boolean;
  milk_production: number;
  days_in_milk: number;
  parity: number;
  days_of_pregnancy: number;
  tp_milk: number;
  fat_milk: number;
  temperature: number;
  topography: string;
  distance: number;
  calving_interval: number;
  bw_gain?: number;
  bc_score?: number;
}

export interface FeedWithPrice {
  feed_id: string;
  price_per_kg: number;
}

export interface FeedEvaluationItem {
  feed_id: string;
  quantity_as_fed: number;
  price_per_kg: number;
}

export interface DietRecommendationRequest {
  simulation_id: string;
  user_id: string;
  cattle_info: CattleInfo;
  feed_selection: FeedWithPrice[];
  country_id?: string; // Optional - can be auto-detected from feeds
}

export interface DietEvaluationRequest {
  simulation_id: string;
  user_id: string;
  country_id: string;
  currency: string;
  cattle_info: CattleInfo;
  feed_evaluation: FeedEvaluationItem[];
}

export interface FeedDetails {
  feed_id: string;
  fd_code: string | number;
  fd_name: string;
  fd_type: string;
  fd_category: string;
  fd_country_id: string;
  fd_country_name: string;
  fd_country_cd: string;
  fd_dm: number;
  fd_ash: number;
  fd_cp: number;
  fd_ee: number;
  fd_st: number;
  fd_ndf: number;
  fd_adf: number;
  fd_lg: number;
  fd_ndin: number;
  fd_adin: number;
  fd_ca: number;
  fd_p: number;
  fd_cf?: number;
  fd_nfe?: number;
  fd_hemicellulose?: number;
  fd_cellulose?: number;
  fd_npn_cp?: number;
  fd_season?: string;
  fd_orginin?: string;
  fd_ipb_local_lab?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserInfo {
  id: string;
  name: string;
  email_id: string;
  country_id: string;
  country?: {
    id: string;
    name: string;
    country_code: string;
    currency: string;
  };
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Country {
  id: string;
  name: string;
  country_code: string;
  currency: string;
  is_active: boolean;
}

/**
 * Ration Smart API Client
 * Supports both API key and email+PIN authentication
 */
export class FeedFormulationClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private userEmail: string | null = null;
  private userPin: string | null = null;
  private cachedUserId: string | null = null;
  private cachedCountryId: string | null = null;
  private cachedCurrency: string | null = null;
  private organizationId: string | null = null;

  /**
   * Creates a new Ration Smart API client
   * 
   * @param baseUrl - Base URL for Ration Smart API
   * @param apiKey - API key for authentication (recommended for organizations)
   * @param userEmail - User's email address (alternative to API key, for backward compatibility)
   * @param userPin - 4-digit PIN (required if using email authentication)
   */
  constructor(
    baseUrl: string,
    apiKey?: string,
    userEmail?: string,
    userPin?: string
  ) {
    this.baseUrl = baseUrl;
    
    // Prefer API key over email+PIN
    if (apiKey) {
      this.apiKey = apiKey;
    } else if (userEmail && userPin) {
      this.userEmail = userEmail;
      this.userPin = userPin;
    } else {
      throw new Error('Either API key or email+PIN must be provided');
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      // API key authentication (recommended)
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    // Note: Email+PIN authentication is handled in individual endpoints

    return headers;
  }

  /**
   * Authenticate and get user ID (for email+PIN method)
   */
  private async authenticate(): Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    if (!this.userEmail || !this.userPin) {
      throw new Error('Email and PIN required for authentication');
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_id: this.userEmail,
          pin: this.userPin
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { success: boolean; user: UserInfo };
      
      if (!data.success || !data.user) {
        throw new Error('Invalid authentication response');
      }

      this.cachedUserId = data.user.id;
      this.cachedCountryId = data.user.country_id;
      this.cachedCurrency = data.user.country?.currency || 'USD';

      return this.cachedUserId;
    } catch (error) {
      throw new Error(`Failed to authenticate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user ID (with caching, for email+PIN method)
   */
  async getUserId(): Promise<string> {
    if (this.apiKey) {
      throw new Error('User ID not available with API key authentication. Use organization context instead.');
    }
    return this.authenticate();
  }

  /**
   * Get country ID (with caching, for email+PIN method)
   */
  async getCountryId(): Promise<string> {
    if (this.apiKey) {
      throw new Error('Country ID not available with API key authentication. Specify country_id in requests.');
    }
    await this.authenticate();
    if (!this.cachedCountryId) {
      throw new Error('Country ID not available');
    }
    return this.cachedCountryId;
  }

  /**
   * Get currency (with caching, for email+PIN method)
   */
  async getCurrency(): Promise<string> {
    if (this.apiKey) {
      return 'USD'; // Default, can be overridden in requests
    }
    await this.authenticate();
    return this.cachedCurrency || 'USD';
  }

  /**
   * Get all countries
   */
  async getCountries(): Promise<Country[]> {
    const response = await fetch(`${this.baseUrl}/auth/countries`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get countries: ${response.status}`);
    }
    return response.json() as Promise<Country[]>;
  }

  /**
   * Get feed by ID
   */
  async getFeedById(feedId: string): Promise<FeedDetails> {
    const response = await fetch(`${this.baseUrl}/feeds/${feedId}`, {
      headers: this.getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to get feed: ${response.status}`);
    }
    return response.json() as Promise<FeedDetails>;
  }

  /**
   * Search feeds with filters
   */
  async searchFeeds(params: {
    country_id?: string;
    feed_type?: string;
    feed_category?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FeedDetails[]> {
    const queryParams = new URLSearchParams();
    if (params.country_id) queryParams.append('country_id', params.country_id);
    if (params.feed_type) queryParams.append('feed_type', params.feed_type);
    if (params.feed_category) queryParams.append('feed_category', params.feed_category);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const url = `${this.baseUrl}/feeds/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search feeds: ${response.status}`);
    }
    
    const data = await response.json();
    // Handle paginated response format: {total, limit, offset, feeds: [...]}
    // or direct array format for backward compatibility
    if (data && typeof data === 'object' && 'feeds' in data) {
      return data.feeds as FeedDetails[];
    }
    return data as FeedDetails[];
  }

  /**
   * Get diet recommendation
   */
  async getDietRecommendation(
    cattleInfo: CattleInfo,
    feedSelection: FeedWithPrice[],
    countryId?: string,
    userId?: string  // Optional for API key auth
  ): Promise<any> {
    let userIdToUse: string;
    let countryIdToUse: string;
    
    if (this.apiKey) {
      // Auto-detect country_id from feeds if not provided
      if (!countryId) {
        const feedIds = feedSelection.map(f => f.feed_id);
        const detectedCountryId = await this.detectCountryFromFeeds(feedIds);
        if (!detectedCountryId) {
          throw new Error('country_id is required. Either provide it explicitly or ensure feeds have country_id set.');
        }
        countryIdToUse = detectedCountryId;
      } else {
        countryIdToUse = countryId;
      }
      
      // Use provided userId or service account
      userIdToUse = userId || await this.getServiceAccountUserId();
    } else {
      userIdToUse = await this.getUserId();
      countryIdToUse = countryId || await this.getCountryId();
    }

    const simulationId = `sim-${Date.now()}`;

    const request: DietRecommendationRequest = {
      simulation_id: simulationId,
      user_id: userIdToUse,
      cattle_info: cattleInfo,
      feed_selection: feedSelection,
      country_id: countryIdToUse // Include country_id if detected
    };

    const response = await fetch(`${this.baseUrl}/diet-recommendation-working/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Diet recommendation failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Auto-detect country_id from feeds
   */
  private async detectCountryFromFeeds(feedIds: string[]): Promise<string | null> {
    try {
      // Fetch first feed to get country_id
      if (feedIds.length === 0) return null;
      const firstFeed = await this.getFeedById(feedIds[0]);
      return firstFeed.fd_country_id || null;
    } catch (error) {
      console.warn('[FeedClient] Could not auto-detect country from feeds:', error);
      return null;
    }
  }

  /**
   * Get or create service account user_id for API key auth
   */
  private async getServiceAccountUserId(): Promise<string> {
    // For API key auth, use a service account user_id
    // This is a placeholder UUID that represents "API key organization user"
    // In production, you might want to create actual service account users per organization
    return '00000000-0000-0000-0000-000000000000'; // Service account UUID
  }

  /**
   * Evaluate diet
   */
  async evaluateDiet(
    cattleInfo: CattleInfo,
    feedEvaluation: FeedEvaluationItem[],
    countryId?: string,
    currency?: string,
    userId?: string  // Optional for API key auth
  ): Promise<any> {
    let userIdToUse: string;
    let countryIdToUse: string;
    let currencyToUse: string;

    if (this.apiKey) {
      // For API key auth, auto-detect country_id from feeds if not provided
      if (!countryId) {
        const feedIds = feedEvaluation.map(f => f.feed_id);
        const detectedCountryId = await this.detectCountryFromFeeds(feedIds);
        if (!detectedCountryId) {
          throw new Error('country_id is required. Either provide it explicitly or ensure feeds have country_id set.');
        }
        countryIdToUse = detectedCountryId;
      } else {
        countryIdToUse = countryId;
      }
      
      // Use provided userId or service account
      userIdToUse = userId || await this.getServiceAccountUserId();
      currencyToUse = currency || 'USD';
    } else {
      userIdToUse = await this.getUserId();
      countryIdToUse = countryId || await this.getCountryId();
      currencyToUse = currency || await this.getCurrency();
    }

    const simulationId = `eval-${Date.now()}`;

    const request: DietEvaluationRequest = {
      simulation_id: simulationId,
      user_id: userIdToUse,
      country_id: countryIdToUse,
      currency: currencyToUse,
      cattle_info: cattleInfo,
      feed_evaluation: feedEvaluation
    };

    const response = await fetch(`${this.baseUrl}/diet-evaluation-working/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Diet evaluation failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}
