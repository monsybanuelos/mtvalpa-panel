/** CeluMB 40×20 mm stock label. Restored from the v3.3 generator. */

export type PhoneLabelInput = {
  stock: string;
  model: string;
  brand?: string;
  price: number | string;
  battery?: string | number | null;
  storage?: string | null;
  ram?: string | null;
};

const FONT = "'Noto Serif', 'Times New Roman', Times, serif";
const LOGO_SRC = "/celumb-label-logo.png";

let logoImg: HTMLImageElement | null = null;

export function preloadLabelLogo(): void {
  void ensureLogo();
}

function ensureLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      resolve(logoImg);
      return;
    }
    const img = new Image();
    img.onload = () => {
      logoImg = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_SRC;
  });
}

function fmtStorage(s: string): string {
  s = String(s || "").trim();
  if (!s || s === "—") return "";
  if (/gb|tb/i.test(s)) return s.toUpperCase().replace(/\s+/g, " ");
  if (/^\d+$/.test(s)) return s + " GB";
  return s;
}

function fmtRam(s: string): string {
  s = String(s || "").trim();
  if (!s || s === "—") return "";
  return s;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBattery(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#28af55";
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.fillRect(x + w, y + h * 0.25, 4, h * 0.5);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  const cx = x + w * 0.48;
  const cy = y + h * 0.5;
  ctx.moveTo(cx + 2, y + 2);
  ctx.lineTo(cx - 4, cy + 1);
  ctx.lineTo(cx + 1, cy + 1);
  ctx.lineTo(cx - 2, y + h - 2);
  ctx.lineTo(cx + 5, cy - 1);
  ctx.lineTo(cx, cy - 1);
  ctx.closePath();
  ctx.fill();
}

function moneyLabel(n: number | string): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("empty png"));
      else resolve(blob);
    }, "image/png");
  });
}

/** Share sheet on iPhone; download when share is unavailable. User cancel stays quiet. */
export async function saveOrSharePng(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === "function";
  if (canShare) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name === "AbortError" || name === "NotAllowedError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function generatePhoneLabel(input: PhoneLabelInput): Promise<void> {
  const W = 480;
  const H = 240;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();

  const model = (input.model || "").trim() || "Equipo";
  const brand = (input.brand || "").trim();
  let modelShown = model;
  if (brand && !model.toLowerCase().includes(brand.toLowerCase().slice(0, 4))) {
    modelShown = model;
  }
  const stock = (input.stock || "").trim();
  const storage = fmtStorage(String(input.storage || ""));
  const ram = fmtRam(String(input.ram || ""));
  const batRaw =
    input.battery == null ? "" : String(input.battery).trim();
  const battery = batRaw && batRaw !== "—" ? batRaw.replace(/%/g, "").trim() : "";
  const price = moneyLabel(input.price);

  const pad = 8;
  const leftMax = W * 0.62;
  ctx.fillStyle = "#121212";
  ctx.textBaseline = "top";

  let modelSize = 72;
  ctx.font = "700 " + modelSize + "px " + FONT;
  while (modelSize > 40 && ctx.measureText(modelShown).width > leftMax - pad) {
    modelSize -= 2;
    ctx.font = "700 " + modelSize + "px " + FONT;
  }
  ctx.fillText(modelShown, pad, 4);

  const stockSize = Math.max(34, Math.round(modelSize * 0.58));
  ctx.font = "600 " + stockSize + "px " + FONT;
  const stockY = 4 + modelSize - 2;
  ctx.fillText(stock, pad, stockY);

  const img = await ensureLogo();
  if (img) {
    let logoH = 150;
    let logoW = img.width * (logoH / img.height);
    if (logoW > W * 0.38) {
      logoW = W * 0.38;
      logoH = img.height * (logoW / img.width);
    }
    ctx.drawImage(img, W - logoW - 4, 4, logoW, logoH);
  }

  const priceSize = 62;
  const specSize = 40;
  const batIconW = 40;
  const batIconH = 22;
  const bottomY = H - priceSize - 6;
  const midY = stockY + stockSize + 6;
  if (ram) {
    const ramLabel = /ram/i.test(ram) ? ram : ram + " RAM";
    ctx.fillStyle = "#121212";
    ctx.font = "600 34px " + FONT;
    ctx.fillText(ramLabel, pad, Math.min(midY, bottomY - 44));
  }
  let sx = pad;
  ctx.font = "600 " + specSize + "px " + FONT;
  ctx.fillStyle = "#121212";
  if (storage) {
    ctx.fillText(storage, sx, bottomY);
    sx += ctx.measureText(storage).width + 10;
  }
  if (battery) {
    drawBattery(
      ctx,
      sx,
      bottomY + Math.round((specSize - batIconH) / 2) + 2,
      batIconW,
      batIconH,
    );
    sx += batIconW + 8;
    ctx.fillStyle = "#121212";
    ctx.fillText(battery + " %", sx, bottomY);
  }

  ctx.fillStyle = "#121212";
  let pSize = priceSize;
  ctx.font = "700 " + pSize + "px " + FONT;
  let pw = ctx.measureText(price).width;
  while (pSize > 40 && pw > W * 0.48) {
    pSize -= 2;
    ctx.font = "700 " + pSize + "px " + FONT;
    pw = ctx.measureText(price).width;
  }
  ctx.fillText(price, W - pw - pad, H - pSize - 4);

  const filename = (stock || "stock") + ".png";
  const blob = await canvasToPng(canvas);
  await saveOrSharePng(blob, filename);
}
