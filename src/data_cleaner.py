"""
Script to clean the migrants stock data and enrich it
with region and subregion information using country_codes.csv & 
with total population data from The World Bank. 

Outputs (saved into data/clean/):
- country_migration_totals.csv
"""

from pathlib import Path
import polars as pl


def load_data_set(file_path):
    print(f"Loading data from: {file_path}")
    df = pl.read_csv(
        file_path,
        null_values=["#N/A", "N/A", ""],
        ignore_errors=True
    )
    print(f"  Loaded {df.height} rows and {df.width} columns.")
    return df


def reshape_to_long(df: pl.DataFrame):
    print("Reshaping dataset: wide → long...")

    YEAR_COLS = ["1990", "1995", "2000", "2005", "2010", "2015", "2020", "2024"]

    long_df = df.unpivot(
        index=[
            "index", "destination", "coverage", "type",
            "destination_code", "origin", "origin_code", "gender"
        ],
        on=YEAR_COLS,
        variable_name="year",
        value_name="migrants"
    )

    print(f"  Reshaped to long format: {long_df.height} rows.")
    return long_df


def clean_migrants_long(df: pl.DataFrame):
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

        pl.col("origin").str.replace_all(r"\*", "").alias("origin"),
        pl.col("destination").str.replace_all(r"\*", "").alias("destination"),

        pl.col("destination_code").alias("M49_destination"),
        pl.col("origin_code").alias("M49_origin"),
    ])

    return cleaned.with_columns(
        (pl.col("migrants") / 1_000_000).alias("migrants_millions")
    )


def add_country_metadata(migrants: pl.DataFrame, country_codes: pl.DataFrame):
    print("Adding ISO3 + region info...")

    cc = country_codes.rename({
        "alpha-3": "iso3",
        "name": "country",
        "region": "region",
        "sub-region": "subregion",
        "M49": "M49",
        
    }).select(["M49", "iso3", "country", "region", "subregion"])

    cc_dest = cc.rename({
        "M49": "M49_destination",
        "iso3": "destination_iso3",
        "country": "destination_country_name",
        "region": "destination_region",
        "subregion": "destination_subregion"
    })

    cc_orig = cc.rename({
        "M49": "M49_origin",
        "iso3": "origin_iso3",
        "country": "origin_country_name",
        "region": "origin_region",
        "subregion": "origin_subregion"
    })

    migrated = migrants.join(cc_dest, on="M49_destination", how="left")
    migrated = migrated.join(cc_orig, on="M49_origin", how="left")

    return migrated


def make_country_totals(df: pl.DataFrame):
    print("Creating unified country migration totals…")

    origin = (
        df.filter(pl.col("destination") == "World")
        .group_by(["origin", "origin_iso3", "origin_region",
                   "origin_subregion", "year"])
        .agg(pl.sum("migrants_millions").alias("emigrants"))
        .rename({
            "origin": "country",
            "origin_iso3": "origin_iso3",
            "origin_region": "origin_region",
            "origin_subregion": "origin_subregion"
        })
    )

    destination = (
        df.filter(pl.col("origin") == "World")
        .group_by(["destination", "destination_iso3", "destination_region",
                   "destination_subregion", "year"])
        .agg(pl.sum("migrants_millions").alias("immigrants"))
        .rename({
            "destination": "country",
            "destination_iso3": "destination_iso3",
            "destination_region": "destination_region",
            "destination_subregion": "destination_subregion"
        })
    )

    combined = origin.join(destination, on=["country", "year"], how="outer")

    combined = combined.with_columns([
        pl.coalesce(["origin_iso3", "destination_iso3"]).alias("iso3"),
        pl.coalesce(["origin_region", "destination_region"]).alias("region"),
        pl.coalesce(["origin_subregion", "destination_subregion"]).alias("subregion"),
        pl.col("emigrants").fill_null(0),
        pl.col("immigrants").fill_null(0),
    ])

    combined = combined.with_columns(
        (pl.col("immigrants") - pl.col("emigrants")).alias("net_migration")
    )

    combined = combined.select([
        "country", "iso3", "region", "subregion", "year",
        "emigrants", "immigrants", "net_migration",
    ]).sort(["country", "year"])

    return combined.filter(
        pl.col("iso3").is_not_null() &
        pl.col("country").is_not_null()
    )


