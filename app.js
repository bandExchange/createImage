const LAYOUT_BASE = {
  canvas: { width: 2048, height: 2048 },
  cardFrame: { x: 274, y: 548, width: 1498, height: 964 },
  photo: { x: 354, y: 830, width: 380, height: 488 },
  barcode: { width: 380, height: 100, gapBelowPhoto: 30 },
  textFieldWidthRatio: 0.7,
  textFieldTopInsetRatio: 0.11,
  logoLayout: {
    leftShift: 64,
    topRatio: 1.14,
    extraYOffset: 36,
    widthScale: 1.12,
    heightRatio: 0.15,
  },
  nameValueLayout: {
    topRatio: 0.62,
    fontSizeRatio: 0.062,
    widthScale: 1.05,
    offsetX: 15,
  },
};

const TEXT_FIELD_ASPECT = 434 / 1024;

function buildLayout() {
  const { cardFrame, textFieldWidthRatio, textFieldTopInsetRatio } = LAYOUT_BASE;
  const textFieldWidth = Math.round(cardFrame.width * textFieldWidthRatio);
  const textFieldHeight = Math.round(textFieldWidth * TEXT_FIELD_ASPECT);
  const textField = {
    x: cardFrame.x + Math.round((cardFrame.width - textFieldWidth) / 2),
    y: cardFrame.y + Math.round(cardFrame.height * textFieldTopInsetRatio),
    width: textFieldWidth,
    height: textFieldHeight,
  };

  const photo = LAYOUT_BASE.photo;
  const barcode = {
    x: photo.x,
    y: photo.y + photo.height + LAYOUT_BASE.barcode.gapBelowPhoto,
    width: LAYOUT_BASE.barcode.width,
    height: LAYOUT_BASE.barcode.height,
  };

  const contentX = photo.x + photo.width + Math.round(cardFrame.width * 0.03);
  const contentWidth = cardFrame.x + cardFrame.width - contentX - Math.round(cardFrame.width * 0.04);
  const { logoLayout } = LAYOUT_BASE;
  const logoX = contentX - logoLayout.leftShift;
  const logoWidth = Math.min(
    Math.round(contentWidth * logoLayout.widthScale),
    cardFrame.x + cardFrame.width - logoX - Math.round(cardFrame.width * 0.03),
  );

  return {
    canvas: LAYOUT_BASE.canvas,
    layers: {
      background: { x: 0, y: 0, width: 2048, height: 2048 },
      cardFrame,
      textField,
      photo,
      barcode,
      nameValue: {
        x: contentX + LAYOUT_BASE.nameValueLayout.offsetX,
        y: textField.y + Math.round(textField.height * LAYOUT_BASE.nameValueLayout.topRatio),
        fontSize: Math.round(textField.width * LAYOUT_BASE.nameValueLayout.fontSizeRatio),
        width: Math.round(contentWidth * LAYOUT_BASE.nameValueLayout.widthScale),
      },
      logo: {
        x: logoX,
        y: textField.y + Math.round(textField.height * logoLayout.topRatio) + logoLayout.extraYOffset,
        width: logoWidth,
        height: Math.round(cardFrame.height * logoLayout.heightRatio),
      },
    },
  };
}

const LAYOUT = buildLayout();

const CANVAS_SIZE = LAYOUT.canvas.width;

const ASSETS = {
  font: './assets/Paperlogy.ttf',
  cardFrame: './assets/cardFrame.png',
  textField: './assets/textField.png',
  barcode: './assets/barcode.png',
};

const LOGOS = {
  ap: './assets/ap.png',
  np: './assets/np.png',
  qm: './assets/qm.png',
};

const DEFAULT_COLORS = {
  background: { h: 0, s: 0, v: 87 },
  cardFrame: { h: 0, s: 0, v: 77 },
  textField: { h: 232, s: 18, v: 55 },
};

const state = {
  photo: null,
  backgroundImage: null,
  name: '',
  activeColorTarget: 'background',
  colors: {
    background: { ...DEFAULT_COLORS.background },
    cardFrame: { ...DEFAULT_COLORS.cardFrame },
    textField: { ...DEFAULT_COLORS.textField },
  },
  company: null,
};

const images = {};
let fontLoaded = false;

const canvas = document.getElementById('preview');
const ctx = canvas.getContext('2d');

const photoInput = document.getElementById('photoInput');
const nameInput = document.getElementById('nameInput');
const bgImageInput = document.getElementById('bgImageInput');
const clearBgImageBtn = document.getElementById('clearBgImageBtn');
const companyTabs = document.getElementById('companyTabs');
const downloadBtn = document.getElementById('downloadBtn');
const colorTargetTabs = document.getElementById('colorTargetTabs');
const colorPickerRoot = document.getElementById('colorPicker');
const backgroundExtras = document.getElementById('backgroundExtras');

