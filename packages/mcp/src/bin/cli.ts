#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OfficeRnDClient } from '@officernd/sdk';
import { createServer } from '../server.js';

const clientId = process.env.OFFICERND_CLIENT_ID;
const clientSecret = process.env.OFFICERND_CLIENT_SECRET;
const organizationSlug = process.env.OFFICERND_ORG;
const apiVersion = process.env.OFFICERND_API_VERSION as 'v1' | 'v2' | undefined;

if (!clientId || !clientSecret) {
  process.stderr.write(
    'Error: OFFICERND_CLIENT_ID and OFFICERND_CLIENT_SECRET environment variables are required.\n',
  );
  process.exit(1);
}

const client = new OfficeRnDClient({
  clientId,
  clientSecret,
  organizationSlug,
  apiVersion: apiVersion ?? 'v2',
});

const server = createServer(client);
const transport = new StdioServerTransport();

await server.connect(transport);
process.stderr.write('OfficeRnD MCP server running on stdio\n');
