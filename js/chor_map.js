

console.log("Choropleth module loaded.");

window.currentMapMetric      = window.currentMapMetric      || "net";
window.currentMapYear        = window.currentMapYear        || 2024;
window.chorPlayInterval      = window.chorPlayInterval      || null;
window.selectedMapCountryISO = window.selectedMapCountryISO || null;

const MAP_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024];


function htmlMetricToInternal(key) {
  const map = {
    immigration_rate: "immigration",
    emigration_rate:  "emigration",
    net_migration:    "net"
  };
  return map[key] || "net";
}

function internalMetricToHtml(key) {
  const map = {
    immigration: "immigration_rate",
    emigration:  "emigration_rate",
    net:         "net_migration"
  };
  return map[key] || "net_migration";
}


function createColorScale(metric) {

  // Immigration (blue)
  if (metric === "immigration") {
    return d3.scaleThreshold()
      .domain([0.5, 1, 2, 5, 10, 20])
      .range([
        "#E3ECF9", "#C7D8F2", "#A7C5EF",
        "#6A9BE0", "#3F6FBF", "#2A4F9C", "#1F3A70"
      ]);
  }

  // Emigration (rose)
  if (metric === "emigration") {
    return d3.scaleThreshold()
      .domain([0.5, 1, 2, 5, 10, 20])
      .range([
        "#FDE2EC", "#F7B6CF", "#EB6FA3",
        "#D8347E", "#B31263", "#8F0F4F", "#6A0C3D"
      ]);
  }

  // Net migration (diverging)
  const NEG5 = "#B31263";
  const NEG4 = "#D8347E";
  const NEG3 = "#EB6FA3";
  const NEG2 = "#F7B6CF";
  const NEG1 = "#FDE2EC";

  const ZERO = "#F4F5F7";

  const POS2 = "#A7C5EF";
  const POS4 = "#3F6FBF";

  return d3.scaleThreshold()
    .domain([-3, -1.5, -0.5, 0, 0.5, 1.5, 3])
    .range([NEG5, NEG4, NEG3, NEG2, ZERO, POS2, POS4]);
}

function sparklineScales(series) {
  const vals = [];

  series.forEach(d => {
    if (Number.isFinite(d.immigrants_perc_pop)) vals.push(d.immigrants_perc_pop);
    if (Number.isFinite(d.emigrants_perc_pop))  vals.push(d.emigrants_perc_pop);
  });

  if (!vals.length) return null;

  const w = 120, h = 40, px = 8, py = 6;

  const x = d3.scaleLinear()
    .domain(d3.extent(series, d => d.year))
    .range([px, w - px]);

  const y = d3.scaleLinear()
    .domain([d3.min(vals), d3.max(vals)])
    .range([h - py, py]);

  return { x, y, w, h, px, py };
}

function sparklinePath(series, scale, accessor) {
  const valid = series.filter(d => Number.isFinite(accessor(d)));
  if (!valid.length) return "";

  const line = d3.line()
    .x(d => scale.x(d.year))
    .y(d => scale.y(accessor(d)));

  return line(valid);
}

function buildSparkline(series) {
  const scale = sparklineScales(series);
  if (!scale) return "";

  const { w, h, px, py } = scale;

  const pImm = sparklinePath(series, scale, d => d.immigrants_perc_pop);
  const pEmi = sparklinePath(series, scale, d => d.emigrants_perc_pop);

  return `
    <svg width="${w}" height="${h}">
      <line x1="${px}" y1="${h - py}" x2="${w - px}" y2="${h - py}" stroke="#d0d0d0" stroke-width="0.7"/>
      <line x1="${px}" y1="${h - py}" x2="${px}" y2="${py}" stroke="#d0d0d0" stroke-width="0.7"/>

      <path d="${pImm}" fill="none" stroke="#3F6FBF" stroke-width="1.3"/>
      <path d="${pEmi}" fill="none" stroke="#D8347E" stroke-width="1.3"/>
    </svg>
  `;
}


