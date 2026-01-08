import React from "react";
// ✅ OTIMIZAÇÃO: Usar WebP ao invés de PNG para melhor performance
import logoAsset from "@/assets/logo.webp";

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'default' | 'white';
}

export default function Logo({ className = "", size = 40, variant = 'default' }: LogoProps) {
  // ✅ CORREÇÃO: Usar caminho público direto para garantir que funcione no Vercel
  // Logo branco está em /images/logo-white.png e /logo-white.png
  const [logoSrc, setLogoSrc] = React.useState('/images/logo-white.png');
  const [errorCount, setErrorCount] = React.useState(0);
  const [useAssetImport, setUseAssetImport] = React.useState(false);
  
  // Filtro CSS para aplicar a cor marrom dos botões (primary: #C7855E / hsl(24, 42%, 58%))
  // Converte a imagem branca para a cor marrom caramelo
  const brownFilter = variant === 'white' 
    ? 'brightness(0) invert(1)' 
    : 'brightness(0) saturate(100%) invert(52%) sepia(18%) saturate(878%) hue-rotate(345deg) brightness(93%) contrast(88%)';
  
  // Lista de fallbacks em ordem de prioridade
  const fallbacks = [
    '/images/logo-white.png',
    '/logo-white.png',
    '/logo-white-new.png',
  ];
  
  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    const currentIndex = fallbacks.findIndex((fallback) => currentSrc.includes(fallback));
    
    // Tentar próximo fallback
    if (currentIndex < fallbacks.length - 1) {
      const nextFallback = fallbacks[currentIndex + 1];
      setLogoSrc(nextFallback);
      setErrorCount((prev) => prev + 1);
    } else {
      if (!useAssetImport) {
        setUseAssetImport(true);
        setErrorCount((prev) => prev + 1);
      }
    }
  };
  
  const finalLogoSrc = useAssetImport ? logoAsset : logoSrc;
  
  return (
    <img 
      src={finalLogoSrc} 
      alt="Music Lovely" 
      className={`object-contain ${className}`}
      width={355}
      height={111}
      style={{ 
        width: size,
        height: 'auto',
        maxWidth: '100%',
        display: 'block',
        filter: brownFilter,
      }}
      loading="eager"
      decoding="async"
      onError={handleError}
    />
  );
}
