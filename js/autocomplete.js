/**
 * AUTOCOMPLETE
 * -------------------------------------------------
 * Loads the country list from the bilateral CSV,
 * builds the dropdown,
 * and updates all charts when the user picks a country.
 */

console.log("Autocomplete module loaded.");

const searchInput = document.getElementById("country-search");
const listBox     = document.getElementById("autocomplete-list");

let countryList = [];
let selectedCountry = "Mexico"; 
window.selectedCountry = selectedCountry;   // make it globally


// Load all ucountry names from the CSV
function loadCountryList() {
  d3.csv("data/clean/migration_bilateral_clean.csv").then(rows => {
    
    const names = new Set();

    rows.forEach(row => {
      if (row.origin_country_name) names.add(row.origin_country_name.trim());
      if (row.destination_country_name) names.add(row.destination_country_name.trim());
    });

    countryList = Array.from(names).sort();

    console.log("Countries loaded:", countryList.length);

    // default selection
    searchInput.value = selectedCountry;
  });
}


//  filtered suggestions in the dropdown
function showAutocompleteList(value) {
  listBox.innerHTML = "";
  if (!value) return;

  const results = countryList
    .filter(c => c.toLowerCase().startsWith(value.toLowerCase()))

  results.forEach(country => {
    const item = document.createElement("div");
    item.classList.add("autocomplete-item");
    item.textContent = country;

    item.addEventListener("click", () => {
      selectCountry(country);
    });

    listBox.appendChild(item);
  });
}


// When the user selects a country
function selectCountry(country) {
  selectedCountry = country;
  window.selectedCountry = country;

  searchInput.value = country;
  listBox.innerHTML = "";

  console.log("Selected country:", country);

  // Trigger all visualizations to update
  if (window.updateAllCharts) {
    window.updateAllCharts(country);
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
