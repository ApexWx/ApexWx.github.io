// ======================================================
// DAILY CLIMATE RECORDS & NORMALS
// Apex Wx — Fort Kent, Maine
// ======================================================

// Optional external file later:
// <script src="climate-records.js"></script>

const climateRecords = {

  // ==================================================
  // MAY
  // ==================================================

  "05-29": {

    normalHigh: 67,
    normalLow: 43,

    recordHigh: {
      value: 91,
      year: 1978
    },

    recordLow: {
      value: 29,
      year: 1963
    },

    recordRain: {
      value: 2.73,
      year: 2022
    }

  },

  "05-30": {

    normalHigh: 68,
    normalLow: 44,

    recordHigh: {
      value: 89,
      year: 1991
    },

    recordLow: {
      value: 30,
      year: 1967
    },

    recordRain: {
      value: 1.94,
      year: 1984
    }

  }

};


// ======================================================
// UPDATE RECORDS/NORMALS DISPLAY
// ======================================================

function updateDailyClimateRecords() {

  const today = new Date();

  const key =
    `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const rec = climateRecords[key];

  // If no data exists yet for the day
  if (!rec) {

    document.getElementById("normal-high").innerHTML = "--";
    document.getElementById("normal-low").innerHTML = "--";

    document.getElementById("record-high").innerHTML = "--";
    document.getElementById("record-low").innerHTML = "--";

    document.getElementById("record-rain").innerHTML = "--";

    return;
  }


  // ==================================================
  // NORMAL HIGH
  // ==================================================

  document.getElementById("normal-high").innerHTML =
    `${rec.normalHigh}°F`;


  // ==================================================
  // NORMAL LOW
  // ==================================================

  document.getElementById("normal-low").innerHTML =
    `${rec.normalLow}°F`;


  // ==================================================
  // RECORD HIGH
  // ==================================================

  document.getElementById("record-high").innerHTML =
    `${rec.recordHigh.value}°F
     <br>
     <span class="metric">
       ${rec.recordHigh.year}
     </span>`;


  // ==================================================
  // RECORD LOW
  // ==================================================

  document.getElementById("record-low").innerHTML =
    `${rec.recordLow.value}°F
     <br>
     <span class="metric">
       ${rec.recordLow.year}
     </span>`;


  // ==================================================
  // RECORD RAINFALL
  // ==================================================

  document.getElementById("record-rain").innerHTML =
    `${rec.recordRain.value.toFixed(2)} in
     <br>
     <span class="metric">
       ${rec.recordRain.year}
     </span>`;
}


// ======================================================
// RUN FUNCTION
// ======================================================

// Place this alongside your other startup calls near
// the bottom of your main script block.

updateDailyClimateRecords();