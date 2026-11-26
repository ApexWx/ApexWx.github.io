document.addEventListener("DOMContentLoaded", () => {
  const partials = [
    { id: "weekly-outlook",           file: "weekly-outlook.html",      fallback: "Unable to load weekly outlook." },
    { id: "us-national-outlook-text", file: "us-national-outlook.html", fallback: "Unable to load national outlook." },
    { id: "left-column",              file: "left-sidebar.html",        fallback: "" },
    { id: "right-column",             file: "right-sidebar.html",       fallback: "" }
  ];

  const cacheBuster = Date.now();

  partials.forEach(({ id, file, fallback }) => {
    const container = document.getElementById(id);
    if (!container) return;

    fetch(`${file}?t=${cacheBuster}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(html => {
        container.innerHTML = html;
      })
      .catch(error => {
        console.error(`Error loading ${file}:`, error);
        if (fallback) container.textContent = fallback;
      });
  });
});