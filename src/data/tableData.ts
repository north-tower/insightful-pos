export type TableStatus = 'available' | 'reserved' | 'occupied';

export interface Table {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
  area: 'main' | 'terrace' | 'outdoor';
  position: { row: number; col: number };
}

export interface Reservation {
  id: string;
  customerName: string;
  time: string;
  tableNumber: number;
  guests: number;
  phone?: string;
  status: 'payment' | 'on-dine' | 'unpaid' | 'upcoming';
  type: 'dinner' | 'lunch' | 'breakfast';
}

export const tables: Table[] = [
  // Row 1
  { id: 't1', number: 1, seats: 6, status: 'reserved', area: 'main', position: { row: 0, col: 0 } },
  { id: 't2', number: 2, seats: 2, status: 'reserved', area: 'main', position: { row: 0, col: 1 } },
  { id: 't3', number: 3, seats: 2, status: 'available', area: 'main', position: { row: 0, col: 2 } },
  
  // Row 2
  { id: 't4', number: 4, seats: 3, status: 'occupied', area: 'main', position: { row: 1, col: 0 } },
  { id: 't5', number: 5, seats: 0, status: 'available', area: 'main', position: { row: 1, col: 1 } },
  { id: 't6', number: 6, seats: 7, status: 'available', area: 'main', position: { row: 1, col: 2 } },
  
  // Row 3
  { id: 't7', number: 7, seats: 10, status: 'occupied', area: 'main', position: { row: 2, col: 0 } },
  { id: 't8', number: 8, seats: 2, status: 'reserved', area: 'main', position: { row: 2, col: 1 } },
  { id: 't9', number: 9, seats: 4, status: 'occupied', area: 'main', position: { row: 2, col: 2 } },
  
  // Row 4
  { id: 't10', number: 10, seats: 2, status: 'occupied', area: 'main', position: { row: 3, col: 0 } },
  { id: 't11', number: 11, seats: 2, status: 'reserved', area: 'main', position: { row: 3, col: 1 } },
  { id: 't12', number: 12, seats: 8, status: 'available', area: 'main', position: { row: 3, col: 2 } },
  
  // Terrace tables
  { id: 't13', number: 13, seats: 4, status: 'available', area: 'terrace', position: { row: 0, col: 0 } },
  { id: 't14', number: 14, seats: 4, status: 'reserved', area: 'terrace', position: { row: 0, col: 1 } },
  { id: 't15', number: 15, seats: 6, status: 'occupied', area: 'terrace', position: { row: 1, col: 0 } },
  { id: 't16', number: 16, seats: 2, status: 'available', area: 'terrace', position: { row: 1, col: 1 } },
  
  // Outdoor tables
  { id: 't17', number: 17, seats: 4, status: 'available', area: 'outdoor', position: { row: 0, col: 0 } },
  { id: 't18', number: 18, seats: 8, status: 'reserved', area: 'outdoor', position: { row: 0, col: 1 } },
  { id: 't19', number: 19, seats: 4, status: 'available', area: 'outdoor', position: { row: 1, col: 0 } },
  { id: 't20', number: 20, seats: 6, status: 'occupied', area: 'outdoor', position: { row: 1, col: 1 } },
];

export const reservations: Reservation[] = [
  {
    id: 'r1',
    customerName: 'Uthman ibn Hunaif',
    time: '7:30 PM',
    tableNumber: 1,
    guests: 6,
    phone: '+84 678 890 000',
    status: 'payment',
    type: 'dinner',
  },
  {
    id: 'r2',
    customerName: "Bashir ibn Sa'ad",
    time: 'On Dine',
    tableNumber: 2,
    guests: 2,
    status: 'on-dine',
    type: 'dinner',
  },
  {
    id: 'r3',
    customerName: 'Ali',
    time: '8:00 PM',
    tableNumber: 3,
    guests: 2,
    phone: '+84 342 556 555',
    status: 'payment',
    type: 'dinner',
  },
  {
    id: 'r4',
    customerName: 'Khunais ibn Hudhafa',
    time: 'On Dine',
    tableNumber: 4,
    guests: 3,
    status: 'on-dine',
    type: 'dinner',
  },
  {
    id: 'r5',
    customerName: 'Available Now',
    time: 'Free',
    tableNumber: 5,
    guests: 0,
    status: 'upcoming',
    type: 'dinner',
  },
  {
    id: 'r6',
    customerName: "Mus'ab ibn Umayr",
    time: '8:25 PM',
    tableNumber: 6,
    guests: 7,
    phone: '+84 800 563 554',
    status: 'unpaid',
    type: 'dinner',
  },
  {
    id: 'r7',
    customerName: 'Shuja ibn Wahb',
    time: '9:00 PM',
    tableNumber: 7,
    guests: 10,
    status: 'payment',
    type: 'dinner',
  },
];
