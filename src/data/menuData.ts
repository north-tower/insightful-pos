export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  isVeg?: boolean;
  discount?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export const categories: Category[] = [
  { id: 'all', name: 'All', icon: '🍽️', count: 154 },
  { id: 'special', name: 'Special', icon: '⭐', count: 19 },
  { id: 'breakfast', name: 'Breakfast', icon: '🍳', count: 12 },
  { id: 'soups', name: 'Soups', icon: '🍜', count: 8 },
  { id: 'pasta', name: 'Pasta', icon: '🍝', count: 14 },
  { id: 'desserts', name: 'Desserts', icon: '🍰', count: 19 },
  { id: 'salads', name: 'Salads', icon: '🥗', count: 10 },
  { id: 'chicken', name: 'Chicken', icon: '🍗', count: 15 },
];

export const menuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Grilled Salmon Steak',
    price: 15.00,
    category: 'special',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop',
  },
  {
    id: '2',
    name: 'Tofu Poke Bowl',
    price: 7.00,
    category: 'salads',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop',
    isVeg: true,
  },
  {
    id: '3',
    name: 'Pasta with Roast Beef',
    price: 10.00,
    category: 'pasta',
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&h=200&fit=crop',
  },
  {
    id: '4',
    name: 'Beef Steak',
    price: 30.00,
    category: 'special',
    image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=200&fit=crop',
  },
  {
    id: '5',
    name: 'Shrimp Rice Bowl',
    price: 6.00,
    category: 'special',
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=200&fit=crop',
  },
  {
    id: '6',
    name: 'Apple Stuffed Pancake',
    price: 35.00,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop',
    isVeg: true,
  },
  {
    id: '7',
    name: 'Chicken Quinoa & Herbs',
    price: 12.00,
    category: 'chicken',
    image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=300&h=200&fit=crop',
  },
  {
    id: '8',
    name: 'Vegetable Shrimp',
    price: 10.00,
    category: 'salads',
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&h=200&fit=crop',
  },
  {
    id: '9',
    name: 'Caesar Salad',
    price: 8.50,
    category: 'salads',
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=300&h=200&fit=crop',
    isVeg: true,
  },
  {
    id: '10',
    name: 'Chocolate Lava Cake',
    price: 9.00,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&h=200&fit=crop',
    isVeg: true,
  },
  {
    id: '11',
    name: 'Eggs Benedict',
    price: 11.00,
    category: 'breakfast',
    image: 'https://images.unsplash.com/photo-1608039829572-f0ad4c04de3c?w=300&h=200&fit=crop',
  },
  {
    id: '12',
    name: 'Tom Yum Soup',
    price: 7.50,
    category: 'soups',
    image: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&h=200&fit=crop',
  },
];

export interface Order {
  id: string;
  tableNumber: string;
  items: number;
  time: string;
  status: 'kitchen' | 'ready' | 'waiting' | 'served';
}

export const activeOrders: Order[] = [
  { id: 'F0027', tableNumber: '03', items: 8, time: '2 mins ago', status: 'kitchen' },
  { id: 'F0028', tableNumber: '07', items: 3, time: 'Just Now', status: 'waiting' },
  { id: 'F0019', tableNumber: '09', items: 2, time: '25 mins ago', status: 'ready' },
];
