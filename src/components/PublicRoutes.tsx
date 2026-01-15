import { Routes, Route, useLocation } from "react-router-dom";
import { Suspense } from "react";
import React from "react";
import CheckoutRedirectWrapper from "./CheckoutRedirectWrapper";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import { Gift } from "@/utils/iconImports";

// ✅ OTIMIZAÇÃO: Index é a página inicial, mas ainda pode ser lazy loaded se necessário
// Por enquanto mantemos import direto para FCP mais rápido, mas podemos mudar se necessário
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
const Checkout = lazyWithRetry(() => import("../pages/Checkout/index"));

const CheckoutProcessing = lazyWithRetry(() => import("../pages/CheckoutProcessing"));
const PaymentSuccess = lazyWithRetry(() => import("../pages/PaymentSuccess"));
const SongDownload = lazyWithRetry(() => import("../pages/SongDownload"));
const ApproveLyrics = lazyWithRetry(() => import("../pages/ApproveLyrics"));
const NotFound = lazyWithRetry(() => import("../pages/NotFound"));

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

// ✅ OTIMIZAÇÃO: Fallback com layout idêntico ao Checkout real para evitar layout shift
const CheckoutFallback = () => {
  return (
    <div className="min-h-[100dvh] bg-background checkout-mobile-compact">
      <div className="container mx-auto px-4 py-4 md:px-6 md:py-10 max-w-[1400px] pb-28 md:pb-8" style={{ paddingTop: '0px', marginTop: 0 }}>
        {/* Header skeleton */}
        <div className="text-center mb-6 md:mb-8">
          <div className="h-8 md:h-10 w-3/4 mx-auto rounded bg-muted animate-pulse mb-2" />
          <div className="h-6 md:h-8 w-1/2 mx-auto rounded bg-muted animate-pulse mb-4" />
        </div>

        {/* Grid com mesma estrutura do Checkout */}
        <div className="grid lg:grid-cols-[1fr,500px] gap-4 md:gap-8">
          {/* Card de pagamento - mesma estrutura do Checkout real */}
          <div className="order-1 lg:order-2 space-y-2 md:space-y-4" style={{ minHeight: '400px' }}>
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="p-4 md:p-6">
                <div className="h-7 w-2/3 rounded bg-muted animate-pulse mb-2" />
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse mb-4 hidden md:block" />
                
                {/* Inputs skeleton */}
                <div className="space-y-4">
                  <div className="h-12 w-full rounded-md bg-muted animate-pulse" />
                  <div className="h-12 w-full rounded-md bg-muted animate-pulse" />
                </div>

                {/* Botão na posição correta (dentro do Card, não centralizado) */}
                <div className="mt-4 md:hidden">
                  <div className="h-16 w-full rounded-lg bg-gradient-to-r from-emerald-700 via-green-700 to-emerald-800" />
                </div>
              </div>
            </div>
          </div>

          {/* Coluna de resumo - skeleton */}
          <div className="order-2 lg:order-1">
            <div className="rounded-lg border bg-card shadow-sm p-4 md:p-6 space-y-4">
              <div className="h-6 w-1/2 rounded bg-muted animate-pulse" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
                <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ CORREÇÃO: Sempre renderizar rotas - React Router lida com paths automaticamente
export default function PublicRoutes() {
  const location = useLocation();
  
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
          {/* Para musiclovely.shop e music-lovely-novo, a página inicial é a Company (sem Header/Footer) */}
          <Route path="" element={isCompanyPage ? <IndexCompany /> : <Index />} />
          <Route path="about" element={<About />} />
          <Route path="company" element={<Company />} />
          <Route path="company-standalone" element={<CompanyStandalone />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="checkout" element={
            <Suspense fallback={<CheckoutFallback />}>
              <Checkout />
            </Suspense>
          } />
          <Route path="checkout-processing" element={<CheckoutProcessing />} />
          {/* Rotas de sucesso - cobrindo todas as variações possíveis */}
          <Route path="payment/success" element={<PaymentSuccess />} />
          <Route path="payment-success" element={<PaymentSuccess />} />
          <Route path="success" element={<PaymentSuccess />} />
          <Route path="song/:id" element={<SongDownload />} />
          <Route path="download/:id" element={<SongDownload />} />
          <Route path="download/:id/:token" element={<SongDownload />} />
          <Route path="approve-lyrics" element={<ApproveLyrics />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </CheckoutRedirectWrapper>
  );
}
