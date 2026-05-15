# PROCESO — Pipeline de Prospección Automática
**Última actualización:** 14 de Mayo de 2026  
**Proyecto:** Sass-CRM (AgenteNuevooWhatsApp)  
**Repo:** https://github.com/Jesusn8npro/Sass-CRM  
**Deploy:** https://app-contabilidad-sass-crm.lnrubg.easypanel.host

---

## ¿Qué construimos?

Un pipeline completo de **cold outreach automático** integrado al SaaS de WhatsApp CRM:

```
Google Maps (Apify scraping)
       ↓
  leads_extraidos (DB)
       ↓
  Orquestador (cada 5 min, respeta horario laboral, delay entre llamadas)
       ↓
¿Tiene teléfono?
  SÍ → Vapi AI llama al lead (máx 10/hora, delay 2s entre llamadas)
  NO → Resend envía secuencia de 3 emails (día 0, 3, 7)
       ↓
  prospeccion_llamadas / prospeccion_emails (logs)
       ↓
  *** NUEVO: si la llamada fue contestada ***
  → Se crea conversación automáticamente en el CRM
  → Aparece en "Clientes" con perfil completo
  → Todas las comunicaciones futuras (WA, email) quedan unificadas ahí
       ↓
  Dashboard en tiempo real (Pipeline de prospección)
```

---

## Variables de entorno en EasyPanel (producción)

```env
VAPI_PHONE_NUMBER_ID=2e342c4a-d89a-4238-99ac-2984465d100f
OUTREACH_ASSISTANT_ID=067a2db2-249d-40cb-9d24-c3e919a0fabe
OUTREACH_TEST_MODE=true          # ← cambiar a false para producción real
OUTREACH_TEST_PHONE=+573123790071
OUTREACH_TEST_EMAIL=acordeon91@gmail.com
OUTREACH_AGENT_NAME=El equipo
OUTREACH_MAX_LLAMADAS_POR_HORA=10

# Nuevas variables agregadas en sesión 2
OUTREACH_HORARIO_DESDE=08:00     # Hora desde la que se pueden hacer llamadas
OUTREACH_HORARIO_HASTA=20:00     # Hora límite para llamadas
OUTREACH_TIMEZONE=America/Bogota # Timezone para el control de horario
OUTREACH_DELAY_LLAMADAS_MS=2000  # Delay (ms) entre llamadas consecutivas
```

> ⚠️ Los emails pueden salir 24/7. El horario solo aplica a LLAMADAS.

---

## Webhook de Vapi — CONFIGURAR en dashboard.vapi.ai

