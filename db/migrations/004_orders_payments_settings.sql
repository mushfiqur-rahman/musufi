-- Phase 2: payment and shipping details on orders; settings can hold JSON.

ALTER TABLE orders
  ADD COLUMN payment_method ENUM('cod','bkash','nagad') NOT NULL DEFAULT 'cod' AFTER cost_total,
  ADD COLUMN payment_status ENUM('unpaid','paid','refunded','partial_refund') NOT NULL DEFAULT 'unpaid' AFTER payment_method,
  ADD COLUMN paid_amount    INT UNSIGNED NULL AFTER payment_status,      -- taka actually received
  ADD COLUMN refund_amount  INT UNSIGNED NULL AFTER paid_amount,
  ADD COLUMN payment_ref    VARCHAR(60) NULL AFTER refund_amount,        -- bKash/Nagad transaction id
  ADD COLUMN courier        VARCHAR(40) NULL AFTER payment_ref,
  ADD COLUMN tracking_no    VARCHAR(60) NULL AFTER courier,
  ADD COLUMN shipped_email_at DATETIME NULL AFTER tracking_no,          -- shipping email sent (once)
  ADD KEY ix_orders_created (created_at),
  ADD KEY ix_orders_payment (payment_status);

-- Settings values become larger (JSON for delivery zones, payments, store details).
ALTER TABLE settings MODIFY value TEXT NOT NULL;
