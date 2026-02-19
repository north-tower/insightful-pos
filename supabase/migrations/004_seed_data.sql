-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA — Restaurant menu + Retail products
-- Run this after 003_create_products.sql
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── Restaurant Categories ───────────────────────────────────────────────────

insert into public.categories (id, name, icon, business_mode, sort_order) values
  ('a0000000-0000-0000-0000-000000000001', 'Special',    '⭐', 'restaurant', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Breakfast',  '🍳', 'restaurant', 2),
  ('a0000000-0000-0000-0000-000000000003', 'Soups',      '🍜', 'restaurant', 3),
  ('a0000000-0000-0000-0000-000000000004', 'Pasta',      '🍝', 'restaurant', 4),
  ('a0000000-0000-0000-0000-000000000005', 'Desserts',   '🍰', 'restaurant', 5),
  ('a0000000-0000-0000-0000-000000000006', 'Salads',     '🥗', 'restaurant', 6),
  ('a0000000-0000-0000-0000-000000000007', 'Chicken',    '🍗', 'restaurant', 7),
  ('a0000000-0000-0000-0000-000000000008', 'Beverages',  '🥤', 'restaurant', 8),
  ('a0000000-0000-0000-0000-000000000009', 'Seafood',    '🦐', 'restaurant', 9),
  ('a0000000-0000-0000-0000-000000000010', 'Burgers',    '🍔', 'restaurant', 10);


-- ─── Restaurant Menu Items ───────────────────────────────────────────────────

insert into public.products (name, description, price, category_id, image_url, business_mode, is_veg, prep_time_mins) values
  -- Specials
  ('Grilled Salmon Steak',
   'Fresh Atlantic salmon fillet, herb-crusted and grilled to perfection, served with seasonal vegetables',
   15.00, 'a0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&h=200&fit=crop',
   'restaurant', false, 18),

  ('Beef Steak',
   'Prime-cut 300g ribeye, charcoal-grilled to your preference, served with garlic mash and red wine jus',
   30.00, 'a0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=200&fit=crop',
   'restaurant', false, 22),

  ('Shrimp Rice Bowl',
   'Sautéed tiger prawns on a bed of jasmine rice with teriyaki glaze and pickled vegetables',
   6.00, 'a0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  ('Lamb Rack with Herbs',
   'New Zealand lamb rack with rosemary crust, roasted root vegetables and mint sauce',
   28.00, 'a0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1514516345957-556ca7d90a29?w=300&h=200&fit=crop',
   'restaurant', false, 25),

  -- Breakfast
  ('Eggs Benedict',
   'Poached eggs on toasted English muffin with smoked ham and hollandaise sauce',
   11.00, 'a0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1608039829572-f0ad4c04de3c?w=300&h=200&fit=crop',
   'restaurant', false, 10),

  ('Avocado Toast',
   'Smashed avocado on sourdough with cherry tomatoes, feta, and a poached egg',
   9.50, 'a0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=300&h=200&fit=crop',
   'restaurant', true, 8),

  ('Full English Breakfast',
   'Two eggs, bacon, sausages, beans, grilled tomato, mushrooms, and toast',
   14.00, 'a0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=300&h=200&fit=crop',
   'restaurant', false, 15),

  ('Pancake Stack',
   'Fluffy buttermilk pancakes with maple syrup, fresh berries, and whipped cream',
   10.00, 'a0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop',
   'restaurant', true, 10),

  -- Soups
  ('Tom Yum Soup',
   'Classic Thai hot-and-sour soup with prawns, lemongrass, galangal, and lime leaves',
   7.50, 'a0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  ('Cream of Mushroom Soup',
   'Velvety wild mushroom soup finished with truffle oil and croutons',
   6.50, 'a0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
   'restaurant', true, 10),

  ('French Onion Soup',
   'Slow-cooked caramelised onion broth topped with Gruyère crouton',
   8.00, 'a0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=300&h=200&fit=crop',
   'restaurant', true, 15),

  -- Pasta
  ('Pasta with Roast Beef',
   'Fresh pappardelle with slow-braised beef ragù and parmesan shavings',
   10.00, 'a0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&h=200&fit=crop',
   'restaurant', false, 14),

  ('Spaghetti Carbonara',
   'Classic Roman carbonara with guanciale, pecorino, egg yolk, and black pepper',
   12.00, 'a0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  ('Penne Arrabbiata',
   'Penne in a spicy tomato sauce with garlic, chilli flakes, and fresh basil',
   9.00, 'a0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=300&h=200&fit=crop',
   'restaurant', true, 10),

  ('Mushroom Risotto',
   'Arborio rice cooked with porcini and shiitake mushrooms, finished with butter and parmesan',
   13.00, 'a0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=300&h=200&fit=crop',
   'restaurant', true, 20),

  -- Desserts
  ('Apple Stuffed Pancake',
   'Cinnamon-spiced apple compote layered between fluffy pancakes with vanilla ice cream',
   35.00, 'a0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=200&fit=crop',
   'restaurant', true, 12),

  ('Chocolate Lava Cake',
   'Warm dark chocolate fondant with a molten centre, served with vanilla bean ice cream',
   9.00, 'a0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=300&h=200&fit=crop',
   'restaurant', true, 15),

  ('Tiramisu',
   'Classic Italian layered dessert with mascarpone cream, espresso, and cocoa',
   8.50, 'a0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=300&h=200&fit=crop',
   'restaurant', true, 5),

  ('Crème Brûlée',
   'Rich vanilla custard with a caramelised sugar crust',
   7.50, 'a0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=300&h=200&fit=crop',
   'restaurant', true, 8),

  -- Salads
  ('Tofu Poke Bowl',
   'Marinated tofu with edamame, avocado, pickled ginger, and sesame rice',
   7.00, 'a0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop',
   'restaurant', true, 8),

  ('Vegetable Shrimp Salad',
   'Grilled shrimp on mixed greens with cherry tomatoes, cucumber, and citrus vinaigrette',
   10.00, 'a0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&h=200&fit=crop',
   'restaurant', false, 10),

  ('Caesar Salad',
   'Crisp romaine lettuce with house-made Caesar dressing, croutons, and parmesan',
   8.50, 'a0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=300&h=200&fit=crop',
   'restaurant', true, 5),

  ('Greek Salad',
   'Tomato, cucumber, red onion, olives, and feta cheese with oregano dressing',
   8.00, 'a0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&h=200&fit=crop',
   'restaurant', true, 5),

  -- Chicken
  ('Chicken Quinoa & Herbs',
   'Herb-crusted chicken breast on a bed of quinoa with roasted Mediterranean vegetables',
   12.00, 'a0000000-0000-0000-0000-000000000007',
   'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=300&h=200&fit=crop',
   'restaurant', false, 15),

  ('Chicken Tikka Masala',
   'Tandoori-marinated chicken in a creamy tomato-spiced curry, served with basmati rice and naan',
   13.50, 'a0000000-0000-0000-0000-000000000007',
   'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&h=200&fit=crop',
   'restaurant', false, 18),

  ('Grilled Chicken Wings',
   'Smoky chargrilled wings tossed in your choice of BBQ, buffalo, or honey-garlic sauce',
   10.00, 'a0000000-0000-0000-0000-000000000007',
   'https://images.unsplash.com/photo-1527477396000-e27163b4bdb1?w=300&h=200&fit=crop',
   'restaurant', false, 20),

  -- Beverages
  ('Fresh Orange Juice',
   'Freshly squeezed orange juice, no added sugar',
   4.00, 'a0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=200&fit=crop',
   'restaurant', true, 3),

  ('Cappuccino',
   'Double-shot espresso with steamed milk and silky foam',
   3.50, 'a0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=300&h=200&fit=crop',
   'restaurant', true, 3),

  ('Mango Smoothie',
   'Blended mango, banana, yoghurt, and honey',
   5.50, 'a0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300&h=200&fit=crop',
   'restaurant', true, 4),

  ('Iced Latte',
   'Cold-brewed espresso with milk over ice',
   4.50, 'a0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=200&fit=crop',
   'restaurant', true, 3),

  -- Seafood
  ('Fish & Chips',
   'Beer-battered cod fillet with thick-cut chips, mushy peas, and tartar sauce',
   14.00, 'a0000000-0000-0000-0000-000000000009',
   'https://images.unsplash.com/photo-1579208030886-b1f5b46acb0a?w=300&h=200&fit=crop',
   'restaurant', false, 15),

  ('Garlic Butter Prawns',
   'King prawns sautéed in garlic butter with chilli and parsley, served with crusty bread',
   16.00, 'a0000000-0000-0000-0000-000000000009',
   'https://images.unsplash.com/photo-1625943553852-781c6dd46faa?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  -- Burgers
  ('Classic Beef Burger',
   'Angus beef patty, cheddar, lettuce, tomato, pickles, and house sauce on a brioche bun',
   13.00, 'a0000000-0000-0000-0000-000000000010',
   'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  ('Chicken Burger',
   'Crispy fried chicken thigh with coleslaw, pickles, and spicy mayo',
   12.00, 'a0000000-0000-0000-0000-000000000010',
   'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300&h=200&fit=crop',
   'restaurant', false, 12),

  ('Veggie Burger',
   'Grilled black bean and quinoa patty with avocado, sprouts, and chipotle aioli',
   11.00, 'a0000000-0000-0000-0000-000000000010',
   'https://images.unsplash.com/photo-1520072959219-c595e6cdc033?w=300&h=200&fit=crop',
   'restaurant', true, 12);


-- ─── Retail Categories ───────────────────────────────────────────────────────

insert into public.categories (id, name, icon, business_mode, sort_order) values
  ('b0000000-0000-0000-0000-000000000001', 'Electronics',    '📱', 'retail', 1),
  ('b0000000-0000-0000-0000-000000000002', 'Clothing',       '👕', 'retail', 2),
  ('b0000000-0000-0000-0000-000000000003', 'Home & Living',  '🏠', 'retail', 3),
  ('b0000000-0000-0000-0000-000000000004', 'Beauty & Care',  '💄', 'retail', 4),
  ('b0000000-0000-0000-0000-000000000005', 'Grocery',        '🛒', 'retail', 5),
  ('b0000000-0000-0000-0000-000000000006', 'Accessories',    '⌚', 'retail', 6),
  ('b0000000-0000-0000-0000-000000000007', 'Stationery',     '📝', 'retail', 7),
  ('b0000000-0000-0000-0000-000000000008', 'Sports',         '⚽', 'retail', 8);


-- ─── Retail Products ─────────────────────────────────────────────────────────

insert into public.products
  (name, description, price, cost, category_id, image_url, business_mode, sku, barcode, stock, low_stock_threshold, unit, brand)
values
  -- Electronics
  ('Wireless Bluetooth Earbuds',
   'True wireless earbuds with active noise cancellation and 24hr battery life',
   49.99, 22.00, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1590658268037-6bf12f032f55?w=300&h=200&fit=crop',
   'retail', 'ELC-001', '8901234567890', 45, 10, 'pcs', 'SoundMax'),

  ('USB-C Fast Charger 65W',
   'GaN charger with 3 ports, compatible with laptops, tablets, and phones',
   29.99, 12.50, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&h=200&fit=crop',
   'retail', 'ELC-002', '8901234567891', 78, 15, 'pcs', 'ChargePro'),

  ('Smart Watch Fitness Band',
   'Heart rate, SpO2, sleep tracking, 7-day battery, water resistant to 50m',
   89.99, 38.00, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=200&fit=crop',
   'retail', 'ELC-003', '8901234567892', 23, 10, 'pcs', 'FitGear'),

  ('Portable Bluetooth Speaker',
   'Waterproof portable speaker with 360° sound and 12hr playtime',
   39.99, 16.00, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=200&fit=crop',
   'retail', 'ELC-004', '8901234567901', 0, 8, 'pcs', 'SoundMax'),

  ('Wireless Mouse Ergonomic',
   'Ergonomic vertical mouse with silent clicks and USB-C rechargeable battery',
   24.99, 9.00, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300&h=200&fit=crop',
   'retail', 'ELC-005', '8901234567902', 62, 12, 'pcs', 'TechFlow'),

  ('USB Hub 7-Port',
   'Powered USB 3.0 hub with individual switches and LED indicators',
   18.99, 7.50, 'b0000000-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=300&h=200&fit=crop',
   'retail', 'ELC-006', '8901234567903', 34, 10, 'pcs', 'TechFlow'),

  -- Clothing
  ('Cotton T-Shirt Classic',
   '100% organic cotton, pre-shrunk, available in 4 sizes',
   19.99, 7.00, 'b0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop',
   'retail', 'CLT-001', '8901234567893', 120, 20, 'pcs', 'BasicCo'),

  ('Denim Jeans Slim Fit',
   'Premium stretch denim, slim fit, dark wash',
   54.99, 22.00, 'b0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&h=200&fit=crop',
   'retail', 'CLT-002', '8901234567894', 65, 15, 'pcs', 'DenimWorks'),

  ('Hooded Sweatshirt',
   'Heavyweight fleece hoodie with kangaroo pocket and drawstring hood',
   39.99, 15.00, 'b0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=300&h=200&fit=crop',
   'retail', 'CLT-003', '8901234567904', 48, 12, 'pcs', 'BasicCo'),

  ('Running Shorts',
   'Lightweight, quick-dry fabric with zip pocket and built-in liner',
   22.99, 8.50, 'b0000000-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=300&h=200&fit=crop',
   'retail', 'CLT-004', '8901234567905', 90, 15, 'pcs', 'FitGear'),

  -- Home & Living
  ('Ceramic Coffee Mug Set',
   'Set of 4 handcrafted ceramic mugs, 350ml each, dishwasher safe',
   24.99, 9.50, 'b0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=300&h=200&fit=crop',
   'retail', 'HOM-001', '8901234567895', 34, 8, 'set', null),

  ('Scented Candle Lavender',
   'Hand-poured soy wax candle, 45hr burn time, cotton wick',
   14.99, 4.50, 'b0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1602607633945-c7d67b4c9b24?w=300&h=200&fit=crop',
   'retail', 'HOM-002', '8901234567896', 52, 10, 'pcs', null),

  ('Bamboo Cutting Board Set',
   'Set of 3 bamboo cutting boards with juice grooves, antimicrobial surface',
   19.99, 7.00, 'b0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1594226801341-41427b4e5c22?w=300&h=200&fit=crop',
   'retail', 'HOM-003', '8901234567906', 28, 8, 'set', null),

  ('Throw Pillow Linen',
   'Linen blend cushion cover with hidden zipper, 45x45cm, insert included',
   16.99, 5.50, 'b0000000-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=300&h=200&fit=crop',
   'retail', 'HOM-004', '8901234567907', 40, 10, 'pcs', null),

  -- Beauty & Care
  ('Face Moisturizer SPF30',
   'Lightweight daily moisturizer with SPF30, suitable for all skin types, 50ml',
   18.99, 6.00, 'b0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&h=200&fit=crop',
   'retail', 'BEA-001', '8901234567897', 88, 15, 'pcs', 'GlowUp'),

  ('Vitamin C Serum',
   '20% Vitamin C serum with hyaluronic acid, brightening and anti-aging, 30ml',
   24.99, 8.00, 'b0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&h=200&fit=crop',
   'retail', 'BEA-002', '8901234567908', 55, 12, 'pcs', 'GlowUp'),

  ('Shampoo Argan Oil 500ml',
   'Sulfate-free argan oil shampoo for dry and damaged hair',
   12.99, 4.00, 'b0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&h=200&fit=crop',
   'retail', 'BEA-003', '8901234567909', 70, 15, 'pcs', 'NatureLux'),

  ('Hand Cream Shea Butter',
   'Rich moisturizing hand cream with shea butter and vitamin E, 100ml',
   8.99, 2.50, 'b0000000-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&h=200&fit=crop',
   'retail', 'BEA-004', '8901234567910', 95, 20, 'pcs', 'NatureLux'),

  -- Grocery
  ('Organic Honey 500g',
   'Raw unfiltered organic wildflower honey, locally sourced',
   12.99, 5.50, 'b0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&h=200&fit=crop',
   'retail', 'GRC-001', '8901234567898', 3, 10, 'pcs', null),

  ('Premium Coffee Beans 1kg',
   'Single-origin Ethiopian Yirgacheffe, medium roast, whole bean',
   22.99, 11.00, 'b0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=200&fit=crop',
   'retail', 'GRC-002', '8901234567899', 41, 10, 'pcs', 'BeanCraft'),

  ('Extra Virgin Olive Oil 750ml',
   'Cold-pressed Italian extra virgin olive oil, first harvest',
   15.99, 7.00, 'b0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=200&fit=crop',
   'retail', 'GRC-003', '8901234567911', 30, 8, 'btl', null),

  ('Dark Chocolate Bar 85% 100g',
   'Belgian dark chocolate, 85% cocoa, fair trade certified',
   4.99, 1.80, 'b0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300&h=200&fit=crop',
   'retail', 'GRC-004', '8901234567912', 150, 30, 'pcs', null),

  ('Green Tea Matcha 100g',
   'Ceremonial grade matcha powder from Uji, Kyoto',
   18.99, 8.00, 'b0000000-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=300&h=200&fit=crop',
   'retail', 'GRC-005', '8901234567913', 25, 8, 'pcs', null),

  -- Accessories
  ('Leather Watch Strap',
   'Genuine Italian leather quick-release strap, fits 20/22mm lugs',
   34.99, 12.00, 'b0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=300&h=200&fit=crop',
   'retail', 'ACC-001', '8901234567900', 7, 5, 'pcs', null),

  ('Canvas Tote Bag',
   'Heavy-duty canvas tote with inner pocket and zip closure, 40x35cm',
   15.99, 5.00, 'b0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=300&h=200&fit=crop',
   'retail', 'ACC-002', '8901234567914', 60, 15, 'pcs', null),

  ('Sunglasses UV400 Polarized',
   'Polarized UV400 lens, lightweight acetate frame, unisex',
   29.99, 10.00, 'b0000000-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&h=200&fit=crop',
   'retail', 'ACC-003', '8901234567915', 35, 10, 'pcs', null),

  -- Stationery
  ('Notebook A5 Hardcover',
   'Dotted grid, 192 pages, 100gsm acid-free paper, lay-flat binding',
   9.99, 3.00, 'b0000000-0000-0000-0000-000000000007',
   'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=300&h=200&fit=crop',
   'retail', 'STN-001', '8901234567916', 85, 20, 'pcs', null),

  ('Gel Pen Set 12 Colors',
   'Fine-tip 0.5mm gel pens with quick-dry ink, smudge-proof',
   7.99, 2.50, 'b0000000-0000-0000-0000-000000000007',
   'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=300&h=200&fit=crop',
   'retail', 'STN-002', '8901234567917', 110, 25, 'set', null),

  -- Sports
  ('Yoga Mat 6mm',
   'Non-slip TPE yoga mat with alignment lines and carrying strap, 183x61cm',
   29.99, 11.00, 'b0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=300&h=200&fit=crop',
   'retail', 'SPT-001', '8901234567918', 22, 8, 'pcs', 'FitGear'),

  ('Resistance Bands Set',
   'Set of 5 latex-free resistance bands with door anchor and carry pouch',
   16.99, 5.50, 'b0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=300&h=200&fit=crop',
   'retail', 'SPT-002', '8901234567919', 38, 10, 'set', 'FitGear'),

  ('Water Bottle Stainless 750ml',
   'Double-wall vacuum insulated, keeps drinks cold 24hr / hot 12hr',
   19.99, 6.50, 'b0000000-0000-0000-0000-000000000008',
   'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&h=200&fit=crop',
   'retail', 'SPT-003', '8901234567920', 55, 12, 'pcs', null);


-- ─── Product Variants (for Cotton T-Shirt) ──────────────────────────────────

-- We need the actual product id for the Cotton T-Shirt, so use a subquery
insert into public.product_variants (product_id, name, sku, price, cost, stock)
select p.id, v.name, v.sku, v.price, v.cost, v.stock
from public.products p
cross join (values
  ('S',  'CLT-001-S',  19.99, 7.00, 30),
  ('M',  'CLT-001-M',  19.99, 7.00, 40),
  ('L',  'CLT-001-L',  19.99, 7.00, 35),
  ('XL', 'CLT-001-XL', 21.99, 7.50, 15)
) as v(name, sku, price, cost, stock)
where p.sku = 'CLT-001';

-- Variants for Denim Jeans
insert into public.product_variants (product_id, name, sku, price, cost, stock)
select p.id, v.name, v.sku, v.price, v.cost, v.stock
from public.products p
cross join (values
  ('30',  'CLT-002-30',  54.99, 22.00, 18),
  ('32',  'CLT-002-32',  54.99, 22.00, 22),
  ('34',  'CLT-002-34',  54.99, 22.00, 15),
  ('36',  'CLT-002-36',  54.99, 22.00, 10)
) as v(name, sku, price, cost, stock)
where p.sku = 'CLT-002';

-- Variants for Hooded Sweatshirt
insert into public.product_variants (product_id, name, sku, price, cost, stock)
select p.id, v.name, v.sku, v.price, v.cost, v.stock
from public.products p
cross join (values
  ('S',  'CLT-003-S',  39.99, 15.00, 12),
  ('M',  'CLT-003-M',  39.99, 15.00, 16),
  ('L',  'CLT-003-L',  39.99, 15.00, 12),
  ('XL', 'CLT-003-XL', 42.99, 16.00, 8)
) as v(name, sku, price, cost, stock)
where p.sku = 'CLT-003';
