-- Phase 1 of the admin dashboard: staff roles, audit log, and the product
-- catalogue moved from code into the database. All times are UTC.

-- Staff roles live on the customer row: NULL = ordinary customer.
-- Owners listed in ADMIN_EMAILS are always treated as 'owner', even if this is NULL.
ALTER TABLE customers
  ADD COLUMN role ENUM('owner','manager','order_staff','content_editor') NULL AFTER address,
  ADD COLUMN blocked_at DATETIME NULL AFTER role,
  ADD COLUMN notes VARCHAR(1000) NULL AFTER blocked_at,
  ADD KEY ix_customers_role (role);

-- Who changed what, and when. Written by lib/audit.ts.
CREATE TABLE audit_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT UNSIGNED NULL,
  actor_email VARCHAR(254) NULL,
  action      VARCHAR(60)  NOT NULL,          -- e.g. product.update, order.status
  entity      VARCHAR(40)  NOT NULL,          -- e.g. product, order, staff
  entity_id   VARCHAR(60)  NULL,
  details     JSON NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_created (created_at),
  KEY ix_audit_entity (entity, entity_id),
  KEY ix_audit_actor (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(60)  NOT NULL,
  label        VARCHAR(80)  NOT NULL,
  blurb        VARCHAR(160) NOT NULL DEFAULT '',
  intro        TEXT NULL,                     -- answer-first paragraph (GEO)
  facts_title  VARCHAR(60)  NOT NULL DEFAULT 'পণ্যের তথ্য',
  zones        JSON NOT NULL,                 -- e.g. ["dhaka","outside"]
  policy       VARCHAR(200) NOT NULL DEFAULT '',
  faq          JSON NOT NULL,                 -- [{q,a}]
  art          VARCHAR(20)  NULL,             -- illustration until a photo exists
  sort         SMALLINT NOT NULL DEFAULT 0,
  status       ENUM('active','hidden') NOT NULL DEFAULT 'active',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(80)  NOT NULL,
  name             VARCHAR(120) NOT NULL,
  short            VARCHAR(160) NOT NULL DEFAULT '',
  category_id      INT UNSIGNED NOT NULL,
  badge            VARCHAR(40)  NULL,
  summary          TEXT NULL,                 -- "এক কথায়" answer
  origin           VARCHAR(120) NOT NULL DEFAULT '',
  facts            JSON NOT NULL,             -- [{label,value}]
  sections         JSON NOT NULL,             -- [{q,a}]
  faq              JSON NOT NULL,             -- [{q,a}]
  taste            JSON NULL,                 -- food only
  related          JSON NOT NULL,             -- [slug]
  art              VARCHAR(20)  NULL,
  status           ENUM('draft','published','hidden') NOT NULL DEFAULT 'draft',
  publish_at       DATETIME NULL,             -- scheduled: published, visible from this time
  meta_title       VARCHAR(70)  NULL,
  meta_description VARCHAR(170) NULL,
  default_variant  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sort             SMALLINT NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_slug (slug),
  KEY ix_products_category (category_id),
  KEY ix_products_status (status, publish_at),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sizes / options. Each has its own price, cost and (optional) stock.
CREATE TABLE product_variants (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  label      VARCHAR(80)  NOT NULL,
  price      INT UNSIGNED NOT NULL,
  compare_at INT UNSIGNED NULL,               -- old price, only for a real discount
  cost       INT UNSIGNED NULL,               -- owner's cost per unit
  sku        VARCHAR(40)  NULL,
  stock      INT NULL,                        -- NULL = not tracked
  low_stock  INT UNSIGNED NOT NULL DEFAULT 5,
  sort       SMALLINT NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  KEY ix_variants_product (product_id, sort),
  UNIQUE KEY uq_variants_sku (sku),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product photos, stored in the database so a redeploy never deletes them.
-- Resized in the browser before upload (max ~1600px, WebP/JPEG).
CREATE TABLE product_images (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  mime       VARCHAR(20)  NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  bytes      INT UNSIGNED NOT NULL,
  width      SMALLINT UNSIGNED NOT NULL,
  height     SMALLINT UNSIGNED NOT NULL,
  alt        VARCHAR(160) NOT NULL DEFAULT '',
  caption    VARCHAR(60)  NOT NULL DEFAULT '',
  sort       SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_images_product (product_id, sort),
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders now point at the exact variant (old rows keep slug + index).
ALTER TABLE order_items
  ADD COLUMN variant_id INT UNSIGNED NULL AFTER variant_index,
  ADD KEY ix_items_variant (variant_id);
