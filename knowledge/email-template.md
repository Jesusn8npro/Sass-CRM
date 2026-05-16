# Email Templates — Cold Outreach Sequence

Todos en texto plano. SIN HTML, SIN logos, SIN botones.
Objetivo: que llegue al inbox principal y se lea como email directo de una persona.

---

## Email 1 — Contacto Inicial (envío inmediato)

**Subject**: {{BUSINESS_NAME}} — idea rápida

Hola,

Vi que {{BUSINESS_NAME}} está en {{CIUDAD/CATEGORIA}} y quería compartirles algo que podría ser útil.

Trabajamos con negocios como el suyo ayudándoles a conseguir clientes nuevos de forma consistente — sin depender solo de referidos o temporadas bajas.

El sistema encuentra prospectos calificados en su zona y los contacta automáticamente, así su equipo solo habla con quien ya mostró interés.

¿Tendría sentido una llamada de 15 minutos para ver si aplica a su situación?

{{AGENT_NAME}}
{{COMPANY_NAME}}

---

## Email 2 — Follow-up Día 3

**Subject**: Re: {{BUSINESS_NAME}} — idea rápida

Hola de nuevo,

Solo quería hacer un seguimiento por si el email anterior se perdió entre los mensajes.

Si ya están cubriendo bien la generación de nuevos clientes, no hay problema — solo díganme y no les escribo más.

Pero si hay algo de interés, con gusto hablamos 15 minutos esta semana.

{{AGENT_NAME}}

---

## Email 3 — Follow-up Final Día 7 (tono más corto y directo)

**Subject**: Último mensaje — {{BUSINESS_NAME}}

Hola,

Este es mi último mensaje para no ocuparles más el espacio.

Si en algún momento quieren explorar cómo conseguir más clientes sin ampliar el equipo de ventas, aquí estaré.

Que les vaya muy bien.

{{AGENT_NAME}}
{{COMPANY_NAME}}

---

## Variables a reemplazar en cada envío
- `{{BUSINESS_NAME}}` — nombre del negocio (de leads_extraidos.nombre)
- `{{CIUDAD/CATEGORIA}}` — ciudad o categoría del negocio
- `{{AGENT_NAME}}` — nombre del agente configurado en la cuenta
- `{{COMPANY_NAME}}` — nombre de la empresa representada (de company-info.md)
