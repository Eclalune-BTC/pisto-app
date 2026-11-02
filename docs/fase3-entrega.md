# Fase 3: implementación y despliegue del MVP

Evidencia de la entrega de la Fase 3 (Sprint 1) del proyecto *Sistema Financiero para PYMES* (Universidad Francisco Gavidia, Aplicación de Técnicas de Ingeniería de Software, 2026). Continúa el documento acumulado del equipo; las figuras siguen su numeración. El documento Word equivalente se genera para anexarlo al documento del curso.

En esta fase el equipo tradujo la especificación técnica, la arquitectura y los prototipos de la Fase 2 en un incremento de software funcional y ejecutable. El MVP está publicado en internet, usa la base de datos PostgreSQL en la nube y cubre el flujo núcleo del sistema: autenticación, gestión de usuarios y roles, ventas, compras, gastos, caja, cuentas por cobrar y por pagar, inventario, reportes, el asistente de inteligencia artificial para registrar por voz o texto y la actualización en tiempo real. Este capítulo presenta la evidencia de cada requisito de la guía de la Fase 3.

## Enlaces de la entrega

**Tabla 7 – Enlaces de la entrega de la Fase 3**

| Recurso | Enlace |
| --- | --- |
| Demostración en vivo (MVP desplegado) | https://pisto.contact-862.workers.dev |
| Verificación de salud del servicio | https://pisto.contact-862.workers.dev/ready |
| Repositorio de código fuente | https://github.com/Eclalune-BTC/pisto-app |
| Colección de pruebas del API (Postman / Bruno) | https://github.com/Eclalune-BTC/pisto-app/tree/main/docs/postman |
| Evidencia de la entrega en el repositorio | https://github.com/Eclalune-BTC/pisto-app/blob/main/docs/fase3-entrega.md |
| Tablero ágil (Trello) | https://trello.com/b/PoTcegqU/sistema-financiero-mypes-product-backlog-y-sprint-1 |

**Tabla 8 – Cuentas de prueba precargadas**

| Rol | Correo | Contraseña | Qué puede hacer |
| --- | --- | --- | --- |
| Dueño (owner) | dueno@pisto.test | PistoDemo2026 | Todo, incluida la configuración del negocio y la gestión de usuarios |
| Encargado (admin) | encargado@pisto.test | PistoDemo2026 | Todas las operaciones excepto la configuración del negocio y sus usuarios |
| Vendedor (member) | vendedor@pisto.test | PistoDemo2026 | Registrar y ver ventas, ver productos, existencias y clientes, usar el asistente |

## Actualización del stack tecnológico

Durante la implementación el equipo ajustó algunas tecnologías definidas en la Fase 2. La arquitectura por capas, el modelo de datos y los casos de uso se mantienen; los cambios responden a que el sistema debía funcionar en web y en teléfono con un solo código, desplegarse sin costo para la revisión y procesar la voz sin enviar datos a servicios adicionales.

**Tabla 9 – Stack definido en la Fase 2 y stack implementado**

| Capa | Fase 2 | Implementado | Motivo |
| --- | --- | --- | --- |
| Frontend | React.js + Tailwind CSS | Expo Router (React Native Web) + Uniwind (Tailwind) + React Native Reusables | Una sola base de código para web, Android e iOS con el mismo sistema de diseño |
| Backend | Node.js + NestJS | Bun + Elysia (API REST por capas) con contratos Zod compartidos | Arranque rápido, tipado de extremo a extremo y ejecución en Cloudflare Workers |
| Base de datos | PostgreSQL / MySQL | PostgreSQL 18 con Drizzle ORM y migraciones SQL (Neon en la nube) | Integridad referencial y transacciones para el dinero |
| Autenticación | Tokens o sesiones | Better Auth: sesiones en cookie HttpOnly, contraseñas con hash scrypt, roles por negocio | Seguridad probada sin implementar criptografía propia |
| Inteligencia artificial | OpenAI (Whisper / GPT) + n8n | Cloudflare Workers AI: Llama 3.3 70B para extraer el registro y Whisper large v3 turbo para transcribir | Corre en la misma plataforma del despliegue, sin flujos externos |
| Tiempo real | WebSockets | WebSocket /v1/realtime con un Durable Object en Cloudflare | Cada pantalla se actualiza cuando otra sesión registra algo |
| Despliegue | No definido | Cloudflare Workers (web + API) y Neon PostgreSQL | Demostración en vivo accesible desde cualquier navegador |
| Pruebas manuales del API | Postman | Colección Postman/Bruno de 138 peticiones ejecutada con Newman | Prueba independiente de cada endpoint |

