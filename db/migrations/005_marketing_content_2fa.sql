-- Phase 3: coupons, reviews, content pages, staff two-factor login.

CREATE TABLE coupons (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL,                 -- stored upper-case
  type          ENUM('percent','fixed','free_shipping') NOT NULL,
  value         INT UNSIGNED NOT NULL DEFAULT 0,       -- percent (1–90) or taka
  min_subtotal  INT UNSIGNED NOT NULL DEFAULT 0,
  max_discount  INT UNSIGNED NULL,                     -- cap for percent coupons
  starts_at     DATETIME NULL,
  ends_at       DATETIME NULL,
  usage_limit   INT UNSIGNED NULL,                     -- total uses; NULL = unlimited
  per_customer  INT UNSIGNED NOT NULL DEFAULT 1,
  used_count    INT UNSIGNED NOT NULL DEFAULT 0,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  note          VARCHAR(200) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN coupon_code VARCHAR(30) NULL AFTER delivery_fee,
  ADD COLUMN discount    INT UNSIGNED NOT NULL DEFAULT 0 AFTER coupon_code,
  ADD KEY ix_orders_coupon (coupon_code);

-- Reviews from verified buyers (a delivered order containing the product).
CREATE TABLE reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  order_id    INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,             -- 1–5
  body        VARCHAR(1000) NOT NULL,
  display_name VARCHAR(60) NOT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reply       VARCHAR(1000) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moderated_at DATETIME NULL,
  UNIQUE KEY uq_reviews_once (customer_id, product_id, order_id),
  KEY ix_reviews_product (product_id, status),
  KEY ix_reviews_status (status, created_at),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Content pages (About, policies…). Body uses a small, safe markup (see lib/markup.ts).
CREATE TABLE pages (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(60)  NOT NULL,
  title            VARCHAR(120) NOT NULL,
  body             MEDIUMTEXT   NOT NULL,
  meta_description VARCHAR(170) NULL,
  status           ENUM('draft','published') NOT NULL DEFAULT 'draft',
  in_footer        TINYINT(1) NOT NULL DEFAULT 1,
  sort             SMALLINT NOT NULL DEFAULT 0,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pages_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staff two-factor login (TOTP authenticator apps). Secret is encrypted at rest.
ALTER TABLE customers
  ADD COLUMN totp_secret   VARCHAR(200) NULL AFTER notes,
  ADD COLUMN totp_enabled_at DATETIME NULL AFTER totp_secret,
  ADD COLUMN totp_last_step BIGINT NULL AFTER totp_enabled_at;   -- blocks code reuse

ALTER TABLE sessions
  ADD COLUMN mfa_at DATETIME NULL AFTER expires_at;                -- when this session passed 2FA
