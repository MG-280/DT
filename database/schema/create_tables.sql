-- =============================================================================
-- Supply Chain Digital Twin — PostgreSQL Schema
-- All tables are prefixed with dt_
-- Load order: Dimensions → Bridges → Facts
--
-- NOTE: All IDs are VARCHAR(50) to match source data (e.g. "PART_001",
--       "2025-W02"). dt_dim_date uses day_id as PK (source file: dim_day.xlsx).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DIMENSION TABLES
-- -----------------------------------------------------------------------------

-- Stores distinct parts used across the supply chain
CREATE TABLE IF NOT EXISTS dt_dim_part (
    part_id       VARCHAR(50)  PRIMARY KEY,
    part_name     VARCHAR(255) NOT NULL,
    part_category VARCHAR(100)
);
COMMENT ON TABLE dt_dim_part IS 'Dimension: Individual parts/components used in assemblies and products.';

-- Stores distinct assemblies composed of parts
CREATE TABLE IF NOT EXISTS dt_dim_assembly (
    assembly_id   VARCHAR(50)  PRIMARY KEY,
    assembly_name VARCHAR(255) NOT NULL
);
COMMENT ON TABLE dt_dim_assembly IS 'Dimension: Assemblies that are built from one or more parts.';

-- Stores finished products built from assemblies
CREATE TABLE IF NOT EXISTS dt_dim_product (
    product_id   VARCHAR(50)  PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL
);
COMMENT ON TABLE dt_dim_product IS 'Dimension: Finished products composed of one or more assemblies.';

-- Stores supplier master data
CREATE TABLE IF NOT EXISTS dt_dim_supplier (
    supplier_id   VARCHAR(50)  PRIMARY KEY,
    supplier_name VARCHAR(255) NOT NULL,
    active_flag   BOOLEAN      NOT NULL DEFAULT TRUE,
    supplier_tier VARCHAR(50)
);
COMMENT ON TABLE dt_dim_supplier IS 'Dimension: Suppliers providing parts; includes tier classification and active status.';

-- Stores geographic or logical locations (loaded before factory due to FK)
CREATE TABLE IF NOT EXISTS dt_dim_location (
    location_id VARCHAR(50)  PRIMARY KEY,
    country     VARCHAR(100),
    region      VARCHAR(100),
    state       VARCHAR(100),
    city        VARCHAR(100)
);
COMMENT ON TABLE dt_dim_location IS 'Dimension: Geographic locations (country/region/state/city) in the supply chain network.';

-- Stores manufacturing factory locations
CREATE TABLE IF NOT EXISTS dt_dim_factory (
    factory_id   VARCHAR(50)  PRIMARY KEY,
    factory_name VARCHAR(255) NOT NULL,
    location_id  VARCHAR(50)  REFERENCES dt_dim_location(location_id)
);
COMMENT ON TABLE dt_dim_factory IS 'Dimension: Manufacturing factories where parts are consumed and products are built.';

