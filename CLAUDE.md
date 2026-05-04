# Convenciones del repo (para Claude Code y nuevos contributors)

## Auth en route handlers — patrón obligatorio

Toda ruta `/api/cuentas/[idCuenta]/...` DEBE empezar con:

```ts
const { idCuenta } = await params;
const acceso = await verificarAccesoCuenta(idCuenta);
if (acceso instanceof NextResponse) return acceso;
const { auth, cuenta } = acceso;
```

`verificarAccesoCuenta` (en `src/lib/auth/sesion.ts`) hace en una sola
llamada: requiere sesión, valida que `idCuenta` exista y verifica que
`cuenta.usuario_id === auth.id`. Si falla, devuelve un `NextResponse`
listo para retornar.

**Nunca** abras una ruta nueva bajo `/api/cuentas/[idCuenta]/` sin este
check. El middleware (`src/middleware.ts`) tiene deny-by-default sobre
`/api/*`, pero el ownership por cuenta lo decide el handler.

Para parsear bodies JSON usá `parsearJSON<T>(req)` del mismo módulo en
lugar de `await req.json()` con try/catch.

## Webhooks públicos

Sólo hay 3 rutas exentas de auth (allowlist en `src/middleware.ts`):

- `/api/wa-cloud/webhook` — valida HMAC SHA-256 contra `wa_app_secret` por cuenta.
- `/api/vapi/webhook` — valida `x-vapi-secret` contra `vapi_webhook_secret` por cuenta (obligatorio).
- `/api/apify/webhook` — valida HMAC contra secret de Apify.

Cualquier nuevo webhook público se debe agregar a `API_PUBLICA_ALLOWLIST`
en el middleware Y validar firma propia.

## Webhooks salientes (`dispararWebhook`)

`src/lib/webhooks.ts` valida la URL del usuario contra rangos privados
(`localhost`, `127.0.0.0/8`, `169.254/16`, `10/8`, `172.16/12`,
`192.168/16`, ULA IPv6, etc) antes del fetch. No deshabilites esa
validación.

## Capa de DB

- `src/lib/db/*` corre con `service_role` (bypassa RLS). La separación
  por tenant se garantiza en el route handler con `verificarAccesoCuenta`.
- Cada dominio en su archivo (`cuentas.ts`, `mensajes.ts`, etc).
  Re-exportado por `src/lib/db/index.ts`.
- `lanzar(error, contexto)` para errores: produce `Error("[db:contexto] ...")`.

## Polling client-side

Usar `usePollingVisible(fn, ms)` del módulo
`src/components/usePollingVisible.ts` en lugar de `useEffect +
setInterval`. Pausa cuando el tab está oculto.

## Rate limit

Endpoints caros (Gemini, ElevenLabs, OpenAI Whisper, Apify runs) deben
llamar al inicio:
```ts
const limite = verificarRateLimit(`${auth.id}:imagenes-generar`, 10, 60);
if (limite) return limite;
```

## Metering

Toda llamada a OpenAI / Vapi / ElevenLabs / Whisper / Gemini / Apify
debe registrar uso vía `registrarUso({...})` (en
`src/lib/db/meteringUso.ts`). Fire-and-forget: no rompe si la migración
07 no fue aplicada aún.

## Migrations

SQL en `migrations/NN_descripcion.sql`. Idempotentes (`if not exists`).
Aplicar manualmente en Supabase SQL Editor — no hay runner automático.

## Logs

`pino` configurado en `src/lib/logger.ts`. Para código nuevo, preferir
`log.info({ idCuenta }, "msg")` sobre `console.log`. El código viejo
usa `console.log` y se migra de forma oportunista (sin refactor masivo).
