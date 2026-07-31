import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OfficeRnDClient, RESOURCES } from '@officernd/sdk';
import type { OfficeRnDConfig } from '@officernd/sdk';
import {
  activeMembers,
  findAvailableRooms,
  getInventory,
  getMemberBillingSummary,
  getMembershipOfferings,
  getPricingCatalog,
  listResourceRatesForResource,
  membersByCompany,
  membershipsExpiringSoon,
  todaysBookings,
  todaysVisitors,
  unpaidInvoices,
} from '@officernd/core';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function pluralize(name: string): string {
  const irregular: Record<string, string> = {
    person: 'people',
    company: 'companies',
    activity: 'activities',
    amenity: 'amenities',
    opportunity: 'opportunities',
    category: 'categories',
    country: 'countries',
    currency: 'currencies',
    facility: 'facilities',
    gallery: 'galleries',
    entry: 'entries',
    policy: 'policies',
  };
  const lower = name.toLowerCase();
  if (irregular[lower]) {
    return irregular[lower];
  }
  if (
    lower.endsWith('s') ||
    lower.endsWith('x') ||
    lower.endsWith('z') ||
    lower.endsWith('ch') ||
    lower.endsWith('sh')
  ) {
    return `${lower}es`;
  }
  return `${lower}s`;
}

const NOT_CONFIGURED_MESSAGE =
  'OfficeRnD is not configured. Please call the configure_officernd tool first with your clientId and clientSecret.';

