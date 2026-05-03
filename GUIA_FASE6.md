# Guía Fase 6 — Migración a SaaS Multi-Tenant con Supabase

Este documento cubre **qué se hizo en la sub-fase 6.A.1**, **cómo probarlo**, y **qué viene después**. Es el complemento técnico de la `GUIA.md` general.

---

## 📍 Estado actual

| Sub-fase | Estado | Qué incluye |
|---|---|---|
| **6.A.1 — Auth + Landing + Schema** | ✅ Completada | Schema Supabase, login/signup, panel protegido |
| **6.A.2 — Migración DB SQLite → Postgres + multi-tenant** | ✅ Completada | `baseDatos.ts` 100% Supabase, IDs UUID, todas las APIs verifican propiedad de cuenta, RLS por relación |
| **6.A.3 — Storage cutover completo** | ✅ Completada | Productos, biblioteca y media-chats viven en Supabase Storage. Bot pasa Buffers a Baileys (no paths). Lectura híbrida: Storage primero, fallback a disco local para archivos pre-cutover. |
| **6.A.4 — Landing PRO** | ✅ Completada | Landing nueva con hero, métricas, mockup, 9 funciones, casos de uso, 3 planes de precios, FAQ y CTA final. |
| **6.A.5 — Historial bajo demanda** | ✅ Completada | Auto-fetch del historial al primer mensaje de un contacto + botón "cargar más antiguos" en el panel. Sin import masivo. |
| **6.B.1 — Planes + Mi Cuenta** | ✅ Completada | Free/Pro/Business con límites enforced en POST /api/cuentas (402). Página /app/mi-cuenta con perfil + plan + uso. Badge en sidebar con uso vs límite. |
| **6.C.1 — Vapi pro: multi-assistants + llamadas programadas + Web SDK** | ✅ Completada | N assistants Vapi por cuenta (vendedor/soporte/cobranza). Llamadas programadas a futuro con scheduler. IA puede agendar llamadas con `agendar_llamada`. Test desde browser con `@vapi-ai/web`. |
| **6.C.2 — Auth Baileys en Supabase Postgres** | ✅ Completada | Reemplaza `useMultiFileAuthState` (disco) por `useSupabaseAuthState` (DB). Sesión sobrevive reinicios del contenedor y permite multi-instancia. |
| **6.C.3 — Vapi del .env (modelo SaaS) + notificaciones de desconexión** | ✅ Completada | Vapi keys en `.env` se usan como default para todas las cuentas; cada cuenta puede override. Notificaciones in-app + email (Resend) cuando una cuenta WhatsApp se desconecta. |
| **6.D.1 — Rediseño tipo Talos Flow + páginas nuevas** | ✅ Completada | Sidebar persistente con secciones PRINCIPAL/CONFIGURACIÓN/VENTAS. Nuevas páginas: /clientes (CRM), /plantillas (envío masivo), /whatsapp (gestión QR/conexión), /conocimiento (standalone), /webhooks (n8n/Zapier). |
| **6.D.2 — Polish visual + webhooks reales cableados** | ✅ Completada | Sidebar con accent bar gradient + hover translate. /clientes con stats hero. /whatsapp con state hero gradiente. Headers consistentes. **Webhooks ya disparan eventos reales**: mensaje_recibido, contacto_nuevo, handoff_humano, cita_agendada, llamada_terminada. |

> **6.A.2 logrado**: cada usuario nuevo arranca de cero (0 cuentas, 0 conversaciones). Las APIs verifican `cuenta.usuario_id === auth.uid()` antes de devolver/mutar nada, y RLS por relación protege a nivel DB como segunda capa.

---

## 🏗 Lo que se construyó en 6.A.1

### Backend (Supabase)

**Proyecto**: `SASS WhatsApp` (`hecrpmywujicgwcqmxbp`) en org `N8N Pruebas`. Postgres 17, region `us-west-2`.

**9 migraciones SQL aplicadas vía MCP** (en orden):

1. `01_helpers_y_usuarios` — pgcrypto, helper `set_actualizada_en()`, tabla `usuarios`, trigger `handle_nuevo_usuario` que se dispara al signup
2. `02_cuentas_conversaciones_mensajes` — `cuentas` (con `usuario_id` FK), `conversaciones`, `mensajes`, `bandeja_salida`
3. `03_conocimiento_respuestas_etiquetas` — `conocimiento`, `respuestas_rapidas`, `etiquetas`, `conversacion_etiquetas`
4. `04_biblioteca_etapas_pipeline` — `biblioteca_medios`, `etapas_pipeline`, FK conversaciones.etapa_id
5. `05_contactos_email_telefono` — `contactos_email`, `contactos_telefono`
6. `06_productos_inversiones` — `productos`, `conversacion_productos_interes`, `inversiones`
7. `07_seguimientos_citas_llamadas` — `seguimientos_programados`, `citas`, `llamadas_vapi`
8. `08_rls_y_policies_base` — RLS habilitado en TODAS las tablas + policies para `usuarios` y `cuentas`
9. `09_hardening_funciones` — search_path fijo en helpers + REVOKE EXECUTE en funciones SECURITY DEFINER expuestas vía RPC

**Total: 19 tablas**, todas con UUIDs (`gen_random_uuid()`), timestamps con timezone (`timestamptz`), foreign keys con CASCADE apropiado, índices en columnas filtradas, RLS habilitado.

### Frontend (Next.js)

**Nuevos archivos:**
```
src/
├── app/
│   ├── page.tsx                          # 🆕 Landing público
│   ├── login/
│   │   ├── page.tsx                      # 🆕 UI login
│   │   ├── formulario.tsx                # 🆕 Form client-side
│   │   └── acciones.ts                   # 🆕 Server action iniciarSesion
│   ├── signup/
│   │   ├── page.tsx                      # 🆕 UI signup
│   │   ├── formulario.tsx                # 🆕
│   │   └── acciones.ts                   # 🆕 Server action registrarse
│   ├── api/auth/cerrar-sesion/route.ts   # 🆕 POST → signOut + redirect
│   └── app/                              # 🆕 (panel reubicado acá)
│       ├── page.tsx
│       └── cuentas/[idCuenta]/...        # ↩ movido de src/app/cuentas/
├── lib/supabase/
│   ├── cliente-navegador.ts              # 🆕 createBrowserClient
│   ├── cliente-servidor.ts               # 🆕 createServerClient + crearClienteAdmin
│   └── cliente-middleware.ts             # 🆕 helper para middleware
├── middleware.ts                          # 🆕 protege /app/*
└── components/
    └── BarraLateralCuentas.tsx           # ✏ agregado BloqueUsuario con email + cerrar sesión
```