1. Ir a [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. **Phone Numbers** → clic en `2e342c4a-d89a-4238-99ac-2984465d100f`
3. En **Server URL** poner:
   ```
   https://app-contabilidad-sass-crm.lnrubg.easypanel.host/api/vapi/webhook
   ```
4. Guardar

Sin esto las llamadas se hacen pero las transcripciones/resultados no se guardan en DB.

---

## Problema conocido: número Vapi gratuito no llama a Colombia

**Error:** `"Couldn't start call. Free Vapi numbers do not support international calls."`

**Opciones (en orden de facilidad):**

| Opción | Qué hacer | Costo |
|---|---|---|
| **A** | Usar número USA (`OUTREACH_TEST_PHONE=+1XXXXXXXXXX`) | $0 |
| **B** | Upgrade plan Vapi en billing | ~$20/mes |
| **C** | Twilio + número colombiano importado a Vapi | ~$1/mes |

---

## Migraciones SQL aplicadas en Supabase

### `migrations/22_outreach.sql`
- Columnas en `leads_extraidos`: `estado_prospeccion`, `metodo_contacto`, `fuente_url`, `intentos_outreach`, `prospeccion_actualizado_en`
- Tabla `prospeccion_llamadas` (log de llamadas Vapi de outreach)
- Tabla `prospeccion_emails` (log de emails Resend de outreach)

> Hay también una migración 23 que renombra tablas (aplicada directo en SQL Editor).

---

## Flujo de prueba completo

1. Ir a `/app/cuenta/leads` → buscar negocios en Google Maps
2. Cuando el run completa → hacer clic en **🚀 Iniciar** (elegir modo: llamadas/email/ambos)
3. El sistema llama a los leads automáticamente (respeta horario laboral y rate limit)
4. El lead contesta → transcripción + grabación guardadas en `/app/cuenta/prospeccion`
5. **AUTOMÁTICAMENTE** aparece en `/app/cuenta/clientes` con perfil completo
6. Desde ahí: WhatsApp, llamadas, seguimientos, todo unificado

---

## Estado actual del sistema — TODO FUNCIONAL ✅

### Pipeline de outreach
- ✅ Scraping con Apify (Google Maps → cualquier negocio, cualquier ciudad)
- ✅ Orquestador multi-tenant corre cada 5 min desde `cicloVida.ts`
- ✅ Rate limit: máx `OUTREACH_MAX_LLAMADAS_POR_HORA` (default 10)
- ✅ Horario laboral: solo llama entre `OUTREACH_HORARIO_DESDE` y `OUTREACH_HORARIO_HASTA`
- ✅ Delay entre llamadas: `OUTREACH_DELAY_LLAMADAS_MS` (default 2000ms)
- ✅ 3 modos de contacto: `ambos` (llamada → email fallback), `solo_llamadas`, `solo_email`
- ✅ Retry: hasta 3 intentos con backoff natural (cada 5 min)
- ✅ Secuencia de 3 emails texto plano (día 0, +3, +7 días)
- ✅ Test mode: todas las llamadas/emails van a número/email de prueba

### Auto-importación al CRM (NUEVO en sesión 2)
- ✅ Cuando la llamada es contestada → se crea conversación automáticamente en CRM
- ✅ Datos capturados (nombre, email, cargo, interés) → perfil del cliente
- ✅ Resumen de la llamada → primer mensaje en el chat del cliente
- ✅ Si el lead no contestó → NO se crea perfil (evita spam en Clientes)
- ✅ Import manual también disponible: botón "Importar a CRM →" por lead individual

### Datos capturados por Vapi (structuredData)
Todos estos campos se extraen automáticamente de la conversación y se guardan en `prospeccion_llamadas.datos_capturados`:
- `nombre_contacto` → sincronizado a `leads_extraidos.nombre` + perfil CRM
- `email` → sincronizado a `leads_extraidos.email` + contactos del perfil
- `cargo` → solo en logs
- `nivel_interes`: "alto" | "medio" | "bajo" | "no_interesado"
- `reunion_agendada`: boolean
- `fecha_reunion`: string
- `objecion_principal`: string
- `proximo_paso`: string
- `notas`: string

### UI — Buscar Leads
- ✅ Botón **🚀 Iniciar** por run de Apify (dispara outreach inmediatamente)
- ✅ Dropdown de modo de contacto en el botón (📞✉ / 📞 / ✉)
- ✅ Feedback visual del resultado en el mismo botón
- ✅ Re-importar desde Apify si el webhook no llegó

### UI — Prospección (hub)
- ✅ Cards de acceso rápido a Llamadas / Correos / Asistente VAPI
- ✅ KPIs: total, por contactar, contactados, llamadas/hora
- ✅ Barra de estados del pipeline
- ✅ Tabla de todos los leads con estado actualizado en tiempo real
- ✅ Polling cada 15 segundos (se pausa cuando el tab está oculto)

### UI — Llamadas VAPI
- ✅ Log de todas las llamadas con resultado, duración, costo
- ✅ Datos capturados como cards visuales (interés, reunión, email, objeción)
- ✅ Audio player con velocidades (0.75x / 1x / 1.25x / 1.5x / 2x)
- ✅ Transcripción expandible con burbujas AI/Usuario

### Sidebar reorganizado
Estructura actual (20 ítems, antes 23):

| Sección | Ítems |
|---|---|
| **Principal** | Dashboard, Conversaciones, Clientes, Agenda |
| **Captación** | Buscar leads, Prospección |
| **Ventas** | Embudo CRM, Seguimientos, Llamadas, Inversiones |
| **Configuración** | Agente IA, WhatsApp, WA Business, Catálogo, Conocimiento, Plantillas, Integraciones |
| **Mi Cuenta** | Estudio IA, Créditos, Soporte |

> Los sub-ítems que estaban en el sidebar (Asistente VAPI, Llamadas VAPI, Correos) se eliminaron porque son accesibles directamente desde la página de Prospección (tiene cards para cada uno).

---

## Archivos creados/modificados — Sesión 1 (13-14 Mayo)

| Archivo | Descripción |
|---|---|
| `src/lib/outreach/orquestador.ts` | Cerebro del pipeline |
| `src/lib/outreach/disparadorVapi.ts` | Dispara llamada Vapi con firstMessage personalizado |
| `src/lib/outreach/disparadorEmail.ts` | Secuencia de 3 emails texto plano vía Resend |
| `src/lib/db/outreachLogs.ts` | CRUD para logs de llamadas y emails |
| `src/app/api/cuentas/[idCuenta]/prospeccion/stats/route.ts` | GET conteos por estado |
| `src/app/api/cuentas/[idCuenta]/prospeccion/leads/route.ts` | GET lista de leads |
| `src/app/api/cuentas/[idCuenta]/prospeccion/llamadas/route.ts` | GET log de llamadas |
| `src/app/api/cuentas/[idCuenta]/prospeccion/correos/route.ts` | GET log de emails |
| `src/app/api/cuentas/[idCuenta]/prospeccion/test/route.ts` | POST endpoint de prueba |
| `src/app/api/resend/webhook/route.ts` | Webhook Resend con HMAC |
| `src/app/app/cuentas/[idCuenta]/prospeccion/page.tsx` | Dashboard pipeline |
| `src/app/app/cuentas/[idCuenta]/prospeccion/llamadas/page.tsx` | Log de llamadas |
| `src/app/app/cuentas/[idCuenta]/prospeccion/correos/page.tsx` | Log de emails |
| `migrations/22_outreach.sql` | Migración DB |

---

## Archivos creados/modificados — Sesión 2 (14 Mayo)

### Correcciones de bugs
| Archivo | Cambio |
|---|---|
| `src/lib/db/leadsExtraidos.ts` | Fix: `sincronizarDatosCapturadosAlLead` ahora sincroniza `nombre_contacto` → `nombre` (antes solo sincronizaba `email`) |
| `src/app/api/vapi/webhook/route.ts` | Fix: ahora pasa `nombre_contacto` al sync + **auto-importación al CRM** cuando la llamada es contestada |

### Orquestador mejorado
| Archivo | Cambio |
|---|---|
| `src/lib/outreach/orquestador.ts` | Reescrito: soporte para `ModoContacto` (ambos/solo_llamadas/solo_email), check de horario laboral, delay entre llamadas, retorna resumen `{procesados, llamadas, emails}` |
| `src/lib/db/leadsExtraidos.ts` | `listarLeadsNuevosParaProspeccion` acepta `runId` para filtrar por búsqueda |

### Nuevos endpoints
| Archivo | Descripción |
|---|---|
| `src/app/api/cuentas/[idCuenta]/prospeccion/iniciar/route.ts` | **NUEVO**: POST para disparar outreach manual por run + modo de contacto |

### UI mejorada
| Archivo | Cambio |
|---|---|
| `src/app/app/cuentas/[idCuenta]/leads/_filaRun.tsx` | Botón **🚀 Iniciar** con dropdown de modo de contacto por cada run |
| `src/app/app/cuentas/[idCuenta]/prospeccion/page.tsx` | Mejorada: cards de navegación, tabla con más info, texto descriptivo |

### Sidebar reorganizado
| Archivo | Cambio |
|---|---|
| `src/components/SidebarPanel.tsx` | Nueva estructura: 5 secciones claras, 20 ítems (antes 23), nombres descriptivos |
| `src/components/SidebarPanel.iconos.tsx` | Agregados `IconoSoporte` (?) y `IconoEmbudo` (kanban) |

### Archivos divididos (>350 líneas → múltiples archivos <300)
| Archivos | Descripción |
|---|---|
| `src/app/app/admin/usuarios/[idUsuario]/page.tsx` + `_helpers.tsx` | Separado en página (166 líneas) + helpers (interfaces, Fila, CupoCuentasExtra) |
| `src/components/PanelApiKeys.tsx` + `_PanelApiKeys-modales.tsx` | Separado en panel principal + modales |
| `src/app/app/cuentas/[idCuenta]/configuracion/_componentes/TabIA.tsx` + `_TabIA-ia.tsx` + `_TabIA-ritmo.tsx` | TabIA dividido en 3 archivos |
| `src/app/app/cuentas/[idCuenta]/configuracion/_componentes/TabGeneral.tsx` + `_TabGeneral-identidad.tsx` + `_TabGeneral-estilo.tsx` | TabGeneral dividido en 3 archivos |
| `src/app/app/cuentas/[idCuenta]/prospeccion/asistente/page.tsx` + `_campos-extraccion.tsx` | Asistente VAPI dividido en 2 archivos |

---

## Flujo de datos completo: Prospección → CRM → Re-marketing

```
1. Buscar leads (Apify)
   URL: /app/cuenta/leads
   → Scraping Google Maps por término + ciudad
   → Leads guardados en leads_extraidos con estado_prospeccion = "nuevo"

2. Iniciar outreach
   Botón "🚀 Iniciar" en cada run (con selector de modo)
   O automático cada 5 min via orquestador (cicloVida.ts)
   Endpoint: POST /api/cuentas/{id}/prospeccion/iniciar
   → Respeta horario laboral (08:00-20:00 Colombia)
   → Rate limit: máx 10 llamadas/hora
   → Delay: 2 segundos entre llamadas

3. Llamada VAPI
   lib/outreach/disparadorVapi.ts
   → Llama al número del lead (o test phone si TEST_MODE=true)
   → Primer mensaje personalizado con el nombre del negocio
   → Contexto: nombre, categoría, dirección, sitio web del lead
   → Guarda en prospeccion_llamadas (estado: en_cola → llamado)

4. Webhook de resultado (VAPI → /api/vapi/webhook)
   Cuando termina la llamada:
   → Guarda: transcripción, grabación, duración, costo, resumen
   → Guarda: structuredData (9 campos extraídos por IA)
   → Sincroniza: nombre y email de vuelta al lead
   → SI fue contestada:
       → Crea conversación en CRM (obtenerOCrearConversacion)
       → Guarda email como contacto (guardarContactosEmail)
       → Guarda teléfono como contacto (guardarContactosTelefono)
       → Inserta resumen de llamada como mensaje en el chat
       → Marca lead como importado (marcarLeadImportado)
   → SI no contestó: registra fallo (hasta 3 reintentos)

5. El cliente aparece en /app/cuenta/clientes
   → Perfil con nombre, email, teléfono
   → Primer mensaje = resumen de la llamada
   → Desde ahí: WhatsApp, llamadas, seguimientos, todo unificado

6. Si solo tiene email → secuencia Resend
   lib/outreach/disparadorEmail.ts
   → Email día 0: introducción en texto plano
   → Email día +3: seguimiento
   → Email día +7: último contacto
   → Logs en prospeccion_emails
```

---

## Arquitectura de tablas relevantes

```sql
leads_extraidos              -- Leads scrapeados de Apify
  id, cuenta_id, run_apify_id
  nombre, telefono, email, direccion, sitio_web, categoria
  estado_prospeccion: nuevo|en_cola|llamado|emaileado|completado|no_contactable|fallido
  metodo_contacto: llamada|email|ninguno
  intentos_outreach: int (max 3)
  importado: boolean          -- true cuando se crea conversación en CRM
  conversacion_id: uuid       -- FK a conversaciones cuando importado=true

prospeccion_llamadas          -- Log de cada llamada de outreach
  id, cuenta_id, lead_id
  vapi_call_id
  resultado: customer-ended-call|assistant-ended-call|customer-did-not-answer|...
  transcripcion: text
  url_grabacion: text
  duracion_segundos, costo_usd
  resumen: text
  datos_capturados: jsonb     -- 9 campos extraídos por IA
  creado_en

prospeccion_emails            -- Log de cada email de outreach
  id, cuenta_id, lead_id
  resend_message_id
  paso: 1|2|3                 -- 1=inmediato, 2=día3, 3=día7
  estado_envio: enviado|pendiente|rebotado|spam
  programado_para: timestamp  -- para pasos 2 y 3
  enviado_en: timestamp

conversaciones                -- Perfil del cliente en CRM
  id, cuenta_id, telefono, nombre
  datos_capturados: jsonb     -- datos del cliente enriquecidos
  estado_lead, lead_score
  ...

contactos_email               -- Emails vinculados a conversaciones
  id, cuenta_id, conversacion_id, email

contactos_telefono            -- Teléfonos vinculados a conversaciones
  id, cuenta_id, conversacion_id, telefono
```

---

## Commits de sesión 1

```
38112d7  fix(vapi): eliminar assistantOverrides.model — Vapi exige provider
35d71fe  fix(prospeccion/test): mostrar error exacto de Vapi
0d168a5  fix(prospeccion/test): crear run_apify primero para satisfacer FK
45248f1  fix(prospeccion/test): generar UUID real para run_apify_id
ccad75f  fix(prospeccion/test): run_apify_id es uuid en DB, pasar null
82de24e  fix(prospeccion): renombrar req a _req en endpoint de test
96edd2b  fix(ts): eliminar variables declaradas sin usar
64f44ba  feat(prospeccion): pipeline cold outreach completo + URLs limpias
```

## Commits de sesión 2

```
(pendiente — ver git log)
feat(outreach): modo de contacto + horario laboral + delay entre llamadas
feat(leads): botón Iniciar pipeline con selector de modo por run
feat(webhook/vapi): auto-importar lead al CRM cuando llamada contestada
fix(outreach): sincronizar nombre_contacto al lead + pasar al webhook
refactor(sidebar): reorganizar en 5 secciones claras, 20 ítems
refactor(ui): dividir archivos grandes en helpers
```

---

## Próximos pasos

- [ ] Cambiar número VAPI por uno que soporte llamadas a Colombia (Twilio o upgrade plan)
- [ ] Configurar Server URL del asistente en dashboard.vapi.ai → webhook funcional
- [ ] Cambiar `OUTREACH_TEST_MODE=false` en EasyPanel para producción
- [ ] Crear leads reales desde Apify → probar pipeline end-to-end
- [ ] (Opcional) Google Calendar: cuando `reunion_agendada=true` → crear cita automáticamente
- [ ] (Opcional) Notificación push/email al usuario cuando llega lead interesado (nivel_interes=alto)
