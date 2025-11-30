"""
Script to clean the migrants stock data and enrich it
with region and subregion information using country_codes.csv.

Outputs (saved into data/clean/):
- migrants_stock_clean.csv
"""

from pathlib import Path
import polars as pl


# -------------------------------------------------------------------
# Directory Resolver
# -------------------------------------------------------------------

def get_data_dir() -> Path:
    """
    Returns the absolute path to the /data directory.
    Assumes the script is inside: PROJECT/src/data_cleaner.py
    """
    script_path = Path(__file__).resolve()
    data_dir = script_path.parent.parent / "data"
    return data_dir


# -------------------------------------------------------------------
# Loading Functions
# -------------------------------------------------------------------

def load_migrants_stock(data_dir: Path) -> pl.DataFrame:
    """
    Load the raw UNDESA migrants stock data.
    """
    file_path = data_dir / "raw" / "migrants_stock_undesa.csv"
    print(f"Loading migrants stock from: {file_path}")

    df = pl.read_csv(file_path)
    print(f"  Loaded {df.height} rows and {df.width} columns.")
    return df


def load_country_codes(data_dir: Path) -> pl.DataFrame:
    """
    Load ISO / M49 country codes with region and subregion.
    Handles #N/A in numeric columns.
    """
    file_path = data_dir / "raw" / "country_codes.csv"
    print(f"Loading country codes from: {file_path}")

    df = pl.read_csv(
        file_path,
        null_values=["#N/A", "N/A", ""],   # <-- FIX
        infer_schema_length=5000,          # more robust for wide files
        ignore_errors=True                 # avoid hard crashes if weird rows appear
    )

    print(f"  Loaded {df.height} rows and {df.width} columns.")
    return df



# -------------------------------------------------------------------
# LONG FORMAT
# -------------------------------------------------------------------

def reshape_to_long(df: pl.DataFrame) -> pl.DataFrame:
    """
    Convert UNDESA migrants stock data from wide format (years as columns)
    into long format.
    """

    print("Reshaping dataset: wide → long...")

    YEAR_COLS = ["1990", "1995", "2000", "2005", "2010", "2015", "2020", "2024"]

    long_df = df.unpivot(
        index=[
            "index",
            "destination",
            "coverage",
            "type",
            "destination_code",
            "origin",
            "origin_code",
            "gender"
        ],
        on=YEAR_COLS,
        variable_name="year",
        value_name="migrants"
    )

    print(f"  Reshaped to long format: {long_df.height} rows.")
    return long_df


# -------------------------------------------------------------------
# CLEANING
# -------------------------------------------------------------------

def clean_migrants_long(df: pl.DataFrame) -> pl.DataFrame:
    """
    Clean the long-format migrants dataset.
    """
    print("Cleaning long-format migrant data...")

    cleaned = df.with_columns([
        pl.col("year").cast(pl.Int32),

        (
            pl.col("migrants")
            .cast(pl.Utf8)
            .replace({"..": None, "—": None, "-": None, "": None, " ": ""})
            .str.replace_all(r"[^\d.]", "")
            .map_elements(lambda s: None if s == "" else s, return_dtype=pl.Utf8)
            .cast(pl.Int64, strict=False)
        ).alias("migrants"),

        # clean names
        pl.col("origin").str.replace_all(r"\*", "").alias("origin"),
        pl.col("destination").str.replace_all(r"\*", "").alias("destination"),

        # rename codes
        pl.col("destination_code").alias("M49_destination"),
        pl.col("origin_code").alias("M49_origin"),
    ])

    cleaned = cleaned.with_columns(
        (pl.col("migrants") / 1_000_000).alias("migrants_millions")
    )

    print("  Migrant values cleaned and standardized.")
    return cleaned


# -------------------------------------------------------------------
# METADATA JOIN
# -------------------------------------------------------------------

def add_country_metadata(migrants: pl.DataFrame, country_codes: pl.DataFrame) -> pl.DataFrame:
    """
    Enrich migrants dataset with ISO3, region, subregion for both
    destination and origin.
    """
    print("Adding ISO3 + region info...")

    cc = country_codes.rename({
        "alpha-3": "iso3",
        "name": "country",
        "region": "region",
        "sub-region": "subregion",
        "M49": "M49"
    }).select(["M49", "iso3", "country", "region", "subregion"])

    # destination cc table
    cc_dest = cc.rename({
        "M49": "M49_destination",
        "iso3": "destination_iso3",
        "country": "destination_country_name",
        "region": "destination_region",
        "subregion": "destination_subregion"
    })

    # origin cc table
    cc_orig = cc.rename({
        "M49": "M49_origin",
        "iso3": "origin_iso3",
        "country": "origin_country_name",
        "region": "origin_region",
        "subregion": "origin_subregion"
    })

    # LEFT joins (preserve UNDESA region aggregates)
    migrated = migrants.join(cc_dest, on="M49_destination", how="left")
    migrated = migrated.join(cc_orig, on="M49_origin", how="left")

    print(f"  Metadata added: {migrated.height} rows.")
    return migrated

