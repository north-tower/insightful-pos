/**
 * Central company configuration.
 *
 * Change the values below to customise the company name, tagline,
 * and default business details that appear throughout the app
 * (sidebar, login page, receipts, customer-facing order page, etc.).
 */

export const COMPANY = {
  /** Short name shown in the sidebar and page titles */
  name: 'Nexus',

  /** Full business / trading name shown on receipts and the customer order page */
  fullName: 'Nexus Restaurant',

  /** Tagline shown in the login page footer */
  tagline: 'Restaurant & Retail Point of Sale',

  /** Default business details printed on receipts.
   *  You can still override these from a future Settings page. */
  address: '123 Main Street',
  city: 'New York, NY 10001',
  phone: '(555) 123-4567',
  email: 'info@nexusrestaurant.com',
  website: 'www.nexusrestaurant.com',
  taxId: 'TAX-123456',
} as const;
