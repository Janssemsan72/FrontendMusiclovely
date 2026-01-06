import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense } from "react";
import CheckoutRedirectWrapper from "./CheckoutRedirectWrapper";
import { lazyWithRetry } from "@/utils/lazyWithRetry";

import Index from "../pages/Index";
const IndexCompany = lazyWithRetry(() => import("../pages/IndexCompany"));
const About = lazyWithRetry(() => import("../pages/About"));
const Company = lazyWithRetry(() => import("../pages/Company"));
const CompanyStandalone = lazyWithRetry(() => import("../pages/CompanyStandalone"));
const HowItWorks = lazyWithRetry(() => import("../pages/HowItWorks"));
const Pricing = lazyWithRetry(() => import("../pages/Pricing"));
const Terms = lazyWithRetry(() => import("../pages/Terms"));
const Privacy = lazyWithRetry(() => import("../pages/Privacy"));
const Quiz = lazyWithRetry(() => import("../pages/Quiz"));
const Checkout = lazyWithRetry(() => import("../pages/Checkout"));
const CheckoutProcessing = lazyWithRetry(() => import("../pages/CheckoutProcessing"));
const PaymentSuccess = lazyWithRetry(() => import("../pages/PaymentSuccess"));
const SongDownload = lazyWithRetry(() => import("../pages/SongDownload"));
const ApproveLyrics = lazyWithRetry(() => import("../pages/ApproveLyrics"));
const AffiliateLogin = lazyWithRetry(() => import("../pages/AffiliateLogin"));
const AffiliateDashboard = lazyWithRetry(() => import("../pages/AffiliateDashboard"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));

function StripLocalePrefixRedirect() {
  const location = useLocation();
  const targetPathname = location.pathname.replace(/^\/(pt|en|es)(?=\/|$)/, "") || "/";
  return <Navigate to={`${targetPathname}${location.search}${location.hash}`} replace />;
}

const RouteFallback = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="h-10 w-40 rounded bg-muted animate-pulse mb-6" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
        </div>
        <div className="mt-8 h-12 w-full rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
};

// ✅ CORREÇÃO: Sempre renderizar rotas - React Router lida com paths automaticamente
export default function PublicRoutes() {
  // Verificar se estamos no projeto music-lovely-novo ou musiclovely.shop (usando hostname)
  // Para esses projetos, sempre usar IndexCompany como página inicial
  const isCompanyPage = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('musiclovely-novo') || 
     window.location.hostname.includes('music-lovely-novo') ||
     window.location.hostname === 'musiclovely-novo.vercel.app' ||
     window.location.hostname.includes('musiclovely.shop') ||
     window.location.hostname === 'www.musiclovely.shop' ||
     import.meta.env.VITE_PROJECT_NAME === 'music-lovely-novo');
  
  // ✅ NOVO: Para musiclovely.shop, renderizar APENAS a página Company em todas as rotas
  const isMusicLovelyShopOnly = 
    typeof window !== 'undefined' && 
    (window.location.hostname.includes('musiclovely.shop') ||
     window.location.hostname === 'www.musiclovely.shop');
  
  // Se for musiclovely.shop, renderizar apenas Company em todas as rotas
  if (isMusicLovelyShopOnly) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="*" element={<Company />} />
        </Routes>
      </Suspense>
    );
  }
  
  return (
    <CheckoutRedirectWrapper>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path=":locale(pt|en|es)/*" element={<StripLocalePrefixRedirect />} />
          <Route path="" element={isCompanyPage ? <IndexCompany /> : <Index />} />
          <Route path="about" element={<About />} />
          <Route path="company" element={<Company />} />
          <Route path="company-standalone" element={<CompanyStandalone />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="checkout-processing" element={<CheckoutProcessing />} />
          <Route path="payment/success" element={<PaymentSuccess />} />
          <Route path="payment-success" element={<PaymentSuccess />} />
          <Route path="success" element={<PaymentSuccess />} />
          <Route path="song/:id" element={<SongDownload />} />
          <Route path="download/:id" element={<SongDownload />} />
          <Route path="download/:id/:token" element={<SongDownload />} />
          <Route path="approve-lyrics" element={<ApproveLyrics />} />
          <Route path="afiliado/login" element={<AffiliateLogin />} />
          <Route path="afiliado" element={<AffiliateDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </CheckoutRedirectWrapper>
  );
}
