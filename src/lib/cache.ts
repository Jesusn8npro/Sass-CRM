/**
 * Cache TTL en memoria para el proceso Node.js.
 * Reduce queries repetidas a Supabase (cuentas, usuarios, etc.)
 * sin necesitar Redis. Se reinicia con cada deploy — correcto para
 * datos que también se invalidan al modificar la fila.
 */

interface Entry<T> {
  value: T;
  expiraEn: number;
}

class TTLCache {
  private store = new Map<string, Entry<unknown>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiraEn: Date.now() + ttlMs });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiraEn) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  /** Borra todas las claves que empiecen con el prefijo dado */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

export const cache = new TTLCache();

// TTLs en ms — centralizados para fácil ajuste
export const TTL = {
  CUENTA: 30_000,       // 30s — datos de cuenta (cambia poco)
  CUENTAS_LISTA: 20_000, // 20s — lista de cuentas activas (bot)
  USUARIO: 60_000,      // 60s — perfil de usuario (cambia muy poco)
} as const;
