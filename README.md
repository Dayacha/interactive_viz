# Global Migration Scrollytelling Explorer

## Overview

The **Global Migration Scrollytelling Explorer** is an interactive D3.js
experience that walks readers through global migration trends over the
last three decades. It combines UN DESA migrant stock statistics,
World Bank population indicators, and custom bilateral flow summaries
to show:

- Long-term emigration, immigration, and net migration trajectories
- Animated bilateral flows with directional particles
- Country-level partners and a choropleth map using a blue–rose palette
- Narrative copy that syncs with the visuals as you scroll

![Migration Explorer screenshot](Migration%20Explorer.png)

## Features

-   **Interactive flow map** with dynamic particles showing
    direction\
-   **Line charts** of emigration, immigration, and net migration\
-   **Play/slider controls** for animation across years\
-   **Responsive & accessible design**

## How to Run Locally

1.  Clone the repository (or download the ZIP) and move into the folder:
    ```bash
    git clone https://github.com/Dayacha/interactive_viz.git
    cd interactive_viz
    ```
2.  Install dependencies (optional). Everything is plain HTML/CSS/JS

3.  Start a static file server. Any server works—here are two options:
    ```bash
    # Python 3
    python3 -m http.server 8000
    # or, if you have Node
    npx serve .
    ```
4.  Visit  the port you chose in your browser.
5.  Make changes and refresh; no bundler or watcher is required.

## Data Sources

All raw data was downloaded manually and cleaned into the `data/clean`
directory. These CSVs are the ones the visualization reads at runtime.

| File | Description | Source |
| --- | --- | --- |
| `data/clean/country_migration_totals.csv` | Country-level totals for immigration, emigration, and net migration by year (1990–2020) | **UN DESA**: International Migrant Stock + **World Bank** population denominators |
| `data/clean/migration_bilateral_clean.csv` | Aggregated bilateral corridors with start/end countries, migrant counts, and region metadata | **UN DESA** (stock) + custom cleaning |

If you need to regenerate the clean files, check the scripts and
notebooks inside `src/` and `milestones/` for the transformation steps.

## Refreshing the Clean Data

The quick way to rebuild the `data/clean/*.csv` files is to run the
lightweight Python cleaner inside `src/`. It reads the raw downloads,
applies the same filters/renames used for the viz, and overwrites the
clean directory.

```bash
python3 src/data_cleaner.py
```

The script assumes the raw inputs live alongside the current clean files.
If you tweak file paths or add new sources, mirror those changes in
`src/data_cleaner.py` before re-running the command.

## File Structure

    project/
    │── index.html
    │── css/
    │   └── style.css
    │── js/
    │   ├── line.js
    │   ├── chor_map.js
    │   ├── spots_map.js
    │   ├── top5.js
    │   ├── autocomplete.js
    │   ├── main.js
    │   └── (removed scroll controller)
    │── data/
    │   └── clean/
    │       ├── country_migration_totals.csv
    │       └── migration_bilateral_clean.csv

## Author

**Daniela Ayala Chávez**\
MSCAPP · University of Chicago

GitHub: https://github.com/danielaayala\
LinkedIn: https://www.linkedin.com/in/daniela-ayala\
Email: danielaayala@uchicago.edu
