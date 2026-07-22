import type { HttpClient } from './client.js';

export interface PaginatedResult<T> {
  data: T[];
  total?: number;
}

interface RawPageResponse<T> {
  data?: T[];
  nextCursor?: string;
  $cursorNext?: string;
  total?: number;
}

export async function fetchAllPages<T>(
  client: HttpClient,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  maxPages = 100,
): Promise<PaginatedResult<T>> {
  const results: T[] = [];
  let cursor: string | undefined;
  let total: number | undefined;
  let page = 0;

  do {
    const pageParams: Record<string, string | number | boolean | undefined> = {
      ...params,
      $limit: params.$limit ?? 100,
      ...(cursor ? { $cursorNext: cursor } : {}),
    };

    const response = await client.get<RawPageResponse<T> | T[]>(path, pageParams);

    if (Array.isArray(response)) {
      results.push(...response);
      break;
    }

    const items = response.data ?? [];
    results.push(...items);

    if (total === undefined && response.total !== undefined) {
      total = response.total;
    }

    cursor = response.nextCursor ?? response.$cursorNext;
    page += 1;
  } while (cursor && page < maxPages);

  return { data: results, total };
}
