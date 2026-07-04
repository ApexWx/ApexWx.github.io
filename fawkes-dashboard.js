/* ==========================================================================
   1. GREETING FOR TIME OF DAY
   ========================================================================== */
function initGreeting() {
    const greetingEl = document.getElementById('lblGreetings');
    if (greetingEl) {
        var myDate = new Date();
        var hrs = myDate.getHours();
        var greet;
        
        if (hrs < 12 && hrs >= 3)
            greet = 'Good Morning!';
        else if (hrs >= 12 && hrs <= 17)
            greet = 'Good Afternoon!';
        else if (hrs >= 17 && hrs <= 24)
            greet = 'Good Evening!';
        else if (hrs >= 0 && hrs <= 3)
            greet = 'Good Early Morning!';
            
        greetingEl.innerHTML = '<b>' + greet + '</b>';
    }
}

/* ==========================================================================
   2. 7-DAY WEATHER FORECAST
   ========================================================================== */
async function fetchForecast() {
    const forecastEl = document.getElementById('forecast');
    if (!forecastEl) return;

    try {
        const response = await fetch('https://api.weather.gov/points/40.04,-76.30');
        const pointData = await response.json();
        const forecastUrl = pointData.properties.forecast;
        
        const forecastResponse = await fetch(forecastUrl);
        const forecastData = await forecastResponse.json();
        const periods = forecastData.properties.periods;
        
        const forecastHtml = periods.map(p => `
            <div class="fw-item">
                <img decoding="async" loading="lazy" src="${p.icon}" alt="${p.shortForecast}" />
                <div class="fw-text">
                    <span class="fw-day">${p.name}:</span> ${p.detailedForecast}
                </div>
            </div>
        `).join('');
        
        forecastEl.innerHTML = forecastHtml;
    } catch (error) {
        console.error('Error fetching weather:', error);
        forecastEl.textContent = 'Failed to load forecast.';
    }
}

/* ==========================================================================
   3. LOCAL TIME CLOCK
   ========================================================================== */
function updateLocalTime() {
    const timeEl = document.getElementById("localTime");
    if (!timeEl) return;
    
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
    
    const output = `${dayName}, ${monthName} ${day}, ${year} at ${hour}:${minute} ${ampm} ${tz}`;
    timeEl.textContent = output;
}

/* ==========================================================================
   4. 24-HOUR CLOCKS (LOCAL & UTC)
   ========================================================================== */
function updateDualTime() {
    const dualTimeEl = document.getElementById("dualTime");
    if (!dualTimeEl) return;
    
    const now = new Date();
    const localHour = now.getHours().toString().padStart(2, '0');
    const localMinute = now.getMinutes().toString().padStart(2, '0');
    const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
        .formatToParts(now)
        .find(part => part.type === 'timeZoneName').value;
    const localTime = `${localHour}:${localMinute} ${tz}`;
    
    const utcHour = now.getUTCHours().toString().padStart(2, '0');
    const utcMinute = now.getUTCMinutes().toString().padStart(2, '0');
    const utcTime = `${utcHour}:${utcMinute} UTC`;
    
    dualTimeEl.innerHTML = `${localTime}<br>${utcTime}`;
}

/* ==========================================================================
   5. SEASONS DISPLAY
   ========================================================================== */
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
        case "fall": return "🍂";
        default: return "";
    }
}

function updateSeasonDisplay() {
    const season = getCurrentSeason();
    const emoji = getSeasonEmoji(season);
    const displayDiv = document.getElementById("season-display");
    
    if (displayDiv) {
        const capitalizedSeason = season.charAt(0).toUpperCase() + season.slice(1);
        displayDiv.textContent = `${emoji} Current season: ${capitalizedSeason} ${emoji}`;
        displayDiv.classList.add(season);
    }
}

/* ==========================================================================
   6. NWS ALERTS
   ========================================================================== */
