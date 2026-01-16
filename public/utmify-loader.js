(function(){
  var hostname = location.hostname;
  var isProd =
    hostname === 'musiclovely.com' ||
    hostname === 'www.musiclovely.com' ||
    hostname === 'musiclovely.com.br' ||
    hostname === 'www.musiclovely.com.br' ||
    hostname.endsWith('.vercel.app');
  
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

    var b = document.createElement("script");
    b.async = true;
    b.defer = true;
    b.src = "https://cdn.utmify.com.br/scripts/utms/latest.js";
    b.setAttribute("data-utmify-prevent-subids", "");
    b.onerror = function() {
      // Erro silencioso - não logar
    };
    document.head.appendChild(b);
  };

  loadScripts();
})();
