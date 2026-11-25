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

// Unified USNO Astronomy & Upcoming Moon Phases Fetch (Direct Browser Fetch)
async function loadFortKentAstroData() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const moonGrid = document.getElementById("moon-phase-grid");

  const lat = "47.2589";
  const lon = "-68.5891";
  const timeZone = "America/New_York";

  const now = new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  // Determine exact EDT (-4) vs EST (-5) offset
  const targetDateObj = new Date(`${dateStr}T12:00:00`);
  const offsetPart = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset"
  }).formatToParts(targetDateObj).find(p => p.type === "timeZoneName")?.value || "GMT-05:00";
  const tzOffset = parseInt(offsetPart.replace("GMT", "").split(":")[0], 10) || -5;
  const tzName = tzOffset === -4 ? "EDT" : "EST";

  const usnoRsttUrl = `https://aa.usno.navy.mil/api/rstt/oneday?date=${dateStr}&coords=${lat},${lon}&tz=${tzOffset}`;
  const usnoPhaseUrl = `https://aa.usno.navy.mil/api/moon/phases/date?date=${dateStr}&nump=8`;

  const [rsttResult, phaseResult] = await Promise.allSettled([
    fetch(usnoRsttUrl, { cache: "no-store" }),
    fetch(usnoPhaseUrl, { cache: "no-store" })
  ]);

  let phaseData = null;
  if (phaseResult.status === "fulfilled" && phaseResult.value.ok) {
    try {
      phaseData = await phaseResult.value.json();
    } catch (e) {
      console.error("Failed to parse USNO phase JSON:", e);
    }
  }

  // A. Populate Daily Sun & Moon Card
  try {
    if (rsttResult.status !== "fulfilled" || !rsttResult.value.ok) {
      throw new Error(`USNO RSTT HTTP ${rsttResult.value?.status || "network error"}`);
    }
    const rsttData = await rsttResult.value.json();

    const processUtTime = (localTimeStr) => {
      if (!localTimeStr || localTimeStr === "N/A") return null;
      const [hours, minutes] = localTimeStr.split(":").map(Number);
      const targetDate = new Date(`${dateStr}T00:00:00`);
      targetDate.setHours(hours, minutes);

      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, "0");
      return { absoluteDate: targetDate, formattedTime: `${displayHours}:${displayMinutes} ${ampm} ${tzName}` };
    };

    const apiData = rsttData.properties?.data || {};
    const sundata = apiData.sundata || [];
    const moondata = apiData.moondata || [];
    const curPhaseName = apiData.curphase || "Waning Gibbous";

    const rawSunrise = sundata.find(item => item.phen === "Rise" || item.phen === "R")?.time;
    const rawSunset = sundata.find(item => item.phen === "Set" || item.phen === "S")?.time;
    const rawDawn = sundata.find(item => item.phen === "Begin Civil Twilight")?.time;
    const rawDusk = sundata.find(item => item.phen === "End Civil Twilight")?.time;
    const rawMoonset = moondata.find(item => item.phen === "Set" || item.phen === "S")?.time;
    const rawMoonrise = moondata.find(item => item.phen === "Rise" || item.phen === "R")?.time;

    const emojiMap = {
      "New Moon": "🌑 New Moon",
      "First Quarter": "🌓 First Quarter",
      "Full Moon": "🌕 Full Moon",
      "Last Quarter": "🌗 Last Quarter",
      "Waning Gibbous": "🌖 Waning Gibbous",
      "Waxing Gibbous": "🌔 Waxing Gibbous",
      "Waning Crescent": "🌘 Waning Crescent",
      "Waxing Crescent": "🌒 Waxing Crescent"
    };

    let phaseDisplayStr = emojiMap[curPhaseName] || `🌖 ${curPhaseName}`;
    if (phaseData && Array.isArray(phaseData.phasedata)) {
      const phasesWithLocalDates = phaseData.phasedata.map(p => {
        const [pH, pM] = p.time.split(":").map(Number);
        const utcDate = new Date(Date.UTC(p.year, p.month - 1, p.day, pH, pM));
        const localDateStr = utcDate.toLocaleDateString("en-CA", { timeZone });
        return { ...p, localDateStr, absoluteDate: utcDate };
      });

      const exactMatchPhase = phasesWithLocalDates.find(p => p.localDateStr === dateStr);
      if (exactMatchPhase) {
        const phaseEmojiName = emojiMap[exactMatchPhase.phase] || exactMatchPhase.phase;
        const timePart = exactMatchPhase.absoluteDate.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
        const weekdayPart = exactMatchPhase.absoluteDate.toLocaleDateString("en-US", { timeZone, weekday: "short" });
        const dayPart = exactMatchPhase.absoluteDate.toLocaleDateString("en-US", { timeZone, day: "numeric" });
        const monthPart = exactMatchPhase.absoluteDate.toLocaleDateString("en-US", { timeZone, month: "short" });
        phaseDisplayStr = `${phaseEmojiName} ${timePart} ${weekdayPart}. ${monthPart}. ${dayPart}`;
      } else {
        const referenceTime = new Date(`${dateStr}T12:00:00Z`).getTime();
        const nextP = phasesWithLocalDates.find(p => p.absoluteDate.getTime() >= referenceTime) || phasesWithLocalDates[0];
        if (nextP) {
          const currentEmojiName = emojiMap[curPhaseName] || `🌖 ${curPhaseName}`;
          const nextPhaseEmojiName = emojiMap[nextP.phase] || nextP.phase;
          const timePart = nextP.absoluteDate.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
          const weekdayPart = nextP.absoluteDate.toLocaleDateString("en-US", { timeZone, weekday: "short" });
          const dayPart = nextP.absoluteDate.toLocaleDateString("en-US", { timeZone, day: "numeric" });
          const monthPart = nextP.absoluteDate.toLocaleDateString("en-US", { timeZone, month: "short" });
          phaseDisplayStr = `${currentEmojiName} → ${nextPhaseEmojiName} ${timePart} ${weekdayPart}. ${monthPart}. ${dayPart}`;
        }
      }
    }

    let dayLengthStr = "N/A";
    if (rawSunrise && rawSunset) {
      const [rH, rM] = rawSunrise.split(":").map(Number);
      const [sH, sM] = rawSunset.split(":").map(Number);
      let totalMinutes = (sH * 60 + sM) - (rH * 60 + rM);
      if (totalMinutes < 0) totalMinutes += 1440;
      dayLengthStr = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    }

    const targetDayDate = targetDateObj.getDate();
    const dawnData = processUtTime(rawDawn);
    const sunriseData = processUtTime(rawSunrise);
    const sunsetData = processUtTime(rawSunset);
    const duskData = processUtTime(rawDusk);
    const moonsetData = processUtTime(rawMoonset);
    const moonriseData = processUtTime(rawMoonrise);

    const getPublicFriendlyLabel = (processedTimeObj, fallbackLabel) => {
      if (!processedTimeObj) return `N/A ${fallbackLabel}`;
      const localEventDate = processedTimeObj.absoluteDate;
      const eventDay = localEventDate.getDate();
      const eventHour = localEventDate.getHours();
      const cleanTime = processedTimeObj.formattedTime.replace(" EDT", "").replace(" EST", "");

      if (eventDay !== targetDayDate) {
        const nextDayName = localEventDate.toLocaleDateString("en-US", { weekday: "short" });
        if (eventHour === 0 || eventHour === 1) {
          return `${cleanTime} ${tzName} late tonight (${nextDayName})`;
        }
        return `${cleanTime} ${tzName} tomorrow (${nextDayName})`;
      }

      let timeframe = "today";
      if (eventHour < 8) timeframe = "this morning";
      else if (eventHour >= 17 && eventHour <= 20) timeframe = "this evening";
      else if (eventHour >= 21 || eventHour === 0) timeframe = "tonight";
      return `${cleanTime} ${tzName} ${timeframe}`;
    };

    setTxt("astro-date", targetDateObj.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    }));
    setTxt("astro-dawn", dawnData ? dawnData.formattedTime : "N/A");
    setTxt("astro-sunrise", sunriseData ? sunriseData.formattedTime : "N/A");
    setTxt("astro-sunset", sunsetData ? sunsetData.formattedTime : "N/A");
    setTxt("astro-dusk", duskData ? duskData.formattedTime : "N/A");
    setTxt("astro-day-length", dayLengthStr);
    setTxt("astro-moon-phase", phaseDisplayStr);
    setTxt("astro-moonset", getPublicFriendlyLabel(moonsetData, "today"));
    setTxt("astro-moonrise", getPublicFriendlyLabel(moonriseData, "tomorrow"));
  } catch (error) {
    console.error("Astronomy daily error:", error);
    setTxt("astro-date", "Data Temporarily Offline");
  }

  // B. Populate Upcoming Moon Phases 4-Box Grid
  if (moonGrid) {
    try {
      if (!phaseData || !Array.isArray(phaseData.phasedata)) {
        throw new Error("USNO API returned no phase data.");
      }

      const shortEmoji = {
        "New Moon": "🌑",
        "First Quarter": "🌓",
        "Full Moon": "🌕",
        "Last Quarter": "🌗"
      };

      const upcomingPhases = phaseData.phasedata
        .map(item => {
          const [hour, minute] = String(item.time).split(":").map(Number);
          return {
            name: item.phase,
            date: new Date(Date.UTC(Number(item.year), Number(item.month) - 1, Number(item.day), hour, minute, 0))
          };
        })
        .filter(item => item.date > now)
        .slice(0, 4);

      if (upcomingPhases.length < 4) {
        throw new Error("Fewer than four upcoming moon phases were returned.");
      }

      moonGrid.innerHTML = upcomingPhases
        .map(item => {
          const emoji = shortEmoji[item.name] || "🌙";
          const displayDate = new Intl.DateTimeFormat("en-US", {
            timeZone,
            month: "short",
            day: "numeric"
          }).format(item.date);

          return `
            <div class="moon-phase-item">
              ${emoji} <strong>${displayDate}</strong><br>
              ${item.name}
            </div>
          `;
        })
        .join("");
    } catch (error) {
      console.error("Unable to load upcoming moon phases:", error);
      moonGrid.innerHTML = `
        <div class="moon-phase-item">
          Moon phase information temporarily unavailable.
        </div>
      `;
    }
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

  // Astronomy computations setup (Daily Sun/Moon + 4 Upcoming Moon Phases)
  loadFortKentAstroData();

  // Integrated execution of climate data tracking file if present 
  if (typeof loadClimateData === "function") {
    loadClimateData();
    setInterval(loadClimateData, 1800000); // 30 mins loop
  }
});