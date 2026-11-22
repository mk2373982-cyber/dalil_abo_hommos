import { useEffect } from 'react';

const DEFAULT_TITLE = 'دليل أبوحمص — الدليل والخدمات اليومية لأهالي أبوحمص';
const DEFAULT_DESC =
  'الدليل الرسمي والخدمات اليومية لأهالي مركز ومدينة أبوحمص والقرى المجاورة: أطباء، صيدليات، مطاعم، حرفيين، عقارات، دليفري، وعروض يومية.';

function setMetaTag(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute('content', content);
}

/**
 * Updates document title and OpenGraph/Twitter meta tags dynamically per view.
 */
export function usePageSeo(title?: string, description?: string) {
  useEffect(() => {
    const fullTitle = title ? `${title} | دليل أبوحمص` : DEFAULT_TITLE;
    const desc = description?.trim() || DEFAULT_DESC;

    document.title = fullTitle;
    setMetaTag('meta[name="description"]', desc);
    setMetaTag('meta[property="og:title"]', fullTitle);
    setMetaTag('meta[property="og:description"]', desc);
    setMetaTag('meta[name="twitter:title"]', fullTitle);
    setMetaTag('meta[name="twitter:description"]', desc);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('meta[name="description"]', DEFAULT_DESC);
      setMetaTag('meta[property="og:title"]', DEFAULT_TITLE);
      setMetaTag('meta[property="og:description"]', DEFAULT_DESC);
      setMetaTag('meta[name="twitter:title"]', DEFAULT_TITLE);
      setMetaTag('meta[name="twitter:description"]', DEFAULT_DESC);
    };
  }, [title, description]);
}

export interface ShareCardOptions {
  title: string;
  subtitle?: string;
  area?: string;
  phone?: string;
  code?: string;
  badge?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * Generates and downloads a 1080x1080 emerald-and-gold Arabic PNG card ready for WhatsApp Status / Facebook.
 * 100% client-side HTML5 Canvas — zero server load.
 */
export function downloadShareablePlaceCard(opts: ShareCardOptions): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Emerald civic background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#062c22');
    bgGrad.addColorStop(0.55, '#0F5132');
    bgGrad.addColorStop(1, '#083a27');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Subtle decorative geometric glows
    ctx.fillStyle = 'rgba(212, 160, 23, 0.14)';
    ctx.beginPath();
    ctx.arc(140, 160, 210, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.beginPath();
    ctx.arc(960, 920, 250, 0, Math.PI * 2);
    ctx.fill();

    // Inner framed white card
    drawRoundedRect(ctx, 76, 170, 928, 720, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Top gold accent strip inside card
    drawRoundedRect(ctx, 76, 170, 928, 18, 12);
    ctx.fillStyle = '#D4A017';
    ctx.fill();

    // Header brand text
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE68A';
    ctx.font = '800 44px Cairo, Tajawal, sans-serif';
    ctx.fillText('دليل أبوحمص الشامل', 540, 112);

    // Category / badge pill
    const badgeText = opts.badge || opts.subtitle || 'خدمة معتمدة في أبوحمص';
    ctx.font = '700 30px Cairo, Tajawal, sans-serif';
    const badgeWidth = Math.min(720, ctx.measureText(badgeText).width + 80);
    drawRoundedRect(ctx, 540 - badgeWidth / 2, 236, badgeWidth, 64, 32);
    ctx.fillStyle = '#ECFDF5';
    ctx.fill();
    ctx.fillStyle = '#0F5132';
    ctx.fillText(badgeText.slice(0, 34), 540, 279);

    // Main Place / Doctor / Restaurant Title
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 58px Cairo, Tajawal, sans-serif';
    const titleLines = wrapTextLines(ctx, opts.title, 820, 2);
    let y = 395;
    for (const line of titleLines) {
      ctx.fillText(line, 540, y);
      y += 76;
    }

    // Subtitle if badge was separate
    if (opts.subtitle && opts.badge && opts.subtitle !== opts.badge) {
      ctx.fillStyle = '#475569';
      ctx.font = '600 32px Cairo, Tajawal, sans-serif';
      ctx.fillText(opts.subtitle.slice(0, 46), 540, y + 10);
      y += 58;
    }

    // Divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, y + 20);
    ctx.lineTo(900, y + 20);
    ctx.stroke();

    // Details rows (Area + Phone)
    let detailY = y + 92;
    if (opts.area) {
      ctx.fillStyle = '#334155';
      ctx.font = '700 34px Cairo, Tajawal, sans-serif';
      ctx.fillText(`العنوان / المنطقة: ${opts.area}`, 540, detailY);
      detailY += 66;
    }

    if (opts.phone) {
      drawRoundedRect(ctx, 210, detailY - 46, 660, 84, 24);
      ctx.fillStyle = '#0F5132';
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 40px Cairo, Tajawal, sans-serif';
      ctx.fillText(`للتواصل: ${opts.phone}`, 540, detailY + 10);
      detailY += 96;
    }

    // Code badge at bottom of white card
    if (opts.code) {
      ctx.fillStyle = '#64748B';
      ctx.font = '700 28px Cairo, Tajawal, sans-serif';
      ctx.fillText(`كود الدليل: ${opts.code}`, 540, 838);
    }

    // Footer bar
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 28px Cairo, Tajawal, sans-serif';
    ctx.fillText('ابحث عنا داخل تطبيق «دليل أبوحمص» — خدمات مركز ومدينة أبوحمص', 540, 976);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `dalil-abuhoms-${(opts.code || 'card').replace(/[^a-zA-Z0-9_-]/g, '')}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
}
