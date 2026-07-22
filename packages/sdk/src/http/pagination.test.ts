import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './pagination.js';
import type { HttpClient } from './client.js';

describe('fetchAllPages', () => {
  it('returns all items from single page', async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], total: 2 }),
    } as unknown as HttpClient;

    const result = await fetchAllPages<{ id: number }>(client, '/members');

    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 });
  });

  it('follows cursor through multiple pages', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }], nextCursor: 'next-page', total: 2 })
        .mockResolvedValueOnce({ data: [{ id: 2 }] }),
    } as unknown as HttpClient;

    const result = await fetchAllPages<{ id: number }>(client, '/members');

    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 });
    expect((client.get as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1]).toMatchObject({
      $cursorNext: 'next-page',
    });
  });

  it('handles array responses', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    } as unknown as HttpClient;

    const result = await fetchAllPages<{ id: number }>(client, '/members');

    expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }], total: undefined });
  });

  it('respects maxPages limit', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ data: [{ id: 1 }], nextCursor: 'page-2' })
        .mockResolvedValueOnce({ data: [{ id: 2 }], nextCursor: 'page-3' })
        .mockResolvedValueOnce({ data: [{ id: 3 }] }),
    } as unknown as HttpClient;

    const result = await fetchAllPages<{ id: number }>(client, '/members', {}, 2);

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(client.get).toHaveBeenCalledTimes(2);
  });
});
