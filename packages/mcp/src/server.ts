import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OfficeRnDClient, RESOURCES } from '@officernd/sdk';
import {
  activeMembers,
  findAvailableRooms,
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

export function buildTools(client: OfficeRnDClient): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

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
        handler: async (args) => client.get(resourcePath, String(args.id)),
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
        description: `Create a new ${resource.name}. ${resource.description}`,
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
        handler: async (args) => client.create(resourcePath, args.data),
      });
    }

    if (resource.operations.includes('update')) {
      tools.push({
        name: `update_${resource.name}`,
        description: `Update an existing ${resource.name}. ${resource.description}`,
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
        handler: async (args) => client.update(resourcePath, String(args.id), args.data),
      });
    }

    if (resource.operations.includes('delete')) {
      tools.push({
        name: `delete_${resource.name}`,
        description: `Delete a ${resource.name} by ID. ${resource.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: `The ${resource.name} ID` },
          },
          required: ['id'],
        },
        handler: async (args) => {
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
      handler: async (args) =>
        findAvailableRooms(client, {
          start: String(args.start),
          end: String(args.end),
          locationId: args.locationId ? String(args.locationId) : undefined,
          capacity: typeof args.capacity === 'number' ? args.capacity : undefined,
        }),
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
      handler: async (args) =>
        membershipsExpiringSoon(client, {
          daysUntilExpiry:
            typeof args.daysUntilExpiry === 'number' ? args.daysUntilExpiry : undefined,
          locationId: args.locationId ? String(args.locationId) : undefined,
        }),
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
      handler: async (args) =>
        todaysVisitors(client, args.locationId ? String(args.locationId) : undefined),
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
      handler: async (args) =>
        todaysBookings(client, args.locationId ? String(args.locationId) : undefined),
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
      handler: async (args) =>
        unpaidInvoices(client, args.locationId ? String(args.locationId) : undefined),
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
      handler: async (args) => membersByCompany(client, String(args.companyId)),
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
      handler: async (args) =>
        activeMembers(client, args.locationId ? String(args.locationId) : undefined),
    },
  );

  return tools;
}

export function createServer(client: OfficeRnDClient): Server {
  const server = new Server(
    { name: 'officernd-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const tools = buildTools(client);
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
