import {
  applyPaperStyles,
  removePaperStyles,
  setPageOverlay,
  renderOutput,
  appendOutputImage
} from './utils/generate-utils.mjs';
import { createPDF, getUploadedFontBuffer } from './utils/helpers.mjs';
import {
  getEffect,
  applyPhoneEffect,
  contrastImage,
  hexToRgb,
  drawWatermark
} from './utils/effects.mjs';
import {
  getPageColor,
  getHeaderPages,
  hideHeaderContent,
  randomizeNaturalMargin,
  hideNaturalMarginPreview,
  drawNaturalMarginOnCanvas
} from './utils/page-options.mjs';

const pageEl = document.querySelector('.page-a');
let outputImages = [];
let isGenerating = false;

/**
 * html2canvas takes the picture from a copy (clone) of the page. A font that
 * was uploaded with the "Upload your handwriting font" button only exists in
 * the real page, so the copy used another (usually narrower) font to break the
 * lines. The picture then had fewer lines than the page and the letters
 * were squeezed together. Here the uploaded font is added to the copy too.
 */
async function addUploadedFontToClone(clonedDoc) {
  const buffer = getUploadedFontBuffer();
  if (!buffer) return;
  try {
    const face = new clonedDoc.defaultView.FontFace('temp-font', buffer);
    await face.load();
    clonedDoc.fonts.add(face);
  } catch (e) {
    // the picture still works, just with the browser's fallback font
  }
}

/**
 * To generate image, we add styles to DIV and converts that HTML Element into Image.
 * This is the function that deals with it.
 */
async function convertDIVToImage(pageNumber = 0) {
  const options = {
    scrollX: 0,
    scrollY: -window.scrollY,
    scale: document.querySelector('#resolution').value,
    useCORS: true,
    onclone: addUploadedFontToClone
  };

  const effect = getEffect(document.querySelector('#page-effects').value);
  setPageOverlay(effect);

  // Header (name, roll...) can be limited to the first page
  hideHeaderContent(getHeaderPages() === 'first' && pageNumber > 0);

  // every page gets its own natural margin deviation (few mm print crookedness)
  const marginDeviation = randomizeNaturalMargin();
  // the preview SVG is hidden while capturing: html2canvas distorts inline
  // SVG coordinates, the wavy lines are drawn on the canvas instead
  hideNaturalMarginPreview(true);

  /** Function html2canvas comes from a library html2canvas which is included in the index.html */
  let canvas;
  try {
    canvas = await html2canvas(pageEl, options);
  } finally {
    hideNaturalMarginPreview(false);
  }

  /** Send image data for modification if effect is scanner */
  if (effect.contrast) {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    contrastImage(imageData, 0.55, hexToRgb(getPageColor()));
    context.putImageData(imageData, 0, 0);
  }

  /** Wavy natural margin lines, drawn after contrast so the colour survives */
  if (marginDeviation) {
    drawNaturalMarginOnCanvas(canvas, !!effect.contrast);
  }

  /** Trapezoid / phone camera effects */
  if (effect.phone) {
    canvas = applyPhoneEffect(canvas, effect.phone, {
      direction: document.querySelector('#phone-direction').value,
      background: document.querySelector('#phone-background').value
    });
  }

  /** Draw the supplied logo last so page effects cannot alter it. */
  if (document.querySelector('#watermark-toggle').checked) {
    await drawWatermark(
      canvas,
      document.querySelector('#watermark-logo'),
      document.querySelector('#watermark-position').value
    );
  }

  return canvas;
}

/**
 * Splits the text into pages so that every page is filled completely.
 *
 * Old versions measured the page with `scrollHeight`, but handwriting fonts
 * usually have a very tall ascent/descent. That made `scrollHeight` much bigger
 * than the real text, so the page was "full" after only half of the lines.
 * Here the position of the last LINE is measured instead (with a tiny probe
 * element), which does not depend on the font metrics. A binary search finds
 * how much text fits on each page.
 *
 * @param {HTMLElement} paperContentEl the text area of the page
 * @return {string[]} HTML of every page
 */
