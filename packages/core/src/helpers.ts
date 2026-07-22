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