**Rutas públicas vs protegidas:**

| Ruta | Acceso | Qué hace |
|---|---|---|
| `/` | Pública | Landing con CTAs a /signup y /login |
| `/login` | Pública (redirige a /app si ya hay sesión) | Email + password, devuelve sesión y va a /app |
| `/signup` | Pública (redirige a /app si ya hay sesión) | Crea cuenta. Si "confirm email" está OFF → entra directo. Si está ON → muestra mensaje "revisá tu email" |
| `/app/*` | **Protegida**, redirige a /login si no hay sesión | Panel completo: cuentas WhatsApp, dashboard, productos, todo |
| `/api/auth/cerrar-sesion` | POST, cualquiera | Limpia cookies y redirige a / |
| `/api/vapi/webhook` | Pública (valida secret propio) | Webhook de Vapi |
| Resto de `/api/*` | Por ahora abiertas | Se cierran en 6.A.3 con auth por usuario |

---

## 🚀 Setup paso a paso

### 1. Configurar Auth en el dashboard de Supabase (1 sola vez)

Andá a https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp/auth/url-configuration

**Site URL** (la URL principal de tu app):
- Producción: `https://app-contabilidad-sass-crm.lnrubg.easypanel.host`
- (Dev opcional: `http://localhost:3000`)

**Redirect URLs** (URLs permitidas para OAuth callbacks). Agregá:
```
https://app-contabilidad-sass-crm.lnrubg.easypanel.host/**
http://localhost:3000/**
```

**Email Auth** (https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp/auth/providers):
- Email habilitado ✓ (default)
- **"Confirm email"**: TU DECIDÍS:
  - **OFF** → signup automático sin confirmación. Más rápido para invitar a tu vecino.
  - **ON** → manda mail de confirmación. Más seguro pero requiere setup SMTP (Supabase tiene SMTP gratis muy limitado).
- Recomendación: **OFF para empezar**. Lo activamos después cuando tengas un dominio real.

### 2. Pegá la SERVICE_ROLE_KEY en `.env.local`

Andá a https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp/settings/api-keys

Copiá la **`service_role`** (NO la anon, NO la publishable). Pegala en tu `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ... (la de service_role, NO en chat)
```

⚠️ **Esta key NUNCA debe ir al cliente**. No tiene el prefijo `NEXT_PUBLIC_`. Si se filtra → cualquiera tiene acceso admin total a tu DB.

### 3. Reiniciá Next

```bash
Ctrl+C
npm run dev
```

### 4. Probá el flujo completo

1. Abrí http://localhost:3000 → ves el **landing**.
2. Click **"Empezar gratis"** → vas a `/signup`.
3. Completás email + password (8+ chars) + nombre opcional.
4. Click **Crear cuenta**.
5. Si "Confirm email" está OFF → te redirige automáticamente a `/app` y ves el panel.
6. Click en el ícono de logout en el sidebar (abajo a la izq) → cierra sesión y vuelve al landing.
7. Click **"Entrar"** → `/login` → completás → entrás otra vez al panel.
8. Si vas directo a `/app` sin sesión → middleware te redirige a `/login`.

---

## 🔍 Verificar en Supabase

### Que el usuario se haya creado

Andá a https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp/auth/users

Ahí ves la lista de `auth.users`. Cuando creás cuenta, aparece tu email.

Y en el SQL Editor:
```sql
SELECT id, email, nombre, plan, rol, creado_en FROM public.usuarios;
```

Ves el row creado por el trigger `handle_nuevo_usuario`. Esto confirma que el trigger funciona.

### Que las tablas estén OK

