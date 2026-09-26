/* =========================================================
   APEX WX — AIRNOW AIR QUALITY COMPONENT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

  const cards =
    document.querySelectorAll(".airnow-card");

  cards.forEach(function (card) {
    loadAirNow(card);
  });

});


async function loadAirNow(card) {

  const site = card.dataset.site;

  /*
   * Replace the URL below with the actual
   * apexwx-airnow Cloudflare Worker URL.
   */

  const workerUrl =
    "https://apexwx-airnow.maineapexwx.workers.dev/";

  try {

    const response = await fetch(
      workerUrl +
      "?site=" +
      encodeURIComponent(site)
    );

    if (!response.ok) {
      throw new Error(
        "AirNow Worker returned " +
        response.status
      );
    }

    const data = await response.json();

    renderAirNow(card, data);

  } catch (error) {

    console.error(
      "AirNow display error:",
      error
    );

    renderTotalFailure(card);
  }
}


/* =========================================================
   MAIN RENDERER
   ========================================================= */

function renderAirNow(card, data) {

  const loading =
    card.querySelector(".airnow-loading");

  const content =
    card.querySelector(".airnow-content");

  if (loading) {
    loading.style.display = "none";
  }

  if (content) {
    content.style.display = "block";
  }


  /* -------------------------
     Current observations
     ------------------------- */

  const currentContainer =
    card.querySelector(
      ".airnow-current-container"
    );

  if (
    data.availability &&
    data.availability.current &&
    data.current
  ) {

    renderCurrent(
      currentContainer,
      data.current
    );

  } else {

    currentContainer.replaceChildren(
      makeUnavailable(
        "Current observations temporarily unavailable."
      )
    );
  }


  /* -------------------------
     Forecast
     ------------------------- */

  const forecastContainer =
    card.querySelector(
      ".airnow-forecast-container"
    );

  if (
    data.availability &&
    data.availability.forecast &&
    data.forecast &&
    Array.isArray(data.forecast.days)
  ) {

    renderForecast(
      forecastContainer,
      data.forecast.days
    );

  } else {

    forecastContainer.replaceChildren(
      makeUnavailable(
        "Air quality forecast temporarily unavailable."
      )
    );
  }
}


/* =========================================================
   CURRENT AQI
   ========================================================= */

function renderCurrent(container, current) {

  container.replaceChildren();

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "airnow-current";


  /* AQI badge */

  const badge =
    document.createElement("div");

  badge.className =
    "airnow-current-badge";

  badge.style.backgroundColor =
    current.color || "#cccccc";

  badge.style.color =
    current.textColor || "#000000";


  const value =
    document.createElement("span");

  value.className =
    "airnow-current-value";

  value.textContent =
    "AQI " + current.aqi;


  const category =
    document.createElement("span");

  category.className =
    "airnow-current-category";

  category.textContent =
    current.category || "";


  badge.appendChild(value);
  badge.appendChild(category);

  wrapper.appendChild(badge);


  /* Primary pollutant */

  const primary =
    document.createElement("div");

  primary.className =
    "airnow-primary";

  primary.textContent =
    "Primary pollutant: " +
    formatPollutant(
      current.primaryPollutant
    );

  wrapper.appendChild(primary);


  /* Observation time */

  const observed =
    document.createElement("div");

  observed.className =
    "airnow-observed";

  observed.textContent =
    formatObservationTime(current);

  wrapper.appendChild(observed);


  /* Other pollutants */

  if (
    Array.isArray(current.pollutants) &&
    current.pollutants.length > 1
  ) {

    const pollutants =
      document.createElement("div");

    pollutants.className =
      "airnow-pollutants";

    current.pollutants.forEach(
      function (item) {

        if (
          item.pollutant ===
          current.primaryPollutant
        ) {
          return;
        }

        const pollutant =
          document.createElement("span");

        pollutant.className =
          "airnow-pollutant-item";

        pollutant.textContent =
          formatPollutant(
            item.pollutant
          ) +
          ": AQI " +
          item.aqi +
          " — " +
          item.category;

        pollutants.appendChild(
          pollutant
        );
      }
    );

    wrapper.appendChild(pollutants);
  }

  container.appendChild(wrapper);
}


