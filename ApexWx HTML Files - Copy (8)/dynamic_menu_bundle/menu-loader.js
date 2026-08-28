fetch('menu.html')
  .then(response => response.text())
  .then(html => {
    document.getElementById('menu-container').innerHTML = html;
    const nav = document.querySelector(".nav");
    const toggle = document.getElementById("navToggle");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        nav.classList.toggle("show");
      });
    }
  });
