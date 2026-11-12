"use client";

// Turns a customer's photo into the small JPEGs the claims API accepts:
// a ~1280 px version for the assessor and a tiny thumbnail for the office.

export interface PreparedPhoto {
  mediaType: "image/jpeg";
  base64: string;
  /** Data URL of the full image, for the preview. */
  preview: string;
  /** Data URL of a 160 px thumbnail, stored with the claim. */
  thumbnail: string;
}

const MAX_INPUT_BYTES = 20 * 1024 * 1024;

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That file couldn't be read as a photo. Try a JPEG or PNG.");
  }
}

function toJpeg(image: ImageBitmap, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That photo is over 20 MB. Please choose a smaller one.");
  const image = await decode(file);
  try {
    const preview = toJpeg(image, 1280, 0.85);
    return {
      mediaType: "image/jpeg",
      base64: preview.slice(preview.indexOf(",") + 1),
      preview,
      thumbnail: toJpeg(image, 160, 0.7),
    };
  } finally {
    image.close();
  }
}

/**
 * A sample "damaged frames" photo for people testing the care desk without a
 * broken pair at hand: glasses on a wooden table with a scratched left lens.
 */
export async function sampleDamagePhoto(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext("2d")!;

  // Warm wooden table with a little grain.
  const wood = ctx.createLinearGradient(0, 0, 0, 900);
  wood.addColorStop(0, "#a8784c");
  wood.addColorStop(1, "#7a5332");
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, 1200, 900);
  ctx.globalAlpha = 0.12;
  for (let y = 0; y < 900; y += 9) {
    ctx.strokeStyle = y % 27 === 0 ? "#4a2f1a" : "#c8996a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y) * 4);
    ctx.bezierCurveTo(400, y + 10, 800, y - 10, 1200, y + Math.cos(y) * 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Soft shadow, then the frame: two rounded lenses, bridge and temples.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.filter = "blur(18px)";
  ctx.beginPath();
  ctx.ellipse(600, 560, 420, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = "none";

  const lens = (cx: number) => {
    ctx.beginPath();
    ctx.roundRect(cx - 170, 330, 340, 230, 90);
  };
  for (const cx of [390, 810]) {
    lens(cx);
    ctx.fillStyle = "rgba(225, 236, 242, 0.35)";
    ctx.fill();
    ctx.lineWidth = 26;
    ctx.strokeStyle = "#1b1b1f";
    ctx.stroke();
  }
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(560, 400);
  ctx.quadraticCurveTo(600, 370, 640, 400);
  ctx.stroke();
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(222, 380);
  ctx.lineTo(120, 300);
  ctx.moveTo(978, 380);
  ctx.lineTo(1080, 300);
  ctx.stroke();

  // Reflections on both lenses, then a light surface scratch on the left one.
  // It is smooth and thin on purpose: a jagged, branching line reads as a crack.
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(300, 380);
  ctx.lineTo(340, 360);
  ctx.moveTo(720, 380);
  ctx.lineTo(760, 360);
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(276, 398);
  ctx.quadraticCurveTo(372, 430, 486, 508);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(306, 428);
  ctx.quadraticCurveTo(372, 452, 430, 492);
  ctx.stroke();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not draw the sample."))),
      "image/jpeg",
      0.9,
    ),
  );
}
