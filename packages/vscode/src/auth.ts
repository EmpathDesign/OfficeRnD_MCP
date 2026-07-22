export function buildConnectionTestRequestBody(clientId: string, clientSecret: string): string {
  return new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();
}
