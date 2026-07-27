export interface ResourceDef {
  name: string;
  path: string;
  description: string;
  operations: ('list' | 'get' | 'create' | 'update' | 'delete' | 'count')[];
  searchable?: boolean;
  parentResource?: string;
}

export const RESOURCES: ResourceDef[] = [
  {
    name: 'member',
    path: '/members',
    description: 'Coworking space members',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
    searchable: true,
  },
  {
    name: 'company',
    path: '/companies',
    description: 'Member companies/organizations',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
    searchable: true,
  },
  {
    name: 'team',
    path: '/teams',
    description: 'Member teams',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'membership',
    path: '/memberships',
    description: 'Membership subscriptions',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'contract',
    path: '/contracts',
    description: 'Membership contracts',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'lead',
    path: '/leads',
    description: 'Sales leads',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'opportunity',
    path: '/opportunities',
    description: 'Sales opportunities',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'visitor',
    path: '/visitors',
    description: 'Space visitors',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'visit',
    path: '/visits',
    description: 'Visitor visits/check-ins',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'booking',
    path: '/bookings',
    description: 'Resource/room bookings',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'room',
    path: '/resources',
    description: 'Meeting rooms and bookable resources',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'desk',
    path: '/desks',
    description: 'Hot desks and dedicated desks',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'resource_type',
    path: '/resource-types',
    description: 'Types of bookable resources',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'location',
    path: '/offices',
    description: 'Physical locations/offices',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'floor',
    path: '/floors',
    description: 'Building floors',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'amenity',
    path: '/amenities',
    description: 'Room/desk amenities',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'event',
    path: '/events',
    description: 'Community events',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'invoice',
    path: '/invoices',
    description: 'Billing invoices',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'payment',
    path: '/payments',
    description: 'Payment records',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'credit',
    path: '/credits',
    description: 'Account credits',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'plan',
    path: '/plans',
    description: 'Membership plans',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'product',
    path: '/products',
    description: 'Billable products',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'addon',
    path: '/addons',
    description: 'Membership add-ons',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'price_list',
    path: '/price-lists',
    description: 'Custom price lists',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'checkin',
    path: '/check-ins',
    description: 'Member check-ins',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'fee',
    path: '/fees',
    description: 'Billing fees',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'tag',
    path: '/tags',
    description: 'Resource tags',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'note',
    path: '/notes',
    description: 'Notes on resources',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'role',
    path: '/roles',
    description: 'User roles',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'webhook',
    path: '/webhooks',
    description: 'Event webhooks',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'document',
    path: '/documents',
    description: 'Uploaded documents',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  {
    name: 'custom_field',
    path: '/custom-fields',
    description: 'Custom field definitions',
    operations: ['list', 'get', 'create', 'update', 'delete'],
  },
  // Space resources
  {
    name: 'assignment',
    path: '/assignments',
    description: 'Space resource assignments (desks, offices, etc.) to members or companies',
    operations: ['list', 'get', 'create', 'delete', 'count'],
  },
  {
    name: 'pass',
    path: '/passes',
    description: 'Day passes and space access passes for members',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'coin',
    path: '/coins',
    description: 'Virtual coins/credits used for space access and bookings',
    operations: ['list', 'get', 'count'],
  },
  // Billing resources
  {
    name: 'charge',
    path: '/charges',
    description: 'Individual billing charges applied to members or companies',
    operations: ['list', 'get', 'create', 'update', 'delete', 'count'],
  },
  {
    name: 'tax_rate',
    path: '/tax-rates',
    description: 'Tax rates applied to invoices and charges',
    operations: ['list', 'get'],
  },
  {
    name: 'revenue_account',
    path: '/revenue-accounts',
    description: 'Revenue accounts used for accounting categorization',
    operations: ['list', 'get'],
  },
  {
    name: 'resource_rate',
    path: '/resource-rates',
    description: 'Pricing rates for bookable resources',
    operations: ['list', 'get'],
  },
  {
    name: 'cancellation_policy',
    path: '/cancellation-policies',
    description: 'Booking cancellation policies',
    operations: ['list', 'get'],
  },
  {
    name: 'payment_detail',
    path: '/payment-details',
    description: 'Saved payment method details for members',
    operations: ['list', 'get', 'create', 'delete'],
  },
  // Collaboration resources
  {
    name: 'ticket',
    path: '/tickets',
    description: 'Support and helpdesk tickets',
    operations: ['list', 'get', 'create', 'update', 'count'],
  },
  {
    name: 'ticket_option',
    path: '/ticket-options',
    description: 'Ticket category and option definitions',
    operations: ['list', 'get'],
  },
  {
    name: 'ticket_comment',
    path: '/ticket-comments',
    description: 'Comments on support tickets',
    operations: ['list', 'get', 'create'],
  },
  {
    name: 'post',
    path: '/posts',
    description: 'Community posts and announcements',
    operations: ['list', 'get', 'create', 'delete', 'count'],
  },
  {
    name: 'benefit',
    path: '/benefits',
    description: 'Member benefits and perks',
    operations: ['list', 'get'],
  },
  // Community resources
  {
    name: 'opportunity_status',
    path: '/opportunity-statuses',
    description: 'Status definitions for sales opportunities',
    operations: ['list', 'get'],
  },
  {
    name: 'reception_flow',
    path: '/reception-flows',
    description: 'Visitor reception flow configurations',
    operations: ['list', 'get'],
  },
  // Settings resources
  {
    name: 'secondary_currency',
    path: '/secondary-currencies',
    description: 'Secondary currency configurations for multi-currency billing',
    operations: ['list', 'get', 'update'],
  },
];
