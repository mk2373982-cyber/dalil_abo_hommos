const CLOUD_NAME = 'i5ye3vg6';
const UPLOAD_PRESET = 'dalil_uploads';

/**
 * تحويل أي صورة إلى صيغة WebP وضغطها على جهاز العميل قبل الرفع
 */
async function convertToWebP(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('تعذر تجهيز الصورة'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('فشل تحويل الصورة إلى WebP'));
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('ملف الصورة غير صالح'));
    };

    img.src = objectUrl;
  });
}

/**
 * تحويل الصورة إلى WebP ثم رفعها مباشرة إلى Cloudinary وإرجاع الرابط
 */
export async function uploadImageToCloudinary(file: File): Promise<string> {
  const webpBlob = await convertToWebP(file);
  const formData = new FormData();
  const baseName = file.name.replace(/\.[^/.]+$/, '');

  formData.append('file', webpBlob, `${baseName}.webp`);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('فشل رفع الصورة، يرجى المحاولة مرة أخرى');
  }

  const data = await response.json();
  return data.secure_url as string;
}