const pageEl = document.querySelector('.page-a');
const paperContentEl = document.querySelector('.page-a .paper-content');
const overlayEl = document.querySelector('.overlay');

let paperContentPadding;

function isFontErrory() {
  // SOme fonts have padding top errors, this functions tells you if the current font has that;
  const currentHandwritingFont = document.body.style.getPropertyValue(
    '--handwriting-font'
  );
  return (
    currentHandwritingFont === '' ||
    currentHandwritingFont.includes('Homemade Apple')
  );
}

/**
 * Sets the light/shadow gradient that is drawn on top of the page.
 * This runs once for every generated page, so each page gets its own light.
 */
function setPageOverlay(effect) {
  if (!effect.overlay) {
    overlayEl.classList.remove('shadows');
    return;
  }

  overlayEl.classList.add('shadows');
  if (effect.contrast) {
    // For scanner, we need shadow between 50deg to 120deg only
    // Since If the lit part happens to be on margins, the margins get invisible
    overlayEl.style.background = `linear-gradient(${
      Math.floor(Math.random() * (120 - 50 + 1)) + 50
    }deg, #0008, #0000)`;
  } else {
    overlayEl.style.background = `linear-gradient(${
      Math.random() * 360
    }deg, #0008, #0000)`;
  }
}

function applyPaperStyles() {
  pageEl.style.border = 'none';
  pageEl.style.overflowY = 'hidden';
  // hides things that are only meant for the preview (e.g. placeholders)
  pageEl.classList.add('generating');

  if (isFontErrory() && document.querySelector('#font-file').files.length < 1) {
    paperContentPadding =
      paperContentEl.style.paddingTop.replace(/px/g, '') || 5;
    const newPadding = Number(paperContentPadding) - 5;
    paperContentEl.style.paddingTop = `${newPadding}px`;
  }
}

function removePaperStyles() {
  pageEl.style.overflowY = 'auto';
  pageEl.style.border = '1px solid var(--elevation-background)';
  pageEl.classList.remove('generating');

  overlayEl.classList.remove('shadows');

  if (isFontErrory()) {
    paperContentEl.style.paddingTop = `${paperContentPadding}px`;
  }
}

function renderOutput(outputImages) {
  const outputHeader = document.querySelector('#output-header');
  if (outputImages.length <= 0) {
    outputHeader.textContent = 'Output';
    document.querySelector('#output').innerHTML =
      'Click "Generate Image" Button to generate new image.';
    document.querySelector('#download-as-pdf-button').classList.remove('show');
    document.querySelector('#delete-all-button').classList.remove('show');
    return;
  }

  outputHeader.textContent = `Output ( ${outputImages.length} )`;
  document.querySelector('#download-as-pdf-button').classList.add('show');
  document.querySelector('#delete-all-button').classList.add('show');
  document.querySelector('#output').innerHTML = outputImages
    .map(createOutputImageMarkup)
    .join('');
}

function appendOutputImage(outputImageCanvas, index, total) {
  const output = document.querySelector('#output');
  const markup = createOutputImageMarkup(outputImageCanvas, index);
  if (!output.querySelector('.output-image-container')) output.innerHTML = '';
  output.insertAdjacentHTML('beforeend', markup);
  document.querySelector('#output-header').textContent = `Output ( ${total} )`;
  document.querySelector('#download-as-pdf-button').classList.add('show');
  document.querySelector('#delete-all-button').classList.add('show');
}

function createOutputImageMarkup(outputImageCanvas, index) {
  const imageData = outputImageCanvas.toDataURL('image/jpeg');
  return /* html */ `
    <div 
      class="output-image-container" 
      style="position: relative;display: inline-block;"
    >
      <button 
        data-index="${index}" 
        class="close-button close-${index}">
          &times;
      </button>
      <img 
        class="shadow" 
        alt="Output image ${index}" 
        src="${imageData}"
      />
      <div style="text-align: center">
        <a 
          class="button download-image-button" 
          download 
          href="${imageData}"
        >Download Image</a>
        <br />
        <br />

        <button 
          class="button move-left"
          data-index="${index}" 
        >
          Move Left
        </button>
        <button 
          class="button move-right"
          data-index="${index}" 
        >
          Move Right
        </button>
      </div>
    </div>
    `;
}

export {
  removePaperStyles,
  applyPaperStyles,
  setPageOverlay,
  renderOutput,
  appendOutputImage
};
