import React from 'react';
import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  CakeSlice,
  Camera,
  Car,
  Coffee,
  Droplets,
  Dumbbell,
  Eye,
  Fish,
  Flame,
  Flower2,
  Gem,
  GraduationCap,
  Hammer,
  HeartHandshake,
  HeartPulse,
  Home,
  KeyRound,
  Landmark,
  Laptop,
  Leaf,
  Moon,
  Paintbrush,
  PawPrint,
  Pill,
  Plane,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Smile,
  Sofa,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Tag,
  Truck,
  UtensilsCrossed,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface IconOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const ICON_LIBRARY: IconOption[] = [
  { key: 'stethoscope', label: 'عيادات وأطباء', icon: Stethoscope },
  { key: 'utensils', label: 'مطاعم وأكل', icon: UtensilsCrossed },
  { key: 'pill', label: 'صيدليات', icon: Pill },
  { key: 'building', label: 'عقارات', icon: Building2 },
  { key: 'hammer', label: 'حرف ومكافحين', icon: Hammer },
  { key: 'shopping-bag', label: 'سوبر ماركت', icon: ShoppingBag },
  { key: 'wrench', label: 'صيانة وأجهزة', icon: Wrench },
  { key: 'graduation-cap', label: 'تعليم ودروس', icon: GraduationCap },
  { key: 'cake', label: 'مخابز وحلويات', icon: CakeSlice },
  { key: 'shirt', label: 'ملابس وأحذية', icon: Shirt },
  { key: 'car', label: 'سيارات وقطع غيار', icon: Car },
  { key: 'home', label: 'خدمات منزلية', icon: Home },
  { key: 'coffee', label: 'كافيهات', icon: Coffee },
  { key: 'sparkles', label: 'تجميل وعرائس', icon: Sparkles },
  { key: 'scissors', label: 'حلاقة وصالون', icon: Scissors },
  { key: 'smartphone', label: 'موبايلات وإلكترونيات', icon: Smartphone },
  { key: 'truck', label: 'نقل وتوصيل', icon: Truck },
  { key: 'bike', label: 'دليفري سريع', icon: Bike },
  { key: 'shield-alert', label: 'طوارئ', icon: ShieldAlert },
  { key: 'heart-pulse', label: 'معامل وتحاليل', icon: HeartPulse },
  { key: 'heart-handshake', label: 'مبادرات خيرية', icon: HeartHandshake },
  { key: 'store', label: 'محلات تجارية', icon: Store },
  { key: 'landmark', label: 'بنوك وخدمات', icon: Landmark },
  { key: 'book-open', label: 'مكتبات وقرطاسية', icon: BookOpen },
  { key: 'zap', label: 'كهرباء وإضاءة', icon: Zap },
  { key: 'paintbrush', label: 'دهانات وديكور', icon: Paintbrush },
  { key: 'key', label: 'مفاتيح وأقفال', icon: KeyRound },
  { key: 'laptop', label: 'كمبيوتر وبرمجة', icon: Laptop },
  { key: 'camera', label: 'تصوير ومناسبات', icon: Camera },
  { key: 'flower', label: 'زهور وهدايا', icon: Flower2 },
  { key: 'baby', label: 'مستلزمات أطفال', icon: Baby },
  { key: 'eye', label: 'بصريات ونظارات', icon: Eye },
  { key: 'smile', label: 'أسنان', icon: Smile },
  { key: 'dumbbell', label: 'جيم ورياضة', icon: Dumbbell },
  { key: 'flame', label: 'غاز وبوتاجاز', icon: Flame },
  { key: 'leaf', label: 'زراعة ومشاتل', icon: Leaf },
  { key: 'tag', label: 'تخفيضات وعروض', icon: Tag },
  { key: 'star', label: 'مميز / موسمي', icon: Star },
  { key: 'moon', label: 'مواسم ورمضان', icon: Moon },
  { key: 'fish', label: 'أسماك ومأكولات بحرية', icon: Fish },
  { key: 'sofa', label: 'أثاث ومفروشات', icon: Sofa },
  { key: 'gem', label: 'ذهب ومجوهرات', icon: Gem },
  { key: 'briefcase', label: 'محاماة ومكاتب', icon: Briefcase },
  { key: 'paw-print', label: 'بيطري وأعلاف', icon: PawPrint },
  { key: 'droplets', label: 'سباكة وفلاتر مياه', icon: Droplets },
  { key: 'plane', label: 'سياحة وسفر', icon: Plane },
  { key: 'shield-check', label: 'أمن وتأمين', icon: ShieldCheck },
];