La frontera del proyecto de la Fase 2 dejaba fuera el inventario, pero los prototipos aprobados (Nueva venta con productos, Nueva compra y Productos) requieren existencias. Por eso el MVP incluye un inventario básico ligado a las ventas y compras; no incluye facturación electrónica (DTE), integraciones bancarias ni planillas.

## 1. Repositorio de código fuente

### Estrategia de ramas

El repositorio usa main para las versiones entregadas, develop para la integración y ramas feature/ por funcionalidad (por ejemplo feature/itemized-sales, feature/purchases, feature/ai-assistant, feature/realtime-client y feature/seed-data). Cada rama se integra a develop con un merge --no-ff y develop se integra a main para cada entrega.

**Figura 27. Ramas del repositorio e historial de integración**

![Ramas del repositorio e historial de integración](fase3/term-01-branches.png)

*Ramas remotas y grafo de commits de main con las integraciones de cada rama de funcionalidad.*

[Completar por el equipo: captura de GitHub > Insights > Contributors cuando cada integrante haya subido sus commits con su propio usuario. La guía exige commits regulares de todos los integrantes.]

### README.md

El README incluye el enlace a la demostración, las cuentas de prueba, los prerrequisitos con sus versiones (Git, Bun 1.4, Node.js 24, Docker Desktop), los pasos de instalación y ejecución local, la estructura de variables de entorno y los comandos para crear la base de datos y cargar los datos de prueba.

**Figura 28. README: enlaces de la entrega y cuentas de prueba**

![README: enlaces de la entrega y cuentas de prueba](fase3/term-readme-top.png)

*Encabezado del README.md del repositorio.*

**Figura 29. README: prerrequisitos e instalación local**

![README: prerrequisitos e instalación local](fase3/term-readme-local.png)

*Sección Run it locally del README.md con los comandos de instalación, migración y carga de datos.*

**Figura 30. Estructura de variables de entorno**

![Estructura de variables de entorno](fase3/term-02-env-example.png)

*Archivos .env.example del servidor y de la aplicación; los valores reales nunca se guardan en el repositorio.*

## 2. Backend: API y comunicación en tiempo real

### Arquitectura implementada

El sistema respeta la arquitectura por capas de la Fase 2. La capa de controladores son las rutas del API en apps/api (Elysia); valida cada petición con los contratos Zod de packages/contracts. La capa de servicios y repositorios está en packages/db: cada comando autoriza al usuario en el negocio activo, aplica las reglas de negocio dentro de una transacción y escribe en PostgreSQL con Drizzle. packages/auth configura la autenticación y packages/assistant contiene el procesador de IA. La aplicación (apps/app) solo conversa con el API.

**Tabla 10 – Endpoints del flujo núcleo**

| Grupo | Endpoints principales |
| --- | --- |
| Autenticación | POST /api/auth/sign-up/email, POST /api/auth/sign-in/email, POST /api/auth/sign-out, GET /v1/me |
| Gestión de usuarios y roles | GET /v1/businesses/members, POST /v1/businesses/members, PATCH /v1/businesses/members/:id, POST /v1/businesses/members/:id/remove, GET /v1/businesses/roles |
| Negocio | GET /v1/businesses, POST /v1/businesses |
| Ventas | POST /v1/sales/itemized, GET /v1/sales/form-options, POST /v1/sales, GET /v1/sales/:id, POST /v1/sales/:id/void, POST /v1/sales/:id/replace |
| Compras y proveedores | /v1/suppliers, POST /v1/purchases, GET /v1/purchases/:id, POST /v1/purchases/:id/payments, POST /v1/purchases/:id/void, GET /v1/payables/summary |
| Gastos y caja | /v1/expenses, /v1/cash/accounts, /v1/cash/adjustments, /v1/cash/transfers |
| Clientes y cuentas por cobrar | /v1/customers, /v1/receivables, /v1/receivables/:id/payments, GET /v1/receivables/debtors |
| Productos e inventario | /v1/catalog/categories, /v1/catalog/products, /v1/inventory/products/:id/movements |
| Reportes y movimientos | GET /v1/reports/operating, GET /v1/reports/cash-flow, GET /v1/reports/money-trend, GET /v1/movements |
| Asistente de IA (módulo de soporte) | GET /v1/assistant/status, POST /v1/assistant/interpretations, POST /v1/assistant/transcriptions |
| Tiempo real | GET /v1/realtime (WebSocket) |

