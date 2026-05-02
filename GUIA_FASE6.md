# Guía Fase 6 — Migración a SaaS Multi-Tenant con Supabase

Este documento cubre **qué se hizo en la sub-fase 6.A.1**, **cómo probarlo**, y **qué viene después**. Es el complemento técnico de la `GUIA.md` general.

---

## 📍 Estado actual

| Sub-fase | Estado | Qué incluye |
|---|---|---|
| **6.A.1 — Auth + Landing + Schema** | ✅ Completada | Schema Supabase, login/signup, panel protegido |
| 6.A.2 — Migración DB SQLite → Postgres | ⏳ Pendiente | Reescribir `baseDatos.ts` con Supabase, script de migración de datos |
| 6.A.3 — Multi-tenant + RLS por relación | ⏳ Pendiente | Cada usuario solo ve SUS cuentas, policies en todas las tablas |
| 6.A.4 — Landing PRO + Storage | ⏳ Pendiente | Landing tipo Zolutium, archivos a Supabase Storage |

> **Importante**: en 6.A.1 la app funciona en modo "híbrido" — el bot sigue usando SQLite local, pero el panel ya tiene Auth y todo está preparado para la migración. **Tu vecino puede crear cuenta y entrar al panel, pero por ahora ve los mismos datos que vos** (eso lo aislamos en 6.A.3).

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

### ⚠️ Pendiente (se cierra en 6.A.2 / 6.A.3)

- **Las APIs `/api/cuentas/*`** todavía están abiertas (sin verificar que el `idCuenta` pertenezca al usuario). Esto se cierra cuando migremos baseDatos.ts a Supabase y agreguemos chequeo de propietario en cada handler.
- **Las tablas que no son `usuarios` ni `cuentas`** tienen RLS pero sin policies → solo accesibles vía service_role. Esto es seguro (deny-all) pero requiere que migremos baseDatos.ts a usar el cliente admin (lo que vamos a hacer).
- **`mensajes`, `productos`, etc.** todavía viven en SQLite. Cualquier usuario logueado ve los mismos datos hasta 6.A.2/6.A.3.

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

### Test 5 — Tu vecino puede entrar (con limitación)
1. Le mandás http://app-contabilidad-sass-crm.lnrubg.easypanel.host
2. Él hace signup con su email
3. **Esperado**: entra al panel y ve TUS cuentas WhatsApp (porque la migración de datos a Supabase es 6.A.2 — por ahora todo viene de SQLite local sin filtrar por usuario)

> Esto último cambia en **6.A.2 + 6.A.3**: ahí los datos viven en Supabase con RLS, y cada usuario ve solo lo suyo.

---

## 📋 Lo que viene en 6.A.2 (próxima sub-fase)

### Refactor `baseDatos.ts` → Supabase

Hoy `src/lib/baseDatos.ts` usa `better-sqlite3`. Reemplazo:

- `import Database from "better-sqlite3"` → `import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor"`
- `db.prepare("SELECT * FROM cuentas WHERE id = ?").get(id)` → `await supabase.from("cuentas").select("*").eq("id", id).single()`
- IDs `number` → `string` (UUIDs)
- Timestamps `unixepoch()` → ISO strings o `Date`

### Script de migración de datos

`npm run migrar:sqlite-a-supabase`:
1. Lee tu `data/messages.db` actual
2. Para cada cuenta: la asigna a TU `usuario_id` (admin)
3. Inserta todo en Supabase preservando relaciones (mapeando integer IDs a UUIDs)
4. Reporta resumen: "X cuentas, Y conversaciones, Z mensajes migrados"

### Cutover

1. Domingo a la noche, ~30min de downtime.
2. Pausamos el bot.
3. Corremos el script de migración.
4. Redeploy con la nueva versión que usa Supabase.
5. Verificamos que los mensajes lleguen.

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

### Las APIs viejas no encuentran cuentas
- Eso es porque **el código sigue usando SQLite** (Fase 6.A.1 es híbrida). En 6.A.2 migramos baseDatos.ts a Supabase y desaparece el problema.

---

## 📚 Recursos

- **Dashboard Supabase**: https://supabase.com/dashboard/project/hecrpmywujicgwcqmxbp
- **Supabase SSR docs**: https://supabase.com/docs/guides/auth/server-side/nextjs
- **RLS docs**: https://supabase.com/docs/guides/database/postgres/row-level-security
- **Repo**: https://github.com/Jesusn8npro/Sass-CRM

---

*Fase 6.A.1 completada. Próximo paso: 6.A.2 — migrar el código a usar Supabase en lugar de SQLite.*