function renderLegend(metric) {
  const legend = d3.select("#chor-legend");
  legend.html("");

  // Diverging legend for net migration
  if (metric === "net") {
    legend.append("div")
      .attr("class", "chor-legend-gradient")
      .style("background", "linear-gradient(to right,#B31263,#F7B6CF,#F4F5F7,#A7C5EF,#3F6FBF)");

    legend.append("div")
      .attr("class", "chor-legend-labels")
      .html(`
        <span style="color:#B31263;">−3</span>
        <span>0</span>
        <span style="color:#3F6FBF;">+3</span>
      `);

    return;
  }

  // Threshold legend for immigration/emigration
  const scale = createColorScale(metric);
  const thresholds = scale.domain();
  const colors = scale.range();

  const wrap = legend.append("div").attr("class", "chor-legend-blocks");

  thresholds.forEach((t, i) => {
    const item = wrap.append("div").attr("class", "chor-legend-item");

    item.append("div")
      .attr("class", "chor-legend-swatch")
      .style("background", colors[i]);

    item.append("div")
      .text(i === 0 ? `< ${thresholds[0]}%` :
            `${thresholds[i - 1]}–${thresholds[i]}%`);
  });

  wrap.append("div")
    .attr("class", "chor-legend-item")
    .html(`
      <div class="chor-legend-swatch" style="background:${colors.at(-1)}"></div>
      <div>${thresholds.at(-1)}%+</div>
    `);
}


function updateNarrative(row, metric, year, ctx) {
  const box = d3.select("#chor-text");

  if (!row) {
    box.html(`Select a country to explore its migration profile in <b>${year}</b>.`);
    return;
  }

  let metricLine = "";

  if (metric === "immigration") {
    metricLine = `• Immigration: <b>${row.immigrants_perc_pop.toFixed(2)}%</b>`;
  } else if (metric === "emigration") {
    metricLine = `• Emigration: <b>${row.emigrants_perc_pop.toFixed(2)}%</b>`;
  } else {
    metricLine = `• Net migration: <b>${row.net_migration.toFixed(2)}</b> per 1,000 people`;
  }

  box.html(`
    <b>${row.country}</b> is part of <b>${row.subregion}</b>, <b>${row.region}</b>.
    <br><br>${metricLine}
  `);
}


function showTooltip(tooltip, event, row, metric, spark) {
  const label =
    metric === "immigration" ? `${row.immigrants_perc_pop.toFixed(2)}% immigrants` :
    metric === "emigration"  ? `${row.emigrants_perc_pop.toFixed(2)}% emigrants`  :
                               `${row.net_migration.toFixed(2)} per 1,000`;

  tooltip
    .style("opacity", 1)
    .html(`
      <b>${row.country}</b><br>
      ${label}<br><br>
      <small>Immigration vs emigration (% of population)</small><br>
      ${spark}
    `)
    .style("left", `${event.pageX + 14}px`)
    .style("top",  `${event.pageY - 18}px`);
}

function hideTooltip(tooltip) {
  tooltip.style("opacity", 0);
}


