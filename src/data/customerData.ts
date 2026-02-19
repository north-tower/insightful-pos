export interface CustomerPreference {
  id: string;
  type: 'allergy' | 'dietary' | 'dislike' | 'like' | 'note';
  name: string;
  description?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  notes?: string;
  preferences?: CustomerPreference[];
  tags?: string[];
  status: 'active' | 'inactive' | 'vip';
  createdAt: Date;
  updatedAt: Date;
}

export const mockCustomers: Customer[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street',
    city: 'New York',
    postalCode: '10001',
    country: 'USA',
    loyaltyPoints: 1250,
    totalSpent: 3420.50,
    totalOrders: 28,
    status: 'vip',
    notes: 'Prefers window seating. Regular customer.',
    preferences: [
      {
        id: '1',
        type: 'allergy',
        name: 'Peanuts',
        description: 'Severe peanut allergy',
      },
      {
        id: '2',
        type: 'like',
        name: 'Spicy Food',
        description: 'Loves extra spicy dishes',
      },
    ],
    tags: ['regular', 'vip', 'preferred'],
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+1 (555) 234-5678',
    address: '456 Oak Avenue',
    city: 'Los Angeles',
    postalCode: '90001',
    country: 'USA',
    loyaltyPoints: 850,
    totalSpent: 1890.25,
    totalOrders: 15,
    status: 'active',
    notes: 'Vegetarian. Orders frequently for delivery.',
    preferences: [
      {
        id: '3',
        type: 'dietary',
        name: 'Vegetarian',
        description: 'Strict vegetarian diet',
      },
    ],
    tags: ['vegetarian', 'delivery'],
    createdAt: new Date('2023-03-20'),
    updatedAt: new Date('2024-01-08'),
  },
  {
    id: '3',
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.j@example.com',
    phone: '+1 (555) 345-6789',
    address: '789 Pine Road',
    city: 'Chicago',
    postalCode: '60601',
    country: 'USA',
    loyaltyPoints: 420,
    totalSpent: 980.75,
    totalOrders: 12,
    status: 'active',
    preferences: [
      {
        id: '4',
        type: 'dislike',
        name: 'Cilantro',
        description: 'Does not like cilantro',
      },
    ],
    tags: ['regular'],
    createdAt: new Date('2023-05-10'),
    updatedAt: new Date('2024-01-05'),
  },
  {
    id: '4',
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.w@example.com',
    phone: '+1 (555) 456-7890',
    address: '321 Elm Street',
    city: 'Houston',
    postalCode: '77001',
    country: 'USA',
    loyaltyPoints: 2100,
    totalSpent: 5420.00,
    totalOrders: 45,
    status: 'vip',
    notes: 'VIP member. Prefers table 12. Wine enthusiast.',
    preferences: [
      {
        id: '5',
        type: 'like',
        name: 'Wine Pairing',
        description: 'Enjoys wine recommendations',
      },
      {
        id: '6',
        type: 'note',
        name: 'Table Preference',
        description: 'Prefers corner tables',
      },
    ],
    tags: ['vip', 'wine', 'preferred'],
    createdAt: new Date('2022-11-05'),
    updatedAt: new Date('2024-01-12'),
  },
  {
    id: '5',
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@example.com',
    phone: '+1 (555) 567-8901',
    address: '654 Maple Drive',
    city: 'Phoenix',
    postalCode: '85001',
    country: 'USA',
    loyaltyPoints: 180,
    totalSpent: 450.00,
    totalOrders: 6,
    status: 'active',
    tags: [],
    createdAt: new Date('2023-10-15'),
    updatedAt: new Date('2023-12-20'),
  },
  {
    id: '6',
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@example.com',
    phone: '+1 (555) 678-9012',
    address: '987 Cedar Lane',
    city: 'Philadelphia',
    postalCode: '19101',
    country: 'USA',
    loyaltyPoints: 0,
    totalSpent: 0,
    totalOrders: 0,
    status: 'inactive',
    notes: 'Registered but never placed an order.',
    tags: ['new'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '7',
    firstName: 'Robert',
    lastName: 'Miller',
    email: 'robert.m@example.com',
    phone: '+1 (555) 789-0123',
    address: '147 Birch Court',
    city: 'San Antonio',
    postalCode: '78201',
    country: 'USA',
    loyaltyPoints: 650,
    totalSpent: 1520.50,
    totalOrders: 18,
    status: 'active',
    preferences: [
      {
        id: '7',
        type: 'dietary',
        name: 'Gluten-Free',
        description: 'Requires gluten-free options',
      },
    ],
    tags: ['gluten-free', 'regular'],
    createdAt: new Date('2023-04-12'),
    updatedAt: new Date('2024-01-09'),
  },
  {
    id: '8',
    firstName: 'Lisa',
    lastName: 'Wilson',
    email: 'lisa.wilson@example.com',
    phone: '+1 (555) 890-1234',
    address: '258 Spruce Street',
    city: 'San Diego',
    postalCode: '92101',
    country: 'USA',
    loyaltyPoints: 320,
    totalSpent: 780.25,
    totalOrders: 9,
    status: 'active',
    tags: ['regular'],
    createdAt: new Date('2023-07-22'),
    updatedAt: new Date('2023-12-15'),
  },
  {
    id: '9',
    firstName: 'James',
    lastName: 'Moore',
    email: 'james.moore@example.com',
    phone: '+1 (555) 901-2345',
    address: '369 Willow Way',
    city: 'Dallas',
    postalCode: '75201',
    country: 'USA',
    loyaltyPoints: 1580,
    totalSpent: 3890.75,
    totalOrders: 32,
    status: 'vip',
    notes: 'Corporate client. Frequently hosts business dinners.',
    preferences: [
      {
        id: '8',
        type: 'note',
        name: 'Business Dining',
        description: 'Prefers quiet tables for business meetings',
      },
    ],
    tags: ['vip', 'corporate', 'business'],
    createdAt: new Date('2022-09-18'),
    updatedAt: new Date('2024-01-11'),
  },
  {
    id: '10',
    firstName: 'Patricia',
    lastName: 'Taylor',
    email: 'patricia.t@example.com',
    phone: '+1 (555) 012-3456',
    address: '741 Ash Boulevard',
    city: 'San Jose',
    postalCode: '95101',
    country: 'USA',
    loyaltyPoints: 95,
    totalSpent: 230.00,
    totalOrders: 4,
    status: 'active',
    tags: ['new'],
    createdAt: new Date('2023-12-05'),
    updatedAt: new Date('2024-01-03'),
  },
];