### Gestión de usuarios

El dueño del negocio administra a su personal desde Configuración: agrega un usuario nuevo (el API crea la cuenta con el mismo cifrado del registro) o una cuenta existente, le asigna el rol de encargado o vendedor, cambia su rol y lo quita del negocio. Solo el dueño puede hacerlo, nadie puede volverse dueño por esta vía, el dueño no puede quitarse a sí mismo y un usuario quitado pierde el acceso en su siguiente petición. Cada comando usa una llave de idempotencia y avisa por tiempo real a las demás sesiones.

### Mecanismos de seguridad

- Contraseñas cifradas con hash scrypt (Better Auth); nunca se guardan ni se devuelven en texto plano (figura de integridad).
- Autenticación basada en sesiones: cookie HttpOnly pisto.session_token; cerrar sesión la revoca en el servidor.
- Control de acceso por roles (dueño, encargado, vendedor) verificado en el servidor en cada petición; el usuario no puede elegir otro negocio.
- Solo los orígenes permitidos pueden escribir; límites de intentos de inicio de sesión (3 cada 10 s) y de peticiones por usuario (300 lecturas y 60 escrituras por minuto).
- Cada comando de dinero usa una llave de idempotencia: repetir la petición no duplica el registro y reutilizarla con otros datos se rechaza.

**Tabla 11 – Matriz de permisos por rol**

| Permiso | Dueño | Encargado | Vendedor |
| --- | --- | --- | --- |
| Configurar el negocio y gestionar sus usuarios | Sí | No | No |
| Registrar y ver ventas | Sí | Sí | Sí |
| Anular o corregir ventas | Sí | Sí | No |
| Ver productos y existencias | Sí | Sí | Sí |
| Administrar productos e inventario | Sí | Sí | No |
| Ver clientes | Sí | Sí | Sí |
| Administrar clientes y cuentas por cobrar | Sí | Sí | No |
| Compras, proveedores y cuentas por pagar | Sí | Sí | No |
| Gastos, caja y bancos | Sí | Sí | No |
| Reportes | Sí | Sí | No |
| Usar el asistente de IA | Sí | Sí | Sí |

### Manejo de errores

Todas las respuestas de error tienen la misma forma {error: {code, message, requestId}} con el código HTTP correspondiente: 400 datos inválidos (con el detalle por campo), 401 sin sesión, 403 sin permiso u origen no permitido, 404 registro inexistente, 409 conflicto de negocio o de idempotencia, 429 demasiadas peticiones y 503 servicio no disponible. Los mensajes nunca incluyen trazas internas.

**Figura 31. Respuestas del API ante errores y controles de seguridad**

![Respuestas del API ante errores y controles de seguridad](fase3/term-06-api-security.png)

*Peticiones reales al API local: sin sesión, sin permiso, datos inválidos, idempotencia, origen no permitido y registro inexistente.*

### Comunicación bidireccional en tiempo real

El WebSocket /v1/realtime admite solo a miembros del negocio activo desde un origen permitido. Cuando un comando se confirma, el servidor envía business.changed con el recurso afectado y cada pantalla abierta vuelve a consultar sus datos; el cliente también envía ping y recibe pong para mantener la conexión.

**Figura 32. Eventos del WebSocket**

![Eventos del WebSocket](fase3/term-07-realtime.png)

*La sesión del vendedor recibe el evento business.changed cuando el dueño registra una venta desde otra sesión.*

**Figura 33. Tiempo real en la interfaz: antes**

![Tiempo real en la interfaz: antes](fase3/realtime-before-1280.png)

*Pantalla Hoy del dueño antes de que el vendedor registre una venta en otro equipo.*

**Figura 34. Tiempo real en la interfaz: después**

![Tiempo real en la interfaz: después](fase3/realtime-after-1280.png)

*La misma pantalla, sin recargar, muestra la venta registrada desde otro equipo en Movimientos de hoy.*

