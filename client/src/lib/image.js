// تصغير الصورة بالمتصفح قبل الإرسال (أسرع وأرخص): أطول ضلع ≤ max، JPEG
export function shrinkImage(file, max = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith("image/")) return reject(new Error("not_image"));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
