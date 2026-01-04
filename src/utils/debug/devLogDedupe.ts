const isDev = import.meta.env.DEV;

// DEV-only: dedupe de logs para reduzir ruído quando o React StrictMode re-executa efeitos no dev.
// Em produção, essa função não faz nada.
const dedupeMap = new Map<string, number>();

export function devLogOnce(signature: string, log: () => void, windowMs = 1500) {
  if (!isDev) return;

  const now = Date.now();
  const last = dedupeMap.get(signature) || 0;

  if (now - last > windowMs) {
    dedupeMap.set(signature, now);

    // Evitar crescimento ilimitado em sessões longas de dev.
    if (dedupeMap.size > 2000) {
      dedupeMap.clear();
    }

    log();
  }
}

export function serializeForDedupe(value: unknown): string {
  try {
    return JSON.stringify(value) || '';
  } catch {
    return '';
  }
}


