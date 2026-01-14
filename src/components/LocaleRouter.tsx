import React from 'react';
import PublicRoutes from './PublicRoutes';

// Componente simplificado - sempre português do Brasil
// Apenas renderiza PublicRoutes sem detecção de locale
function LocaleRouter() {
  return <PublicRoutes />;
}

export default LocaleRouter;
