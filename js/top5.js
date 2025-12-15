// top 5 origins and destinations — clean version

console.log("top 5 module loaded.");

let TOP5_CSV = [];
let TOP5_READY = false;

let TOP5_YEARS = [];
let TOP5_YEAR = 2024;
let TOP5_PLAY = null;

const isoToNameTop5 = window.isoToName = window.isoToName || {};
const nameToIsoTop5 = window.nameToIso = window.nameToIso || {};

// load csv with bilateral flows
function loadTop5Data() {
  d3.csv("data/clean/migration_bilateral_clean.csv").then(csv => {

    // normalize names and convert numbers
    csv.forEach(r => {
      r.origin_country_name = normalizeCountryName(r.origin_country_name);
      r.destination_country_name = normalizeCountryName(r.destination_country_name);
      r.migrants_millions = +r.migrants_millions;

      if (r.origin_iso3 && r.origin_country_name) {
        isoToNameTop5[r.origin_iso3] = isoToNameTop5[r.origin_iso3] || r.origin_country_name;
        nameToIsoTop5[r.origin_country_name.toLowerCase()] = r.origin_iso3;
      }
      if (r.destination_iso3 && r.destination_country_name) {
        isoToNameTop5[r.destination_iso3] = isoToNameTop5[r.destination_iso3] || r.destination_country_name;
        nameToIsoTop5[r.destination_country_name.toLowerCase()] = r.destination_iso3;
      }
    });

    TOP5_YEARS = Array.from(new Set(csv.map(r => +r.year))).sort((a,b)=>a-b);
    TOP5_YEAR = TOP5_YEARS.at(-1) || 2024;
    window.currentTop5Year = TOP5_YEAR;

    setupTop5Controls();

    TOP5_CSV = csv;
    TOP5_READY = true;
    console.log("top 5 dataset loaded:", csv.length);

    updateTop5(window.currentCountryISO, window.currentCountryName, TOP5_YEAR);
  });
}
loadTop5Data();

// clean country names to be consistent
function normalizeCountryName(name) {
  if (!name) return "";
  return name
    .replace("United States of America", "United States")
    .replace("Korea, Republic of", "South Korea")
    .replace("Korea, Democratic People's Republic of", "North Korea")
    .replace("Venezuela, Bolivarian Republic of", "Venezuela")
    .replace("Bolivia (Plurinational State of)", "Bolivia")
    .replace("Russian Federation", "Russia")
    .trim();
}

// helpers
const fmt = x => (+x).toFixed(2) + "M";

// break long names into two lines if needed
function twoLineLabel(name, max = 12) {
  const words = name.split(" ");
  if (name.length <= max) return [name, ""];
  let line1 = "", line2 = "";
  for (let w of words) {
    if ((line1 + w).length <= max) line1 += w + " ";
    else line2 += w + " ";
  }
  return [line1.trim(), line2.trim()];
}

// remove all inside container
function cleanContainer(c) {
  c.selectAll("*").remove();
}

// create responsive svg
function createSvg(container, height = 220) {
  const width = container.node().getBoundingClientRect().width || 300;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .style("width", "100%")
    .style("height", `${height}px`);

  return { svg, width, height };
}

// build x and y scales
function buildScales(data, width, height, margin) {
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.migrants_millions)])
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([margin.top, height - margin.bottom])
    .padding(0.3);

  return { x, y };
}

