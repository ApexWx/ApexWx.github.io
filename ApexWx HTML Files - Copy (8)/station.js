// ======================================================
// STATION LIVE DATA CONFIGURATION & UTILITIES
// ======================================================

const workerUrl = "https://apexwx-observations.maineapexwx.workers.dev";
         
function degreesToCompass(degrees) {
  const directions = [
    "N","NNE","NE","ENE",
    "E","ESE","SE","SSE",
    "S","SSW","SW","WSW",
    "W","WNW","NW","NNW"
  ];
         
  return directions[
    Math.round(degrees / 22.5) % 16
  ];
}
         
async function updateStation() {
  try {
    const response = await fetch(`${workerUrl}?t=${Date.now()}`);
         
    if (!response.ok) {
      throw new Error("Worker unavailable");
    }
         
    const data = await response.json();
         
    // Temperature
    document.getElementById("temp").innerHTML =
      data.temperature != null
        ? `${data.temperature.toFixed(1)}°F<br><span class="metric">${((data.temperature - 32) * 5 / 9).toFixed(1)}°C</span>`
        : "--";
         
    // Dew Point
    document.getElementById("dewpoint").innerHTML =
      data.dewpoint != null
        ? `${data.dewpoint.toFixed(1)}°F<br><span class="metric">${((data.dewpoint - 32) * 5 / 9).toFixed(1)}°C</span>`
        : "--";
             
    // Humidity
    document.getElementById("humidity").textContent =
      data.humidity != null
        ? `${Math.round(data.humidity)}%`
        : "--";
         
    // Feels Like
    document.getElementById("feels-like").innerHTML =
      data.feelsLike != null
        ? `${data.feelsLike.toFixed(1)}°F<br><span class="metric">${((data.feelsLike - 32) * 5 / 9).toFixed(1)}°C</span>`
        : "--";
         
    // Wind Speed
    document.getElementById("wind").innerHTML =
      data.windSpeed != null
        ? `${data.windSpeed.toFixed(1)} mph<br><span class="metric">${(data.windSpeed * 1.60934).toFixed(1)} km/h</span>`
        : "--";
         
    // Wind Gust
    document.getElementById("gust").innerHTML =
      data.windGust != null
        ? `${data.windGust.toFixed(1)} mph<br><span class="metric">${(data.windGust * 1.60934).toFixed(1)} km/h</span>`
        : "--";
             
    // Wind Direction
    document.getElementById("winddir").innerHTML =
      data.windDirection != null
        ? `${degreesToCompass(data.windDirection)}<br><span class="metric">${Math.round(data.windDirection)}°</span>`
        : "--";
             
    // ======================================================
    // PRESSURE & LOCAL MEMORY TREND TRACKER
    // ======================================================
    if (data.pressure != null) {
      const currentPressure = data.pressure;
      const currentTimestamp = data.timestamp || Date.now();
               
      // 1. Calculate standard conversions
      const inHg = currentPressure.toFixed(2);
      const hPa = (currentPressure * 33.86389).toFixed(1);
         
      // 2. Fetch or initialize the local trend history cache
      let pressureHistory = [];
      try {
        pressureHistory = JSON.parse(localStorage.getItem("apexwx_pressure_history")) || [];
      } catch (e) {
        pressureHistory = [];
      }
         
      // Add the current reading to the history list
      pressureHistory.push({ time: currentTimestamp, val: currentPressure });
         
      // Clear out old history items older than 3 hours to prevent memory bloat
      const threeHoursAgo = currentTimestamp - (3 * 60 * 60 * 1000);
      pressureHistory = pressureHistory.filter(item => item.time >= threeHoursAgo);
         
      // Save the updated history back into the browser's local storage cache
      localStorage.setItem("apexwx_pressure_history", JSON.stringify(pressureHistory));
         
      // 3. Look back to find a reading closest to a standard weather window (between 1 and 3 hours ago)
      const targetTime = currentTimestamp - (2 * 60 * 60 * 1000); 
      let closestItem = null;
      let minDiff = Infinity;
         
      // Track down the historical point closest to our target window
      pressureHistory.forEach(item => {
        // Only consider history elements that are at least 45 minutes old
        if (currentTimestamp - item.time > 45 * 60 * 1000) {
          const diff = Math.abs(item.time - targetTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestItem = item;
          }
        }
      });
         
      // 4. Evaluate the delta trend text
      let trendText = "";
      if (closestItem) {
        const delta = currentPressure - closestItem.val;
                 
        // Meteorological Standard: Changes less than 0.02 inHg within 2-3 hours are "Steady"
        if (delta >= 0.018) {
          trendText = ` <span style="color: #5cb85c; font-weight: bold;">Rising ↗</span>`;
        } else if (delta <= -0.018) {
          trendText = ` <span style="color: #d9534f; font-weight: bold;">Falling ↘</span>`;
        } else {
          trendText = ` <span style="color: #777; font-weight: normal;">Steady —</span>`;
        }
      } else {
        trendText = ` <span style="color: #999; font-weight: normal; font-size: 11px;">(Calculating trend...)</span>`;
      }
         
      // 5. Render to your "pressure" ID 
      document.getElementById("pressure").innerHTML =
        `${inHg} inHg<span class="metric">${hPa} hPa</span><span class="pressure-trend-line">${trendText}</span>`;
    } else {
      document.getElementById("pressure").innerHTML = "--";
    }
             
    // Rain Today
    document.getElementById("rain").innerHTML =
      data.rainToday != null
        ? `${data.rainToday.toFixed(2)} in<br><span class="metric">${(data.rainToday * 25.4).toFixed(1)} mm</span>`
        : "--";
         
    // Max Daily Gust
    document.getElementById("maxdailygust").innerHTML =
      data.maxDailyGust != null
        ? `${data.maxDailyGust.toFixed(1)} mph<br><span class="metric">${(data.maxDailyGust * 1.609344).toFixed(1)} km/h</span>`
        : "--";
         
    // Monthly Rain
    document.getElementById("rain-month").innerHTML =
      data.rainMonth != null
        ? `${Number(data.rainMonth).toFixed(2)} in<br><span class="metric">${(Number(data.rainMonth) * 25.4).toFixed(1)} mm</span>`
        : "--";
         
    // Yearly Rain
    document.getElementById("rain-year").innerHTML =
      data.rainYear != null
        ? `${Number(data.rainYear).toFixed(2)} in<br><span class="metric">${(Number(data.rainYear) * 25.4).toFixed(1)} mm</span>`
        : "--";
             
    document.getElementById("aw-update").textContent =
      new Date(data.timestamp).toLocaleString();
         
  } catch (error) {
    console.error(error);
    document.getElementById("aw-update").textContent = "Unable to retrieve station data";
  }
}