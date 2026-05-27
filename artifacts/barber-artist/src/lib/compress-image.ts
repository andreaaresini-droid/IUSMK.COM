/**
 * Compressione immagini lato client via Canvas API.
 *
 * PERCHÉ: riduce il payload di upload del 70-95% prima che il file
 * venga inviato al server → upload molto più veloci anche su mobile.
 *
 * LOGICA:
 * - Ridimensiona a maxWidth (default 1200px) preservando aspect ratio
 * - Codifica come JPEG a qualità 0.78
 * - Scarta la versione compressa se pesa di più dell'originale
 * - Restituisce sempre un File valido (fallback = originale)
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1200,
  quality = 0.78,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Se l'immagine è già piccola non serve ricomprimere
      if (img.width <= maxWidth && file.size < 300 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, "");
          const compressed = new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          console.log(
            `[compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB` +
            ` (−${Math.round((1 - compressed.size / file.size) * 100)}%)`,
          );
          resolve(compressed);
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
