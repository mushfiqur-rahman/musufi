-- Structured delivery address (division → district → upazila/thana → union/post office).
-- `orders.address` keeps the full human-readable line for couriers and emails;
-- these columns keep the chosen ids for filtering and reports.
ALTER TABLE orders
  ADD COLUMN division_id SMALLINT UNSIGNED NULL AFTER address,
  ADD COLUMN district_id SMALLINT UNSIGNED NULL AFTER division_id,
  ADD COLUMN upazila_id  SMALLINT UNSIGNED NULL AFTER district_id,   -- city thanas use ids ≥ 9000
  ADD COLUMN local_id    INT UNSIGNED NULL AFTER upazila_id,          -- union id, or post-office index for city thanas
  ADD COLUMN address_line VARCHAR(200) NULL AFTER local_id,           -- village/area, road, house
  ADD KEY ix_orders_district (district_id);

-- Remembered for the next order.
ALTER TABLE customers
  ADD COLUMN address_parts JSON NULL AFTER address;