## 3. Base de datos y persistencia

La base de datos se crea con migraciones SQL generadas por Drizzle (0000 a 0010) y ejecutadas con bun run db:migrate; crean 36 tablas. Las relaciones usan llaves foráneas compuestas por negocio para que ningún registro apunte a datos de otro negocio, y las restricciones CHECK impiden montos negativos, estados inválidos o movimientos de caja sin su origen. bun run db:seed carga el negocio de ejemplo Abarrotes La Ceiba con usuarios y roles preconfigurados, productos, cuentas, ventas, compras, gastos y deudas; puede ejecutarse varias veces sin duplicar datos.

**Figura 35. Migraciones y carga de datos de prueba**

![Migraciones y carga de datos de prueba](fase3/term-03-migrations.png)

*Ejecución de las migraciones y del seed sobre una base de datos nueva; la segunda ejecución no duplica datos.*

**Figura 36. Tablas creadas en PostgreSQL**

![Tablas creadas en PostgreSQL](fase3/term-04-tables.png)

*Listado de tablas después de ejecutar las migraciones.*

**Figura 37. Integridad de datos y contraseñas cifradas**

![Integridad de datos y contraseñas cifradas](fase3/term-05-integrity.png)

*Llaves foráneas, restricciones CHECK y únicas por tabla, y las contraseñas de los usuarios de prueba guardadas como hash.*

## 4. Frontend: interfaz de usuario

Las pantallas se implementaron a partir de los prototipos de alta fidelidad de la Fase 2 (figuras 9 a 25), con la misma paleta verde bosque y acento lima, la misma navegación lateral y los mismos flujos. Todas consumen el API real y se suscriben a los eventos en tiempo real.

**Tabla 12 – Correspondencia entre prototipos y pantallas implementadas**

| Prototipo (Fase 2) | Pantalla implementada | Ruta |
| --- | --- | --- |
| Figura 9. Inicio de sesión | Iniciar sesión | /sign-in |
| Figuras 10 y 11. Menú principal y de opciones | Hoy y menú ¿Qué quiere registrar? | /operate |
| Figura 12. Nuevo registro | Dictado por voz o texto | Botón Dictar |
| Figura 13. Revisar venta | Revisión del registro del asistente | /operate/assistant/review |
| Figura 14. Movimientos | Movimientos | /operate/movements |
| Figura 15. Nueva venta | Nueva venta con productos | /operate/sales/new |
| Figura 16. Nueva compra | Nueva compra | /operate/purchases/new |
| Figura 17. Nuevo gasto | Nuevo gasto | /operate/expenses/new |
| Figura 18. Cuentas por cobrar | Cuentas por cobrar | /operate/receivables |
| Figura 19. Registrar abono | Registrar abono | /operate/receivables |
| Figura 20. Cuentas por pagar | Cuentas por pagar | /operate/payables |
| Figura 21. Productos | Productos | /operate/catalog |
| Figura 22. Proveedores | Proveedores | /operate/suppliers |
| Figura 23. Reportes | Reportes | /operate/reports |
| Figura 24. Configuración | Configuración y usuarios | /settings |

**Figura 38. Página de inicio pública**

![Página de inicio pública](fase3/landing-1280.png)

*Página que ve un visitante antes de iniciar sesión: la pantalla Hoy de un negocio de ejemplo, el registro por voz paso a paso, los módulos y los roles.*

**Figura 39. Página de inicio pública en teléfono**

![Página de inicio pública en teléfono](fase3/landing-390.png)

*La misma página en un teléfono.*

**Figura 40. Pantalla Inicio de sesión implementada**

![Pantalla Inicio de sesión implementada](fase3/signin-1280.png)

*Implementación del prototipo de la figura 9.*

**Figura 41. Pantalla Hoy implementada**

![Pantalla Hoy implementada](fase3/home-1280.png)

*Dinero disponible con su gráfico, el registro por voz o texto, movimientos de hoy, por cobrar y por pagar (figuras 10 y 12).*

**Figura 42. Pantalla Hoy en teléfono**

![Pantalla Hoy en teléfono](fase3/home-390.png)

*La misma pantalla en un teléfono, con la tarjeta de dinero en lima como en la figura 11.*

**Figura 43. Menú ¿Qué quiere registrar?**

