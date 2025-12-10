// global state

window.currentCountryISO  = window.currentCountryISO  || "MEX";
window.currentCountryName = window.currentCountryName || "Mexico";
window.currentYear        = window.currentYear        || 2024;
window.validYears         = window.validYears         || null;
window.flowLimit          = window.flowLimit          || "top10";   // top10 or all

let playInterval = null;

// build text for the flow map narrative

function updateSpotsText(country, year, flowsOut, flowsIn) {

  const title = d3.select("#spots-country-title");
  const box   = d3.select("#map-text");

  title.html(`Migration corridors of <b>${country}</b> in ${year}`);

  const hasOut = flowsOut && flowsOut.length > 0;
  const hasIn  = flowsIn && flowsIn.length > 0;

  if (!hasOut && !hasIn) {
    box.html(`No migration corridor data is available for <b>${country}</b> in ${year}.`);
    return;
  }

  const topOut = hasOut ? flowsOut[0] : null;
  const topIn  = hasIn  ? flowsIn[0]  : null;

  const totalOut = hasOut ? d3.sum(flowsOut, d => d.migrants_millions) : 0;
  const totalIn  = hasIn  ? d3.sum(flowsIn,  d => d.migrants_millions) : 0;

  const topOutShare = topOut && totalOut > 0 ? topOut.migrants_millions / totalOut : 0;
  const topInShare  = topIn  && totalIn  > 0 ? topIn.migrants_millions  / totalIn  : 0;
  const maxShare    = Math.max(topOutShare, topInShare);

  const isMajorCorridor = maxShare >= 0.6;
  const isDiffuse       = maxShare <= 0.4;

  let text = `
    Migration corridors show how people move and how countries relate within wider mobility systems.
    For <b>${country}</b> in <b>${year}</b>, the flow map highlights its strongest connections.
  `;

  if (hasOut && hasIn) {
    text += `<br><br><b>${country}</b> appears both as a country of origin and destination.`;
  } else if (hasOut && !hasIn) {
    text += `<br><br>This year, <b>${country}</b> mostly acts as a country of origin.`;
  } else if (!hasOut && hasIn) {
    text += `<br><br>This year, <b>${country}</b> mostly receives migrants.`;
  }

  if (isMajorCorridor) {
    text += ` Flows are <b>highly concentrated</b> in one dominant corridor.`;
  } else if (isDiffuse) {
    text += ` Flows are <b>spread across multiple destinations</b>.`;
  }

  if (topOut) {
    text += `
      <br><br>
      The strongest <span style="color:#D94F70"><b>emigration</b></span> corridor leads from
      <b>${country}</b> to <b>${topOut.destination_country_name}</b>.
    `;
  }

  if (topIn) {
    text += `
      <br>
      The main <span style="color:#3A71C4"><b>immigration</b></span> corridor comes from
      <b>${topIn.origin_country_name}</b>.
    `;
  }

  box.html(text);
}


// initialize the flow map