function renderChoropleth(container, geo, csv, metric, year) {

  // Wrapper
  const wrapper = container.append("div").attr("class", "chor-wrapper");

  wrapper.append("div")
    .attr("id", "chor-legend")
    .attr("class", "chor-legend");

  // Controls (year slider + play)
  const controls = wrapper.append("div").attr("class", "chor-controls year-controls");

  const playBtn = controls.append("button")
    .attr("id", "chor-play")
    .attr("class", "limit-btn")
    .text(window.chorPlayInterval ? "⏸" : "▶");

  const slider = controls.append("input")
    .attr("type", "range")
    .attr("min", 0)
    .attr("max", MAP_YEARS.length - 1)
    .property("value", MAP_YEARS.indexOf(year));

  controls.append("span")
    .attr("id", "chor-year-label")
    .text(year);

  // Viewport sizing
  const viewport = wrapper.append("div").attr("class", "chor-map-viewport");
  const node = viewport.node();
  const width  = node.clientWidth  || 1000;
  const height = Math.max(width * 0.55, 380);

  const svg = viewport.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("width", "100%")
    .style("height", "100%");

  const projection = d3.geoMercator().fitSize([width, height], geo);
  const path = d3.geoPath().projection(projection);

  // Convert columns to numeric
  csv.forEach(d => {
    d.year                = +d.year;
    d.immigrants_perc_pop = +d.immigrants_perc_pop;
    d.emigrants_perc_pop  = +d.emigrants_perc_pop;
    d.net_migration       = +d.net_migration;
  });

  // Indexed by year / iso3
  const yearData = csv.filter(d => d.year === year);

  const rowsByISO = {};
  yearData.forEach(d => rowsByISO[d.iso3] = d);

  const seriesByISO = {};
  csv.forEach(d => {
    if (!seriesByISO[d.iso3]) seriesByISO[d.iso3] = [];
    seriesByISO[d.iso3].push(d);
  });

  const ctx = { metric, year, rows: yearData, rowsByISO, seriesByISO };
  window.choroplethContext = ctx;

  renderLegend(metric);

  // Metric buttons
  d3.selectAll(".metric-btn")
    .classed("active", function () {
      return this.dataset.metric === internalMetricToHtml(metric);
    })
    .on("click", function () {
      const newMetric = htmlMetricToInternal(this.dataset.metric);
      window.currentMapMetric = newMetric;
      initChoroplethMap(newMetric, window.currentMapYear);
    });

  // Tooltip
  let tooltip = d3.select("#map-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("id", "map-tooltip")
      .attr("class", "tooltip");
  }

  const colorScale = createColorScale(metric);

  const getVal = row =>
    metric === "immigration" ? row?.immigrants_perc_pop :
    metric === "emigration"  ? row?.emigrants_perc_pop  :
                               row?.net_migration;

  // Draw the map
  const countryPaths = svg.append("g")
    .selectAll("path")
    .data(geo.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.7)
    .attr("fill", d => {
      const row = rowsByISO[d.id];
      const v   = getVal(row);
      return Number.isFinite(v) ? colorScale(v) : "#e6e6e6";
    });

  // Interactions
  countryPaths
    .on("mouseover", function (event, d) {
      const row = rowsByISO[d.id];
      if (!row) return;

      d3.select(this)
        .attr("stroke", "#333")
        .attr("stroke-width", 1.2);

      const spark = buildSparkline(seriesByISO[row.iso3]);
      showTooltip(tooltip, event, row, metric, spark);
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", `${event.pageX + 15}px`)
        .style("top",  `${event.pageY - 20}px`);
    })
    .on("mouseout", function () {
      hideTooltip(tooltip);

      d3.select(this)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7);
    })
    .on("click", function (event, d) {
      const row = rowsByISO[d.id];
      if (!row) return;

      const prevISO = window.currentCountryISO;
      window.selectedMapCountryISO = row.iso3;
      window.currentCountryISO     = row.iso3;
      window.currentCountry        = row.country;
      window.currentCountryName    = row.country;

      const input = document.querySelector("#country-search");
      if (input) input.value = row.country;

      countryPaths
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.7);

      d3.select(this)
        .attr("stroke", "#333")
        .attr("stroke-width", 1.2);

      updateNarrative(row, metric, year, ctx);

      if (window.updateAllCharts && prevISO !== row.iso3) {
        window.updateAllCharts(row.iso3);
      }
    });

  // Slider
  slider.on("input", function () {
    const idx = +this.value;
    const newYear = MAP_YEARS[idx];
    window.currentMapYear = newYear;

    d3.select("#chor-year-label").text(newYear);
    initChoroplethMap(metric, newYear);
  });

  // Play button
  playBtn.on("click", function () {
    if (window.chorPlayInterval) {
      clearInterval(window.chorPlayInterval);
      window.chorPlayInterval = null;
      d3.select(this).text("▶");
      return;
    }

    d3.select(this).text("⏸");

    window.chorPlayInterval = setInterval(() => {
      const idx = MAP_YEARS.indexOf(window.currentMapYear);
      const next = (idx + 1) % MAP_YEARS.length;
      const newYear = MAP_YEARS[next];

      window.currentMapYear = newYear;
      slider.property("value", next);
      d3.select("#chor-year-label").text(newYear);

      initChoroplethMap(metric, newYear);
    }, 1200);
  });

  // Narrative on load
  const initial =
    ctx.rowsByISO[window.selectedMapCountryISO] ||
    ctx.rows.find(d => d.country === window.currentCountry) ||
    null;

  updateNarrative(initial, metric, year, ctx);
}


function initChoroplethMap(metric = window.currentMapMetric, year = window.currentMapYear) {
  metric = metric || "net";
  window.currentMapMetric = metric;
  window.currentMapYear = year;

  const container = d3.select("#chart-map");
  container.selectAll("*").remove();

  Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("data/clean/country_migration_totals.csv")
  ])
    .then(([geo, csv]) => {
      renderChoropleth(container, geo, csv, metric, year);
    })
    .catch(err => console.error("Error loading choropleth data:", err));
}

window.initChoroplethMap = initChoroplethMap;
