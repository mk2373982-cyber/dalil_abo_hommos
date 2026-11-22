import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ScrollProgressBar } from './components/MotionEffects';
import { ToastContainer } from './components/SharedUI';

// Core Public Pages (loaded immediately for instant /home & /search render)
import { HomePage, SearchPage } from './pages/public/HomeAndSearchPages';

// Lazy-loaded Secondary Public Modules (code-split to minimize initial mobile data payload)
const MedicalListPage = lazy(() =>
  import('./pages/public/MedicalPages').then((m) => ({ default: m.MedicalListPage }))
);
const DoctorProfilePage = lazy(() =>
  import('./pages/public/MedicalPages').then((m) => ({ default: m.DoctorProfilePage }))
);
const DoctorBookingPage = lazy(() =>
  import('./pages/public/MedicalPages').then((m) => ({ default: m.DoctorBookingPage }))
);
const BookingConfirmedPage = lazy(() =>
  import('./pages/public/MedicalPages').then((m) => ({ default: m.BookingConfirmedPage }))
);
const LiveQueuePage = lazy(() =>
  import('./pages/public/MedicalPages').then((m) => ({ default: m.LiveQueuePage }))
);

const RestaurantsListPage = lazy(() =>
  import('./pages/public/RestaurantPages').then((m) => ({ default: m.RestaurantsListPage }))
);
const RestaurantProfilePage = lazy(() =>
  import('./pages/public/RestaurantPages').then((m) => ({ default: m.RestaurantProfilePage }))
);
const RestaurantMenuPage = lazy(() =>
  import('./pages/public/RestaurantPages').then((m) => ({ default: m.RestaurantMenuPage }))
);
const RestaurantCartPage = lazy(() =>
  import('./pages/public/RestaurantPages').then((m) => ({ default: m.RestaurantCartPage }))
);
const OrderTrackingPage = lazy(() =>
  import('./pages/public/RestaurantPages').then((m) => ({ default: m.OrderTrackingPage }))
);

const HeroesListPage = lazy(() =>
  import('./pages/public/HeroesDeliveryEmergencyPages').then((m) => ({ default: m.HeroesListPage }))
);
const HeroProfilePage = lazy(() =>
  import('./pages/public/HeroesDeliveryEmergencyPages').then((m) => ({ default: m.HeroProfilePage }))
);
const DeliveryRequestPage = lazy(() =>
  import('./pages/public/HeroesDeliveryEmergencyPages').then((m) => ({ default: m.DeliveryRequestPage }))
);
const DeliveryTrackingPage = lazy(() =>
  import('./pages/public/HeroesDeliveryEmergencyPages').then((m) => ({ default: m.DeliveryTrackingPage }))
);
const EmergencyPage = lazy(() =>
  import('./pages/public/HeroesDeliveryEmergencyPages').then((m) => ({ default: m.EmergencyPage }))
);

const RealEstateListPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({ default: m.RealEstateListPage }))
);
const AgencyProfileAndAddPropertyPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({
    default: m.AgencyProfileAndAddPropertyPage,
  }))
);
const PropertyInspectionPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({
    default: m.PropertyInspectionPage,
  }))
);
const PropertyDetailPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({ default: m.PropertyDetailPage }))
);
const GenericServiceCategoryPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({
    default: m.GenericServiceCategoryPage,
  }))
);
const PlaceDetailPage = lazy(() =>
  import('./pages/public/RealEstateAndServicesPages').then((m) => ({ default: m.PlaceDetailPage }))
);

const OffersListPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.OffersListPage }))
);
const OfferDetailPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.OfferDetailPage }))
);
const MorePage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.MorePage }))
);
const FavoritesPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.FavoritesPage }))
);
const TrackRequestPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.TrackRequestPage }))
);
const SuggestPlacePage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.SuggestPlacePage }))
);
const ReportPlacePage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.ReportPlacePage }))
);
const AdvertisePage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.AdvertisePage }))
);
const AboutPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.AboutPage }))
);
const PrivacyPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.PrivacyPage }))
);
const ContactPWAPage = lazy(() =>
  import('./pages/public/OffersAndMorePages').then((m) => ({ default: m.ContactPWAPage }))
);
const MyActivityPage = lazy(() =>
  import('./pages/public/MyActivityPage').then((m) => ({ default: m.MyActivityPage }))
);

// Lazy-loaded Live Partner Operational Consoles (code-split from public bundle)
const ClinicConsolePage = lazy(() =>
  import('./pages/partner/PartnerConsoles').then((m) => ({ default: m.ClinicConsolePage }))
);
const KitchenKDSPage = lazy(() =>
  import('./pages/partner/PartnerConsoles').then((m) => ({ default: m.KitchenKDSPage }))
);
const CaptainDashboardPage = lazy(() =>
  import('./pages/partner/PartnerConsoles').then((m) => ({ default: m.CaptainDashboardPage }))
);

