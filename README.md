# Sass-CRM — Agente WhatsApp multi-cuenta

CRM/SaaS local para WhatsApp. Conecta uno o varios números reales vía
Baileys (no Meta API, no Twilio), responde con un LLM (OpenAI), envía
notas de voz con ElevenLabs y transcribe los audios entrantes con
Whisper. Cada número (cuenta) tiene su propio prompt, modelo, voz,
biblioteca de medios, conocimiento, etiquetas y respuestas rápidas.

Todo corre en localhost / VPS. La data vive en SQLite. Las sesiones de
Baileys se guardan por cuenta en `auth/{idCuenta}/`.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **@whiskeysockets/baileys** — cliente WhatsApp Web vía QR
- **better-sqlite3** — base de datos local
- **OpenAI** (chat completions con `response_format: json_schema`)
- **ElevenLabs** — TTS para notas de voz salientes
- **OpenAI Whisper** — transcripción de audios entrantes
- **ffmpeg-static** — conversión a OGG/Opus para WhatsApp
- **tsx** + **concurrently** — bot y panel en paralelo

---

## Requisitos

- **Node.js 20.9+** (recomendado: 22, ver `.nvmrc`).
- Cuenta de **OpenAI** con API key.
- (Opcional, para audio saliente) cuenta de **ElevenLabs** con API key.

---

## Configuración

1. Cloná el repo y entrá a la carpeta:

   ```bash
   git clone https://github.com/Jesusn8npro/Sass-CRM.git
   cd Sass-CRM
   ```

2. Copiá el archivo de entorno:

   ```bash
   cp .env.example .env.local
   ```

3. Editá `.env.local`:

   ```
   OPENAI_API_KEY=sk-proj-...
   OPENAI_MODEL=gpt-4o-mini
   ELEVENLABS_API_KEY=sk_...
   ```

   Si no vas a usar audio TTS podés dejar `ELEVENLABS_API_KEY` vacío.

4. Instalá dependencias:

   ```bash
   npm install
   ```

   Tarda ~1 minuto la primera vez por la compilación nativa de
   `better-sqlite3`.

---

## Uso

Necesitás dos procesos: el bot (sockets de Baileys) y el panel
(Next.js). En desarrollo abrí dos terminales:

**Terminal 1 — bot:**

```bash
npm run start:bot
```

**Terminal 2 — panel:**

```bash
npm run dev
```

Abrí `http://localhost:3000`:

1. La primera vez verás el panel vacío. Creá una cuenta con el botón
   **"+ Nueva cuenta"** y poné una etiqueta (ej: "Ventas", "Soporte").
2. Aparece la pantalla **Conectar tu número** con un QR.
3. En tu teléfono: WhatsApp → Ajustes → Dispositivos vinculados →
   Vincular un dispositivo. Escaneá el QR.
4. La pantalla pasa al panel cuando la conexión se establece.
5. Repetí para cada número adicional.

Para producción (un solo proceso con `concurrently`):

```bash
npm run build
npm run start:all
```

---

## Cómo funciona

### Arquitectura de dos procesos

- **Bot** (`scripts/iniciar-bot.ts`): mantiene los sockets de Baileys,
  procesa mensajes entrantes, llama a OpenAI/ElevenLabs/Whisper, envía
  respuestas, drena la bandeja de salida y emite heartbeats.
- **Panel** (`next dev`/`next start`): API routes y UI. No tiene
  acceso directo a los sockets.

Ambos procesos se comunican **solo por SQLite** (`data/`) y archivos
locales (`data/media/`, `data/biblioteca/`, `auth/`).

### Flujo de mensaje entrante

1. Llega un mensaje al socket Baileys de la cuenta.
2. `manejador.ts` desempaqueta el mensaje (ephemeral, viewOnce,
   documentWithCaption, etc.) y resuelve la identidad del remitente
   (incluyendo `@lid` vía `senderPn`/`remoteJidAlt`).
3. Si es media (imagen, video, audio, documento) se descarga a
   `data/media/{idCuenta}/`. Los audios se transcriben con Whisper.
