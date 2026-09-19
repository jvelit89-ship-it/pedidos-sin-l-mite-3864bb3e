# Diagnóstico: "Failed to fetch" al iniciar sesión

## Causa probable (confirmada)

La base de datos y el servicio de autenticación alojados están **en pausa**. Mientras están pausados, no responden a ninguna petición, y el navegador muestra exactamente el error "Failed to fetch" al intentar iniciar sesión.

## Evidencia

- Verificación del estado del backend: reporta que la base de datos alojada está **pausada** ("Database and auth calls will not work until the project is active again").
- No hay errores en consola del navegador registrados: no es un fallo de código de la app.
- La configuración de entorno del proyecto está presente y correcta (dirección del backend y clave pública configuradas); el cliente de autenticación apunta a esas variables sin valores faltantes.
- El formulario de inicio de sesión y la lógica de sesión no presentan problemas: el fallo ocurre en la llamada de red saliente, antes de validar credenciales.

## Lo que NO es

- No es un problema de credenciales, usuarios ni contraseñas.
- No es un problema de variables de entorno ni de archivos del proyecto.
- No es el navegador ni la caché del usuario.

## Siguiente paso recomendado (requiere tu aprobación, no lo he hecho)

Reactivar la base de datos alojada desde la configuración del proyecto (Cloud). Tras reactivarla, volver a verificar el estado hasta que aparezca activa y probar el inicio de sesión en la app publicada.

No he modificado código, datos, credenciales ni configuración.
