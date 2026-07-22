import { describe, expect, it } from 'vitest';
import { buildConnectionTestRequestBody } from './auth.js';

describe('buildConnectionTestRequestBody', () => {
  it('builds a client credentials request without scopes', () => {
    const body = buildConnectionTestRequestBody('client-id', 'client-secret');
    const params = new URLSearchParams(body);

    expect(params.get('grant_type')).toBe('client_credentials');
    expect(params.get('client_id')).toBe('client-id');
    expect(params.get('client_secret')).toBe('client-secret');
    expect(params.has('scope')).toBe(false);
  });

  it('encodes special characters safely', () => {
    const body = buildConnectionTestRequestBody('client id', 'secret+value');

    expect(body).toContain('client_id=client+id');
    expect(body).toContain('client_secret=secret%2Bvalue');
  });
});
