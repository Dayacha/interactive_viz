# Daniela Ayala Chavez

## Geographic Hotspot Identification for Migration

## Description
This project will explore how visualization and spatial analytics can reveal geographic “hotspots” of migration risk using open data. The core idea is to combine multiple socioeconomic and environmental indicators — such as poverty, unemployment, education levels, remittances, and climate risk — into a composite migration-risk score for each region.
This project will explore how visualization and spatial analytics can reveal geographic “hotspots” of migration risk using open data. The core idea is to combine multiple socioeconomic and environmental indicators — such as poverty, unemployment, education levels, remittances, and climate risk — into a composite migration-risk score for each region. The focous will be Latin America and the Caribbean.

## Technical Plan re: Option A/B/C/D

**Large Interactive Visualization.**

The goal is to allow users to select a country and explore its migration context — including economic, demographic, and social indicators — and see how it compares to its neighbors.

A map will serve as the centerpiece of the narrative, with panels and explanatory text surrounding it and when the user selects a country could update accompanying mini-visuals or highlight related indicators dynamically.

I am not choosing the Option c with MapLibreGL because I feel that my map is not a zoom in map en explore. It is more about showing a specifics for each country in LAC. 

## Mockup

{
At least one image file with a mock-up of what you're considering.
If multiple images help make the intent clear, please include more.
This can be a quick pen & paper sketch of your current idea, or you can use Inkscape/any tool you wish.
A rough sense of what will be shown and how the user will interact with it should be clear from your illustration(s).
}

## Data Sources

#### 1. World Development Indicators
- URL: [https://databank.worldbank.org/source/world-development-indicators](https://databank.worldbank.org/source/world-development-indicators)
- Size: ~1,400 indicators across 200+ countries, time series (1960–2024)
- Size: thausands of indicators across countries
- Includes socioeconomic indicators (GDP per capita, unemployment rate, remittances, education, health) that can be used to identify structural vulnerabilities influencing migration.

#### 2. UN DESA International Migrant Stock Database (2024 Revision)
- URL: [https://lac.iom.int/en/data-and-resources](https://www.un.org/development/desa/pd/content/international-migrant-stock)
- Size: Country-level migration flows and stock estimates (2010–2023)
- Provides migration inflows/outflows, remittances, and return migration data across countries and subregions, useful for establishing baseline migration trends.


## Questions

{Numbered list of questions for course staff, if any.}

1. Do you think the interaction of selecting one country to update contextual information is sufficient to qualify as “non-trivial interactivity,” or should I include an additional interaction (e.g., variable toggle or animation over time)?
2. Is it possibel to use Option A and still make the user click on tha country, instead of using a dropdown menu?

