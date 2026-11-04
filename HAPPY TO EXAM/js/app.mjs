import {
  addFontFromFile,
  formatText,
  addPaperFromFile
} from './utils/helpers.mjs';
import {
  generateImages,
  downloadAsPDF,
  deleteAll
} from './generate-images.mjs';
import { setInkColor, toggleDrawCanvas } from './utils/draw.mjs';
import { isPhoneEffect } from './utils/effects.mjs';
import {
  initHeaderInfo,
  setHeaderVisible,
  setHeaderLabels,
  setPageColor,
  setMarginLineColor,
  initNaturalMargin
} from './utils/page-options.mjs';

/**
 *
 * Hi there! This is the entry file of the tool and deals with adding event listeners
 * and some other functions.
 *
 * To contribute, you can follow the imports above and make changes in the file
 * related to the issue you've choosen.
 *
 * If you have any questions related to code, you can drop them in my Twitter DM @saurabhcodes
 * or in my email at saurabhdaware99@gmail.com
 *
 * Thanks! and Happy coding 🌻
 *
 */

const pageEl = document.querySelector('.page-a');

const setTextareaStyle = (attrib, v) => (pageEl.style[attrib] = v);

/**
 * Add event listeners here, they will be automatically mapped with addEventListener later
 */
const EVENT_MAP = {
  '#generate-image-form': {
    on: 'submit',
    action: async (e) => {
      e.preventDefault();
      const status = document.querySelector('#output-generation-status');
      const errorMessage = document.querySelector('#output-generation-error');
      status.hidden = false;
      errorMessage.hidden = true;
      try {
        await generateImages();
      } catch (error) {
        console.error('Image generation failed:', error);
        errorMessage.textContent = `Image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
        errorMessage.hidden = false;
      } finally {
        status.hidden = true;
      }
    }
  },
  '#handwriting-font': {
    on: 'change',
    action: (e) =>
      document.body.style.setProperty('--handwriting-font', e.target.value)
  },
  '#font-size': {
    on: 'change',
    action: (e) => {
      if (e.target.value > 30) {
        alert('Font-size is too big try upto 30');
      } else {
        setTextareaStyle('fontSize', e.target.value + 'pt');
        e.preventDefault();
      }
    }
  },
  '#letter-spacing': {
    on: 'change',
    action: (e) => {
      if (e.target.value > 40) {
        alert('Letter Spacing is too big try a number upto 40');
      } else {
        setTextareaStyle('letterSpacing', e.target.value + 'px');
        e.preventDefault();
      }
    }
  },
  '#word-spacing': {
    on: 'change',
    action: (e) => {
      if (e.target.value > 100) {
        alert('Word Spacing is too big try a number upto hundred');
      } else {
        setTextareaStyle('wordSpacing', e.target.value + 'px');
        e.preventDefault();
      }
    }
  },
  '#top-padding': {
    on: 'change',
    action: (e) => {
      document.querySelector('.page-a .paper-content').style.paddingTop =
        e.target.value + 'px';
    }
  },
  '#font-file': {
    on: 'change',
    action: (e) => addFontFromFile(e.target.files[0])
  },
  '#ink-color': {
    on: 'change',
    action: (e) => {
      document.body.style.setProperty('--ink-color', e.target.value);
      setInkColor(e.target.value);
    }
  },
  '#paper-margin-toggle': {
    on: 'change',
    action: () => {
      if (pageEl.classList.contains('margined')) {
        pageEl.classList.remove('margined');
      } else {
        pageEl.classList.add('margined');
      }
    }
  },
  '#paper-line-toggle': {
    on: 'change',
    action: () => {
      if (pageEl.classList.contains('lines')) {
        pageEl.classList.remove('lines');
      } else {
        pageEl.classList.add('lines');
      }
    }
  },
  '#draw-diagram-button': {
    on: 'click',
    action: () => {
      toggleDrawCanvas();
    }
  },
  '.draw-container .close-button': {
    on: 'click',
    action: () => {
      toggleDrawCanvas();
    }
  },
  '#download-as-pdf-button': {
    on: 'click',
    action: () => {
      downloadAsPDF();
    }
  },
  '#delete-all-button': {
    on: 'click',
    action: () => {
      deleteAll();
    }
  },
  '.page-a .paper-content': {
    on: 'paste',
    action: formatText
  },
  '#paper-file': {
    on: 'change',
    action: (e) => addPaperFromFile(e.target.files[0])
  },
  '#header-toggle': {
    on: 'change',
    action: (e) => setHeaderVisible(e.target.checked)
  },
  '#labels-toggle': {
    on: 'change',
    action: (e) => setHeaderLabels(e.target.checked)
  },
  '#page-effects': {
    on: 'change',
    action: () => showEffectOptions()
  },
  '#page-color-custom': {
    on: 'input',
    action: (e) => setPageColor(e.target.value)
  },
  '#watermark-toggle': {
    on: 'change',
    action: () => showWatermarkOptions()
  },
  '#margin-line-color': {
    on: 'input',
    action: (e) => setMarginLineColor(e.target.value)
  }
};

/** Phone capture options are only needed for the trapezoid effects */
function showEffectOptions() {
  document.querySelector('#phone-options').hidden = !isPhoneEffect(
    document.querySelector('#page-effects').value
  );
}

function showWatermarkOptions() {
  const isOn = document.querySelector('#watermark-toggle').checked;
  document.querySelector('#watermark-position-box').hidden = !isOn;
}

for (const eventSelector in EVENT_MAP) {
  document
    .querySelector(eventSelector)
    .addEventListener(
      EVENT_MAP[eventSelector].on,
      EVENT_MAP[eventSelector].action
    );
}

/** Page colour swatches */
document.querySelectorAll('.swatch[data-color]').forEach((swatch) => {
  swatch.addEventListener('click', () => setPageColor(swatch.dataset.color));
});

/** Set the starting state of the new options */
initHeaderInfo();
setPageColor('#ffffff');
showEffectOptions();
showWatermarkOptions();
initNaturalMargin();

/**
 * This makes toggles, accessible.
 */
document.querySelectorAll('.switch-toggle input').forEach((toggleInput) => {
  toggleInput.addEventListener('change', () => {
    toggleInput.setAttribute('aria-checked', toggleInput.checked);
  });
});
