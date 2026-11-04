/**
 * Options that change how the page itself looks:
 *  - Header info (name, department, batch, roll) above the top margin line
 *  - Page colour
 */

const pageEl = document.querySelector('.page-a');
const headerEl = document.querySelector('.top-margin');

/* -------------------------------------------------------------------------- */
/* Header info                                                                */
/* -------------------------------------------------------------------------- */

const HEADER_FIELDS = ['name', 'dept', 'batch', 'roll'];
const STORAGE_KEY = 'text-to-handwriting:header-info';

function loadSavedHeader() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveHeader() {
  const values = {};
  HEADER_FIELDS.forEach((field) => {
    values[field] = document.querySelector(`#header-${field}`).value;
  });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (e) {
    // storage can be blocked (private mode), it's only a convenience
  }
}

/** Single line fields: Enter should not add a new line / submit the form */
function blockEnter(e) {
  if (e.key === 'Enter') e.preventDefault();
}

function pastePlainText(e) {
  e.preventDefault();
  const text = e.clipboardData
    .getData('text/plain')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  document.execCommand('insertText', false, text);
}

/**
 * Connects the header inputs in the sidebar with the header on the paper.
 * You can type in either of them, both stay in sync.
 */
function initHeaderInfo() {
  const saved = loadSavedHeader();

  HEADER_FIELDS.forEach((field) => {
    const input = document.querySelector(`#header-${field}`);
    const cell = headerEl.querySelector(`.header-value[data-field="${field}"]`);

    if (saved[field]) {
      input.value = saved[field];
      cell.textContent = saved[field];
    }

    input.addEventListener('input', () => {
      cell.textContent = input.value;
      saveHeader();
    });
    input.addEventListener('keydown', blockEnter);

    cell.addEventListener('input', () => {
      input.value = cell.textContent;
      saveHeader();
    });
    cell.addEventListener('keydown', blockEnter);
    cell.addEventListener('paste', pastePlainText);
  });
}

function setHeaderVisible(isVisible) {
  headerEl.classList.toggle('header-off', !isVisible);
}

function setHeaderLabels(areVisible) {
  headerEl.classList.toggle('no-labels', !areVisible);
}

/** Used while generating pages, to hide the header on pages after the first */
function hideHeaderContent(isHidden) {
  headerEl.classList.toggle('header-hidden', isHidden);
}

/** "all" or "first" */
function getHeaderPages() {
  return document.querySelector('#header-pages').value;
}

/* -------------------------------------------------------------------------- */
/* Page colour                                                                */
/* -------------------------------------------------------------------------- */

let currentPageColor = '#ffffff';

function setPageColor(color) {
  currentPageColor = color;
  pageEl.style.backgroundColor = color;
  document.querySelectorAll('.swatch').forEach((swatch) => {
    const isActive =
      swatch.dataset.color &&
      swatch.dataset.color.toLowerCase() === color.toLowerCase();
    swatch.classList.toggle('active', !!isActive);
    swatch.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });

  const picker = document.querySelector('#page-color-custom');
  const isPreset = !!document.querySelector(
    `.swatch[data-color="${color.toLowerCase()}"]`
  );
  picker.parentElement.classList.toggle('active', !isPreset);
  picker.parentElement.setAttribute(
    'aria-checked',
    isPreset ? 'false' : 'true'
  );
  if (!isPreset) picker.value = color;
}

/** current page colour as "#rrggbb" */
function getPageColor() {
  return currentPageColor;
}

/* -------------------------------------------------------------------------- */
/* Margin line colour                                                         */
/* -------------------------------------------------------------------------- */

function setMarginLineColor(color) {
  document.body.style.setProperty('--margin-line-color', color);
}

/* -------------------------------------------------------------------------- */
/* Natural margin deviation                                                   */
/*                                                                            */
/* Real notebook paper is printed slightly crooked: the coloured margin line  */
/* drifts by a few millimeters instead of being perfectly straight. When the  */
/* option is on, the straight CSS borders are hidden and a slightly wavy line */
/* is drawn instead — re-randomised for every generated page.                 */
/*                                                                            */
/* The wavy lines are drawn straight onto the captured <canvas> (not with the */
/* preview SVG): html2canvas distorts inline-SVG coordinates at scale > 1,    */
/* and this way the line keeps its colour even under the scanner contrast.    */
/* -------------------------------------------------------------------------- */

const NATURAL_STORAGE_KEY = 'text-to-handwriting:natural-margin';
let naturalMarginSvg = null;
let marginDeviation = null; // deviation data of the page being generated

function isNaturalMarginOn() {
  const toggle = document.querySelector('#natural-margin-toggle');
  return !!(toggle && toggle.checked);
}

/** tiny helper: -1..1 */
const wobble = () => Math.random() * 2 - 1;
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

/**
 * Builds the deviation data for one page. All values are CSS pixels of the
 * 400px-wide page (1px ≈ 0.5mm, so a 2-7px drift reads as "a few
 * millimeters" on paper).
 */
function buildMarginDeviation(W, H) {
  const LINE = 50; // position of the straight margin lines (top + left)

  // vertical line: starts on the top line and drifts sideways downwards
  const vDrift = (2.5 + Math.random() * 4.5) * randSign();

  // horizontal line: full width, drifts up/down by a couple of pixels
  const hDrift = (2 + Math.random() * 4) * randSign();

  return {
    W,
    H,
    LINE,
    v: {
      x0: LINE + wobble() * 0.8,
      c1: LINE + vDrift * 0.35 + wobble() * 1.6,
      c2: LINE + vDrift * 0.72 + wobble() * 1.6,
      x1: LINE + vDrift
    },
    h: {
      y0: LINE + wobble() * 0.8,
      m: LINE + hDrift * 0.5 + wobble() * 1.2,
      y1: LINE + hDrift
    }
  };
}

