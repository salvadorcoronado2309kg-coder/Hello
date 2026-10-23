// Límite simple en memoria: máximo `max` intentos por ventana. Suficiente para una instancia.
const hits = new Map<string, { n: number; reset: number }>();

export function permitir(clave: string, max = 5, ventanaMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const h = hits.get(clave);
  if (!h || h.reset < now) {
    hits.set(clave, { n: 1, reset: now + ventanaMs });
    return true;
  }
  h.n += 1;
  return h.n <= max;
}

export function reiniciar(clave: string): void {
  hits.delete(clave);
}
