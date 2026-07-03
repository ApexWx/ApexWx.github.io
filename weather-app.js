// ======================================================
// GLOBALS & CONSTANTS
// ======================================================
const workerUrl = "https://apexwx-observations.maineapexwx.workers.dev";

// Paste your entire climateRecords dictionary here
const climateRecords = {
  "01-01": { high: [48, 1937], low: [-37, 1972], rain: [0.77, 1945] },
  // ... [Keep your full 365-day dictionary here] ...
  "12-31": { high: [47, 1936], low: [-24, 1937], rain: [0.94, 1942] }
};

// ======================================================
// UTILITY FUNCTIONS
// ======================================================
function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 12 && day >= 21) || (month <= 2) || (month === 3 && day < 20)) return "winter";
  if ((month === 3 && day >= 20) || (month >= 4 && month <= 5) || (month === 6 && day < 21)) return "spring";
  if ((month === 6 && day >= 21) || (month >= 7 && month <= 8) || (month === 9 && day < 22)) return "summer";
  return "fall";
}

function getSeasonEmoji(season) {
  switch (season) {
    case "winter": return "❄️";
    case "spring": return "🌸";
    case "summer": return "☀️";
    case "fall": return "🍂";
    default: return "";
  }
}

function degreesToCompass(degrees) {
  const directions = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return directions[Math.round(degrees / 22.5) % 16];
}

// Kept global so inline HTML onclick="" attributes can access them
function toggleMenu() {
  document.getElementById('menuLinks').classList.toggle('show');
}

function dismissAlert(alertId) {
  let dismissed = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");
  if (!dismissed.includes(alertId)) {
    dismissed.push(alertId);
    localStorage.setItem("dismissedAlertIds", JSON.stringify(dismissed));
  }
  const alertBox = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (alertBox) alertBox.style.display = 'none';
}

function toggleAlert(alertId, fullText) {
  const descEl = document.getElementById(`desc-${alertId}`);
  const btn = descEl.nextElementSibling;
  if (btn.textContent === "Read more") {
    descEl.textContent = fullText;
    btn.textContent = "Show less";
  } else {
    descEl.textContent = fullText.slice(0, 300).trim() + "...";
    btn.textContent = "Read more";
  }
}

// ======================================================
// UPDATE FUNCTIONS (Time & Greetings)
// ======================================================
function updateLocalTime() {
  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  let hour = now.getHours();
  const minute = now.getMinutes().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;
  
  const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName').value;
  document.getElementById("localTime").textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} at ${hour}:${minute} ${ampm} ${tz}`;
}

function updateDualTime() {
  const now = new Date();
  const tz = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName').value;
  document.getElementById("local24Time").textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} ${tz}`;
  document.getElementById("utcTime").textContent = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')} UTC`;
}

function updateGreeting() {
  const hrs = new Date().getHours();
  let greet = (hrs >= 3 && hrs < 12) ? 'Good Morning!' : 
              (hrs >= 12 && hrs <= 17) ? 'Good Afternoon!' : 
              (hrs > 17) ? 'Good Evening!' : 'Good Early Morning!';
  document.getElementById('lblGreetings').innerHTML = `<b>${greet}</b>`;
}

function setSeasonDisplay() {
  const season = getCurrentSeason();
  const emoji = getSeasonEmoji(season);
  const displayDiv = document.getElementById("season-display");
  if (displayDiv) {
    displayDiv.textContent = `${emoji} Current season: ${season.charAt(0).toUpperCase() + season.slice(1)} ${emoji}`;
    displayDiv.classList.add(season);
  }
}

