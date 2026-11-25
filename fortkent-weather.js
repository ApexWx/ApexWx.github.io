/**
 * Apex Wx - Fort Kent Weather Core Script
 * Consolidated External Javascript
 */

// =========================================================================
// 1. GLOBAL UTILITY FUNCTIONS & EVENT HANDLERS
// =========================================================================

const NO_ALERTS_HTML = `<span style="font-size: 14px; color: #555555;">No Active Hazardous Weather Conditions issued by NWS</span>`;

// Seasons calculations
function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 12 && day >= 21) || (month <= 2) || (month === 3 && day < 20)) {
    return "winter";
  } else if ((month === 3 && day >= 20) || (month >= 4 && month <= 5) || (month === 6 && day < 21)) {
    return "spring";
  } else if ((month === 6 && day >= 21) || (month >= 7 && month <= 8) || (month === 9 && day < 22)) {
    return "summer";
  } else {
    return "fall";
  }
}

function getSeasonEmoji(season) {
  switch (season) {
    case "winter": return "❄️";
    case "spring": return "🌸";
    case "summer": return "☀️";
    case "fall":   return "🍂";
    default: return "";
  }
}

// Responsive navigation menu toggle (called by inline HTML onclick)
function toggleMenu() {
  const menu = document.getElementById('menuLinks');
  if (menu) {
    menu.classList.toggle('show');
  }
}

// Dismiss weather alert box (optimized to handle full URL alert IDs safely)
function dismissAlert(alertId) {
  const storedDismissedIds = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");
  if (!storedDismissedIds.includes(alertId)) {
    storedDismissedIds.push(alertId);
    localStorage.setItem("dismissedAlertIds", JSON.stringify(storedDismissedIds));
  }
  
  // Uses safe attribute lookup instead of querySelector('#' + URL) which crashes the engine
  const alertBox = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (alertBox) {
    alertBox.remove(); // Removes the alert container from view entirely
  }

  // Restore default message if no alert boxes remain visible
  const alertDiv = document.getElementById("weatherAlert");
  if (alertDiv && alertDiv.children.length === 0) {
    alertDiv.innerHTML = NO_ALERTS_HTML;
  }
}

// Toggle text expansion for collapsed alerts (class-based lookup to bypass URL characters)
function toggleAlert(alertId, fullDescription) {
  // Find the parent element box via its safe attribute wrapper
  const alertBox = document.querySelector(`[data-alert-id="${alertId}"]`);
  if (!alertBox) return;

  // Locate the internal classes instead of looking up problematic #IDs
  const descDiv = alertBox.querySelector('.alert-description');
  const toggleBtn = alertBox.querySelector('.alert-toggle');

  if (descDiv && toggleBtn) {
    const isCollapsed = toggleBtn.innerText === "Read more";
    if (isCollapsed) {
      descDiv.textContent = fullDescription;
      toggleBtn.innerText = "Read less";
    } else {
      descDiv.textContent = fullDescription.slice(0, 300).trim() + "...";
      toggleBtn.innerText = "Read more";
    }
  }
}

// Convert wind degrees to compass directions
function degreesToCompass(degrees) {
  const directions = [
    "N","NNE","NE","ENE",
    "E","ESE","SE","SSE",
    "S","SSW","SW","WSW",
    "W","WNW","NW","NNW"
  ];
  return directions[Math.round(degrees / 22.5) % 16];
}

// =========================================================================
// 2. DATA FETCHING & UI UPDATE FUNCTIONS
// =========================================================================

// Full long date-time string clock
function updateLocalTime() {
  const el = document.getElementById("localTime");
  if (!el) return;

  const now = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const day = now.getDate();
  const year = now.getFullYear();

  let hour = now.getHours();
  const minute = now.getMinutes().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12 || 12;

  const options = { timeZoneName: 'short' };
  const tz = new Intl.DateTimeFormat('en-US', options).formatToParts(now)
    .find(part => part.type === 'timeZoneName').value;

  el.textContent = `${dayName}, ${monthName} ${day}, ${year} at ${hour}:${minute} ${ampm} ${tz}`;
}

