import pino from 'pino';
import type { TokenManager } from '../auth/token-manager.js';
import type { OfficeRnDConfig } from '../types.js';

const BASE_URL_V1 = 'https://app.officernd.com/api/v1/organizations';
const BASE_URL_V2 = 'https://app.officernd.com/api/v2/organizations';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export class HttpClient {
  private readonly config: OfficeRnDConfig;
  private readonly tokenManager: TokenManager;
  private readonly logger: pino.Logger;

  constructor(config: OfficeRnDConfig, tokenManager: TokenManager, logger?: pino.Logger) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.logger =
      logger ??
      pino({
        level: config.logLevel ?? 'info',
        transport: { target: 'pino/file', options: { destination: 2 } },
      });
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    let url = `${this.getBaseUrl()}${path}`;

    if (params) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          qs.set(key, String(value));
        }
      }
      const queryString = qs.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    let lastError: Error = new Error('Request failed');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const token = await this.tokenManager.getToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        };
        if (body !== undefined) {
          headers['Content-Type'] = 'application/json';
        }

        this.logger.debug({ method, url, attempt }, 'HTTP request');

        const response = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? '2', 10);
          const retryAfterMs = Number.isNaN(retryAfterSeconds)
            ? BASE_DELAY_MS
            : retryAfterSeconds * 1000;
          this.logger.warn({ retryAfterMs }, 'Rate limited, waiting');
          await this.sleep(retryAfterMs);
          continue;
        }

        if (response.status === 401 && attempt === 0) {
          this.logger.warn('Unauthorized response, invalidating token and retrying once');
          this.tokenManager.invalidate();
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${text}`.trim());
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES) {
          const delay = Math.round(BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random() * 0.5));
          this.logger.warn({ attempt, delay, error: lastError.message }, 'Retrying request');
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }

    const version = this.config.apiVersion ?? 'v1';
    const baseUrl = version === 'v2' ? BASE_URL_V2 : BASE_URL_V1;
    if (this.config.organizationSlug) {
      return `${baseUrl}/${this.config.organizationSlug}`;
    }

    return baseUrl;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
