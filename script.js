const filterButtons = document.querySelectorAll(".filter-button");
const projectCards = document.querySelectorAll(".project-card");
const emptyMessage = document.querySelector(".filter-empty");
const yearElement = document.querySelector("#current-year");
const themeButton = document.querySelector(".theme-toggle");
const themeButtonLabel = document.querySelector(".theme-toggle-label");
const themeButtonIcon = document.querySelector(".theme-toggle-icon");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const themeStorageKey = "portfolio-theme";

function applyTheme(theme) {
  const isDark = theme === "dark";
  const nextThemeLabel = isDark ? "Light" : "Dark";
  const nextThemeAction = `Switch to ${isDark ? "light" : "dark"} theme`;

  document.documentElement.dataset.theme = theme;
  themeButtonLabel.textContent = nextThemeLabel;
  themeButtonIcon.textContent = isDark ? "☀" : "☾";
  themeButton.setAttribute("aria-label", nextThemeAction);
  themeButton.title = nextThemeAction;
  themeColorMeta.content = isDark ? "#191a17" : "#f6f5f0";
}

const savedTheme = localStorage.getItem(themeStorageKey);
applyTheme(savedTheme === "dark" ? "dark" : "light");

themeButton.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
});

yearElement.textContent = new Date().getFullYear();

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedCategory = button.dataset.filter;
    let visibleProjects = 0;

    filterButtons.forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });

    projectCards.forEach((card) => {
      const isVisible =
        selectedCategory === "all" || card.dataset.category === selectedCategory;

      card.hidden = !isVisible;
      if (isVisible) visibleProjects += 1;
    });

    emptyMessage.hidden = visibleProjects > 0;
  });
});
