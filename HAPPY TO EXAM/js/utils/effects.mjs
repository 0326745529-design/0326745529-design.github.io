/**
 * Page effects.
 *
 * This file contains
 *  1. The list of effects that can be picked from the "Effects" dropdown.
 *  2. The "phone capture" (trapezoid / perspective) effect, which makes the
 *     page look like it was photographed or scanned with a mobile phone.
 *  3. Helpers for the optional scanner-style watermark.
 *
 * All the pixel work is plain Canvas 2D, so no extra library is needed.
 */

const rand = (min, max) => min + Math.random() * (max - min);
const randSign = () => (Math.random() < 0.5 ? -1 : 1);

/**
 * Effect presets, keyed by the value of the <option> in #page-effects.
 *
 *  overlay  - add the soft light/shadow gradient over the page
 *  contrast - apply the "scanner" black & white style contrast
 *  phone    - warp the page into a trapezoid and put it on a background
 *      strength - how strong the perspective is (fraction of page width)
 *      rotate   - max tilt in degrees (a random angle up to this is used)
 *      vignette - darker corners, like a phone camera
 *      grain    - a bit of camera noise
 */
const EFFECTS = {
  shadows: { overlay: true },
  scanner: { overlay: true, contrast: true },
  'no-effect': {},

  'trapezoid-light': { phone: { strength: 0.03 } },
  'trapezoid-medium': { phone: { strength: 0.06 } },
  'trapezoid-strong': { phone: { strength: 0.11 } },
  'phone-photo': {
    overlay: true,
    phone: { strength: 0.06, rotate: 2.5, vignette: true, grain: true }
  },
  'phone-scan': {
    overlay: true,
    contrast: true,
    phone: { strength: 0.045 }
  },
  'phone-tilted': { phone: { strength: 0.07, rotate: 4 } },
  'phone-random': 'random'
};

/**
 * Returns the settings for an effect. For "phone-random" every call returns
 * different settings, so each page gets its own camera angle.
 */
function getEffect(name) {
  const effect = EFFECTS[name] || {};
  if (effect === 'random') {
    return {
      overlay: Math.random() < 0.7,
      contrast: Math.random() < 0.25,
      phone: {
        strength: rand(0.03, 0.1),
        rotate: rand(0, 3.5),
        vignette: true,
        grain: true
      }
    };
  }
  return effect;
}

/** true if the effect needs the phone-capture options (background etc.) */
function isPhoneEffect(name) {
  const effect = EFFECTS[name];
  return !!effect && (effect === 'random' || !!effect.phone);
}

/* -------------------------------------------------------------------------- */
/* Perspective (trapezoid) maths                                              */
/* -------------------------------------------------------------------------- */

/**
 * Solves the 3x3 homography that maps 4 `from` points to 4 `to` points.
 * Returns the 8 coefficients [a, b, c, d, e, f, g, h] of
 *   u = (a*x + b*y + c) / (g*x + h*y + 1)
 *   v = (d*x + e*y + f) / (g*x + h*y + 1)
 */
function solveHomography(from, to) {
  const m = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    m.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = col + 1; row < 8; row++) {
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 9; k++) m[row][k] -= factor * m[col][k];
    }
  }
  const h = new Array(8);
  for (let row = 7; row >= 0; row--) {
    let sum = m[row][8];
    for (let k = row + 1; k < 8; k++) sum -= m[row][k] * h[k];
    h[row] = sum / m[row][row];
  }
  return h;
}

/**
 * Builds the 4 corners [TL, TR, BR, BL] of the trapezoid inside a W x H image.
 */