4. Se inserta el mensaje en la tabla `mensajes` con `rol='usuario'`.
5. Si la conversación está en modo **IA**:
   - Se inicia un timer de buffer (`buffer_segundos`, configurable
     por cuenta) para agrupar mensajes rápidos.
   - Al disparar, se construye el prompt sistema (prompt base +
     contexto de negocio + entradas de conocimiento + biblioteca de
     medios disponible) y se llama a OpenAI con un schema estricto:

     ```json
     {
       "partes": [
         { "tipo": "texto", "contenido": "...", "media_id": "" },
         { "tipo": "media", "contenido": "", "media_id": "promo_octubre" }
       ],
       "transferir_a_humano": { "activar": false, "razon": "" }
     }
     ```
   - Cada parte se envía con un pequeño delay y "escribiendo..."
     para sentirse natural.
   - Si la conversación reciente fue por audio (modo espejo), las
     partes de texto se generan con voz vía ElevenLabs y se envían
     como nota de voz (OGG/Opus con duración + waveform).
   - Si `transferir_a_humano.activar=true`, la conversación pasa a
     modo HUMANO y aparece un badge rojo en el panel.
6. Si está en modo **HUMANO**: solo se guarda y se muestra el badge.
   Vos respondés desde el panel.

### Mensajes salientes desde el panel

Como bot y panel corren en procesos distintos, las API routes no
pueden llamar `sock.sendMessage()` directamente. Patrón outbox:

1. POST a `/api/cuentas/[id]/mensajes/[idConv]` (texto) o
   `/api/cuentas/[id]/mensajes/[idConv]/multimedia` (archivo).
2. La API guarda el mensaje en `mensajes` con `rol='humano'` (visible
   en el panel) y lo encola en `bandeja_salida` con `enviado=0`.
3. El bot tiene un `setInterval` cada 2s que lee `bandeja_salida`,
   envía cada item por Baileys y marca `enviado=1`.

### Heartbeat

El bot escribe `cuentas.ultimo_heartbeat` cada 5s para todas las
cuentas no archivadas. El panel deriva `bot_vivo` (heartbeat fresco
en los últimos 30s, con período de gracia para cuentas recién
creadas). Si el bot está caído, aparece un banner rojo colapsable.

### Polling

El frontend hace polling cada 2-3s a las API routes. No usa
WebSockets en v1.

---

## Personalizar cada cuenta

Ingresá a **Ajustes** desde el header de la cuenta. Podés configurar:

- **Identidad**: etiqueta interna.
- **Prompt sistema**: el rol/personalidad del agente.
- **Contexto de negocio**: información persistente (productos,
  precios, horarios) que se inyecta en cada llamada.
- **Conocimiento**: entradas estructuradas (título + contenido)
  para FAQs largos.
- **Comportamiento**: `buffer_segundos` para agrupar mensajes
  rápidos, modelo de OpenAI a usar.
- **Voz (ElevenLabs)**: ID de la voz para notas de voz salientes.
  El modo espejo solo se activa si el usuario mandó audios.
- **Respuestas rápidas**: atajos (`/saludo`, `/precios`) para el
  modo humano.
- **Etiquetas**: para clasificar conversaciones (caliente, pagó,
  seguimiento) con 8 colores.
- **Biblioteca de medios**: imágenes/videos/audios/PDFs subidos con
  un identificador y descripción. La IA decide cuándo enviar cada
  uno citándolos por `media_id`.
- **Avanzado**: archivar la cuenta (cierra el socket).

---

## Estructura del proyecto

```
Sass-CRM/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # PuertaConexion (orquestador)
│   │   ├── cuentas/[idCuenta]/configuracion/page.tsx
│   │   └── api/
│   │       ├── cuentas/                   # CRUD + sub-recursos por cuenta
│   │       │   └── [idCuenta]/
│   │       │       ├── conexion/{estado,desconectar}/route.ts
│   │       │       ├── conversaciones/route.ts
│   │       │       ├── conversaciones/[idConversacion]/{route,etiquetas}.ts
│   │       │       ├── mensajes/[idConversacion]/{route,multimedia}.ts
│   │       │       ├── modo/[idConversacion]/route.ts
│   │       │       ├── conocimiento/[idEntrada]/route.ts
│   │       │       ├── respuestas-rapidas/[idRespuesta]/route.ts
│   │       │       ├── etiquetas/[idEtiqueta]/route.ts
│   │       │       └── biblioteca/[idMedio]/route.ts
│   │       ├── media/[idCuenta]/[archivo]/route.ts
│   │       └── biblioteca/[idCuenta]/[archivo]/route.ts
│   ├── components/
│   │   ├── PuertaConexion.tsx
│   │   ├── BarraLateralCuentas.tsx
│   │   ├── EncabezadoCuenta.tsx
│   │   ├── BannerBotInactivo.tsx
│   │   ├── PantallaQR.tsx
│   │   ├── ListaConversaciones.tsx
│   │   ├── PanelConversacion.tsx
│   │   ├── BurbujaMensaje.tsx
│   │   ├── InterruptorModo.tsx
│   │   ├── InterruptorTema.tsx
│   │   ├── SelectorEmoji.tsx
│   │   ├── SelectorEtiquetas.tsx
│   │   ├── GrabadoraAudio.tsx
│   │   └── ModalNuevaCuenta.tsx
│   └── lib/
│       ├── baseDatos.ts                   # SQLite + DDL + helpers
│       ├── openai.ts                      # cliente + schema JSON
│       ├── elevenlabs.ts                  # TTS
│       ├── construirPrompt.ts             # arma el system prompt
│       ├── latidoBot.ts                   # heartbeat / bot_vivo
│       └── baileys/
│           ├── gestor.ts                  # GestorCuentas (multi-socket)
│           ├── manejador.ts               # messages.upsert + outbox
│           ├── medios.ts                  # download/save/transcribe
│           └── conversion.ts              # ffmpeg → OGG/Opus
├── scripts/
│   ├── cargador-entorno.ts                # CRÍTICO: side-effect import
│   └── iniciar-bot.ts                     # entrypoint del bot
├── data/                                  # SQLite + media (gitignored)
├── auth/                                  # sesiones Baileys (gitignored)
├── .env.local
├── package.json
├── nixpacks.toml                          # deploy EasyPanel/Railway
└── .nvmrc
```