# -------------------------------------------------------------------
# SAVE
# -------------------------------------------------------------------

def save_dataframe(df: pl.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.write_csv(path)
    print(f"Saved → {path} ({df.height} rows).")

def make_country_totals(df: pl.DataFrame, data_dir: Path) -> None:
    """
    Create a unified country-level dataset with:
        - emigrants (origin totals)
        - immigrants (destination totals)
        - net_migration (immigrants - emigrants)

    Merges only by ["country", "year"] and keeps the first available metadata
    (iso3, region, subregion) from either origin or destination.
    """

    print("Creating unified country migration totals…")

    # ------------------------------------------------------------
    # 1. ORIGIN TOTALS (emigrants)
    # ------------------------------------------------------------
    origin = (
        df.filter(pl.col("destination") == "World")
        .group_by(["origin", "origin_iso3", "origin_region",
                   "origin_subregion", "year"])
        .agg(pl.sum("migrants").alias("emigrants"))
        .rename({
            "origin": "country",
            "origin_iso3": "origin_iso3",
            "origin_region": "origin_region",
            "origin_subregion": "origin_subregion"
        })
    )

    # ------------------------------------------------------------
    # 2. DESTINATION TOTALS (immigrants)
    # ------------------------------------------------------------
    destination = (
        df.filter(pl.col("origin") == "World")
        .group_by(["destination", "destination_iso3", "destination_region",
                   "destination_subregion", "year"])
        .agg(pl.sum("migrants").alias("immigrants"))
        .rename({
            "destination": "country",
            "destination_iso3": "destination_iso3",
            "destination_region": "destination_region",
            "destination_subregion": "destination_subregion"
        })
    )

    # ------------------------------------------------------------
    # 3. MERGE ONLY BY ["country", "year"]
    # ------------------------------------------------------------
    combined = origin.join(
        destination,
        on=["country", "year"],
        how="outer"
    )

    # ------------------------------------------------------------
    # 4. COALESCE METADATA
    # ------------------------------------------------------------
    combined = combined.with_columns([
        # keep any non-null iso3
        pl.coalesce(["origin_iso3", "destination_iso3"]).alias("iso3"),

        # keep any non-null region/subregion
        pl.coalesce(["origin_region", "destination_region"]).alias("region"),
        pl.coalesce(["origin_subregion", "destination_subregion"]).alias("subregion"),

        # fill missing migration values
        pl.col("emigrants").fill_null(0),
        pl.col("immigrants").fill_null(0),
    ])

    # ------------------------------------------------------------
    # 5. NET MIGRATION
    # ------------------------------------------------------------
    combined = combined.with_columns(
        (pl.col("immigrants") - pl.col("emigrants")).alias("net_migration")
    )

    # ------------------------------------------------------------
    # 6. CLEAN + KEEP FINAL COLUMN ORDER
    # ------------------------------------------------------------
    combined = combined.select([
        "country", "iso3", "region", "subregion", "year",
        "emigrants", "immigrants", "net_migration"
    ]).sort(["country", "year"])

    # ------------------------------------------------------------
    # 7. SAVE
    # ------------------------------------------------------------
    output_path = data_dir / "clean" / "country_migration_totals.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    combined.write_csv(output_path)
    print(f"Saved → {output_path} ({combined.height} rows)")





# -------------------------------------------------------------------
# MAIN PIPELINE
# -------------------------------------------------------------------

def main():
    print("\n=== RUNNING MIGRANTS DATA CLEANER ===\n")

    data_dir = get_data_dir()
    print(f"Using data directory: {data_dir}")

    migrants_raw = load_migrants_stock(data_dir)
    country_codes = load_country_codes(data_dir)

    migrants_long = reshape_to_long(migrants_raw)
    migrants_clean = clean_migrants_long(migrants_long)
    migrants_final = add_country_metadata(migrants_clean, country_codes)

    output_path = data_dir / "clean" / "migrants_stock_clean.csv"
    save_dataframe(migrants_final, output_path)

    # Create country  dataset
    make_country_totals(migrants_final, data_dir=data_dir)


    print("\n✔ All done!\n")


# -------------------------------------------------------------------
# RUN FROM TERMINAL
# -------------------------------------------------------------------

if __name__ == "__main__":
    main()
