(function(){
  // Verifica se está em produção (domínio musiclovely.com)
  var isProd = location.hostname.endsWith('musiclovely.com');
  
  // NÃO CARREGAR EM DESENVOLVIMENTO - evita erros no console
  if (!isProd) {
    console.log('⚠️ Utmify desabilitado em desenvolvimento');
    return;
  }

  // Pixel ID do Utmify
  window.pixelId = "68f98a3f196fbe7f0e5683c7";

  // Carrega o script de pixel com tratamento de erro
  var a = document.createElement("script");
  a.async = true;
  a.defer = true;
  a.src = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";
  a.onerror = function() {
    console.warn('⚠️ Falha ao carregar pixel.js do Utmify - erro silencioso');
  };
  document.head.appendChild(a);

  // Carrega o script de UTMs com tratamento de erro
  var b = document.createElement("script");
  b.async = true;
  b.defer = true;
  b.src = "https://cdn.utmify.com.br/scripts/utms/latest.js";
  b.setAttribute("data-utmify-prevent-xcod-sck", "");
  b.setAttribute("data-utmify-prevent-subids", "");
  b.onerror = function() {
    console.warn('⚠️ Falha ao carregar latest.js do Utmify - erro silencioso');
  };
  document.head.appendChild(b);
})();