export function buildTools(clientRef: { current: OfficeRnDClient | null }): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  tools.push({
    name: 'configure_officernd',
    description:
      'Configure the OfficeRnD connection with your OAuth2 credentials. Call this tool first if the server was started without environment variables set. After configuring, all other OfficeRnD tools will be available.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'Your OfficeRnD OAuth2 Client ID',
        },
        clientSecret: {
          type: 'string',
          description: 'Your OfficeRnD OAuth2 Client Secret',
        },
        orgSlug: {
          type: 'string',
          description:
            'Your organization slug (the subdomain in your OfficeRnD URL, e.g. "my-space" from "my-space.officernd.com")',
        },
        apiVersion: {
          type: 'string',
          description: 'API version to use: "v2" (default) or "v1"',
        },
        scopes: {
          type: 'string',
          description:
            'Space-separated OAuth2 scopes (e.g. "flex.community.members.read flex.space.bookings.read")',
        },
        cacheDurationMinutes: {
          type: 'number',
          description:
            'Token cache duration hint in minutes (token caching is managed automatically by the SDK)',
        },
      },
      required: ['clientId', 'clientSecret'],
    },
    handler: async (args) => {
      const config: OfficeRnDConfig = {
        clientId: String(args.clientId),
        clientSecret: String(args.clientSecret),
        organizationSlug: args.orgSlug ? String(args.orgSlug) : undefined,
        apiVersion: args.apiVersion === 'v1' || args.apiVersion === 'v2' ? args.apiVersion : 'v2',
        scopes:
          typeof args.scopes === 'string' && args.scopes.trim()
            ? args.scopes.trim().split(/\s+/)
            : undefined,
      };
      clientRef.current = new OfficeRnDClient(config);
      return {
        success: true,
        message: `OfficeRnD configured successfully${config.organizationSlug ? ` for organization "${config.organizationSlug}"` : ''}. You can now use all OfficeRnD tools.`,
      };
    },
  });

  for (const resource of RESOURCES) {
    const plural = pluralize(resource.name);
    const resourcePath = resource.path;

    if (resource.operations.includes('list')) {
      tools.push({
        name: `list_${plural}`,
        description: `List all ${plural}. ${resource.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            filters: {
              type: 'object',
              description: 'Optional filter parameters as key-value pairs',
              additionalProperties: true,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: all)',
            },
          },
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          const params: Record<string, string | number | boolean | undefined> = {};
          if (args.filters && typeof args.filters === 'object') {
            Object.assign(
              params,
              args.filters as Record<string, string | number | boolean | undefined>,
            );
          }
          if (typeof args.limit === 'number') {
            params.$limit = args.limit;
          }
          return client.list(resourcePath, params);
        },
      });
    }

    if (resource.operations.includes('get')) {
      tools.push({
        name: `get_${resource.name}`,
        description: `Get a specific ${resource.name} by ID. ${resource.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: `The ${resource.name} ID` },
          },
          required: ['id'],
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          return client.get(resourcePath, String(args.id));
        },
      });
    }

    if (resource.operations.includes('count')) {
      tools.push({
        name: `count_${plural}`,
        description: `Count ${plural} matching optional filters. ${resource.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            filters: {
              type: 'object',
              description: 'Optional filter parameters',
              additionalProperties: true,
            },
          },
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          const params: Record<string, string | number | boolean | undefined> = {};
          if (args.filters && typeof args.filters === 'object') {
            Object.assign(
              params,
              args.filters as Record<string, string | number | boolean | undefined>,
            );
          }
          const count = await client.count(resourcePath, params);
          return { count };
        },
      });
    }

    if (resource.operations.includes('create')) {
      tools.push({
        name: `create_${resource.name}`,
        description: `[WRITE] Create a new ${resource.name} in OfficeRnD. ${resource.description}. This tool writes data to OfficeRnD.`,
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              description: `The ${resource.name} data to create`,
              additionalProperties: true,
            },
          },
          required: ['data'],
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          return client.create(resourcePath, args.data);
        },
      });
    }

    if (resource.operations.includes('update')) {
      tools.push({
        name: `update_${resource.name}`,
        description: `[WRITE] Update an existing ${resource.name} in OfficeRnD. ${resource.description}. This tool writes data to OfficeRnD.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: `The ${resource.name} ID` },
            data: {
              type: 'object',
              description: 'The fields to update',
              additionalProperties: true,
            },
          },
          required: ['id', 'data'],
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          return client.update(resourcePath, String(args.id), args.data);
        },
      });
    }

    if (resource.operations.includes('delete')) {
      tools.push({
        name: `delete_${resource.name}`,
        description: `[WRITE] Delete a ${resource.name} from OfficeRnD by ID. ${resource.description}. This tool permanently removes the record.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: `The ${resource.name} ID` },
          },
          required: ['id'],
        },
        handler: async (args) => {
          const client = clientRef.current;
          if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
          await client.delete(resourcePath, String(args.id));
          return { success: true };
        },
      });
    }
  }

  tools.push(
    {
      name: 'find_available_rooms',
      description:
        'Find available meeting rooms for a time range. Returns rooms with availability.',
      inputSchema: {
        type: 'object',
        properties: {
          start: {
            type: 'string',
            description: 'Start datetime ISO 8601 (e.g. 2024-01-15T09:00:00Z)',
          },
          end: {
            type: 'string',
            description: 'End datetime ISO 8601 (e.g. 2024-01-15T10:00:00Z)',
          },
          locationId: { type: 'string', description: 'Optional location/office ID to filter by' },
          capacity: { type: 'number', description: 'Minimum room capacity required' },
        },
        required: ['start', 'end'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return findAvailableRooms(client, {
          start: String(args.start),
          end: String(args.end),
          locationId: args.locationId ? String(args.locationId) : undefined,
          capacity: typeof args.capacity === 'number' ? args.capacity : undefined,
        });
      },
    },
    {
      name: 'find_memberships_expiring_soon',
      description: 'Find memberships expiring within a specified number of days.',
      inputSchema: {
        type: 'object',
        properties: {
          daysUntilExpiry: {
            type: 'number',
            description: 'Number of days to look ahead (default: 30)',
          },
          locationId: { type: 'string', description: 'Optional location/office ID' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return membershipsExpiringSoon(client, {
          daysUntilExpiry:
            typeof args.daysUntilExpiry === 'number' ? args.daysUntilExpiry : undefined,
          locationId: args.locationId ? String(args.locationId) : undefined,
        });
      },
    },
    {
      name: 'get_todays_visitors',
      description: 'Get all visitors scheduled or checked in for today.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return todaysVisitors(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_todays_bookings',
      description: 'Get all room/resource bookings for today.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return todaysBookings(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_unpaid_invoices',
      description: 'Get all unpaid invoices. Useful for billing review.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return unpaidInvoices(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_members_by_company',
      description: 'Get all members belonging to a specific company.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'The company ID' },
        },
        required: ['companyId'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return membersByCompany(client, String(args.companyId));
      },
    },
    {
      name: 'get_active_members',
      description: 'Get all currently active members.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return activeMembers(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_inventory',
      description:
        'Get a consolidated inventory of all bookable resources, resource types, and pricing rates in a single response. Reduces multi-call pagination overhead.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID to filter by' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return getInventory(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_resource_rate_cancellation_policy',
      description:
        'Get the cancellation policy linked to a specific resource rate (GET /resource-rates/{id}/cancellation-policy). Useful for surfacing booking cancellation terms alongside pricing.',
      inputSchema: {
        type: 'object',
        properties: {
          resourceRateId: { type: 'string', description: 'The resource rate ID' },
        },
        required: ['resourceRateId'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return client.get(`/resource-rates/${String(args.resourceRateId)}`, 'cancellation-policy');
      },
    },
    {
      name: 'preview_checkout',
      description:
        'Preview a checkout (GET /checkout/summary) to see pricing, fees, taxes, and proration before committing to a plan, membership, or booking purchase. Read-only — makes no changes.',
      inputSchema: {
        type: 'object',
        properties: {
          filters: {
            type: 'object',
            description:
              'Checkout summary query parameters, e.g. memberId, planId, resourceId, startDate',
            additionalProperties: true,
          },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        const params: Record<string, string | number | boolean | undefined> = {};
        if (args.filters && typeof args.filters === 'object') {
          Object.assign(
            params,
            args.filters as Record<string, string | number | boolean | undefined>,
          );
        }
        return client.http.get('/checkout/summary', params);
      },
    },
    {
      name: 'execute_checkout',
      description:
        '[WRITE] Execute a checkout (POST /checkout) to finalize a plan, membership, or booking purchase, including billing and payment. This tool writes data to OfficeRnD — prefer preview_checkout first to confirm pricing.',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            description: 'The checkout payload (member, plan/resource selection, payment details)',
            additionalProperties: true,
          },
        },
        required: ['data'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return client.http.post('/checkout', args.data);
      },
    },
    {
      name: 'get_pricing_catalog',
      description:
        'Get a consolidated pricing catalog (plans, products, addons, resource rates, and price lists) in a single response. Ideal for comparing website pricing with OfficeRnD-managed pricing.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID to filter by' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return getPricingCatalog(client, args.locationId ? String(args.locationId) : undefined);
      },
    },
    {
      name: 'get_membership_offerings',
      description:
        'Get customer-facing membership offerings (plans, passes, and addons) that can be surfaced on a signup or pricing page. Optionally scoped to a location.',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Optional location/office ID to filter by' },
        },
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return getMembershipOfferings(
          client,
          args.locationId ? String(args.locationId) : undefined,
        );
      },
    },
    {
      name: 'get_member_billing_summary',
      description:
        'Get a consolidated billing summary for a single member: their memberships, contracts, invoices, charges, payments and fees. Useful for customer support and account audits without issuing separate list calls.',
      inputSchema: {
        type: 'object',
        properties: {
          memberId: { type: 'string', description: 'The member ID' },
        },
        required: ['memberId'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return getMemberBillingSummary(client, String(args.memberId));
      },
    },
    {
      name: 'list_resource_rates_for_resource',
      description:
        'List the resource rates that apply to a specific bookable resource (GET /resource-rates?resource={resourceId}). Wraps the correct filter parameter to avoid the backend validation error some accounts hit when calling /resource-rates unfiltered.',
      inputSchema: {
        type: 'object',
        properties: {
          resourceId: { type: 'string', description: 'The resource ID to list rates for' },
        },
        required: ['resourceId'],
      },
      handler: async (args) => {
        const client = clientRef.current;
        if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);
        return listResourceRatesForResource(client, String(args.resourceId));
      },
    },
    {
      name: 'health_check',
      description:
        'Check whether the OfficeRnD MCP server is configured and can reach the OfficeRnD API. Returns configuration status, connectivity result, and a full capabilities summary listing all read and write tools available.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const client = clientRef.current;

        const readTools = tools
          .filter(
            (t) =>
              t.name.startsWith('list_') ||
              t.name.startsWith('get_') ||
              t.name.startsWith('count_') ||
              t.name.startsWith('find_') ||
              t.name === 'preview_checkout' ||
              t.name === 'health_check',
          )
          .map((t) => t.name);

        const writeTools = tools
          .filter(
            (t) =>
              t.name.startsWith('create_') ||
              t.name.startsWith('update_') ||
              t.name.startsWith('delete_') ||
              t.name === 'execute_checkout',
          )
          .map((t) => t.name);

        const capabilities = {
          totalTools: tools.length,
          readTools: { count: readTools.length, tools: readTools },
          writeTools: { count: writeTools.length, tools: writeTools },
          note: 'This MCP server supports full CRUD operations. Use [WRITE] tools to create, update, and delete records in OfficeRnD.',
        };

        if (!client) {
          return {
            configured: false,
            connected: false,
            message: NOT_CONFIGURED_MESSAGE,
            capabilities,
          };
        }
        try {
          await client.list('/resource-types', { $limit: 1 });
          return {
            configured: true,
            connected: true,
            organizationSlug: client.config.organizationSlug,
            apiVersion: client.config.apiVersion,
            message: 'OfficeRnD connection is healthy.',
            capabilities,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            configured: true,
            connected: false,
            organizationSlug: client.config.organizationSlug,
            apiVersion: client.config.apiVersion,
            message: `OfficeRnD is configured but a test request failed: ${message}`,
            capabilities,
          };
        }
      },
    },
  );

  return tools;
}

export function createServer(initialClient: OfficeRnDClient | null = null): Server {
  const server = new Server(
    { name: 'officernd-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const clientRef = { current: initialClient };
  const tools = buildTools(clientRef);
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.handler((args ?? {}) as Record<string, unknown>);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