function init_spots_map(countryISO = window.currentCountryISO, targetYear = window.currentYear, countryName = window.currentCountryName) {

  window.currentCountryISO  = countryISO;
  window.currentCountryName = countryName || window.isoToName?.[countryISO] || countryISO;
  window.currentCountry     = window.currentCountryName;

  const container = d3.select("#chart-map-spots");
  container.selectAll("*").remove();

  const rect = container.node().getBoundingClientRect();
  const width = rect.width;
  const height = rect.height || 520;

  const tooltip = d3.select("#spots-tooltip");

  function placeTooltip(e) {
    tooltip
      .style("left", e.pageX + 15 + "px")
      .style("top", e.pageY + 15 + "px");
  }

  Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("data/clean/migration_bilateral_clean.csv")
  ])
  .then(([geo, csv]) => {

    csv.forEach(d => { d.migrants_millions = +d.migrants_millions; });

    // determine available years (only once)
    if (!window.validYears) {
      window.validYears = Array.from(new Set(csv.map(d => +d.year))).sort((a,b)=>a-b);

      const slider = document.querySelector("#year-slider");
      const label  = document.querySelector("#year-label");

      slider.min = window.validYears[0];
      slider.max = window.validYears[window.validYears.length - 1];
      slider.step = 1;

      if (!window.validYears.includes(window.currentYear)) {
        window.currentYear = window.validYears[window.validYears.length - 1];
      }

      slider.value = window.currentYear;
      label.textContent = window.currentYear;
    }

    // adjust year if needed
    if (!window.validYears.includes(targetYear)) {
      targetYear = window.validYears[window.validYears.length - 1];
    }

    window.currentYear = targetYear;

    // svg setup
    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoMercator()
      .scale(width / 7)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    const countryShapes = svg.append("g");
    const arcLayer      = svg.append("g");
    const particleLayer = svg.append("g").style("pointer-events","none");

    // draw countries
    const countries = countryShapes
      .selectAll("path")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", "#F2F2F2")
      .attr("stroke", "#C8C8C8")
      .attr("stroke-width", 1);

    // click to change country
    countries.on("click", (e,d) => {
      const iso = d.id;
      if (!iso) return;
      const name = window.isoToName?.[iso] || d.properties?.name || iso;
      window.currentCountryISO  = iso;
      window.currentCountryName = name;
      window.currentCountry     = name;
      init_spots_map(iso, window.currentYear, name);
      const input = document.querySelector("#country-search");
      if (input) input.value = name;
      if (window.updateAllCharts) window.updateAllCharts(iso);
    });

    // compute centroids
    const centroids = {};
    geo.features.forEach(f => { centroids[f.id] = d3.geoCentroid(f); });

    // outgoing flows
    let flowsOut = csv.filter(d =>
      +d.year === targetYear &&
      d.origin_iso3 === countryISO &&
      centroids[d.origin_iso3] &&
      centroids[d.destination_iso3]
    ).sort((a,b)=> b.migrants_millions - a.migrants_millions);

    if (window.flowLimit === "top10") {
      flowsOut = flowsOut.slice(0, 10);
    }

    flowsOut = flowsOut.map(d => ({ ...d, direction: "out" }));

    // incoming flows
    let flowsIn = csv.filter(d =>
      +d.year === targetYear &&
      d.destination_iso3 === countryISO &&
      centroids[d.origin_iso3] &&
      centroids[d.destination_iso3]
    ).sort((a,b)=> b.migrants_millions - a.migrants_millions);

    if (window.flowLimit === "top10") {
      flowsIn = flowsIn.slice(0, 10);
    }

    flowsIn = flowsIn.map(d => ({ ...d, direction: "in" }));

    // merge
    const flows = [...flowsOut, ...flowsIn];

    // update narrative
    const displayName = window.currentCountryName || window.isoToName?.[countryISO] || countryISO;
    updateSpotsText(displayName, targetYear, flowsOut, flowsIn);

    // special coloring for partners
    const outDest = new Set(flowsOut.map(f => f.destination_iso3));
    const inOrig  = new Set(flowsIn.map(f => f.origin_iso3));
    const selectedName = window.currentCountryName || displayName;

    countries.attr("fill", d => {
      if (d.id === countryISO) return "#999";
      if (outDest.has(d.id)) return "#FFD6E3";
      if (inOrig.has(d.id))  return "#DCE8FF";
      return "#F2F2F2";
    });

    // hover behavior
    countries
      .on("mouseover", function (e,d) {

        const name = d.properties?.name || d.id;
        if (!name) return;

        d3.select(this)
          .attr("stroke", "#000")
          .attr("stroke-width", 1.3);

        const countryIso = d.id;

        const outgoing = flowsOut.filter(f => f.destination_iso3 === countryIso);
        const incoming = flowsIn.filter(f => f.origin_iso3 === countryIso);

        const totalOut = d3.sum(outgoing, f => f.migrants_millions) || 0;
        const totalIn  = d3.sum(incoming, f => f.migrants_millions) || 0;

        tooltip.style("opacity",1).html(`
          <b>${name}</b><br>
<<<<<<< HEAD
          <span style="color:#D94F70">emigrants from ${country}:</span> ${totalOut.toFixed(2)}M<br>
          <span style="color:#3A71C4">immigrants to ${country}:</span> ${totalIn.toFixed(2)}M
=======
          <span style="color:#D94F70">emigrants from ${selectedName}:</span> ${totalOut.toFixed(2)}M<br>
          <span style="color:#3A71C4">immigrants to ${selectedName}:</span> ${totalIn.toFixed(2)}M
>>>>>>> 76219d9 (updates)
        `);
      })
      .on("mousemove", placeTooltip)
      .on("mouseout", function () {
        tooltip.style("opacity",0);
        d3.select(this).attr("stroke","#C8C8C8").attr("stroke-width",1);
      });

    // arc thickness
    const thick = d3.scaleSqrt()
      .domain([0, d3.max(flows, f => f.migrants_millions)])
      .range([1.3, 5]);

    function curvatureFor(f) {
      const o = centroids[f.origin_iso3];
      const d = centroids[f.destination_iso3];
      const dist = d3.geoDistance(o,d);
      return d3.scaleLinear().domain([0.2,1.5]).range([40,120]).clamp(true)(dist);
    }

    function arcPath(f) {
      const o = projection(centroids[f.origin_iso3]);
      const d = projection(centroids[f.destination_iso3]);
      const [sx,sy] = o;
      const [ex,ey] = d;
      const mx = (sx+ex)/2;
      const my = (sy+ey)/2;
      const curve = curvatureFor(f);
      const cy = my + (f.direction==="out" ? -curve : curve);
      return `M ${sx},${sy} Q ${mx},${cy} ${ex},${ey}`;
    }

    // draw arcs
    arcLayer.selectAll("path")
      .data(flows)
      .enter()
      .append("path")
      .attr("class","flow-arc")
      .attr("fill","none")
      .attr("stroke", f => f.direction === "out" ? "#D94F70" : "#3A71C4")
      .attr("stroke-width", f => thick(f.migrants_millions))
      .attr("stroke-opacity", 0.60)
      .attr("d", arcPath)
      .style("pointer-events","stroke")
      .on("mouseover", function(e,f){

        d3.selectAll(".flow-arc").attr("stroke-opacity",0.12);

        d3.select(this)
          .attr("stroke-opacity",1)
          .attr("stroke-width", thick(f.migrants_millions) + 1.2);

        tooltip.style("opacity",1).html(`
          <b>${f.direction==="out" ? "Emigration" : "Immigration"}</b><br>
          ${f.origin_country_name} → ${f.destination_country_name}<br>
          ${f.migrants_millions.toFixed(2)}M
        `);
      })
      .on("mousemove", placeTooltip)
      .on("mouseout", function(){

        tooltip.style("opacity",0);

        d3.selectAll(".flow-arc")
          .attr("stroke-opacity",0.60)
          .attr("stroke-width", f => thick(f.migrants_millions));
      });

    // particles along arcs
    const particles = flows.map(f => {

      const o = projection(centroids[f.origin_iso3]);
      const d = projection(centroids[f.destination_iso3]);
      const [sx,sy] = o;
      const [ex,ey] = d;

      const mx = (sx+ex)/2;
      const my = (sy+ey)/2;

      const curve = curvatureFor(f);
      const cy = my + (f.direction==="out" ? -curve : curve);

      return {
        t: Math.random(),
        speed: 0.002 + Math.random()*0.004,
        color: f.direction==="out" ? "#D94F70" : "#3A71C4",
        pathFn: t => {
          const x = (1-t)*(1-t)*sx + 2*(1-t)*t*mx + t*t*ex;
          const y = (1-t)*(1-t)*sy + 2*(1-t)*t*cy + t*t*ey;
          return [x,y];
        }
      };
    });

    function animate() {
      const c = particleLayer.selectAll("circle").data(particles);

      c.enter()
        .append("circle")
        .attr("r",2.3)
        .attr("fill", p => p.color)
        .merge(c)
        .each(function(p){
          p.t += p.speed;
          if (p.t > 1) p.t = 0;
          const [x,y] = p.pathFn(p.t);
          d3.select(this)
            .attr("cx",x)
            .attr("cy",y)
            .attr("opacity", 0.35 + p.t*0.4);
        });

      requestAnimationFrame(animate);
    }

    animate();

    // legend
    const legend = container.append("div")
      .attr("class","flow-legend")
      .style("position","absolute")
      .style("bottom","18px")
      .style("left","18px")
      .style("padding","10px 14px")
      .style("background","rgba(255,255,255,0.88)")
      .style("border","1px solid #ddd")
      .style("border-radius","10px")
      .style("font-size","13px")
      .style("box-shadow","0 2px 10px rgba(0,0,0,0.15)");

    legend.html(`
      <div><span style="color:#D94F70">●</span> emigration (outflows)</div>
      <div><span style="color:#3A71C4">●</span> immigration (inflows)</div>
      <div><span style="background:#FFD6E3;padding:2px 6px;border-radius:4px"></span> top destinations</div>
      <div><span style="background:#DCE8FF;padding:2px 6px;border-radius:4px"></span> top origins</div>
      <div style="margin-top:4px;color:#555;">particles show flow direction</div>
    `);
  });
}


