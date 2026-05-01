# Agente WhatsApp

Agente de WhatsApp local que se conecta a un número real vía Baileys
(no Meta API, no Twilio) y responde mensajes con un LLM. Incluye un
panel local para ver las conversaciones, leer el historial, intervenir
manualmente y togglear cada chat entre modo IA y modo Humano.

Todo corre en localhost. La data vive en SQLite (archivo local). La
sesión de WhatsApp Web la guarda Baileys en una carpeta local.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **@whiskeysockets/baileys** — cliente WhatsApp Web vía QR
- **better-sqlite3** — base de datos local
- **OpenRouter** vía SDK de OpenAI (apuntando a `openrouter.ai/api/v1`)
- **tsx** — para ejecutar scripts TypeScript directamente
- **concurrently** — para correr bot + Next.js juntos en producción

---

## Requisitos

- **Node.js 20.9+** (recomendado: Node 22, ver `.nvmrc`).
- Una cuenta de **OpenRouter** con créditos y una API key.

---

## Configuración

1. Clona el proyecto y entra a la carpeta:

   ```bash
   cd AgenteNuevooWhatsApp
   ```

2. Copia el archivo de entorno:

   ```bash
   cp .env.example .env.local
   ```

3. Edita `.env.local` y pon tu API key de OpenRouter:

   ```
   OPENROUTER_API_KEY=sk-or-tu-clave
   OPENROUTER_MODEL=openai/gpt-4o-mini
   ```

   **Importante sobre el modelo:** se recomienda `openai/gpt-4o-mini`.
   Los modelos `:free` de OpenRouter tienen rate limits muy estrictos
   (50 requests/día sin créditos cargados) y van a fallar con error
   429 en producción real. `openai/gpt-4o-mini` cuesta centavos por
   mes para uso normal ($0.15 por millón de tokens).

4. Instala dependencias:

   ```bash
   npm install
   ```

   Tarda ~1 minuto la primera vez por la compilación nativa de
   `better-sqlite3`.

---

## Uso (desarrollo local)

Necesitas dos terminales:

**Terminal 1 — el bot de WhatsApp:**

```bash
npm run start:bot
```

**Terminal 2 — el panel web:**

```bash
npm run dev
```

Abre `http://localhost:3000`:

1. La primera vez verás una pantalla "Conectar tu número" con un QR.
2. En tu teléfono: WhatsApp → Ajustes → Dispositivos vinculados →
   Vincular un dispositivo. Escanea el QR.
3. La pantalla transiciona automáticamente al panel cuando la
   conexión se establece.

---

## Uso (producción con un solo proceso)

```bash
npm run build
npm run start:all
```

`start:all` levanta el bot y Next.js en paralelo con `concurrently`.

---

## Cómo funciona

### Flujo de mensajes entrantes

1. Alguien escribe a tu WhatsApp.
2. El bot guarda el mensaje en SQLite con `role='user'`.
3. Si la conversación está en modo **IA**: llama a OpenRouter con el
   historial reciente + el system prompt, guarda la respuesta como
   `role='assistant'` y la envía vía Baileys.
4. Si la conversación está en modo **Humano**: solo guarda el mensaje
   y NO responde. Tú respondes manualmente desde el panel.

### Mensajes desde el panel (modo Humano)

Como bot y Next.js corren en procesos distintos y no comparten
memoria, las API routes no pueden llamar `sock.sendMessage()`
directamente. El flujo es:

1. POST a `/api/mensajes/[id]` con el contenido.
2. La API inserta el mensaje en `messages` con `role='human'` (visible
   en el dashboard) y lo encola en `outbox` con `sent=0`.
3. El proceso bot tiene un `setInterval` cada 2s que lee el `outbox`,
   envía cada item por Baileys y marca `sent=1`. Si falla, deja el
   item pendiente y reintenta en el siguiente tick.

### Polling

El frontend hace polling cada 2 segundos a:
- `/api/conexion/status` — estado de conexión + QR PNG.
- `/api/conversaciones` — lista de chats.
- `/api/mensajes/[id]` — mensajes del chat seleccionado.

No usa WebSocket en v1.

---

## Personalizar el system prompt

Edita `src/lib/promptSistema.ts`. Por defecto:

```typescript
export const PROMPT_SISTEMA = `
Eres un asistente virtual amable. Responde en español neutro,
en mensajes breves de 2 a 4 líneas. No uses emojis.
Si el usuario pide algo que no puedes resolver, responde:
"Déjame derivarte con un asesor humano."
`.trim();
```

Reemplázalo con el prompt de tu negocio. El bot se reinicia solo
cuando relances `npm run start:bot`.

---

## Estructura del proyecto