async function fetchNWSAlerts() {
    const zone = "PAZ066";
    const apiURL = `https://api.weather.gov/alerts/active/zone/${zone}`;
    const alertDiv = document.getElementById("weatherAlert");
    if (!alertDiv) return;
    
    try {
        const response = await fetch(apiURL);
        const data = await response.json();
        const storedDismissedIds = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");
        
        if (data.features.length > 0) {
            alertDiv.innerHTML = "";
            
            data.features.forEach((feature) => {
                const alert = feature.properties;
                const alertId = feature.id;
                
                if (storedDismissedIds.includes(alertId)) return;
                
                const title = alert.headline;
                const description = alert.description;
                const severityRaw = alert.severity || "Unknown";
                const severity = severityRaw.toLowerCase();
                const link = alert.url || "https://www.weather.gov/ctp/";
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
                    ${shouldCollapse ? `<button class="alert-toggle" onclick="toggleAlert('${alertId}', \`${description.replace(/`/g, "\`")}\`)">Read more</button>` : ""}
                    <div style="margin-top: 8px;">
                        <a href="${link}" target="_blank" rel="noopener">View full alert from NWS</a>
                    </div>
                    <div style="margin-top: 6px; font-size: 0.9em; color: #555;">
                        Last updated: ${updated}
                    </div>
                `;
                alertDiv.appendChild(alertBox);
            });
        } else {
            alertDiv.innerHTML = "";
        }
    } catch (error) {
        console.error("NWS Alert fetch error:", error);
        alertDiv.innerText = "Unable to load weather alerts.";
    }
}

// Explicitly bind helper functions to the window object so inline HTML element click events can target them safely
window.dismissAlert = function(alertId) {
    let dismissed = JSON.parse(localStorage.getItem("dismissedAlertIds") || "[]");
    if (!dismissed.includes(alertId)) {
        dismissed.push(alertId);
        localStorage.setItem("dismissedAlertIds", JSON.stringify(dismissed));
    }
    const alertBox = document.querySelector(`[data-alert-id="${alertId}"]`);
    if (alertBox) alertBox.style.display = 'none';
};

window.toggleAlert = function(alertId, fullText) {
    const descEl = document.getElementById(`desc-${alertId}`);
    const btn = descEl.nextElementSibling;
    const isCollapsed = btn.textContent === "Read more";
    
    if (isCollapsed) {
        descEl.textContent = fullText;
        btn.textContent = "Show less";
    } else {
        descEl.textContent = fullText.slice(0, 300).trim() + "...";
        btn.textContent = "Read more";
    }
};

/* ==========================================================================
   7. LANCASTER ASTRONOMICAL DATA
   ========================================================================== */
async function loadLancasterAstroData() {
    const workerEndpoint = 'https://moon-api.maineapexwx.workers.dev/?lat=40.0379&lon=-76.3055';
    
    try {
        const response = await fetch(workerEndpoint);
        if (!response.ok) throw new Error("Astro API returned an error status.");
        
        const data = await response.json();
        
        const elements = {
            'astro-date': data.date_label,
            'astro-dawn': data.dawn,
            'astro-sunrise': data.sunrise,
            'astro-sunset': data.sunset,
            'astro-dusk': data.dusk,
            'astro-day-length': data.day_length,
            'astro-moon-phase': data.moon_phase_display,
            'astro-moonrise': data.moonrise_display,
            'astro-moonset': data.moonset_display
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    } catch (error) {
        console.error("Failed to inject Lancaster astronomical predictions:", error);
        const dateEl = document.getElementById('astro-date');
        const phaseEl = document.getElementById('astro-moon-phase');
        if (dateEl) dateEl.textContent = "Data Temporarily Offline";
        if (phaseEl) phaseEl.textContent = "Unable to connect to USNO source.";
    }
}

/* ==========================================================================
   MASTER INITIALIZATION ON DOM CONTENT LOADED
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    // Run everything immediately on document ready
    initGreeting();
    updateLocalTime();
    updateDualTime();
    updateSeasonDisplay();
    fetchForecast();
    fetchNWSAlerts();
    loadLancasterAstroData();
    
    // Set up repeating timers
    setInterval(updateLocalTime, 60000);
    setInterval(updateDualTime, 60000);
    setInterval(fetchForecast, 10800000);
    setInterval(fetchNWSAlerts, 15 * 60 * 1000);
    setInterval(loadLancasterAstroData, 3600000);
});