![Menú ¿Qué quiere registrar?](fase3/new-menu-1280.png)

*Las cinco opciones de registro del prototipo de la figura 11.*

**Figura 44. Nuevo registro por voz**

![Nuevo registro por voz](fase3/dictation-1280.png)

*Diálogo de dictado escuchando el micrófono (figura 12).*

**Figura 45. Revisión del registro creado por el asistente de IA**

![Revisión del registro creado por el asistente de IA](fase3/assistant-review-1280.png)

*La frase dictada con sus fragmentos numerados y el formulario de venta lleno con los mismos números (figura 13); el usuario confirma antes de guardar.*

**Figura 46. Pantalla Movimientos implementada**

![Pantalla Movimientos implementada](fase3/movements-1280.png)

*Ventas, compras, gastos, abonos y pagos en un solo libro con totales del período (figura 14).*

**Figura 47. Pantalla Nueva venta implementada**

![Pantalla Nueva venta implementada](fase3/sale-new-1280.png)

*Venta con productos, forma de pago y crédito (figura 15).*

**Figura 48. Pantalla Nueva compra implementada**

![Pantalla Nueva compra implementada](fase3/purchase-new-1280.png)

*Compra al contado o al crédito con productos que entran al inventario.*

**Figura 49. Pantalla Nuevo gasto con validación**

![Pantalla Nuevo gasto con validación](fase3/state-validation-expense-1280.png)

*Los campos obligatorios vacíos se señalan antes de enviar (figura 17).*

**Figura 50. Pantalla Cuentas por cobrar implementada**

![Pantalla Cuentas por cobrar implementada](fase3/receivables-1280.png)

*Saldos, antigüedad de las deudas y filtros (figura 18).*

**Figura 51. Registrar abono**

![Registrar abono](fase3/payment-sheet-1280.png)

*Panel para registrar el abono de un cliente (figura 19).*

**Figura 52. Pantalla Cuentas por pagar implementada**

![Pantalla Cuentas por pagar implementada](fase3/payables-1280.png)

*Lo que se debe a proveedores, lo vencido y el próximo pago (figura 20).*

**Figura 53. Pantalla Productos implementada**

![Pantalla Productos implementada](fase3/products-1280.png)

*Existencias contra el mínimo y filtros de existencia baja y agotados (figura 21).*

**Figura 54. Pantalla Proveedores implementada**

![Pantalla Proveedores implementada](fase3/suppliers-1280.png)

*Proveedores con su saldo y compras recientes (figura 22).*

**Figura 55. Pantalla Reportes implementada**

![Pantalla Reportes implementada](fase3/reports-1280.png)

*Estado de resultados y flujo de caja mensual (figura 23).*

**Figura 56. Pantalla Configuración y gestión de usuarios**

![Pantalla Configuración y gestión de usuarios](fase3/settings-1280.png)

*Usuarios del negocio con su rol y acciones para cambiarlo o quitarlo, y la matriz de permisos (figura 24).*

**Figura 57. Agregar un usuario al negocio**

![Agregar un usuario al negocio](fase3/settings-add-user-1280.png)

*El dueño crea la cuenta de un empleado con su rol y una contraseña inicial que se guarda cifrada.*

**Figura 58. Pantalla Caja y bancos**

![Pantalla Caja y bancos](fase3/cash-1280.png)

*Saldos de cada cuenta y movimientos recientes.*

### Estados de la interfaz

Cada pantalla muestra estados reales: esqueletos mientras carga, mensajes de validación en el campo, confirmación al guardar, errores del servidor con opción de reintentar y un aviso claro cuando el rol no tiene permiso.

**Figura 59. Estado cargando**

![Estado cargando](fase3/state-loading-1280.png)

*Esqueleto de la pantalla mientras llegan los datos.*

**Figura 60. Estado de éxito**

![Estado de éxito](fase3/state-success-sale-1280.png)

*La venta guardada abre su detalle y muestra la notificación Venta guardada.*

**Figura 61. Visualización de errores**

![Visualización de errores](fase3/state-error-signin-1280.png)

*Mensaje al intentar iniciar sesión con una contraseña incorrecta.*

**Figura 62. Vista del vendedor**

![Vista del vendedor](fase3/seller-home-1280.png)

*El vendedor solo ve los módulos que su rol permite.*

