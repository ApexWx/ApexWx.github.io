/**
 * Lancaster Almanac — ACIS Auto-populate
 * Drop this <script> block into Fawkes/index.html
 * right before the closing </body> tag.
 *
 * Also add  id="lancaster-almanac"  to the wrapper
 * element that contains the almanac section.
 *
 * Station: NWS State College ThreadEx (SCEthr)
 * API: https://data.rcc-acis.org
 */

(async function () {
  const STATION = "SCEthr";
  const API     = "https://data.rcc-acis.org/StnData";

  // ── Date helpers ──────────────────────────────────────────────────────────
  const pad  = n => String(n).padStart(2, "0");
  const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  const today     = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  const obsDate = fmt(yesterday);
  const tmrDate = fmt(today);

  const obsLabel = yesterday.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const tmrLabel = today.toLocaleDateString("en-US",     { weekday:"long", month:"long", day:"numeric" });

  const snowYrStart = today.getMonth() < 6 ? today.getFullYear() - 1 : today.getFullYear();
  const snowLabel   = `${String(snowYrStart).slice(-2)}-${String(snowYrStart+1).slice(-2)}`;
  const snowSeasonStart = `${snowYrStart}-07-01`;

  // ── ACIS fetch helper ─────────────────────────────────────────────────────
  async function acis(params) {
    const url = `${API}?params=${encodeURIComponent(JSON.stringify(params))}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ACIS error ${res.status}`);
    return res.json();
  }

  // ── Format helpers ────────────────────────────────────────────────────────
  const fmtTemp   = v => (v && v !== "M") ? `${Math.round(v)}°` : "—";
  const fmtPrecip = (v, dec=2) => {
    if (!v || v === "M") return "—";
    if (v === "T") return "T";
    return `${parseFloat(v).toFixed(dec)}"`;
  };
  const fmtDep = (obs, nrm) => {
    try {
      const d = parseFloat(obs) - parseFloat(nrm);
      return `(${d >= 0 ? "+" : ""}${d.toFixed(2)}")`;
    } catch { return ""; }
  };

  // ── Fetch 1: Observed (yesterday) ─────────────────────────────────────────
  const obsRaw = await acis({
    sid: STATION, date: obsDate,
    elems: ["maxt","mint","pcpn","snow"]
  });
  const [obsMaxt, obsMint, obsPcpn, obsSnow] = obsRaw.data[0];

  // ── Fetch 2: Normals + records (today's calendar date) ───────────────────
  const nrmRaw = await acis({
    sid: STATION, date: tmrDate,
    elems: [
      { name:"maxt", normal:"1", smry:["max","min"], smry_opts:{reduce_date_to:"1"} },
      { name:"mint", normal:"1", smry:["max","min"], smry_opts:{reduce_date_to:"1"} },
      { name:"pcpn", normal:"1", smry:["max"],       smry_opts:{reduce_date_to:"1"} },
      { name:"snow", normal:"1", smry:["max"],        smry_opts:{reduce_date_to:"1"} },
    ]
  });
  const [nrmMaxt, nrmMint, nrmPcpn, nrmSnow] = nrmRaw.data[0];
  const smry = nrmRaw.smry || [];

  const rec = (block, idx) => {
    try {
      const e = block[idx];
      return Array.isArray(e) ? [e[0], (e[1]||"").slice(0,4)] : [e, "—"];
    } catch { return ["—","—"]; }
  };
  const [recHiVal,   recHiYr]   = rec(smry[0] || [], 0);
  const [recLoVal,   recLoYr]   = rec(smry[1] || [], 1);
  const [recPcpnVal, recPcpnYr] = rec(smry[2] || [], 0);
  const [recSnowVal, recSnowYr] = rec(smry[3] || [], 0);

  // ── Fetch 3: YTD precipitation ────────────────────────────────────────────
  const ytdRaw = await acis({
    sid: STATION, date: obsDate,
    elems: [
      { name:"pcpn", interval:"ytd", duration:"ytd", reduce:"sum", normal:"1" },
    ]
  });
  const [ytdPcpnObs, ytdPcpnNrm] = ytdRaw.data[0];

  // ── Fetch 4: Seasonal snowfall (Jul 1 → yesterday) ───────────────────────
  const snoRaw = await acis({
    sid: STATION, sdate: snowSeasonStart, edate: obsDate,
    elems: [{ name:"snow", interval:"mly", duration:"mly", reduce:"sum" }]
  });
  let snoTotal = 0, snoNorm = 0;
  for (const row of snoRaw.data) {
    const v = row[0];
    if (v && v !== "M" && v !== "T") snoTotal += parseFloat(v);
  }
  // Seasonal snow normal — use a fixed ACIS call for the season normal
  const snoNrmRaw = await acis({
    sid: STATION, date: obsDate,
    elems: [{ name:"snow", interval:"ytd", duration:"ytd", reduce:"sum", normal:"1" }]
  });
  snoNorm = snoNrmRaw.data[0][1];

  // ── Build HTML ────────────────────────────────────────────────────────────
  const snoDepStr = (() => {
    try {
      const d = snoTotal - parseFloat(snoNorm);
      return `(${d >= 0 ? "+" : ""}${d.toFixed(1)}")`;
    } catch { return ""; }
  })();

  const html = `
<p><strong>${obsLabel}</strong></p>
<p>
  <strong>High:</strong> ${fmtTemp(obsMaxt)} | <strong>Low:</strong> ${fmtTemp(obsMint)}<br>
  <strong>Rainfall:</strong> ${fmtPrecip(obsPcpn)} | <strong>Snowfall:</strong> ${fmtPrecip(obsSnow,1)}<br>
  <em>Data source: NOAA SC-ACIS NWS State College</em>
</p>

<p><strong>${tmrLabel}</strong></p>
<p>
  <strong>Normal High:</strong> ${fmtTemp(nrmMaxt)} | <strong>Record High:</strong> ${fmtTemp(recHiVal)} (${recHiYr})
  &nbsp; <strong>Normal Low:</strong> ${fmtTemp(nrmMint)} | <strong>Record Low:</strong> ${fmtTemp(recLoVal)} (${recLoYr})<br>
  <strong>Normal Daily Rainfall:</strong> ${fmtPrecip(nrmPcpn)} | <strong>Record Rainfall:</strong> ${fmtPrecip(recPcpnVal)} (${recPcpnYr})<br>
  <strong>Normal Daily Snowfall:</strong> ${fmtPrecip(nrmSnow,1)} | <strong>Record Snowfall:</strong> ${fmtPrecip(recSnowVal,1)} (${recSnowYr})<br>
  <em>Data source: <a href="https://scacis.rcc-acis.org/">NOAA SC-ACIS</a> NWS State College climate data since 1949</em>
</p>

<p><strong>Precipitation ${today.getFullYear()}</strong></p>
<p>
  <strong>Rain:</strong> ${fmtPrecip(ytdPcpnObs)} | normal: ${fmtPrecip(ytdPcpnNrm)} ${fmtDep(ytdPcpnObs, ytdPcpnNrm)}<br>
  <strong>Snow ${snowLabel}:</strong> ${snoTotal.toFixed(1)}" | normal: ${fmtPrecip(snoNorm,1)} ${snoDepStr}<br>
  ❄️ Annual snowfall measured from July 1 - June 30 ❄️<br>
  <em>Data source: <a href="https://scacis.rcc-acis.org/">NOAA SC-ACIS</a> NWS State College climate data</em>
</p>
`;

  // ── Inject into page ──────────────────────────────────────────────────────
  const target = document.getElementById("lancaster-almanac");
  if (target) {
    target.innerHTML = html;
  } else {
    console.warn("Almanac target element #lancaster-almanac not found.");
  }

})().catch(err => {
  console.error("Almanac fetch failed:", err);
  const target = document.getElementById("lancaster-almanac");
  if (target) target.innerHTML = "<p><em>Almanac data temporarily unavailable.</em></p>";
});
