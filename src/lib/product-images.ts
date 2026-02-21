import { supabase } from '@/lib/supabase';

const BUCKET = 'product-images';

/**
 * Upload a product image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadProductImage(file: File): Promise<string> {
  // Create a unique file name: timestamp-random-original
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .slice(0, 40);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${ext}`;
  const filePath = `products/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Delete a product image from Supabase Storage.
 * Extracts the storage path from a public URL.
 */
export async function deleteProductImage(publicUrl: string): Promise<void> {
  // Only delete if the URL is from our storage bucket
  if (!publicUrl.includes(`/storage/v1/object/public/${BUCKET}/`)) return;

  const parts = publicUrl.split(`/storage/v1/object/public/${BUCKET}/`);
  if (parts.length < 2) return;

  const filePath = decodeURIComponent(parts[1]);
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) {
    console.warn('Failed to delete product image from storage:', error);
  }
}

// ─── Placeholder generation ────────────────────────────────────────────────

/**
 * Deterministic hash from a string → number in [0, range).
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash);
}

/** Beautiful gradient pairs — warm, cool, nature, vibrant, etc. */
const GRADIENT_PAIRS = [
  ['#667eea', '#764ba2'], // purple-indigo
  ['#f093fb', '#f5576c'], // pink-rose
  ['#4facfe', '#00f2fe'], // sky-cyan
  ['#43e97b', '#38f9d7'], // green-teal
  ['#fa709a', '#fee140'], // pink-yellow
  ['#a18cd1', '#fbc2eb'], // lavender-pink
  ['#fccb90', '#d57eeb'], // peach-purple
  ['#e0c3fc', '#8ec5fc'], // lilac-blue
  ['#f5576c', '#ff6f61'], // coral-red
  ['#0250c5', '#d43f8d'], // navy-magenta
  ['#0ba360', '#3cba92'], // emerald duo
  ['#fc5c7d', '#6a82fb'], // sunset-blue
  ['#11998e', '#38ef7d'], // teal-green
  ['#ee0979', '#ff6a00'], // magenta-orange
  ['#7f00ff', '#e100ff'], // violet-fuchsia
  ['#536976', '#292e49'], // slate-dark (muted)
];

/**
 * Get the initials from a product name (max 2 chars).
 */
export function getProductInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Get a deterministic gradient pair for a product name.
 */
export function getProductGradient(name: string): [string, string] {
  const idx = hashCode(name) % GRADIENT_PAIRS.length;
  return GRADIENT_PAIRS[idx] as [string, string];
}

/**
 * Generate an SVG data URL placeholder for a product.
 * Beautiful gradient background + centered initials.
 */
export function generatePlaceholderUrl(name: string, size = 300): string {
  const initials = getProductInitials(name);
  const [colorA, colorB] = getProductGradient(name);
  const fontSize = size * 0.38;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colorA}"/>
      <stop offset="100%" stop-color="${colorB}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)" rx="12"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
        font-family="system-ui,-apple-system,sans-serif" font-weight="700"
        font-size="${fontSize}" fill="rgba(255,255,255,0.9)"
        letter-spacing="2">${initials}</text>
</svg>`.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
