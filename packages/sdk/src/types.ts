export interface OfficeRnDConfig {
  clientId: string;
  clientSecret: string;
  organizationSlug?: string;
  scopes?: string[];
  apiVersion?: 'v1' | 'v2';
  baseUrl?: string;
  tokenUrl?: string;
  logLevel?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface PagedResponse<T> {
  data: T[];
  nextCursor?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}