// Dual 24-Hour Clocks
function updateDualTime() {
  const now = new Date();
  const localEl = document.getElementById("local24Time");
  const utcEl = document.getElementById("utcTime");

  const tz = Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(now)
    .find(part => part.type === 'timeZoneName').value;

  if (localEl) {
    localEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${tz}`;
  }
  if (utcEl) {
    utcEl.textContent = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;
  }
}

// Active Weather Alerts from NWS
async function fetchNWSAlerts() {
  const alertDiv = document.getElementById("weatherAlert");
  if (!alertDiv) return;

  const zone = "MEZ001";
  const apiURL = `https://api.weather.gov/alerts/active/zone/${zone}`;

  try {
    const response = await fetch(apiURL);
    const data = await response.json();
    const storedDismissedIds = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");

    const activeFeatures = (data.features || []).filter(
      (feature) => !storedDismissedIds.includes(feature.id)
    );

    if (activeFeatures.length > 0) {
      alertDiv.innerHTML = "";

      activeFeatures.forEach((feature) => {
        const alert = feature.properties;
        const alertId = feature.id;

        const title = alert.headline;
        const description = alert.description || "";
        const severityRaw = alert.severity || "Unknown";
        const severity = severityRaw.toLowerCase();
        const link = alert.url || "https://www.weather.gov/car/";
        const updated = new Date(alert.sent).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/New_York'
        });

        const severityClass = {
          minor: "alert-minor",
          moderate: "alert-moderate",
          severe: "alert-severe",
          extreme: "alert-extreme"
        }[severity] || "alert-moderate";

        const shouldCollapse = description.length > 300 && !["severe", "extreme"].includes(severity);
        const shortText = description.slice(0, 300).trim() + "...";

        const alertBox = document.createElement("div");
        alertBox.className = `alert-box ${severityClass}`;
        alertBox.setAttribute("data-alert-id", alertId);
        alertBox.innerHTML = `
          <button class="alert-close" onclick="dismissAlert('${alertId}')" aria-label="Dismiss alert">&times;</button>
          <strong>⚠️ Weather Alert (${severityRaw === "Unknown" ? "Severity Unknown" : severityRaw}):</strong>
          <strong>${title}</strong>
          <div class="alert-description" id="desc-${alertId}">
            ${shouldCollapse ? shortText : description}
          </div>
          ${shouldCollapse ? `<button class="alert-toggle" id="btn-${alertId}">Read more</button>` : ""}
          <div style="margin-top: 8px;">
            <a href="${link}" target="_blank" rel="noopener">View full alert from NWS</a>
          </div>
          <div style="margin-top: 6px; font-size: 0.9em; color: #555;">
            Last updated: ${updated}
          </div>
        `;
        alertDiv.appendChild(alertBox);

        if (shouldCollapse) {
          const toggleBtn = alertBox.querySelector(".alert-toggle");
          if (toggleBtn) {
            toggleBtn.addEventListener('click', () => toggleAlert(alertId, description));
          }
        }
      });
    } else {
      alertDiv.innerHTML = NO_ALERTS_HTML;
    }
  } catch (error) {
    console.error("NWS Alert fetch error:", error);
    alertDiv.innerText = "Unable to load weather alerts.";
  }
}

