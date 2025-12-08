# Global Migration Scrollytelling Explorer

## Overview

The **Global Migration Scrollytelling Explorer** is an interactive
visualization  that narrates migration trends through
time using UN DESA and World Bank Migration Stocks data. Built with D3.js it allows users to explore: - Long-term migration
trends\
- Bilateral migration flows\
- Top migration partners\
- A global choropleth map with a blue--rose professional palette\

## Features

-   **Interactive flow map** with dynamic particles showing
    direction\
-   **Line charts** of emigration, immigration, and net migration\
-   **Play/slider controls** for animation across years\
-   **Responsive & accessible design**

## How to Run Locally

1.  Clone the repository

    ``` bash
    git clone <your-repo-url>
    ```

2.  Open the project folder\

3.  Serve files using any local server (e.g., Python):

    ``` bash
    python3 -m http.server
    ```

4.  Open:
        http://localhost:8000

## Data Sources

-   **UN DESA** -- Migrant stock & flows\
-   **World Bank** -- Population  indicators\

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
    │   └── scroll.js
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
