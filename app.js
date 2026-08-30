const TARGET_WIDTH = 3024;
const TARGET_HEIGHT = 4032;
const CAMERA_MAKE = "Meta AI";
const CAMERA_MODEL = "Ray-Ban Meta Smart Glasses 2";
const MAX_FILE_SIZE = 30 * 1024 * 1024;

const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const previewWrap = document.getElementById("previewWrap");
const metadataCard = document.getElementById("metadataCard");
const outputCard = document.getElementById("outputCard");
const actionsCard = document.getElementById("actionsCard");
const cameraBefore = document.getElementById("cameraBefore");
const modelBefore = document.getElementById("modelBefore");
const sizeBefore = document.getElementById("sizeBefore");
const gpsBefore = document.getElementById("gpsBefore");
const generateBtn = document.getElementById("generateBtn");
const changeBtn = document.getElementById("changeBtn");
const status = document.getElementById("status");

let currentFile = null;
let currentImage = null;
let previewUrl = null;
let selectionId = 0;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setReady(ready) {
  [metadataCard, outputCard, actionsCard].forEach((element) => element.classList.toggle("locked", !ready));
  generateBtn.disabled = !ready;
}

function resetPreviewUrl() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function fileToArrayBuffer(file) {
  return file.arrayBuffer ? file.arrayBuffer() : new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

function readAscii(view, offset, count) {
  let value = "";
  for (let index = 0; index < count; index += 1) {
    const byte = view.getUint8(offset + index);
    if (byte === 0) break;
    value += String.fromCharCode(byte);
  }
  return value;
}

function readOriginalExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && length >= 8 && readAscii(view, offset + 4, 6) === "Exif") {
      try { return parseTiff(view, offset + 10); } catch { return {}; }
    }
    offset += 2 + length;
  }
  return {};
}

function parseTiff(view, tiffStart) {
  const byteOrder = view.getUint16(tiffStart);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return {};
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {};
  const ifdStart = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
  const count = view.getUint16(ifdStart, littleEndian);
  const result = { make: "", model: "", hasGps: false };
  for (let index = 0; index < count; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const valueCount = view.getUint32(entry + 4, littleEndian);
    const valueOffset = valueCount <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, littleEndian);
    if ((tag === 0x010f || tag === 0x0110) && type === 2) {
      const value = readAscii(view, valueOffset, valueCount);
      if (tag === 0x010f) result.make = value;
      if (tag === 0x0110) result.model = value;
    }
    if (tag === 0x8825) result.hasGps = true;
  }
  return result;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("El navegador no pudo abrir esta imagen.")); };
    image.src = url;
  });
}

function isSupportedImage(file) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

async function handleFile(file) {
  const requestId = ++selectionId;
  setStatus("");
  setReady(false);
  if (!file || !isSupportedImage(file)) {
    setStatus("Selecciona una imagen JPEG, PNG o WebP válida.", true);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    setStatus("La imagen supera el límite de 30 MB.", true);
    return;
  }
  try {
    const [image, originalExif] = await Promise.all([
      loadImage(file),
      /image\/jpeg/i.test(file.type) || /\.jpe?g$/i.test(file.name)
        ? fileToArrayBuffer(file).then(readOriginalExif)
        : Promise.resolve({}),
    ]);
    if (requestId !== selectionId) return;
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("La imagen no tiene dimensiones válidas.");
    currentFile = file;
    currentImage = image;
    resetPreviewUrl();
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    cameraBefore.textContent = originalExif.make || "Desconocida";
    modelBefore.textContent = originalExif.model || "Desconocido";
    sizeBefore.textContent = `${image.naturalWidth} × ${image.naturalHeight}`;
    gpsBefore.textContent = originalExif.hasGps ? "Presente" : "Sin GPS";
    dropzone.classList.add("hidden");
    previewWrap.classList.remove("hidden");
    setReady(true);
  } catch (error) {
    currentFile = null;
    currentImage = null;
    setStatus(error.message || "No se pudo procesar la imagen.", true);
  }
}

function drawCover(ctx, image, targetWidth, targetHeight) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = targetWidth / targetHeight;
  let sx = 0;
  let sy = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sourceWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    sourceHeight = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sourceHeight) / 2;
  }
  ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
}

function writeEntry(view, offset, tag, type, count, value) {
  view.setUint16(offset, tag, true);
  view.setUint16(offset + 2, type, true);
  view.setUint32(offset + 4, count, true);
  if (type === 3 && count === 1) {
    view.setUint16(offset + 8, value, true);
    view.setUint16(offset + 10, 0, true);
  } else if (type === 7 && count === 4) {
    for (let index = 0; index < 4; index += 1) view.setUint8(offset + 8 + index, value.charCodeAt(index));
  } else {
    view.setUint32(offset + 8, value, true);
  }
}

function asciiBytes(value) {
  return Uint8Array.from([...value, "\0"], (character) => character.charCodeAt(0));
}

