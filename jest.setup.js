/**
 * Setup global do Jest (JavaScript puro — arquivos .js não passam pelo
 * transform de TypeScript do jest-expo).
 *
 * Mock global de `@react-native-community/netinfo` (Fase 2): o módulo real
 * auto-inicializa um verificador de internet ao ser requerido e crasha no
 * Jest ("Cannot read properties of undefined (reading 'isInternetReachable')")
 * porque depende de ponte nativa. O mock determinístico abaixo devolve
 * "conectado" por padrão e nunca inicializa nada nativo — o adapter
 * `NetInfoConnectivityAdapter` e o `useConnectivity()` ficam estáveis tanto
 * com o pacote instalado quanto sem ele.
 */
jest.mock('@react-native-community/netinfo', () => {
  var listeners = new Set();
  var currentState = { isConnected: true };

  return {
    fetch: function () {
      return Promise.resolve(currentState);
    },
    addEventListener: function (listener) {
      listeners.add(listener);
      return function () {
        listeners.delete(listener);
      };
    },
  };
});
