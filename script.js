console.log("✅ script_v2.js loaded");


// shared margins & sizes for both line charts
const lineMargin = { top: 40, right: 30, bottom: 50, left: 70 };
const lineWidth  = 900 - lineMargin.left - lineMargin.right;
const lineHeight = 400 - lineMargin.top  - lineMargin.bottom;

// robust number parser for CSV (handles blanks, commas, spaces)
const toNum = v => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/****************
 * MAIN CHART   *
 ****************/

const lineSvgRoot = d3.select("#chart")
  .append("svg")
  .attr("width",  lineWidth + lineMargin.left + lineMargin.right)
  .attr("height", lineHeight + lineMargin.top + lineMargin.bottom);

const lineSvg = lineSvgRoot.append("g")
  .attr("transform", `translate(${lineMargin.left},${lineMargin.top})`);

const xLine = d3.scaleLinear().range([0, lineWidth]);
const yLine = d3.scaleLinear().range([lineHeight, 0]);

const lineSeries = [
  { key: "Emigration",  color: "#d62728" }, // red
  { key: "Immigration", color: "#2ca02c" }, // green
  { key: "Net",         color: "#7f7f7f" }  // gray
];

const lineTooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

d3.csv("data/Totals.csv").then(raw => {
  raw.forEach(d => {
    d.Year        = +d.Year;
    d.Emigration  = toNum(d.Emigration);
    d.Immigration = toNum(d.Immigration);
    d.Net         = toNum(d.Net);
  });

  raw.sort((a, b) => a.Year - b.Year);

  xLine.domain(d3.extent(raw, d => d.Year));

  const allVals = [];
  raw.forEach(d => {
    lineSeries.forEach(s => {
      const v = d[s.key];
      if (Number.isFinite(v)) allVals.push(v);
    });
  });

  yLine.domain(d3.extent(allVals)).nice();

  // axes
  lineSvg.append("g")
    .attr("transform", `translate(0,${lineHeight})`)
    .call(d3.axisBottom(xLine).tickFormat(d3.format("d")));

  lineSvg.append("g")
    .call(d3.axisLeft(yLine).ticks(6).tickFormat(d3.format(",")));

  // labels
  lineSvg.append("text")
    .attr("x", lineWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Polish Migration 1966–2024");

  lineSvg.append("text")
    .attr("x", lineWidth / 2)
    .attr("y", lineHeight + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Year");

  lineSvg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -lineHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Number of migrants");

  // note about missing 2015
  lineSvg.append("text")
    .attr("x", lineWidth - 10)
    .attr("y", 10)
    .attr("text-anchor", "end")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#d62728")
    .text("Data for 2015 is missing");

  // line generator with gaps for missing values
  const line = d3.line()
    .defined(d => Number.isFinite(d.value))
    .x(d => xLine(d.Year))
    .y(d => yLine(d.value));

  // reshape data for each series
  const seriesGroups = lineSvg.selectAll(".series")
    .data(lineSeries.map(s => ({
      ...s,
      values: raw.map(r => ({ Year: r.Year, value: r[s.key] }))
    })))
    .enter()
    .append("g")
    .attr("class", d => `series series-${d.key}`);

  // visible line
  seriesGroups.append("path")
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", d => d.color)
    .attr("stroke-width", 2)
    .attr("d", d => line(d.values));

  // focus dot
  seriesGroups.append("circle")
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .style("display", "none");

  function nearestValid(values, targetYear) {
    let bestIndex = -1;
    let bestDist = Infinity;
    values.forEach((p, i) => {
      if (!Number.isFinite(p.value)) return;
      const dist = Math.abs(p.Year - targetYear);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });
    return bestIndex;
  }

  // wide invisible path for hover & highlight
  seriesGroups.append("path")
    .attr("class", "hover-capture")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 15)
    .attr("pointer-events", "stroke")
    .attr("d", d => line(d.values))
    .on("mousemove", function (event, d) {
      // highlight this line
      lineSvg.selectAll(".line")
        .attr("opacity", 0.25)
        .attr("stroke-width", 2);
      d3.select(this.parentNode).select(".line")
        .attr("opacity", 1)
        .attr("stroke-width", 3.5);

      const [mx] = d3.pointer(event, lineSvg.node());
      const yearApprox = Math.round(xLine.invert(mx));
      const idx = nearestValid(d.values, yearApprox);
      if (idx < 0) {
        lineTooltip.style("display", "none");
        d3.select(this.parentNode).select("circle").style("display", "none");
        return;
      }
      const p = d.values[idx];

      d3.select(this.parentNode).select("circle")
        .style("display", null)
        .attr("cx", xLine(p.Year))
        .attr("cy", yLine(p.value));

      lineTooltip
        .style("display", "block")
        .html(
          `<strong>${d.key}</strong><br>` +
          `Year: ${p.Year}<br>` +
          `Value: ${d3.format(",")(p.value)}`
        )
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY + 12) + "px");
    })
    .on("mouseout", function () {
      lineSvg.selectAll(".line")
        .attr("opacity", 1)
        .attr("stroke-width", 2);
      d3.select(this.parentNode).select("circle").style("display", "none");
      lineTooltip.style("display", "none");
    });
}).catch(err => console.error("Totals (main) load error:", err));


