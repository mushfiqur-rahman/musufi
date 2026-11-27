-- Musufi initial schema. All times are stored in UTC.

CREATE TABLE customers (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(254) NOT NULL,
  name          VARCHAR(80)  NULL,
  phone         VARCHAR(11)  NULL,
  address       VARCHAR(300) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  UNIQUE KEY uq_customers_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One-time login codes sent by email. Only an HMAC of the code is stored.
CREATE TABLE login_codes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(254) NOT NULL,
  code_hash  CHAR(64)     NOT NULL,
  ip         VARCHAR(45)  NULL,
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_login_codes_email (email, created_at),
  KEY ix_login_codes_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Login sessions. The cookie holds a random token; only its SHA-256 is stored.
CREATE TABLE sessions (
  token_hash  CHAR(64) PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent  VARCHAR(200) NULL,
  KEY ix_sessions_customer (customer_id),
  CONSTRAINT fk_sessions_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no      VARCHAR(20) NOT NULL,
  customer_id   INT UNSIGNED NOT NULL,
  status        ENUM('new','confirmed','shipped','delivered','returned','cancelled') NOT NULL DEFAULT 'new',
  name          VARCHAR(80)  NOT NULL,
  phone         VARCHAR(11)  NOT NULL,
  address       VARCHAR(300) NOT NULL,
  zone          ENUM('dhaka','outside') NOT NULL,
  subtotal      INT UNSIGNED NOT NULL,          -- taka, items only
  delivery_fee  INT UNSIGNED NOT NULL,          -- taka charged to the customer
  total         INT UNSIGNED NOT NULL,          -- subtotal + delivery_fee
  cost_total    INT UNSIGNED NULL,              -- cost of goods at order time, NULL if costs not set
  note          VARCHAR(500) NULL,              -- owner's note
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  shipped_at    DATETIME NULL,
  delivered_at  DATETIME NULL,
  returned_at   DATETIME NULL,
  cancelled_at  DATETIME NULL,
  UNIQUE KEY uq_orders_no (order_no),
  KEY ix_orders_status (status, created_at),
  KEY ix_orders_phone (phone),
  KEY ix_orders_customer (customer_id),
  KEY ix_orders_delivered (delivered_at),
  KEY ix_orders_returned (returned_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id      INT UNSIGNED NOT NULL,
  product_slug  VARCHAR(60)  NOT NULL,
  product_name  VARCHAR(120) NOT NULL,
  variant_index TINYINT UNSIGNED NOT NULL,
  variant_label VARCHAR(80)  NOT NULL,
  unit_price    INT UNSIGNED NOT NULL,
  unit_cost     INT UNSIGNED NULL,
  qty           SMALLINT UNSIGNED NOT NULL,
  KEY ix_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every status change, who made it and why.
CREATE TABLE order_events (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  status     VARCHAR(20)  NOT NULL,
  note       VARCHAR(500) NULL,
  by_email   VARCHAR(254) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_events_order (order_id),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- What one unit of each product size costs the owner.
CREATE TABLE product_costs (
  product_slug  VARCHAR(60) NOT NULL,
  variant_index TINYINT UNSIGNED NOT NULL,
  unit_cost     INT UNSIGNED NOT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_slug, variant_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  spent_on   DATE NOT NULL,                     -- Dhaka date
  category   VARCHAR(40)  NOT NULL,
  amount     INT UNSIGNED NOT NULL,
  note       VARCHAR(200) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_expenses_date (spent_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Simple key/value settings, e.g. what the courier charges per parcel.
CREATE TABLE settings (
  name       VARCHAR(40) PRIMARY KEY,
  value      VARCHAR(200) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (name, value) VALUES
  ('courier_cost_dhaka', '60'),
  ('courier_cost_outside', '120'),
  ('packing_cost', '0');
