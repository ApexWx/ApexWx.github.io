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
// 2B. ASTRONOMY (EXACT FORT KENT 47.2558° N, -68.5946° W + MEEUS LUNAR)
// =========================================================================

function calculateFortKentAstroData(dateStr, timeZone) {
  const lat = 47.2558;
  const lon = -68.5946;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const [y, m, d] = dateStr.split("-").map(Number);
  const targetDateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset"
  }).formatToParts(targetDateObj).find(p => p.type === "timeZoneName")?.value || "GMT-05:00";
  const tzOffset = parseInt(offsetPart.replace("GMT", "").split(":")[0], 10) || -5;
  const tzName = tzOffset === -4 ? "EDT" : "EST";

  // --- 1. NOAA High-Precision Solar Times (evaluated at ~local noon) ---
  const adjY = m <= 2 ? y - 1 : y;
  const adjM = m <= 2 ? m + 12 : m;
  const jdNoon = Date.UTC(y, m - 1, d, 12 - tzOffset, 0, 0) / 86400000 + 2440587.5;
const jc = (jdNoon - 2451545.0) / 36525.0;

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

  const getSunEvents = (zenith) => {
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

  const sunEvents = getSunEvents(90.833);
  const civilEvents = getSunEvents(96.0);

  let dayLengthStr = "N/A";
  if (sunEvents) {
    const diffMins = Math.round(sunEvents.setMin - sunEvents.riseMin);
    dayLengthStr = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  }

  // --- 2. Meeus High-Precision Lunar Phase Instants (Accurate to ~1 min) ---
  function getMeeusPhaseDate(k) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const T4 = T3 * T;

    let JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;

    const M = rad * ((2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) % 360);
    const Mp = rad * ((201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) % 360);
    const F = rad * ((160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) % 360);
    const Om = rad * ((124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) % 360);

    const quarter = Math.round((k - Math.floor(k)) * 4);
    let corr = 0;

    if (quarter === 0 || quarter === 2) {
      // New Moon (0) or Full Moon (2)
      const isNew = quarter === 0;
      corr = (isNew ? -0.40720 : -0.40614) * Math.sin(Mp) +
             (isNew ? 0.17241 : 0.17302) * E * Math.sin(M) +
             (isNew ? 0.01608 : 0.01614) * Math.sin(2 * Mp) +
             (isNew ? 0.01039 : 0.01043) * Math.sin(2 * F) +
             (isNew ? 0.00739 : 0.00734) * E * Math.sin(Mp - M) +
             (isNew ? -0.00514 : -0.00515) * E * Math.sin(Mp + M) +
             (isNew ? 0.00208 : 0.00209) * E * E * Math.sin(2 * M) -
             0.00111 * Math.sin(Mp - 2 * F) -
             0.00057 * Math.sin(Mp + 2 * F) +
             0.00056 * E * Math.sin(2 * Mp + M) -
             0.00042 * Math.sin(3 * Mp) +
             0.00042 * E * Math.sin(M + 2 * F) +
             0.00038 * E * Math.sin(M - 2 * F) -
             0.00024 * E * Math.sin(2 * Mp - M) -
             0.00017 * Math.sin(Om);
    } else {
      // First Quarter (1) or Last Quarter (3)
      corr = -0.62801 * Math.sin(Mp) +
             0.17172 * E * Math.sin(M) -
             0.01183 * E * Math.sin(Mp + M) +
             0.00862 * Math.sin(2 * Mp) +
             0.00804 * Math.sin(2 * F) +
             0.00454 * E * Math.sin(Mp - M) +
             0.00204 * E * E * Math.sin(2 * M) -
             0.00180 * Math.sin(Mp - 2 * F) -
             0.00070 * Math.sin(Mp + 2 * F) -
             0.00040 * Math.sin(3 * Mp) -
             0.00034 * E * Math.sin(2 * Mp - M) +
             0.00032 * E * Math.sin(M + 2 * F) +
             0.00032 * E * Math.sin(M - 2 * F) -
             0.00028 * E * E * Math.sin(Mp + 2 * M) +
             0.00027 * E * Math.sin(2 * Mp + M) -
             0.00017 * Math.sin(Om);
      const W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mp) -
                0.00002 * Math.cos(Mp - M) + 0.00002 * Math.cos(Mp + M) + 0.00002 * Math.cos(2 * F);
      corr += (quarter === 1 ? W : -W);
    }

    JDE += corr;
    return new Date((JDE - 2440587.5) * 86400000);
  }

  const now = new Date();
  const decimalYear = y + (m - 0.5) / 12;
  const baseK = Math.floor((decimalYear - 2000) * 12.3685) - 2;

  const phaseDefs = [
    { offset: 0.0,  name: "New Moon",      emoji: "🌑" },
    { offset: 0.25, name: "First Quarter", emoji: "🌓" },
    { offset: 0.5,  name: "Full Moon",     emoji: "🌕" },
    { offset: 0.75, name: "Last Quarter",  emoji: "🌗" }
  ];

  const allPhases = [];
  for (let i = 0; i <= 5; i++) {
    for (const p of phaseDefs) {
      const kVal = baseK + i + p.offset;
      const dt = getMeeusPhaseDate(kVal);
      allPhases.push({ ...p, dateObj: dt, ts: dt.getTime() });
    }
  }
  allPhases.sort((a, b) => a.ts - b.ts);

  // Current phase & illumination from surrounding Meeus phase instants
  const prevPhase = [...allPhases].reverse().find(p => p.ts <= now.getTime()) || allPhases[0];
  const nextPhase = allPhases.find(p => p.ts > now.getTime()) || allPhases[allPhases.length - 1];
  const fracInQuarter = (now.getTime() - prevPhase.ts) / Math.max(1, nextPhase.ts - prevPhase.ts);
  const phaseAngle = (prevPhase.offset + fracInQuarter * 0.25) * 2 * Math.PI;
  const illumPct = Math.round(((1 - Math.cos(phaseAngle)) / 2) * 100);

  let curPhaseDisplay = `🌖 Waning Gibbous (${illumPct}%)`;
  if (illumPct <= 2) curPhaseDisplay = `🌑 New Moon (${illumPct}%)`;
  else if (illumPct >= 98) curPhaseDisplay = `🌕 Full Moon (${illumPct}%)`;
  else if (prevPhase.offset === 0.0) curPhaseDisplay = `🌒 Waxing Crescent (${illumPct}%)`;
  else if (prevPhase.offset === 0.25) curPhaseDisplay = `🌔 Waxing Gibbous (${illumPct}%)`;
  else if (prevPhase.offset === 0.5) curPhaseDisplay = `🌖 Waning Gibbous (${illumPct}%)`;
  else curPhaseDisplay = `🌘 Waning Crescent (${illumPct}%)`;

  const upcoming = allPhases
    .filter(p => p.ts > now.getTime())
    .slice(0, 4)
    .map(p => ({
      emoji: p.emoji,
      date: p.dateObj.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" }),
      name: p.name
    }));

  // --- 3. High-Precision Topocentric Meeus Moonrise & Moonset ---
  function getMoonAlt(utcMs) {
    const dDays = (utcMs - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
    const T = dDays / 36525.0;

    const L = rad * ((218.3164477 + 481267.88123421 * T) % 360);
    const D = rad * ((297.8501921 + 445267.1114034 * T) % 360);
    const Ms = rad * ((357.5291092 + 35999.0502909 * T) % 360);
    const Mm = rad * ((134.9633964 + 477198.8675055 * T) % 360);
    const F = rad * ((93.2720950 + 483202.0175233 * T) % 360);

    // Meeus Chapter 47 periodic terms for geocentric ecliptic longitude & latitude
    const lonEcl = L + rad * (
      6.288774 * Math.sin(Mm) +
      1.274027 * Math.sin(2 * D - Mm) +
      0.658314 * Math.sin(2 * D) +
      0.213618 * Math.sin(2 * Mm) -
      0.185116 * Math.sin(Ms) -
      0.114332 * Math.sin(2 * F) +
      0.058793 * Math.sin(2 * D - 2 * Mm) +
      0.057066 * Math.sin(2 * D - Ms - Mm) +
      0.053322 * Math.sin(2 * D + Mm) +
      0.045758 * Math.sin(2 * D - Ms) -
      0.040923 * Math.sin(Ms - Mm) -
      0.034720 * Math.sin(D) -
      0.030383 * Math.sin(Ms + Mm)
    );

    const latEcl = rad * (
      5.128122 * Math.sin(F) +
      0.280602 * Math.sin(Mm + F) +
      0.277693 * Math.sin(Mm - F) +
      0.173237 * Math.sin(2 * D - F) +
      0.055413 * Math.sin(2 * D - Mm + F) +
      0.046271 * Math.sin(2 * D - Mm - F)
    );

    // Equatorial horizontal parallax (degrees)
    const parallaxDeg =
      0.950724 +
      0.051818 * Math.cos(Mm) +
      0.009531 * Math.cos(2 * D - Mm) +
      0.007843 * Math.cos(2 * D) +
      0.002824 * Math.cos(2 * Mm);

    const obl = rad * (23.439291 - 0.0130042 * T);
    const ra = Math.atan2(
      Math.sin(lonEcl) * Math.cos(obl) - Math.tan(latEcl) * Math.sin(obl),
      Math.cos(lonEcl)
    );
    const dec = Math.asin(
      Math.sin(latEcl) * Math.cos(obl) + Math.cos(latEcl) * Math.sin(obl) * Math.sin(lonEcl)
    );

    const gmst = ((280.46061837 + 360.98564736629 * dDays + 0.000387933 * T * T) % 360) * rad;
    const ha = gmst + lon * rad - ra;

    const sinAlt = Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha);
    const geoAltDeg = deg * Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    // Topocentric altitude = geocentric altitude minus horizontal parallax * cos(alt)
    return geoAltDeg - parallaxDeg * Math.cos(rad * Math.max(0, geoAltDeg));
  }

  function findMoonRiseSet(dayOffset) {
    const startUtcMs = Date.UTC(y, m - 1, d + dayOffset, -tzOffset, 0, 0);
    let riseStr = null;
    let setStr = null;
    // Upper-limb refraction (-34') minus lunar semidiameter (-16') = -0.833 deg
    const targetAlt = -0.833;

    let prevAlt = getMoonAlt(startUtcMs) - targetAlt;
    for (let min = 1; min <= 1440; min += 1) {
      const curMs = startUtcMs + min * 60000;
      const curAlt = getMoonAlt(curMs) - targetAlt;
      if (prevAlt < 0 && curAlt >= 0 && !riseStr) {
        const frac = -prevAlt / (curAlt - prevAlt);
        const exactMs = curMs - (1 - frac) * 60000;
        riseStr = new Date(exactMs).toLocaleTimeString("en-US", {
          timeZone, hour: "numeric", minute: "2-digit"
        }) + ` ${tzName}`;
      } else if (prevAlt >= 0 && curAlt < 0 && !setStr) {
        const frac = prevAlt / (prevAlt - curAlt);
        const exactMs = curMs - (1 - frac) * 60000;
        setStr = new Date(exactMs).toLocaleTimeString("en-US", {
          timeZone, hour: "numeric", minute: "2-digit"
        }) + ` ${tzName}`;
      }
      prevAlt = curAlt;
    }
    return { riseStr, setStr };
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