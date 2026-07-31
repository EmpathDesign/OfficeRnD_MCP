import { describe, expect, it, vi } from 'vitest';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildTools, createServer } from './server.js';

function createMockClient() {
  return {
    list: vi.fn().mockResolvedValue([{ id: '1' }]),
    get: vi.fn().mockResolvedValue({ id: '1' }),
    count: vi.fn().mockResolvedValue(42),
    create: vi.fn().mockResolvedValue({ id: '1', created: true }),
    update: vi.fn().mockResolvedValue({ id: '1', updated: true }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

async function invokeRequestHandler<T>(
  server: object,
  schema: { shape: { method: { value: string } } },
  params: Record<string, unknown>,
): Promise<T> {
  const handlers = (
    server as {
      _requestHandlers: Map<
        string,
        (request: { method: string; params: Record<string, unknown> }) => Promise<T>
      >;
    }
  )._requestHandlers;
  const handler = handlers.get(schema.shape.method.value);
  if (!handler) {
    throw new Error(`Missing handler for ${schema.shape.method.value}`);
  }
  return handler({ method: schema.shape.method.value, params });
}

describe('createServer', () => {
  it('generates tools from the registry with at least 130 tools', () => {
    const tools = buildTools({ current: createMockClient() as never });
    expect(tools.length).toBeGreaterThanOrEqual(130);
  });

  it('configure_officernd tool is always present', () => {
    const tools = buildTools({ current: null });
    const configureTool = tools.find((t) => t.name === 'configure_officernd');
    expect(configureTool).toBeDefined();
  });

  it('configure_officernd tool is listed first', () => {
    const tools = buildTools({ current: null });
    expect(tools[0]?.name).toBe('configure_officernd');
  });

  it('configure_officernd sets the client on the ref', async () => {
    const clientRef = { current: null as ReturnType<typeof createMockClient> | null };
    const tools = buildTools(clientRef as never);
    const configureTool = tools.find((t) => t.name === 'configure_officernd');

    const result = (await configureTool?.handler({
      clientId: 'test-id',
      clientSecret: 'test-secret',
      orgSlug: 'my-org',
    })) as { success: boolean; message: string };

    expect(result.success).toBe(true);
    expect(result.message).toContain('my-org');
    expect(clientRef.current).not.toBeNull();
  });

  it('tools return not-configured error when client is null', async () => {
    const server = createServer(null);

    const response = await invokeRequestHandler<{
      isError?: boolean;
      content: Array<{ text: string }>;
    }>(server, CallToolRequestSchema, {
      name: 'list_members',
      arguments: {},
    });

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('configure_officernd');
  });

  it('list tools call client.list', async () => {
    const client = createMockClient();
    const memberTool = buildTools({ current: client as never }).find(
      (tool) => tool.name === 'list_members',
    );

    await memberTool?.handler({ filters: { status: 'active' }, limit: 10 });

    expect(client.list).toHaveBeenCalledWith('/members', { status: 'active', $limit: 10 });
  });

  it('get tools call client.get', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_member',
    );

    await tool?.handler({ id: 'member-1' });

    expect(client.get).toHaveBeenCalledWith('/members', 'member-1');
  });

  it('create tools call client.create', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'create_member',
    );

    await tool?.handler({ data: { firstName: 'Taylor' } });

    expect(client.create).toHaveBeenCalledWith('/members', { firstName: 'Taylor' });
  });

  it('update tools call client.update', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'update_member',
    );

    await tool?.handler({ id: 'member-1', data: { status: 'active' } });

    expect(client.update).toHaveBeenCalledWith('/members', 'member-1', { status: 'active' });
  });

  it('delete tools call client.delete', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'delete_member',
    );

    await tool?.handler({ id: 'member-1' });

    expect(client.delete).toHaveBeenCalledWith('/members', 'member-1');
  });

  it('business tools are registered', () => {
    const toolNames = buildTools({ current: createMockClient() as never }).map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'find_available_rooms',
        'find_memberships_expiring_soon',
        'get_todays_visitors',
        'get_todays_bookings',
        'get_unpaid_invoices',
        'get_members_by_company',
        'get_active_members',
        'get_inventory',
      ]),
    );
  });

  it('get_inventory calls client.list for resources, resource-types, and resource-rates', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_inventory',
    );

    const result = (await tool?.handler({})) as {
      resources: unknown[];
      resourceTypes: unknown[];
      rates: unknown[];
    };

    expect(client.list).toHaveBeenCalledWith('/resources', {});
    expect(client.list).toHaveBeenCalledWith('/resource-types', {});
    expect(client.list).toHaveBeenCalledWith('/resource-rates', {});
    expect(result).toHaveProperty('resources');
    expect(result).toHaveProperty('resourceTypes');
    expect(result).toHaveProperty('rates');
  });

  it('get_inventory passes locationId filter when provided', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_inventory',
    );

    await tool?.handler({ locationId: 'office-1' });

    expect(client.list).toHaveBeenCalledWith('/resources', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/resource-types', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/resource-rates', { officeId: 'office-1' });
  });

  it('unknown tool returns isError true', async () => {
    const client = createMockClient();
    const server = createServer(client as never);

    const response = await invokeRequestHandler<{
      isError?: boolean;
      content: Array<{ text: string }>;
    }>(server, CallToolRequestSchema, {
      name: 'missing_tool',
      arguments: {},
    });

    expect(response.isError).toBe(true);
    expect(response.content[0]?.text).toContain('Unknown tool: missing_tool');
  });
});
