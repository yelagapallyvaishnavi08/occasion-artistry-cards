import { deliverFile } from "./download";

export type CardData = {
  occasion: string;
  headline: string;
  message: string;
  sender?: string;
  imageDataUrl: string;
};

const W = 1200;
const H = 1680;
const CREAM = "#fbf5e9";
const INK = "#463227";
const BURGUNDY = "#8c3a4a";
const GOLD = "#c49a45";
const GOLD_DARK = "#a67c2e";

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 88px "Fraunces"'),
      document.fonts.load('italic 600 40px "Fraunces"'),
      document.fonts.load('400 36px "Karla"'),
      document.fonts.load('700 28px "Karla"'),
    ]);
  } catch {
    // fall back to serif/sans defaults if webfonts are unavailable
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "greeting-card"
  );
}

async function buildCardCanvas(data: CardData): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 1. Artwork, cover-cropped to the full card.
  const img = await loadImage(data.imageDataUrl);
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // 2. Occasion chip over the artwork.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 28px "Karla"';
  ctx.letterSpacing = "8px";
  const label = data.occasion.toUpperCase();
  const labelW = ctx.measureText(label).width;
  const chipW = labelW + 88;
  const chipH = 62;
  const chipX = (W - chipW) / 2;
  const chipY = 88;
  ctx.fillStyle = "rgba(48, 29, 25, 0.55)";
  roundedRect(ctx, chipX, chipY, chipW, chipH, 31);
  ctx.fill();
  ctx.fillStyle = "#faf3e2";
  ctx.fillText(label, W / 2, chipY + chipH / 2 + 2);
  ctx.letterSpacing = "0px";

  // 3. Cream message panel.
  const px = 64;
  const pw = W - 128;
  const py = 1012;
  const ph = H - py - 58;
  ctx.save();
  ctx.shadowColor = "rgba(56, 32, 24, 0.4)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = CREAM;
  roundedRect(ctx, px, py, pw, ph, 30);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(196, 154, 69, 0.55)";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, px + 18, py + 18, pw - 36, ph - 36, 20);
  ctx.stroke();

  // 4. Headline.
  ctx.textBaseline = "alphabetic";
  const maxTextW = pw - 144;
  let fontSize = 88;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `700 ${fontSize}px "Fraunces"`;
    lines = wrap(ctx, data.headline, maxTextW);
    if (lines.length <= 2 || fontSize <= 54) break;
    fontSize -= 6;
  }
  lines = lines.slice(0, 2);
  const headlineBaseline = py + 96 + fontSize;
  const headlineStep = fontSize * 1.12;
  ctx.fillStyle = BURGUNDY;
  lines.forEach((line, i) => ctx.fillText(line, W / 2, headlineBaseline + i * headlineStep));
  const dividerY = headlineBaseline + (lines.length - 1) * headlineStep + 42;

  // 5. Gold divider with a diamond.
  ctx.strokeStyle = "rgba(196, 154, 69, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 130, dividerY);
  ctx.lineTo(W / 2 - 26, dividerY);
  ctx.moveTo(W / 2 + 26, dividerY);
  ctx.lineTo(W / 2 + 130, dividerY);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.save();
  ctx.translate(W / 2, dividerY);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-7, -7, 14, 14);
  ctx.restore();

  // 6. Message, auto-shrunk to fit above the signature line.
  let msgFont = 36;
  let msgLines: string[] = [];
  const msgTop = dividerY + 48;
  const msgBottom = py + ph - 106;
  for (;;) {
    ctx.font = `400 ${msgFont}px "Karla"`;
    msgLines = wrap(ctx, data.message, pw - 176);
    if (msgTop + msgLines.length * msgFont * 1.5 <= msgBottom || msgFont <= 28) break;
    msgFont -= 2;
  }
  const lineH = msgFont * 1.5;
  const maxLines = Math.max(3, Math.floor((msgBottom - msgTop) / lineH));
  if (msgLines.length > maxLines) {
    msgLines = msgLines.slice(0, maxLines);
    msgLines[maxLines - 1] = `${msgLines[maxLines - 1]}…`;
  }
  ctx.fillStyle = INK;
  msgLines.forEach((line, i) => ctx.fillText(line, W / 2, msgTop + i * lineH));

  // 7. Signature.
  if (data.sender) {
    ctx.font = 'italic 600 40px "Fraunces"';
    ctx.fillStyle = GOLD_DARK;
    ctx.textAlign = "right";
    ctx.fillText(`— with love, ${data.sender}`, px + pw - 76, py + ph - 62);
    ctx.textAlign = "center";
  }

  // 8. Gold frame.
  ctx.strokeStyle = "rgba(198, 156, 66, 0.95)";
  ctx.lineWidth = 3;
  roundedRect(ctx, 24, 24, W - 48, H - 48, 20);
  ctx.stroke();
  ctx.strokeStyle = "rgba(198, 156, 66, 0.45)";
  ctx.lineWidth = 1;
  roundedRect(ctx, 38, 38, W - 76, H - 76, 14);
  ctx.stroke();

  return canvas;
}

export async function renderCard(data: CardData): Promise<string> {
  const canvas = await buildCardCanvas(data);
  return canvas.toDataURL("image/png");
}

export async function cardToBlob(data: CardData): Promise<Blob> {
  const canvas = await buildCardCanvas(data);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png"),
  );
}

export async function downloadCardPng(data: CardData): Promise<void> {
  const blob = await cardToBlob(data);
  await deliverFile(blob, `${slugify(data.occasion)}-greeting-card.png`);
}

export async function downloadCardPdf(data: CardData): Promise<void> {
  const blob = await cardToBlob(data);
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([360, 504]); // 5 x 7 inches
  const png = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
  page.drawImage(png, { x: 0, y: 0, width: 360, height: 504 });
  const out = await pdf.save();
  await deliverFile(
    new Blob([out as unknown as BlobPart], { type: "application/pdf" }),
    `${slugify(data.occasion)}-greeting-card.pdf`,
  );
}