def add_total_population(combined: pl.DataFrame, pop_df: pl.DataFrame):
    print("Adding total population data…")

    population = pop_df.select([
        pl.col("REF_AREA").alias("iso3"),
        pl.col("TIME_PERIOD").alias("year"),
        (pl.col("OBS_VALUE") / 1_000_000).alias("population_millions")
    ])

    joined = combined.join(
        population,
        on=["iso3", "year"],
        how="left"
    )

    return joined.with_columns([
        pl.when(pl.col("population_millions") > 0)
          .then(pl.col("immigrants") / pl.col("population_millions") * 100)
          .otherwise(None)
          .alias("immigrants_perc_pop"),

        pl.when(pl.col("population_millions") > 0)
          .then(pl.col("emigrants") / pl.col("population_millions") * 100)
          .otherwise(None)
          .alias("emigrants_perc_pop"),
    ])


def make_bilateral_dataset(df: pl.DataFrame):
    """
    Build a bilateral origin→destination migration dataset
    from the fully enriched migrants dataframe.

    Output columns:
    - year
    - origin_iso3, origin_country_name, origin_region, origin_subregion
    - destination_iso3, destination_country_name, destination_region, destination_subregion
    - migrants_millions
    """
    print("Creating bilateral origin→destination migration dataset…")

    # 1. Filtrar solo filas útiles (quitar "World" y duplicados vacíos)
    filtered = df.filter(
        (pl.col("origin") != "World") &
        (pl.col("destination") != "World") &
        (pl.col("origin_country_name").is_not_null()) &
        (pl.col("destination_country_name").is_not_null()) &
        (pl.col("origin_iso3").is_not_null()) &
        (pl.col("destination_iso3").is_not_null()) &
        (pl.col("migrants").is_not_null())
    )

    # 2. Agrupar por O-D-year y sumar male+female
    agg = (
        filtered
        .group_by([
            "year",
            "origin_iso3", "origin_country_name", "origin_region", "origin_subregion",
            "destination_iso3", "destination_country_name", "destination_region", "destination_subregion"
        ])
        .agg([
            pl.sum("migrants_millions").alias("migrants_millions")
        ])
    )

    bilateral = agg.sort(["origin_iso3", "destination_iso3", "year"])

    print(f"  Bilateral dataset: {bilateral.height} rows.")
    return bilateral



def save_dataframe(df: pl.DataFrame, path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.write_csv(path)
    print(f"Saved → {path}")


def main():
    print("\n DATA CLEANER\n")

    migrants_raw = load_data_set("data/raw/UN-Data/migrants_stock_undesa.csv")
    country_codes = load_data_set("data/raw/country_codes.csv")
    population_data = load_data_set("data/raw/WB-Data/WB_WDI_SP_POP_TOTL.csv")

    migrants_long = reshape_to_long(migrants_raw)
    migrants_clean = clean_migrants_long(migrants_long)
    migrants_final = add_country_metadata(migrants_clean, country_codes)

    # (1) Dataset totals  by country
    country_totals = make_country_totals(migrants_final)
    complete_data = add_total_population(country_totals, population_data)
    save_dataframe(complete_data, "data/clean/country_migration_totals.csv")

    # (2) Dataset bilaterals
    bilateral = make_bilateral_dataset(migrants_final)
    save_dataframe(bilateral, "data/clean/migration_bilateral_clean.csv")

    print("\n✔ All done!\n")


if __name__ == "__main__":
    main()