-- Stores ISO week calendar entries (supports both actual and forecast weeks)
CREATE TABLE IF NOT EXISTS dt_dim_week (
    week_id         VARCHAR(50) PRIMARY KEY,
    week_start_date DATE        NOT NULL,
    week_end_date   DATE        NOT NULL,
    year            INTEGER     NOT NULL,
    week_number     INTEGER     NOT NULL,
    month           INTEGER     NOT NULL,
    quarter         INTEGER     NOT NULL,
    week_index      INTEGER     NOT NULL,
    is_forecast     BOOLEAN     NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_dim_week IS 'Dimension: ISO week calendar grain; flags historical vs. forecast weeks.';

-- Stores individual calendar dates, linked to their parent week
-- Source file: dim_day.xlsx  |  PK column: day_id
CREATE TABLE IF NOT EXISTS dt_dim_date (
    day_id           VARCHAR(50) PRIMARY KEY,
    full_date        DATE        NOT NULL UNIQUE,
    week_id          VARCHAR(50) NOT NULL REFERENCES dt_dim_week(week_id),
    day_of_week_num  INTEGER,
    day_of_week_name VARCHAR(20),
    year             INTEGER     NOT NULL,
    month            INTEGER     NOT NULL,
    quarter          INTEGER     NOT NULL,
    is_forecast      BOOLEAN     NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_dim_date IS 'Dimension: Daily calendar grain; each date is linked to its parent ISO week.';

-- -----------------------------------------------------------------------------
-- BRIDGE TABLES  (many-to-many relationships)
-- -----------------------------------------------------------------------------

-- Maps parts to the assemblies they belong to
CREATE TABLE IF NOT EXISTS dt_bridge_part_assembly (
    part_id     VARCHAR(50) NOT NULL REFERENCES dt_dim_part(part_id),
    assembly_id VARCHAR(50) NOT NULL REFERENCES dt_dim_assembly(assembly_id),
    PRIMARY KEY (part_id, assembly_id)
);
COMMENT ON TABLE dt_bridge_part_assembly IS 'Bridge: Many-to-many relationship between parts and assemblies.';

-- Maps assemblies to the finished products they contribute to
CREATE TABLE IF NOT EXISTS dt_bridge_assembly_product (
    assembly_id VARCHAR(50) NOT NULL REFERENCES dt_dim_assembly(assembly_id),
    product_id  VARCHAR(50) NOT NULL REFERENCES dt_dim_product(product_id),
    PRIMARY KEY (assembly_id, product_id)
);
COMMENT ON TABLE dt_bridge_assembly_product IS 'Bridge: Many-to-many relationship between assemblies and finished products.';

-- Maps parts to their approved suppliers; includes primary-supplier flag
CREATE TABLE IF NOT EXISTS dt_bridge_part_supplier (
    part_id            VARCHAR(50) NOT NULL REFERENCES dt_dim_part(part_id),
    supplier_id        VARCHAR(50) NOT NULL REFERENCES dt_dim_supplier(supplier_id),
    is_primary_supplier BOOLEAN    NOT NULL DEFAULT FALSE,
    PRIMARY KEY (part_id, supplier_id)
);
COMMENT ON TABLE dt_bridge_part_supplier IS 'Bridge: Many-to-many relationship between parts and their approved suppliers; flags the primary supplier.';

-- -----------------------------------------------------------------------------
-- FACT TABLES — Weekly grain
-- -----------------------------------------------------------------------------

-- Weekly material requirements per part / supplier / factory
CREATE TABLE IF NOT EXISTS dt_fact_requirements (
    part_id         VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    supplier_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_supplier(supplier_id),
    factory_id      VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    week_id         VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    requirement_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast     BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_requirements IS 'Fact (weekly): Material requirements quantity per part, supplier, and factory.';

-- Weekly EDI order quantities per part / supplier / factory
CREATE TABLE IF NOT EXISTS dt_fact_edi_orders (
    part_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    supplier_id VARCHAR(50)    NOT NULL REFERENCES dt_dim_supplier(supplier_id),
    factory_id  VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    week_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    edi_qty     NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_edi_orders IS 'Fact (weekly): Electronic Data Interchange order quantities per part, supplier, and factory.';

-- Weekly inventory snapshot per part / factory
CREATE TABLE IF NOT EXISTS dt_fact_inventory (
    part_id       VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    factory_id    VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    week_id       VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    inventory_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast   BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_inventory IS 'Fact (weekly): Inventory on-hand snapshot per part and factory.';

-- -----------------------------------------------------------------------------
-- FACT TABLES — Daily grain
-- -----------------------------------------------------------------------------

-- Daily material requirements per part / supplier / factory
CREATE TABLE IF NOT EXISTS dt_fact_requirements_daily (
    part_id         VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    supplier_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_supplier(supplier_id),
    factory_id      VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    day_id          VARCHAR(50)    NOT NULL REFERENCES dt_dim_date(day_id),
    week_id         VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    requirement_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast     BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_requirements_daily IS 'Fact (daily): Daily material requirements per part, supplier, and factory.';

-- Daily EDI order quantities per part / supplier / factory
CREATE TABLE IF NOT EXISTS dt_fact_edi_orders_daily (
    part_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    supplier_id VARCHAR(50)    NOT NULL REFERENCES dt_dim_supplier(supplier_id),
    factory_id  VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    day_id      VARCHAR(50)    NOT NULL REFERENCES dt_dim_date(day_id),
    week_id     VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    edi_qty     NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_edi_orders_daily IS 'Fact (daily): Daily EDI order quantities per part, supplier, and factory.';

-- Daily inventory snapshot per part / factory
CREATE TABLE IF NOT EXISTS dt_fact_inventory_daily (
    part_id       VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    factory_id    VARCHAR(50)    NOT NULL REFERENCES dt_dim_factory(factory_id),
    day_id        VARCHAR(50)    NOT NULL REFERENCES dt_dim_date(day_id),
    week_id       VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    inventory_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    is_forecast   BOOLEAN        NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE dt_fact_inventory_daily IS 'Fact (daily): Daily inventory on-hand snapshot per part and factory.';

-- Anomaly detection results per part / week
CREATE TABLE IF NOT EXISTS dt_fact_anomalies (
    part_id        VARCHAR(50)    NOT NULL REFERENCES dt_dim_part(part_id),
    week_id        VARCHAR(50)    NOT NULL REFERENCES dt_dim_week(week_id),
    metric_type    VARCHAR(100)   NOT NULL,
    expected_value NUMERIC(18, 4),
    actual_value   NUMERIC(18, 4),
    anomaly_flag   BOOLEAN        NOT NULL DEFAULT FALSE,
    reason_code    VARCHAR(100)
);
COMMENT ON TABLE dt_fact_anomalies IS 'Fact: Detected anomalies in supply chain metrics; stores expected vs actual values and reason codes.';

-- =============================================================================
-- INDEXES
-- Covering all FK columns and is_forecast flags for query performance
-- =============================================================================

-- dt_dim_date
CREATE INDEX IF NOT EXISTS idx_dim_date_week_id       ON dt_dim_date(week_id);
CREATE INDEX IF NOT EXISTS idx_dim_date_is_forecast    ON dt_dim_date(is_forecast);

-- dt_dim_week
CREATE INDEX IF NOT EXISTS idx_dim_week_is_forecast    ON dt_dim_week(is_forecast);

-- dt_dim_factory
CREATE INDEX IF NOT EXISTS idx_dim_factory_location_id ON dt_dim_factory(location_id);

-- dt_bridge_part_assembly
CREATE INDEX IF NOT EXISTS idx_bpa_part_id             ON dt_bridge_part_assembly(part_id);
CREATE INDEX IF NOT EXISTS idx_bpa_assembly_id         ON dt_bridge_part_assembly(assembly_id);

-- dt_bridge_assembly_product
CREATE INDEX IF NOT EXISTS idx_bap_assembly_id         ON dt_bridge_assembly_product(assembly_id);
CREATE INDEX IF NOT EXISTS idx_bap_product_id          ON dt_bridge_assembly_product(product_id);

-- dt_bridge_part_supplier
CREATE INDEX IF NOT EXISTS idx_bps_part_id             ON dt_bridge_part_supplier(part_id);
CREATE INDEX IF NOT EXISTS idx_bps_supplier_id         ON dt_bridge_part_supplier(supplier_id);

-- dt_fact_requirements
CREATE INDEX IF NOT EXISTS idx_freq_part_id            ON dt_fact_requirements(part_id);
CREATE INDEX IF NOT EXISTS idx_freq_supplier_id        ON dt_fact_requirements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_freq_factory_id         ON dt_fact_requirements(factory_id);
CREATE INDEX IF NOT EXISTS idx_freq_week_id            ON dt_fact_requirements(week_id);
CREATE INDEX IF NOT EXISTS idx_freq_is_forecast        ON dt_fact_requirements(is_forecast);

-- dt_fact_edi_orders
CREATE INDEX IF NOT EXISTS idx_fedi_part_id            ON dt_fact_edi_orders(part_id);
CREATE INDEX IF NOT EXISTS idx_fedi_supplier_id        ON dt_fact_edi_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fedi_factory_id         ON dt_fact_edi_orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_fedi_week_id            ON dt_fact_edi_orders(week_id);
CREATE INDEX IF NOT EXISTS idx_fedi_is_forecast        ON dt_fact_edi_orders(is_forecast);

-- dt_fact_inventory
CREATE INDEX IF NOT EXISTS idx_finv_part_id            ON dt_fact_inventory(part_id);
CREATE INDEX IF NOT EXISTS idx_finv_factory_id         ON dt_fact_inventory(factory_id);
CREATE INDEX IF NOT EXISTS idx_finv_week_id            ON dt_fact_inventory(week_id);
CREATE INDEX IF NOT EXISTS idx_finv_is_forecast        ON dt_fact_inventory(is_forecast);

-- dt_fact_requirements_daily
CREATE INDEX IF NOT EXISTS idx_freqd_part_id           ON dt_fact_requirements_daily(part_id);
CREATE INDEX IF NOT EXISTS idx_freqd_supplier_id       ON dt_fact_requirements_daily(supplier_id);
CREATE INDEX IF NOT EXISTS idx_freqd_factory_id        ON dt_fact_requirements_daily(factory_id);
CREATE INDEX IF NOT EXISTS idx_freqd_day_id            ON dt_fact_requirements_daily(day_id);
CREATE INDEX IF NOT EXISTS idx_freqd_week_id           ON dt_fact_requirements_daily(week_id);
CREATE INDEX IF NOT EXISTS idx_freqd_is_forecast       ON dt_fact_requirements_daily(is_forecast);

-- dt_fact_edi_orders_daily
CREATE INDEX IF NOT EXISTS idx_fedid_part_id           ON dt_fact_edi_orders_daily(part_id);
CREATE INDEX IF NOT EXISTS idx_fedid_supplier_id       ON dt_fact_edi_orders_daily(supplier_id);
CREATE INDEX IF NOT EXISTS idx_fedid_factory_id        ON dt_fact_edi_orders_daily(factory_id);
CREATE INDEX IF NOT EXISTS idx_fedid_day_id            ON dt_fact_edi_orders_daily(day_id);
CREATE INDEX IF NOT EXISTS idx_fedid_week_id           ON dt_fact_edi_orders_daily(week_id);
CREATE INDEX IF NOT EXISTS idx_fedid_is_forecast       ON dt_fact_edi_orders_daily(is_forecast);

-- dt_fact_inventory_daily
CREATE INDEX IF NOT EXISTS idx_finvd_part_id           ON dt_fact_inventory_daily(part_id);
CREATE INDEX IF NOT EXISTS idx_finvd_factory_id        ON dt_fact_inventory_daily(factory_id);
CREATE INDEX IF NOT EXISTS idx_finvd_day_id            ON dt_fact_inventory_daily(day_id);
CREATE INDEX IF NOT EXISTS idx_finvd_week_id           ON dt_fact_inventory_daily(week_id);
CREATE INDEX IF NOT EXISTS idx_finvd_is_forecast       ON dt_fact_inventory_daily(is_forecast);

-- dt_fact_anomalies
CREATE INDEX IF NOT EXISTS idx_fanom_part_id           ON dt_fact_anomalies(part_id);
CREATE INDEX IF NOT EXISTS idx_fanom_week_id           ON dt_fact_anomalies(week_id);
CREATE INDEX IF NOT EXISTS idx_fanom_anomaly_flag      ON dt_fact_anomalies(anomaly_flag);
