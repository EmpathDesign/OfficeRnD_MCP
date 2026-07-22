import { describe, expect, it } from 'vitest';
import { RESOURCES } from './registry.js';

describe('RESOURCES', () => {
  it('all resources have required fields', () => {
    for (const resource of RESOURCES) {
      expect(resource.name).toBeTruthy();
      expect(resource.path).toMatch(/^\//);
      expect(resource.description).toBeTruthy();
      expect(Array.isArray(resource.operations)).toBe(true);
    }
  });

  it('operations array is non-empty', () => {
    for (const resource of RESOURCES) {
      expect(resource.operations.length).toBeGreaterThan(0);
    }
  });
});
