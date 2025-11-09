/**
 * Unit Tests for FeedFormulationClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedFormulationClient } from '../feed-client.js';

// Mock node-fetch
const mockFetch = vi.fn();
vi.mock('node-fetch', () => ({
  default: mockFetch,
}));

describe('FeedFormulationClient', () => {
  let client: FeedFormulationClient;
  const mockBaseUrl = 'http://test-api.com';

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('API Key Authentication', () => {
    it('should create client with API key', () => {
      expect(() => {
        client = new FeedFormulationClient(mockBaseUrl, 'test-api-key');
      }).not.toThrow();
    });

    it('should throw error if no credentials provided', () => {
      expect(() => {
        new FeedFormulationClient(mockBaseUrl);
      }).toThrow('Either API key or email+PIN must be provided');
    });
  });

  describe('getFeedById', () => {
    beforeEach(() => {
      client = new FeedFormulationClient(mockBaseUrl, 'test-api-key');
    });

    it('should fetch feed by ID successfully', async () => {
      const mockFeed = {
        feed_id: '123',
        fd_name: 'Test Feed',
        fd_country_id: 'country-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeed,
      });

      const result = await client.getFeedById('123');
      expect(result).toEqual(mockFeed);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/feeds/123`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      try {
        await client.getFeedById('invalid');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Failed to get feed');
      }
    });
  });

  describe('searchFeeds', () => {
    beforeEach(() => {
      client = new FeedFormulationClient(mockBaseUrl, 'test-api-key');
    });

    it('should search feeds with filters', async () => {
      const mockFeeds = [
        { feed_id: '1', fd_name: 'Feed 1' },
        { feed_id: '2', fd_name: 'Feed 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ feeds: mockFeeds }),
      });

      const result = await client.searchFeeds({
        country_id: 'country-123',
        feed_type: 'Forage',
        limit: 10,
      });

      expect(result).toEqual(mockFeeds);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('country_id=country-123'),
        expect.any(Object)
      );
    });
  });

  describe('detectCountryFromFeeds', () => {
    beforeEach(() => {
      client = new FeedFormulationClient(mockBaseUrl, 'test-api-key');
    });

    it('should detect country from first feed', async () => {
      const mockFeed = {
        feed_id: '123',
        fd_country_id: 'country-123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFeed,
      });

      // Access private method via type assertion
      const result = await (client as any).detectCountryFromFeeds(['123']);
      expect(result).toBe('country-123');
    });

    it('should return null if no feeds provided', async () => {
      const result = await (client as any).detectCountryFromFeeds([]);
      expect(result).toBeNull();
    });
  });

  describe('evaluateDiet', () => {
    beforeEach(() => {
      client = new FeedFormulationClient(mockBaseUrl, 'test-api-key');
    });

    it('should auto-detect country_id from feeds', async () => {
      const mockFeed = {
        feed_id: 'feed-123',
        fd_country_id: 'country-123',
      };

      const mockEvaluationResponse = {
        simulation_id: 'eval-123',
        report_id: 'report-123',
      };

      // Mock getFeedById for country detection
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFeed,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEvaluationResponse,
        });

      const cattleInfo = {
        body_weight: 600,
        breed: 'Holstein',
        lactating: true,
        milk_production: 25,
        days_in_milk: 100,
        parity: 2,
        days_of_pregnancy: 0,
        tp_milk: 3.2,
        fat_milk: 3.8,
        temperature: 20,
        topography: 'Flat',
        distance: 1,
        calving_interval: 370,
      };

      const feedEvaluation = [
        {
          feed_id: 'feed-123',
          quantity_as_fed: 10,
          price_per_kg: 2.5,
        },
      ];

      const result = await client.evaluateDiet(cattleInfo, feedEvaluation);

      expect(result).toEqual(mockEvaluationResponse);
      // Verify country was auto-detected
      expect(fetch).toHaveBeenCalledTimes(2); // Once for feed, once for evaluation
    });
  });
});

