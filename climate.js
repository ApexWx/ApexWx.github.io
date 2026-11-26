// ======================================================
// FORT KENT CLIMATE DATA
// ======================================================

async function loadClimateData() {
  console.log("LOAD CLIMATE DATA STARTED");

  try {
    const response = await fetch(
      "https://fortkent-acis.maineapexwx.workers.dev/"
    );

    const climate = await response.json();

    // ==================================================
    // UNPACK DATASETS FROM WORKER
    // ==================================================
    const monthlyRows = climate.monthlyRows;
    const seasonalRows = climate.seasonalRows || [];
    const ytdRain = climate.ytdRain || 0;
    const ytdRainDeparture = climate.ytdRainDeparture || 0;
    const seasonSnowNormal = Number.isFinite(climate.seasonSnowNormal)
      ? climate.seasonSnowNormal
      : 99.3;

    const todayNormals = climate.todayNormals || {
      normalHigh: 0,
      normalLow: 0,
      normalRain: 0,
    };

    // ==================================================
    // YESTERDAY'S COMPLETE CLIMATE OBSERVATION
    // ==================================================
    const easternTimeStr = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    const todayObj = new Date(easternTimeStr);
    const todayStr = `${todayObj.getFullYear()}-${String(
      todayObj.getMonth() + 1
    ).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;

    const latestRow = [...monthlyRows]
      .reverse()
      .find(
        (row) =>
          row[0] !== todayStr &&
          row[1] !== "M" &&
          row[2] !== "M" &&
          row[1] !== "" &&
          row[2] !== ""
      );

    if (!latestRow) {
      console.warn("No valid climate observations found.");
      return;
    }

    const yesterdayDate = latestRow[0];

    const yesterdayHigh =
      latestRow[1] !== "M" && latestRow[1] !== ""
        ? parseFloat(latestRow[1])
        : null;
    const yesterdayLow =
      latestRow[2] !== "M" && latestRow[2] !== ""
        ? parseFloat(latestRow[2])
        : null;
    const yesterdayRain =
      latestRow[3] !== "M" && latestRow[3] !== "T"
        ? parseFloat(latestRow[3]) || 0
        : 0;

    // ==================================================
    // DAILY NORMALS & RECORDS LOOKUP (LIVE ACIS + FALLBACK)
    // ==================================================
    let normHigh = todayNormals.normalHigh;
    let normLow = todayNormals.normalLow;
    let normRain = todayNormals.normalRain;

    const localKey = `${String(todayObj.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(todayObj.getDate()).padStart(2, "0")}`;
    const fallbackRec = climateRecords[localKey] || {
      high: [90, "----"],
      low: [28, "----"],
      rain: [2.73, "----"],
    };
    const apiRec = climate.todayRecords || {};

    // Use live ACIS record if it ties or beats the local historical record;
    // otherwise preserve older pre-1927 records not digitized in ACIS
    const useApiHigh = apiRec.high && apiRec.high.value >= fallbackRec.high[0];
    let recHighVal = useApiHigh ? apiRec.high.value : fallbackRec.high[0];
    let recHighYear = useApiHigh ? apiRec.high.year : fallbackRec.high[1];

    const useApiLow = apiRec.low && apiRec.low.value <= fallbackRec.low[0];
    let recLowVal = useApiLow ? apiRec.low.value : fallbackRec.low[0];
    let recLowYear = useApiLow ? apiRec.low.year : fallbackRec.low[1];

    const useApiRain = apiRec.rain && apiRec.rain.value >= fallbackRec.rain[0];
    let recRainVal = useApiRain ? apiRec.rain.value : fallbackRec.rain[0];
    let recRainYear = useApiRain ? apiRec.rain.year : fallbackRec.rain[1];

    // Render Normals to DOM
    document.getElementById("normal-high").innerHTML = `${Number(
      normHigh
    ).toFixed(0)}°F<br><span class="metric">${(
      ((Number(normHigh) - 32) * 5) /
      9
    ).toFixed(1)}°C</span>`;

    document.getElementById("normal-low").innerHTML = `${Number(
      normLow
    ).toFixed(0)}°F<br><span class="metric">${(
      ((Number(normLow) - 32) * 5) /
      9
    ).toFixed(1)}°C</span>`;

    document.getElementById("normal-rain").innerHTML = `${Number(
      normRain
    ).toFixed(2)} in<br><span class="metric">${(
      Number(normRain) * 25.4
    ).toFixed(1)} mm</span>`;

    // Render Records to DOM
    document.getElementById("record-high").innerHTML = `${parseFloat(
      recHighVal
    ).toFixed(0)}°F<br><span class="metric">${(
      ((parseFloat(recHighVal) - 32) * 5) /
      9
    ).toFixed(1)}°C</span><span class="metric">${recHighYear}</span>`;

    document.getElementById("record-low").innerHTML = `${parseFloat(
      recLowVal
    ).toFixed(0)}°F<br><span class="metric">${(
      ((parseFloat(recLowVal) - 32) * 5) /
      9
    ).toFixed(1)}°C</span><span class="metric">${recLowYear}</span>`;

    document.getElementById("record-rain").innerHTML = `${parseFloat(
      recRainVal
    ).toFixed(2)} in<br><span class="metric">${(
      parseFloat(recRainVal) * 25.4
    ).toFixed(1)} mm</span><span class="metric">${recRainYear}</span>`;

    // ==================================================
    // DEPARTURES
    // ==================================================
    let highDeparture = yesterdayHigh !== null ? yesterdayHigh - normHigh : null;
    let lowDeparture = yesterdayLow !== null ? yesterdayLow - normLow : null;

    let totalRain = 0;
    let maxRain = 0;
    let maxTemp = -999;
    let maxTempDate = "";
    let minTemp = 999;
    let minTempDate = "";
    let totalHigh = 0;
    let totalLow = 0;
    let validHighs = 0;
    let validLows = 0;
    let totalSnow = 0;
    let maxSnow = 0;
    let maxSnowDate = "";
    let snowDays = 0;

    // ==================================================
    // MONTHLY DATA LOOP
    // ==================================================
    monthlyRows.forEach((row) => {
      const date = row[0];
      const high = parseFloat(row[1]);
      const low = parseFloat(row[2]);

      let rain = 0;
      if (row[3] !== "M" && row[3] !== "T") {
        rain = parseFloat(row[3]) || 0;
      }

      totalRain += rain;
      if (rain > maxRain) {
        maxRain = rain;
      }

      if (!isNaN(high)) {
        totalHigh += high;
        validHighs++;
        if (high > maxTemp) {
          maxTemp = high;
          maxTempDate = date;
        }
      }

      if (!isNaN(low)) {
        totalLow += low;
        validLows++;
        if (low < minTemp) {
          minTemp = low;
          minTempDate = date;
        }
      }
    });

    // ==================================================
    // SEASONAL SNOW LOOP
    // ==================================================
    seasonalRows.forEach((row) => {
      const date = row[0];
      let snow = 0;
      if (row[1] !== "M" && row[1] !== "T") {
        snow = parseFloat(row[1]) || 0;
      }

      if (snow > 0) {
        totalSnow += snow;
        snowDays++;
        if (snow > maxSnow) {
          maxSnow = snow;
          maxSnowDate = date;
        }
      }
    });
    console.log("AFTER LOOP totalSnow =", totalSnow);

    // ==================================================
    // CALCULATE AVERAGES
    // ==================================================
    const avgHigh = validHighs > 0 ? totalHigh / validHighs : 0;
    const avgLow = validLows > 0 ? totalLow / validLows : 0;
    const avgMonthlyMean = (avgHigh + avgLow) / 2;
    const avgRain = monthlyRows.length > 0 ? totalRain / monthlyRows.length : 0;
    const avgSnow = snowDays > 0 ? totalSnow / snowDays : 0;

    // Render Stats to DOM
    document.getElementById(
      "climate-month-rain"
    ).innerHTML = `${totalRain.toFixed(2)} in<br><span class="metric">${(
      totalRain * 25.4
    ).toFixed(1)} mm</span>`;
    document.getElementById("climate-max-rain").innerHTML = `${maxRain.toFixed(
      2
    )} in<br><span class="metric">${(maxRain * 25.4).toFixed(1)} mm</span>`;
    document.getElementById("climate-avg-rain").innerHTML = `${avgRain.toFixed(
      2
    )} in/day<br><span class="metric">${(avgRain * 25.4).toFixed(
      1
    )} mm/day</span>`;

    document.getElementById("climate-max-temp").innerHTML = `${maxTemp.toFixed(
      0
    )}°F<br><span class="metric">${(((maxTemp - 32) * 5) / 9).toFixed(
      1
    )}°C</span><span class="metric">${maxTempDate}</span>`;
    document.getElementById("climate-min-temp").innerHTML = `${minTemp.toFixed(
      0
    )}°F<br><span class="metric">${(((minTemp - 32) * 5) / 9).toFixed(
      1
    )}°C</span><span class="metric">${minTempDate}</span>`;
    document.getElementById("climate-avg-high").innerHTML = `${avgHigh.toFixed(
      1
    )}°F<br><span class="metric">${(((avgHigh - 32) * 5) / 9).toFixed(
      1
    )}°C</span>`;
    document.getElementById("climate-avg-low").innerHTML = `${avgLow.toFixed(
      1
    )}°F<br><span class="metric">${(((avgLow - 32) * 5) / 9).toFixed(
      1
    )}°C</span>`;
    document.getElementById(
      "climate-monthly-mean"
    ).innerHTML = `${avgMonthlyMean.toFixed(1)}°F<br><span class="metric">${(
      ((avgMonthlyMean - 32) * 5) /
      9
    ).toFixed(1)}°C</span>`;

    // ==================================================
    // RENDER YESTERDAY'S METRICS (UPDATED CONFIGURATION)
    // ==================================================
    if (climate.yesterdayMetrics) {
      const ym = climate.yesterdayMetrics;

      // Render Core Temperatures
      document.getElementById("yesterday-high").innerHTML =
        ym.high === "--"
          ? "--"
          : `${parseFloat(ym.high).toFixed(0)}°F<br><span class="metric">${(
              ((parseFloat(ym.high) - 32) * 5) /
              9
            ).toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`;

      document.getElementById("yesterday-low").innerHTML =
        ym.low === "--"
          ? "--"
          : `${parseFloat(ym.low).toFixed(0)}°F<br><span class="metric">${(
              ((parseFloat(ym.low) - 32) * 5) /
              9
            ).toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`;

      // Style and Render Temperature Departures
      const hdEl = document.getElementById("yesterday-high-departure");
      if (ym.highDeparture !== "--") {
        const hdF = parseFloat(ym.highDeparture);
        const hdC = (hdF * 5) / 9;
        const sign = hdF > 0 ? "+" : "";
        const depClass =
          hdF > 0
            ? "departure-positive"
            : hdF < 0
            ? "departure-negative"
            : "departure-neutral";
        hdEl.innerHTML = `<span class="${depClass}">${sign}${Math.round(
          hdF
        )}°F</span><br><span class="metric ${depClass}">${sign}${hdC.toFixed(
          1
        )}°C</span><span class="metric">${yesterdayDate}</span>`;
      } else {
        hdEl.innerHTML = `--<br><span class="metric">--</span><span class="metric">${yesterdayDate}</span>`;
      }

      const ldEl = document.getElementById("yesterday-low-departure");
      if (ym.lowDeparture !== "--") {
        const ldF = parseFloat(ym.lowDeparture);
        const ldC = (ldF * 5) / 9;
        const sign = ldF > 0 ? "+" : "";
        const depClass =
          ldF > 0
            ? "departure-positive"
            : ldF < 0
            ? "departure-negative"
            : "departure-neutral";
        ldEl.innerHTML = `<span class="${depClass}">${sign}${Math.round(
          ldF
        )}°F</span><br><span class="metric ${depClass}">${sign}${ldC.toFixed(
          1
        )}°C</span><span class="metric">${yesterdayDate}</span>`;
      } else {
        ldEl.innerHTML = `--<br><span class="metric">--</span><span class="metric">${yesterdayDate}</span>`;
      }

      // Render Moisture Values (guarded in case optional elements are omitted from DOM)
      const yRainEl = document.getElementById("yesterday-rain");
      if (yRainEl) {
        if (ym.rain === "--" || ym.rain === "T") {
          yRainEl.innerHTML =
            ym.rain === "T"
              ? `Trace<br><span class="metric">0.0 mm</span><span class="metric">${yesterdayDate}</span>`
              : "--";
        } else {
          const rVal = parseFloat(ym.rain) || 0;
          yRainEl.innerHTML = `${rVal.toFixed(2)} in<br><span class="metric">${(
            rVal * 25.4
          ).toFixed(1)} mm</span><span class="metric">${yesterdayDate}</span>`;
        }
      }

      const ySnowEl = document.getElementById("yesterday-snow");
      if (ySnowEl) {
        if (ym.snow === "--" || ym.snow === "T") {
          ySnowEl.innerHTML =
            ym.snow === "T"
              ? `Trace<br><span class="metric">0.0 cm</span><span class="metric">${yesterdayDate}</span>`
              : "--";
        } else {
          const sVal = parseFloat(ym.snow) || 0;
          ySnowEl.innerHTML = `${sVal.toFixed(1)} in<br><span class="metric">${(
            sVal * 2.54
          ).toFixed(1)} cm</span><span class="metric">${yesterdayDate}</span>`;
        }
      }

      const ySnwdEl = document.getElementById("yesterday-snow-depth");
      if (ySnwdEl) {
        if (ym.snowDepth === "--" || ym.snowDepth === "T") {
          ySnwdEl.innerHTML =
            ym.snowDepth === "T"
              ? `Trace<br><span class="metric">0.0 cm</span><span class="metric">${yesterdayDate}</span>`
              : "--";
        } else {
          const sdVal = parseFloat(ym.snowDepth) || 0;
          ySnwdEl.innerHTML = `${Math.round(sdVal)} in<br><span class="metric">${(
            sdVal * 2.54
          ).toFixed(1)} cm</span><span class="metric">${yesterdayDate}</span>`;
        }
      }

      // Style and Render Rain Departure
      const rdEl = document.getElementById("yesterday-rain-departure");
      if (rdEl) {
        if (ym.rainDeparture !== "--") {
          const rdF = parseFloat(ym.rainDeparture);
          const rdMm = rdF * 25.4;
          const sign = rdF > 0 ? "+" : "";
          const rainDepClass =
            rdF > 0
              ? "rain-positive"
              : rdF < 0
              ? "rain-negative"
              : "rain-neutral";
          rdEl.innerHTML = `<span class="${rainDepClass}">${sign}${rdF.toFixed(
            2
          )} in</span><br><span class="metric ${rainDepClass}">${sign}${rdMm.toFixed(
            1
          )} mm</span><span class="metric">${yesterdayDate}</span>`;
        } else {
          rdEl.innerHTML = `--<br><span class="metric">--</span><span class="metric">${yesterdayDate}</span>`;
        }
      }
    }

    document.getElementById("ytd-rain").innerHTML = `${ytdRain.toFixed(
      2
    )} in<br><span class="metric">${(ytdRain * 25.4).toFixed(1)} mm</span>`;

    const rainDepClass =
      ytdRainDeparture > 0
        ? "rain-positive"
        : ytdRainDeparture < 0
        ? "rain-negative"
        : "rain-neutral";
    document.getElementById(
      "ytd-rain-departure"
    ).innerHTML = `<span class="${rainDepClass}">${
      ytdRainDeparture > 0 ? "+" : ""
    }${ytdRainDeparture.toFixed(2)} in</span><br><span class="metric ${rainDepClass}">${(
      ytdRainDeparture * 25.4
    ).toFixed(1)} mm</span>`;

    // ==================================================
    // NEW SIMPLIFIED SNOW DEPARTURE RENDERING
    // ==================================================
    const observedSeasonalSnow = totalSnow;
    document.getElementById(
      "season-snow"
    ).innerHTML = `${observedSeasonalSnow.toFixed(
      1
    )} in<br><span class="metric">${(observedSeasonalSnow * 2.54).toFixed(
      1
    )} cm</span>`;

    const snowDeparture = observedSeasonalSnow - seasonSnowNormal;
    const snowDepClass =
      snowDeparture > 0
        ? "rain-positive"
        : snowDeparture < 0
        ? "rain-negative"
        : "rain-neutral";
    document.getElementById(
      "season-snow-departure"
    ).innerHTML = `<span class="${snowDepClass}">${
      snowDeparture > 0 ? "+" : ""
    }${snowDeparture.toFixed(1)} in</span><br><span class="metric ${snowDepClass}">${
      snowDeparture > 0 ? "+" : ""
    }${(snowDeparture * 2.54).toFixed(1)} cm</span>`;

    document.getElementById("largest-snow").innerHTML = `${maxSnow.toFixed(
      1
    )} in<br><span class="metric">${(maxSnow * 2.54).toFixed(
      1
    )} cm</span><span class="metric">${maxSnowDate || "N/A"}</span>`;
    document.getElementById("avg-snow").innerHTML = `${avgSnow.toFixed(
      1
    )} in/event<br><span class="metric">${(avgSnow * 2.54).toFixed(
      1
    )} cm</span>`;
    document.getElementById("snow-days").textContent = snowDays;
    document.getElementById("climate-days").textContent = monthlyRows.length;

    // ==================================================
    // FIX OBS PERIOD LAYOUT
    // ==================================================
    let periodEndRow = monthlyRows[monthlyRows.length - 1];
    if (periodEndRow && (periodEndRow[1] === "M" || periodEndRow[2] === "M")) {
      periodEndRow = monthlyRows[monthlyRows.length - 2] || periodEndRow;
    }

    const startDateStr = monthlyRows[0][0];
    const endDateStr = periodEndRow[0];

    if (startDateStr === endDateStr) {
      document.getElementById("climate-period").innerHTML = startDateStr;
    } else {
      document.getElementById(
        "climate-period"
      ).innerHTML = `${startDateStr} <span style="opacity: 0.6; font-size: 0.95em;">through</span> ${endDateStr}`;
    }

    document.getElementById("climate-update").textContent =
      new Date().toLocaleString();
  } catch (error) {
    console.error("Climate data error:", error);
    document.getElementById("climate-update").textContent =
      "Unable to retrieve climate data";
  }
}

// ======================================================
// DAILY RECORDS LOCAL FALLBACK DICTIONARY
// ======================================================
const climateRecords = {
  "01-01": { high: [48, 1937], low: [-37, 1972], rain: [0.77, 1945] },
  "01-02": { high: [55, 1893], low: [-32, 2014], rain: [0.84, 1982] },
  "01-03": { high: [41, 1979], low: [-32, 2014], rain: [0.83, 1979] },
  "01-04": { high: [49, 1950], low: [-32, 1947], rain: [1.10, 1999] },
  "01-05": { high: [50, 1950], low: [-30, 1893], rain: [1.05, 2018] },
  "01-06": { high: [46, 1946], low: [-27, 1957], rain: [1.26, 1931] },
  "01-07": { high: [49, 1946], low: [-28, 1894], rain: [0.70, 1938] },
  "01-08": { high: [41, 2008], low: [-27, 2015], rain: [0.80, 1958] },
  "01-09": { high: [44, 1956], low: [-32, 1976], rain: [1.05, 1956] },
  "01-10": { high: [47, 1978], low: [-36, 1894], rain: [0.59, 1964] },
  "01-11": { high: [42, 2016], low: [-40, 1894], rain: [1.05, 1997] },
  "01-12": { high: [46, 1983], low: [-37, 1976], rain: [1.30, 2020] },
  "01-13": { high: [49, 2018], low: [-36, 1976], rain: [1.10, 2018] },
  "01-14": { high: [48, 1972], low: [-42, 1957], rain: [0.80, 2023] },
  "01-15": { high: [50, 2013], low: [-42, 1957], rain: [1.50, 2006] },
  "01-16": { high: [49, 1995], low: [-40, 2009], rain: [0.95, 1999] },
  "01-17": { high: [38, 1995], low: [-40, 2009], rain: [1.33, 1995] },
  "01-18": { high: [44, 1996], low: [-38, 1979], rain: [0.83, 1941] },
  "01-19": { high: [48, 2006], low: [-35, 1997], rain: [0.81, 2006] },
  "01-20": { high: [59, 1937], low: [-31, 1994], rain: [1.40, 1930] },
  "01-21": { high: [40, 1944], low: [-31, 1950], rain: [1.06, 2019] },
  "01-22": { high: [46, 1957], low: [-39, 1893], rain: [1.39, 1979] },
  "01-23": { high: [44, 1957], low: [-35, 1954], rain: [0.69, 1958] },
  "01-24": { high: [42, 1992], low: [-31, 1948], rain: [1.11, 2018] },
  "01-25": { high: [49, 1999], low: [-31, 1994], rain: [1.20, 2017] },
  "01-26": { high: [57, 1950], low: [-37, 2009], rain: [1.53, 1938] },
  "01-27": { high: [54, 1950], low: [-37, 2009], rain: [1.40, 1986] },
  "01-28": { high: [51, 1986], low: [-33, 2022], rain: [1.67, 1996] },
  "01-29": { high: [46, 1994], low: [-34, 1971], rain: [0.85, 1977] },
  "01-30": { high: [46, 1994], low: [-40, 1951], rain: [1.45, 1945] },
  "01-31": { high: [47, 2013], low: [-32, 1975], rain: [0.79, 1969] },
  "02-01": { high: [46, 2013], low: [-41, 1955], rain: [0.66, 1942] },
  "02-02": { high: [47, 2016], low: [-41, 1962], rain: [1.35, 2008] },
  "02-03": { high: [48, 1976], low: [-30, 1971], rain: [1.65, 2021] },
  "02-04": { high: [45, 1973], low: [-40, 1948], rain: [1.20, 1972] },
  "02-05": { high: [43, 2016], low: [-36, 1985], rain: [1.00, 1954] },
  "02-06": { high: [41, 1947], low: [-35, 1989], rain: [1.24, 1947] },
  "02-07": { high: [41, 1957], low: [-34, 1993], rain: [0.74, 1943] },
  "02-08": { high: [46, 1951], low: [-32, 1893], rain: [1.30, 1951] },
  "02-09": { high: [49, 1970], low: [-31, 1944], rain: [0.87, 2022] },
  "02-10": { high: [48, 1990], low: [-38, 1948], rain: [0.91, 1969] },
  "02-11": { high: [47, 1966], low: [-35, 1975], rain: [0.72, 1940] },
  "02-12": { high: [52, 1981], low: [-35, 1975], rain: [1.15, 1955] },
  "02-13": { high: [45, 1984], low: [-33, 1975], rain: [0.80, 1988] },
  "02-14": { high: [45, 1972], low: [-30, 1967], rain: [1.19, 1966] },
  "02-15": { high: [44, 1972], low: [-31, 1894], rain: [1.25, 2007] },
  "02-16": { high: [43, 1984], low: [-37, 1943], rain: [1.10, 1939] },
  "02-17": { high: [49, 1981], low: [-35, 1997], rain: [0.94, 2025] },
  "02-18": { high: [45, 1981], low: [-41, 1967], rain: [1.00, 2022] },
  "02-19": { high: [50, 1954], low: [-41, 1966], rain: [0.60, 1959] },
  "02-20": { high: [52, 1981], low: [-42, 1966], rain: [0.75, 1972] },
  "02-21": { high: [59, 1994], low: [-38, 1993], rain: [0.82, 2013] },
  "02-22": { high: [50, 1953], low: [-33, 1993], rain: [0.78, 1947] },
  "02-23": { high: [53, 1990], low: [-25, 1963], rain: [0.90, 2022] },
  "02-24": { high: [56, 1981], low: [-27, 1972], rain: [0.95, 1934] },
  "02-25": { high: [50, 2020], low: [-37, 1972], rain: [2.19, 2016] },
  "02-26": { high: [47, 1984], low: [-28, 1972], rain: [1.22, 1965] },
  "02-27": { high: [50, 1976], low: [-30, 1970], rain: [0.86, 1946] },
  "02-28": { high: [59, 2000], low: [-26, 1982], rain: [0.92, 2020] },
  "02-29": { high: [41, 2000], low: [-21, 2008], rain: [0.80, 1984] },
  "03-01": { high: [55, 1894], low: [-33, 1982], rain: [0.87, 2013] },
  "03-02": { high: [49, 1954], low: [-32, 2001], rain: [0.92, 1930] },
  "03-03": { high: [50, 1964], low: [-32, 2001], rain: [2.24, 1947] },
  "03-04": { high: [54, 1894], low: [-34, 2001], rain: [1.08, 1971] },
  "03-05": { high: [60, 1894], low: [-27, 1967], rain: [1.03, 1991] },
  "03-06": { high: [65, 1894], low: [-22, 2015], rain: [0.75, 2004] },
  "03-07": { high: [60, 1894], low: [-31, 1968], rain: [1.08, 2011] },
  "03-08": { high: [54, 1894], low: [-28, 1989], rain: [0.98, 2011] },
  "03-09": { high: [57, 2012], low: [-28, 1984], rain: [2.80, 2005] },
  "03-10": { high: [58, 2026], low: [-28, 1972], rain: [0.81, 1963] },
  "03-11": { high: [58, 1894], low: [-28, 1972], rain: [0.93, 2024] },
  "03-12": { high: [56, 1894], low: [-21, 1948], rain: [1.10, 2026] },
  "03-13": { high: [60, 1977], low: [-24, 1984], rain: [1.06, 1959] },
  "03-14": { high: [56, 1996], low: [-23, 1948], rain: [0.96, 1993] },
  "03-15": { high: [52, 1996], low: [-19, 1967], rain: [1.97, 1984] },
  "03-16": { high: [58, 2025], low: [-18, 1956], rain: [0.70, 1937] },
  "03-17": { high: [62, 2025], low: [-26, 1967], rain: [0.85, 2007] },
  "03-18": { high: [55, 2012], low: [-29, 1967], rain: [1.77, 1972] },
  "03-19": { high: [64, 2012], low: [-23, 1976], rain: [0.80, 1894] },
  "03-20": { high: [55, 1970], low: [-19, 2004], rain: [0.88, 1991] },
  "03-21": { high: [75, 2012], low: [-12, 1967], rain: [0.80, 2008] },
  "03-22": { high: [77, 2012], low: [-10, 1967], rain: [1.51, 1942] },
  "03-23": { high: [70, 2012], low: [-20, 1893], rain: [1.25, 1955] },
  "03-24": { high: [65, 1979], low: [-19, 2008], rain: [1.33, 1968] },
  "03-25": { high: [63, 1987], low: [-19, 2008], rain: [0.70, 1953] },
  "03-26": { high: [70, 1987], low: [-17, 2008], rain: [1.17, 1979] },
  "03-27": { high: [69, 1986], low: [-7, 1972], rain: [1.49, 1955] },
  "03-28": { high: [63, 1993], low: [-13, 1974], rain: [0.72, 1953] },
  "03-29": { high: [65, 1993], low: [-7, 1974], rain: [0.97, 2016] },
  "03-30": { high: [77, 1962], low: [-7, 1974], rain: [1.12, 2010] },
  "03-31": { high: [67, 1962], low: [-8, 1954], rain: [1.10, 1981] },
  "04-01": { high: [59, 2004], low: [-7, 1964], rain: [0.74, 1987] },
  "04-02": { high: [70, 1986], low: [-9, 1964], rain: [1.34, 1976] },
  "04-03": { high: [68, 2010], low: [-6, 1893], rain: [1.10, 2005] },
  "04-04": { high: [80, 2010], low: [-2, 1978], rain: [0.90, 2005] },
  "04-05": { high: [68, 2010], low: [-2, 2003], rain: [1.65, 1933] },
  "04-06": { high: [62, 2010], low: [-12, 2015], rain: [1.20, 2007] },
  "04-07": { high: [60, 1962], low: [-7, 1893], rain: [2.55, 1929] },
  "04-08": { high: [61, 2021], low: [-5, 1943], rain: [0.74, 1933] },
  "04-09": { high: [69, 1945], low: [3, 1974], rain: [0.71, 1964] },
  "04-10": { high: [76, 1945], low: [5, 1977], rain: [1.40, 2010] },
  "04-11": { high: [77, 1945], low: [-4, 1938], rain: [1.22, 1996] },
  "04-12": { high: [83, 1945], low: [9, 1967], rain: [0.91, 1978] },
  "04-13": { high: [81, 1945], low: [4, 1985], rain: [1.83, 1940] },
  "04-14": { high: [78, 1945], low: [1, 1985], rain: [1.00, 1971] },
  "04-15": { high: [66, 1969], low: [10, 2018], rain: [0.78, 1955] },
  "04-16": { high: [66, 1987], low: [9, 2011], rain: [1.10, 2000] },
  "04-17": { high: [78, 2012], low: [3, 2003], rain: [0.97, 1954] },
  "04-18": { high: [71, 2008], low: [5, 2003], rain: [1.29, 1983] },
  "04-19": { high: [68, 1987], low: [7, 1944], rain: [0.53, 1942] },
  "04-20": { high: [74, 1931], low: [10, 1974], rain: [0.72, 2019] },
  "04-21": { high: [78, 1954], low: [8, 1947], rain: [0.75, 1950] },
  "04-22": { high: [82, 1987], low: [13, 2026], rain: [1.60, 1930] },
  "04-23": { high: [77, 1954], low: [18, 2013], rain: [1.38, 1958] },
  "04-24": { high: [81, 1942], low: [18, 1944], rain: [1.90, 2000] },
  "04-25": { high: [79, 1942], low: [15, 1962], rain: [1.10, 1928] },
  "04-26": { high: [77, 2009], low: [14, 1947], rain: [0.86, 1983] },
  "04-27": { high: [76, 1937], low: [16, 1966], rain: [0.97, 2018] },
  "04-28": { high: [83, 1990], low: [14, 1947], rain: [1.69, 1945] },
  "04-29": { high: [76, 1986], low: [0, 1947], rain: [2.00, 1928] },
  "04-30": { high: [79, 1986], low: [21, 1943], rain: [2.90, 2008] },
  "05-01": { high: [80, 2004], low: [21, 1977], rain: [1.20, 2026] },
  "05-02": { high: [83, 1970], low: [19, 1974], rain: [1.00, 2017] },
  "05-03": { high: [82, 1942], low: [19, 1974], rain: [1.33, 1929] },
  "05-04": { high: [88, 1944], low: [23, 1985], rain: [1.24, 1947] },
  "05-05": { high: [86, 1999], low: [23, 1957], rain: [0.92, 2011] },
  "05-06": { high: [84, 1999], low: [20, 1985], rain: [1.32, 1946] },
  "05-07": { high: [85, 1964], low: [20, 1966], rain: [1.08, 2026] },
  "05-08": { high: [82, 1957], low: [17, 1950], rain: [0.86, 1967] },
  "05-09": { high: [83, 1982], low: [20, 1985], rain: [1.21, 1958] },
  "05-10": { high: [88, 1953], low: [20, 1956], rain: [1.05, 1999] },
  "05-11": { high: [85, 1953], low: [25, 1951], rain: [0.80, 1954] },