/**
 * Logger vazio para produção - remove todos os logs para melhor performance
 * Em desenvolvimento, usa console normal
 */

const isDev = import.meta.env.DEV;

export const noopLog = isDev ? console.log : () => {};
export const noopDebug = isDev ? console.debug : () => {};
export const noopWarn = isDev ? console.warn : () => {};
export const noopInfo = isDev ? console.info : () => {};
export const noopError = console.error; // Manter erros sempre
