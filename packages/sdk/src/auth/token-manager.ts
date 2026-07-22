import pino from 'pino';
import type { OfficeRnDConfig, TokenResponse } from '../types.js';

const DEFAULT_TOKEN_URL = 'https://identity.officernd.com/oauth/token';
const EXPIRY_BUFFER_SECONDS = 60;
const TOKEN_RATE_LIMIT = 5;
const TOKEN_RATE_WINDOW_MS = 60_000;

export class TokenManager {
  private readonly config: OfficeRnDConfig;
  private readonly logger: pino.Logger;
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private pendingRequest: Promise<string> | null = null;
  private tokenRequestTimestamps: number[] = [];

  constructor(config: OfficeRnDConfig, logger?: pino.Logger) {
    this.config = config;
    this.logger =
      logger ??
      pino({
        level: config.logLevel ?? 'info',
        transport: { target: 'pino/file', options: { destination: 2 } },
      });
  }

  async getToken(): Promise<string> {
    const now = Date.now() / 1000;
    if (this.cachedToken && now < this.tokenExpiresAt - EXPIRY_BUFFER_SECONDS) {
      return this.cachedToken;
    }

    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.pendingRequest = this.fetchToken().finally(() => {
      this.pendingRequest = null;
    });

    return this.pendingRequest;
  }

  invalidate(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  private async fetchToken(): Promise<string> {
    await this.respectRateLimit();

    const tokenUrl = this.config.tokenUrl ?? DEFAULT_TOKEN_URL;
    const scopes = this.config.scopes;

    this.logger.debug({ tokenUrl, scopes }, 'Fetching OAuth2 token');

    const bodyParams: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };

    if (scopes && scopes.length > 0) {
      bodyParams.scope = scopes.join(' ');
    }

    const body = new URLSearchParams(bodyParams);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error({ status: response.status, body: text }, 'Token fetch failed');
      throw new Error(`OAuth2 token request failed: ${response.status} ${text}`.trim());
    }

    const data = (await response.json()) as TokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() / 1000 + data.expires_in;
    this.logger.debug({ expiresIn: data.expires_in }, 'Token acquired');
    return this.cachedToken;
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    this.tokenRequestTimestamps = this.tokenRequestTimestamps.filter(
      (timestamp) => now - timestamp < TOKEN_RATE_WINDOW_MS,
    );

    if (this.tokenRequestTimestamps.length >= TOKEN_RATE_LIMIT) {
      const oldest = this.tokenRequestTimestamps[0];
      const waitMs = Math.max(0, TOKEN_RATE_WINDOW_MS - (now - oldest));
      if (waitMs > 0) {
        this.logger.warn({ waitMs }, 'Token endpoint rate limit reached, waiting');
        await this.sleep(waitMs);
      }
      return this.respectRateLimit();
    }

    this.tokenRequestTimestamps.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