// draw top5 mini chart
function drawMiniChart(containerID, data, title, color) {
  
  const tooltip = d3.select("#top5-tooltip").style("opacity", 0);
  const container = d3.select(containerID);
  cleanContainer(container);

  if (!data.length) {
    container.append("div").style("padding", "20px").text("no data available.");
    return;
  }

  const margin = { top: 28, right: 16, bottom: 48, left: 115 };
  const { svg, width, height } = createSvg(container);
  const { x, y } = buildScales(data, width, height, margin);

  // chart title
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", margin.top - 10)
    .attr("font-size", "15px")
    .attr("font-weight", "600")
    .text(title);

  // x-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .text("Million migrants (stock)");

  // bars
  svg.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", margin.left)
    .attr("y", d => y(d.label))
    .attr("width", d => Math.max(2, x(d.migrants_millions) - margin.left))
    .attr("height", y.bandwidth())
    .attr("fill", color)
    .on("mouseover", function (event, d) {
      d3.select(this).attr("fill", d3.rgb(color).darker(1));
      tooltip.style("opacity", 1).html(`<b>${d.label}</b><br>${fmt(d.migrants_millions)}`);
    })
    .on("mousemove", event => {
      tooltip.style("left", (event.pageX + 16) + "px")
             .style("top",  (event.pageY + 16) + "px");
    })
    .on("mouseout", function () {
      d3.select(this).attr("fill", color);
      tooltip.style("opacity", 0);
    });

  // value labels
  svg.selectAll(".value-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "value-label")
    .attr("y", d => y(d.label) + y.bandwidth() / 1.6)
    .attr("font-size", "11px")
    .attr("font-weight", "700")
    .text(d => fmt(d.migrants_millions))
    .each(function(d) {
      const valX = x(d.migrants_millions);
      const spaceRight = width - margin.right - valX;
      const t = d3.select(this);

      const insideBar = spaceRight <= 55;

      t.style("paint-order", insideBar ? "stroke" : null)
        .attr("stroke", insideBar ? "rgba(0,0,0,0.35)" : null)
        .attr("stroke-width", insideBar ? 0.6 : null);

      if (insideBar) {
        t.attr("x", valX - 8).attr("fill", "#FFFFFF").attr("text-anchor", "end");
      } else {
        t.attr("x", valX + 6).attr("fill", "#1F2937").attr("text-anchor", "start");
      }
    });

  // country labels
  svg.selectAll(".y-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "y-label")
    .attr("font-size", "11px")
    .attr("text-anchor", "end")
    .each(function(d) {
      const [l1, l2] = twoLineLabel(d.label);
      const baseY = y(d.label) + y.bandwidth() / 2;
      const text = d3.select(this);

      text.text("");

      text.append("tspan")
        .attr("x", margin.left - 10)
        .attr("y", baseY - (l2 ? 4 : 0))
        .text(l1);

      if (l2) {
        text.append("tspan")
          .attr("x", margin.left - 10)
          .attr("y", baseY + 10)
          .text(l2);
      }
    });

  // bottom axis
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .attr("font-size", "10px");
}

// update the descriptive text next to the charts
function updateTop5CountryText(countryLabel, origins, destinations, year) {
  const box = d3.select("#top5-text");

  const hasOut = destinations.length > 0;
  const hasIn  = origins.length > 0;

  if (!hasOut && !hasIn) {
    box.html(`no bilateral migration data is available for <b>${countryLabel}</b> in ${year}.`);
    return;
  }

  const topOut = hasOut ? destinations[0] : null;
  const topIn  = hasIn  ? origins[0]      : null;

  const totalOut = d3.sum(destinations, d => d.migrants_millions);
  const totalIn  = d3.sum(origins,       d => d.migrants_millions);

  const outShare = topOut ? topOut.migrants_millions / totalOut : 0;
  const inShare  = topIn  ? topIn.migrants_millions  / totalIn  : 0;

  const dominant = Math.max(outShare, inShare) >= 0.55;
  const diversified = Math.max(outShare, inShare) <= 0.40;

  let text = `
    migration patterns for <b>${countryLabel}</b> in <b>${year}</b> show its main 
    <span style="color:#D94F70"><b>emigration destinations</b></span> and 
    <span style="color:#3A71C4"><b>immigrant origins</b></span>.
  `;

  if (hasOut && hasIn) {
    text += ` the country participates in both outward and inward migration.`;
  } else if (hasOut) {
    text += ` in 2024, the country mainly appears as a place of origin.`;
  } else if (hasIn) {
    text += ` in 2024, the country mainly receives migrants.`;
  }

  if (dominant) {
    text += ` flows are highly concentrated in one main corridor.`;
  } else if (diversified) {
    text += ` flows are fairly diversified across several routes.`;
  }

  if (topOut) {
    text += `<br><br>the main emigration destination is <b>${topOut.label}</b>.`;
  }

  if (topIn) {
    text += `<br><br>the largest immigrant origin is <b>${topIn.label}</b>.`;
  }

  text += `
      <br><br>
      these patterns illustrate how geography and regional systems shape 
      the migration profile of <b>${countryLabel}</b>.
  `;

  box.html(text);
}

// main update function
function updateTop5(countryISO, countryName, year = TOP5_YEAR) {
  if (!TOP5_READY) {
    setTimeout(() => updateTop5(countryISO, countryName, year), 150);
    return;
  }

  const iso = (countryISO || "").toUpperCase();
  const displayName = countryName || isoToNameTop5[iso] || iso;
  const rows = TOP5_CSV.filter(r => +r.year === year);

  const topOrigins = rows
    .filter(r => r.destination_iso3 === iso && r.migrants_millions > 0)
    .sort((a,b) => b.migrants_millions - a.migrants_millions)
    .slice(0, 5)
    .map(d => ({
      label: isoToNameTop5[d.origin_iso3] || d.origin_country_name,
      migrants_millions: d.migrants_millions,
      origin_subregion: d.origin_subregion,
      destination_subregion: d.destination_subregion
    }));

  const topDestinations = rows
    .filter(r => r.origin_iso3 === iso && r.migrants_millions > 0)
    .sort((a,b) => b.migrants_millions - a.migrants_millions)
    .slice(0, 5)
    .map(d => ({
      label: isoToNameTop5[d.destination_iso3] || d.destination_country_name,
      migrants_millions: d.migrants_millions,
      origin_subregion: d.origin_subregion,
      destination_subregion: d.destination_subregion
    }));

  drawMiniChart("#top5-origins", topOrigins, "top 5 origins (immigration)", "#3A71C4");
  drawMiniChart("#top5-destinations", topDestinations, "top 5 destinations (emigration)", "#D94F70");

  updateTop5CountryText(displayName, topOrigins, topDestinations, year);
  window.currentTop5Year = year;
}

window.updateTop5 = updateTop5;

function setupTop5Controls() {
  const slider = document.getElementById("top5-year-slider");
  const label  = document.getElementById("top5-year-label");
  const play   = document.getElementById("top5-play");

  if (!slider || !label || !play || !TOP5_YEARS.length) return;

  slider.min = TOP5_YEARS[0];
  slider.max = TOP5_YEARS[TOP5_YEARS.length - 1];
  slider.step = 1;
  slider.value = TOP5_YEAR;
  label.textContent = TOP5_YEAR;

  slider.addEventListener("input", () => {
    const raw = +slider.value;
    const y = TOP5_YEARS.reduce((prev, curr) =>
      Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
    , TOP5_YEARS[0]);
    TOP5_YEAR = y;
    slider.value = y;
    label.textContent = y;
    updateTop5(window.currentCountryISO, window.currentCountryName, y);
  });

  play.addEventListener("click", () => {
    if (TOP5_PLAY) {
      clearInterval(TOP5_PLAY);
      TOP5_PLAY = null;
      play.textContent = "▶";
      return;
    }

    play.textContent = "⏸";
    TOP5_PLAY = setInterval(() => {
      let idx = TOP5_YEARS.indexOf(TOP5_YEAR);
      idx = (idx + 1) % TOP5_YEARS.length;
      TOP5_YEAR = TOP5_YEARS[idx];
      slider.value = TOP5_YEAR;
      label.textContent = TOP5_YEAR;
      updateTop5(window.currentCountryISO, window.currentCountryName, TOP5_YEAR);
    }, 1000);
  });
}