function buildQuad(W, H, { strength, rotate = 0 }, direction) {
  const margin = W * 0.05;
  const L = margin;
  const R = W - margin;
  const T = margin;
  const B = H - margin;

  const sx = strength * W; // horizontal squeeze
  const sy = strength * H * 0.6; // vertical squeeze

  let tx = 0; // > 0: top is narrower, < 0: bottom is narrower
  let ty = 0; // > 0: left side is shorter, < 0: right side is shorter
  switch (direction) {
    case 'top':
      tx = sx;
      break;
    case 'bottom':
      tx = -sx;
      break;
    case 'left':
      ty = sy;
      break;
    case 'right':
      ty = -sy;
      break;
    default:
      // random: a mix, just like a real photo that is never perfectly aligned
      tx = randSign() * sx * rand(0.5, 1);
      ty = randSign() * sy * rand(0.3, 1);
  }

  const quad = [
    { x: L, y: T },
    { x: R, y: T },
    { x: R, y: B },
    { x: L, y: B }
  ];
  if (tx >= 0) {
    quad[0].x += tx;
    quad[1].x -= tx;
  } else {
    quad[3].x -= tx;
    quad[2].x += tx;
  }
  if (ty >= 0) {
    quad[0].y += ty;
    quad[3].y -= ty;
  } else {
    quad[1].y -= ty;
    quad[2].y += ty;
  }

  // Tilt the page a little
  if (rotate) {
    const angle = (randSign() * rand(rotate * 0.4, rotate) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = W / 2;
    const cy = H / 2;
    quad.forEach((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      p.x = cx + dx * cos - dy * sin;
      p.y = cy + dx * sin + dy * cos;
    });
  }

  // Make sure the whole page is still inside the picture
  const keep = margin * 0.5;
  let scale = 1;
  quad.forEach((p) => {
    const dx = Math.abs(p.x - W / 2);
    const dy = Math.abs(p.y - H / 2);
    scale = Math.min(scale, (W / 2 - keep) / dx, (H / 2 - keep) / dy);
  });
  if (scale < 1) {
    quad.forEach((p) => {
      p.x = W / 2 + (p.x - W / 2) * scale;
      p.y = H / 2 + (p.y - H / 2) * scale;
    });
  }
  return quad;
}

/**
 * Draws `src` into the given quad (true perspective, bilinear sampling).
 * Pixels outside the quad stay transparent and the edges are anti-aliased.
 */
function warpToQuad(src, quad, W, H) {
  const sw = src.width;
  const sh = src.height;
  const sdata = src.getContext('2d').getImageData(0, 0, sw, sh).data;

  // destination -> source mapping
  const [a, b, c, d, e, f, g, h] = solveHomography(
    quad.map((p) => [p.x, p.y]),
    [
      [0, 0],
      [sw, 0],
      [sw, sh],
      [0, sh]
    ]
  );

  const result = new ImageData(W, H);
  const out = result.data;
  const ss = W * H > 2500000 ? 1 : 2; // super-sampling for smooth edges

  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 2);
  const maxX = Math.min(W - 1, Math.ceil(Math.max(...xs)) + 2);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 2);
  const maxY = Math.min(H - 1, Math.ceil(Math.max(...ys)) + 2);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let r = 0;
      let gr = 0;
      let bl = 0;
      let weight = 0;

      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const X = x + (i + 0.5) / ss;
          const Y = y + (j + 0.5) / ss;
          const den = g * X + h * Y + 1;
          const u = (a * X + b * Y + c) / den - 0.5;
          const v = (d * X + e * Y + f) / den - 0.5;
          if (u < -1 || v < -1 || u > sw || v > sh) continue;

          const x0 = Math.floor(u);
          const y0 = Math.floor(v);
          const fx = u - x0;
          const fy = v - y0;

          for (let dy = 0; dy < 2; dy++) {
            const yy = y0 + dy;
            if (yy < 0 || yy >= sh) continue;
            const wy = dy ? fy : 1 - fy;
            for (let dx = 0; dx < 2; dx++) {
              const xx = x0 + dx;
              if (xx < 0 || xx >= sw) continue;
              const w = wy * (dx ? fx : 1 - fx);
              const idx = (yy * sw + xx) * 4;
              r += w * sdata[idx];
              gr += w * sdata[idx + 1];
              bl += w * sdata[idx + 2];
              weight += w;
            }
          }
        }
      }

      if (weight > 0) {
        const o = (y * W + x) * 4;
        out[o] = r / weight;
        out[o + 1] = gr / weight;
        out[o + 2] = bl / weight;
        out[o + 3] = (weight / (ss * ss)) * 255;
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d').putImageData(result, 0, 0);
  return canvas;
}

/* -------------------------------------------------------------------------- */
/* Background (the desk / table under the paper)                              */
/* -------------------------------------------------------------------------- */

