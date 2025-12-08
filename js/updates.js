//Narrative Controller

function safe(value, fallback = "NA") {
  return value == null || isNaN(value) ? fallback : value;
}

function pctChange(oldVal, newVal) {
  if (!oldVal || isNaN(oldVal)) return 0;
  return ((newVal - oldVal) / oldVal) * 100;
}

function normalizeName(s) {
  return s
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function updateChart(step) {

  // all data is ready
  if (!storyData || !globalData.length || !window.fullCSV) return;

  const country = globalData[0].country;


  const blue = "#3A71C4";   // Immigration
  const pink = "#D94F70";   // Emigration

  const firstYear = storyData.firstYear;
  const lastYear  = storyData.lastYear;

  const lastEm = storyData.lastEm;
  const lastIm = storyData.lastIm;

  const initialEm = globalData[0].emigrants;
  const initialIm = globalData[0].immigrants;

  const emChange = pctChange(initialEm, lastEm);
  const imChange = pctChange(initialIm, lastIm);




  if (step === 1) {
    graphicMain.textContent = `Migration patterns in ${country}`;
    graphicNote.innerHTML = `
      Since <strong>${firstYear}</strong>, migration flows involving 
      <strong>${country}</strong> have changed significantly over time.  
      Emigration (<span style="color:${pink}; font-weight:700;">pink</span>) and 
      immigration (<span style="color:${blue}; font-weight:700;">blue</span>) follow 
      distinct long-term trajectories.
    `;
  }

  if (step === 2) {
    graphicMain.textContent = `How migration flows changed over time`;
    graphicNote.innerHTML = `
      Between <strong>${firstYear}</strong> and <strong>${lastYear}</strong>:
      <ul style="margin-top:6px;">
        <li><span style="color:${pink}; font-weight:700;">Emigration</span> changed by 
            <strong>${safe(emChange.toFixed(1))}%</strong></li>
        <li><span style="color:${blue}; font-weight:700;">Immigration</span> changed by 
            <strong>${safe(imChange.toFixed(1))}%</strong></li>
      </ul>
      ${storyData.crossingN || ""}
    `;
  }

  if (step === 3) {
    graphicMain.textContent = `Where things stand today`;
    graphicNote.innerHTML = `
      In <strong>${lastYear}</strong>, <strong>${country}</strong> shows:
      <ul style="margin-top:6px;">
        <li><span style="color:${pink}; font-weight:700;">${safe(lastEm.toFixed(2))}M emigrants</span></li>
        <li><span style="color:${blue}; font-weight:700;">${safe(lastIm.toFixed(2))}M immigrants</span></li>
      </ul>
      Overall pattern: <strong>${storyData.dominantFlow || "NA"}</strong>.
    `;
  }

}

window.updateChart = updateChart;
