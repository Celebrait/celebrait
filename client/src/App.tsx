// client/src/App.tsx
//
// App shell + route table.
//
// Route-level code splitting (added 2026-05-13 as part of the
// site-speed audit hit-list): every non-public route is wrapped in
// `React.lazy` so a first-time visitor on `/` only downloads the
// landing bundle, not Studio + Checkout + Admin too. Pre-split, the
// main client chunk was ~1.3 MB; post-split, Landing ships on its
// own and the rest hydrates on demand.
//
// What stays EAGER:
//   - Landing (the most-hit public page; must be on the first paint)
//   - LoginPage + PricingPage (small, public, often the second click)
//   - NotFound (tiny, no win from splitting)
//   - RequireAuth / RequireAdmin gates (used at every route check;
//     these are NOT pages, just small components)
//   - ScrollToTop + Toaster + TooltipProvider + QueryClientProvider
//     (app-shell plumbing)
//
// What's LAZY:
//   - Everything under /studio/* (signed-in app)
//   - /card/:id/view (uses the Card3DViewer + Three.js, multi-MB)
//   - /checkout/*
//   - /admin/* (rarely loaded, never by a non-admin user)
//   - StudioLayout + AdminLayout (heavy shells that go with their
//     respective subtrees)
//   - /privacy-policy + /terms-of-service (rarely visited)
//
// One <Suspense> wraps the whole <Switch>. Only the matched route's
// chunk shows the fallback, because wouter doesn't render unmatched
// branches.

import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from 'react';
import { clearStaleChunkGuard } from '@/lib/stale-chunk';
import { useSeo } from "@/lib/use-seo";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/scroll-to-top";
import { RequireAuth, RequireAdmin } from "@/components/require-auth";
import { ErrorBoundary } from "@/components/error-boundary";

// ---- Eager pages -----------------------------------------------------------
// Critical-path or trivially small. Worth shipping in the main chunk.
import { AuthModalProvider } from "@/components/auth/auth-modal";
// THE KEEPER is now the homepage (Kevin 2026-07-22 — old /pages/landing
// retired). Eager: it's the most-hit public page, so it belongs in the
// first-paint chunk (its heavy 3D card is separately code-split inside).
import LandingKeeper from "@/pages/landing-keeper";
import LoginPage from "@/pages/login";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";

// ---- Lazy pages ------------------------------------------------------------
// React.lazy requires default exports. For modules that ship multiple
// named exports (e.g. `card-maker` → NewCardPage + CardMakerPage), we
// adapt the import via the `.then` shim so React.lazy still sees a
// `{ default }` shape.

