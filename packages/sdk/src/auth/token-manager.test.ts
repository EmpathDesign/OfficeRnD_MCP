import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenManager } from './token-manager.js';
import type { OfficeRnDConfig, TokenResponse } from '../types.js';

const config: OfficeRnDConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  logLevel: 'silent',
};

describe('TokenManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns cached token when not expired', async () => {
    const manager = new TokenManager(config);
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'cached-token',
            expires_in: 3600,
            token_type: 'Bearer',
          } satisfies TokenResponse),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await manager.getToken();
    const second = await manager.getToken();

    expect(first).toBe('cached-token');
    expect(second).toBe('cached-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches new token when expired', async () => {
    const manager = new TokenManager(config);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'short-lived',
            expires_in: 1,
            token_type: 'Bearer',
          } satisfies TokenResponse),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'refreshed',
            expires_in: 3600,
            token_type: 'Bearer',
          } satisfies TokenResponse),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const first = await manager.getToken();
    const second = await manager.getToken();

    expect(first).toBe('short-lived');
    expect(second).toBe('refreshed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests', async () => {
    const manager = new TokenManager(config);
    let resolveFetch!: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn(() => fetchPromise);
    vi.stubGlobal('fetch', fetchMock);

    const firstPromise = manager.getToken();
    const secondPromise = manager.getToken();

    await Promise.resolve();

    resolveFetch(
      new Response(
        JSON.stringify({
          access_token: 'shared-token',
          expires_in: 3600,
          token_type: 'Bearer',
        } satisfies TokenResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(Promise.all([firstPromise, secondPromise])).resolves.toEqual([
      'shared-token',
      'shared-token',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles fetch errors properly', async () => {
    const manager = new TokenManager(config);
    const fetchMock = vi.fn(async () => new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(manager.getToken()).rejects.toThrow('OAuth2 token request failed: 500 boom');
  });

  it('invalidate clears cache', async () => {
    const manager = new TokenManager(config);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'first-token',
            expires_in: 3600,
            token_type: 'Bearer',
          } satisfies TokenResponse),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'second-token',
            expires_in: 3600,
            token_type: 'Bearer',
          } satisfies TokenResponse),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(manager.getToken()).resolves.toBe('first-token');
    manager.invalidate();
    await expect(manager.getToken()).resolves.toBe('second-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
