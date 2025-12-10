// global state

let storyData = {};
let globalData = [];

const DEFAULT_COUNTRY_ISO = "MEX";

window.currentTop5Year = window.currentTop5Year || null;

window.currentCountryISO  = window.currentCountryISO  || DEFAULT_COUNTRY_ISO;
window.currentCountryName = window.currentCountryName || "Mexico";
window.currentCountry     = window.currentCountryName;


// color palette (aligned with choropleth and line charts)

const emigrants_color  = "#D8347E";
const immigrants_color = "#3F6FBF";


// load country-level time series

async function load_data(countryISO = DEFAULT_COUNTRY_ISO) {
  try {
    const raw = await d3.csv("data/clean/country_migration_totals.csv");
    const isoToName = window.isoToName = window.isoToName || {};
    const nameToIso = window.nameToIso = window.nameToIso || {};

    const data = raw.map(d => ({
      country: d.country,
      year: +d.year,
      iso: d.iso3,
      region: d.region,
      subregion: d.subregion,
      emigrants: +d.emigrants,
      immigrants: +d.immigrants,
      net_migration_millions: (+d.immigrants) - (+d.emigrants)
    }));

    data.forEach(d => {
      if (d.iso && d.country) {
        isoToName[d.iso] = isoToName[d.iso] || d.country;
        nameToIso[d.country.toLowerCase()] = d.iso;
      }
    });

    const filtered = data
      .filter(d => d.iso === countryISO)
      .sort((a, b) => a.year - b.year);

    if (!filtered.length) {
      console.warn("no data found for iso:", countryISO);
      return [];
    }

    // keep iso/name for narrative and map interactions
    const countryName = filtered[0].country;
    window.currentCountryISO  = filtered[0].iso;
    window.currentCountryName = countryName;
    window.currentCountry     = countryName;
    window.selectedMapCountryISO = filtered[0].iso;

    return filtered;

  } catch (error) {
    console.error("error loading data:", error);
    return [];
  }
}


// compute summary indicators for the narrative section

function computeStoryData(data) {
  if (!data || data.length < 2) return {};

  const first = data[0];
  const last  = data[data.length - 1];

  const changeEm = ((last.emigrants - first.emigrants) / first.emigrants) * 100;
  const changeIm = ((last.immigrants - first.immigrants) / first.immigrants) * 100;

  // small helper for text descriptions
  function emTrend(v) {
    if (v > 20) return "has grown substantially";
    if (v > 5) return "has grown moderately";
    if (v > -5) return "has remained relatively stable";
    if (v > -20) return "has moderately declined";
    return "has dropped significantly";
  }

  function imTrend(v) {
    if (v > 20) return "has increased strongly";
    if (v > 5) return "has increased slightly";
    if (v > -5) return "has been stable";
    if (v > -20) return "has decreased slightly";
    return "has shrunk notably";
  }

  let dominantFlow = "";
  if (last.emigrants > last.immigrants) dominantFlow = "emigration remains higher than immigration";
  else if (last.emigrants < last.immigrants) dominantFlow = "immigration now exceeds emigration";
  else dominantFlow = "emigration and immigration are currently identical";

  // check if the two curves cross at any point
  let crossed = false;
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const prevSide = prev.emigrants - prev.immigrants;
    const currSide = curr.emigrants - curr.immigrants;
    if (prevSide * currSide < 0) {
      crossed = true;
      break;
    }
  }

  const crossingN = crossed
    ? "at one point in history, the two flows crossed, marking a structural shift."
    : "throughout the period, the two flows remain on the same side, without reversing dominance.";

  return {
    firstYear: first.year,
    lastYear: last.year,
    lastEm: last.emigrants,
    lastIm: last.immigrants,
    emTrend: emTrend(changeEm),
    imTrend: imTrend(changeIm),
    dominantFlow,
    crossed,
    crossingN
  };
}


// initialize all charts and views

async function init_app() {

  console.log("initializing visualizations");

  window.currentCountryISO = DEFAULT_COUNTRY_ISO;
  globalData = await load_data(window.currentCountryISO);
  if (!globalData.length) return;

  storyData = computeStoryData(globalData);

  // clear previous graphics
  d3.select("#chart-map").selectAll("*").remove();
  d3.select("#chart-map-spots").selectAll("*").remove();
  d3.select("#chart-line").selectAll("*").remove();
  d3.select("#top5-destinations").selectAll("*").remove();
  d3.select("#top5-origins").selectAll("*").remove();

  // main charts
  draw_line_chart(globalData);
  init_spots_map(window.currentCountryISO, storyData.lastYear, window.currentCountryName);
  initChoroplethMap("immigration", storyData.lastYear);

  const top5Year = window.currentTop5Year || undefined;
  updateTop5(window.currentCountryISO, window.currentCountryName, top5Year);

  if (typeof init_scroll === "function") init_scroll();

  updateChart(1);

  console.log("all visualizations ready");
}


// run on page load

document.addEventListener("DOMContentLoaded", init_app);


// update all charts when the user selects a new country

window.updateAllCharts = async function (countryISO) {

  const iso = (countryISO && countryISO.length === 3)
    ? countryISO.toUpperCase()
    : (window.nameToIso?.[String(countryISO || "").toLowerCase()] || window.currentCountryISO);

  console.log("updating all charts for ISO:", iso);

  globalData = await load_data(iso);
  if (!globalData.length) return;

  storyData = computeStoryData(globalData);

  const displayName = window.currentCountryName || window.isoToName?.[iso] || iso;

  // clean chart areas
  d3.select("#chart-line").selectAll("*").remove();
  d3.select("#chart-map").selectAll("*").remove();
  d3.select("#chart-map-spots").selectAll("*").remove();
  d3.select("#top5-destinations").selectAll("*").remove();
  d3.select("#top5-origins").selectAll("*").remove();

  // redraw
  draw_line_chart(globalData);
  init_spots_map(iso, storyData.lastYear, displayName);
  initChoroplethMap("immigration", storyData.lastYear);

  const top5Year = window.currentTop5Year || undefined;
  updateTop5(iso, displayName, top5Year);
  updateChart(1);

  console.log("country update complete");
};
