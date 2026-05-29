# Integración: Supabase externo del negocio

Cada cuenta (tenant) puede conectar el proyecto **Supabase propio de su negocio**
(URL + `service_role` key). A partir de esa conexión, tanto el **agente de ventas**
como el **dueño** (operador privado) pueden trabajar contra esos datos reales.

La feature está dividida en tres capas, cada una con su propio control de acceso.

---

## 1. Conexión y descubrimiento de tablas

**Página dedicada:** `/app/cuentas/[idCuenta]/supabase-externo`
(link en el sidebar, sección Configuración → "Tu Supabase").

- El dueño pega la URL del proyecto y la `service_role` key.
- Se valida la conexión contra `GET {url}/rest/v1/` (OpenAPI de PostgREST),
  que a la vez **auto-descubre todas las tablas** accesibles.
- Las tablas descubiertas quedan en `cuentas.supabase_externo_tablas`.

**Archivos:**
- `src/app/app/cuentas/[idCuenta]/supabase-externo/page.tsx`
- `src/components/PanelSupabaseExterno.tsx`
- `src/app/api/cuentas/[idCuenta]/supabase-externo/route.ts`
- `src/lib/db/supabaseExterno.ts` (`probarConexionExterna`, `guardarConfigExterna`, …)
- Migración `migrations/38_supabase_externo.sql`

### Seguridad de las credenciales

- La `service_role` key se guarda **cifrada con AES-256-GCM** (no en texto plano,
  no hasheada — debe poder recuperarse para reconectar).
- Módulo de cifrado: `src/lib/seguridad/cifrado.ts` (`cifrar` / `descifrar`).
  Formato del blob: `v1:iv_hex:authTag_hex:ciphertext_hex`. Las cadenas legacy
  (sin prefijo `v1:`) pasan tal cual para compatibilidad.
- Requiere la variable de entorno **`CLAVE_CIFRADO_SECRETOS`** (32 bytes en hex).
  Debe estar configurada **igual en local y en el deploy de producción**, o el
  descifrado falla. Nunca se commitea (vive en `.env.local`, ignorado por git).
- La key nunca se devuelve al cliente: las funciones públicas omiten la columna;
  solo `obtenerCredencialesExternas` la expone y es **server-only**.

---

## 2. El agente de ventas consulta tablas para vender más

El agente que atiende a los **clientes** puede leer un subconjunto de tablas
para responder con datos reales (catálogo, stock, precios, etc.).

- Control **deny-by-default**: el dueño elige qué tablas habilita
  (`agente_bd_externa_habilitada` + `agente_tablas_permitidas`), desde la misma
  página, con un toggle y chips seleccionables por tabla.
- Flujo de **un solo round-trip** para acotar latencia/costo:
  1. Se inyectan en el prompt las tablas permitidas.
  2. El agente pide datos vía el campo estructurado `consultar_datos` del schema.
  3. El sistema lee esas tablas (solo `select`, límite de filas) y vuelve a
     promptear al agente con los datos para que arme la respuesta final.

**Archivos:**
- `src/lib/db/supabaseExterno.ts` (`consultarTablasExternas`, `guardarConfigAgenteExterno`)
- `src/lib/openai-schema.ts` y `src/lib/openai.ts` (campo `consultar_datos`)
- `src/lib/baileys/manejadorIA.ts` (inyección + round-trip)
- Migración `migrations/39_agente_bd_externa.sql`

---

## 3. El dueño controla su base por WhatsApp (acceso total)

Cuando el remitente es el **operador privado** (`telefono_operador_privado`),
el bot deriva a un asistente con **tool-calling** real (gpt-4o) que ahora puede
operar sobre TODAS las tablas descubiertas del Supabase del negocio.

> A diferencia de la capa 2, el dueño NO está limitado por
> `agente_tablas_permitidas`: tiene acceso completo a **todas** las tablas
> de `supabase_externo_tablas`. Ese gate solo restringe al agente de ventas.

### Tools disponibles (solo si la cuenta tiene `supabase_externo_url`)

| Tool | Acción |
|------|--------|
| `bd_listar_tablas` | Lista las tablas del Supabase del negocio |
| `bd_leer_filas` | Lee filas con filtros de igualdad opcionales |
| `bd_crear_fila` | Crea una fila nueva |
| `bd_actualizar_filas` | Actualiza filas que coinciden con filtros |
| `bd_eliminar_filas` | Borra filas que coinciden con filtros |

### Reglas de seguridad

1. **Filtros estructurados** por igualdad (`.eq`) — nunca SQL crudo (anti-injection).
2. `update` y `delete` **exigen al menos un filtro** (no se puede afectar la tabla entera).
3. **Confirmación previa** (decisión del producto):
   - **Borrar**: SIEMPRE muestra primero cuántas filas afecta y NO ejecuta.
     El bot le pide confirmación al dueño por WhatsApp; solo con `confirmado=true` borra.
   - **Editar varias filas (>1)**: mismo preview + confirmación.
   - **Editar 1 fila / crear / leer**: ejecuta directo.
4. Solo se opera sobre tablas presentes en `supabase_externo_tablas`.

**Archivos:**
- `src/lib/db/supabaseExterno.ts` (`listarTablasExternas`, `leerFilasExternas`,
  `crearFilaExterna`, `actualizarFilasExternas`, `eliminarFilasExternas`,
  `contarFilasExternas`)
- `src/lib/baileys/manejadorOperadorPrivado.ts` (definiciones de tools, dispatcher,
  bloque del system prompt con las reglas)

---

## Migraciones

| Archivo | Qué agrega |
|---------|-----------|
| `38_supabase_externo.sql` | `supabase_externo_url`, `supabase_externo_service_key` (cifrada), `supabase_externo_validado_en`, `supabase_externo_tablas` |
| `39_agente_bd_externa.sql` | `agente_bd_externa_habilitada`, `agente_tablas_permitidas` |

Ambas aplicadas al proyecto Supabase de la plataforma (idempotentes:
`add column if not exists`).

---

## Checklist de despliegue

- [ ] Aplicar migraciones 38 y 39 en producción.
- [ ] Configurar `CLAVE_CIFRADO_SECRETOS` en el entorno de producción
      (mismo valor que el usado para cifrar; si cambia, las keys ya guardadas
      no se podrán descifrar).
- [ ] Probar el flujo del dueño escribiendo desde su `telefono_operador_privado`.
