export type TemplateType = 'medical' | 'restaurants' | 'real-estate' | 'heroes' | 'general';

export type AdminRole = 'super_admin' | 'partner' | 'moderator' | 'auditor';

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconKey: string;
  imageUrl?: string;
  bgColor: string;
  iconColor: string;
  templateType: TemplateType;
  order: number;
  active: boolean;
  description?: string;
  updatedAt?: string;
}

export interface PlaceService {
  name: string;
  description: string;
  priceLabel: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  imageUrl?: string;
  popular?: boolean;
}

export interface GalleryItem {
  title: string;
  subtitle: string;
  tag: string;
  imageUrl: string;
}

export interface PromoFilter {
  id: string;
  name: string;
  slug: string;
  iconKey: string;
  badgeBgColor: string;
  badgeTextColor: string;
  priorityWeight: number;
  order: number;
  active: boolean;
  description?: string;
  updatedAt?: string;
}

export interface Place {
  id: string;
  name: string;
  categoryId: string;
  categorySlug: string;
  specialty?: string;
  area: string;
  address: string;
  lat?: number;
  lng?: number;
  phone: string;
  whatsapp?: string;
  description?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  verified?: boolean;
  featured?: boolean;
  openNow?: boolean;
  hours?: string;
  consultationFee?: number;
  experienceYears?: number;
  qrCode?: string;
  tags?: string[];
  filterTags?: string[];
  filterExpirations?: Record<string, string>;
  services?: PlaceService[];
  menuItems?: MenuItem[];
  gallery?: GalleryItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Property {
  id: string;
  title: string;
  listingType: 'sale' | 'rent';
  propertyType: 'apartment' | 'shop' | 'land' | 'warehouse';
  price: number;
  areaSqm: number;
  rooms?: number;
  baths?: number;
  floor?: string;
  finishing?: string;
  area: string;
  address?: string;
  agencyId?: string;
  agencyName?: string;
  phone: string;
  whatsapp?: string;
  imageUrl?: string;
  description?: string;
  verified?: boolean;
  featured?: boolean;
  status: 'approved' | 'pending' | 'sold';
  createdAt?: string;
}

export interface Agency {
  id: string;
  name: string;
  licenseNumber?: string;
  area: string;
  address?: string;
  phone: string;
  whatsapp?: string;
  rating?: number;
  reviewCount?: number;
  dealsCount?: number;
  yearsExperience?: number;
  verified?: boolean;
}

export interface Offer {
  id: string;
  title: string;
  subtitle?: string;
  placeId?: string;
  placeName: string;
  categorySlug?: string;
  discountPercent: number;
  originalPrice?: number;
  salePrice: number;
  couponCode: string;
  expiresAt?: string;
  terms?: string[];
  imageUrl?: string;
  active: boolean;
  featured?: boolean;
}

export interface Campaign {
  id: string;
  slotNumber: number;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaText?: string;
  targetRoute: string;
  impressions?: number;
  clicks?: number;
  active: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  type: 'hotline' | 'pharmacy' | 'hospital' | 'blood';
  phone: string;
  area?: string;
  address?: string;
  statusText?: string;
  is24h?: boolean;
  priority: number;
}

export interface ClinicQueue {
  doctorId: string;
  doctorName: string;
  specialty?: string;
  clinicAddress?: string;
  currentNumber: number;
  lastTicketNumber: number;
  status: 'open' | 'paused' | 'emergency' | 'closed';
  avgMinutesPerPatient?: number;
  pausedReason?: string;
  updatedAt?: string;
}

export interface ClinicTicket {
  id: string;
  ticketCode: string;
  ticketNumber: number;
  doctorId: string;
  doctorName: string;
  patientName: string;
  patientPhone: string;
  visitType?: string;
  fee?: number;
  status: 'waiting' | 'called' | 'in_room' | 'completed' | 'cancelled' | 'emergency';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface RestaurantOrder {
  id: string;
  orderCode: string;
  restaurantId: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  deliveryArea?: string;
  deliveryAddress: string;
  locationShared?: boolean;
  items: CartItem[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  status: 'new' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
  captainName?: string;
  captainPhone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryRide {
  id: string;
  rideCode: string;
  pickupArea: string;
  pickupDetails?: string;
  dropoffArea: string;
  dropoffDetails?: string;
  itemDescription: string;
  customerName: string;
  customerPhone: string;
  estimatedFee?: number;
  status: 'pending' | 'accepted' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';
  captainName?: string;
  captainPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Submission {
  id: string;
  trackingToken: string;
  type:
    | 'suggest_place'
    | 'report_edit'
    | 'advertise'
    | 'add_property'
    | 'property_inspection'
    | 'join_hero'
    | 'hero_inquiry';
  targetPlaceId?: string;
  title: string;
  submitterName: string;
  submitterPhone: string;
  payload?: Record<string, string | number | boolean>;
  previousData?: Record<string, string | number | boolean>;
  status: 'received' | 'reviewing' | 'approved' | 'rejected' | 'expired';
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsappQueueItem {
  id: string;
  recipientName: string;
  phone: string;
  relatedType?: string;
  relatedTitle?: string;
  templateName?: string;
  messageBody: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  createdAt?: string;
}

export interface FinanceChangeLog {
  raedPercent: number;
  mohamedPercent: number;
  changedBy: string;
  changedAt: string;
  note: string;
}

export interface FinanceConfig {
  isConfigured: boolean;
  raedPercent?: number;
  mohamedPercent?: number;
  updatedBy?: string;
  updatedAt?: string;
  history?: FinanceChangeLog[];
}

export interface FinanceSettlement {
  id: string;
  periodLabel: string;
  totalRevenue: number;
  expenses: number;
  netProfit: number;
  raedPercentLocked: number;
  mohamedPercentLocked: number;
  raedShare?: number;
  mohamedShare?: number;
  status: 'closed' | 'open';
  closedAt?: string;
}

export interface AnalyticsEvent {
  id?: string;
  eventType: 'visit' | 'call_click' | 'whatsapp_click' | 'search' | 'zero_search';
  query?: string;
  targetId?: string;
  targetName?: string;
  categorySlug?: string;
  resultCount?: number;
  createdAt?: string;
}

export interface PublicSettings {
  appName: string;
  disclaimer: string;
  supportPhone?: string;
  supportWhatsapp?: string;
  visitsCount: number;
  areas?: string[];
  updatedAt?: string;
}

export interface ActiveTracker {
  type: 'clinic' | 'order' | 'delivery';
  id: string;
  code: string;
  title: string;
  route: string;
}
