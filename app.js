const TARGET_WIDTH = 3024;
const TARGET_HEIGHT = 4032;
const CAMERA_MAKE = "Meta AI";
const CAMERA_MODEL = "Ray-Ban Meta Smart Glasses 2";

const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const previewWrap = document.getElementById("previewWrap");
const metadataCard = document.getElementById("metadataCard");
const actionsCard = document.getElementById("actionsCard");
const cameraBefore = document.getElementById("cameraBefore");
const modelBefore = document.getElementById("modelBefore");
const sizeBefore = document.getElementById("sizeBefore");
const gpsBefore = document.getElementById("gpsBefore");
const generateBtn = document.getElementById("generateBtn");
const status = document.getElementById("status");

let currentFile = null;
let currentImage = null;
let previewUrl = null;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? "#ff9d9d" : "";
}

function resetPreviewUrl() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function readExif(file) {
  if (!/image\/jpeg/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
    return {};
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    const exif = piexif.load(dataUrl);
    const zeroth = exif["0th"] || {};
    const gps = exif.GPS || {};

    return {
      make: zeroth[piexif.ImageIFD.Make] || "",
      model: zeroth[piexif.ImageIFD.Model] || "",
      hasGps: Object.keys(gps).length > 0,
    };
  } catch {
    return {};
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no pudo abrir esta imagen."));
    };

    img.src = url;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("Selecciona una imagen válida.", true);
    return;
  }

  setStatus("");

  try {
    currentFile = file;
    currentImage = await loadImage(file);
    const originalExif = await readExif(file);

    resetPreviewUrl();
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;

    cameraBefore.textContent = originalExif.make || "sin datos";
    modelBefore.textContent = originalExif.model || "sin datos";
    sizeBefore.textContent = `${currentImage.naturalWidth} × ${currentImage.naturalHeight}`;
    gpsBefore.textContent = originalExif.hasGps ? "presente" : "sin GPS";

    previewWrap.classList.remove("hidden");
    metadataCard.classList.remove("hidden");
    actionsCard.classList.remove("hidden");
  } catch (error) {
    setStatus(error.message || "No se pudo procesar la imagen.", true);
  }
}

function drawCover(ctx, image, targetWidth, targetHeight) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  let sx = 0;
  let sy = 0;
  let sWidth = sourceWidth;
  let sHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    sWidth = sourceHeight * targetRatio;
    sx = (sourceWidth - sWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    sHeight = sourceWidth / targetRatio;
    sy = (sourceHeight - sHeight) / 2;
  }

  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
}

function buildMetaExif() {
  const zeroth = {};
  const exif = {};

  zeroth[piexif.ImageIFD.Make] = CAMERA_MAKE;
  zeroth[piexif.ImageIFD.Model] = CAMERA_MODEL;
  zeroth[piexif.ImageIFD.Orientation] = 1;
  zeroth[piexif.ImageIFD.XResolution] = [72, 1];
  zeroth[piexif.ImageIFD.YResolution] = [72, 1];
  zeroth[piexif.ImageIFD.ResolutionUnit] = 2;

  exif[piexif.ExifIFD.ExifVersion] = "0220";
  exif[piexif.ExifIFD.PixelXDimension] = TARGET_WIDTH;
  exif[piexif.ExifIFD.PixelYDimension] = TARGET_HEIGHT;

  return {
    "0th": zeroth,
    Exif: exif,
    GPS: {},
    "1st": {},
    thumbnail: null,
  };
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

async function generateStampedImage() {
  if (!currentFile || !currentImage) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Generando…";
  setStatus("Procesando la imagen localmente…");

  try {
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas no está disponible en este navegador.");

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
    drawCover(ctx, currentImage, TARGET_WIDTH, TARGET_HEIGHT);

    const cleanJpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const exifBytes = piexif.dump(buildMetaExif());
    const stampedDataUrl = piexif.insert(exifBytes, cleanJpegDataUrl);

    const blob = dataUrlToBlob(stampedDataUrl);
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const baseName = currentFile.name.replace(/\.[^.]+$/, "") || "imagen";

    anchor.href = downloadUrl;
    anchor.download = `${baseName}-spin-view.jpg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 3000);
    setStatus("✓ JPEG preparado. No lo edites antes de subirlo a Instagram.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "No se pudo generar la imagen.", true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Marcar y descargar";
  }
}

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  handleFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  handleFile(file);
});

generateBtn.addEventListener("click", generateStampedImage);
window.addEventListener("beforeunload", resetPreviewUrl);
