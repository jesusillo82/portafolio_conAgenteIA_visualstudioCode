/**
 * Suite automatizada de accesibilidad del portfolio.
 *
 * Ejecutar desde la carpeta del proyecto con `node accesibilidad.js`.
 * Las pruebas comprueban la estructura HTML, los nombres accesibles, la
 * navegación por teclado, el contraste WCAG AA, los filtros y sus anuncios
 * para lectores de pantalla, el cambio y la restauración del tema, y las
 * reglas CSS para pantallas estrechas. Se usa únicamente el ejecutor de
 * pruebas integrado en Node.js, sin instalar dependencias.
 *
 * Pasos para ejecutar las pruebas en Windows con VS Code:
 * 1. Abre la carpeta del proyecto en VS Code.
 * 2. Abre el terminal integrado desde Terminal > Nuevo terminal.
 * 3. Si el terminal no está en la carpeta del proyecto, ejecuta:
 *    cd "C:\xampp\htdocs\DWES\portafolio_conAgenteIA_visualstudioCode"
 * 4. Comprueba que Node.js está instalado con: node --version
 * 5. Ejecuta la suite con: node accesibilidad.js
 * Un resultado correcto mostrará 8 pruebas aprobadas y ninguna fallida.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Carga los archivos de la aplicación que se inspeccionan durante las pruebas.
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "script.js"), "utf8");

// Devuelve las declaraciones CSS de un selector o falla si no existe.
function getCssBlock(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `No CSS block found for ${selector}`);
  return match[1];
}

// Extrae el valor de una variable CSS del bloque indicado.
function getCssVariable(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `CSS variable --${name} was not found`);
  return match[1].trim();
}

// Convierte un color hexadecimal de tres o seis dígitos en sus canales RGB.
function hexToRgb(hex) {
  const normalized = hex.slice(1);
  assert.match(normalized, /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
  const fullHex =
    normalized.length === 3
      ? [...normalized].map((character) => character.repeat(2)).join("")
      : normalized;

  return fullHex.match(/../g).map((channel) => parseInt(channel, 16));
}

// Calcula la luminancia relativa según la fórmula de contraste WCAG.
function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

// Calcula la relación de contraste entre dos colores.
function contrastRatio(firstColor, secondColor) {
  const first = relativeLuminance(hexToRgb(firstColor));
  const second = relativeLuminance(hexToRgb(secondColor));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

// Lee los colores y las posiciones de las paradas de un degradado CSS.
function gradientColors(gradient) {
  const colors = [...gradient.matchAll(/(#[\da-f]{3,6})\s+(\d+)%/gi)].map(
    ([, color, position]) => ({
      color: color.toLowerCase(),
      position: Number(position) / 100,
    }),
  );

  assert.ok(colors.length >= 2, `Could not read gradient stops: ${gradient}`);
  return colors;
}

// Interpola linealmente dos colores hexadecimales para muestrear un degradado.
function interpolateColor(first, second, progress) {
  return `#${hexToRgb(first)
    .map((channel, index) =>
      Math.round(channel + (hexToRgb(second)[index] - channel) * progress)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Calcula el menor contraste aproximado a lo largo de todas las paradas.
function minimumGradientContrast(gradient, background) {
  const stops = gradientColors(gradient);
  let minimum = Infinity;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];
    const distance = end.position - start.position;

    for (let step = 0; step <= 20; step += 1) {
      const progress = step / 20;
      const color = interpolateColor(
        start.color,
        end.color,
        progress,
      );
      minimum = Math.min(minimum, contrastRatio(color, background));
    }

    assert.ok(distance > 0, "Gradient stop positions must increase");
  }

  return minimum;
}

// Simula las propiedades y operaciones DOM que necesita script.js en las pruebas.
class MockElement {
  // Inicializa los datos, atributos, clases y eventos del elemento simulado.
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.attributes = {};
    this.listeners = {};
    this.classes = new Map();
    this.classList = {
      toggle: (name, force) => this.classes.set(name, force),
    };
    this.hidden = false;
    this.textContent = "";
    this.title = "";
  }

  // Guarda el manejador registrado para un tipo de evento.
  addEventListener(eventName, callback) {
    this.listeners[eventName] = callback;
  }

  // Simula la asignación de un atributo HTML.
  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  // Ejecuta el manejador de clic registrado, como haría una interacción real.
  click() {
    this.listeners.click();
  }
}

// Ejecuta script.js en un DOM y localStorage mínimos, y devuelve sus elementos
// simulados para poder comprobar los cambios de tema y el filtrado de proyectos.
function makeScriptEnvironment(initialTheme = "light") {
  const themeButton = new MockElement();
  const themeButtonLabel = new MockElement();
  const themeButtonIcon = new MockElement();
  const themeColorMeta = new MockElement();
  const filterStatus = new MockElement();
  const yearElement = new MockElement();
  const filterButtons = ["all", "design", "development"].map(
    (filter) => new MockElement({ filter }),
  );
  const projectCards = [
    new MockElement({ category: "design" }),
    new MockElement({ category: "development" }),
    new MockElement({ category: "design" }),
  ];
  const values = new Map();
  const document = {
    documentElement: { dataset: { theme: initialTheme } },
    querySelector(selector) {
      return {
        ".filter-status": filterStatus,
        "#current-year": yearElement,
        ".theme-toggle": themeButton,
        ".theme-toggle-label": themeButtonLabel,
        ".theme-toggle-icon": themeButtonIcon,
        'meta[name="theme-color"]': themeColorMeta,
      }[selector];
    },
    querySelectorAll(selector) {
      return {
        ".filter-button": filterButtons,
        ".project-card": projectCards,
      }[selector];
    },
  };
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };

  vm.runInNewContext(script, { document, localStorage, Date });

  return {
    document,
    filterButtons,
    filterStatus,
    localStorage,
    projectCards,
    themeButton,
    themeButtonIcon,
    themeButtonLabel,
    themeColorMeta,
    values,
    yearElement,
  };
}

// Comprueba el idioma del documento, sus regiones semánticas, encabezados y
// el enlace de salto que permite omitir la navegación repetitiva.
test("incluye idioma, landmarks, encabezados y enlace para saltar al contenido", () => {
  assert.match(html, /<html\b[^>]*\blang="en"/);
  assert.match(html, /<header\b/);
  assert.match(html, /<nav\b[^>]*aria-label="[^"]+"/);
  assert.match(html, /<main\b[^>]*id="main-content"[^>]*tabindex="-1"/);
  assert.match(html, /<footer\b/);
  assert.match(
    html,
    /<a\b[^>]*class="skip-link"[^>]*href="#main-content"[^>]*>Skip to main content<\/a>/,
  );

  const headingLevels = [...html.matchAll(/<h([1-6])\b/g)].map((match) =>
    Number(match[1]),
  );
  assert.equal(headingLevels.filter((level) => level === 1).length, 1);
  for (let index = 1; index < headingLevels.length; index += 1) {
    assert.ok(
      headingLevels[index] <= headingLevels[index - 1] + 1,
      `Heading level skips from h${headingLevels[index - 1]} to h${headingLevels[index]}`,
    );
  }
});

// Comprueba que las ilustraciones tienen nombre accesible, los adornos se
// ocultan a lectores de pantalla y los enlaces externos se describen con claridad.
test("los elementos gráficos y enlaces externos tienen nombres accesibles", () => {
  const labeledImage = html.match(/<[^>]*role="img"[^>]*>/);
  assert.ok(labeledImage, "Expected the illustration image role");
  assert.match(labeledImage[0], /aria-label="[^"]+"/);
  assert.match(html, /class="status-dot" aria-hidden="true"/);

  const externalLinks = [
    ...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/g),
  ];
  assert.ok(externalLinks.length > 0, "Expected external social links");
  for (const [link] of externalLinks) {
    assert.match(link, /rel="[^"]*noopener[^"]*"/);
    assert.match(link, /aria-label="[^"]*opens in a new tab/);
  }
});

// Verifica que existen estilos de foco perceptibles, movimiento reducido,
// alto contraste del sistema y desplazamiento que respeta los anclajes.
test("hay acceso por teclado y soporte para movimiento reducido y alto contraste", () => {
  assert.match(css, /\.skip-link:focus\s*\{/);
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /outline:\s*3px solid var\(--focus-ring\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /scroll-padding-top:/);
});

// Mide colores de texto, paradas de degradados e indicadores de foco en ambos
// temas, y comprueba los mínimos de contraste WCAG AA y de componentes gráficos.
test("los contrastes de texto y degradados alcanzan WCAG AA en ambos temas", () => {
  const themes = [
    {
      name: "claro",
      block: getCssBlock(":root"),
      background: "#f6f5f0",
    },
    {
      name: "oscuro",
      block: getCssBlock(':root[data-theme="dark"]'),
      background: "#191a17",
    },
  ];

  for (const theme of themes) {
    for (const variable of ["ink", "muted", "copy-muted", "filter-text"]) {
      const color = getCssVariable(theme.block, variable);
      assert.ok(
        contrastRatio(color, theme.background) >= 4.5,
        `${theme.name}: --${variable} must meet 4.5:1 contrast`,
      );
    }

    for (const variable of [
      "wordmark-gradient",
      "accent-gradient",
      "hero-gradient",
    ]) {
      const minimum = minimumGradientContrast(
        getCssVariable(theme.block, variable),
        theme.background,
      );
      assert.ok(
        minimum >= 4.5,
        `${theme.name}: --${variable} minimum contrast is ${minimum.toFixed(2)}:1`,
      );
    }

    const focusColor = getCssVariable(theme.block, "focus-ring");
    assert.ok(
      contrastRatio(focusColor, theme.background) >= 3,
      `${theme.name}: focus indicator must meet 3:1 contrast`,
    );
  }
});

// Comprueba la semántica de los filtros, el tamaño táctil, el ajuste en móvil
// y el comportamiento real de los filtros con un DOM simulado.
test("los filtros son controles accesibles y anuncian los resultados", () => {
  assert.match(html, /role="group" aria-label="Filter projects"/);
  assert.match(html, /class="filter-button[^"]*"[^>]*aria-pressed="true"/);
  assert.match(html, /class="filter-button"[^>]*aria-pressed="false"/);
  assert.match(
    html,
    /class="visually-hidden filter-status" role="status" aria-live="polite" aria-atomic="true"/,
  );
  assert.match(css, /\.filter-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.project-filters\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.visually-hidden\s*\{/);

  const app = makeScriptEnvironment();
  app.filterButtons[1].click();
  assert.deepEqual(app.projectCards.map((card) => card.hidden), [
    false,
    true,
    false,
  ]);
  assert.equal(app.filterStatus.textContent, "2 projects shown.");
  assert.equal(app.filterButtons[1].attributes["aria-pressed"], "true");

  app.filterButtons[2].click();
  assert.deepEqual(app.projectCards.map((card) => card.hidden), [
    true,
    false,
    true,
  ]);
  assert.equal(app.filterStatus.textContent, "1 project shown.");
});

// Comprueba que alternar el tema actualiza el DOM, su etiqueta accesible,
// el color de la interfaz del navegador y el valor persistido.
test("el cambio de tema guarda la selección y actualiza la etiqueta accesible", () => {
  const app = makeScriptEnvironment("light");

  assert.equal(app.themeButton.attributes["aria-label"], "Switch to dark theme");
  assert.equal(app.themeButtonLabel.textContent, "Dark");
  assert.equal(app.themeButtonIcon.textContent, "☾");

  app.themeButton.click();
  assert.equal(app.document.documentElement.dataset.theme, "dark");
  assert.equal(app.localStorage.getItem("portfolio-theme"), "dark");
  assert.equal(app.themeButton.attributes["aria-label"], "Switch to light theme");
  assert.equal(app.themeButtonLabel.textContent, "Light");
  assert.equal(app.themeColorMeta.content, "#191a17");

  app.themeButton.click();
  assert.equal(app.document.documentElement.dataset.theme, "light");
  assert.equal(app.localStorage.getItem("portfolio-theme"), "light");
  assert.equal(app.themeButton.attributes["aria-label"], "Switch to dark theme");
});

// Ejecuta el script temprano del HTML en un documento simulado para comprobar
// que el tema guardado se aplica antes de cargar la hoja de estilos.
test("restaura el tema guardado antes de renderizar el documento", () => {
  const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  const styleSheetIndex = html.indexOf('href="styles.css"');
  assert.ok(inlineScript, "Expected an early theme initialization script");
  assert.ok(html.indexOf(inlineScript[0]) < styleSheetIndex);

  for (const savedTheme of ["light", "dark"]) {
    const document = { documentElement: { dataset: {} } };
    const localStorage = {
      getItem(key) {
        assert.equal(key, "portfolio-theme");
        return savedTheme;
      },
    };

    vm.runInNewContext(inlineScript[1], { document, localStorage });
    assert.equal(document.documentElement.dataset.theme, savedTheme);
  }

  assert.match(html, /data-theme="light"/);
});

// Confirma que las hojas de estilo incluyen puntos de adaptación para móvil
// y permiten que la navegación, los filtros y las tarjetas se reorganicen.
test("mantiene reglas adaptables para pantallas estrechas", () => {
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /\.site-nav\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.project-filters\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /\.project-grid\s*\{[^}]*grid-template-columns:/s);
});
