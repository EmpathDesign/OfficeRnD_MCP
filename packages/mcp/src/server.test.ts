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
    config: { organizationSlug: 'my-org', apiVersion: 'v2' },
    http: {
      get: vi.fn().mockResolvedValue({ total: 100, fees: [] }),
      post: vi.fn().mockResolvedValue({ id: 'checkout-1', status: 'completed' }),
    },
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

  it('get_resource_rate_cancellation_policy calls client.get with the nested path', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_resource_rate_cancellation_policy',
    );

    await tool?.handler({ resourceRateId: 'rate-1' });

    expect(client.get).toHaveBeenCalledWith('/resource-rates/rate-1', 'cancellation-policy');
  });

  it('preview_checkout calls client.http.get with /checkout/summary', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'preview_checkout',
    );

    const result = await tool?.handler({ filters: { memberId: 'member-1', planId: 'plan-1' } });

    expect(client.http.get).toHaveBeenCalledWith('/checkout/summary', {
      memberId: 'member-1',
      planId: 'plan-1',
    });
    expect(result).toEqual({ total: 100, fees: [] });
  });

  it('execute_checkout calls client.http.post with /checkout', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'execute_checkout',
    );

    const result = await tool?.handler({ data: { memberId: 'member-1', planId: 'plan-1' } });

    expect(client.http.post).toHaveBeenCalledWith('/checkout', {
      memberId: 'member-1',
      planId: 'plan-1',
    });
    expect(result).toEqual({ id: 'checkout-1', status: 'completed' });
  });

  it('health_check reports not configured when client is null', async () => {
    const tool = buildTools({ current: null }).find((entry) => entry.name === 'health_check');

    const result = (await tool?.handler({})) as { configured: boolean; connected: boolean };

    expect(result.configured).toBe(false);
    expect(result.connected).toBe(false);
  });

  it('health_check reports connected when configured client succeeds', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'health_check',
    );

    const result = (await tool?.handler({})) as {
      configured: boolean;
      connected: boolean;
      organizationSlug: string;
    };

    expect(client.list).toHaveBeenCalledWith('/resource-types', { $limit: 1 });
    expect(result.configured).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.organizationSlug).toBe('my-org');
  });

  it('health_check reports disconnected when the test request fails', async () => {
    const client = createMockClient();
    client.list.mockRejectedValueOnce(new Error('network error'));
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'health_check',
    );

    const result = (await tool?.handler({})) as {
      configured: boolean;
      connected: boolean;
      message: string;
    };

    expect(result.configured).toBe(true);
    expect(result.connected).toBe(false);
    expect(result.message).toContain('network error');
  });

  it('health_check always includes capabilities with readTools and writeTools', async () => {
    const client = createMockClient();
    const tools = buildTools({ current: client as never });
    const tool = tools.find((entry) => entry.name === 'health_check');

    const result = (await tool?.handler({})) as {
      capabilities: {
        totalTools: number;
        readTools: { count: number; tools: string[] };
        writeTools: { count: number; tools: string[] };
        note: string;
      };
    };

    expect(result.capabilities).toBeDefined();
    expect(result.capabilities.totalTools).toBe(tools.length);
    expect(result.capabilities.readTools.count).toBeGreaterThan(0);
    expect(result.capabilities.writeTools.count).toBeGreaterThan(0);
    expect(result.capabilities.readTools.tools).toContain('list_members');
    expect(result.capabilities.writeTools.tools).toContain('create_member');
    expect(result.capabilities.writeTools.tools).toContain('update_member');
    expect(result.capabilities.writeTools.tools).toContain('delete_member');
    expect(result.capabilities.note).toContain('[WRITE]');
  });

  it('health_check capabilities are present even when unconfigured', async () => {
    const tool = buildTools({ current: null }).find((entry) => entry.name === 'health_check');

    const result = (await tool?.handler({})) as {
      capabilities: { writeTools: { count: number; tools: string[] } };
    };

    expect(result.capabilities).toBeDefined();
    expect(result.capabilities.writeTools.count).toBeGreaterThan(0);
    expect(result.capabilities.writeTools.tools).toContain('create_booking');
  });

  it('write tools have [WRITE] prefix in their descriptions', () => {
    const tools = buildTools({ current: null });
    const writeToolNames = ['create_member', 'update_member', 'delete_member', 'execute_checkout'];
    for (const name of writeToolNames) {
      const tool = tools.find((t) => t.name === name);
      expect(tool, `${name} should exist`).toBeDefined();
      expect(tool?.description, `${name} description should start with [WRITE]`).toMatch(
        /^\[WRITE\]/,
      );
    }
  });

  it('read tools do not have [WRITE] prefix in their descriptions', () => {
    const tools = buildTools({ current: null });
    const readToolNames = ['list_members', 'get_member', 'count_members'];
    for (const name of readToolNames) {
      const tool = tools.find((t) => t.name === name);
      expect(tool, `${name} should exist`).toBeDefined();
      expect(tool?.description, `${name} description should not contain [WRITE]`).not.toMatch(
        /^\[WRITE\]/,
      );
    }
  });

  it('get_pricing_catalog calls client.list for plans, products, addons, resource-rates, price-lists', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_pricing_catalog',
    );

    const result = (await tool?.handler({})) as {
      plans: unknown[];
      products: unknown[];
      addons: unknown[];
      resourceRates: unknown[];
      priceLists: unknown[];
    };

    expect(client.list).toHaveBeenCalledWith('/plans', {});
    expect(client.list).toHaveBeenCalledWith('/products', {});
    expect(client.list).toHaveBeenCalledWith('/addons', {});
    expect(client.list).toHaveBeenCalledWith('/resource-rates', {});
    expect(client.list).toHaveBeenCalledWith('/price-lists', {});
    expect(result).toHaveProperty('plans');
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('addons');
    expect(result).toHaveProperty('resourceRates');
    expect(result).toHaveProperty('priceLists');
  });

  it('get_pricing_catalog passes locationId filter when provided', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_pricing_catalog',
    );

    await tool?.handler({ locationId: 'office-1' });

    expect(client.list).toHaveBeenCalledWith('/plans', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/products', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/addons', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/resource-rates', { officeId: 'office-1' });
    expect(client.list).toHaveBeenCalledWith('/price-lists', { officeId: 'office-1' });
  });

  it('get_membership_offerings calls client.list for plans, passes, and addons', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_membership_offerings',
    );

    const result = (await tool?.handler({})) as {
      plans: unknown[];
      passes: unknown[];
      addons: unknown[];
    };

    expect(client.list).toHaveBeenCalledWith('/plans', {});
    expect(client.list).toHaveBeenCalledWith('/passes', {});
    expect(client.list).toHaveBeenCalledWith('/addons', {});
    expect(result).toHaveProperty('plans');
    expect(result).toHaveProperty('passes');
    expect(result).toHaveProperty('addons');
  });

  it('get_member_billing_summary calls client.list for memberships, contracts, invoices, charges, payments, fees', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'get_member_billing_summary',
    );

    const result = (await tool?.handler({ memberId: 'member-1' })) as {
      memberships: unknown[];
      contracts: unknown[];
      invoices: unknown[];
      charges: unknown[];
      payments: unknown[];
      fees: unknown[];
    };

    expect(client.list).toHaveBeenCalledWith('/memberships', { member: 'member-1' });
    expect(client.list).toHaveBeenCalledWith('/contracts', { member: 'member-1' });
    expect(client.list).toHaveBeenCalledWith('/invoices', { member: 'member-1' });
    expect(client.list).toHaveBeenCalledWith('/charges', { member: 'member-1' });
    expect(client.list).toHaveBeenCalledWith('/payments', { member: 'member-1' });
    expect(client.list).toHaveBeenCalledWith('/fees', { member: 'member-1' });
    expect(result).toHaveProperty('memberships');
    expect(result).toHaveProperty('invoices');
    expect(result).toHaveProperty('fees');
  });

  it('list_resource_rates_for_resource calls client.list with resource filter', async () => {
    const client = createMockClient();
    const tool = buildTools({ current: client as never }).find(
      (entry) => entry.name === 'list_resource_rates_for_resource',
    );

    await tool?.handler({ resourceId: 'resource-1' });

    expect(client.list).toHaveBeenCalledWith('/resource-rates', { resource: 'resource-1' });
  });

  it('workflow helper tools are registered and categorized as read tools in health_check', async () => {
    const client = createMockClient();
    const tools = buildTools({ current: client as never });
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toEqual(
      expect.arrayContaining([
        'get_pricing_catalog',
        'get_membership_offerings',
        'get_member_billing_summary',
        'list_resource_rates_for_resource',
      ]),
    );

    const healthCheck = tools.find((t) => t.name === 'health_check');
    const result = (await healthCheck?.handler({})) as {
      capabilities: { readTools: { tools: string[] } };
    };
    expect(result.capabilities.readTools.tools).toEqual(
      expect.arrayContaining([
        'get_pricing_catalog',
        'get_membership_offerings',
        'get_member_billing_summary',
        'list_resource_rates_for_resource',
      ]),
    );
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
