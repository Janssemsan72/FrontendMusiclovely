import React, { memo, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage = memo<OptimizedImageProps>(({
  src,
  alt,
  className,
  loading = 'lazy',
  placeholder,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // ✅ FALLBACK: Se a imagem não carregar em 1 segundo, força a exibição
  useEffect(() => {
    if (!isLoaded && !hasError) {
      const timeout = setTimeout(() => {
        console.log('⏱️ Timeout: forçando exibição da imagem');
        setIsLoaded(true);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isLoaded, hasError, src]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center z-0">
          <div className="w-8 h-8 rounded-full bg-muted-foreground/20" />
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="text-muted-foreground text-sm">Erro ao carregar imagem</div>
        </div>
      ) : (
        <picture className="block w-full h-full">
          {/* ✅ OTIMIZAÇÃO: WebP com fallback - navegador faz fallback automaticamente se WebP não existir */}
          {src.match(/\.(jpg|jpeg|png)$/i) && (
            <source 
              srcSet={src.replace(/\.(jpg|jpeg|png)$/i, '.webp')} 
              type="image/webp"
            />
          )}
          <img
            src={src}
            alt={alt}
            loading={loading}
            decoding="async"
            onLoad={handleLoad}
            onError={(e) => {
              console.error('❌ Erro ao carregar imagem:', src, e);
              handleError();
            }}
            className={cn(
              'transition-opacity duration-300 w-full h-auto object-contain relative z-10',
              isLoaded ? 'opacity-100' : 'opacity-50'
            )}
            // ✅ OTIMIZAÇÃO: Blur placeholder se fornecido
            style={placeholder ? {
              backgroundImage: `url(${placeholder})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : { minHeight: '200px' }}
          />
        </picture>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
