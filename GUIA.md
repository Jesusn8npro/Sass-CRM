# Guía Completa — Sass-CRM (Agente WhatsApp con IA)

Esta es la documentación oficial para usar la plataforma. Cubre **qué hace, cómo probar cada cosa, la lógica interna, cómo escalarlo y el estado de seguridad**.

---

## Índice

1. [Funcionalidades disponibles](#1-funcionalidades-disponibles)
2. [Setup inicial paso a paso](#2-setup-inicial-paso-a-paso)
3. [Cómo probar cada feature](#3-cómo-probar-cada-feature)
4. [Lógica interna — cómo funciona](#4-lógica-interna--cómo-funciona)
5. [Cómo crecerlo / escalar](#5-cómo-crecerlo--escalar)
6. [Estado de seguridad](#6-estado-de-seguridad)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Funcionalidades disponibles

### 🤖 Agente IA en WhatsApp
- **Multi-cuenta**: cada número de WhatsApp tiene su propio agente, prompt, voz, productos, llamadas, etc.
- **Visión multimodal**: el agente VE las imágenes que manda el cliente (productos, comprobantes, screenshots).
- **Voz bidireccional**: transcribe audios entrantes (Whisper) y responde con voz clonada (ElevenLabs).
- **Respuestas variadas**: la IA decide mezclar texto / audio / imágenes / videos en la misma respuesta para sentirse natural.
- **Multi-parte**: la respuesta se divide en mensajes separados con delays naturales.
- **Buffer inteligente**: agrupa mensajes rápidos del cliente (configurable por cuenta) antes de responder.
- **Handoff a humano**: cuando la IA detecta frustración o pedido explícito, marca conversación como "Necesita atención" y muestra badge rojo.
- **Modo IA / Humano**: switch por conversación. En modo Humano vos respondés desde el panel.
- **Iniciar nueva conversación** desde el panel (poniendo número + mensaje).

### 📞 Llamadas de voz (Vapi)
- Configuración por cuenta: API key, número Vapi, prompt extra para llamadas, primer mensaje custom, duración máxima, grabación on/off.
- **Llamada manual** desde botón en el chat.
- **Llamada automática por la IA** cuando el cliente acepta o la situación lo amerita.
- **Contexto compartido**: la llamada arranca con resumen de la conversación de WhatsApp ("Hola Juan, te llamo como te dije por WhatsApp...").
- **Cooldown 1h** por conversación para evitar acoso.
- **Webhook recibe** transcripción + grabación + resumen + costo automáticamente.
- **Test call**: llamada de prueba a tu propio número desde Ajustes.
- **Vista de llamadas** con audio reproducible, transcripción, resumen.

### 📋 Pipeline / Kanban
- Etapas customizables por cuenta (Nuevo → Contactado → Interesado → Negociando → Cerrado / Perdido por defecto).
- **Drag-drop** de conversaciones entre columnas.
- Renombrar etapas inline, cambiar color, reordenar, borrar.
- Cards muestran avatar, preview, etiquetas, badges (atención).

### 📊 Dashboard CRM
- KPIs: conversaciones totales, atención, mensajes hoy, productos activos.
- Gráfico de barras: mensajes por día (últimos 7).
- Inversión total acumulada por moneda.
- **Productos más preguntados**: ranking con número de interesados.
- Distribución por etapa pipeline + por etiquetas.
- Tabla de emails y teléfonos capturados con export CSV.

### 🛍 Productos
- Catálogo completo por cuenta: nombre, descripción, precio, moneda, stock, costo, SKU, categoría.
- **Imagen + video** subibles durante creación.
- **Etiqueta SIN STOCK** automática si stock = 0.
- **Pausar/activar** producto.
- La IA ve el catálogo en su prompt → puede recomendar y cotizar con precios reales.
- **Tracking automático**: cuando cliente pregunta por un producto, queda registrado quién está interesado.
- Página de **interesados por producto**.

### 💰 Inversiones
- Registro de gastos del negocio (publicidad, inventario, salarios, etc).
- Categorías sugeridas, fecha, multi-moneda.
- Resúmenes por moneda y por categoría.

### 👤 Cliente 360
- Vista consolidada por contacto: datos, etapa, etiquetas, productos de interés, llamadas, últimos 15 mensajes.
- Estadísticas: total mensajes, respondidos por IA vs humano, llamadas.
- Botones rápidos: abrir chat, llamar.

### 🏷 Etiquetas
- Etiquetas con colores (8 colores) por cuenta.
- Asignación drag-drop o desde el chat.

### 📚 Biblioteca de medios
- Pre-cargás imágenes/videos/audios/PDFs con un identificador.
- La IA decide cuándo enviarlos en la conversación (ej: catálogo, video demo).

### 📧 Captura de leads
- **Emails**: detectados automáticamente en mensajes entrantes con regex + clasificación de validez (sospechoso si tiene typo en dominio).
- **Teléfonos**: capturados cuando el cliente menciona otro número (no el propio).
- Export CSV.

### 💬 Voz / ElevenLabs
- Voice ID configurable por cuenta.
- **Preview** de voces sin gastar créditos (usa MP3 gratis de ElevenLabs).
- **Clonado** de voz: grabás 30-90s desde el panel, ElevenLabs crea tu voz personalizada.
- Auto-fallback de muestra TTS español si la voz clonada todavía no tiene preview oficial.

### ⏰ Seguimientos programados (anti-ban)
- Mensajes futuros para re-enganchar clientes que dijeron "te aviso".
- **Anti-ban automático**:
  - Solo a clientes que escribieron antes.
  - Si responde antes del horario → se cancela.
  - Máximo 80 mensajes/día por cuenta.
  - Solo entre 8am y 10pm.
- **La IA puede crearlos** automáticamente (cuando detecta promesa de respuesta futura).
- Vista de pendientes + histórico con razones de cancelación.

### 📅 Agenda / Citas
- CRUD de citas con cliente, fecha, hora, duración, tipo, notas, estado (agendada/confirmada/realizada/cancelada/no_asistio).
- **Recordatorio automático 1h antes**: el bot le manda un mensaje al cliente.
- **La IA puede agendar** automáticamente cuando el cliente confirma fecha/hora.
- Vista por día con histórico.

---

## 2. Setup inicial paso a paso

### Requisitos
- Node 20.9+ (recomendado 22)
- Cuenta OpenAI con créditos
- (Opcional) Cuenta ElevenLabs para voz
- (Opcional) Cuenta Vapi + número Twilio para llamadas

### Variables de entorno (`.env.local`)

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini

# Opcional — voz del agente
ELEVENLABS_API_KEY=sk_...

# Opcional — webhooks de Vapi (URL pública del panel)
VAPI_PUBLIC_URL=https://tu-dominio.com
```

⚠️ **Las API keys NO se ponen acá** para servicios per-cuenta (Vapi, ElevenLabs voice ID). Se configuran desde el panel para que cada negocio tenga la suya.

### Arrancar

```bash
npm install
npm run dev
```

Abrís `http://localhost:3000`.

### Primera cuenta

1. Click "+ Nueva cuenta" → poné etiqueta (ej: "Mi negocio").
2. Aparece QR → escanealo con WhatsApp en tu teléfono (Dispositivos vinculados).
3. Listo, ya recibís y respondés mensajes.

### Configurar el agente (Ajustes)

- **Prompt sistema**: personalidad, reglas, tono.
- **Contexto del negocio**: descripción, productos generales, precios.
- **Conocimiento estructurado**: FAQs en formato título + contenido.
- **Voz** (opcional): Voice ID de ElevenLabs.
- **Comportamiento**: buffer en segundos para agrupar mensajes.
- **Llamadas (Vapi)**: API key + Phone Number ID + sincronizar.

---

## 3. Cómo probar cada feature

### Visión (imágenes)
1. Mandá una foto de cualquier producto/screenshot por WhatsApp.
2. El bot responde describiéndolo o respondiendo sobre lo que ve.

### Audio bidireccional
1. Necesitás Voice ID configurado en Ajustes → Voz.
2. Mandá un audio.
3. El bot transcribe + responde con voz clonada.

### Productos
1. Vas a Productos → + Nuevo.
2. Llenás nombre, precio, stock, descripción + imagen + video opcional.
3. Click Crear.
4. Mandate un WhatsApp tipo "¿tenés [tu producto]?" → el bot responde con datos reales del catálogo.
5. En Cliente 360 vas a ver "Productos de interés" con ese producto.

### Pipeline
1. Vas a Pipeline → arrastrás conversaciones entre columnas.
2. Click en nombre de columna → renombrar inline.
3. + Nueva etapa para agregar (ej: "Demo agendada").

### Llamadas Vapi
1. Ajustes → Llamadas → pegás API key Vapi → Buscar mis números → seleccionás uno → Crear assistant.
2. Configuración avanzada (opcional): prompt extra para llamadas, primer mensaje, duración máxima.
3. Botón "Probar voz" en Ajustes → poné tu propio teléfono → suena.
4. En cualquier chat: botón **📞 Llamar** → confirmar → llamada saliente con contexto de la conversación.
5. Esperar a que termine → en /llamadas ver transcripción, grabación, resumen.

### Seguimientos programados
1. **Manualmente**: desde una conversación, podés crear uno con la API directamente (UI pendiente).
2. **Automáticamente**: cuando un cliente diga "te aviso el viernes", la IA lo crea sola.
3. Vas a Más → Seguimientos → ver pendientes y cancelar si querés.
4. Anti-ban: solo se manda si el cliente NO respondió antes del horario.

### Agenda
1. Más → Agenda → + Nueva cita.
2. Llenás datos.
3. Si el cliente tiene número y conversación asociada, le llega recordatorio automático 1h antes.
4. La IA agenda sola cuando el cliente confirma fecha/hora ("Sí, el martes a las 3pm me viene").

### Cliente 360
1. En cualquier chat → botón **Perfil** (icono usuario en el header).
2. Vista consolidada con todo lo del cliente.

### Inversiones
1. Más → Inversiones → + Registrar gasto.
2. Llenás concepto, monto, categoría.
3. Aparece en dashboard.

### Captura de emails/teléfonos
1. Mandá por WhatsApp algo tipo "mi correo es juan@gmail.com" o "llamame al +54 9 11 1234-5678".
2. Vas al Dashboard → tabla de Emails capturados / Teléfonos capturados.
3. Botón Exportar CSV.

---

## 4. Lógica interna — cómo funciona

### Arquitectura general

```
┌─────────────────────────────────────┐
│         Next.js (UI + APIs)         │
│  ┌──────────────────────────────┐   │
│  │   instrumentation.ts         │   │  ← arranca el bot al iniciar
│  │   ↓                          │   │
│  │   src/lib/bot/cicloVida.ts   │   │
│  │   - sockets Baileys          │   │
│  │   - bandeja outbox           │   │
│  │   - heartbeat                │   │
│  │   - seguimientos scheduler   │   │
│  │   - recordatorios citas      │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
          ↑                ↓
     SQLite (data/)    Whisper / OpenAI / ElevenLabs / Vapi
```

**Un solo proceso** Next.js corre todo. Bot + UI + APIs + scheduler. La instrumentation hook (`src/instrumentation.ts`) arranca el bot al iniciar el server. No hace falta abrir terminales separadas.

### Flujo de un mensaje entrante

1. **Baileys** recibe mensaje de WhatsApp.
2. `manejador.ts` desempaqueta wrappers (ephemeral, viewOnce, etc.) y resuelve identidad (incluyendo `@lid`).
3. Extracción: si es media, descarga + transcribe (Whisper) o detecta tipo (imagen/video/audio/doc).
4. Guarda en `mensajes` con `rol='usuario'`.
5. Extrae emails/teléfonos del texto → `contactos_email` / `contactos_telefono`.
6. Si conv en modo IA → arranca buffer (configurable en segundos por cuenta).
7. Cuando el buffer expira:
   - Carga prompt completo: cuenta + contexto + conocimiento + biblioteca + **catálogo de productos** + instrucciones de formato.
   - Carga historial reciente (20 mensajes) con visión multimodal para imágenes.
   - Llama a OpenAI con `response_format: json_schema` strict.
   - Recibe JSON con `partes`, `transferir_a_humano`, `iniciar_llamada`, `productos_de_interes`, `programar_seguimiento`, `agendar_cita`.
8. Por cada parte: envía con delay calculado por largo + presence updates.
9. Si la AI activó: handoff humano / llamada Vapi / seguimiento / cita → ejecuta acciones.

### Schema strict de la AI

La IA siempre devuelve este JSON:

```json
{
  "partes": [{ "tipo": "texto|audio|media", "contenido": "...", "media_id": "..." }],
  "transferir_a_humano": { "activar": false, "razon": "" },
  "iniciar_llamada": { "activar": false, "razon": "" },
  "productos_de_interes": ["1", "5"],
  "programar_seguimiento": { "activar": true, "fecha_iso": "2026-05-03T15:00:00", "contenido": "...", "razon": "..." },
  "agendar_cita": { "activar": false, "fecha_iso": "", "duracion_min": 0, "tipo": "", "notas": "" }
}
```

### Anti-ban en seguimientos

Cada 30s el scheduler revisa seguimientos pendientes:
- Verifica que sea horario humano (8am-10pm).
- Cuenta debe estar conectada y no archivada.
- Cliente NO respondió desde que se creó (sino se cancela).
- Cuenta no superó 80 mensajes hoy (sino queda pending para mañana).
- Encola en bandeja_salida → la cola los manda con su propio rate de 2s.

### Llamadas Vapi con contexto

Cuando se inicia una llamada (manual o IA):
- Se construye resumen de los últimos 15 mensajes de la conversación.
- Se manda como `assistantOverrides.model.messages[0]` (sistema extra).
- `firstMessage` se personaliza con nombre del cliente y referencia a WhatsApp.
- El assistant Vapi sabe exactamente qué hablaron y continúa desde ahí.

### Storage local

- `data/messages.db` → SQLite con todo (PRAGMA journal_mode=WAL para concurrencia).
- `data/media/<idCuenta>/` → archivos enviados/recibidos por WhatsApp.
- `data/biblioteca/<idCuenta>/` → biblioteca de medios del agente.
- `data/productos/<idCuenta>/` → imágenes y videos de productos.
- `data/samples/<voiceId>.mp3` → cache de muestras TTS para preview.
- `auth/<idCuenta>/` → sesiones Baileys persistentes (no perder al redeploy).

---

## 5. Cómo crecerlo / escalar

### Cuándo migrar a Postgres + Supabase

Hoy con SQLite estás bien hasta:
- 10-20 cuentas concurrentes (1 sola instancia).
- Tráfico moderado (~100-500 mensajes/min).
- Un solo servidor / VPS.

**Migrar cuando:**
- Quieras vender el SaaS a clientes externos (multi-tenant con auth).
- Necesites múltiples servidores.
- Pases los 1GB de datos.
- Quieras realtime (subscripciones).

**Plan:**
1. Cambiar driver: `better-sqlite3` → `pg` o Supabase client.
2. El schema es 99% compatible (Postgres acepta nuestros tipos).
3. Mover `data/media/`, `data/productos/`, etc. a Supabase Storage (1GB free, $0.021/GB).
4. Auth con Supabase Auth (gratis 50k usuarios/mes).
5. RLS para aislamiento por usuario.

Esfuerzo: ~2-3 días bien hechos.

### Roadmap pendiente

| Fase | Feature | Estado |
|---|---|---|
| **Fase 6** | Multi-tenant + Auth (login email/pw + roles) | Pendiente |
| **Fase 7** | Pagos (MercadoPago / Stripe + tabla `pedidos`) | Pendiente |
| **Fase 8** | Broadcasts masivos con plantillas | Pendiente |
| **Fase 9** | Webhooks salientes (Zapier/n8n/Make) | Pendiente |
| **Fase 10** | Flow builder visual (React Flow) | Pendiente |
| **Bonus** | App móvil (React Native) | Lejos |

### Qué optimizar cuando crezca el volumen

1. **Mensajes por día**: si pasan los 500/día, agregar particionamiento de la tabla `mensajes` (por mes) o archivar las viejas.
2. **Imágenes**: las imágenes de productos viven en disco. Mover a CDN (Cloudflare R2, Bunny CDN, Supabase Storage) cuando crezca.
3. **Embeddings**: para que el agente "recuerde" conversaciones lejanas, agregar embeddings de mensajes en pgvector.
4. **Caché**: Redis para los listados de productos y catálogos que se consultan en cada mensaje.
5. **Background jobs**: si los seguimientos crecen mucho, mover a una cola tipo BullMQ.

### Costos aproximados al escalar

Asumiendo 100 conversaciones diarias activas, 500 mensajes/día:

| Servicio | Uso | Costo aprox/mes |
|---|---|---|
| OpenAI gpt-4o-mini | 100 calls/día * 30 = 3k calls, ~10k tokens c/u | ~$5 |
| Whisper transcripción | 100 audios * 30s | ~$2 |
| ElevenLabs TTS | 50 audios bot/día * 30 = 1.5k chars/día | $5-22 según plan |
| Vapi llamadas | 5 llamadas/día * 30 * 3min | $30-50 |
| EasyPanel VPS | shared 2GB RAM | $5-10 |
| **Total** | | **$45-90/mes** |

---

## 6. Estado de seguridad

### ⚠️ Lo que falta (CRÍTICO antes de exponer públicamente)

1. **No hay autenticación.** Cualquier persona con la URL de tu deploy puede acceder al panel completo. **Mitigá AHORA** con uno de estos:
   - **Basic Auth en EasyPanel** (config nginx/caddy, 5 min).
   - **Cloudflare Access** (gratis, OAuth con Google).
   - **Túnel privado** (ngrok auth, Tailscale).

2. **Sin login multi-usuario.** Todas las cuentas de WhatsApp son del mismo dueño. Si querés vender el SaaS, hay que implementar Fase 6.

3. **Las API keys per-cuenta están en SQLite plano.** No están encriptadas en reposo. Si alguien tiene acceso al archivo `data/messages.db`, las ve. Mitigaciones:
   - Que el archivo esté en volumen privado (✓ ya está en EasyPanel).
   - Ideal: encriptar columnas sensibles con `aes-256-gcm` y master key en `.env`. Pendiente.

### ✅ Lo que está OK

- **Path traversal**: los endpoints que sirven archivos (`/api/media/*`, `/api/productos/*`, `/api/biblioteca/*`) validan con regex que no haya `..`, `/`, `\`.
- **Inyección SQL**: 100% de las queries usan prepared statements de `better-sqlite3`. No hay concatenación de strings.
- **Validación de input**: cada API valida tipos antes de usarlos. Strings se trim, números se clampean, IDs se chequean contra `Number.isFinite`.
- **CSRF**: las APIs reciben JSON con headers `Content-Type` controlados. POST sin form html clásico.
- **Webhook Vapi verificado**: cada cuenta tiene su `vapi_webhook_secret` único, validado en el header `x-vapi-secret`.
- **Cooldown llamadas**: 1h entre llamadas a la misma conversación para evitar acoso.
- **Anti-ban WhatsApp**: solo a quien escribió antes, máx 80/día/cuenta, horario humano.
- **Rate limit OpenAI**: lo gestiona el SDK; nuestro código maneja errores y reintenta.
- **Auth Baileys**: archivo `auth/<idCuenta>/` no se commitea, vive en volumen persistente.

### 🔒 Para hacer producción-ready

1. **Auth en panel** (Basic Auth o NextAuth) — bloqueante.
2. **HTTPS obligatorio** (EasyPanel lo da gratis con Let's Encrypt).
3. **Backup automático** del archivo `data/messages.db` (cron diario a S3 / Backblaze).
4. **Logs centralizados** (el VPS borra los logs del proceso si reinicia).
5. **Encriptar API keys** en DB con master key.
6. **Audit log**: qué usuario hizo qué cambio (cuando haya multi-usuario).
7. **Rate limiting** en las APIs públicas (express-rate-limit / upstash).
8. **Validación de webhook Vapi** con HMAC (opcional, ya verificamos secret).

---

## 7. Troubleshooting

### El QR no aparece
- Verificá que `OPENAI_API_KEY` esté en `.env.local`.
- Reiniciá Next: `Ctrl+C` + `npm run dev`.
- Si Baileys tira `code=440` en loop, esperá 24h o cambiá la IP del server.

### El bot no responde
- ¿Está en modo IA? (switch en el header del chat).
- ¿La cuenta está conectada? (badge verde en sidebar).
- Revisá los logs: `[bot:Lapeira] llamando LLM con N mensajes...`.
- Si dice `OPENAI_API_KEY undefined`, falta la env var.

### El audio no llega como nota de voz
- Tiene que estar en formato OGG/Opus. Si llega como documento, faltó conversión ffmpeg.
- Verificá que `ffmpeg-static` esté instalado: `npm ls ffmpeg-static`.
- En logs del bot: buscá `🔄 TTS convertido a OGG/Opus`. Si falla, mostrá el error.

### Vapi no llega webhook con transcripción
- Vapi necesita una URL pública para mandar webhooks. En dev usá `ngrok` y poné `VAPI_PUBLIC_URL` en `.env.local`.
- Verificá en `dashboard.vapi.ai/calls` que la llamada haya terminado.
- El webhook secret se valida — tienen que coincidir.

### "Bot inactivo" rojo en el panel
- El bot no manda heartbeats. Reiniciá Next.
- Si persiste, mirá la consola para ver el error.

### La IA no ve las imágenes
- Verificá que `OPENAI_MODEL` sea multimodal (`gpt-4o-mini` o superior).
- Buscá en logs `[openai] 👁  visión: ...` para confirmar que se manda al modelo.

### Seguimiento programado no se envió
- ¿Pasó el horario 8am-10pm? El scheduler solo manda en horario humano.
- ¿La cuenta está conectada y no archivada?
- ¿El cliente respondió antes? (se cancela automáticamente, ver razón en /seguimientos).
- ¿Superó 80 mensajes hoy? (queda pendiente para mañana).

### Productos no aparecen al mandar mensaje al bot
- Que estén `esta_activo = 1`.
- Reiniciá Next para que tome el catálogo en el prompt.
- Buscá en logs `🛍 interés registrado` para confirmar que la IA los detecta.

---

## Soporte

Repo: https://github.com/Jesusn8npro/Sass-CRM

Issues / mejoras: abrí un issue en GitHub o contactame por WhatsApp.

---

*Última actualización: Sass-CRM Fase 5 completada.*
