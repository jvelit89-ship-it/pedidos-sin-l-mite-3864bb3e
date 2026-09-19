# Diagnóstico: backend en pausa y reanudación bloqueada

## 1) Motivo probable (con evidencia)

- **Tu plan actual es Free y la suscripción fue cancelada el 17 de agosto de 2026.** (Consulta de facturación: "Plan: Free — subscription canceled (since Aug 17, 2026)").
- La base de datos alojada está **en pausa** y, según la documentación oficial, Lovable pausa proyectos por **inactividad** o por **saldo de créditos bajo**.
- La reanudación automática está **deshabilitada** para este proyecto (respuesta de la plataforma: "resume ha sido deshabilitada"). Cuando la reanudación está deshabilitada, la causa habitual es **saldo de créditos insuficiente** o una restricción de la cuenta/plan — primero hay que resolver el saldo o el plan.

## 2) Dónde actuar en la interfaz (ruta exacta)

- Al abrir el proyecto: aparece un **aviso en el chat con el botón "Wake up"** (Despertar) para reactivar el backend.
- Alternativa: **Más → Cloud → Overview**: la tarjeta del proyecto en pausa muestra el botón **Wake up**.
- Si el saldo de créditos es el problema: **Settings → Plans & Credits** para agregar créditos o ajustar el límite, y luego volver a "Wake up".

## 3) Si no hay botón visible o no funciona

- Revisa el saldo/límite en **Settings → Plans & Credits** (el bloqueo típico es por créditos agotados o plan cancelado).
- Si aun así no puedes reactivar, contacta a **soporte de Lovable** indicando que el backend está pausado y la reanudación está deshabilitada en un plan Free con suscripción cancelada — es un bloqueo a nivel de plataforma/cuenta que solo ellos pueden liberar.

## 4) Riesgo para los datos mientras está pausado

- **No hay riesgo de pérdida:** la documentación confirma que los datos (base de datos y archivos) **persisten seguros** mientras el proyecto está en pausa. Solo el acceso (lectura/escritura, login) queda inactivo.
- El almacenamiento sigue generando un pequeño consumo de créditos, pero el cómputo está detenido.
- **Advertencia:** no uses "More → Cloud → Overview → Advanced settings → Remove Cloud", porque esa acción es permanente y elimina la instancia y los datos.

No he modificado código, datos, usuarios, variables ni despliegues.
