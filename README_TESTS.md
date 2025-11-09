# Testing Guide

## Running Tests

### Unit Tests (MCP Server)

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests (Backend API)

```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run specific test file
pytest tests/test_api_auth.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run with verbose output
pytest -v
```

## Test Structure

### MCP Server Tests
- `src/__tests__/feed-client.test.ts` - Unit tests for FeedFormulationClient

### Backend API Tests
- `tests/test_api_auth.py` - Authentication and feed endpoint tests
- `tests/test_feed_translations.py` - Feed translation endpoint tests

## Writing New Tests

### MCP Server (Vitest)
```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

### Backend API (Pytest)
```python
import pytest
from fastapi.testclient import TestClient

def test_endpoint():
    response = client.get("/endpoint")
    assert response.status_code == 200
```