const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const ContactPage = lazy(() => import("@/pages/contact"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogPostPage = lazy(() => import("@/pages/blog-post"));
const OgCard = lazy(() => import("@/pages/og-card"));

// Studio shell + pages
const StudioLayout = lazy(() => import("@/layouts/studio-layout"));
const StudioHome = lazy(() => import("@/pages/studio"));
const StudioDrafts = lazy(() => import("@/pages/studio-drafts"));
const StudioReady = lazy(() => import("@/pages/studio-ready"));
const StudioSent = lazy(() => import("@/pages/studio-sent"));
const StudioOrders = lazy(() => import("@/pages/studio-orders"));
const StudioCardViewPage = lazy(() => import("@/pages/studio-card-view"));
// The Giving Moment — its own screen between the card reveal and
// checkout. See next_delivery_destination_usp.md.
const StudioGivePage = lazy(() => import("@/pages/studio-give"));
const StudioAddressBookPage = lazy(() => import("@/pages/studio-address-book"));
const AddressBookFormPage = lazy(() =>
  import("@/pages/studio-address-book-form"),
);
const StudioRemindersPage = lazy(() => import("@/pages/studio-reminders"));
const NewCardPage = lazy(() =>
  import("@/pages/card-maker").then((m) => ({ default: m.NewCardPage })),
);
const CardMakerPage = lazy(() =>
  import("@/pages/card-maker").then((m) => ({ default: m.CardMakerPage })),
);

// Public card viewer — drags in Card3DViewer + Three.js, multi-MB.
const CardViewerPage = lazy(() => import("@/pages/card-viewer"));

// Hero scroll-dolly PROOF OF CONCEPT — isolated, not linked.
const HeroScrollPocPage = lazy(() => import("@/pages/hero-scroll-poc"));

// Checkout
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const CheckoutDevConfirmPage = lazy(
  () => import("@/pages/checkout-dev-confirm"),
);
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancelledPage = lazy(() => import("@/pages/checkout-cancelled"));
// Marketing capture stage (unlisted; renders public hero assets only).
const CardCapturePage = lazy(() => import("@/pages/card-capture"));

// Admin shell + pages
const AdminLayout = lazy(() => import("@/layouts/admin-layout"));
const AdminPromptsPage = lazy(() => import("@/pages/admin-prompts"));
const AdminCostsPage = lazy(() => import("@/pages/admin-costs"));
const AdminPhotoLabPage = lazy(() => import("@/pages/admin-photo-lab"));
const AdminCardLabPage = lazy(() => import("@/pages/admin-card-lab"));
const AdminCardBenchPage = lazy(() => import("@/pages/admin-card-bench"));
const AdminCardTemplatesPage = lazy(() => import("@/pages/admin-card-templates"));
const AdminOccasionStudioPage = lazy(() => import("@/pages/admin-occasion-studio"));
const AdminEnginePage = lazy(() => import("@/pages/admin-engine"));
const AdminGuidedMakerPage = lazy(() => import("@/pages/admin-guided-maker"));
const DoorwayPage = lazy(() => import("@/pages/doorway"));
const MakePage = lazy(() => import("@/pages/make"));
const AdminResearchPage = lazy(() => import("@/pages/admin-research"));
const ResearchMakerPage = lazy(() => import("@/pages/research-maker"));
const ResearchPhotoPage = lazy(() => import("@/pages/research-photo"));
const BuyPage = lazy(() => import("@/pages/buy"));
const OrderStatusPage = lazy(() => import("@/pages/order-status"));
const CardsOccasionPage = lazy(() => import("@/pages/cards-occasion"));
const CardProductPage = lazy(() => import("@/pages/card-product"));
const StudioMomentsPage = lazy(() => import("@/pages/studio-moments"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin-analytics"));
const AdminCustomersPage = lazy(() => import("@/pages/admin-customers"));
const AdminEmailsPage = lazy(() => import("@/pages/admin-emails"));
const AdminSocialStudioPage = lazy(() => import("@/pages/admin-social-studio"));

// ---- Suspense fallback -----------------------------------------------------
// Centred spinner. Kept deliberately minimal — most lazy chunks land
// in <300ms on a warm network, so the fallback is only seen on slow
// connections or during cache misses.

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-card">
      <Loader2
        className="w-6 h-6 text-brand animate-spin"
        strokeWidth={1.75}
        aria-label="Loading"
      />
    </div>
  );
}

function SeoSync() {
  const [location] = useLocation();
  useSeo(location);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      {/* Router-level SEO sync: keeps title/description/canonical in
          step with SPA navigations for every path in shared/seo.ts —
          the first LOAD gets the same values server-injected
          (server/seo-inject.ts), so crawlers and users always agree. */}
      <SeoSync />
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/" component={LandingKeeper} />
          {/* Legacy /keeper alias → same page, so old links still resolve. */}
          <Route path="/keeper" component={LandingKeeper} />
          <Route path="/hero-poc" component={HeroScrollPocPage} />
          <Route path="/card-capture" component={CardCapturePage} />
          <Route path="/login" component={LoginPage} />
          {/* F&F research walk-through — keyed link, no login; the
              server-side RESEARCH_KEY gate is the real door. */}
          <Route path="/research" component={ResearchMakerPage} />
          <Route path="/research/photo" component={ResearchPhotoPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
          <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/blog" component={BlogPage} />
          <Route path="/blog/:slug" component={BlogPostPage} />
          <Route path="/og" component={OgCard} />
          <Route path="/studio">
            <RequireAuth>
              <StudioLayout>
                <StudioHome />
              </StudioLayout>
            </RequireAuth>
          </Route>
          {/* Week 1 dashboard rebuild: Drafts / Sent / Orders surfaces.
              Each is a filtered view on existing `/api/user/cards` data
              (drafts + sent) or the joined `/api/studio/orders` list. */}
          <Route path="/studio/drafts">
            <RequireAuth>
              <StudioLayout>
                <StudioDrafts />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/ready">
            <RequireAuth>
              <StudioLayout>
                <StudioReady />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/sent">
            <RequireAuth>
              <StudioLayout>
                <StudioSent />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/orders">
            <RequireAuth>
              <StudioLayout>
                <StudioOrders />
              </StudioLayout>
            </RequireAuth>
          </Route>
          {/* Address book — Week 2 retention surface. List + create + edit
              paths share a single form component with a `mode` prop. The
              "/new" route is registered BEFORE the parameterised "/:id/edit"
              so wouter doesn't greedily match new as ":id='new'". */}
          <Route path="/studio/moments">
            <RequireAuth>
              <StudioLayout>
                <StudioMomentsPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/people/address-book">
            <RequireAuth>
              <StudioLayout>
                <StudioAddressBookPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/people/address-book/new">
            <RequireAuth>
              <StudioLayout>
                <AddressBookFormPage mode="new" />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/people/address-book/:id/edit">
            <RequireAuth>
              <StudioLayout>
                <AddressBookFormPage mode="edit" />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/people/reminders">
            <RequireAuth>
              <StudioLayout>
                <StudioRemindersPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/new-card">
            <RequireAuth>
              <StudioLayout>
                <NewCardPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          <Route path="/studio/card/:id/edit">
            <RequireAuth>
              <StudioLayout>
                <CardMakerPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          {/* The Giving Moment — how the finished card reaches the
              recipient. Sits between the reveal and checkout. Must be
              declared before the bare /studio/card/:id route below so
              wouter matches the more specific path first. */}
          <Route path="/studio/card/:id/give">
            <RequireAuth>
              <StudioLayout>
                <StudioGivePage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          {/* /studio/card/:id — dedicated view page for completed cards.
              Drafts and in-progress generations are redirected back into
              the maker from inside the component. */}
          <Route path="/studio/card/:id">
            <RequireAuth>
              <StudioLayout>
                <StudioCardViewPage />
              </StudioLayout>
            </RequireAuth>
          </Route>
          {/* Digital card viewer. Public when `?t=TOKEN` is present
              (recipient share link); the page itself uses the public
              endpoint in that case. Without a token, the page falls
              back to the auth-gated draft endpoint so the sender can
              preview — that path requires the user's own cookie
              session, which is enforced by the API not the route. */}
          <Route path="/card/:id/view" component={CardViewerPage} />
          {/* Short share links — token only, no card id. Legacy long
              form above stays for every link already out in the wild. */}
          <Route path="/c/:token" component={CardViewerPage} />
          {/* Studio checkout — auth-gated. Static paths first; the
              parameterised route comes last so wouter doesn't greedily
              match `/checkout/success` as `:cardId='success'`. */}
          {/* Guest commerce (Door 1) — deliberately OUTSIDE RequireAuth:
              the rack sells with no account, ownership is token-based. */}
          <Route path="/door" component={DoorwayPage} />
          <Route path="/make" component={MakePage} />
          <Route path="/buy/:cardId" component={BuyPage} />
          <Route path="/order/:orderId" component={OrderStatusPage} />
          <Route path="/checkout/dev-confirm">
            <RequireAuth>
              <CheckoutDevConfirmPage />
            </RequireAuth>
          </Route>
          <Route path="/checkout/success">
            <RequireAuth>
              <CheckoutSuccessPage />
            </RequireAuth>
          </Route>
          <Route path="/checkout/cancelled">
            <RequireAuth>
              <CheckoutCancelledPage />
            </RequireAuth>
          </Route>
          <Route path="/checkout/:cardId">
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          </Route>
          <Route path="/admin/social">
            <RequireAdmin>
              <AdminLayout>
                <AdminSocialStudioPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/prompts">
            <RequireAdmin>
              <AdminLayout>
                <AdminPromptsPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/analytics">
            <RequireAdmin>
              <AdminLayout>
                <AdminAnalyticsPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/photo-lab">
            <RequireAdmin>
              <AdminLayout>
                <AdminPhotoLabPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/card-lab">
            <RequireAdmin>
              <AdminLayout>
                <AdminCardLabPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/card-bench">
            <RequireAdmin>
              <AdminLayout>
                <AdminCardBenchPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/card-templates">
            <RequireAdmin>
              <AdminLayout>
                <AdminCardTemplatesPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          {/* THE PUBLIC CATALOGUE — no auth; the SEO surface. */}
          <Route path="/card/:id">
            <CardProductPage />
          </Route>
          <Route path="/cards/:occasion/:aisle">
            <CardsOccasionPage />
          </Route>
          <Route path="/cards/:occasion">
            <CardsOccasionPage />
          </Route>
          {/* The guided maker preview — the customer flow rehearsed
              behind admin auth, deliberately OUTSIDE AdminLayout so it
              looks like what it is: the customer experience. */}
          <Route path="/admin/research">
            <RequireAdmin>
              <AdminLayout>
                <AdminResearchPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/guided-maker">
            <RequireAdmin>
              <AdminGuidedMakerPage />
            </RequireAdmin>
          </Route>
          <Route path="/admin/occasion-studio">
            <RequireAdmin>
              <AdminLayout>
                <AdminOccasionStudioPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/engine">
            <RequireAdmin>
              <AdminLayout>
                <AdminEnginePage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/costs">
            <RequireAdmin>
              <AdminLayout>
                <AdminCostsPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/customers">
            <RequireAdmin>
              <AdminLayout>
                <AdminCustomersPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>
          <Route path="/admin/emails">
            <RequireAdmin>
              <AdminLayout>
                <AdminEmailsPage />
              </AdminLayout>
            </RequireAdmin>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </>
  );
}

function App() {
  // The app rendered — so whatever chunk failed before the recovery
  // reload is resolved. Release the one-shot guard so a LATER deploy in
  // this same session can recover too.
  useEffect(() => {
    clearStaleChunkGuard();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthModalProvider>
          <Toaster />
          {/* App-level boundary — a render throw (e.g. WebGL context loss
              in the 3D card) shows a reload prompt instead of a white
              screen (audit 2026-07-02). */}
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </AuthModalProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
