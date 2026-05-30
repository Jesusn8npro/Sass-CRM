# Resumen de sesión — 2026-05-29 (SaaS WhatsApp / INYECTAIA)

Todo lo trabajado hoy sobre el agente de WhatsApp y la integración con Supabase
externo (caso de prueba: cuenta "Academia Vallenata Online").

---

## 🟢 LO QUE SE CONSTRUYÓ / ARREGLÓ (todo pusheado a `main` / repo Sass-CRM)

### Integración Supabase externo
- **Cifrado real** de la `service_role key` con AES-256-GCM (`src/lib/seguridad/cifrado.ts`).
  Requiere env `CLAVE_CIFRADO_SECRETOS` (misma en local y producción).
- Página **"Tu Supabase"** para conectar la base del negocio (valida + descubre tablas).
- **Agente de ventas (clientes)** puede consultar tablas habilitadas (deny-by-default).
- **Operador/dueño** por WhatsApp con acceso TOTAL (crear/leer/editar/borrar) vía
  tools `bd_*`, con confirmación antes de borrar/editar masivo.

### Navegación de datos (lo más reciente)
- El prompt del agente recibe **las tablas y columnas REALES** de cada negocio
  (genérico, multi-tenant — sin hardcodear nombres). `obtenerColumnasPermitidas`.
- `consultar_datos` soporta filtro `valor` (=) y `valores` (IN, varios ids).
- **Navegación por pasos**: loop de hasta 4 consultas ENCADENADAS
  (ej: perfil → inscripciones → títulos). Sin vistas, sin SQL crudo.
- Se **eliminaron** las vistas que se habían creado (a pedido del usuario):
  vista_paquetes_canciones, vista_alumno_lookup, vista_alumno_contenido.
- Prompt: PROHIBIDO diferir ("déjame verificar") e inventar datos.

### Comportamiento del agente (global, todas las cuentas)
- Saluda UNA sola vez (no re-saluda), respuestas concisas, no repite.
- **Buffer con detección de "escribiendo"**: espera a que el cliente deje de tipear
  (presence "composing", tope 60s) antes de responder.
- Cuentas nuevas nacen con **buffer_segundos = 15**.

### Historial / conversaciones
- `syncFullHistory = true`: al reconectar el QR baja historial amplio.
- Solo importa chats 1:1 reales (`@s.whatsapp.net`) — se evitan números corruptos `@lid`.
- Conversaciones ordenadas por último mensaje; media histórica sin archivo se muestra
  como burbuja limpia (no texto crudo).

### UI / panel
- Buscador de conversaciones (nombre/teléfono).
- Layout del chat arreglado (ocupa toda la pantalla; el bug era `w-full min-w-0`
  faltante → desbordaba con URLs largas). Scroll de la lista restaurado.
- Toggle "Acceso del agente" con estado claro Activado/Desactivado.
- Campos de config más claros: **Información del negocio = DATOS (qué vendés)** vs
  **Prompt del agente = REGLAS (cómo vende)**.

### Auto-handoff y seguimientos
- Si el dueño escribe a un cliente desde el celular conectado → la conversación pasa
  a HUMANO automáticamente.
- **Auto-seguimiento masivo APAGADO + blindado** (no dispara sobre chats importados).
  Hay un botón MANUAL "Seguimiento" por conversación (borrador para aprobar).

### Admin
- Usuario `rambo@gmail.com` quedó como **plan business (ilimitado)** + créditos enormes.

---

## 🔴 EL PROBLEMA CRÍTICO PENDIENTE: EL DEPLOY NO ACTUALIZA

**Comprobado el 2026-05-29:** al pegarle a
`https://app-contabilidad-sass-crm.lnrubg.easypanel.host/api/version`
devuelve `{"error":"No autenticado"}` en vez de la versión → **producción está
corriendo código VIEJO. Los últimos commits NO se desplegaron.**

- El **operador funciona** porque corre de un commit más viejo que ya tenía sus arreglos.
- El **agente de clientes falla / inventa** (cursos, canciones de paquetes) porque toda
  la navegación por pasos y el anti-invención están en commits NO desplegados.
- El build compila perfecto en local (`npm run build` EXIT=0) → **el código está bien,
  el problema es el proceso de deploy de EasyPanel.**

### Cómo verificar el deploy (mañana, primero esto):
1. Redeploy en EasyPanel (idealmente "force rebuild / sin caché").
2. Abrir `…/api/version` → debe decir **`"version": "nav-pasos-2026-05-29-v1"`**.
   - Si lo dice → deploy al día → el agente de clientes ya debería consultar real.
   - Si sigue "No autenticado" → el deploy NO subió el código nuevo (revisar:
     ¿auto-deploy en push o manual?, ¿apunta a rama `main`?, ¿build falló?, log del deploy).

### Recordatorio de envs en producción:
- `CLAVE_CIFRADO_SECRETOS` (misma que local; si cambia, no descifra la key guardada).
- `BOT_ENABLED` no debe ser "false" en producción (en local sí, para no chocar).

---

## ⏳ PENDIENTE PARA MAÑANA (en orden)

1. **Arreglar el deploy de EasyPanel** (sin esto nada nuevo se ve). Verificar con `/api/version`.
2. Confirmado el deploy: probar el agente de clientes →
   - "¿qué canciones trae el paquete del Binomio?" → debe encadenar y dar las REALES.
   - "mi correo es X, ¿qué tutoriales tengo?" → idem.
   - Si aún inventa con el deploy al día → migrar la consulta del agente de clientes a
     **tool-calling** (como el operador, que es el método confiable).
3. **Crear perfiles con contraseña desde el operador**: NO se puede con `bd_crear_fila`
   (las contraseñas viven en `auth.users`, no en la tabla `perfiles`; además `perfiles.id`
   no se autogenera). Hay que implementar una tool que use la **API de Admin de Auth de
   Supabase** (crear usuario auth + fila en perfiles). Pendiente de construir.

---

## Datos útiles
- Repo: **Sass-CRM**, rama `main`.
- Cuenta de prueba (SaaS DB `wvkmxacnsnuuwcggbopv`): id `9fe317c1-d1b3-4c4a-a763-61f57b656c11`.
- Supabase academia: proyecto `tbijzvtyyewhtwgakgka`. `perfiles` usa `correo_electronico`
  y `whatsapp` (formatos mezclados). `cursos` usa `precio_normal` (no `precio`).
- Tablas habilitadas para el agente: perfiles, cursos, cursos_publicados, tutoriales,
  paquetes_tutoriales, paquetes_tutoriales_items, blog_articulos, inscripciones,
  membresias, suscripciones_usuario.
