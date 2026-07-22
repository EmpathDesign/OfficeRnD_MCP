export function normalizeScopes(scopes: readonly string[] = []): string[] {
  const normalized: string[] = [];

  for (const rawScope of scopes) {
    for (const scope of rawScope.split(/[,\s]+/)) {
      const trimmedScope = scope.trim();
      if (!trimmedScope || normalized.includes(trimmedScope)) {
        continue;
      }
      normalized.push(trimmedScope);
    }
  }

  return normalized;
}

export function buildConnectionTestRequestBody(
  clientId: string,
  clientSecret: string,
  scopes: readonly string[] = [],
): string {
  const bodyParams: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  };

  const normalizedScopes = normalizeScopes(scopes);
  if (normalizedScopes.length > 0) {
    bodyParams.scope = normalizedScopes.join(' ');
  }

  return new URLSearchParams(bodyParams).toString();
}
