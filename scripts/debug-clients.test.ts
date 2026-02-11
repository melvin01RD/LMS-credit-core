import { getClients } from '../lib/services/client.service';
import { describe, it, expect } from 'vitest';

describe('Client Service Debug', () => {
  it('should get clients without crashing', async () => {
    try {
      const result = await getClients(undefined, { page: 1, limit: 15 });
      console.log('Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
    } catch (error) {
      console.error('Error in getClients:', error);
      throw error;
    }
  });
});
