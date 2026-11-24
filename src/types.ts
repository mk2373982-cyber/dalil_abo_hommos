export type TemplateType = 'medical' | 'restaurants' | 'real-estate' | 'heroes' | 'general';

export type AdminRole = 'super_admin' | 'partner' | 'moderator' | 'auditor';

export type PartnerScope = 'clinic' | 'restaurant' | 'captain';

export interface AdminUser {
  uid: string;
  email: string;
  name?: string;
  role: AdminRole;
  partnerTypes?: PartnerScope[];
  managedPlaceIds?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type WeekdayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export interface TimeSlot {
  /** 24h HH:MM format, e.g. "16:00" */
  open: string;
  /** 24h HH:MM format, e.g. "21:00" or "02:00" (overnight) or "24:00" */
  close: string;
}

export type WeeklySchedule = Partial<Record<WeekdayKey, TimeSlot[]>>;

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
  workingSchedule?: WeeklySchedule;
  is24Hours?: boolean;
  consultationFee?: number;
  experienceYears?: number;
  qrCode?: string;
  tags?: string[];
  filterTags?: string[];
  filterExpirations?: Record<string, string>;
  services?: PlaceService[];
  menuItems?: MenuItem[];
  /** Authoritative map of menuItemId -> unit price (EGP), enforced in Firestore security rules */
  menuPriceMap?: Record<string, number>;
  deliveryFeeInTown?: number;
  deliveryFeeVillage?: number;
  gallery?: GalleryItem[];
  isDemoData?: boolean;
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
  isDemoData?: boolean;
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
  isDemoData?: boolean;
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
  isDemoData?: boolean;
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
  isDemoData?: boolean;
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
  /** Working day in Africa/Cairo timezone (YYYY-MM-DD) */
  sessionDate: string;
  currentNumber: number;
  lastTicketNumber: number;
  lastTicketId?: string;
  status: 'open' | 'paused' | 'emergency' | 'closed';
  avgMinutesPerPatient?: number;
  pausedReason?: string;
  updatedAt?: string;
}

export interface ClinicTicket {
  id: string;
  ticketCode: string;
  ticketNumber: number;
  /** Working day in Africa/Cairo timezone (YYYY-MM-DD) */
  sessionDate: string;
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

export interface DeliveryCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface OrderPricingSnapshot {
  currency: 'EGP';
  subtotal: number;
  deliveryFee: number;
  total: number;
  validatedAt: string;
  pricingSource: 'firestore_catalog' | 'api_validator';
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
  deliveryCoords?: DeliveryCoords;
  items: CartItem[];
  subtotal?: number;
  deliveryFee?: number;
  total: number;
  pricingSnapshot?: OrderPricingSnapshot;
  status: 'new' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
  captainUid?: string;
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
  captainUid?: string;
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
  applied?: boolean;
  appliedChanges?: Record<string, string | number | boolean>;
  publishedTargetId?: string;
  reviewedBy?: string;
  reviewedByUid?: string;
  reviewedAt?: string;
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
  isDemoData?: boolean;
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
  demoMode?: boolean;
  pwaInstallPromptEnabled?: boolean;
  updatedAt?: string;
}

export interface ActiveTracker {
  type: 'clinic' | 'order' | 'delivery';
  id: string;
  code: string;
  title: string;
  route: string;
}
