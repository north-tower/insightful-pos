// ─── Shared business types ───────────────────────────────────────────────────
// Extracted to avoid circular dependency between AuthContext ↔ BusinessModeContext

export type BusinessMode = 'restaurant' | 'retail';

export interface BusinessConfig {
  mode: BusinessMode;
  label: string;
  description: string;
  icon: string; // emoji
  terminology: {
    item: string;         // "Dish" vs "Product"
    items: string;        // "Menu" vs "Products"
    order: string;        // "Ticket" vs "Sale"
    orders: string;       // "Tickets" vs "Sales"
    customer: string;     // "Guest" vs "Customer"
    customers: string;    // "Covers" vs "Customers"
    checkout: string;     // "Fire" vs "Complete Sale"
    workplace: string;    // "Table" vs "Counter"
  };
}

export const BUSINESS_CONFIGS: Record<BusinessMode, BusinessConfig> = {
  restaurant: {
    mode: 'restaurant',
    label: 'Restaurant',
    description: 'Full-service restaurant, café, bar, or food truck',
    icon: '🍽️',
    terminology: {
      item: 'Dish',
      items: 'Menu',
      order: 'Ticket',
      orders: 'Tickets',
      customer: 'Guest',
      customers: 'Covers',
      checkout: 'Fire',
      workplace: 'Table',
    },
  },
  retail: {
    mode: 'retail',
    label: 'Retail Shop',
    description: 'General store, boutique, electronics, or any product-based business',
    icon: '🏪',
    terminology: {
      item: 'Product',
      items: 'Products',
      order: 'Sale',
      orders: 'Sales',
      customer: 'Customer',
      customers: 'Customers',
      checkout: 'Complete Sale',
      workplace: 'Counter',
    },
  },
};
