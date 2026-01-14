(function(){
  // Verifica se está em produção (domínio musiclovely.com)
  var isProd = location.hostname.endsWith('musiclovely.com');
  
  // NÃO CARREGAR EM DESENVOLVIMENTO - evita erros no console
  if (!isProd) {
    return;
  }

  // Pixel ID do Utmify
  window.pixelId = "68f98a3f196fbe7f0e5683c7";

  // Função para carregar scripts de forma diferida
  var loadScripts = function() {
    // Carrega o script de pixel (Facebook Pixel) com tratamento de erro
    var a = document.createElement("script");
    a.async = true;
    a.defer = true;
    a.src = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";
    a.onerror = function() {
      // Erro silencioso - não logar
    };
    document.head.appendChild(a);
  };

  // Carregar scripts de forma diferida APÓS LCP para não bloquear renderização
  // Aguardar LCP (geralmente ~2.5s) + margem de segurança
  if (window.requestIdleCallback) {
    window.requestIdleCallback(loadScripts, { timeout: 5000 });
  } else {
    // Fallback para navegadores sem requestIdleCallback - aguardar mais tempo
    setTimeout(loadScripts, 4000);
  }
})();
