/* draw the migration line chart (emigrants + immigrants)
 * responsive to container width
 */
function draw_line_chart(data) {

  // clear chart
  const container = d3.select("#chart-line");
  container.selectAll("*").remove();

  // responsive scale based on width
  const parentWidth = container.node().getBoundingClientRect().width;

  const scale = d3.scaleLinear()
    .domain([320, 900])
    .range([1.0, 1.5])
    .clamp(true)(parentWidth);

  const width  = parentWidth;
  const height = 240 * scale;

  const margin = {
    top: 24 * scale,
    right: 30 * scale,
    bottom: 32 * scale,
    left: 48 * scale
  };

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  const chart = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // colors consistent with choropleth
  const COLOR_IMMIGRANTS = "#3F6FBF";
  const COLOR_EMIGRANTS  = "#D8347E";

  // scales
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => Math.max(d.emigrants, d.immigrants))])
    .nice()
    .range([innerH, 0]);

  const tooltip = d3.select("#line-tooltip");

  // line generators
  const lineEm = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.emigrants));

  const lineIm = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.immigrants));

  // draw lines
  animateLine(chart, data, scale, lineEm, COLOR_EMIGRANTS);
  animateLine(chart, data, scale, lineIm, COLOR_IMMIGRANTS);

  // dots and labels
  addDots(chart, data, x, y, scale, tooltip, "emigrants", COLOR_EMIGRANTS, "dot-em");
  addDots(chart, data, x, y, scale, tooltip, "immigrants", COLOR_IMMIGRANTS, "dot-im");

  // axes
  chart.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
    .selectAll("text")
    .style("font-size", `${11 * scale}px`);

  chart.append("g")
    .call(d3.axisLeft(y).ticks(6))
    .selectAll("text")
    .style("font-size", `${11 * scale}px`);
}


/**
 * animate one line being drawn left → right
 */
function animateLine(chart, data, scale, lineFn, color) {

  const path = chart.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 2.2 * scale)
    .attr("d", lineFn);

  const total = path.node().getTotalLength();

  path
    .attr("stroke-dasharray", `${total} ${total}`)
    .attr("stroke-dashoffset", total)
    .transition()
    .duration(1600)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  return path;
}


/**
 * add a dot and a small label for each data point
 */
function addDots(chart, data, x, y, scale, tooltip, field, color, cls) {

  const groups = chart.selectAll(`g.${cls}`)
    .data(data)
    .enter()
    .append("g")
    .attr("class", cls)
    .style("cursor", "pointer");

  // circle
  groups.append("circle")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d[field]))
    .attr("r", 6 * scale)
    .attr("fill", "white")
    .attr("stroke", color)
    .attr("stroke-width", 2 * scale)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.year}</strong><br>
          ${field}: ${d[field].toFixed(2)}M
        `);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY - 20}px`);
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // text label
  groups.append("text")
    .attr("x", d => x(d.year))
    .attr("y", d => y(d[field]) - 10 * scale)
    .attr("text-anchor", "middle")
    .attr("font-size", `${11 * scale}px`)
    .attr("fill", color)
    .text(d => d[field].toFixed(1));
}