function splitIntoPages(paperContentEl) {
  const html = paperContentEl.innerHTML;
  // tags, white space and words are separate tokens: nothing gets lost and
  // tags are never cut in the middle
  const tokens = html.match(/<[^>]*>|\s+|[^<\s]+/g) || [];
  const total = tokens.length;
  if (!total) return [html];

  const style = getComputedStyle(paperContentEl);
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;

  const probe = document.createElement('span');
  probe.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:top;';

  // bottom edge of the page (a last line must end above it)
  const pageBottom = () => pageEl.getBoundingClientRect().top + pageEl.clientHeight;

  const fits = (from, to) => {
    paperContentEl.innerHTML = tokens.slice(from, to).join('');

    // put the probe at the very end of the content (inside the last element)
    let host = paperContentEl;
    while (
      host.lastChild &&
      host.lastChild.nodeType === 1 &&
      !/^(BR|IMG)$/.test(host.lastChild.tagName)
    ) {
      host = host.lastChild;
    }
    host.appendChild(probe);

    const limit = pageBottom() + 0.5;
    let ok = probe.getBoundingClientRect().top + lineHeight <= limit;
    if (ok) {
      // pictures can be taller than a text line
      paperContentEl.querySelectorAll('img').forEach((img) => {
        if (img.getBoundingClientRect().bottom > limit) ok = false;
      });
    }
    probe.remove();
    return ok;
  };

  // everything fits on one page
  if (fits(0, total)) return [html];

  const pages = [];
  let start = 0;
  while (start < total) {
    // a page may end after a white space or a tag (never inside a word)
    const cuts = [];
    for (let e = start + 1; e <= total; e++) {
      if (e === total || tokens[e - 1].charAt(0) === '<' || /^\s/.test(tokens[e - 1])) {
        cuts.push(e);
      }
    }

    let end;
    if (fits(start, total)) {
      end = total;
    } else {
      // biggest amount of text that still fits (at least one piece per page)
      let low = 0;
      let high = cuts.length - 1;
      let best = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (fits(start, cuts[mid])) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      end = cuts[best];
    }

    pages.push(tokens.slice(start, end).join(''));
    start = end;
    // the next page does not start with empty space
    while (start < total && /^\s+$/.test(tokens[start])) start++;
  }
  return pages;
}

/**
 * This is the function that gets called on clicking "Generate Image" button.
 */
export async function generateImages() {
  if (isGenerating) return;
  isGenerating = true;
  const generateButton = document.querySelector(
    '#generate-image-form button[type="submit"]'
  );
  generateButton.disabled = true;
  document.querySelector('#output-generation-error').hidden = true;
  const paperContentEl = document.querySelector('.page-a .paper-content');
  const initialPaperContent = paperContentEl.innerHTML;

  try {
    applyPaperStyles();
    pageEl.scroll(0, 0);
    const pages = splitIntoPages(paperContentEl);

    if (pages.length > 1) {
      // For multiple pages
      if (initialPaperContent.includes('<img')) {
        alert(
          "You're trying to generate more than one page, Images and some formatting may not work correctly with multiple images" // eslint-disable-line max-len
        );
      }
      for (let i = 0; i < pages.length; i++) {
        paperContentEl.innerHTML = pages[i];
        pageEl.scrollTo(0, 0);
        const canvas = await convertDIVToImage(i);
        appendOutputImage(canvas, outputImages.length, outputImages.length + 1);
        outputImages.push(canvas);
        setRemoveImageListeners();
      }
    } else {
      // single image
      paperContentEl.innerHTML = initialPaperContent;
      const canvas = await convertDIVToImage(0);
      appendOutputImage(canvas, outputImages.length, outputImages.length + 1);
      outputImages.push(canvas);
      setRemoveImageListeners();
    }
  } finally {
    paperContentEl.innerHTML = initialPaperContent;
    hideHeaderContent(false);
    removePaperStyles();
    generateButton.disabled = false;
    isGenerating = false;
  }
}

/**
 * Delete all generated images
 */

export const deleteAll = () => {
  outputImages.splice(0, outputImages.length);
  renderOutput(outputImages);
  document.querySelector('#output-header').textContent =
    'Output' + (outputImages.length ? ' ( ' + outputImages.length + ' )' : '');
};

const arrayMove = (arr, oldIndex, newIndex) => {
  if (newIndex >= arr.length) {
    let k = newIndex - arr.length + 1;
    while (k--) {
      arr.push(undefined);
    }
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr; // for testing
};

export const moveLeft = (index) => {
  if (index === 0) return outputImages;
  outputImages = arrayMove(outputImages, index, index - 1);
  renderOutput(outputImages);
};

export const moveRight = (index) => {
  if (index + 1 === outputImages.length) return outputImages;
  outputImages = arrayMove(outputImages, index, index + 1);
  renderOutput(outputImages);
};

/**
 * Downloads generated images as PDF
 */
export const downloadAsPDF = () => {
  if (!outputImages.length) {
    alert(
      'Please click "Generate Image" first — the PDF is made from the generated pages.'
    );
    return;
  }
  createPDF(outputImages);
};

/**
 * Sets event listeners for close button on output images.
 */
function setRemoveImageListeners() {
  const output = document.querySelector('#output');
  if (output.dataset.listenersAttached) return;
  output.dataset.listenersAttached = 'true';
  output.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const button = e.target.closest('button');
    if (!button) return;

    if (button.classList.contains('close-button')) {
      outputImages.splice(Number(button.dataset.index), 1);
      renderOutput(outputImages);
    } else if (button.classList.contains('move-left')) {
      moveLeft(Number(button.dataset.index));
    } else if (button.classList.contains('move-right')) {
      moveRight(Number(button.dataset.index));
    }
  });
}