```
agente-whatsapp/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # renderiza PuertaConexion
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── conexion/
│   │       │   ├── status/route.ts        # GET estado + QR PNG
│   │       │   └── disconnect/route.ts    # POST desconectar
│   │       ├── conversaciones/
│   │       │   ├── route.ts               # GET lista
│   │       │   └── [idConversacion]/route.ts  # DELETE
│   │       ├── mensajes/
│   │       │   └── [idConversacion]/route.ts  # GET + POST
│   │       └── modo/
│   │           └── [idConversacion]/route.ts  # POST cambia AI/HUMAN
│   ├── components/
│   │   ├── PuertaConexion.tsx
│   │   ├── PantallaQR.tsx
│   │   ├── EncabezadoPanel.tsx
│   │   ├── ListaConversaciones.tsx
│   │   ├── PanelConversacion.tsx
│   │   ├── BurbujaMensaje.tsx
│   │   └── InterruptorModo.tsx
│   └── lib/
│       ├── baseDatos.ts                   # SQLite + DDL + helpers
│       ├── openrouter.ts                  # cliente OpenRouter
│       ├── promptSistema.ts               # prompt del LLM
│       └── baileys/
│           ├── cliente.ts                 # socket Baileys + state machine
│           └── manejador.ts               # handler messages.upsert + outbox
├── scripts/
│   ├── cargador-entorno.ts                # CRÍTICO: side-effect import
│   └── iniciar-bot.ts                     # entrypoint del bot
├── data/                                  # SQLite (gitignored)
├── auth/                                  # sesión Baileys (gitignored)
├── .env.local
├── package.json
├── Procfile                               # deploy
├── nixpacks.toml                          # deploy EasyPanel/Railway
└── .nvmrc
```

---

## Despliegue (EasyPanel / Railway sin Docker)

1. Subí el repo a GitHub.
2. En EasyPanel, creá una app desde el repo.
3. Asegurate de que detecte `nixpacks.toml`.
4. **Volúmenes persistentes obligatorios:**
   - `/app/data` — para que las conversaciones sobrevivan al
     redeploy.
   - `/app/auth` — para que la sesión de WhatsApp sobreviva al
     redeploy. Sin esto, cada redeploy obliga a re-escanear el QR.
5. Variables de entorno: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`.

---

## Seguridad — sin auth en el panel

⚠️ **Bloqueante para producción pública**

El panel **no tiene autenticación**. Si vas a desplegarlo a internet,
**antes** poné:

- Basic auth a nivel proxy (Caddy / Nginx / EasyPanel app).
- O Cloudflare Access / un túnel privado.

Sin esto, **cualquiera con la URL puede leer todas las conversaciones
de WhatsApp y enviar mensajes haciéndose pasar por vos**.

---

## Solución de problemas

**El bot tira `code=440` en loop al conectar**

Code 440 es `connectionReplaced`. Causas:
- El `browser` fingerprint no es el correcto. Verificá que
  `cliente.ts` use `Browsers.macOS('Desktop')`.
- Hay un dispositivo viejo de pruebas activo. En tu teléfono:
  WhatsApp → Ajustes → Dispositivos vinculados → cerrá los viejos.
- Si persiste, cambiá la IP del VPS o esperá 24h.

**El bot tira `code=405` al conectar**

Versión de Baileys desactualizada vs el protocolo de WhatsApp Web.
`fetchLatestBaileysVersion()` en `cliente.ts` lo soluciona en runtime,
pero si la cache de npm está vieja, corré:

```bash
npm install @whiskeysockets/baileys@latest
```

**El LLM tira 429 (Too Many Requests)**

Estás usando un modelo `:free` y saturó la cuota diaria. Cambiá
`OPENROUTER_MODEL` a `openai/gpt-4o-mini` y cargá créditos en
OpenRouter ($1–$5 alcanzan para meses de uso normal).

**`OPENROUTER_API_KEY undefined` en el bot**

El cargador de entorno no se ejecutó antes de que `openrouter.ts`
leyera la variable. Verificá que la primera línea de
`scripts/iniciar-bot.ts` sea:

```typescript
import "./cargador-entorno";
```

Sin nada antes. Los `import` se hoistean al top del archivo, y este
módulo es side-effect-only para garantizar que `process.env` se puebla
antes que cualquier otro `import`.

**Procesos zombies en Windows**

`Ctrl+C` en `start:all` no siempre mata los hijos de `tsx` y `next`
en Windows. Si quedan colgando:

```powershell
tasklist | findstr node
taskkill /PID <pid> /F
```

---

## Mejoras pendientes (v2)

- Soporte para enviar imágenes desde el panel.
- Function calling con `tools` de OpenRouter (ej: agendar citas).
- Auto-toggle a Humano cuando el bot detecta una frase específica
  (regex en `manejador.ts`).
- WebSocket en lugar de polling.
- Auth básica integrada al middleware de Next.js.
- Soporte para grupos.
- Soporte para mensajes de audio / imagen entrantes (transcripción
  automática vía Whisper).
- Métricas: tokens consumidos, latencia del LLM, % de respuestas.

---

## Licencia

Uso personal / educativo.
#   S a s s - C R M  
 