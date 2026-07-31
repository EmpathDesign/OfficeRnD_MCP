#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OfficeRnDClient } from '@officernd/sdk';
import { createServer } from '../server.js';

const clientId = process.env.OFFICERND_CLIENT_ID;
const clientSecret = process.env.OFFICERND_CLIENT_SECRET;
const organizationSlug = process.env.OFFICERND_ORG;
const apiVersion = process.env.OFFICERND_API_VERSION as 'v1' | 'v2' | undefined;
const scopesRaw = process.env.OFFICERND_SCOPES;
const scopes = scopesRaw ? scopesRaw.split(/[,\s]+/).filter(Boolean) : undefined;

let initialClient: OfficeRnDClient | null = null;

if (clientId && clientSecret) {
  initialClient = new OfficeRnDClient({
    clientId,
    clientSecret,
    organizationSlug,
    apiVersion: apiVersion ?? 'v2',
    scopes,
  });
  process.stderr.write(
    'OfficeRnD MCP server running on stdio (authenticated via environment variables)\n',
  );
} else {
  process.stderr.write(
    'OfficeRnD MCP server running on stdio (not configured — call the configure_officernd tool to authenticate)\n',
  );
}

const server = createServer(initialClient);
const transport = new StdioServerTransport();

await server.connect(transport);