// Lazy-loaded Admin Dashboard Portal (code-split from public bundle)
const AdminLoginPage = lazy(() =>
  import('./pages/admin/AdminLoginAndDashboard').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminLoginAndDashboard').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminTaxonomyPage = lazy(() =>
  import('./pages/admin/AdminTaxonomyPage').then((m) => ({ default: m.AdminTaxonomyPage }))
);
const AdminPlacesPage = lazy(() =>
  import('./pages/admin/AdminPlacesAndRequestsPages').then((m) => ({ default: m.AdminPlacesPage }))
);
const AdminRequestsPage = lazy(() =>
  import('./pages/admin/AdminPlacesAndRequestsPages').then((m) => ({ default: m.AdminRequestsPage }))
);
const AdminWhatsappQueuePage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminWhatsappQueuePage }))
);
const AdminCampaignsPage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminCampaignsPage }))
);
const AdminFinancePage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminFinancePage }))
);
const AdminImportPage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminImportPage }))
);
const AdminAnalyticsPage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminAnalyticsPage }))
);
const AdminSettingsPage = lazy(() =>
  import('./pages/admin/AdminOperationsAndFinancePages').then((m) => ({ default: m.AdminSettingsPage }))
);

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
};

export default function App() {
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AppProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ScrollProgressBar />
            {gmpQuotaExceeded && (
              <div
                dir="ltr"
                className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
              >
                <span>
                  Google Maps Platform quota reached. If you are the app owner, visit{' '}
                  <a
                    href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold text-amber-950 hover:text-amber-800"
                  >
                    maps developer site
                  </a>{' '}
                  for instructions to update your account.
                </span>
              </div>
            )}
            <OfflineIndicator />
            <ToastContainer />
            <Suspense
              fallback={
                <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center text-sm font-semibold text-[#0f5132]">
                  جارٍ تحميل الشاشة...
                </div>
              }
            >
            <Routes>
            {/* Default redirect to Home */}
            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* Portal 1: Public Citizen PWA */}
            <Route path="/home" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />

            {/* Medical & Live Queue */}
            <Route path="/medical" element={<MedicalListPage />} />
            <Route path="/medical/doctors/:doctorId" element={<DoctorProfilePage />} />
            <Route path="/medical/booking/:doctorId" element={<DoctorBookingPage />} />
            <Route path="/medical/booking/confirmed" element={<BookingConfirmedPage />} />
            <Route path="/medical/live-queue/:ticketId" element={<LiveQueuePage />} />

            {/* Restaurants, Menu, Cart & Live Tracking */}
            <Route path="/restaurants" element={<RestaurantsListPage />} />
            <Route path="/restaurants/:restaurantId" element={<RestaurantProfilePage />} />
            <Route path="/restaurants/:restaurantId/menu" element={<RestaurantMenuPage />} />
            <Route path="/restaurants/:restaurantId/cart" element={<RestaurantCartPage />} />
            <Route path="/orders/tracking/:orderId" element={<OrderTrackingPage />} />

            {/* Heroes / Craftsmen, Delivery & Emergency */}
            <Route path="/heroes" element={<HeroesListPage />} />
            <Route path="/heroes/:heroId" element={<HeroProfilePage />} />
            <Route path="/delivery" element={<DeliveryRequestPage />} />
            <Route path="/delivery/tracking/:rideId" element={<DeliveryTrackingPage />} />
            <Route path="/emergency" element={<EmergencyPage />} />

            {/* Real Estate & Agencies */}
            <Route path="/real-estate" element={<RealEstateListPage />} />
            <Route path="/real-estate/agency/:agencyId" element={<AgencyProfileAndAddPropertyPage />} />
            <Route path="/real-estate/inspect/:propertyId" element={<PropertyInspectionPage />} />
            <Route path="/real-estate/:propertyId" element={<PropertyDetailPage />} />

            {/* Dynamic General Service Categories & Place Details */}
            <Route path="/services/:categorySlug" element={<GenericServiceCategoryPage />} />
            <Route path="/places/suggest" element={<SuggestPlacePage />} />
            <Route path="/places/report/:placeId" element={<ReportPlacePage />} />
            <Route path="/places/:placeId" element={<PlaceDetailPage />} />

            {/* Offers (التخفيضات) & More (المزيد) */}
            <Route path="/offers" element={<OffersListPage />} />
            <Route path="/offers/:couponId" element={<OfferDetailPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/my-activity" element={<MyActivityPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/track" element={<TrackRequestPage />} />
            <Route path="/track/:secureToken" element={<TrackRequestPage />} />
            <Route path="/advertise" element={<AdvertisePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/contact" element={<ContactPWAPage />} />

            {/* Portal 2: Live Operational Partner Consoles */}
            <Route path="/clinic/console" element={<ClinicConsolePage />} />
            <Route path="/restaurant/kitchen" element={<KitchenKDSPage />} />
            <Route path="/captain/dashboard" element={<CaptainDashboardPage />} />

            {/* Portal 3: Admin Dashboard */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/taxonomy" element={<AdminTaxonomyPage />} />
            <Route path="/admin/places" element={<AdminPlacesPage />} />
            <Route path="/admin/requests" element={<AdminRequestsPage />} />
            <Route path="/admin/whatsapp-queue" element={<AdminWhatsappQueuePage />} />
            <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
            <Route path="/admin/finance" element={<AdminFinancePage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />

            {/* Safe Fallback */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