/***********************
 * CUMULATIVE CHART    *
 ***********************/
d3.csv("data/Totals.csv").then(raw => {
  raw.forEach(d => {
    d.Year        = +d.Year;
    d.Emigration  = toNum(d.Emigration);
    d.Immigration = toNum(d.Immigration);
    d.Net         = toNum(d.Net);
  });

  raw.sort((a, b) => a.Year - b.Year);

  // cumulative sums
  let cumE = 0, cumI = 0, cumN = 0;
  const cumData = raw.map(d => {
    cumE += d.Emigration  || 0;
    cumI += d.Immigration || 0;
    cumN += d.Net         || 0;
    return {
      Year: d.Year,
      CumEmigration:  cumE,
      CumImmigration: cumI,
      CumNet:         cumN
    };
  });

  const cumMargin = lineMargin;
  const cumWidth  = lineWidth;
  const cumHeight = lineHeight;

  const cumSvgRoot = d3.select("#chart-cumulative")
    .append("svg")
    .attr("width",  cumWidth  + cumMargin.left + cumMargin.right)
    .attr("height", cumHeight + cumMargin.top  + cumMargin.bottom);

  const cumSvg = cumSvgRoot.append("g")
    .attr("transform", `translate(${cumMargin.left},${cumMargin.top})`);

  const xCum = d3.scaleLinear()
    .domain(d3.extent(cumData, d => d.Year))
    .range([0, cumWidth]);

  const allCumVals = [
    ...cumData.map(d => d.CumEmigration),
    ...cumData.map(d => d.CumImmigration),
    ...cumData.map(d => d.CumNet)
  ];

  const yCum = d3.scaleLinear()
    .domain(d3.extent(allCumVals))
    .nice()
    .range([cumHeight, 0]);

  // axes
  cumSvg.append("g")
    .attr("transform", `translate(0,${cumHeight})`)
    .call(d3.axisBottom(xCum).tickFormat(d3.format("d")));

  cumSvg.append("g")
    .call(d3.axisLeft(yCum).ticks(6).tickFormat(d3.format(",")));

  // labels
  cumSvg.append("text")
    .attr("x", cumWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Cumulative Polish migration 1966–2024");

  cumSvg.append("text")
    .attr("x", cumWidth / 2)
    .attr("y", cumHeight + 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Year");

  cumSvg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -cumHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Cumulative number of migrants");

  const cumSeries = [
    { key: "CumEmigration",  label: "Cumulative emigration",  color: "#d62728" },
    { key: "CumImmigration", label: "Cumulative immigration", color: "#2ca02c" },
    { key: "CumNet",         label: "Cumulative net",         color: "#7f7f7f" }
  ];

  const lineCum = d3.line()
    .x(d => xCum(d.Year))
    .y(d => yCum(d.value));

  const cumTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none");

  const cumGroups = cumSvg.selectAll(".cum-series")
    .data(cumSeries.map(s => ({
      ...s,
      values: cumData.map(d => ({
        Year: d.Year,
        value: d[s.key]
      }))
    })))
    .enter()
    .append("g")
    .attr("class", d => `cum-series ${d.key}`);

  // visible line
  cumGroups.append("path")
    .attr("class", "cum-line")
    .attr("fill", "none")
    .attr("stroke-width", 2)
    .attr("stroke", d => d.color)
    .attr("d", d => lineCum(d.values));

  // focus dot
  cumGroups.append("circle")
    .attr("class", "cum-focus")
    .attr("r", 4)
    .attr("fill", d => d.color)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .style("display", "none");

  // hover capture (same behavior as main chart)
  cumGroups.append("path")
    .attr("class", "cum-hover")
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 15)
    .attr("pointer-events", "stroke")
    .attr("d", d => lineCum(d.values))
    .on("mousemove", function (event, d) {

      // highlight hovered line, dim others
      cumSvg.selectAll(".cum-line")
        .attr("opacity", 0.25)
        .attr("stroke-width", 2);

      d3.select(this.parentNode).select(".cum-line")
        .attr("opacity", 1)
        .attr("stroke-width", 3.5);

      // nearest point by year
      const [mx] = d3.pointer(event, cumSvg.node());
      const yearApprox = Math.round(xCum.invert(mx));

      const point = d.values.reduce((best, p) => {
        if (!best) return p;
        return Math.abs(p.Year - yearApprox) < Math.abs(best.Year - yearApprox)
          ? p : best;
      }, null);

      if (!point || !Number.isFinite(point.value)) {
        cumTooltip.style("display", "none");
        d3.select(this.parentNode).select(".cum-focus").style("display", "none");
        return;
      }

      // show focus dot
      d3.select(this.parentNode).select(".cum-focus")
        .style("display", null)
        .attr("cx", xCum(point.Year))
        .attr("cy", yCum(point.value));

      // tooltip
      cumTooltip
        .style("display", "block")
        .html(
          `<strong>${d.label}</strong><br>` +
          `Year: ${point.Year}<br>` +
          `Value: ${d3.format(",")(point.value)}`
        )
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY + 12) + "px");
    })
    .on("mouseout", function () {

      // reset lines
      cumSvg.selectAll(".cum-line")
        .attr("opacity", 1)
        .attr("stroke-width", 2);

      // hide dot + tooltip
      d3.select(this.parentNode).select(".cum-focus").style("display", "none");
      cumTooltip.style("display", "none");
    });

}).catch(err => console.error("Totals (cumulative) load error:", err));


