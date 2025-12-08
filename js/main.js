// global state

let storyData = {};
let globalData = [];

window.currentCountry = "Mexico";
window.currentCountryISO = null;


// color palette (aligned with choropleth and line charts)

const emigrants_color  = "#D8347E";
const immigrants_color = "#3F6FBF";


// load country-level time series

async function load_data(country = "Mexico") {
  try {
    const raw = await d3.csv("data/clean/country_migration_totals.csv");

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

    const filtered = data
      .filter(d => d.country === country)
      .sort((a, b) => a.year - b.year);

    if (!filtered.length) {
      console.warn("no data found for country:", country);
      return [];
    }

    // keep iso for narrative and map interactions
    window.currentCountryISO = filtered[0].iso;

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

  window.currentCountry = "Mexico";

  globalData = await load_data(window.currentCountry);
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
  init_spots_map(window.currentCountry, storyData.lastYear);
  initChoroplethMap("immigration", storyData.lastYear);

  updateTop5(window.currentCountry);

  if (typeof init_scroll === "function") init_scroll();

  updateChart(1);

  console.log("all visualizations ready");
}


// run on page load

document.addEventListener("DOMContentLoaded", init_app);


// update all charts when the user selects a new country

window.updateAllCharts = async function (country) {

  window.currentCountry = country;

  console.log("updating all charts for:", country);

  globalData = await load_data(country);
  if (!globalData.length) return;

  storyData = computeStoryData(globalData);

  // clean chart areas
  d3.select("#chart-line").selectAll("*").remove();
  d3.select("#chart-map").selectAll("*").remove();
  d3.select("#chart-map-spots").selectAll("*").remove();
  d3.select("#top5-destinations").selectAll("*").remove();
  d3.select("#top5-origins").selectAll("*").remove();

  // redraw
  draw_line_chart(globalData);
  init_spots_map(country, storyData.lastYear);
  initChoroplethMap("immigration", storyData.lastYear);

  updateTop5(country);
  updateChart(1);

  console.log("country update complete");
};