export const COLOR_PRESETS = [
  { name: 'زمردي حيوي', bg: '#e6f4ec', icon: '#0f5132' },
  { name: 'ذهبي مشرق', bg: '#fef3c7', icon: '#b45309' },
  { name: 'أزرق طبي', bg: '#e0f2fe', icon: '#0284c7' },
  { name: 'أحمر مرجاني', bg: '#fee2e2', icon: '#dc2626' },
  { name: 'بنفسجي ملكي', bg: '#f3e8ff', icon: '#7c3aed' },
  { name: 'برتقالي شهي', bg: '#ffedd5', icon: '#ea580c' },
  { name: 'أخضر ليموني', bg: '#ecfccb', icon: '#4d7c0f' },
  { name: 'فيروزي منعش', bg: '#ccfbf1', icon: '#0d9488' },
  { name: 'وردي متألق', bg: '#fce7f3', icon: '#db2777' },
  { name: 'نيلي عصري', bg: '#e0e7ff', icon: '#4338ca' },
  { name: 'عنبري دافئ', bg: '#fef9c3', icon: '#ca8a04' },
  { name: 'رمادي معدني', bg: '#f1f5f9', icon: '#334155' },
];

export function getIconComponent(key: string): LucideIcon {
  const found = ICON_LIBRARY.find((item) => item.key === key);
  return found ? found.icon : Store;
}

/** Parse 3- or 6-digit hex color to RGB tuple safely */
function parseHex(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = (hex || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return fallback;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex, [15, 81, 50]);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Automatically derives a vibrant, luminous 3-stop gradient palette from ANY
 * category's iconColor & bgColor — upgrading both existing and all future categories.
 */
function buildVibrantPalette(iconColor: string, bgColor: string) {
  const [r, g, b] = parseHex(iconColor, [15, 81, 50]);
  const [h, s, l] = rgbToHsl(r, g, b);
  const isNeutral = s < 18;

  const baseHue = isNeutral ? 215 : h;
  const topHue = (baseHue - 10 + 360) % 360;
  const bottomHue = (baseHue + 9) % 360;

  const topSat = isNeutral ? 30 : clamp(s + 14, 66, 94);
  const midSat = isNeutral ? 26 : clamp(s + 10, 62, 92);
  const deepSat = isNeutral ? 30 : clamp(s + 6, 56, 88);

  const topLight = isNeutral ? 48 : clamp(l + 18, 46, 60);
  const midLight = isNeutral ? 36 : clamp(l + 7, 36, 49);
  const deepLight = isNeutral ? 25 : clamp(l - 4, 24, 38);

  const topStop = `hsl(${Math.round(topHue)}, ${Math.round(topSat)}%, ${Math.round(topLight)}%)`;
  const midStop = `hsl(${Math.round(baseHue)}, ${Math.round(midSat)}%, ${Math.round(midLight)}%)`;
  const deepStop = `hsl(${Math.round(bottomHue)}, ${Math.round(deepSat)}%, ${Math.round(deepLight)}%)`;

  return {
    gradient: `linear-gradient(135deg, ${topStop} 0%, ${midStop} 52%, ${deepStop} 100%)`,
    shadow: `0 10px 20px -7px ${hexToRgba(iconColor, 0.46)}, 0 0 0 3px ${hexToRgba(bgColor, 0.85)}, inset 0 1px 1px rgba(255, 255, 255, 0.42)`,
    aura: hexToRgba(bgColor, 0.72),
  };
}

export const DynamicCategoryIcon: React.FC<{
  iconKey: string;
  imageUrl?: string;
  bgColor?: string;
  iconColor?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({
  iconKey,
  imageUrl,
  bgColor = '#e6f4ec',
  iconColor = '#0f5132',
  size = 'md',
  className = '',
}) => {
  const Icon = getIconComponent(iconKey);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const palette = React.useMemo(
    () => buildVibrantPalette(iconColor, bgColor),
    [iconColor, bgColor]
  );

  const boxSizes = {
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-13 h-13 rounded-[18px]',
    lg: 'w-15 h-15 rounded-[20px]',
  };

  const iconSizes = {
    sm: 19,
    md: 24,
    lg: 28,
  };

  return (
    <div
      className={`category-icon-tile relative ${boxSizes[size]} flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      style={{
        background: imageUrl && !imgError ? bgColor : palette.gradient,
        boxShadow: palette.shadow,
        color: '#ffffff',
      }}
    >
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <>
          {/* Soft top-right luminous highlight for crafted ceramic depth */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white/25 blur-[2px]"
          />
          {/* Subtle bottom-left depth crescent */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-black/15 blur-[3px]"
          />
          {/* Hover light-sheen sweep */}
          <span
            aria-hidden="true"
            className="category-icon-sheen pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-white/30 to-transparent -skew-x-12"
          />
          {/* Crisp white duotone icon with gentle micro-pop on parent hover */}
          <Icon
            size={iconSizes[size]}
            strokeWidth={2.15}
            fill="rgba(255, 255, 255, 0.22)"
            className="category-icon-glyph relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
          />
        </>
      )}
    </div>
  );
};
