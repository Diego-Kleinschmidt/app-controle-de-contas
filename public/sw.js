// Service worker mínimo. Ele existe por um motivo só: o celular (Android/Chrome)
// exige um service worker para deixar "instalar" o app na tela inicial — e é a
// instalação que faz nosso app aparecer na lista de "Compartilhar" do sistema.
// Não fazemos cache nem nada offline aqui; deixamos a rede trabalhar normal.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
// Precisa existir um "fetch handler" para o app ser instalável. Não intervimos:
// sem respondWith, o navegador busca na rede do jeito padrão.
self.addEventListener("fetch", () => {});