// slider, play button, and top10 toggle

document.addEventListener("DOMContentLoaded", () => {

  const slider   = document.querySelector("#year-slider");
  const label    = document.querySelector("#year-label");
  const playBtn  = document.querySelector("#year-play");
  const limitBtn = document.querySelector("#flow-limit-btn");

  slider.addEventListener("input", () => {
    const y = +slider.value;
    if (!window.validYears.includes(y)) return;
    window.currentYear = y;
    label.textContent = y;
    init_spots_map(window.currentCountryISO, y, window.currentCountryName);
  });

  playBtn.addEventListener("click", () => {

    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.textContent = "▶";
      return;
    }

    playBtn.textContent = "⏸";

    playInterval = setInterval(() => {
      let idx = window.validYears.indexOf(window.currentYear);
      idx = (idx + 1) % window.validYears.length;
      const y = window.validYears[idx];
      window.currentYear = y;
      slider.value = y;
      label.textContent = y;
      init_spots_map(window.currentCountryISO, y, window.currentCountryName);
    }, 900);
  });

  limitBtn.addEventListener("click", () => {
    if (window.flowLimit === "top10") {
      window.flowLimit = "all";
      limitBtn.textContent = "Show Top 10";
    } else {
      window.flowLimit = "top10";
      limitBtn.textContent = "Show All";
    }
    init_spots_map(window.currentCountryISO, window.currentYear, window.currentCountryName);
  });
});