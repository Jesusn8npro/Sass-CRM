# Sass-CRM — Agente WhatsApp multi-cuenta

CRM/SaaS multi-tenant para WhatsApp. Cada usuario maneja una o varias
cuentas (números) reales conectadas vía Baileys. Cada cuenta tiene su
propio prompt, modelo, voz, biblioteca de medios, conocimiento,
etiquetas, funnel y respuestas rápidas. La IA responde, agenda citas,
captura datos del cliente, transfiere a humano y dispara llamadas Vapi.

Todo el estado (auth, DB, storage, sesiones Baileys) vive en
**Supabase**.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Supabase** — Auth + Postgres + Storage
- **@whiskeysockets/baileys** — cliente WhatsApp Web (QR)
- **OpenAI** — chat con `response_format: json_schema` + tools
- **ElevenLabs** — TTS para notas de voz salientes
- **OpenAI Whisper** — transcripción de audios entrantes
- **Vapi** — llamadas IA salientes/entrantes
- **ffmpeg-static** — conversión a OGG/Opus para WhatsApp

---

## Requisitos

- **Node.js 20.9+** (recomendado 22, ver `.nvmrc`).
- Cuenta de **Supabase** con las migraciones aplicadas.
- Cuenta de **OpenAI** con API key.
- (Opcional) cuenta de **ElevenLabs** para notas de voz.
- (Opcional) cuenta de **Vapi** para llamadas IA.

---

## Configuración

```bash
git clone <repo>
cd AgenteNuevooWhatsApp
cp .env.example .env.local
# Editá .env.local con tus keys
npm install
npm run dev
```

Variables mínimas en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-2024-08-06
```

---

## Uso

```bash
npm run dev      # desarrollo
npm run build    # producción
npm run start
```

Abrí `http://localhost:3000`:

1. Signup con email + password.
2. Crear una cuenta WhatsApp (botón "+ Nueva cuenta").
3. Escanear QR desde el teléfono (WhatsApp → Dispositivos vinculados).
4. Ya recibe mensajes y responde con IA.

---

## Arquitectura

### Un solo proceso

`src/instrumentation.ts` (hook `register()` de Next) levanta el bot de
Baileys dentro del proceso de Next vía
[`src/lib/bot/cicloVida.ts`](src/lib/bot/cicloVida.ts). Se crean los
sockets de cada cuenta no archivada y se agendan los intervals
(bandeja de salida 2s, heartbeat 5s, sync de cuentas 3s).

El estado del ciclo de vida vive en `globalThis` para sobrevivir HMR
de dev y ser idempotente.

### Flujo de mensaje entrante (modo IA)

1. Llega al socket Baileys de la cuenta.
2. [`manejador.ts`](src/lib/baileys/manejador.ts) desempaqueta el
   mensaje, resuelve la identidad del remitente y descarga media si
   corresponde (audios → Whisper).
3. Inserta en `mensajes` con `rol='usuario'`.
4. Inicia un timer de buffer (`buffer_segundos` configurable) para
   agrupar mensajes rápidos.
5. Al disparar: arma el system prompt (rol del agente + contexto +
   conocimiento + biblioteca + funnel) y llama a OpenAI con schema
   estricto + 12 tools (capturar datos, agendar/cancelar cita, cambiar
   estado, etc.).
6. Cada parte de la respuesta se envía con delay y "escribiendo…". Si
   el modo es espejo (último mensaje del cliente fue audio), las
   partes se generan con voz vía ElevenLabs.
7. Si la IA decide `transferir_a_humano`, la conversación pasa a modo
   HUMANO y aparece badge en el panel.

### Mensajes salientes (panel → cliente)

Patrón outbox: la API guarda el mensaje en `mensajes` y lo encola en
`bandeja_salida`. El bot tiene un `setInterval` (2s) que lee la
bandeja, envía vía Baileys y marca `enviado=1`.

### Heartbeat

El bot escribe `cuentas.ultimo_heartbeat` cada 5s. El frontend deriva
`bot_vivo` (heartbeat fresco en últimos 30s).

---

## Personalización por cuenta

Desde **Configuración** podés ajustar:

- **General**: nombre del agente, rol, estilo de comunicación.
- **Mensajes**: bienvenida, fallback, palabras de handoff.
- **Captura**: campos custom que la IA debe extraer del cliente.
- **IA**: modelo, temperatura, max_tokens, prompt sistema avanzado.
- **Vapi**: credenciales y N assistants (vendedor/soporte/cobranza).
- **Conocimiento**: FAQs estructurados + upload .txt/.md/.pdf/.docx.
- **Biblioteca**: imágenes/videos/audios/PDFs que la IA cita por ID.
- **Funnel**: pasos del pipeline (4 plantillas pre-armadas).
- **Etiquetas**, **respuestas rápidas**, **voz** (ElevenLabs).

---

## Despliegue (EasyPanel / Railway sin Docker)

1. Subir el repo a GitHub.
2. App nueva apuntando al repo (detecta `nixpacks.toml`).
3. **Variables de entorno**: las mismas de `.env.example`.
4. **No hace falta volumen persistente** — toda la data vive en
   Supabase (Auth + Postgres + Storage). Sí conviene tener un volumen
   pequeño para `data/samples/` (cache de previews ElevenLabs), pero
   no es bloqueante.

---

## Solución de problemas

**Bot tira `code=440` en loop al conectar**

`connectionReplaced`. Causas:
- Hay un dispositivo viejo activo. WhatsApp → Dispositivos vinculados
  → cerrar los viejos.
- Si persiste, esperar 24h o cambiar IP del VPS.

**Bot tira `code=405`**

Versión de Baileys vieja vs protocolo de WhatsApp Web.
`fetchLatestBaileysVersion()` lo soluciona en runtime, sino:

```bash
npm install @whiskeysockets/baileys@latest
```

**ElevenLabs 402 `paid_plan_required`**

Estás usando voz de tu biblioteca personal. El plan free solo permite
voces default (Sarah, Aria, Rachel, Adam, Antoni). Cambiar voz o
cargar créditos.

**Audio llega como "Este audio ya no está disponible"**

Faltan campos `seconds` y `waveform` al enviar (Baileys 6.7.9+ los
exige), o el formato no es OGG/Opus mono 16kHz. Revisar
`asegurarFormatoVoz` en
[`baileys/conversion.ts`](src/lib/baileys/conversion.ts).

---

## Licencia

Uso personal / educativo.
