import type { OfficeRnDClient } from '@officernd/sdk';

export interface AvailableRoomOptions {
  start: string;
  end: string;
  locationId?: string;
  capacity?: number;
}

export interface MembershipFilter {
  daysUntilExpiry?: number;
  locationId?: string;
}

export async function findAvailableRooms(
  client: OfficeRnDClient,
  options: AvailableRoomOptions,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    available: true,
    startDate: options.start,
    endDate: options.end,
    ...(options.locationId ? { officeId: options.locationId } : {}),
    ...(options.capacity ? { minCapacity: options.capacity } : {}),
  };

  return client.list('/resources', params);
}

export async function membershipsExpiringSoon(
  client: OfficeRnDClient,
  options: MembershipFilter = {},
): Promise<unknown[]> {
  const daysUntilExpiry = options.daysUntilExpiry ?? 30;
  const now = new Date();
  const future = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  const params: Record<string, string | number | boolean | undefined> = {
    status: 'active',
    endDate_lte: future.toISOString().split('T')[0],
    ...(options.locationId ? { officeId: options.locationId } : {}),
  };

  return client.list('/memberships', params);
}

export async function todaysVisitors(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<unknown[]> {
  const today = new Date().toISOString().split('T')[0];
  const params: Record<string, string | number | boolean | undefined> = {
    date: today,
    ...(locationId ? { officeId: locationId } : {}),
  };

  return client.list('/visitors', params);
}

export async function todaysBookings(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<unknown[]> {
  const today = new Date().toISOString().split('T')[0];
  const params: Record<string, string | number | boolean | undefined> = {
    startDate: today,
    endDate: today,
    ...(locationId ? { officeId: locationId } : {}),
  };

  return client.list('/bookings', params);
}

export async function unpaidInvoices(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    status: 'unpaid',
    ...(locationId ? { officeId: locationId } : {}),
  };

  return client.list('/invoices', params);
}

export async function membersByCompany(
  client: OfficeRnDClient,
  companyId: string,
): Promise<unknown[]> {
  return client.list('/members', { companyId });
}

export async function activeMembers(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    status: 'active',
    ...(locationId ? { officeId: locationId } : {}),
  };

  return client.list('/members', params);
}

export interface InventoryResult {
  resources: unknown[];
  resourceTypes: unknown[];
  rates: unknown[];
}

export async function getInventory(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<InventoryResult> {
  const params: Record<string, string | number | boolean | undefined> = locationId
    ? { officeId: locationId }
    : {};

  const [resources, resourceTypes, rates] = await Promise.all([
    client.list('/resources', params),
    client.list('/resource-types', params),
    client.list('/resource-rates', params),
  ]);

  return { resources, resourceTypes, rates };
}

export interface PricingCatalogResult {
  plans: unknown[];
  products: unknown[];
  addons: unknown[];
  resourceRates: unknown[];
  priceLists: unknown[];
}

/**
 * Fetch a consolidated pricing catalog (plans, products, addons, resource
 * rates, and price lists) in a single call. Intended for website ↔ OfficeRnD
 * pricing comparison workflows.
 */
export async function getPricingCatalog(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<PricingCatalogResult> {
  const params: Record<string, string | number | boolean | undefined> = locationId
    ? { officeId: locationId }
    : {};

  const [plans, products, addons, resourceRates, priceLists] = await Promise.all([
    client.list('/plans', params),
    client.list('/products', params),
    client.list('/addons', params),
    client.list('/resource-rates', params),
    client.list('/price-lists', params),
  ]);

  return { plans, products, addons, resourceRates, priceLists };
}

export interface MembershipOfferingsResult {
  plans: unknown[];
  passes: unknown[];
  addons: unknown[];
}

/**
 * Fetch the customer-facing membership offerings (plans, passes and addons)
 * that can be surfaced on a signup / pricing page. Only active/visible items
 * are requested — the caller may further filter based on their own rules.
 */
export async function getMembershipOfferings(
  client: OfficeRnDClient,
  locationId?: string,
): Promise<MembershipOfferingsResult> {
  const params: Record<string, string | number | boolean | undefined> = {
    ...(locationId ? { officeId: locationId } : {}),
  };

  const [plans, passes, addons] = await Promise.all([
    client.list('/plans', params),
    client.list('/passes', params),
    client.list('/addons', params),
  ]);

  return { plans, passes, addons };
}

export interface MemberBillingSummaryResult {
  memberships: unknown[];
  contracts: unknown[];
  invoices: unknown[];
  charges: unknown[];
  payments: unknown[];
  fees: unknown[];
}

/**
 * Fetch a consolidated billing view for a single member: their memberships,
 * contracts, invoices, charges, payments and fees. Useful for customer support
 * and account audits without issuing several separate list calls.
 */
export async function getMemberBillingSummary(
  client: OfficeRnDClient,
  memberId: string,
): Promise<MemberBillingSummaryResult> {
  const params: Record<string, string | number | boolean | undefined> = { member: memberId };

  const [memberships, contracts, invoices, charges, payments, fees] = await Promise.all([
    client.list('/memberships', params),
    client.list('/contracts', params),
    client.list('/invoices', params),
    client.list('/charges', params),
    client.list('/payments', params),
    client.list('/fees', params),
  ]);

  return { memberships, contracts, invoices, charges, payments, fees };
}

/**
 * List resource rates that apply to a specific bookable resource.
 *
 * OfficeRnD's `/resource-rates` list endpoint rejects an unfiltered call for
 * some accounts and expects the resource ID to be passed as the `resource`
 * query parameter. Wrapping that call as a dedicated helper avoids the
 * "backend validation" error observed when callers guess at the filter name.
 */
export async function listResourceRatesForResource(
  client: OfficeRnDClient,
  resourceId: string,
): Promise<unknown[]> {
  return client.list('/resource-rates', { resource: resourceId });
}