**Figura 63. Acceso denegado por rol**

![Acceso denegado por rol](fase3/state-denied-seller-1280.png)

*El vendedor que abre Reportes recibe un aviso de que su rol no lo permite.*

## 5. Colección de pruebas manuales del API

La carpeta docs/postman del repositorio contiene la colección exportada (pisto.postman_collection.json) y dos entornos (local y producción). Se importa en Postman o Bruno y prueba de forma independiente cada endpoint: 147 peticiones en 16 carpetas que verifican el código y el contenido de cada respuesta. Se ejecuta en orden con una pausa de 1000 ms entre peticiones.

**Figura 64. Ejecución de la colección con Newman**

![Ejecución de la colección con Newman](fase3/term-08-newman.png)

*Resumen de la corrida de la colección contra el API: todas las peticiones y verificaciones pasan.*

## 6. Demostración y despliegue

El MVP está desplegado en Cloudflare Workers: un Worker sirve la aplicación web y reenvía el API a un Durable Object que se conecta a PostgreSQL en Neon con un rol de permisos mínimos; la IA usa el enlace de Workers AI. La dirección pública es https://pisto.contact-862.workers.dev.

**Figura 65. Despliegue en Cloudflare Workers**

![Despliegue en Cloudflare Workers](fase3/term-09-deploy.png)

*Salida del despliegue con sus enlaces (base de datos, IA, archivos estáticos) y la verificación /ready.*

### Guion de la demostración en vivo

- Abrir https://pisto.contact-862.workers.dev y mostrar la página pública; iniciar sesión como dueno@pisto.test.
- En Hoy, explicar Dinero disponible, Por cobrar y Por pagar. Pulsar Dictar (o escribir en Registrar): "Le vendí a Rosa Ayala dos libras de arroz y una Coca-Cola, me pagó un dólar en efectivo y el resto me lo queda debiendo".
- Revisar el registro: los números de la frase coinciden con los campos; guardar la venta y verla en Movimientos y en Cuentas por cobrar.
- Registrar una compra al crédito, ver la deuda en Por pagar y registrar un pago al proveedor.
- Abrir una segunda ventana como vendedor@pisto.test: registrar una venta y mostrar que la pantalla del dueño se actualiza sola; mostrar que el vendedor no puede abrir Reportes.
- En Configuración, agregar un usuario con rol Vendedor y cambiar su rol.
- Mostrar la colección de Postman y una petición rechazada (sin sesión o con datos inválidos).

## Nota sobre el alcance de las pruebas

Las pruebas de esta entrega son manuales y exploratorias: el equipo recorrió cada pantalla llenando formularios y probó cada endpoint con la colección de Postman. El repositorio ya contiene pruebas automatizadas usadas durante el desarrollo, que se documentarán formalmente en la Fase 4 de Calidad de Software.

## Matriz de cumplimiento de la Fase 3

**Tabla 13 – Requisitos de la guía y su evidencia**

| Requisito de la guía | Evidencia |
| --- | --- |
| Repositorio con historial distribuido | GitHub Eclalune-BTC/pisto-app (pendiente: commits de cada integrante) |
| Estrategia de ramas main / develop / feature | Figura de ramas e historial |
| README: prerrequisitos, instalación, .env.example, base de datos y seeds | Figuras del README y de .env.example |
| Arquitectura del sistema | Sección Arquitectura implementada |
| Endpoints: autenticación, usuarios, recursos y soporte | Tabla de endpoints y colección Postman |
| Seguridad: hash, sesiones y roles | Figura de integridad, matriz de permisos, respuestas 401/403 |
| Manejo de errores | Figura de respuestas del API |
| WebSockets | Figuras de eventos y de la interfaz antes y después |
| Migraciones e integridad de datos | Figuras de migraciones, tablas e integridad |
| Datos de prueba con usuarios y roles | Figura del seed y tabla de cuentas |
| Pantallas basadas en los prototipos | Tabla de correspondencia y figuras de pantallas |
| Estados de la interfaz | Figuras de cargando, éxito, validación, error y acceso denegado |
| Integración con el API y tiempo real | Todas las pantallas usan el API; figuras de tiempo real |
| Colección de pruebas del API | docs/postman y figura de Newman |
| Demostración en vivo | https://pisto.contact-862.workers.dev y guion de la demostración |