/************
 *   MAP    *
 ************/

const WORLDMAP_FILE = "data/basemaps/ne_50m_admin_0_countries.json";

function getName(f) {
  const p = f.properties || {};
  return (
    p.name ||
    p.ADMIN ||
    p.NAME ||
    p.NAME_LONG ||
    p.CNTRY_NAME ||
    p.SOVEREIGNT ||
    ""
  ).toString().trim();
}

const COUNTRY_ALIASES = new Map([
  ["usa", "united states of america"],
  ["united states", "united states of america"],
  ["west berlin", "germany"],
  ["federal republic of germany", "germany"],
  ["german democratic republic", "germany"],
  ["ussr", "russia"],
  ["czechia", "czech republic"],
  ["luxemburg", "luxembourg"],
  ["syrian", "syria"],
  ["republic of sount africa", "south africa"],
  ["tunezia", "tunisia"]
]);

function normName(n) {
  let key = (n || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "")
    .replace(/,? republic$/, "");

  if (COUNTRY_ALIASES.has(key)) {
    key = COUNTRY_ALIASES.get(key);
  }
  return key;
}

const btnPrev   = document.getElementById("btn-prev");
const btnPlay   = document.getElementById("btn-play");
const btnNext   = document.getElementById("btn-next");
const yearRange = document.getElementById("year-range");
const yearLabel = document.getElementById("year-label");

const mapMargin = { top: 40, right: 24, bottom: 50, left: 70 };
const mapWidth  = 900 - mapMargin.left - mapMargin.right;
const mapHeight = 500 - mapMargin.top  - mapMargin.bottom;

const mapSvgRoot = d3.select("#map")
  .append("svg")
  .attr("width",  mapWidth + mapMargin.left + mapMargin.right)
  .attr("height", mapHeight + mapMargin.top  + mapMargin.bottom);

const mapSvg = mapSvgRoot.append("g")
  .attr("transform", `translate(${mapMargin.left},${mapMargin.top})`);

const mapTitle = mapSvg.append("text")
  .attr("x", mapWidth - 10)
  .attr("y", -10)
  .attr("text-anchor", "end")
  .style("font-size", "16px")
  .style("font-weight", "bold");

const mapYear = mapSvg.append("text")
  .attr("class", "map-year")
  .attr("x", 10)
  .attr("y", 20)
  .attr("text-anchor", "start")
  .style("font-size", "18px")
  .style("font-weight", "bold");

const missingNote = mapSvg.append("text")
  .attr("class", "missing-note")
  .attr("x", 0)
  .attr("y", mapHeight - 50)
  .attr("text-anchor", "start")
  .style("font-size", "13px")
  .style("font-weight", "bold")
  .style("fill", "#d62728")
  .style("display", "none")
  .text("Data for 2015 is missing");

const eventNote = mapSvg.append("text")
  .attr("class", "event-note")
  .attr("x", 0)
  .attr("y", mapHeight - 50)
  .attr("text-anchor", "start")
  .style("font-size", "16px")
  .style("font-weight", "bold")
  .style("fill", "#d62728")
  .style("display", "none");

const mapEvents = [
  { year: 1989, label: "1989: Fall of Berlin Wall" },
  { year: 2004, label: "2004: Poland joins the EU" },
  { year: 2007, label: "2007: Poland joins Schengen" },
  { year: 2011, label: "2011: Germany & Austria open labour markets" },
  { year: 2022, label: "2022: Full-scale war in Ukraine" }
];

const mapTooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

let worldFeatures = [];
let emigTable     = [];
let mapYears      = [];
let currentYear   = 1966;
let mapTimer      = null;
let mapProjection, mapPath, countryPaths;

