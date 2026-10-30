/**
 * Automatically resize an image file in the browser using HTML5 Canvas.
 * Produces an optimized, crisp JPEG Data URL (~40-80KB) preventing payload limits.
 *
 * @param {File} file - Browser File object
 * @param {number} maxWidth - Maximum bounding box width (default 600)
 * @param {number} maxHeight - Maximum bounding box height (default 600)
 * @param {number} quality - JPEG compression quality (0.0 to 1.0, default 0.86)
 * @returns {Promise<string>} Base64 Data URL
 */
export function resizeImageFile(file, maxWidth = 600, maxHeight = 600, quality = 0.86) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided.'));
    }

    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fill background with clean white for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