/** Draws the deviation as wavy paths in the editor preview (SVG). */
function renderMarginPreview(dev) {
  const { W, H } = dev;
  naturalMarginSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  naturalMarginSvg.innerHTML =
    `<path d="M ${dev.v.x0.toFixed(2)} ${dev.LINE} ` +
    `C ${dev.v.c1.toFixed(2)} ${(H * 0.33).toFixed(2)}, ` +
    `${dev.v.c2.toFixed(2)} ${(H * 0.66).toFixed(2)}, ` +
    `${dev.v.x1.toFixed(2)} ${H}" fill="none" stroke="currentColor" ` +
    `stroke-width="2"></path>` +
    `<path d="M 0 ${dev.h.y0.toFixed(2)} ` +
    `Q ${(W / 2).toFixed(2)} ${dev.h.m.toFixed(2)}, ${W} ${dev.h.y1.toFixed(2)}" ` +
    `fill="none" stroke="currentColor" stroke-width="2"></path>`;
}

/**
 * Randomises the margin deviation for the next page. Updates the editor
 * preview and returns the deviation data (null when no wavy line is used).
 */
function randomizeNaturalMargin() {
  marginDeviation = null;
  if (!naturalMarginSvg) return null;
  naturalMarginSvg.innerHTML = '';

  if (!isNaturalMarginOn() || !pageEl.classList.contains('margined')) {
    return null;
  }

  marginDeviation = buildMarginDeviation(
    pageEl.clientWidth || 400,
    pageEl.clientHeight || 564
  );
  renderMarginPreview(marginDeviation);
  return marginDeviation;
}

/**
 * The preview SVG must not be captured by html2canvas (it distorts SVG
 * coordinates), so it is hidden while the page screenshot is taken.
 */
function hideNaturalMarginPreview(isHidden) {
  if (naturalMarginSvg) {
    naturalMarginSvg.style.display = isHidden ? 'none' : '';
  }
}

/** Desaturates + darkens the margin colour for the B/W scanner styles. */
function mutedLineColor(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color);
  if (!m) return '#5a5a5a';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c) => Math.round((c * 0.45 + lum * 0.55) * 0.5);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/**
 * Draws the wavy margin lines onto the captured page canvas, at output
 * resolution. Runs after the scanner contrast step, so the colour is not
 * washed out to white.
 *
 * @param {HTMLCanvasElement} canvas captured page
 * @param {boolean} forScanner true when a scanner/contrast effect is used
 */
function drawNaturalMarginOnCanvas(canvas, forScanner) {
  if (!marginDeviation) return;
  const dev = marginDeviation;
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / dev.W;
  const sy = canvas.height / dev.H;

  let color =
    getComputedStyle(document.body)
      .getPropertyValue('--margin-line-color')
      .trim() || '#ffc0cb';
  if (forScanner) color = mutedLineColor(color);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;

  ctx.beginPath();
  // vertical: from the top margin line down to the bottom of the page
  ctx.moveTo(dev.v.x0 * sx, dev.LINE * sy);
  ctx.bezierCurveTo(
    dev.v.c1 * sx,
    dev.H * 0.33 * sy,
    dev.v.c2 * sx,
    dev.H * 0.66 * sy,
    dev.v.x1 * sx,
    dev.H * sy
  );
  // horizontal: across the full width, under the header strip
  ctx.moveTo(0, dev.h.y0 * sy);
  ctx.quadraticCurveTo((dev.W / 2) * sx, dev.h.m * sy, dev.W * sx, dev.h.y1 * sy);

  // a soft pass first (little ink bleed), then the crisp line
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 3.4 * sx;
  ctx.stroke();
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = 2 * sx;
  ctx.stroke();
  ctx.restore();
}

function applyNaturalMarginState() {
  const on = isNaturalMarginOn();
  pageEl.classList.toggle('natural-margin', on);
  if (on) randomizeNaturalMargin();
  else if (naturalMarginSvg) naturalMarginSvg.innerHTML = '';
}

function initNaturalMargin() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  naturalMarginSvg = document.createElementNS(SVG_NS, 'svg');
  naturalMarginSvg.id = 'natural-margin-svg';
  naturalMarginSvg.setAttribute('aria-hidden', 'true');
  pageEl.insertBefore(naturalMarginSvg, pageEl.firstChild);

  const toggle = document.querySelector('#natural-margin-toggle');
  if (!toggle) return;

  let saved = false;
  try {
    saved = window.localStorage.getItem(NATURAL_STORAGE_KEY) === 'on';
  } catch (e) {
    /* storage blocked — just use the default */
  }
  toggle.checked = saved;

  toggle.addEventListener('change', () => {
    applyNaturalMarginState();
    try {
      window.localStorage.setItem(
        NATURAL_STORAGE_KEY,
        toggle.checked ? 'on' : 'off'
      );
    } catch (e) {
      /* private mode etc. — ignore */
    }
  });

  // if the paper margin itself is switched off, the wavy line must go too
  const marginToggle = document.querySelector('#paper-margin-toggle');
  if (marginToggle) {
    marginToggle.addEventListener('change', applyNaturalMarginState);
  }

  applyNaturalMarginState();
}

export {
  initHeaderInfo,
  setHeaderVisible,
  setHeaderLabels,
  hideHeaderContent,
  getHeaderPages,
  setPageColor,
  getPageColor,
  setMarginLineColor,
  initNaturalMargin,
  randomizeNaturalMargin,
  hideNaturalMarginPreview,
  drawNaturalMarginOnCanvas,
  isNaturalMarginOn
};