function drawBackground(ctx, W, H, type) {
  if (type === 'dark') {
    const grad = ctx.createRadialGradient(
      W / 2,
      H / 2,
      W * 0.1,
      W / 2,
      H / 2,
      H
    );
    grad.addColorStop(0, '#3d3d42');
    grad.addColorStop(1, '#17171a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (type === 'light') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#f4f4f6');
    grad.addColorStop(1, '#cfd1d6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (type === 'grey') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#9a9b9f');
    grad.addColorStop(1, '#6c6d72');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    // wooden desk
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#8d6a47');
    grad.addColorStop(1, '#6b4a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const y = rand(-0.05, 1.05) * H;
      const amp = rand(2, 14) * (W / 800);
      const color = Math.random() < 0.5 ? '45,25,10' : '175,135,90';
      const alpha = rand(0.05, 0.18).toFixed(3);
      ctx.strokeStyle = `rgba(${color},${alpha})`;
      ctx.lineWidth = rand(0.6, 3.2) * (W / 800);
      ctx.beginPath();
      ctx.moveTo(-10, y);
      ctx.bezierCurveTo(
        W * 0.3,
        y + rand(-amp, amp),
        W * 0.65,
        y + rand(-amp, amp),
        W + 10,
        y + rand(-amp, amp)
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.35,
    W / 2,
    H / 2,
    Math.hypot(W, H) / 2
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function addGrain(ctx, W, H, amount) {
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Makes the page look like it was captured with a phone camera:
 * the page becomes a trapezoid, sits on a desk, casts a soft shadow, etc.
 * The returned canvas has the same size as the input, so PDF export keeps
 * working exactly as before.
 *
 * @param {HTMLCanvasElement} src the flat page
 * @param {object} phone the `phone` part of an effect preset
 * @param {{direction: string, background: string}} options
 * @return {HTMLCanvasElement}
 */
function applyPhoneEffect(src, phone, options = {}) {
  const W = src.width;
  const H = src.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');

  drawBackground(ctx, W, H, options.background);

  const quad = buildQuad(W, H, phone, options.direction);
  const warped = warpToQuad(src, quad, W, H);

  // paper with a soft shadow under it
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = W * 0.03;
  ctx.shadowOffsetX = W * 0.008;
  ctx.shadowOffsetY = W * 0.012;
  ctx.drawImage(warped, 0, 0);
  ctx.restore();

  if (phone.vignette) drawVignette(ctx, W, H);
  if (phone.grain) addGrain(ctx, W, H, 12);

  return out;
}

/* -------------------------------------------------------------------------- */
/* Scanner style contrast                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Adds contrast like a document scanner does. Contrast is measured against
 * the page colour, so a cream / yellow page keeps its tint instead of turning
 * white.
 *
 * @param {ImageData} imageData
 * @param {number} contrast between 0 and 1
 * @param {number[]} paper [r, g, b] of the page colour
 */
function contrastImage(imageData, contrast, paper = [255, 255, 255]) {
  const data = imageData.data;
  contrast *= 255;
  const factor = (contrast + 255) / (255.01 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const p = Math.max(paper[k], 1);
      const relative = (data[i + k] / p) * 255;
      const adjusted = factor * (relative - 128) + 128;
      data[i + k] = Math.min(adjusted, 255) * (p / 255);
    }
  }
  return imageData;
}

/** Converts "#rrggbb" to [r, g, b] */
function hexToRgb(hex) {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!value) return [255, 255, 255];
  const n = parseInt(value[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* -------------------------------------------------------------------------- */
/* Watermark                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Draws the supplied CamScanner logo after page effects have been applied.
 *
 * @param {HTMLCanvasElement} canvas the generated page
 * @param {HTMLImageElement} image the supplied watermark logo
 * @param {'left'|'center'|'right'} position
 */
async function drawWatermark(canvas, image, position = 'right') {
  await image.decode();
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const height = 26 * (W / 400);
  const width = height * (image.naturalWidth / image.naturalHeight);
  const edge = 9 * (W / 400);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let x = edge;
  if (position === 'center') x = (W - width) / 2;
  if (position === 'right') x = W - width - edge;
  ctx.drawImage(image, x, H - height - edge, width, height);
  ctx.restore();
}

export {
  getEffect,
  isPhoneEffect,
  applyPhoneEffect,
  contrastImage,
  hexToRgb,
  drawWatermark
};
