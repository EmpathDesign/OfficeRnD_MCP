import pino from 'pino';
import { TokenManager } from './auth/token-manager.js';
import { HttpClient } from './http/client.js';
import { fetchAllPages } from './http/pagination.js';
import type { OfficeRnDConfig } from './types.js';

export class OfficeRnDClient {
  readonly http: HttpClient;
  readonly tokenManager: TokenManager;
  readonly logger: pino.Logger;
  readonly config: OfficeRnDConfig;

  constructor(config: OfficeRnDConfig) {
    this.config = config;
    this.logger = pino({
      level: config.logLevel ?? 'info',
      transport: { target: 'pino/file', options: { destination: 2 } },
    });
    this.tokenManager = new TokenManager(config, this.logger);
    this.http = new HttpClient(config, this.tokenManager, this.logger);
  }

  async list<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T[]> {
    const result = await fetchAllPages<T>(this.http, path, params);
    return result.data;
  }

  async get<T>(path: string, id: string): Promise<T> {
    return this.http.get<T>(`${path}/${id}`);
  }

  async create<T>(path: string, data: unknown): Promise<T> {
    return this.http.post<T>(path, data);
  }

  async update<T>(path: string, id: string, data: unknown): Promise<T> {
    return this.http.patch<T>(`${path}/${id}`, data);
  }

  async delete(path: string, id: string): Promise<void> {
    await this.http.delete(`${path}/${id}`);
  }

  async count(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<number> {
    try {
      const result = await this.http.get<{ count: number } | number>(`${path}/count`, params);
      if (typeof result === 'number') {
        return result;
      }
      return result.count;
    } catch {
      const items = await this.list<unknown>(path, params);
      return items.length;
    }
  }
}