---

## Despliegue (EasyPanel / Railway sin Docker)

1. Subí el repo a GitHub.
2. En EasyPanel, creá una app desde el repo.
3. Asegurate de que detecte `nixpacks.toml`.
4. **Volúmenes persistentes obligatorios:**
   - `/app/data` — conversaciones, media, biblioteca.
   - `/app/auth` — sesiones de WhatsApp. Sin esto, cada redeploy
     obliga a re-escanear el QR de cada cuenta.
5. Variables de entorno: `OPENAI_API_KEY`, `OPENAI_MODEL`,
   `ELEVENLABS_API_KEY`.

---

## Seguridad — sin auth en el panel

⚠️ **Bloqueante para producción pública**

El panel **no tiene autenticación**. Si vas a desplegarlo a internet,
**antes** poné:

- Basic auth a nivel proxy (Caddy / Nginx / EasyPanel app).
- O Cloudflare Access / túnel privado.

Sin esto, **cualquiera con la URL puede leer todas las conversaciones
y enviar mensajes haciéndose pasar por vos**.

---

## Solución de problemas

**El bot tira `code=440` en loop al conectar**

Code 440 = `connectionReplaced`. Causas:
- Hay un dispositivo viejo activo. En tu teléfono: WhatsApp →
  Dispositivos vinculados → cerrá los viejos.
- Si persiste, esperá 24h o cambiá la IP del VPS.
- El gestor reintenta con backoff de 15s para 440.

**El bot tira `code=405` al conectar**

Versión de Baileys desactualizada vs el protocolo de WhatsApp Web.
`fetchLatestBaileysVersion()` lo soluciona en runtime, pero si la
cache de npm está vieja:

```bash
npm install @whiskeysockets/baileys@latest
```

**ElevenLabs devuelve 402 `paid_plan_required`**

Estás usando una voz de tu **biblioteca personal**. El plan free de
ElevenLabs solo permite voces **default** (Sarah, Aria, Rachel,
Adam, Antoni, etc.). O cambiá a una voz default o cargá créditos.

**El audio llega como "Este audio ya no está disponible"**

Faltan los campos `seconds` y `waveform` al enviar (Baileys 6.7.9+
los exige). Verificá que `manejador.ts` los pase. También que
`asegurarFormatoVoz` esté convirtiendo a OGG/Opus mono 16kHz.

**`OPENAI_API_KEY undefined` en el bot**

El cargador de entorno no se ejecutó antes de que `openai.ts`
leyera la variable. Verificá que la primera línea de
`scripts/iniciar-bot.ts` sea:

```typescript
import "./cargador-entorno";
```

Sin nada antes. Es side-effect-only para garantizar que
`process.env` se puebla antes que cualquier otro `import`.

**Procesos zombies en Windows**

`Ctrl+C` en `start:all` no siempre mata los hijos en Windows:

```powershell
tasklist | findstr node
taskkill /PID <pid> /F
```

---

## Mejoras pendientes (v2)

- WebSocket en lugar de polling.
- Auth básica integrada al middleware de Next.js.
- Soporte para grupos.
- Métricas: tokens consumidos, latencia del LLM, % de respuestas.
- Function calling (agendar citas, consultar Supabase, etc.).
- Importar/exportar configuración de cuenta.

---

## Licencia

Uso personal / educativo.