const DOWNLOAD_COUNTER_KEY = 'feedImageDownloadCounter';

function getNextDownloadFilename() {
  const current = Number(localStorage.getItem(DOWNLOAD_COUNTER_KEY) || 0);
  const next = current + 1;
  localStorage.setItem(DOWNLOAD_COUNTER_KEY, String(next));
  return `feedImage${String(next).padStart(2, '0')}.png`;
}

function loadImage(src) {
  if (images[src]) return images[src];
  images[src] = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      delete images[src];
      reject(new Error(`Failed to load: ${src}`));
    };
    img.src = new URL(src, window.location.href).href;
  });
  return images[src];
}

async function loadFont() {
  if (fontLoaded) return;
  try {
    const face = new FontFace('Paperlogy', `url(${ASSETS.font})`);
    await face.load();
    document.fonts.add(face);
    fontLoaded = true;
  } catch (error) {
    console.warn('폰트 로드 실패, 기본 폰트 사용:', error);
  }
}

function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function colorToCss(hsv) {
  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return `rgb(${r}, ${g}, ${b})`;
}

function hsvToHex(hsv) {
  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

function parseHexColor(input) {
  let hex = input.trim();
  if (!hex) return null;
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;

  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function parseCssColor(color) {
  const match = color.match(/\d+/g);
  return match ? match.map(Number) : [0, 0, 0];
}

function drawImageCover(context, img, area) {
  const ratio = Math.max(area.width / img.width, area.height / img.height);
  const width = img.width * ratio;
  const height = img.height * ratio;
  const x = area.x + (area.width - width) / 2;
  const y = area.y + (area.height - height) / 2;
  context.drawImage(img, x, y, width, height);
}

function drawKeyedTintedImage(context, img, area, color, options = {}) {
  const { blackThreshold = 48, fit = 'stretch' } = options;
  const width = Math.round(area.width);
  const height = Math.round(area.height);
  const x = Math.round(area.x);
  const y = Math.round(area.y);
  const [tr, tg, tb] = parseCssColor(color);

  const temp = document.createElement('canvas');
  temp.width = width;
  temp.height = height;
  const tempCtx = temp.getContext('2d');

  if (fit === 'contain') {
    const scale = Math.min(width / img.width, height / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const offsetX = Math.round((width - drawW) / 2);
    const offsetY = Math.round((height - drawH) / 2);
    tempCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    tempCtx.drawImage(img, 0, 0, width, height);
  }

  const imageData = tempCtx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const sum = data[i] + data[i + 1] + data[i + 2];
    if (sum <= blackThreshold) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = tr;
    data[i + 1] = tg;
    data[i + 2] = tb;
    data[i + 3] = 255;
  }

  tempCtx.putImageData(imageData, 0, 0);
  context.drawImage(temp, x, y);
}

function drawDarkTintedImage(context, img, area, color, options = {}) {
  const { brightThreshold = 180, fit = 'stretch' } = options;
  const width = Math.round(area.width);
  const height = Math.round(area.height);
  const x = Math.round(area.x);
  const y = Math.round(area.y);
  const [tr, tg, tb] = parseCssColor(color);

  const temp = document.createElement('canvas');
  temp.width = width;
  temp.height = height;
  const tempCtx = temp.getContext('2d');

  if (fit === 'contain') {
    const scale = Math.min(width / img.width, height / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const offsetX = Math.round((width - drawW) / 2);
    const offsetY = Math.round((height - drawH) / 2);
    tempCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    tempCtx.drawImage(img, 0, 0, width, height);
  }

  const imageData = tempCtx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    const sum = data[i] + data[i + 1] + data[i + 2];
    if (alpha < 16 || sum > brightThreshold) {
      data[i + 3] = 0;
      continue;
    }
    const strength = Math.min(1, (brightThreshold - sum) / brightThreshold);
    data[i] = tr;
    data[i + 1] = tg;
    data[i + 2] = tb;
    data[i + 3] = Math.round(alpha * strength);
  }

  tempCtx.putImageData(imageData, 0, 0);
  context.drawImage(temp, x, y);
}

function drawBackground(context) {
  const { background } = LAYOUT.layers;

  if (state.backgroundImage) {
    drawImageCover(context, state.backgroundImage, background);
    return;
  }

  context.fillStyle = colorToCss(state.colors.background);
  context.fillRect(background.x, background.y, background.width, background.height);
}

async function drawCardFrame(context) {
  const cardFrameImg = await loadImage(ASSETS.cardFrame);
  const color = colorToCss(state.colors.cardFrame);
  const area = LAYOUT.layers.cardFrame;

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.16)';
  context.shadowBlur = 40;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 18;
  drawKeyedTintedImage(context, cardFrameImg, area, color);
  context.restore();
}

function drawPhoto(context) {
  const { photo } = LAYOUT.layers;
  const textColor = colorToCss(state.colors.textField);

  context.save();
  context.beginPath();
  context.rect(photo.x, photo.y, photo.width, photo.height);
  context.clip();

  if (state.photo) {
    drawImageCover(context, state.photo, photo);
  } else {
    context.fillStyle = textColor;
    context.fillRect(photo.x, photo.y, photo.width, photo.height);
  }

  context.restore();
}

async function drawTextFieldLayer(context) {
  const textFieldImg = await loadImage(ASSETS.textField);
  const color = colorToCss(state.colors.textField);
  drawKeyedTintedImage(context, textFieldImg, LAYOUT.layers.textField, color);
}

function drawNameValue(context) {
  const { nameValue } = LAYOUT.layers;
  const text = state.name.trim() || '이름 입력';
  const textColor = colorToCss(state.colors.textField);

  context.save();
  context.fillStyle = textColor;
  context.font = `${nameValue.fontSize}px Paperlogy, sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.globalAlpha = state.name.trim() ? 1 : 0.75;
  context.fillText(text, nameValue.x, nameValue.y, nameValue.width);
  context.restore();
}

async function drawBarcode(context) {
  const barcodeImg = await loadImage(ASSETS.barcode);
  const textColor = colorToCss(state.colors.textField);
  drawDarkTintedImage(context, barcodeImg, LAYOUT.layers.barcode, textColor);
}

async function drawCompanyLogo(context) {
  if (!state.company) return;
  const logoImg = await loadImage(LOGOS[state.company]);
  const textColor = colorToCss(state.colors.textField);
  drawKeyedTintedImage(context, logoImg, LAYOUT.layers.logo, textColor, {
    blackThreshold: 48,
    fit: 'contain',
  });
}

async function render() {
  await loadFont();

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  drawBackground(ctx);
  await drawCardFrame(ctx);
  drawPhoto(ctx);
  await drawTextFieldLayer(ctx);
  drawNameValue(ctx);
  await drawBarcode(ctx);
  await drawCompanyLogo(ctx);
}

function scheduleRender() {
  render().catch((error) => {
    console.error(error);
    ctx.fillStyle = '#eceef2';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = '#c0392b';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('이미지 로드 실패', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 40);
    ctx.fillStyle = '#666';
    ctx.font = '22px sans-serif';
    const hint = window.location.protocol === 'file:'
      ? 'start.sh 로 로컬 서버 실행 후 접속하세요'
      : String(error?.message || '새로고침 후 다시 시도하세요');
    ctx.fillText(hint, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
  });
}

function initColorTabs(refreshPicker) {
  if (!colorTargetTabs) return;

  colorTargetTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-target]');
    if (!button) return;

    state.activeColorTarget = button.dataset.target;

    colorTargetTabs.querySelectorAll('[data-target]').forEach((tab) => {
      tab.classList.toggle('active', tab === button);
    });

    if (backgroundExtras) {
      backgroundExtras.hidden = state.activeColorTarget !== 'background';
    }

    refreshPicker();
  });
}

function createColorPicker(root) {
  const getTarget = () => state.activeColorTarget;
  const svCanvas = root.querySelector('.color-picker__sv');
  const hueCanvas = root.querySelector('.color-picker__hue');
  const hexInput = root.querySelector('.color-hex-input');
  const svCtx = svCanvas.getContext('2d');
  const hueCtx = hueCanvas.getContext('2d');

  function updateHexInput() {
    if (!hexInput) return;
    hexInput.value = hsvToHex(state.colors[getTarget()]);
    hexInput.classList.remove('color-hex-input--invalid');
  }

  function applyHexInput({ commitInvalid = false } = {}) {
    if (!hexInput) return false;

    const parsed = parseHexColor(hexInput.value);
    if (!parsed) {
      if (commitInvalid) {
        updateHexInput();
      } else {
        hexInput.classList.add('color-hex-input--invalid');
      }
      return false;
    }

    const target = getTarget();
    state.colors[target] = rgbToHsv(parsed.r, parsed.g, parsed.b);
    hexInput.value = hsvToHex(state.colors[target]);
    hexInput.classList.remove('color-hex-input--invalid');
    return true;
  }

  function drawSvPlane() {
    const { width, height } = svCanvas;
    const imageData = svCtx.createImageData(width, height);
    const { data } = imageData;
    const hue = state.colors[getTarget()].h;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const s = (x / (width - 1)) * 100;
        const v = (1 - y / (height - 1)) * 100;
        const [r, g, b] = hsvToRgb(hue, s, v);
        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }
    }

    svCtx.putImageData(imageData, 0, 0);
    drawSvCursor();
  }

  function drawHueStrip() {
    const { width, height } = hueCanvas;
    const imageData = hueCtx.createImageData(width, height);
    const { data } = imageData;

    for (let y = 0; y < height; y += 1) {
      const hue = (y / (height - 1)) * 360;
      const [r, g, b] = hsvToRgb(hue, 100, 100);
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      }
    }

    hueCtx.putImageData(imageData, 0, 0);
    drawHueCursor();
  }

  function drawSvCursor() {
    const { width, height } = svCanvas;
    const x = (state.colors[getTarget()].s / 100) * (width - 1);
    const y = (1 - state.colors[getTarget()].v / 100) * (height - 1);
    svCtx.save();
    svCtx.strokeStyle = '#fff';
    svCtx.lineWidth = 2;
    svCtx.beginPath();
    svCtx.arc(x, y, 7, 0, Math.PI * 2);
    svCtx.stroke();
    svCtx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    svCtx.lineWidth = 1;
    svCtx.stroke();
    svCtx.restore();
  }

  function drawHueCursor() {
    const { width, height } = hueCanvas;
    const y = (state.colors[getTarget()].h / 360) * (height - 1);
    hueCtx.save();
    hueCtx.strokeStyle = '#fff';
    hueCtx.lineWidth = 2;
    hueCtx.beginPath();
    hueCtx.moveTo(0, y);
    hueCtx.lineTo(width, y);
    hueCtx.stroke();
    hueCtx.restore();
  }

  function onColorChange() {
    drawSvPlane();
    drawHueStrip();
    updateHexInput();
    scheduleRender();
  }

  function refreshPicker() {
    drawSvPlane();
    drawHueStrip();
    updateHexInput();
  }

  function bindDrag(canvasEl, onMove) {
    const handlePointer = (event) => {
      const rect = canvasEl.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * canvasEl.width;
      const py = ((event.clientY - rect.top) / rect.height) * canvasEl.height;
      onMove(px, py);
    };

    canvasEl.addEventListener('pointerdown', (event) => {
      canvasEl.setPointerCapture(event.pointerId);
      handlePointer(event);
    });

    canvasEl.addEventListener('pointermove', (event) => {
      if (!canvasEl.hasPointerCapture(event.pointerId)) return;
      handlePointer(event);
    });
  }

  bindDrag(svCanvas, (x, y) => {
    const { width, height } = svCanvas;
    const target = getTarget();
    state.colors[target].s = Math.max(0, Math.min(100, (x / (width - 1)) * 100));
    state.colors[target].v = Math.max(0, Math.min(100, (1 - y / (height - 1)) * 100));
    onColorChange();
  });

  bindDrag(hueCanvas, (_x, y) => {
    const { height } = hueCanvas;
    const target = getTarget();
    state.colors[target].h = Math.max(0, Math.min(360, (y / (height - 1)) * 360));
    onColorChange();
  });

  if (hexInput) {
    hexInput.addEventListener('input', () => {
      if (applyHexInput()) {
        onColorChange();
      }
    });

    hexInput.addEventListener('change', () => {
      if (!applyHexInput({ commitInvalid: true })) return;
      onColorChange();
    });
  }

  drawSvPlane();
  drawHueStrip();
  updateHexInput();

  return { refresh: refreshPicker };
}

function loadFileAsImage(file, onLoad) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

photoInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    state.photo = null;
    scheduleRender();
    return;
  }

  loadFileAsImage(file, (img) => {
    state.photo = img;
    scheduleRender();
  });
});

nameInput.addEventListener('input', (event) => {
  state.name = event.target.value;
  scheduleRender();
});

bgImageInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  loadFileAsImage(file, (img) => {
    state.backgroundImage = img;
    clearBgImageBtn.hidden = false;
    scheduleRender();
  });
});

clearBgImageBtn.addEventListener('click', () => {
  state.backgroundImage = null;
  bgImageInput.value = '';
  clearBgImageBtn.hidden = true;
  scheduleRender();
});

companyTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-company]');
  if (!button) return;

  const company = button.dataset.company;
  state.company = state.company === company ? null : company;

  companyTabs.querySelectorAll('[data-company]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.company === state.company);
  });

  scheduleRender();
});

downloadBtn.addEventListener('click', async () => {
  try {
    await render();
    const link = document.createElement('a');
    link.download = getNextDownloadFilename();
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error(error);
  }
});

const colorPicker = colorPickerRoot ? createColorPicker(colorPickerRoot) : null;
initColorTabs(() => colorPicker?.refresh());
scheduleRender();

if (window.location.protocol === 'file:') {
  const warning = document.getElementById('fileWarning');
  if (warning) warning.hidden = false;
}
