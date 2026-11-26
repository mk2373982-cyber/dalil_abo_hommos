const CLOUD_NAME = 'i5ye3vg6';
const UPLOAD_PRESET = 'dalil_uploads';
const MAX_INPUT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB raw input limit

/**
 * تحويل أي صورة يختارها المستخدم إلى صيغة WebP وضغطها على جهاز العميل قبل الرفع
 * بحد أقصى للعرض 1200px وجودة 0.8
 */
export async function convertToWebP(
  file: File,
  maxWidth = 1200,
  quality = 0.8
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG أو PNG أو WebP)');
  }
  if (file.size > MAX_INPUT_SIZE_BYTES) {
    throw new Error('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 15 ميجابايت');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (!width || !height) {
        reject(new Error('تعذر قراءة أبعاد الصورة'));
        return;
      }

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('تعذر تجهيز الصورة للضغط'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            reject(new Error('فشل تحويل الصورة إلى صيغة WebP'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('ملف الصورة غير صالح أو تالف'));
    };

    img.src = objectUrl;
  });
}

/**
 * ضغط الصورة وتحويلها إلى WebP ثم رفعها مباشرة إلى Cloudinary وإرجاع رابط secure_url
 */
export async function uploadImageToCloudinary(
  file: File,
  options?: { maxWidth?: number; quality?: number }
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 1200;
  const quality = options?.quality ?? 0.8;

  const webpBlob = await convertToWebP(file, maxWidth, quality);
  const formData = new FormData();
  const safeBaseName =
    file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60) || 'image';

  formData.append('file', webpBlob, `${safeBaseName}.webp`);
  formData.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      detail = errBody?.error?.message || '';
    } catch {
      // ignore json parse error
    }
    throw new Error(
      detail
        ? `فشل رفع الصورة إلى السحابة (${detail})`
        : 'فشل رفع الصورة، يرجى التحقق من الإنترنت والمحاولة مرة أخرى'
    );
  }

  const data = (await response.json()) as { secure_url?: string };
  if (!data.secure_url || typeof data.secure_url !== 'string') {
    throw new Error('لم يتم استلام رابط الصورة بعد الرفع، يرجى المحاولة مرة أخرى');
  }

  return data.secure_url;
}