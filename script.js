// --- sizing ---
const margin = { top: 40, right: 24, bottom: 50, left: 70 },
      width  = 900 - margin.left - margin.right,
      height = 500 - margin.top  - margin.bottom;

// --- svg root ---
const svg = d3.select("#chart")
  .append("svg")
  .attr("width",  width  + margin.left + margin.right)
  .attr("height", height + margin.top  + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Chart title inside SVG
svg.append("text")
  .attr("x", width / 2)
  .attr("y", -10)  // position above the chart area
  .attr("text-anchor", "middle")
  .style("font-size", "18px")
  .style("font-weight", "bold")
  .text("Polish Migration 1966–2024");

// --- series config ---
const series = [
  { key: "Emigration",  color: "#d62728" }, // red
  { key: "Immigration", color: "#2ca02c" }, // green
  { key: "Net",         color: "#7f7f7f" }  // gray
];

// --- tooltip ---
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

// Robust number parser: handles blanks, spaces, "35,000"
const toNum = v => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, "").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
};

// Load CSV (note capital T to match your file)
d3.csv("data/Totals.csv").then(raw => {
  // parse
  raw.forEach(d => {
    d.Year        = +d.Year;
    d.Emigration  = toNum(d.Emigration);
    d.Immigration = toNum(d.Immigration);
    d.Net         = toNum(d.Net);
  });

  // keep in chronological order
  raw.sort((a, b) => a.Year - b.Year);

  // x scale
  const x = d3.scaleLinear()
    .domain(d3.extent(raw, d => d.Year))
    .range([0, width]);

  // collect all numeric values across series to set y domain
  const allVals = [];
  for (const r of raw) {
    for (const s of series) {
      const v = r[s.key];
      if (Number.isFinite(v)) allVals.push(v);
    }
  }

  const y = d3.scaleLinear()
    .domain(d3.extent(allVals))
    .nice()
    .range([height, 0]);

  // axes
  svg.append("g")
     .attr("transform", `translate(0,${height})`)
     .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g").call(d3.axisLeft(y));

  // axis labels
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 5)
    .attr("text-anchor", "middle")
    .text("Year");

  svg.append("text")
    .attr("x", -height / 2)
    .attr("y", -50)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Number of People");

  // line generator (skip any non-finite values so 2015 creates a gap)
  const line = d3.line()
    .defined(d => Number.isFinite(d.value))
    .x(d => x(d.Year))
    .y(d => y(d.value));

  // reshape into series -> values
  const sGroup = svg.selectAll(".series")
    .data(series.map(s => ({
      ...s,
      values: raw.map(r => ({ Year: r.Year, value: r[s.key] }))
    })))
    .enter()
    .append("g")
    .attr("class", d => `series series-${d.key}`);

  // visible line
  sGroup.append("path")
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke-width", 2)
    .attr("stroke", d => d.color)
    .attr("d", d => line(d.values));

  // focus dot (appears on hover)
  sGroup.append("circle")
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .style("display", "none");

  // helper: find nearest VALID (non-null) point to a given year
  function nearestValid(values, targetYear) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (!Number.isFinite(v.value)) continue;
      const dist = Math.abs(v.Year - targetYear);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
  }

  // wide invisible path to capture hover and enable highlight/tooltip
  sGroup.append("path")
    .attr("class", "hover-capture")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 15)
    .attr("pointer-events", "stroke")
    .attr("d", d => line(d.values))
    .on("mousemove", function (event, d) {
      // highlight this series
      svg.selectAll(".line").attr("opacity", 0.25).attr("stroke-width", 2);
      d3.select(this.parentNode).select(".line").attr("opacity", 1).attr("stroke-width", 3.5);

      // position along x
      const [mx] = d3.pointer(event, svg.node());
      const year = Math.round(x.invert(mx));

      // get nearest valid point for this series
      const idx = nearestValid(d.values, year);
      if (idx < 0) {
        tooltip.style("display", "none");
        d3.select(this.parentNode).select("circle").style("display", "none");
        return;
      }
      const p = d.values[idx];

      // move/show focus dot
      d3.select(this.parentNode).select("circle")
        .style("display", null)
        .attr("cx", x(p.Year))
        .attr("cy", y(p.value));

      // show tooltip
      const format = d3.format(",");
      tooltip
        .style("display", null)
        .html(`<strong>${d.key}</strong><br>Year: ${p.Year}<br>Value: ${format(p.value)}`)
        .style("left", (event.clientX + 14) + "px")
        .style("top",  (event.clientY + 14) + "px");
    })
    .on("mouseout", function () {
      // reset highlight + hide focus/tooltip
      svg.selectAll(".line").attr("opacity", 1).attr("stroke-width", 2);
      d3.select(this.parentNode).select("circle").style("display", "none");
      tooltip.style("display", "none");
    });

  // No legend or end-of-line labels (per your request)
});