Promise.all([
  d3.json(WORLDMAP_FILE),
  d3.csv("data/Emigration.csv")
]).then(([world, table]) => {
  worldFeatures = world.features;
  emigTable     = table;

  mapYears = emigTable.columns
    .filter(c => /^\d{4}$/.test(c))
    .map(Number)
    .sort((a, b) => a - b);

  currentYear = mapYears[0];

  yearRange.min   = mapYears[0];
  yearRange.max   = mapYears[mapYears.length - 1];
  yearRange.value = currentYear;
  yearLabel.textContent = `Year: ${currentYear}`;

  const fc = { type: "FeatureCollection", features: worldFeatures };
  mapProjection = d3.geoNaturalEarth1().fitSize([mapWidth, mapHeight], fc);
  mapPath = d3.geoPath(mapProjection);

  countryPaths = mapSvg.selectAll("path.country")
    .data(worldFeatures, f => getName(f))
    .join("path")
    .attr("class", "country")
    .attr("d", mapPath)
    .attr("stroke", "#555")
    .attr("stroke-width", 0.3);

  updateMapForYear(currentYear);

  btnPrev.addEventListener("click", () => stepYear(-1));
  btnNext.addEventListener("click", () => stepYear(1));
  btnPlay.addEventListener("click", togglePlay);
  yearRange.addEventListener("input", e => {
    currentYear = +e.target.value;
    updateMapForYear(currentYear);
  });
}).catch(err => console.error("Map load error:", err));

function updateMapForYear(year) {
  mapTitle.text(`Emigration by country — ${year}`);
  yearLabel.textContent = `Year: ${year}`;

  missingNote.style("display", year === 2015 ? null : "none");

  const ev = mapEvents.find(e => e.year === year);
  if (ev) eventNote.style("display", null).text(ev.label);
  else eventNote.style("display", "none");

  const values = new Map();
  for (const row of emigTable) {
    const key = normName(row.Country);
    const raw = row[year] ?? "";
    const val = +String(raw).replace(/[, ]/g, "");
    if (Number.isFinite(val) && val > 0) values.set(key, val);
  }

  const valsInView = worldFeatures
    .map(f => values.get(normName(getName(f))) || 0)
    .filter(v => v > 0);

  const colorScale = d3.scaleSequential(d3.interpolateReds)
    .domain([Math.log(1), Math.log(d3.max(valsInView) || 1)]);

  const fmt = d3.format(",");

  countryPaths
    .attr("fill", f => {
      const v = values.get(normName(getName(f))) || 0;
      return v > 0 ? colorScale(Math.log(v)) : "#eee";
    })
    .on("mousemove", (event, f) => {
      const name = getName(f);
      const v = values.get(normName(name));
      const valueText = (v != null && Number.isFinite(v)) ? fmt(v) : "No data";

      mapTooltip
        .style("display", "block")
        .html(`<strong>${name}</strong><br>${year}: ${valueText}`)
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY + 12) + "px");
    })
    .on("mouseout", () => {
      mapTooltip.style("display", "none");
    });
}

function stepYear(dir) {
  const i = mapYears.indexOf(currentYear);
  const j = Math.max(0, Math.min(mapYears.length - 1, i + dir));
  currentYear = mapYears[j];
  yearRange.value = currentYear;
  updateMapForYear(currentYear);
}

function togglePlay() {
  if (mapTimer) {
    clearInterval(mapTimer);
    mapTimer = null;
    btnPlay.textContent = "▶";
    return;
  }
  btnPlay.textContent = "⏸";
  mapTimer = setInterval(() => {
    const i = mapYears.indexOf(currentYear);
    currentYear = (i >= mapYears.length - 1) ? mapYears[0] : mapYears[i + 1];
    yearRange.value = currentYear;
    updateMapForYear(currentYear);
  }, 1200);
}

/***********************
 * CHART TOGGLE (ROBUST)
 ***********************/
window.addEventListener("DOMContentLoaded", () => {
  const chartDiv = document.getElementById("chart");
  const cumDiv = document.getElementById("chart-cumulative");
  const btn = document.getElementById("btn-toggle-chart");

  if (!chartDiv || !cumDiv || !btn) return;

  // default: show yearly, hide cumulative
  cumDiv.style.display = "none";
  chartDiv.style.display = "block";
  btn.textContent = "Switch to cumulative";

  let showing = "yearly";

  btn.addEventListener("click", () => {
    if (showing === "yearly") {
      chartDiv.style.display = "none";
      cumDiv.style.display = "block";
      btn.textContent = "Switch to yearly";
      showing = "cumulative";
    } else {
      cumDiv.style.display = "none";
      chartDiv.style.display = "block";
      btn.textContent = "Switch to cumulative";
      showing = "yearly";
    }
  });
});


