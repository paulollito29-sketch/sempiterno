/**
 * Compresses and resizes an image file in the browser using HTML5 Canvas.
 * Produces a lightweight, high-resolution JPEG DataURL (~80-200KB)
 * that loads instantly, bypasses storage bucket requirements,
 * and saves seamlessly to Supabase and LocalStorage.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.onload = (readerEvent) => {
      const img = new window.Image();
      img.onerror = () => {
        // If image object fails to decode, fallback to the raw data URL
        resolve(readerEvent.target?.result as string);
      };
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale proportionally down to maxWidth
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target?.result as string);
            return;
          }

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Export as JPEG with chosen quality
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch {
          // If canvas tainted or memory issue, fallback to raw reader result
          resolve(readerEvent.target?.result as string);
        }
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