```sql
SELECT table_name, row_security
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver las 19 tablas todas con RLS habilitado.

### Que las policies de cuentas funcionen

Hacé una cuenta WhatsApp desde el panel (cuando migremos en 6.A.2). O directamente desde SQL:
```sql
-- Como tu usuario, deberías ver tus cuentas:
SELECT * FROM public.cuentas;
-- (Devuelve solo las del auth.uid() actual gracias a RLS)
```

---

## 🔐 Estado de seguridad

### ✅ Lo que está OK

- **Auth**: Supabase Auth con bcrypt, JWT, refresh tokens automáticos.
- **Cookies HTTPOnly**: las cookies de sesión no son accesibles vía JS del cliente (no XSS leak).
- **RLS habilitado** en las 19 tablas.
- **Policies** estrictas en `usuarios` y `cuentas` (cada user ve solo lo suyo).
- **Service role key** solo en server, nunca en cliente.
- **Search path fijo** en funciones SECURITY DEFINER → no vulnerables a search_path attacks.
- **REVOKE EXECUTE** en `handle_nuevo_usuario` para `anon` y `authenticated` → no se puede ejecutar via RPC (solo desde el trigger interno).
- **Middleware refresca sesión** en cada request → cookies siempre válidas.
- **CSRF**: server actions de Next usan headers que el browser solo envía same-origin.

### ✅ Cerrado en 6.A.2

- **Todas las APIs `/api/cuentas/*`** ahora exigen sesión vía `requerirSesion()` y verifican que `cuenta.usuario_id === auth.id`. Devuelven 401 sin sesión y 404 si la cuenta es de otro usuario (no filtran existencia).
- **RLS por relación** en las 17 tablas restantes via helper `cuenta_es_mia(uuid)` y policies `FOR ALL TO authenticated`. Defense in depth: el admin client del bot bypasea RLS, pero si en el futuro algún path usa cliente normal, RLS lo protege.
- **Datos en Supabase**: `mensajes`, `productos`, `conversaciones`, todo. Cada usuario nuevo arranca con 0 cuentas, 0 mensajes. SQLite local desactivado.

### ⚠️ Pendiente (6.A.3)

- **Storage local** — `auth/<id>/` (sesiones Baileys) y `data/media/` (archivos de chat) siguen en disco. Para SaaS multi-instancia hay que mover a Supabase Storage o S3.

### 💡 Recomendaciones extra

- En producción: **HTTPS obligatorio** (EasyPanel ya te lo da con Let's Encrypt).
- Activá **"Confirm email"** cuando tengas tu dominio definitivo + SMTP propio (Resend, SendGrid).
- Considerá **2FA con TOTP** para los admin. Supabase Auth lo soporta nativo.
- Revisá las **advisories** del linter regularmente:
  ```
  curl -X POST 'https://api.supabase.com/v1/projects/hecrpmywujicgwcqmxbp/advisors'
  ```
  o vía MCP en Claude.

---

## 🧪 Cómo probar el resultado de 6.A.1

### Test 1 — Landing + Signup
1. `npm run dev`
2. http://localhost:3000 → ves landing
3. Click "Empezar gratis" → /signup
4. Email + password 8+ chars → Crear cuenta
5. **Esperado**: te lleva a /app y ves el panel actual (con tus cuentas existentes de SQLite)

### Test 2 — Login + Logout
1. Click el icono → "Cerrar sesión" en el sidebar (footer abajo izq)
2. **Esperado**: vuelve al landing
3. Click "Entrar" → /login
4. Email + password → Entrar
5. **Esperado**: vas a /app de nuevo

### Test 3 — Middleware protege /app
1. Cerrá sesión
2. Andá directo a http://localhost:3000/app
3. **Esperado**: te redirige a /login?siguiente=/app
4. Entrás → automáticamente vas a /app (porque siguiente=/app)

### Test 4 — Trigger crea usuario en public.usuarios
1. Después de signup, andá al SQL Editor de Supabase
2. `SELECT * FROM public.usuarios WHERE email = 'tu@email.com';`
3. **Esperado**: 1 row con tu email, nombre (lo que pusiste), plan='free', rol='owner'

### Test 5 — Aislamiento multi-tenant (6.A.2)
1. Crear usuario A → conectar 1 cuenta WhatsApp → crear conversaciones / productos.
2. Cerrar sesión, crear usuario B con otro email.
3. **Esperado**: usuario B ve panel **vacío** (0 cuentas). No ve nada del usuario A.
4. Si intenta acceder a `/app/cuentas/<uuid-de-A>/dashboard` directamente: 404 desde la API.
5. En SQL Editor de Supabase: `SELECT count(*) FROM cuentas;` muestra ambas, pero `SELECT * FROM cuentas;` con sesión authenticated solo devuelve la del usuario actual (RLS).

---

## 📋 Resumen 6.A.2 — qué cambió

### Archivos nuevos
- `src/lib/auth/sesion.ts` — `obtenerUsuarioActual()` y `requerirSesion()` (devuelve 401 NextResponse si no hay sesión).

### `baseDatos.ts` reescrito completo
- Cliente admin (service_role) singleton lazy vía `crearClienteAdmin()`.
- Toda función ahora `async`, IDs `string` (UUID), timestamps `string` ISO timestamptz, booleans reales.
- `Cuenta.usuario_id: string` agregado. `crearCuenta(usuarioId, etiqueta, ...)` exige el UUID.
- `listarCuentas(usuarioId?)` filtra por usuario si se pasa el arg; sin arg, lista todas (uso interno del bot).

### APIs (~40 routes adaptados)
- Todos los handlers (excepto `/api/vapi/webhook`) empiezan con:
  ```ts
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  ```
- Verifican `cuenta.usuario_id === auth.id` antes de leer/mutar.
- Eliminado `Number(idCuenta)` — los UUIDs son strings.

### Bot core (gestor, manejador, cicloVida, llamadas)
- Maps/Sets ahora indexados por `string`.
- Toda llamada a `baseDatos` `await`-eada.
- Timestamps en ISO: `parseFechaIso` retorna ISO string, `listarCitasParaRecordar` recibe ISO.
- Booleans directos: `!cuenta.esta_archivada` en vez de `=== 0`.

### Componentes (~25)
- `useState<string | null>`, `Map<string, ...>` en pipeline/pages.
- Helpers de fecha leen ISO directamente: `new Date(msg.creado_en)` (sin `* 1000`).
- Forms envían boolean a las APIs (no 0/1).

### Migración SQL `10_rls_por_relacion_cuenta`
- Helper `cuenta_es_mia(uuid)` SECURITY DEFINER, search_path fijo, EXECUTE solo para `authenticated`.
- Policy `FOR ALL TO authenticated USING (cuenta_es_mia(cuenta_id))` en 15 tablas.
- `conversacion_etiquetas` joinea via `conversaciones.cuenta_id`.

## 📋 Scaffolding inicial 6.A.3 (referencia histórica)

Buckets creados con migración SQL `11_storage_buckets_y_policies`:
- `productos` — imágenes/videos del catálogo (límite 50MB, mimes whitelistados)
- `biblioteca` — medios reutilizables del bot (límite 50MB)
- `media-chats` — multimedia entrante de WhatsApp (límite 100MB, cualquier mime)

### Helper `src/lib/supabase/almacenamiento.ts`
- `subirArchivo(bucket, cuentaId, nombre, buffer, mime)`
- `urlFirmadaDe(bucket, ruta, segundos)` — URL temporal para servir
- `descargarArchivo(bucket, ruta)` — Buffer + mime para proxy server-side
- `borrarArchivo(bucket, ruta)`
- `existeArchivo(bucket, ruta)` — para modo híbrido lee-Storage-primero-fallback-local

### Migración SQL `11_storage_buckets_y_policies`
- Buckets vía `INSERT ... ON CONFLICT DO NOTHING` (idempotente).
- Policies SELECT/INSERT/DELETE por cuenta usando `cuenta_es_mia()`.
- Path convention: `<cuenta_uuid>/<archivo>` para que la policy pueda chequear ownership.

### Cutover (NO HECHO — pendiente de testing)
1. Cambiar API de upload de productos para escribir en `productos` bucket en lugar de `data/productos/`.
2. Cambiar `/api/productos/[idCuenta]/[archivo]` a redirect 302 a URL firmada.
3. Mismo patrón para biblioteca y media-chats.
4. Script de backfill de archivos existentes en `data/` → buckets.

### Cleanup local pendiente
- Detener Next con Ctrl+C y borrar `data/messages.db*` (lockeados mientras corre).
- Borrar `auth/<id-numerico>/` (legacy) — los nuevos son UUIDs.

## 📋 Resumen 6.D.1 — Rediseño tipo Talos Flow

### Sidebar persistente
- **`SidebarPanel.tsx`** componente nuevo, vive en el layout `[idCuenta]/layout.tsx` y se mantiene al navegar entre páginas dentro de la cuenta.
- 3 secciones de navegación: **PRINCIPAL** (Conversaciones, Clientes, Reportes, Agenda, Plantillas), **CONFIGURACIÓN** (WhatsApp, Agente IA, Conocimiento, Funnel, Webhooks), **VENTAS** (Llamadas, Productos, Seguimientos, Inversiones).
- Header con logo + selector de cuenta (dropdown si N>1, navega manteniendo la sub-ruta actual).
- Footer con badge notificaciones, interruptor tema, link a /mi-cuenta con badge del plan.

### Layout `/app/cuentas/[idCuenta]/layout.tsx`
- Server component que valida sesión + ownership de la cuenta (redirect a /app si no es del usuario).
- Carga la lista de cuentas del usuario una sola vez para el selector.
- Renderiza `<SidebarPanel/>` + `<main>{children}</main>`.

### `/app` página principal rediseñada
- Si el usuario tiene **1 cuenta** → redirige automático a `/app/cuentas/{id}/conversaciones`.
- Si tiene **>1** → muestra selector visual (cards) para elegir.
- Si tiene **0** → muestra `<CrearPrimeraCuenta/>` con form simple (etiqueta + crear → redirige a `/whatsapp` para escanear QR).

### Páginas nuevas

**`/conversaciones`** (`PanelConversaciones.tsx`):
- Lista de chats (340px) + panel de mensajes a la derecha.
- Estado "WhatsApp no conectado" con CTA a `/whatsapp` si la cuenta no está activa.
- Reusa los componentes existentes: `ListaConversaciones`, `PanelConversacion`, `ModalNuevaConversacion`.
- Polling con pausa por visibility (no fetch en background tab).

**`/clientes`** — vista CRM:
- Tabla con todos los contactos (combina conversaciones + emails capturados + teléfonos).
- Filtros: búsqueda libre + modo (Todos/IA/HUMANO).
- Etiquetas y badges por contacto.
- **Exportar CSV** un click → descarga CSV con nombre/teléfono/email/modo/último_mensaje.
- "Abrir →" deep-link a la conversación.

**`/whatsapp`** — gestión de conexión:
- Estado en vivo (con polling cada 3.5s para ver el QR live).
- Si está QR/conectando → renderiza `<PantallaQR/>`.
- Si está conectado → mensaje OK + botones desconectar (mantener sesión / borrar credenciales).
- Si está desconectado → botón "Generar QR".
- Sección educativa con causas comunes de cierre de sesión.

**`/conocimiento`** — base de conocimiento standalone:
- Listado de entradas (título + contenido) que el bot inyecta en su prompt.
- Form para crear nueva entrada.
- Botón borrar por entrada.
- Antes era una sub-sección de `/configuracion` — ahora dedicada para que el flujo de "agregar conocimiento" sea más visible.

**`/plantillas`** — mensajes plantilla + envío masivo:
- Reusa `respuestas_rapidas` como tabla base (mismo concepto: mensaje pre-armado).
- Lado izquierdo: lista de plantillas + form crear.
- Lado derecho: lista de contactos con checkboxes, "Seleccionar todos".
- Arriba: panel "Envío masivo" — elegís plantilla + contactos → encola vía `seguimientos_programados` (1 minuto a futuro).
- **Anti-ban**: usa el scheduler existente de seguimientos que respeta límite diario (80/cuenta) y horario humano (8-22h).

**`/webhooks`** — integración con n8n/Make/Zapier:
- Migración SQL `18_webhooks_salientes`: tabla con cuenta_id, nombre, url, eventos[], secret, esta_activo, stats.
- API CRUD: `GET/POST /api/cuentas/[id]/webhooks`, `PATCH/DELETE .../[idWebhook]`, `POST .../[idWebhook]/probar`.
- UI: form con nombre + URL + secret opcional + checkboxes de eventos (mensaje_recibido, mensaje_enviado, contacto_nuevo, cita_agendada, llamada_terminada, handoff_humano).
- Botón "Probar" dispara POST con payload dummy y muestra resultado (status HTTP).
- Estadísticas por webhook: total disparos, fallos, último resultado.
- Toggle activar/pausar sin borrar.
- *Nota*: el cableado del bot para disparar los webhooks reales en cada evento se hace en una próxima fase (por ahora solo está la infra y "Probar" funciona).

### Cleanup
Borrados (ya no se usan):
- `src/components/PuertaConexion.tsx` (reemplazado por `PanelConversaciones` + sidebar global)
- `src/components/BarraLateralCuentas.tsx` (reemplazado por `SidebarPanel`)
- `src/components/EncabezadoCuenta.tsx` (innecesario, el sidebar reemplaza su navegación)
- `src/components/ModalNuevaCuenta.tsx` (reemplazado por `CrearPrimeraCuenta`)
- `src/components/BannerBotInactivo.tsx` (no usado en el nuevo layout)
- `src/components/hooks/usePollingVisible.ts` (no se llegó a usar — los pollings tienen su propia lógica inline)

### Páginas existentes intactas (accesibles desde el sidebar)
- `/dashboard` (link como "Reportes")
- `/agenda`, `/llamadas`, `/seguimientos`, `/productos`, `/inversiones`, `/pipeline` (link como "Funnel"), `/configuracion` (link como "Agente IA")
- `/contactos/[idConv]` (cliente 360 — accesible desde botones internos)

## 📋 Resumen 6.C.3 — Vapi global + notificaciones

### Vapi credenciales del sistema (modelo SaaS real)
**Antes**: cada cuenta del SaaS tenía que pegar SU propia API key de Vapi en /configuracion.
**Ahora**: pegás tus keys una sola vez en `.env.local` (`VAPI_API_KEY`, `VAPI_PUBLIC_KEY`, `VAPI_PHONE_NUMBER_ID`) y por default todas las cuentas las usan. Sus assistants se crean en TU cuenta de Vapi, las llamadas se cobran a TU billing — vos cobrás a tus clientes lo que quieras.

Si una cuenta puntual quiere usar OTRA cuenta de Vapi (caso edge), puede pegar sus propias keys en /configuracion y override.

**Helper nuevo `src/lib/vapi-credenciales.ts`**:
- `resolverCredencialesVapi(cuenta)` → `{ apiKey, publicKey, phoneNumberId, origenes }`. Cuenta gana > env > nada.
- `credencialesParaCliente(cuenta)` → solo lo safe-to-expose (NUNCA api_key) para mandar al browser.

**Endpoint nuevo `GET /api/cuentas/[idCuenta]/vapi/estado`**:
Devuelve `{ publicKey, phoneNumberId, configurado, origenes }` para que el frontend sepa si Vapi está listo (sin exponer la api_key privada).

**Adaptados** para usar el helper en lugar de leer `cuenta.vapi_api_key` directo:
- `iniciarLlamadaConContexto` (llamadas.ts)
- `POST /api/cuentas/[idCuenta]/vapi/sincronizar`
- `POST /api/cuentas/[idCuenta]/vapi/phones`
- `POST /api/cuentas/[idCuenta]/assistants/[idAssistant]/sincronizar`
- `GET /api/cuentas/[idCuenta]/llamadas/[idLlamada]` (refresh activo)
- Componente `BotonLlamar` ahora consulta `/vapi/estado` para decidir si habilita el botón
- Componente `AdminAssistantsVapi` ahora consulta `/vapi/estado` para resolver la public key efectiva (cuenta o env)

**Voz ElevenLabs**: ya se reutiliza automático — el assistant se sincroniza con `cuenta.voz_elevenlabs` (el voice ID que cargaste en /configuracion → Voz). Sin cambios.

### Notificaciones de desconexión

**Migración SQL `16_notificaciones_sistema`**: tabla `notificaciones_sistema` con tipo, título, mensaje, metadata, leida, email_enviado. RLS por `usuario_id = auth.uid()`.

**Helper central `src/lib/notificaciones.ts`**:
- `notificarCuenta({cuentaId, tipo, titulo, mensaje, metadata})` — crea notif in-app + manda email vía Resend (si `RESEND_API_KEY` está set).
- Rate-limit por `(usuario, cuenta, tipo)` cada 15 min para evitar spam.
- `notificarCuentaDesconectada(cuentaId, etiqueta, motivo)` shorthand.
- Email HTML responsive con CTA al panel.

**Trigger en `gestor.ts`**: cuando `connection.update` con `DisconnectReason.loggedOut` → notifica al dueño con motivo (4 dispositivos vinculados / 14 días sin móvil / cerró manualmente).

**APIs nuevas**:
- `GET /api/notificaciones` → últimas 50 + count no leídas.
- `PATCH /api/notificaciones/[id]` → marca leída.
- `POST /api/notificaciones/marcar-todas` → batch.

**UI**:
- Componente `BadgeNotificaciones` (campanita con badge rojo) en sidebar, polling cada 30s.
- Página `/app/notificaciones` con lista, colores por tipo (rojo/ámbar/púrpura/zinc), iconos, deep-link a la cuenta, marcar leída individual o todas.

**Email opcional**: si tenés `RESEND_API_KEY` en `.env`, automáticamente manda email cuando se crea la notif. Si no, solo in-app. Free tier de Resend = 3K emails/mes (suficiente para ~1000 desconexiones/mes).

## 📋 Resumen 6.C.2 — Auth Baileys en Supabase Postgres

### Problema que resuelve
Antes Baileys guardaba la sesión (`creds.json` + ~50-200 archivos de signal keys) en `auth/<cuentaId>/` del disco local del server. Eso significaba:
- Reinicio del contenedor → sesión PERDIDA → re-escanear QR.
- No se puede correr el bot en N instancias (cada una tendría su propia carpeta).
- En EasyPanel/Docker la carpeta `auth/` se va con el deploy si no hay volumen montado.

### Solución
Implementé `useSupabaseAuthState(cuentaId)` que usa la misma firma que `useMultiFileAuthState` pero persiste todo en una tabla `baileys_auth` en Postgres.

### Migración SQL `15_baileys_auth_en_supabase`
```sql
CREATE TABLE baileys_auth (
  cuenta_id UUID REFERENCES cuentas(id) ON DELETE CASCADE,
  tipo TEXT,          -- 'creds' | 'pre-key' | 'session' | 'sender-key' | etc
  id TEXT,            -- 'main' for creds, key id for everything else
  valor JSONB,        -- BufferJSON.replacer aplicado
  PRIMARY KEY (cuenta_id, tipo, id)
);
```
RLS por `cuenta_es_mia()` aplicado.

### Helper `src/lib/baileys/auth-supabase.ts`
- `useSupabaseAuthState(cuentaId)` → `{ state, saveCreds }` (misma firma que `useMultiFileAuthState`).
- Implementa `SignalKeyStore` con `get` / `set` / batch upserts (100 por batch).
- Usa `BufferJSON.replacer` / `BufferJSON.reviver` para serializar Buffers como `{ type:'Buffer', data:[...] }`.
- `borrarSesionBaileysDeCuenta(cuentaId)` para cuando WhatsApp cierra sesión (DisconnectReason.loggedOut).
- `tieneSesionBaileys(cuentaId)` para detectar primera conexión.

### Cambios en `gestor.ts`
- Removidas las dependencias de `node:fs` y `node:path` (ya no escribimos en disco).
- Removidas `rutaAuthCuenta`, `asegurarDirectorio`, `migrarAuthLegacy`.
- `iniciarSocketCuenta` ahora hace `useSupabaseAuthState(cuenta.id)`.
- En `connection.update` con `DisconnectReason.loggedOut`: borra sesión de DB.
- En `desconectar(cuentaId, limpiarAuth)`: borra de DB en vez de `fs.rmSync`.

### Beneficio inmediato
- **Reiniciá el server cuantas veces quieras** → la sesión se mantiene.
- **WhatsApp Web cerrando sesión sigue siendo decisión de Meta** (no podemos impedirlo). Pero si vos NO cerrás sesión, el bot mantiene la conexión hasta el próximo deploy y a través de él también.
- **Multi-instancia**: si en algún momento corrés 2 réplicas del bot, ambas leen las mismas keys (igual hay que coordinar quién maneja cada cuenta — pero el storage ya no es bloqueante).

## 📋 Resumen 6.C.1 — Vapi pro

Vapi ya estaba conectado de antes (cliente HTTP, llamadas con contexto WhatsApp, webhook con secret, cooldown 1h, integración con bot IA). Esta fase agrega 4 capacidades nuevas en simultáneo:

### 1. Multi-assistants por cuenta
- Tabla nueva `assistants_vapi` con N assistants (vendedor/soporte/cobranza). Uno marcado como **default** (índice único parcial).
- Migración de datos: por cada cuenta con `vapi_assistant_id` legacy → primer row de `assistants_vapi` con `es_default=true`.
- API CRUD: `GET/POST /api/cuentas/[idCuenta]/assistants`, `GET/PATCH/DELETE /api/cuentas/[idCuenta]/assistants/[idAssistant]`, y `POST .../sincronizar` (push a Vapi — crea o actualiza).
- `iniciarLlamadaConContexto` ahora acepta `assistantIdOverride`. Resuelve: override > default de la nueva tabla > campo legacy `vapi_assistant_id` en cuentas. Compat 100%.
- UI: componente `AdminAssistantsVapi` con lista, edición inline, sync, marcar default, borrar. Insertado en /configuracion debajo de Vapi.

### 2. Llamadas programadas a futuro
- Tabla nueva `llamadas_programadas` con `programada_para`, `estado` (pendiente/ejecutada/cancelada/fallida), `assistant_id` opcional, `motivo`, `origen` (humano/ia).
- Scheduler `procesarLlamadasProgramadas` en `cicloVida.ts` corre cada 30s, respeta horario humano (8-22h del server), delega en `iniciarLlamadaConContexto` (que aplica cooldown, normalización, contexto WhatsApp).
- API: `GET/POST /api/cuentas/[idCuenta]/llamadas-programadas`, `DELETE .../[idLlamada]` (soft = marca como cancelada).
- UI: componente `LlamadasProgramadas` insertado al tope de `/llamadas`. Form para programar (conv + fecha + assistant opcional + motivo) + lista de pendientes con botón cancelar + collapsible con últimas procesadas.

### 3. IA puede agendar llamadas
- Nuevo campo `agendar_llamada` en `ESQUEMA_RESPUESTA` de `openai.ts`: `{ activar: boolean, fecha_iso: string, motivo: string }`.
- Manejador procesa el campo (similar a `agendar_cita`): valida fecha (5min-1año futuro) y crea row en `llamadas_programadas` con origen=`ia`. Mensaje sistema visible en panel.
- Distinto de `iniciar_llamada` (que dispara YA): este es para "llamame mañana 10am".

### 4. Vapi Web SDK (probar con micrófono)
- `npm i @vapi-ai/web` v2.5.2.
- Nueva columna `cuentas.vapi_public_key` (safe-to-expose por diseño de Vapi). User la pega en /configuracion.
- Componente `PruebaAssistantVapi`: inicializa `new Vapi(publicKey)`, captura eventos call-start/call-end/error/transcript-final, botón "Probar ahora" + "Cortar". Muestra transcript en vivo.
- Integrado en cada fila de assistant del `AdminAssistantsVapi` (solo aparece si el assistant ya está sincronizado en Vapi y la cuenta tiene public key).

### Migraciones SQL
- `13_vapi_multi_assistants_y_programadas`: dos tablas nuevas + RLS por relación + migración del assistant legacy de cada cuenta a la nueva tabla como default.
- `14_cuentas_vapi_public_key`: agrega `vapi_public_key TEXT` en `cuentas`.

### Flujo end-to-end típico
1. Usuario configura Vapi en /configuracion (api_key + public_key + phone_id).
2. Crea assistant "Vendedor cierre" → click "Crear en Vapi" (sincroniza).
3. Click "Probar con micrófono" → habla con el agente en el navegador, sin gastar minutos de outbound.
4. Click "Marcar como default".
5. En el panel de conversación, el operador click "Llamar" — se usa el default. O en /llamadas → "Programar llamada" → "Vendedor cierre" → fecha futura → motivo → save. El scheduler la dispara a la hora.
6. La IA del bot, durante una conversación, puede decidir `agendar_llamada` → queda en pendientes → scheduler la dispara.

## 📋 Resumen 6.A.3 — Storage cutover completo

### Patrón general
- **Write**: nuevas subidas escriben directo a Supabase Storage (`subirArchivo()` del helper).
- **Read**: intenta Storage primero, fallback a disco local legacy si no existe (para archivos pre-cutover, sin necesidad de backfill).
- **Bot ↔ Baileys**: en vez de pasar paths locales (`{ image: { url: 'file://...' } }`), descargamos el buffer de Storage y lo pasamos directo (`{ image: <Buffer> }`). Más portable: el bot puede correr en N instancias sin sticky storage.

### Phase A — Productos
- `src/lib/productos.ts`: `guardarImagenProducto`/`guardarVideoProducto` ahora `async`, suben a bucket `productos`. `borrarImagenProducto` borra de Storage + intento de borrar legacy. Nueva función `leerArchivoProducto(rutaRelativa)` con fallback.
- `GET /api/productos/[idCuenta]/[archivo]`: lee de Storage con fallback. **Bug fix**: removida la validación `Number(idCuenta)` que bloqueaba todos los UUIDs.
- POST/DELETE en `/api/cuentas/[idCuenta]/productos/[idProducto]/imagen` y `/video`: ahora `await` los helpers.

### Phase B — Biblioteca
- `src/lib/baileys/medios.ts`: `guardarEnBiblioteca` async → bucket `biblioteca`. Nueva `descargarBiblioteca(ruta)` con fallback. Nueva `borrarMedioBibliotecaArchivo`.
- `enviarMedioBiblioteca` en `manejador.ts`: descarga buffer de Storage y lo pasa a Baileys directo.
- `GET /api/biblioteca/[idCuenta]/[archivo]`: cutover a Storage + fix UUID bug.
- `DELETE /api/cuentas/[idCuenta]/biblioteca/[idMedio]`: usa nuevo helper.

### Phase C — Media-chats (lo más complejo)
- `descargarYGuardarMedia` (audios/imágenes que llegan al bot): async → bucket `media-chats`. Devuelve `{ rutaRelativa, buffer, ... }` para que el caller pueda usar el buffer inmediato (Whisper) sin re-descargar.
- `transcribirAudio(buffer, nombre)`: nueva firma — toma buffer en vez de path. Usa `OpenAI.toFile()` para enviar a Whisper.
- `guardarMediaSubido` (TTS de ElevenLabs, uploads manuales): async → bucket `media-chats`.
- **TTS flow** en `enviarParteAudio` (manejador.ts): TTS buffer → temp file (para ffmpeg) → ffmpeg conversion → temp file final → leer buffer → upload a Storage → pass buffer a Baileys → cleanup temps en `finally`.
- **Multimedia panel POST** en `/api/cuentas/[idCuenta]/mensajes/[idConv]/multimedia`: mismo dance temp-file para audio (ffmpeg requiere disco), upload a Storage del resultado.
- **Visión OpenAI** en `openai.ts`: `construirContenidoUsuario` ahora async, usa `descargarMediaChat` para conseguir el buffer de la imagen y mandarla a GPT-4o vision.
- `enviarItemBandeja` en manejador.ts: descarga de Storage, pasa buffer a Baileys. Para audio escribe temp file solo para `getAudioDuration`/`getAudioWaveform` (Baileys los necesita en disco para metadata).
- `GET /api/media/[idCuenta]/[archivo]`: cutover a Storage + fix UUID bug.

### Helpers nuevos en `medios.ts`
- `escribirTemporal(buffer, ext)` — escribe en `os.tmpdir()` y devuelve path para ffmpeg/Baileys.
- `borrarTemporal(ruta)` — cleanup silencioso.

### Lo que quedó intencionalmente NO migrado
- **`auth/<cuentaId>/`** (sesiones multi-archivo de Baileys) — sigue en disco local. Adaptador-Storage para esto es muy delicado (Baileys lee/escribe constante) y necesita más diseño. Fase futura.
- Archivos pre-cutover en `data/productos/`, `data/biblioteca/`, `data/media/` — siguen funcionando vía fallback. Si querés liberar disco, podés borrar carpetas individuales después de re-subir los archivos importantes.

## 📋 Resumen 6.B.1 — Planes y Mi Cuenta

### Definición central de planes — `src/lib/planes.ts`
- `PLANES.free` — 1 cuenta, 100 conv/mes, sin voz/Vapi/multi-modelo. Default.
- `PLANES.pro` — 10 cuentas, 100K conv/mes, voz + Vapi + multi-modelo. $29/mes.
- `PLANES.business` — ilimitado, white-label. A medida.
- Helpers: `obtenerPlan(id)`, `formatearLimite(n)`, `normalizarPlan(str)`.
- Single source of truth: cambiás precios/límites acá y se reflejan en /precios, /mi-cuenta y banners.

### Helpers en `baseDatos.ts`
- `obtenerUsuarioApp(id)` → fila completa de `public.usuarios`.
- `actualizarNombreUsuario(id, nombre)` para edición de perfil.
- `contarCuentasDeUsuario(id)` para validación de límite.

### Endpoints nuevos
- `GET /api/usuarios/me` → `{ usuario, plan, uso }`. Usado por sidebar y Mi Cuenta.
- `PATCH /api/usuarios/me` con body `{ nombre }` para editar perfil.

### Enforce de límite en `POST /api/cuentas`
- Antes de crear cuenta: lee plan del usuario, cuenta cuentas activas, compara.
- Si `usadas >= limite_cuentas` devuelve **402 Payment Required** con:
  ```json
  { "error": "...", "codigo": "limite_plan_alcanzado", "plan_actual": "free", "limite": 1, "usadas": 1 }
  ```
- `ModalNuevaCuenta.tsx` detecta `status===402` y agrega CTA "Actualizá tu plan en Mi Cuenta" al mensaje de error.

### Página `/app/mi-cuenta` (Server Component)
- Topbar con "← Volver al panel".
- **Perfil**: avatar gradiente + email + form para editar nombre (`FormularioPerfil` client component) + rol + miembro desde.
- **Plan actual**: badge (Free/Pro/Business con colores), barra de progreso de uso de cuentas, lista de beneficios incluidos, CTA "Actualizar a Pro →" (link a `/#precios`).
- **Sesión**: botón "Cerrar sesión" (`CerrarSesionBoton` client component que postea a `/api/auth/cerrar-sesion`).

### Badge en sidebar (`BarraLateralCuentas` → `BloqueUsuario`)
- Footer ahora es un `<Link href="/app/mi-cuenta">` clickeable entero.
- Avatar gradiente + email + badge del plan + contador `1/1` (color amber si lleno).
- Eliminado el botón "cerrar sesión" del sidebar — ahora vive en `/mi-cuenta` (un solo lugar de verdad).

## 📋 Resumen 6.A.5 — Historial bajo demanda

### Estrategia
**Sin `syncFullHistory`** (que dumpea TODO el historial al conectar y satura DB).
En su lugar:

1. **Auto-fetch on-demand**: cuando llega el primer mensaje de un contacto **nuevo en nuestra DB**, disparamos `sock.fetchMessageHistory(50, msg.key, msg.messageTimestamp)` en background. WhatsApp responde con los 50 mensajes anteriores de ese chat (lo que tenga).
2. **Botón "Cargar mensajes anteriores"** en el panel: pide otros 50 anteriores al mensaje más viejo que tengamos. Repetible hasta agotar el historial que WhatsApp guarda.
3. **Sin disparar IA sobre históricos**: los mensajes históricos se insertan con `es_historico=true` y **no** triggerean respuesta del bot.

### Migración SQL `12_mensajes_wa_msg_id_idempotencia`
- Columna `wa_msg_id TEXT` en `mensajes`.
- Índice único parcial `(cuenta_id, wa_msg_id) WHERE wa_msg_id IS NOT NULL`.
- Mensajes generados internamente (sistema, llamadas) tienen `wa_msg_id NULL` y no entran al unique.

### Cambios en `baseDatos.ts`
- `insertarMensaje()` ahora acepta `wa_msg_id`, `creado_en` y `es_historico`. Si trae `wa_msg_id`, hace **upsert** con `ON CONFLICT (cuenta_id, wa_msg_id) DO NOTHING` → idempotente entre reconexiones.
- `obtenerMensajeMasViejoConWaId(conversacionId)` para encontrar el pivote para fetch siguiente.
- `contarMensajesDeConversacion(conversacionId)` para detectar conversaciones nuevas.

### Cambios en `manejador.ts`
- Listener nuevo `messaging-history.set`: procesa cada mensaje histórico vía `procesarMensajeHistorico()` que crea/encuentra conversación, extrae texto, e inserta como histórico (sin descargar media — claves E2E expiradas).
- En `messages.upsert`, antes de insertar el primer mensaje de una conv chequeamos `contarMensajesDeConversacion === 0`. Si sí → disparamos `dispararFetchHistorialContacto()` en background.
- Helper exportado `pedirMasHistorialConversacion()` para que el endpoint API pueda llamarlo.

### Endpoint nuevo
- `POST /api/cuentas/[idCuenta]/conversaciones/[idConversacion]/cargar-historial`
- Body opcional `{ cantidad?: number }` (1..50, default 50).
- Verifica sesión + propiedad + cuenta conectada.
- Toma el msg más viejo con wa_msg_id y llama a Baileys.
- Devuelve 200 con `{ ok, req_id, esperando_mensajes }` o errores 4xx/5xx con explicación.

### UI en `PanelConversacion.tsx`
- Botón "↑ Cargar mensajes anteriores" arriba de la lista de mensajes.
- Estado `cargandoHistorial` para deshabilitar mientras pide.
- Mensaje de feedback ("Pedido enviado a WhatsApp. Los mensajes van a aparecer en unos segundos.") porque la respuesta es asíncrona — los mensajes los ve via el polling de `/mensajes` cada 2s.

### Limitaciones honestas
- WhatsApp **no manda** medios viejos: las claves de descifrado E2E expiran y los media históricos llegan rotos. Solo texto + caption.
- WhatsApp **limita** cuánto historial guarda: típicamente ~6 meses para chats activos, menos para chats viejos. No es ilimitado.
- En grupos no aplica: filtramos `@g.us`, `@broadcast`, `@newsletter`.

## 📋 Resumen 6.A.4 — Landing PRO

### `src/app/page.tsx` reescrito
Server component puro (cero JS, máximo SEO). Secciones:
1. **Nav sticky** con scroll-spy a anchors (#funciones, #como-funciona, #precios, #faq).
2. **Hero** con gradiente animado, badge "beta abierta", H1 grande con título degradado, doble CTA, mockup del panel realista (sidebar + conversación con burbujas).
3. **Métricas** (24/7, < 5s, ∞, 0%) en gradiente.
4. **Cómo funciona** — 3 pasos numerados.
5. **Funciones** — grid de 9 tarjetas (IA multimodal, voz clonada, pipeline, catálogo, agenda, multi-cuenta, captura automática, seguimientos, anti-ban).
6. **Casos de uso** — 9 verticales.
7. **Precios** — 3 planes (Gratis $0, Pro $29/mes, Business a medida) con beneficios y CTAs.
8. **FAQ** — 6 preguntas con `<details>` nativos.
9. **CTA final** — banner gradiente esmeralda con CTAs grandes.
10. **Footer** — 4 columnas (producto, cuenta, legal, branding).

Todo responsive (mobile-first), dark mode soportado, sin imágenes externas.

---

## 🆘 Troubleshooting Fase 6

### "redirect_uri_mismatch" en login/signup
- Faltó configurar **Redirect URLs** en Supabase Auth (paso 1).
- Asegurate que tu dominio de EasyPanel está agregado con `/**`.

### Signup tira "Email signups are disabled"
- En Supabase: Auth → Providers → Email → habilitarlo.

### Después del signup no me redirige a /app
- Probablemente "Confirm email" está ON. Vas a tener que confirmar el email primero. O lo apagás en Auth → Providers → Email → "Confirm email" toggle OFF.

### "JWT expired" en una request
- El middleware refresca automáticamente. Si pasa muy seguido, verificá que el middleware está corriendo en TODAS las rutas (ver `config.matcher` en `src/middleware.ts`).

### El usuario no aparece en `public.usuarios` después de signup
- El trigger `on_auth_user_created` no se disparó. Verificá en SQL Editor:
  ```sql
  SELECT * FROM information_schema.triggers
  WHERE trigger_name = 'on_auth_user_created';
  ```
  Si no existe, re-aplicá la migración 01.

### "Cannot find module @supabase/ssr"
- Falta `npm install`. Corré `npm install` y reiniciá Next.

### "No autenticado" (401) en las APIs
- Falta sesión. Iniciá sesión en `/login`. Las APIs ahora exigen cookie de Supabase Auth.

### "Cuenta no encontrada" (404) cuando claramente existe
- Esa cuenta es de otro usuario. Multi-tenant: cada usuario solo ve las suyas.

### El bot no procesa mensajes / heartbeat 0
- Verificá que `SUPABASE_SERVICE_ROLE_KEY` está pegada en `.env.local` (sin esa key el admin client no arranca).
- Reiniciá Next: `Ctrl+C && npm run dev`.

---

## 📚 Recursos

- **Dashboard Supabase**: https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp
- **Supabase SSR docs**: https://supabase.com/docs/guides/auth/server-side/nextjs
- **RLS docs**: https://supabase.com/docs/guides/database/postgres/row-level-security
- **Repo**: https://github.com/Jesusn8npro/Sass-CRM

---

*Fases 6.A.1 + 6.A.2 completadas. Multi-tenant operativo en producción. Próximo: 6.A.3 — Storage y landing PRO.*