// ======================================================
// ASYNC FETCH FUNCTIONS
// ======================================================
async function fetchNWSAlerts() {
  try {
    const response = await fetch(`https://api.weather.gov/alerts/active/zone/MEZ001`);
    const data = await response.json();
    const alertDiv = document.getElementById("weatherAlert");
    const storedDismissedIds = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");

    if (data.features.length > 0) {
      alertDiv.innerHTML = "";
      data.features.forEach((feature) => {
        const alert = feature.properties;
        const alertId = feature.id;
        if (storedDismissedIds.includes(alertId)) return;

        const severityRaw = alert.severity || "Unknown";
        const severity = severityRaw.toLowerCase();
        const severityClass = { minor: "alert-minor", moderate: "alert-moderate", severe: "alert-severe", extreme: "alert-extreme" }[severity] || "alert-moderate";
        const shouldCollapse = alert.description.length > 300 && !["severe", "extreme"].includes(severity);
        
        const alertBox = document.createElement("div");
        alertBox.className = `alert-box ${severityClass}`;
        alertBox.setAttribute("data-alert-id", alertId);
        alertBox.innerHTML = `
          <button class="alert-close" onclick="dismissAlert('${alertId}')" aria-label="Dismiss alert">&times;</button>
          <strong>⚠️ Weather Alert (${severityRaw === "Unknown" ? "Severity Unknown" : severityRaw}):</strong>
          <strong>${alert.headline}</strong>
          <div class="alert-description" id="desc-${alertId}">
            ${shouldCollapse ? alert.description.slice(0, 300).trim() + "..." : alert.description}
          </div>
          ${shouldCollapse ? `<button class="alert-toggle" onclick="toggleAlert('${alertId}', \`${alert.description.replace(/`/g, "\\`")}\`)">Read more</button>` : ""}
          <div style="margin-top: 8px;"><a href="${alert.url || "https://www.weather.gov/car/"}" target="_blank" rel="noopener">View full alert from NWS</a></div>
          <div style="margin-top: 6px; font-size: 0.9em; color: #555;">Last updated: ${new Date(alert.sent).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })}</div>
        `;
        alertDiv.appendChild(alertBox);
      });
    } else {
      alertDiv.innerHTML = "";
    }
  } catch (error) {
    console.error("NWS Alert fetch error:", error);
    document.getElementById("weatherAlert").innerText = "Unable to load weather alerts.";
  }
}

async function fetchForecast() {
  try {
    const response = await fetch('https://api.weather.gov/points/47.25,-68.58');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const forecastResponse = await fetch((await response.json()).properties.forecast);
    
    document.getElementById('forecast').innerHTML = (await forecastResponse.json()).properties.periods.map(p => `
      <div class="fw-item">
        <img loading="lazy" src="${p.icon}" alt="${p.shortForecast}" />
        <div class="fw-text"><span class="fw-day">${p.name}:</span> ${p.detailedForecast}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching weather:', error);
    document.getElementById('forecast').textContent = 'Failed to load forecast.';
  }
}

// Note: Ensure your full updateStation code is pasted inside here. I have collapsed it slightly for readability.
async function updateStation() {
  try {
    const response = await fetch(`${workerUrl}?t=${Date.now()}`);
    if (!response.ok) throw new Error("Worker unavailable");
    const data = await response.json();
    
    // Paste all your original DOM updates here (temp, dewpoint, pressure history calculation, etc.)
    // Example:
    document.getElementById("temp").innerHTML = data.temperature != null ? `${data.temperature.toFixed(1)}°F<br><span class="metric">${((data.temperature - 32) * 5 / 9).toFixed(1)}°C</span>` : "--";
    // ... rest of your DOM updates ...

    document.getElementById("aw-update").textContent = new Date(data.timestamp).toLocaleString();
  } catch (error) {
    console.error(error);
    document.getElementById("aw-update").textContent = "Unable to retrieve station data";
  }
}

// Note: Ensure your full loadClimateData code is pasted inside here. 
async function loadClimateData() {
  try {
    const response = await fetch("https://fortkent-acis.maineapexwx.workers.dev/");
    const climate = await response.json();
    
    // Paste all your original climate logic and DOM updates here
    // ...

    document.getElementById("climate-update").textContent = new Date().toLocaleString();
  } catch(error) {
    console.error("Climate data error:", error);
    document.getElementById("climate-update").textContent = "Unable to retrieve climate data";
  }
}

async function loadFortKentAstroData() {
  try {
    const response = await fetch('https://moon-api.maineapexwx.workers.dev/');
    if (!response.ok) throw new Error("Astro API error.");
    const data = await response.json();

    document.getElementById('astro-date').textContent = data.date_label;
    document.getElementById('astro-sunrise').textContent = data.sunrise;
    document.getElementById('astro-sunset').textContent = data.sunset;
    document.getElementById("astro-dawn").textContent = data.dawn;
    document.getElementById("astro-dusk").textContent = data.dusk;
    document.getElementById('astro-day-length').textContent = data.day_length;
    document.getElementById('astro-moon-phase').textContent = data.moon_phase_display;
    document.getElementById('astro-moonset').textContent = data.moonset_display;
    document.getElementById('astro-moonrise').textContent = data.moonrise_display;
  } catch (error) {
    console.error("Failed to inject astro predictions:", error);
    document.getElementById('astro-date').textContent = "Data Temporarily Offline";
  }
}

// ======================================================
// INITIALIZATION
// ======================================================
function initializeApp() {
  // 1. Run immediate DOM updates
  setSeasonDisplay();
  updateLocalTime();
  updateDualTime();
  updateGreeting();
  
  // 2. Fetch initial data payloads
  fetchNWSAlerts();
  fetchForecast();
  updateStation();
  loadClimateData();
  loadFortKentAstroData();

  // 3. Establish Intervals
  setInterval(updateLocalTime, 60000);              // 1 min
  setInterval(updateDualTime, 60000);               // 1 min
  setInterval(updateGreeting, 60000);               // 1 min
  setInterval(updateStation, 60000);                // 1 min
  setInterval(fetchNWSAlerts, 15 * 60 * 1000);      // 15 mins
  setInterval(loadClimateData, 30 * 60 * 1000);     // 30 mins
  setInterval(fetchForecast, 3 * 60 * 60 * 1000);   // 3 hours
}

// Start everything only after the HTML is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);