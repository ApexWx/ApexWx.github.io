     // ======================================================
         // LANCASTER (LNS) CLIMATE DATA
         // ======================================================
         
         async function loadClimateData() {
         console.log("LOAD CLIMATE DATA STARTED FOR LNS");
         try {
         // Points to your Lancaster Cloudflare Worker Endpoint
         const response = await fetch("https://almanac-api.maineapexwx.workers.dev/");
         const climate = await response.json();
         
         // ==================================================
         // UNPACK DATASETS FROM WORKER
         // ==================================================
         const monthlyRows = climate.monthlyRows || [];
         const seasonalRows = climate.seasonalRows || [];
         const ytdRain = climate.ytdRain || 0;
         const ytdRainDeparture = climate.ytdRainDeparture || 0;
         const seasonSnowNormal = Number.isFinite(climate.seasonSnowNormal) ? climate.seasonSnowNormal : 22.0;
         const todayNormals = climate.todayNormals || {
         normalHigh: 80,
         normalLow: 58,
         normalRain: 0.15
         };
         
         // ==================================================
         // YESTERDAY'S COMPLETE CLIMATE OBSERVATION
         // ==================================================
         const easternTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
         const todayObj = new Date(easternTimeStr);
         const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
         
         const latestRow = [...monthlyRows]
         .reverse()
         .find(row =>
         row[0] !== todayStr &&
         row[1] !== "M" &&
         row[2] !== "M" &&
         row[1] !== "" &&
         row[2] !== ""
         );
         
         if (!latestRow) {
         console.warn("No valid climate observations found for Lancaster.");
         return;
         }
         
         const yesterdayDate = latestRow[0];
         const yesterdayHigh = (latestRow[1] !== "M" && latestRow[1] !== "") ? parseFloat(latestRow[1]) : null;
         const yesterdayLow = (latestRow[2] !== "M" && latestRow[2] !== "") ? parseFloat(latestRow[2]) : null;
         const yesterdayRain = (latestRow[3] !== "M" && latestRow[3] !== "T") ? parseFloat(latestRow[3]) || 0 : 0;
         
         // ==================================================
         // DAILY NORMALS & RECORDS LOOKUP (LNS SPECIFIC)
         // ==================================================
         let normHigh = todayNormals.normalHigh;
         let normLow = todayNormals.normalLow;
         let normRain = todayNormals.normalRain;
         
         const localKey = `${String(todayObj.getMonth() + 1).padStart(2, "0")}-${String(todayObj.getDate()).padStart(2, "0")}`;
         
         // Accurate Lancaster Historic Records Fallback Dictionary
         const fallbackRec = lnsClimateRecords[localKey] || { high: [94, "2021"], low: [49, "2007"], rain: [1.18, "2013"] };
         
         let recHighVal = fallbackRec.high[0];
         let recHighYear = fallbackRec.high[1];
         let recLowVal = fallbackRec.low[0];
         let recLowYear = fallbackRec.low[1];
         let recRainVal = fallbackRec.rain[0];
         let recRainYear = fallbackRec.rain[1];
         
         // Render Normals to DOM (Fahrenheit / Celsius / Metric conversions)
         document.getElementById("normal-high").innerHTML =
         `${Number(normHigh).toFixed(0)}°F<br><span class="metric">${((Number(normHigh) - 32) * 5 / 9).toFixed(1)}°C</span>`;
         document.getElementById("normal-low").innerHTML =
         `${Number(normLow).toFixed(0)}°F<br><span class="metric">${((Number(normLow) - 32) * 5 / 9).toFixed(1)}°C</span>`;
         document.getElementById("normal-rain").innerHTML =
         `${Number(normRain).toFixed(2)} in<br><span class="metric">${(Number(normRain) * 25.4).toFixed(1)} mm</span>`;
         
         // Render Records to DOM
         document.getElementById("record-high").innerHTML =
         `${parseFloat(recHighVal).toFixed(0)}°F<br><span class="metric">${((parseFloat(recHighVal) - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${recHighYear}</span>`;
         document.getElementById("record-low").innerHTML =
         `${parseFloat(recLowVal).toFixed(0)}°F<br><span class="metric">${((parseFloat(recLowVal) - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${recLowYear}</span>`;
         document.getElementById("record-rain").innerHTML =
         `${parseFloat(recRainVal).toFixed(2)} in<br><span class="metric">${(parseFloat(recRainVal) * 25.4).toFixed(1)} mm</span><span class="metric">${recRainYear}</span>`;
         
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
         monthlyRows.forEach(row => {
         const date = row[0];
         const high = parseFloat(row[1]);
         const low = parseFloat(row[2]);
         let rain = 0;
         if (row[3] !== "M" && row[3] !== "T") {
         rain = parseFloat(row[3]) || 0;
         }
         totalRain += rain;
         if (rain > maxRain) { maxRain = rain; }
         
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
         seasonalRows.forEach(row => {
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
         
         // ==================================================
         // CALCULATE AVERAGES
         // ==================================================
         const avgHigh = validHighs > 0 ? totalHigh / validHighs : 0;
         const avgLow = validLows > 0 ? totalLow / validLows : 0;
         const avgMonthlyMean = (avgHigh + avgLow) / 2;
         const avgRain = monthlyRows.length > 0 ? totalRain / monthlyRows.length : 0;
         const avgSnow = snowDays > 0 ? totalSnow / snowDays : 0;
         
         // Render Monthly Summaries to DOM
         document.getElementById("climate-month-rain").innerHTML = `${totalRain.toFixed(2)} in<br><span class="metric">${(totalRain * 25.4).toFixed(1)} mm</span>`;
         document.getElementById("climate-max-rain").innerHTML = `${maxRain.toFixed(2)} in<br><span class="metric">${(maxRain * 25.4).toFixed(1)} mm</span>`;
         document.getElementById("climate-avg-rain").innerHTML = `${avgRain.toFixed(2)} in/day<br><span class="metric">${(avgRain * 25.4).toFixed(1)} mm/day</span>`;
         
         document.getElementById("climate-days").textContent = validHighs;
         document.getElementById("climate-max-temp").innerHTML = `${maxTemp.toFixed(0)}°F<br><span class="metric">${((maxTemp - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${maxTempDate}</span>`;
         document.getElementById("climate-min-temp").innerHTML = `${minTemp.toFixed(0)}°F<br><span class="metric">${((minTemp - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${minTempDate}</span>`;
         document.getElementById("climate-avg-high").innerHTML = `${avgHigh.toFixed(1)}°F<br><span class="metric">${((avgHigh - 32) * 5 / 9).toFixed(1)}°C</span>`;
         document.getElementById("climate-avg-low").innerHTML = `${avgLow.toFixed(1)}°F<br><span class="metric">${((avgLow - 32) * 5 / 9).toFixed(1)}°C</span>`;
         document.getElementById("climate-monthly-mean").innerHTML = `${avgMonthlyMean.toFixed(1)}°F<br><span class="metric">${((avgMonthlyMean - 32) * 5 / 9).toFixed(1)}°C</span>`;
         
         // Yesterday Conditions Render
         document.getElementById("yesterday-high").innerHTML = yesterdayHigh !== null
         ? `${yesterdayHigh.toFixed(0)}°F<br><span class="metric">${((yesterdayHigh - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`
         : "--";
         
         // Dynamic Color Class Processing (Temperature departures)
         if (highDeparture !== null && !isNaN(highDeparture)) {
         const highDepC = highDeparture * 5 / 9;
         const depClass = highDeparture > 0 ? "departure-positive" : highDeparture < 0 ? "departure-negative" : "departure-neutral";
         document.getElementById("yesterday-high-departure").innerHTML = `<span class="${depClass}">${highDeparture > 0 ? "+" : ""}${Math.round(highDeparture)}°F</span><br><span class="metric ${depClass}">${highDepC > 0 ? "+" : ""}${highDepC.toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`;
         }
         
         document.getElementById("yesterday-low").innerHTML = yesterdayLow !== null
         ? `${yesterdayLow.toFixed(0)}°F<br><span class="metric">${((yesterdayLow - 32) * 5 / 9).toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`
         : "--";
         
         if (lowDeparture !== null && !isNaN(lowDeparture)) {
         const lowDepC = lowDeparture * 5 / 9;
         const depClass = lowDeparture > 0 ? "departure-positive" : lowDeparture < 0 ? "departure-negative" : "departure-neutral";
         document.getElementById("yesterday-low-departure").innerHTML = `<span class="${depClass}">${lowDeparture > 0 ? "+" : ""}${Math.round(lowDeparture)}°F</span><br><span class="metric ${depClass}">${lowDepC > 0 ? "+" : ""}${lowDepC.toFixed(1)}°C</span><span class="metric">${yesterdayDate}</span>`;
         }
         
         // Year-to-Date Rain Render & Color Coding
         document.getElementById("ytd-rain").innerHTML = `${ytdRain.toFixed(2)} in<br><span class="metric">${(ytdRain * 25.4).toFixed(1)} mm</span>`;
         const rainDepClass = ytdRainDeparture > 0 ? "rain-positive" : ytdRainDeparture < 0 ? "rain-negative" : "rain-neutral";
         document.getElementById("ytd-rain-departure").innerHTML = `<span class="${rainDepClass}">${ytdRainDeparture > 0 ? "+" : ""}${ytdRainDeparture.toFixed(2)} in</span><br><span class="metric ${rainDepClass}">${(ytdRainDeparture * 25.4).toFixed(1)} mm</span>`;
         
// ==================================================
// SNOW SEASON RENDERING (AUTOMATED)
// ==================================================
// The loop above has already calculated the true 'totalSnow' from the API
const currentSeasonalSnow = totalSnow; 

// Render Dynamic Snowfall
document.getElementById("season-snow").innerHTML = `${currentSeasonalSnow.toFixed(1)} in<br><span class="metric">${(currentSeasonalSnow * 2.54).toFixed(1)} cm</span>`;

// Auto-Calculate Departure using the running season-to-date normal
const snowDeparture = currentSeasonalSnow - seasonSnowNormal;
const snowDepClass = snowDeparture > 0 ? "rain-positive" : snowDeparture < 0 ? "rain-negative" : "rain-neutral";

// Render Auto-Calculated Departure
document.getElementById("season-snow-departure").innerHTML = `<span class="${snowDepClass}">${snowDeparture > 0 ? "+" : ""}${snowDeparture.toFixed(1)} in</span><br><span class="metric ${snowDepClass}">${snowDeparture > 0 ? "+" : ""}${(snowDeparture * 2.54).toFixed(1)} cm</span>`;
         
         // ==================================================
         // OBSERVATION PERIOD LAYOUT FORMATTING
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
         document.getElementById("climate-period").innerHTML = `${startDateStr} <span style="opacity: 0.6; font-size: 0.95em;">through</span> ${endDateStr}`;
         }
         
         document.getElementById("climate-update").textContent = new Date().toLocaleString();
         } catch(error) {
         console.error("Climate data error:", error);
         document.getElementById("climate-update").textContent = "Unable to retrieve climate data";
         }
         }
         
         // ======================================================
         // DAILY RECORDS LOCAL FALLBACK DICTIONARY (LANCASTER LNS)
         // ======================================================
         const lnsClimateRecords = {
         "01-01": { high: [64, 2005], low: [-4, 2018], rain: [0.90, 2007] },
         "01-02": { high: [65, 2023], low: [5, 2018], rain: [1.28, 1979] },
         "01-03": { high: [62, 2004], low: [-2, 2018], rain: [1.30, 1999] },
         "01-04": { high: [68, 2000], low: [0, 2014], rain: [1.52, 1982] },
         "01-05": { high: [63, 1998], low: [7, 1981], rain: [1.69, 1949] },
         "01-06": { high: [69, 2007], low: [-3, 1981], rain: [1.33, 2024] },
         "01-07": { high: [64, 1998], low: [0, 2014], rain: [1.34, 1996] },
         "01-08": { high: [66, 2008], low: [6, 2015], rain: [0.90, 2007] },
         "01-09": { high: [64, 1998], low: [-4, 1981], rain: [2.04, 2024] },
         "01-10": { high: [61, 2016], low: [2, 2004], rain: [1.10, 2016] },
         "01-11": { high: [66, 2020], low: [-6, 1988], rain: [0.96, 1991] },
         "01-12": { high: [65, 2017], low: [-2, 1981], rain: [0.90, 1996] },
         "01-13": { high: [64, 2005], low: [-5, 1981], rain: [0.52, 2012] },
         "01-14": { high: [68, 1995], low: [2, 1988], rain: [1.45, 2005] },
         "01-15": { high: [62, 1995], low: [0, 1988], rain: [0.78, 1999] },
         "01-16": { high: [64, 1995], low: [-2, 1977], rain: [0.72, 2013] },
         "01-17": { high: [62, 1990], low: [-6, 1982], rain: [1.80, 1994] },
         "01-18": { high: [67, 1990], low: [-4, 1977], rain: [1.20, 1978] },
         "01-19": { high: [60, 1986], low: [-7, 1994], rain: [1.20, 1996] },
         "01-20": { high: [62, 2006], low: [-8, 1994], rain: [1.59, 1995] },
         "01-21": { high: [62, 2006], low: [-16, 1994], rain: [0.48, 2012] },
         "01-22": { high: [57, 2018], low: [-16, 1984], rain: [1.06, 1987] },
         "01-23": { high: [65, 1999], low: [-2, 1984], rain: [1.25, 1998] },
         "01-24": { high: [62, 1999], low: [2, 1987], rain: [0.98, 2019] },
         "01-25": { high: [62, 2010], low: [0, 1987], rain: [1.68, 1979] },
         "01-26": { high: [55, 1978], low: [8, 1982], rain: [1.36, 1986] },
         "01-27": { high: [66, 2002], low: [-2, 1987], rain: [0.71, 1996] },
         "01-28": { high: [64, 2002], low: [-6, 1987], rain: [0.87, 2024] },
         "01-29": { high: [70, 2002], low: [1, 1977], rain: [1.56, 1990] },
         "01-30": { high: [64, 2013], low: [-2, 2019], rain: [1.97, 2013] },
         "01-31": { high: [65, 2012], low: [-7, 2019], rain: [1.12, 2013] },
         "02-01": { high: [68, 1989], low: [-2, 2019], rain: [1.60, 2008] },
         "02-02": { high: [59, 1986], low: [-4, 2019], rain: [0.95, 1981] },
         "02-03": { high: [66, 2020], low: [-4, 2019], rain: [1.81, 1982] },
         "02-04": { high: [65, 2020], low: [-1, 1985], rain: [1.07, 2018] },
         "02-05": { high: [67, 1991], low: [-2, 1996], rain: [1.44, 2014] },
         "02-06": { high: [68, 2008], low: [-6, 1996], rain: [1.88, 2004] },
         "02-07": { high: [64, 2017], low: [1, 1993], rain: [1.40, 1951] },
         "02-08": { high: [64, 2017], low: [7, 1995], rain: [0.82, 1994] },
         "02-09": { high: [62, 2023], low: [-2, 1978], rain: [0.85, 1950] },
         "02-10": { high: [62, 2001], low: [-3, 1978], rain: [0.76, 2010] },
         "02-11": { high: [67, 2009], low: [2, 1979], rain: [1.17, 1994] },
         "02-12": { high: [70, 1999], low: [1, 2014], rain: [1.30, 1985] },
         "02-13": { high: [58, 2023], low: [-7, 1983], rain: [1.75, 2008] },
         "02-14": { high: [61, 1990], low: [-6, 1979], rain: [1.86, 2007] },
         "02-15": { high: [69, 2023], low: [2, 2015], rain: [1.09, 1984] },
         "02-16": { high: [62, 1990], low: [0, 2015], rain: [1.00, 2003] },
         "02-17": { high: [66, 2011], low: [0, 1979], rain: [0.77, 2003] },
         "02-18": { high: [72, 2011], low: [-9, 1979], rain: [1.05, 1986] },
         "02-19": { high: [68, 2017], low: [1, 2015], rain: [0.77, 1979] },
         "02-20": { high: [74, 2018], low: [-5, 1979], rain: [0.77, 2019] },
         "02-21": { high: [82, 2018], low: [1, 2015], rain: [0.83, 1951] },
         "02-22": { high: [67, 1997], low: [8, 2011], rain: [1.18, 2003] },
         "02-23": { high: [73, 2017], low: [6, 2011], rain: [1.72, 1987] },
         "02-24": { high: [76, 1985], low: [0, 2015], rain: [1.70, 1984] },
         "02-25": { high: [75, 2017], low: [8, 2015], rain: [0.70, 2011] },
         "02-26": { high: [63, 2002], low: [8, 1990], rain: [0.97, 1979] },
         "02-27": { high: [76, 1997], low: [7, 2014], rain: [0.48, 2000] },
         "02-28": { high: [65, 2016], low: [5, 2014], rain: [0.96, 2021] },
         "02-29": { high: [61, 2004], low: [7, 1980], rain: [1.20, 2012] },
         "03-01": { high: [72, 2017], low: [7, 1980], rain: [0.75, 2018] },
         "03-02": { high: [71, 1991], low: [10, 1980], rain: [1.04, 2024] },
         "03-03": { high: [70, 1991], low: [10, 2014], rain: [1.02, 2023] },
         "03-04": { high: [67, 2024], low: [8, 2014], rain: [1.32, 1993] },
         "03-05": { high: [64, 1983], low: [11, 1978], rain: [1.10, 2026] },
         "03-06": { high: [77, 2022], low: [3, 2015], rain: [1.35, 2011] },
         "03-07": { high: [78, 2022], low: [0, 2015], rain: [0.76, 1996] },
         "03-08": { high: [81, 2000], low: [-1, 1986], rain: [2.18, 1995] },
         "03-09": { high: [81, 2000], low: [11, 1996], rain: [1.35, 2024] },
         "03-10": { high: [82, 2026], low: [-2, 1984], rain: [1.65, 2011] },
         "03-11": { high: [80, 2026], low: [11, 1984], rain: [0.68, 2000] },
         "03-12": { high: [83, 1990], low: [13, 1984], rain: [1.40, 2013] },
         "03-13": { high: [81, 1990], low: [16, 2017], rain: [1.90, 1993] },
         "03-14": { high: [84, 1990], low: [16, 1993], rain: [1.16, 1980] },
         "03-15": { high: [80, 1990], low: [11, 1993], rain: [0.65, 1986] },
         "03-16": { high: [79, 1990], low: [13, 1993], rain: [1.55, 2007] },
         "03-17": { high: [73, 2012], low: [11, 1987], rain: [1.00, 1990] },
         "03-18": { high: [80, 2011], low: [13, 1993], rain: [0.77, 2021] },
         "03-19": { high: [75, 2022], low: [7, 1993], rain: [0.90, 1996] },
         "03-20": { high: [81, 2020], low: [20, 2023], rain: [1.64, 2003] },
         "03-21": { high: [76, 2010], low: [11, 1986], rain: [3.24, 2000] },
         "03-22": { high: [78, 2026], low: [13, 1986], rain: [1.00, 1950] },
         "03-23": { high: [80, 2012], low: [16, 2017], rain: [1.70, 2005] },
         "03-24": { high: [79, 1988], low: [19, 2019], rain: [1.12, 1989] },
         "03-25": { high: [77, 2017], low: [18, 2014], rain: [0.47, 2013] },
         "03-26": { high: [81, 2021], low: [21, 1983], rain: [2.27, 1978] },
         "03-27": { high: [84, 1998], low: [17, 2019], rain: [1.40, 1978] },
         "03-28": { high: [83, 1989], low: [19, 1982], rain: [1.42, 2020] },
         "03-29": { high: [85, 2025], low: [20, 1982], rain: [1.35, 1984] },
         "03-30": { high: [88, 1998], low: [24, 2008], rain: [1.32, 2014] },
         "03-31": { high: [85, 1998], low: [17, 2019], rain: [1.53, 2025] },
         "04-01": { high: [80, 2016], low: [25, 2003], rain: [1.28, 1998] },
         "04-02": { high: [80, 2003], low: [25, 1984], rain: [1.70, 2005] },
         "04-03": { high: [79, 2025], low: [24, 1985], rain: [1.80, 2024] },
         "04-04": { high: [83, 2026], low: [27, 1992], rain: [0.58, 1982] },
         "04-05": { high: [85, 2023], low: [25, 1949], rain: [0.60, 1987] },
         "04-06": { high: [89, 2010], low: [23, 2016], rain: [1.50, 2017] },
         "04-07": { high: [88, 2010], low: [16, 1982], rain: [1.23, 2022] },
         "04-08": { high: [86, 1991], low: [22, 1982], rain: [0.87, 2000] },
         "04-09": { high: [85, 2001], low: [25, 1985], rain: [1.32, 1998] },
         "04-10": { high: [90, 2013], low: [20, 2019], rain: [1.68, 1983] },
         "04-11": { high: [88, 2017], low: [25, 2007], rain: [1.26, 2021] },
         "04-12": { high: [85, 2023], low: [26, 1989], rain: [1.34, 1951] },
         "04-13": { high: [88, 2023], low: [23, 1986], rain: [1.83, 2020] },
         "04-14": { high: [87, 2023], low: [23, 1986], rain: [0.94, 1981] },
         "04-15": { high: [88, 2026], low: [30, 1982], rain: [2.00, 2007] },
         "04-16": { high: [90, 2026], low: [29, 2014], rain: [1.75, 1986] },
         "04-17": { high: [93, 2002], low: [29, 1949], rain: [0.58, 2001] },
         "04-18": { high: [87, 2002], low: [29, 2022], rain: [1.22, 2022] },
         "04-19": { high: [89, 2002], low: [29, 1990], rain: [1.40, 1998] },
         "04-20": { high: [88, 1985], low: [29, 2020], rain: [0.92, 2015] },
         "04-21": { high: [88, 1985], low: [26, 2020], rain: [0.90, 1993] },
         "04-22": { high: [92, 1985], low: [29, 1981], rain: [2.45, 2006] },
         "04-23": { high: [92, 1985], low: [28, 1986], rain: [0.75, 2005] },
         "04-24": { high: [87, 2025], low: [29, 1989], rain: [0.94, 1983] },
         "04-25": { high: [89, 2009], low: [30, 1999], rain: [1.27, 2018] },
         "04-26": { high: [91, 1990], low: [32, 1987], rain: [1.22, 2003] },
         "04-27": { high: [93, 2009], low: [31, 2020], rain: [0.93, 1988] },
         "04-28": { high: [90, 2021], low: [32, 2012], rain: [1.34, 2008] },
         "04-29": { high: [91, 2024], low: [25, 2019], rain: [1.05, 2014] },
         "04-30": { high: [90, 2024], low: [32, 2022], rain: [2.23, 2020] },
         "05-01": { high: [91, 2010], low: [28, 1978], rain: [0.85, 1989] },
         "05-02": { high: [91, 2024], low: [33, 2019], rain: [0.97, 2002] },
         "05-03": { high: [93, 2018], low: [33, 2005], rain: [2.30, 1985] },
         "05-04": { high: [90, 2001], low: [33, 1986], rain: [1.39, 1984] },
         "05-05": { high: [91, 1949], low: [34, 2005], rain: [2.80, 1989] },
         "05-06": { high: [88, 1949], low: [38, 1992], rain: [1.70, 1989] },
         "05-07": { high: [91, 2000], low: [26, 2020], rain: [1.66, 2022] },
         "05-08": { high: [91, 2000], low: [30, 2020], rain: [0.98, 2020] },
         "05-09": { high: [91, 1979], low: [21, 2020], rain: [1.19, 2025] },
         "05-10": { high: [90, 1979], low: [34, 1986], rain: [1.28, 1990] },
         "05-11": { high: [88, 1979], low: [35, 1983], rain: [1.25, 2006] },
         "05-12": { high: [88, 2023], low: [34, 1949], rain: [1.25, 2019] },
         "05-13": { high: [88, 1991], low: [35, 2013], rain: [1.31, 2018] },
         "05-14": { high: [86, 1991], low: [32, 1996], rain: [1.21, 1978] },
         "05-15": { high: [92, 2018], low: [35, 2020], rain: [2.03, 1978] },
         "05-16": { high: [90, 1998], low: [40, 1980], rain: [2.44, 2014] },
         "05-17": { high: [95, 2017], low: [34, 1983], rain: [0.84, 2011] },
         "05-18": { high: [95, 2017], low: [36, 2023], rain: [1.27, 1950] },
         "05-19": { high: [94, 2026], low: [36, 2009], rain: [1.58, 1988] },
         "05-20": { high: [94, 1996], low: [37, 2002], rain: [0.72, 2000] },
         "05-21": { high: [95, 2022], low: [36, 2002], rain: [0.98, 1980] },
         "05-22": { high: [93, 2022], low: [35, 2002], rain: [1.03, 2020] },
         "05-23": { high: [93, 2021], low: [39, 2002], rain: [1.05, 1989] },
         "05-24": { high: [99, 1995], low: [41, 2006], rain: [1.56, 1979] },
         "05-25": { high: [91, 1991], low: [43, 2008], rain: [1.80, 1995] },
         "05-26": { high: [93, 2018], low: [43, 1949], rain: [1.35, 2021] },
         "05-27": { high: [91, 1991], low: [39, 1949], rain: [0.80, 2010] },
         "05-28": { high: [90, 2012], low: [38, 1994], rain: [1.66, 2025] },
         "05-29": { high: [92, 2012], low: [35, 1949], rain: [2.76, 1948] },
         "05-30": { high: [93, 2013], low: [37, 1949], rain: [0.78, 2014] },
         "05-31": { high: [95, 2022], low: [40, 1996], rain: [1.80, 2010] },
         "06-01": { high: [95, 2022], low: [41, 1984], rain: [3.05, 2012] },
         "06-02": { high: [95, 2013], low: [42, 1993], rain: [2.41, 1982] },
         "06-03": { high: [93, 2013], low: [36, 1986], rain: [1.87, 2021] },
         "06-04": { high: [91, 2020], low: [33, 2019], rain: [0.99, 2003] },
         "06-05": { high: [93, 2021], low: [44, 1988], rain: [1.30, 2004] },
         "06-06": { high: [94, 2021], low: [42, 2019], rain: [2.20, 1986] },
         "06-07": { high: [95, 1999], low: [47, 1985], rain: [1.33, 2013] },
         "06-08": { high: [94, 1984], low: [43, 2016], rain: [1.27, 2015] },
         "06-09": { high: [96, 2011], low: [39, 2019], rain: [0.84, 1989] },
         "06-10": { high: [96, 2008], low: [43, 1988], rain: [1.73, 2013] },
         "06-11": { high: [93, 1984], low: [41, 1980], rain: [1.75, 2011] },
         "06-12": { high: [94, 2017], low: [44, 1980], rain: [1.80, 1994] },
         "06-13": { high: [97, 2017], low: [42, 1979], rain: [2.06, 2014] },
         "06-14": { high: [94, 1984], low: [45, 1979], rain: [1.37, 1981] },
         "06-15": { high: [94, 1987], low: [46, 1985], rain: [0.54, 1990] },
         "06-16": { high: [95, 1991], low: [46, 1984], rain: [1.32, 2001] },
         "06-17": { high: [94, 2022], low: [49, 1980], rain: [2.27, 2004] },
         "06-18": { high: [95, 2018], low: [45, 1986], rain: [1.77, 1984] },
         "06-19": { high: [93, 1993], low: [46, 1986], rain: [2.40, 1996] },
         "06-20": { high: [93, 2012], low: [45, 1986], rain: [2.05, 2003] },
         "06-21": { high: [96, 2024], low: [47, 1985], rain: [0.82, 2000] },
         "06-22": { high: [99, 2024], low: [48, 1986], rain: [1.59, 1951] },
         "06-23": { high: [98, 2025], low: [45, 1992], rain: [0.90, 2016] },
         "06-24": { high: [98, 2025], low: [50, 1993], rain: [1.06, 2017] },
         "06-25": { high: [96, 2025], low: [45, 1979], rain: [1.15, 2000] },
         "06-26": { high: [95, 2024], low: [44, 1986], rain: [2.74, 1995] },
         "06-27": { high: [94, 2007], low: [49, 1985], rain: [1.95, 2006] },
         "06-28": { high: [95, 1991], low: [51, 1981], rain: [0.95, 2025] },
         "06-29": { high: [97, 2012], low: [53, 1981], rain: [0.81, 1983] },
         "06-30": { high: [95, 1991], low: [49, 1988], rain: [2.00, 2025] },
         "07-01": { high: [96, 2018], low: [46, 1986], rain: [2.80, 2006] },
         "07-02": { high: [97, 2018], low: [51, 1982], rain: [0.76, 1981] },
         "07-03": { high: [95, 1983], low: [50, 2001], rain: [2.67, 1978] },
         "07-04": { high: [97, 1990], low: [50, 1977], rain: [1.36, 1981] },
         "07-05": { high: [98, 1999], low: [50, 1979], rain: [1.00, 2007] },
         "07-06": { high: [99, 1999], low: [50, 1979], rain: [2.29, 2020] },
         "07-07": { high: [101, 2012], low: [49, 1980], rain: [4.54, 1984] },
         "07-08": { high: [98, 2010], low: [51, 1984], rain: [2.31, 2005] },
         "07-09": { high: [96, 1990], low: [49, 1984], rain: [1.93, 2023] },
         "07-10": { high: [99, 1988], low: [50, 1983], rain: [1.45, 2014] },
         "07-11": { high: [96, 1988], low: [51, 1983], rain: [1.30, 2010] },
         "07-12": { high: [93, 2021], low: [50, 1978], rain: [1.78, 1949] },
         "07-13": { high: [95, 2024], low: [52, 1978], rain: [2.62, 1996] },
         "07-14": { high: [96, 2024], low: [53, 2009], rain: [2.83, 1994] },
         "07-15": { high: [98, 2024], low: [53, 2009], rain: [2.49, 2015] },
         "07-16": { high: [102, 1988], low: [55, 1999], rain: [0.92, 1980] },
         "07-17": { high: [98, 1977], low: [54, 1987], rain: [1.20, 1992] },
         "07-18": { high: [100, 1977], low: [56, 1985], rain: [1.10, 2006] },
         "07-19": { high: [97, 1991], low: [56, 2009], rain: [2.90, 1988] },
         "07-20": { high: [98, 1980], low: [53, 1997], rain: [1.98, 2010] },
         "07-21": { high: [100, 1991], low: [55, 2001], rain: [2.09, 1979] },
         "07-22": { high: [103, 2011], low: [57, 1982], rain: [2.04, 2013] },
         "07-23": { high: [101, 1991], low: [51, 1983], rain: [2.77, 2018] },
         "07-24": { high: [97, 2010], low: [48, 1985], rain: [0.96, 2018] },
         "07-25": { high: [98, 2010], low: [54, 2014], rain: [1.15, 2010] },
         "07-26": { high: [94, 2005], low: [54, 2014], rain: [0.83, 1988] },
         "07-27": { high: [95, 2005], low: [54, 1977], rain: [4.44, 1986] },
         "07-28": { high: [95, 1993], low: [57, 1985], rain: [0.68, 2002] },
         "07-29": { high: [97, 2002], low: [55, 1984], rain: [1.75, 2007] },
         "07-30": { high: [96, 1983], low: [51, 1997], rain: [0.84, 2016] },
         "07-31": { high: [99, 1999], low: [54, 1997], rain: [3.01, 2025] },
         "08-01": { high: [99, 1983], low: [54, 1998], rain: [1.45, 2018] },
         "08-02": { high: [101, 2002], low: [54, 1990], rain: [1.17, 1986] },
         "08-03": { high: [96, 2006], low: [55, 1985], rain: [1.46, 1948] },
         "08-04": { high: [96, 1987], low: [53, 1985], rain: [2.94, 2020] },
         "08-05": { high: [95, 1980], low: [55, 1992], rain: [1.50, 1948] },
         "08-06": { high: [96, 2001], low: [48, 1994], rain: [2.00, 2024] },
         "08-07": { high: [98, 2001], low: [51, 1994], rain: [2.66, 2020] },
         "08-08": { high: [98, 2001], low: [51, 1989], rain: [1.08, 1985] },
         "08-09": { high: [101, 2001], low: [50, 1989], rain: [2.24, 1987] },
         "08-10": { high: [96, 2010], low: [53, 1989], rain: [0.94, 1951] },
         "08-11": { high: [96, 2021], low: [55, 1996], rain: [0.96, 2001] },
         "08-12": { high: [99, 2021], low: [53, 2006], rain: [1.97, 1983] },
         "08-13": { high: [99, 2002], low: [51, 1982], rain: [1.98, 2013] },
         "08-14": { high: [100, 2002], low: [41, 2014], rain: [1.52, 1999] },
         "08-15": { high: [98, 1988], low: [48, 2014], rain: [0.34, 2022] },
         "08-16": { high: [99, 1997], low: [48, 2014], rain: [1.92, 2003] },
         "08-17": { high: [95, 1999], low: [47, 1979], rain: [2.03, 1994] },
         "08-18": { high: [96, 2002], low: [45, 1981], rain: [2.01, 2021] },
         "08-19": { high: [93, 2002], low: [48, 1981], rain: [1.02, 1989] },
         "08-20": { high: [101, 1983], low: [50, 1998], rain: [2.15, 1951] },
         "08-21": { high: [91, 1995], low: [47, 1981], rain: [1.27, 2018] },
         "08-22": { high: [94, 1983], low: [48, 1982], rain: [1.38, 1994] },
         "08-23": { high: [93, 1983], low: [49, 1985], rain: [1.43, 2021] },
         "08-24": { high: [92, 2021], low: [46, 2014], rain: [0.95, 2002] },
         "08-25": { high: [96, 2021], low: [48, 1987], rain: [0.72, 1985] },
         "08-26": { high: [95, 2021], low: [51, 1995], rain: [1.15, 2007] },
         "08-27": { high: [94, 1993], low: [51, 2014], rain: [1.75, 2011] },
         "08-28": { high: [95, 1993], low: [51, 2019], rain: [4.60, 1978] },
         "08-29": { high: [95, 2018], low: [39, 1986], rain: [4.06, 1978] },
         "08-30": { high: [96, 1991], low: [37, 1986], rain: [0.80, 1950] },
         "08-31": { high: [96, 2010], low: [40, 1986], rain: [1.31, 2018] },
         "09-01": { high: [96, 2010], low: [46, 1986], rain: [5.30, 2021] },
         "09-02": { high: [99, 1980], low: [46, 1991], rain: [1.27, 2006] },
         "09-03": { high: [97, 1980], low: [48, 1994], rain: [1.81, 1993] },
         "09-04": { high: [98, 2023], low: [48, 1987], rain: [2.00, 2012] },
         "09-05": { high: [95, 2023], low: [45, 1997], rain: [1.79, 2011] },
         "09-06": { high: [96, 2023], low: [44, 2000], rain: [3.54, 1979] },
         "09-07": { high: [97, 2023], low: [40, 1984], rain: [1.96, 2011] },
         "09-08": { high: [93, 2010], low: [43, 1984], rain: [5.68, 1987] },
         "09-09": { high: [93, 2015], low: [37, 1986], rain: [2.08, 2018] },
         "09-10": { high: [95, 1983], low: [41, 1986], rain: [2.17, 2015] },
         "09-11": { high: [96, 1983], low: [41, 1995], rain: [2.79, 2009] },
         "09-12": { high: [95, 1983], low: [40, 2014], rain: [2.16, 2015] },
         "09-13": { high: [92, 2005], low: [43, 1985], rain: [1.41, 2000] },
         "09-14": { high: [91, 2008], low: [36, 1985], rain: [2.50, 1951] },
         "09-15": { high: [92, 2021], low: [36, 1985], rain: [1.10, 1993] },
         "09-16": { high: [93, 1991], low: [39, 1985], rain: [6.11, 1999] },
         "09-17": { high: [91, 1991], low: [35, 1986], rain: [1.60, 1995] },
         "09-18": { high: [88, 1978], low: [34, 1986], rain: [1.95, 2012] },
         "09-19": { high: [92, 1983], low: [40, 2020], rain: [1.75, 1989] },
         "09-20": { high: [92, 1983], low: [37, 2020], rain: [1.27, 1977] },
         "09-21": { high: [87, 1980], low: [37, 2020], rain: [0.90, 1979] },
         "09-22": { high: [96, 1980], low: [37, 2020], rain: [2.81, 1979] },
         "09-23": { high: [96, 1980], low: [37, 1983], rain: [3.60, 2025] },
         "09-24": { high: [91, 2017], low: [36, 1983], rain: [1.44, 2001] },
         "09-25": { high: [96, 2010], low: [34, 1983], rain: [2.36, 1991] },
         "09-26": { high: [91, 2007], low: [38, 1983], rain: [2.30, 1994] },
         "09-27": { high: [90, 1998], low: [36, 1978], rain: [4.96, 1985] },
         "09-28": { high: [83, 1987], low: [36, 1989], rain: [2.73, 2006] },
         "09-29": { high: [84, 2019], low: [36, 2000], rain: [1.68, 2015] },
         "09-30": { high: [89, 1986], low: [37, 2000], rain: [1.18, 1999] },
         "10-01": { high: [89, 1986], low: [33, 1993], rain: [2.09, 1979] },
         "10-02": { high: [93, 2019], low: [34, 1997], rain: [2.10, 2012] },
         "10-03": { high: [87, 2021], low: [33, 2003], rain: [1.05, 1979] },
         "10-04": { high: [87, 2013], low: [33, 1996], rain: [0.82, 2010] },
         "10-05": { high: [89, 2013], low: [27, 2019], rain: [2.08, 1995] },
         "10-06": { high: [86, 1997], low: [34, 1992], rain: [0.65, 1978] },
         "10-07": { high: [87, 2018], low: [32, 1986], rain: [1.77, 2005] },
         "10-08": { high: [89, 2007], low: [33, 1986], rain: [5.60, 2005] },
         "10-09": { high: [91, 2007], low: [28, 2001], rain: [1.40, 1992] },
         "10-10": { high: [84, 2018], low: [32, 1989], rain: [2.00, 2013] },
         "10-11": { high: [83, 2010], low: [25, 1986], rain: [2.17, 2002] },
         "10-12": { high: [83, 2010], low: [31, 1996], rain: [1.20, 1993] },
         "10-13": { high: [83, 2024], low: [29, 2012], rain: [0.70, 2005] },
         "10-14": { high: [80, 2008], low: [30, 1981], rain: [1.35, 2023] },
         "10-15": { high: [86, 2021], low: [30, 2006], rain: [2.69, 2014] },
         "10-16": { high: [86, 2021], low: [31, 1999], rain: [2.43, 2002] },
         "10-17": { high: [81, 2016], low: [33, 1994], rain: [2.18, 1991] },
         "10-18": { high: [86, 2016], low: [26, 1982], rain: [1.50, 1996] },
         "10-19": { high: [85, 2016], low: [28, 1986], rain: [2.20, 1996] },
         "10-20": { high: [80, 2016], low: [26, 1981], rain: [1.05, 1989] },
         "10-21": { high: [83, 1979], low: [29, 1991], rain: [2.80, 1995] },
         "10-22": { high: [84, 2024], low: [29, 1983], rain: [1.04, 2005] },
         "10-23": { high: [82, 1979], low: [26, 1982], rain: [1.60, 1994] },
         "10-24": { high: [83, 2001], low: [27, 1982], rain: [1.57, 1983] },
         "10-25": { high: [80, 2021], low: [28, 1978], rain: [2.13, 2021] },
         "10-26": { high: [81, 2023], low: [28, 1987], rain: [1.35, 2007] },
         "10-27": { high: [81, 1984], low: [26, 1988], rain: [1.70, 2007] },
         "10-28": { high: [83, 2023], low: [30, 1978], rain: [1.10, 2015] },
         "10-29": { high: [79, 1984], low: [26, 1985], rain: [2.03, 1984] },
         "10-30": { high: [83, 2016], low: [26, 1985], rain: [1.13, 2025] },
         "10-31": { high: [84, 2024], low: [23, 1988], rain: [1.45, 2019] },
         "11-01": { high: [80, 2024], low: [25, 1986], rain: [0.77, 1994] },
         "11-02": { high: [82, 1982], low: [24, 1976], rain: [1.60, 2018] },
         "11-03": { high: [86, 2003], low: [25, 1986], rain: [0.55, 1992] },
         "11-04": { high: [78, 1994], low: [25, 2006], rain: [1.20, 2010] },
         "11-05": { high: [80, 2022], low: [24, 1991], rain: [0.94, 2003] },
         "11-06": { high: [83, 2024], low: [21, 1991], rain: [0.87, 1948] },
         "11-07": { high: [77, 2022], low: [24, 1982], rain: [0.73, 1977] },
         "11-08": { high: [79, 2020], low: [22, 1984], rain: [2.00, 1996] },
         "11-09": { high: [78, 2020], low: [20, 2019], rain: [0.94, 1996] },
         "11-10": { high: [78, 2020], low: [21, 2003], rain: [2.45, 1990] },
         "11-11": { high: [73, 2022], low: [20, 2017], rain: [1.98, 1995] },
         "11-12": { high: [74, 2022], low: [15, 2019], rain: [1.56, 2021] },
         "11-13": { high: [68, 2012], low: [21, 2019], rain: [0.77, 1982] },
         "11-14": { high: [74, 1989], low: [14, 1986], rain: [1.57, 1995] },
         "11-15": { high: [77, 1993], low: [12, 1986], rain: [0.90, 2007] },
         "11-16": { high: [72, 1990], low: [18, 1996], rain: [2.75, 2006] },
         "11-17": { high: [69, 1987], low: [21, 1976], rain: [0.86, 2002] },
         "11-18": { high: [77, 2021], low: [19, 1997], rain: [1.19, 1980] },
         "11-19": { high: [69, 2003], low: [17, 2014], rain: [1.50, 2003] },
         "11-20": { high: [78, 1985], low: [16, 1986], rain: [1.58, 1988] },
         "11-21": { high: [66, 2003], low: [14, 2022], rain: [1.84, 2023] },
         "11-22": { high: [73, 2007], low: [15, 2014], rain: [1.60, 2011] },
         "11-23": { high: [69, 1979], low: [11, 2018], rain: [0.80, 2011] },
         "11-24": { high: [71, 2014], low: [17, 1976], rain: [1.69, 2018] },
         "11-25": { high: [70, 1979], low: [19, 1989], rain: [3.30, 1950] },
         "11-26": { high: [68, 1979], low: [19, 1993], rain: [1.50, 1996] },
         "11-27": { high: [66, 1979], low: [19, 1991], rain: [1.05, 1993] },
         "11-28": { high: [70, 2011], low: [17, 1982], rain: [2.30, 1993] },
         "11-29": { high: [69, 2005], low: [20, 2019], rain: [2.60, 1995] },
         "11-30": { high: [68, 1991], low: [13, 1976], rain: [1.34, 2020] },
         "12-01": { high: [73, 2006], low: [14, 1976], rain: [1.10, 2010] },
         "12-02": { high: [65, 1998], low: [19, 2022], rain: [1.20, 1991] },
         "12-03": { high: [70, 1998], low: [9, 1976], rain: [1.00, 1990] },
         "12-04": { high: [72, 1982], low: [13, 1976], rain: [2.25, 1950] },
         "12-05": { high: [75, 2001], low: [11, 1976], rain: [2.07, 1993] },
         "12-06": { high: [69, 1998], low: [12, 2002], rain: [1.57, 2013] },
         "12-07": { high: [76, 1998], low: [2, 2002], rain: [1.65, 2011] },
         "12-08": { high: [70, 1980], low: [10, 2002], rain: [0.46, 2001] },
         "12-09": { high: [65, 1980], low: [6, 1989], rain: [1.53, 1978] },
         "12-10": { high: [66, 2023], low: [4, 1989], rain: [2.00, 2023] },
         "12-11": { high: [69, 2021], low: [12, 1995], rain: [2.04, 2008] },
         "12-12": { high: [68, 1979], low: [6, 1988], rain: [2.60, 1983] },
         "12-13": { high: [67, 2015], low: [5, 1988], rain: [1.80, 1983] },
         "12-14": { high: [65, 2015], low: [2, 2005], rain: [1.24, 2000] },
         "12-15": { high: [65, 2015], low: [9, 2005], rain: [1.36, 2022] },
         "12-16": { high: [65, 2021], low: [9, 2025], rain: [1.20, 2007] },
         "12-17": { high: [70, 2011], low: [11, 1989], rain: [2.00, 2000] },
         "12-18": { high: [67, 2006], low: [8, 1989], rain: [2.19, 1977] },
         "12-19": { high: [60, 2025], low: [3, 1989], rain: [1.00, 1995] },
         "12-20": { high: [61, 2018], low: [5, 1985], rain: [0.85, 2018] },
         "12-21": { high: [67, 2018], low: [6, 1985], rain: [1.00, 2012] },
         "12-22": { high: [66, 2013], low: [4, 1989], rain: [1.35, 1983] },
         "12-23": { high: [66, 2015], low: [0, 2022], rain: [0.95, 2004] },
         "12-24": { high: [70, 2015], low: [0, 1989], rain: [1.35, 2020] },
         "12-25": { high: [64, 2020], low: [-3, 1983], rain: [1.73, 1986] },
         "12-26": { high: [61, 1982], low: [-3, 1980], rain: [1.31, 1949] },
         "12-27": { high: [68, 2015], low: [2, 1980], rain: [1.35, 2023] },
         "12-28": { high: [64, 2008], low: [11, 2017], rain: [0.78, 1983] },
         "12-29": { high: [75, 1984], low: [11, 2017], rain: [0.93, 2013] },
         "12-30": { high: [73, 1984], low: [5, 1976], rain: [1.03, 1948] },
         "12-31": { high: [64, 1992], low: [-1, 2017], rain: [0.96, 1989] }
         };
         // ======================================================
         // EXECUTION INITIALIZATION
         // ======================================================
         loadClimateData();
         setInterval(loadClimateData, 1800000); // Auto-refresh data array every 30 minutes