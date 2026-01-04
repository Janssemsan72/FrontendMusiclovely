import React from "react";
// ✅ NOVO: Import direto do asset como fallback
import logoAsset from "@/assets/logo.png";

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
    // Extrair apenas o pathname da URL (remover domínio)
    const currentPath = currentSrc.includes('/') 
      ? currentSrc.split('/').slice(-2).join('/') // Pegar últimos 2 segmentos
      : currentSrc;
    const currentIndex = fallbacks.findIndex(fallback => 
      currentSrc.includes(fallback) || currentPath.includes(fallback.replace('/', ''))
    );
    
    // Extrair informações detalhadas do erro
    const errorDetails = {
      currentSrc,
      currentPath,
      attemptedUrl: logoSrc,
      errorCount: errorCount + 1,
      naturalWidth: target.naturalWidth,
      naturalHeight: target.naturalHeight,
      complete: target.complete,
      networkState: (target as any).networkState,
      baseURI: target.baseURI,
      // Tentar fazer fetch para ver o status HTTP
    };
    
    console.error('❌ [Logo] Erro ao carregar logo:', errorDetails);
    
    // Verificar se é um problema de CORS ou 404
    fetch(currentSrc, { method: 'HEAD', mode: 'no-cors' })
      .then(() => {
        console.log('✅ [Logo] Arquivo existe mas pode ter problema de CORS ou formato');
      })
      .catch((fetchError) => {
        console.error('❌ [Logo] Erro ao verificar arquivo:', fetchError);
      });
    
    // Tentar próximo fallback
    if (currentIndex < fallbacks.length - 1) {
      const nextFallback = fallbacks[currentIndex + 1];
      console.log('🔄 [Logo] Tentando fallback:', nextFallback);
      // Forçar recarregamento com timestamp para evitar cache
      setLogoSrc(`${nextFallback}?t=${Date.now()}`);
      setErrorCount(prev => prev + 1);
      } else {
        console.error('❌ [Logo] Todos os fallbacks falharam');
        // Se todos falharem, tentar usar import direto do asset
        if (!useAssetImport && errorCount >= fallbacks.length) {
          console.log('🔄 [Logo] Tentando usar import direto do asset:', logoAsset);
          setUseAssetImport(true);
          setErrorCount(prev => prev + 1);
        } else if (errorCount < 8) {
          // Tentar recarregar o primeiro após um delay com timestamp
          setTimeout(() => {
            const retryUrl = `${fallbacks[0]}?t=${Date.now()}&retry=${errorCount + 1}`;
            console.log('🔄 [Logo] Retentando primeiro fallback:', retryUrl);
            setLogoSrc(retryUrl);
            setErrorCount(prev => prev + 1);
          }, 1000 * (errorCount + 1)); // Delay progressivo
        } else {
          console.error('❌ [Logo] Máximo de tentativas atingido. Exibindo placeholder.');
        }
      }
  };
  
  // Usar import direto se todos os caminhos públicos falharem
  const finalLogoSrc = useAssetImport ? logoAsset : logoSrc;
  
  return (
    <img 
      src={finalLogoSrc} 
      alt="Music Lovely" 
      className={`object-contain ${className}`}
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
      onLoad={() => {
        if (errorCount > 0 || useAssetImport) {
          console.log('✅ [Logo] Logo carregado com sucesso:', finalLogoSrc, useAssetImport ? '(via asset import)' : '(via public path)');
        }
      }}
    />
  );
}
