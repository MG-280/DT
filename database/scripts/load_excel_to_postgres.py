"""
Supply Chain Digital Twin — Excel-to-PostgreSQL Loader
=======================================================
Reads Excel files from database/raw/ and loads them into the corresponding
dt_* tables in PostgreSQL.

Load order (FK-safe):
    1. Dimension tables
    2. Bridge tables
    3. Fact tables

Usage:
    python load_excel_to_postgres.py

Environment variables (from .env or shell):
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
"""

import os
import sys
import time
import logging
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Resolve paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR    = SCRIPT_DIR.parent / "raw"
ENV_FILE   = SCRIPT_DIR.parent.parent / ".env"

load_dotenv(dotenv_path=ENV_FILE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# File-to-table mapping  (filename stem → table name)
# Supports optional alternate filename (e.g. dim_day.xlsx for dt_dim_date)
# ---------------------------------------------------------------------------

FILE_TABLE_MAP: list[tuple[list[str], str]] = [
    # --- Dimensions (load first; location before factory due to FK) ---
    (["dim_part"],                "dt_dim_part"),
    (["dim_assembly"],            "dt_dim_assembly"),
    (["dim_product"],             "dt_dim_product"),
    (["dim_supplier"],            "dt_dim_supplier"),
    (["dim_location"],            "dt_dim_location"),      # must precede factory
    (["dim_factory"],             "dt_dim_factory"),
    (["dim_week"],                "dt_dim_week"),
    (["dim_date", "dim_day"],     "dt_dim_date"),          # accepts either filename

    # --- Bridges (load second) ---
    (["bridge_part_assembly"],    "dt_bridge_part_assembly"),
    (["bridge_assembly_product"], "dt_bridge_assembly_product"),
    (["bridge_part_supplier"],    "dt_bridge_part_supplier"),

    # --- Facts (load last) ---
    (["fact_requirements"],       "dt_fact_requirements"),
    (["fact_edi_orders"],         "dt_fact_edi_orders"),
    (["fact_inventory"],          "dt_fact_inventory"),
    (["fact_requirements_daily"], "dt_fact_requirements_daily"),
    (["fact_edi_orders_daily"],   "dt_fact_edi_orders_daily"),
    (["fact_inventory_daily"],    "dt_fact_inventory_daily"),
    (["fact_anomalies"],          "dt_fact_anomalies"),
]


def get_connection() -> psycopg2.extensions.connection:
    """Create and return a psycopg2 connection using env vars."""
    required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    missing  = [k for k in required if not os.environ.get(k)]
    if missing:
        log.error("Missing required environment variables: %s", ", ".join(missing))
        log.error("Copy .env.example to .env and fill in your credentials.")
        sys.exit(1)

    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def find_excel_file(stems: list[str]) -> Path | None:
    """Return the first matching .xlsx file in RAW_DIR for the given stems."""
    for stem in stems:
        candidate = RAW_DIR / f"{stem}.xlsx"
        if candidate.exists():
            return candidate
    return None


def sanitize_column_name(col: str) -> str:
    """Lowercase and strip whitespace from a column header."""
    return col.strip().lower().replace(" ", "_")


def load_dataframe(filepath: Path) -> pd.DataFrame:
    """Read an Excel file into a DataFrame with sanitised column names."""
    df = pd.read_excel(filepath, engine="openpyxl")
    df.columns = [sanitize_column_name(c) for c in df.columns]
    # Drop fully empty rows
    df = df.dropna(how="all")
    return df


def truncate_table(cur: psycopg2.extensions.cursor, table: str) -> None:
    """TRUNCATE a table so the load is idempotent (safe to re-run)."""
    # CASCADE handles FK references from child tables gracefully during reload
    cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")  # noqa: S608


def insert_rows(
    cur: psycopg2.extensions.cursor,
    table: str,
    df: pd.DataFrame,
) -> int:
    """
    Bulk-insert all rows from df into table using psycopg2 execute_values.
    Returns the number of rows inserted.
    """
    if df.empty:
        return 0

    columns    = list(df.columns)
    col_clause = ", ".join(columns)
    sql        = f"INSERT INTO {table} ({col_clause}) VALUES %s"  # noqa: S608

    # Convert DataFrame rows to a list of plain tuples; replace NaN with None
    records = [
        tuple(None if pd.isna(v) else v for v in row)
        for row in df.itertuples(index=False, name=None)
    ]

    execute_values(cur, sql, records, page_size=1000)
    return len(records)


def load_table(
    conn: psycopg2.extensions.connection,
    stems: list[str],
    table: str,
) -> None:
    """Locate the Excel file, truncate the target table, then insert rows."""
    filepath = find_excel_file(stems)

    if filepath is None:
        log.warning(
            "SKIP  %-40s  (no file found for stems: %s)",
            table,
            stems,
        )
        return

    log.info("START %-40s  ← %s", table, filepath.name)
    t0 = time.perf_counter()

    try:
        df = load_dataframe(filepath)
    except Exception as exc:
        log.error("ERROR %-40s  failed to read Excel: %s", table, exc)
        return

    try:
        with conn.cursor() as cur:
            truncate_table(cur, table)
            rows = insert_rows(cur, table, df)
        conn.commit()
        elapsed = time.perf_counter() - t0
        log.info(
            "DONE  %-40s  %6d rows  %.2fs",
            table,
            rows,
            elapsed,
        )
    except Exception as exc:
        conn.rollback()
        log.error("ERROR %-40s  insert failed: %s", table, exc)


def main() -> None:
    log.info("=" * 65)
    log.info("Supply Chain Digital Twin — Excel → PostgreSQL Loader")
    log.info("Raw directory : %s", RAW_DIR)
    log.info("=" * 65)

    if not RAW_DIR.exists():
        log.error("Raw directory does not exist: %s", RAW_DIR)
        sys.exit(1)

    conn = get_connection()
    log.info(
        "Connected to PostgreSQL: %s@%s:%s/%s",
        os.environ["DB_USER"],
        os.environ["DB_HOST"],
        os.environ["DB_PORT"],
        os.environ["DB_NAME"],
    )

    overall_start = time.perf_counter()

    for stems, table in FILE_TABLE_MAP:
        load_table(conn, stems, table)

    conn.close()
    total = time.perf_counter() - overall_start
    log.info("=" * 65)
    log.info("All tables processed in %.2fs", total)
    log.info("=" * 65)


if __name__ == "__main__":
    main()
