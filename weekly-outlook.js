document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("weekly-outlook");
  if (!container) return;

  async function loadWeeklyOutlook() {
    try {
      const response = await fetch(`forecasts/weekly-outlook.html?v=${Date.now()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      container.innerHTML = html;
    } catch (error) {
      console.error("Failed to load weekly outlook:", error);
      container.innerHTML =
        "<p><em>The Fort Kent &amp; Saint John Valley outlook is temporarily unavailable. Please check back shortly.</em></p>";
    }
  }

  loadWeeklyOutlook();
});