// NWS 7-Day Text Forecast
async function fetchForecast() {
  const el = document.getElementById('forecast');
  if (!el) return;

  try {
    const response = await fetch('https://api.weather.gov/points/47.25,-68.58');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const pointData = await response.json();
    const forecastUrl = pointData.properties.forecast;

    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods;

    el.innerHTML = periods.map(p => `
      <div class="fw-item">
        <img loading="lazy" src="${p.icon}" alt="${p.shortForecast}" />
        <div class="fw-text">
          <span class="fw-day">${p.name}:</span> ${p.detailedForecast}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching weather:', error);
    el.textContent = 'Failed to load forecast.';
  }
}

// Interactive Welcome Greeting
function updateGreeting() {
  const el = document.getElementById('lblGreetings');
  if (!el) return;

  const hrs = new Date().getHours();
  let greet;
  if (hrs >= 3 && hrs < 12) greet = 'Good Morning!';
  else if (hrs >= 12 && hrs <= 17) greet = 'Good Afternoon!';
  else if (hrs > 17) greet = 'Good Evening!';
  else greet = 'Good Early Morning!';

  el.innerHTML = `<b>${greet}</b>`;
}

// Live Personal Weather Station Readings
async function updateStation() {
  const workerUrl = "https://apexwx-observations.maineapexwx.workers.dev";
  
  try {
    const response = await fetch(`${workerUrl}?t=${Date.now()}`);
    if (!response.ok) throw new Error("Worker unavailable");
    const data = await response.json();

    // DOM safe population variables
    const updateField = (id, htmlContent) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = htmlContent;
    };

    updateField("temp", data.temperature != null ? `${data.temperature.toFixed(1)}°F<br><span class="metric">${((data.temperature - 32) * 5 / 9).toFixed(1)}°C</span>` : "--");
    updateField("dewpoint", data.dewpoint != null ? `${data.dewpoint.toFixed(1)}°F<br><span class="metric">${((data.dewpoint - 32) * 5 / 9).toFixed(1)}°C</span>` : "--");
    
    const humEl = document.getElementById("humidity");
    if (humEl) humEl.textContent = data.humidity != null ? `${Math.round(data.humidity)}%` : "--";

    updateField("feels-like", data.feelsLike != null ? `${data.feelsLike.toFixed(1)}°F<br><span class="metric">${((data.feelsLike - 32) * 5 / 9).toFixed(1)}°C</span>` : "--");
    updateField("wind", data.windSpeed != null ? `${data.windSpeed.toFixed(1)} mph<br><span class="metric">${(data.windSpeed * 1.60934).toFixed(1)} km/h</span>` : "--");
    updateField("gust", data.windGust != null ? `${data.windGust.toFixed(1)} mph<br><span class="metric">${(data.windGust * 1.60934).toFixed(1)} km/h</span>` : "--");
    updateField("winddir", data.windDirection != null ? `${degreesToCompass(data.windDirection)}<br><span class="metric">${Math.round(data.windDirection)}°</span>` : "--");

    // Pressure tracker
    const pressureEl = document.getElementById("pressure");
    if (pressureEl) {
      if (data.pressure != null) {
        const inHg = data.pressure.toFixed(2);
        const hPa = (data.pressure * 33.86389).toFixed(1);
        const currentTimestamp = data.timestamp || Date.now();

        let history = [];
        try { history = JSON.parse(localStorage.getItem("apexwx_pressure_history")) || []; } catch (e) {}
        history.push({ time: currentTimestamp, val: data.pressure });
        history = history.filter(item => item.time >= currentTimestamp - 10800000); // 3 hours window
        localStorage.setItem("apexwx_pressure_history", JSON.stringify(history));

        const targetTime = currentTimestamp - 7200000; // 2 hours look back
        let closestItem = null, minDiff = Infinity;
        history.forEach(item => {
          if (currentTimestamp - item.time > 2700000) { // minimum 45 mins old
            const diff = Math.abs(item.time - targetTime);
            if (diff < minDiff) { minDiff = diff; closestItem = item; }
          }
        });

        let trendText = ` <span style="color: #999; font-weight: normal; font-size: 11px;">(Calculating trend...)</span>`;
        if (closestItem) {
          const delta = data.pressure - closestItem.val;
          if (delta >= 0.018) trendText = ` <span style="color: #5cb85c; font-weight: bold;">Rising ↗</span>`;
          else if (delta <= -0.018) trendText = ` <span style="color: #d9534f; font-weight: bold;">Falling ↘</span>`;
          else trendText = ` <span style="color: #777; font-weight: normal;">Steady —</span>`;
        }
        pressureEl.innerHTML = `${inHg} inHg<span class="metric">${hPa} hPa</span><span class="pressure-trend-line">${trendText}</span>`;
      } else {
        pressureEl.innerHTML = "--";
      }
    }

    updateField("rain", data.rainToday != null ? `${data.rainToday.toFixed(2)} in<br><span class="metric">${(data.rainToday * 25.4).toFixed(1)} mm</span>` : "--");
    updateField("maxdailygust", data.maxDailyGust != null ? `${data.maxDailyGust.toFixed(1)} mph<br><span class="metric">${(data.maxDailyGust * 1.609344).toFixed(1)} km/h</span>` : "--");
    updateField("rain-month", data.rainMonth != null ? `${Number(data.rainMonth).toFixed(2)} in<br><span class="metric">${(Number(data.rainMonth) * 25.4).toFixed(1)} mm</span>` : "--");
    updateField("rain-year", data.rainYear != null ? `${Number(data.rainYear).toFixed(2)} in<br><span class="metric">${(Number(data.rainYear) * 25.4).toFixed(1)} mm</span>` : "--");

    const updateEl = document.getElementById("aw-update");
    if (updateEl) updateEl.textContent = new Date(data.timestamp).toLocaleString();

  } catch (error) {
    console.error("Live station error:", error);
    const updateEl = document.getElementById("aw-update");
    if (updateEl) updateEl.textContent = "Unable to retrieve station data";
  }
}

// =========================================================================
// 2B. ASTRONOMY (PRIMARY WORKER + BUILT-IN NOAA/LUNAR OFFLINE BACKUP)
// =========================================================================

function calculateFallbackAstroData(dateStr, timeZone) {
  const lat = 47.2589;
  const lon = -68.5891;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const targetDateObj = new Date(`${dateStr}T12:00:00`);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset"
  }).formatToParts(targetDateObj).find(p => p.type === "timeZoneName")?.value || "GMT-05:00";
  const tzOffset = parseInt(offsetPart.replace("GMT", "").split(":")[0], 10) || -5;
  const tzName = tzOffset === -4 ? "EDT" : "EST";

  // NOAA Solar Equations for Civil Twilight (96°) & Sunrise/Sunset (90.833°)
  const [y, m, d] = dateStr.split("-").map(Number);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * ((m <= 2 ? m + 12 : m) + 1)) + d - 1524.5;
  const jc = (jd - 2451545.0) / 36525.0;

  const geomMeanLongSun = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const geomMeanAnomSun = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const eccentEarthOrbit = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const sunEqOfCtr = Math.sin(rad * geomMeanAnomSun) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
                     Math.sin(rad * 2 * geomMeanAnomSun) * (0.019993 - 0.000101 * jc) +
                     Math.sin(rad * 3 * geomMeanAnomSun) * 0.000289;
  const sunTrueLong = geomMeanLongSun + sunEqOfCtr;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(rad * (125.04 - 1934.136 * jc));
  const meanObliqEcliptic = 23 + (26 + ((21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60)) / 60;
  const obliqCorr = meanObliqEcliptic + 0.00256 * Math.cos(rad * (125.04 - 1934.136 * jc));
  const sunDeclin = deg * Math.asin(Math.sin(rad * obliqCorr) * Math.sin(rad * sunAppLong));

  const varY = Math.tan(rad * (obliqCorr / 2)) ** 2;
  const eqOfTime = 4 * deg * (
    varY * Math.sin(2 * rad * geomMeanLongSun) -
    2 * eccentEarthOrbit * Math.sin(rad * geomMeanAnomSun) +
    4 * eccentEarthOrbit * varY * Math.sin(rad * geomMeanAnomSun) * Math.cos(2 * rad * geomMeanLongSun) -
    0.5 * varY * varY * Math.sin(4 * rad * geomMeanLongSun) -
    1.25 * eccentEarthOrbit * eccentEarthOrbit * Math.sin(2 * rad * geomMeanAnomSun)
  );

  const solarNoonMin = 720 - 4 * lon - eqOfTime + tzOffset * 60;

  const getEventMinutes = (zenith) => {
    const cosHA = (Math.cos(rad * zenith) / (Math.cos(rad * lat) * Math.cos(rad * sunDeclin))) -
                  Math.tan(rad * lat) * Math.tan(rad * sunDeclin);
    if (cosHA < -1 || cosHA > 1) return null;
    const haDeg = deg * Math.acos(cosHA);
    return {
      riseMin: solarNoonMin - haDeg * 4,
      setMin: solarNoonMin + haDeg * 4
    };
  };

  const formatMins = (totalMins) => {
    if (totalMins == null) return "N/A";
    const mins = ((Math.round(totalMins) % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? "PM" : "AM";
    const dispH = h % 12 || 12;
    return `${dispH}:${String(m).padStart(2, "0")} ${ampm} ${tzName}`;
  };

  const sunEvents = getEventMinutes(90.833);
  const civilEvents = getEventMinutes(96.0);

  let dayLengthStr = "N/A";
  if (sunEvents) {
    const diffMins = Math.round(sunEvents.setMin - sunEvents.riseMin);
    dayLengthStr = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  }

  // Synodic Lunar Phase Calculation (Reference New Moon: 2000-01-06 18:14 UTC)
  const synodicMonth = 29.530588853;
  const refNewMoonMs = Date.UTC(2000, 0, 6, 18, 14, 0);
  const now = new Date();
  const cycles = (now.getTime() - refNewMoonMs) / (synodicMonth * 86400000);
  const age = ((cycles % 1) + 1) % 1; // 0.0 to 1.0

  let curPhaseDisplay = "🌖 Waning Gibbous";
  if (age < 0.03 || age >= 0.97) curPhaseDisplay = "🌑 New Moon";
  else if (age < 0.22) curPhaseDisplay = "🌒 Waxing Crescent";
  else if (age < 0.28) curPhaseDisplay = "🌓 First Quarter";
  else if (age < 0.47) curPhaseDisplay = "🌔 Waxing Gibbous";
  else if (age < 0.53) curPhaseDisplay = "🌕 Full Moon";
  else if (age < 0.72) curPhaseDisplay = "🌖 Waning Gibbous";
  else if (age < 0.78) curPhaseDisplay = "🌗 Last Quarter";
  else curPhaseDisplay = "🌘 Waning Crescent";

  // Next 4 Major Lunar Quarters
  const majorPhases = [
    { frac: 0.0,  name: "New Moon",      emoji: "🌑" },
    { frac: 0.25, name: "First Quarter", emoji: "🌓" },
    { frac: 0.5,  name: "Full Moon",     emoji: "🌕" },
    { frac: 0.75, name: "Last Quarter",  emoji: "🌗" }
  ];

  const baseCycle = Math.floor(cycles);
  const upcoming = [];
  for (let c = baseCycle; c <= baseCycle + 2; c++) {
    for (const mp of majorPhases) {
      const eventMs = refNewMoonMs + (c + mp.frac) * synodicMonth * 86400000;
      if (eventMs > now.getTime()) {
        const dt = new Date(eventMs);
        upcoming.push({
          emoji: mp.emoji,
          date: dt.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" }),
          name: mp.name,
          ts: eventMs
        });
      }
    }
  }
  upcoming.sort((a, b) => a.ts - b.ts);

  return {
    date_label: targetDateObj.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    }),
    dawn: civilEvents ? formatMins(civilEvents.riseMin) : "N/A",
    sunrise: sunEvents ? formatMins(sunEvents.riseMin) : "N/A",
    sunset: sunEvents ? formatMins(sunEvents.setMin) : "N/A",
    dusk: civilEvents ? formatMins(civilEvents.setMin) : "N/A",
    day_length: dayLengthStr,
    moon_phase_display: curPhaseDisplay,
    moonset_display: "Unavailable (USNO offline)",
    moonrise_display: "Unavailable (USNO offline)",
    upcoming_phases: upcoming.slice(0, 4)
  };
}

function renderAstroData(data) {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt("astro-date", data.date_label);
  setTxt("astro-sunrise", data.sunrise);
  setTxt("astro-sunset", data.sunset);
  setTxt("astro-dawn", data.dawn);
  setTxt("astro-dusk", data.dusk);
  setTxt("astro-day-length", data.day_length);
  setTxt("astro-moon-phase", data.moon_phase_display);
  setTxt("astro-moonset", data.moonset_display);
  setTxt("astro-moonrise", data.moonrise_display);

  const moonGrid = document.getElementById("moon-phase-grid");
  if (moonGrid && Array.isArray(data.upcoming_phases) && data.upcoming_phases.length > 0) {
    moonGrid.innerHTML = data.upcoming_phases
      .map(item => `
        <div class="moon-phase-item">
          ${item.emoji} <strong>${item.date}</strong><br>
          ${item.name}
        </div>
      `)
      .join("");
  }
}

// USNO Astronomy Fetch Loop with Cache & Mathematical Fallback
async function loadFortKentAstroData() {
  const workerEndpoint = "https://moon-api.maineapexwx.workers.dev/";
  const timeZone = "America/New_York";
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  try {
    const response = await fetch(workerEndpoint);
    if (!response.ok) throw new Error(`Worker HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    // Save good USNO data to localStorage for today
    try {
      localStorage.setItem("apexwx_astro_cache", JSON.stringify({ date: todayStr, payload: data }));
    } catch (e) {}

    renderAstroData(data);
  } catch (error) {
    console.warn("Primary USNO Worker unavailable, checking cache/math fallback:", error);

    // 1. Check if we already cached official USNO data earlier today
    try {
      const cached = JSON.parse(localStorage.getItem("apexwx_astro_cache") || "null");
      if (cached && cached.date === todayStr && cached.payload) {
        renderAstroData(cached.payload);
        return;
      }
    } catch (e) {}

    // 2. Otherwise compute accurate Fort Kent astronomical times locally
    const fallbackData = calculateFallbackAstroData(todayStr, timeZone);
    renderAstroData(fallbackData);
  }
}

// =========================================================================
// 3. UNIFIED LIFECYCLE & EXECUTION TIMERS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Fire Season display setup
  const season = getCurrentSeason();
  const emoji = getSeasonEmoji(season);
  const displayDiv = document.getElementById("season-display");
  if (displayDiv) {
    displayDiv.textContent = `${emoji} Current season: ${season.charAt(0).toUpperCase() + season.slice(1)} ${emoji}`;
    displayDiv.classList.add(season);
  }

  // Fire time tracking clocks immediately & loop every minute
  updateLocalTime();
  setInterval(updateLocalTime, 60000);

  updateDualTime();
  setInterval(updateDualTime, 60000);

  // Fire welcome text message greetings
  updateGreeting();
  setInterval(updateGreeting, 60000);

  // Fetch National Weather Service severe alerts (15 mins loop)
  fetchNWSAlerts();
  setInterval(fetchNWSAlerts, 900000);

  // Fetch extended weather text cards (3 hours loop)
  fetchForecast();
  setInterval(fetchForecast, 10800000);

  // Sync Live weather sensors feeds (60s loop)
  updateStation();
  setInterval(updateStation, 60000);

  // Astronomy computations setup (Worker + Cache + Offline Math Backup)
  loadFortKentAstroData();

  // Integrated execution of climate data tracking file if present 
  if (typeof loadClimateData === "function") {
    loadClimateData();
    setInterval(loadClimateData, 1800000); // 30 mins loop
  }
});