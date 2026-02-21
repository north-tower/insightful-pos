-- ─── Product Images Storage Bucket ────────────────────────────────────────────
-- Creates a public storage bucket for product images.
-- Images are accessible publicly (for display) but only authenticated
-- admin/manager users can upload, update, or delete.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view product images (bucket is public)
CREATE POLICY "Public read access for product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated admin/manager can upload images
CREATE POLICY "Admin/Manager can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Authenticated admin/manager can update images
CREATE POLICY "Admin/Manager can update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Authenticated admin/manager can delete images
CREATE POLICY "Admin/Manager can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