/* =========================================================
   FORECAST
   ========================================================= */

function renderForecast(container, days) {

  container.replaceChildren();

  const grid =
    document.createElement("div");

  grid.className =
    "airnow-forecast-grid";

  /*
   * Show the first three forecast days.
   * The Worker can retain additional days
   * without making the public card too large.
   */

  days.slice(0, 3).forEach(
    function (day) {

      const dayBox =
        document.createElement("div");

      dayBox.className =
        "airnow-forecast-day";


      /* Date */

      const date =
        document.createElement("div");

      date.className =
        "airnow-forecast-date";

      date.textContent =
        formatForecastDate(day.date);


      /* Category */

      const category =
        document.createElement("div");

      category.className =
        "airnow-forecast-category";

      category.style.backgroundColor =
        day.color || "#cccccc";

      category.style.color =
        day.textColor || "#000000";

      const categoryText =
        document.createElement("span");

      categoryText.textContent =
        day.category || "Unavailable";

      category.appendChild(
        categoryText
      );


      /*
       * Numerical forecast AQI is optional.
       * Maine DEP may provide category only.
       */

      if (
        day.aqi !== null &&
        day.aqi !== undefined
      ) {

        const aqi =
          document.createElement("span");

        aqi.className =
          "airnow-forecast-aqi";

        aqi.textContent =
          "AQI " + day.aqi;

        category.appendChild(aqi);
      }


      /* Primary forecast pollutant */

      if (day.primaryPollutant) {

        const pollutant =
          document.createElement("span");

        pollutant.className =
          "airnow-forecast-pollutant";

        pollutant.textContent =
          formatPollutant(
            day.primaryPollutant
          );

        category.appendChild(
          pollutant
        );
      }


      dayBox.appendChild(date);
      dayBox.appendChild(category);

      grid.appendChild(dayBox);
    }
  );

  container.appendChild(grid);
}


/* =========================================================
   HELPERS
   ========================================================= */

function formatPollutant(name) {

  if (!name) {
    return "";
  }

  const normalized =
    name.toUpperCase();

  if (normalized === "PM2.5") {
    return "PM₂.₅";
  }

  if (normalized === "PM10") {
    return "PM₁₀";
  }

  if (normalized === "OZONE") {
    return "Ozone";
  }

  return name;
}


function formatObservationTime(current) {

  if (
    !current.dateObserved ||
    !current.hourObserved
  ) {
    return "";
  }

  const dateParts =
    current.dateObserved.split("-");

  if (dateParts.length !== 3) {
    return "";
  }

  const year =
    Number(dateParts[0]);

  const month =
    Number(dateParts[1]) - 1;

  const day =
    Number(dateParts[2]);

  const timeParts =
    String(
      current.hourObserved
    ).split(":");

  const hour =
    Number(timeParts[0]);

  const minute =
    timeParts.length > 1
      ? Number(timeParts[1])
      : 0;

  const date =
    new Date(
      year,
      month,
      day,
      hour,
      minute
    );

  const formattedTime =
    date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    );

  return (
    "Observed " +
    formattedTime +
    " " +
    (current.localTimeZone || "")
  );
}


function formatForecastDate(dateString) {

  const parts =
    dateString.split("-");

  if (parts.length !== 3) {
    return dateString;
  }

  const date =
    new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric"
    }
  );
}


function makeUnavailable(message) {

  const div =
    document.createElement("div");

  div.className =
    "airnow-unavailable";

  div.textContent = message;

  return div;
}


function renderTotalFailure(card) {

  const loading =
    card.querySelector(".airnow-loading");

  const content =
    card.querySelector(".airnow-content");

  if (loading) {
    loading.style.display = "none";
  }

  if (content) {

    content.style.display = "block";
    content.replaceChildren(
      makeUnavailable(
        "Air quality information is temporarily unavailable."
      )
    );
  }
}