function buildExifSegment() {
  const make = asciiBytes(CAMERA_MAKE);
  const model = asciiBytes(CAMERA_MODEL);
  const ifd0Start = 8;
  const ifd0Entries = 7;
  let dataOffset = ifd0Start + 2 + ifd0Entries * 12 + 4;
  const makeOffset = dataOffset; dataOffset += make.length;
  const modelOffset = dataOffset; dataOffset += model.length;
  if (dataOffset % 2) dataOffset += 1;
  const xResolutionOffset = dataOffset; dataOffset += 8;
  const yResolutionOffset = dataOffset; dataOffset += 8;
  const exifIfdOffset = dataOffset;
  const exifEntries = 3;
  const tiffSize = exifIfdOffset + 2 + exifEntries * 12 + 4;
  const payloadSize = 6 + tiffSize;
  const segment = new Uint8Array(4 + payloadSize);
  const view = new DataView(segment.buffer);
  view.setUint16(0, 0xffe1);
  view.setUint16(2, payloadSize + 2);
  "Exif".split("").forEach((character, index) => view.setUint8(4 + index, character.charCodeAt(0)));
  const tiffStart = 10;
  view.setUint16(tiffStart, 0x4949);
  view.setUint16(tiffStart + 2, 42, true);
  view.setUint32(tiffStart + 4, ifd0Start, true);
  view.setUint16(tiffStart + ifd0Start, ifd0Entries, true);
  let entry = tiffStart + ifd0Start + 2;
  writeEntry(view, entry, 0x010f, 2, make.length, makeOffset); entry += 12;
  writeEntry(view, entry, 0x0110, 2, model.length, modelOffset); entry += 12;
  writeEntry(view, entry, 0x0112, 3, 1, 1); entry += 12;
  writeEntry(view, entry, 0x011a, 5, 1, xResolutionOffset); entry += 12;
  writeEntry(view, entry, 0x011b, 5, 1, yResolutionOffset); entry += 12;
  writeEntry(view, entry, 0x0128, 3, 1, 2); entry += 12;
  writeEntry(view, entry, 0x8769, 4, 1, exifIfdOffset); entry += 12;
  view.setUint32(entry, 0, true);
  segment.set(make, tiffStart + makeOffset);
  segment.set(model, tiffStart + modelOffset);
  view.setUint32(tiffStart + xResolutionOffset, 72, true);
  view.setUint32(tiffStart + xResolutionOffset + 4, 1, true);
  view.setUint32(tiffStart + yResolutionOffset, 72, true);
  view.setUint32(tiffStart + yResolutionOffset + 4, 1, true);
  view.setUint16(tiffStart + exifIfdOffset, exifEntries, true);
  entry = tiffStart + exifIfdOffset + 2;
  writeEntry(view, entry, 0x9000, 7, 4, "0220"); entry += 12;
  writeEntry(view, entry, 0xa002, 4, 1, TARGET_WIDTH); entry += 12;
  writeEntry(view, entry, 0xa003, 4, 1, TARGET_HEIGHT); entry += 12;
  view.setUint32(entry, 0, true);
  return segment;
}

async function addExifToJpeg(jpegBlob) {
  const header = new Uint8Array(await jpegBlob.slice(0, 2).arrayBuffer());
  if (header[0] !== 0xff || header[1] !== 0xd8) throw new Error("La salida no es un JPEG válido.");
  return new Blob([jpegBlob.slice(0, 2), buildExifSegment(), jpegBlob.slice(2)], { type: "image/jpeg" });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo generar el JPEG.")), "image/jpeg", 0.95);
  });
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 3000);
}

async function shareOrDownload(stampedBlob, fileName) {
  if (
    typeof File === "function" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  ) {
    const file = new File([stampedBlob], fileName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    const shareData = { files: [file], title: "Spin View image" };
    let canShareFile = false;

    try {
      canShareFile = navigator.canShare({ files: [file] });
    } catch {
      canShareFile = false;
    }

    if (canShareFile) {
      try {
        setStatus("Imagen lista. Abriendo opciones para guardar…");
        await navigator.share(shareData);
        setStatus("✓ Imagen lista.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          setStatus("Imagen lista.");
          return;
        }
        console.warn("No se pudo abrir la hoja de compartir. Se usará la descarga.", error);
      }
    }
  }

  downloadBlob(stampedBlob, fileName);
  setStatus("✓ JPEG descargado. No lo edites antes de subirlo a Instagram.");
}

async function generateStampedImage() {
  if (!currentFile || !currentImage) return;
  generateBtn.disabled = true;
  generateBtn.textContent = "Preparando…";
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
    const jpegBlob = await canvasToBlob(canvas);
    const stampedBlob = await addExifToJpeg(jpegBlob);
    const baseName = currentFile.name.replace(/\.[^.]+$/, "") || "imagen";
    await shareOrDownload(stampedBlob, `${baseName}-spin-view.jpg`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "No se pudo generar la imagen.", true);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span aria-hidden="true">↓</span> Preparar y guardar';
  }
}

fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
changeBtn.addEventListener("click", () => fileInput.click());
["dragenter", "dragover"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.add("dragover"); }));
["dragleave", "drop"].forEach((name) => dropzone.addEventListener(name, (event) => { event.preventDefault(); dropzone.classList.remove("dragover"); }));
dropzone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
generateBtn.addEventListener("click", generateStampedImage);
window.addEventListener("beforeunload", resetPreviewUrl);
