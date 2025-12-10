/**
 * Loads the country list from the bilateral CSV,
 * builds the dropdown,
 * and updates all charts when the user picks a country.*/

console.log("Autocomplete module loaded.");

const searchInput = document.getElementById("country-search");
const listBox     = document.getElementById("autocomplete-list");

let countryList = [];
let selectedCountry = "Mexico"; 
let selectedCountryISO = "MEX";

const isoToName = window.isoToName = window.isoToName || {};
const nameToIso = window.nameToIso = window.nameToIso || {};

window.selectedCountry    = selectedCountry;   // make it globally
window.selectedCountryISO = selectedCountryISO;


// Load all ucountry names from the CSV
function loadCountryList() {
  d3.csv("data/clean/country_migration_totals.csv").then(rows => {
    
    const seen = new Set();

    rows.forEach(row => {
      const iso = (row.iso3 || "").trim();
      const name = (row.country || "").trim();
      if (!iso || !name || seen.has(iso)) return;
      seen.add(iso);
      countryList.push({ name, iso });
      isoToName[iso] = name;
      nameToIso[name.toLowerCase()] = iso;
    });

    countryList.sort((a,b) => a.name.localeCompare(b.name));

    console.log("Countries loaded:", countryList.length);

    // default selection
    selectedCountryISO = selectedCountryISO || countryList[0]?.iso || "MEX";
    selectedCountry    = isoToName[selectedCountryISO] || selectedCountry;
    searchInput.value  = selectedCountry;
    window.selectedCountry    = selectedCountry;
    window.selectedCountryISO = selectedCountryISO;
  });
}


//  filtered suggestions in the dropdown
function showAutocompleteList(value) {
  listBox.innerHTML = "";
  if (!value) return;

  const results = countryList
    .filter(c => c.name.toLowerCase().startsWith(value.toLowerCase()))

  results.forEach(country => {
    const item = document.createElement("div");
    item.classList.add("autocomplete-item");
    item.textContent = country.name;

    item.addEventListener("click", () => {
      selectCountry(country.name, country.iso);
    });

    listBox.appendChild(item);
  });
}


// When the user selects a country
function selectCountry(countryName, countryISO) {
  const iso = (countryISO && countryISO.length === 3)
    ? countryISO.toUpperCase()
    : (nameToIso[countryName.toLowerCase()] || selectedCountryISO);

  selectedCountry    = countryName;
  selectedCountryISO = iso;

  window.selectedCountry    = countryName;
  window.selectedCountryISO = iso;

  searchInput.value = countryName;
  listBox.innerHTML = "";

  console.log("Selected country:", countryName, "ISO:", iso);

  // Trigger all visualizations to update
  if (window.updateAllCharts) {
    window.updateAllCharts(iso);
  }
}


//  listeners
searchInput.addEventListener("input", () => {
  showAutocompleteList(searchInput.value);
});

document.addEventListener("click", (e) => {
  if (e.target !== searchInput) {
    listBox.innerHTML = "";
  }
});


// Initialize
loadCountryList();
