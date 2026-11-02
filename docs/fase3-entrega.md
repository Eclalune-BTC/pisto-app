# Fase 3: implementación y despliegue del MVP

Evidencia de la Fase 3 (Sprint 1) del proyecto *Sistema Financiero para PYMES*. Es el mismo
contenido del documento de la entrega; las figuras y tablas continúan la numeración del documento
de la Fase 2.

## Implementación y despliegue del MVP (Sprint 1)

En esta fase el equipo construyó el producto mínimo viable a partir de la especificación técnica, la arquitectura y los prototipos aprobados en la Fase 2. El sistema está publicado en internet, guarda la información en PostgreSQL y permite registrar ventas, compras, gastos, cobros y pagos, consultar los saldos y reportes del negocio, administrar a los usuarios con sus roles y registrar una operación dictándola o escribiéndola para que el asistente de inteligencia artificial prepare el registro que el usuario revisa antes de guardar. En los apartados siguientes se presenta la evidencia de cada requisito de la guía de la Fase 3.

### Acceso al sistema y usuarios de prueba

El sistema se revisa desde cualquier navegador en la dirección de la demostración. La base de datos de la demostración ya contiene seis semanas de operaciones del negocio de ejemplo Abarrotes La Ceiba, por lo que al iniciar sesión se ven ventas, compras, gastos, deudas de clientes, facturas de proveedores y reportes con información. Para recorrer todas las funciones se recomienda ingresar con la cuenta del dueño; las otras dos cuentas sirven para comprobar lo que cada rol puede hacer.

**Tabla 7. Enlaces de la entrega**

| Recurso | Enlace |
| --- | --- |
| Demostración en vivo | https://pisto.contact-862.workers.dev |
| Estado del servicio | https://pisto.contact-862.workers.dev/ready |
| Repositorio de código fuente | https://github.com/Eclalune-BTC/pisto-app |
| Colección de pruebas del API | https://github.com/Eclalune-BTC/pisto-app/tree/main/docs/postman |
| Tablero ágil | https://trello.com/b/PoTcegqU/sistema-financiero-mypes-product-backlog-y-sprint-1 |

*Direcciones del sistema desplegado y de los recursos del proyecto.*

**Tabla 8. Usuarios de prueba**

| Rol | Correo | Contraseña | Puede revisar |
| --- | --- | --- | --- |
| Dueño (Marta López) | dueno@pisto.test | PistoDemo2026 | Todos los módulos, la configuración del negocio y la gestión de usuarios |
| Encargado (Carlos Rivas) | encargado@pisto.test | PistoDemo2026 | Ventas, compras, gastos, caja, cobros, pagos y reportes |
| Vendedor (Ana Guzmán) | vendedor@pisto.test | PistoDemo2026 | Registrar y consultar ventas, ver productos, existencias y clientes, usar el asistente |

*Las tres cuentas pertenecen al negocio Abarrotes La Ceiba, que ya tiene datos cargados.*

### Actualización del stack tecnológico

Durante la implementación se mantuvieron la arquitectura por capas, el modelo de datos y los casos de uso definidos en la Fase 2. Algunas tecnologías cambiaron por razones prácticas: el equipo necesitaba una sola base de código para la versión web y la de teléfono, un servidor que pudiera publicarse sin costo para la revisión y un servicio de inteligencia artificial disponible en la misma plataforma del despliegue.

**Tabla 9. Stack definido en la Fase 2 y stack implementado**

| Capa | Fase 2 | Implementado | Motivo |
| --- | --- | --- | --- |
| Frontend | React.js con Tailwind CSS | Expo Router (React Native para web y teléfono), Uniwind (Tailwind) y componentes React Native Reusables | Una sola base de código para la versión web, Android e iOS con el mismo diseño |
| Backend | Node.js con NestJS | Bun con Elysia: API REST organizada por capas y validación con Zod | Validación compartida entre aplicación y servidor, y ejecución en Cloudflare Workers |
| Base de datos | PostgreSQL o MySQL | PostgreSQL 18 con Drizzle ORM y migraciones SQL; Neon en la nube | Integridad referencial y transacciones para las operaciones con dinero |
| Autenticación | Tokens o sesiones | Better Auth: sesiones en cookie HttpOnly, contraseñas con hash scrypt y roles por negocio | Mecanismo probado, sin implementar criptografía propia |
| Inteligencia artificial | OpenAI (Whisper y GPT) con n8n | Cloudflare Workers AI: Whisper large v3 turbo para transcribir y Llama 3.3 70B para interpretar la frase | Funciona en la misma plataforma del despliegue, sin flujos externos |
| Tiempo real | WebSockets | WebSocket /v1/realtime atendido por un Durable Object de Cloudflare | Las pantallas abiertas se actualizan cuando otra sesión registra algo |
| Despliegue | No definido | Cloudflare Workers para la aplicación web y el API; Neon para PostgreSQL | Demostración accesible desde cualquier navegador |
| Pruebas del API | Postman | Colección de Postman compatible con Bruno, ejecutada también con Newman | Prueba independiente de cada endpoint |

*Comparación entre las tecnologías previstas en la Fase 2 y las utilizadas en la implementación.*

La frontera del proyecto dejaba fuera la gestión de inventarios; sin embargo, los prototipos aprobados de Nueva venta, Nueva compra y Productos trabajan con existencias. Por esa razón el MVP incluye un inventario básico que se actualiza con cada venta y cada compra. Siguen fuera del alcance la facturación electrónica (DTE), las integraciones bancarias y las planillas.

## Repositorio de código fuente

### Estrategia de ramas e historial

El código fuente se encuentra en GitHub (Anexo 1). La rama main contiene las versiones entregadas y la rama develop integra el trabajo en curso. Cada funcionalidad se desarrolló en una rama propia con el prefijo feature/, por ejemplo feature/itemized-sales para las ventas con productos, feature/purchases para compras y proveedores, feature/ai-assistant para el asistente, feature/user-management para la gestión de usuarios y feature/landing-page para la página pública. Cada rama se integró a develop con un merge sin avance rápido, de modo que el historial conserva cada integración, y al cerrar la fase develop se integró a main.

**Figura 27. Ramas del repositorio e historial de integración**

![Ramas del repositorio e historial de integración](fase3/term-01-branches.jpg)

*Ramas publicadas en GitHub y grafo de commits de la rama develop con la integración de cada rama de funcionalidad.*

### Archivo README.md

El archivo README.md explica cómo ejecutar el sistema en una computadora nueva. Enumera los programas necesarios con sus versiones (Git, Bun 1.4 o superior, Node.js 24 y Docker Desktop), los comandos de instalación, la creación de los archivos de variables de entorno, la creación de la base de datos con las migraciones y la carga de los datos de prueba. Al inicio incluye el enlace a la demostración, las cuentas de prueba y la ubicación de la colección de peticiones.

**Figura 28. Encabezado del README con enlaces y cuentas de prueba**

![Encabezado del README con enlaces y cuentas de prueba](fase3/term-readme-top.jpg)

*Primera sección del README.md del repositorio.*

**Figura 29. Prerrequisitos e instalación en entorno local**

![Prerrequisitos e instalación en entorno local](fase3/term-readme-local.jpg)

*Sección del README.md con los requisitos y los comandos de instalación, migración y carga de datos.*

### Variables de entorno

Los archivos .env.example del servidor y de la aplicación documentan cada variable con un valor de ejemplo. El comando bun run setup los copia a .env y apps/app/.env.local y genera un secreto aleatorio para la autenticación. Los valores reales de producción se guardan como secretos del servidor y nunca se suben al repositorio.

**Figura 30. Estructura de variables de entorno**

![Estructura de variables de entorno](fase3/term-02-env-example.jpg)

*Contenido de los archivos .env.example del servidor y de la aplicación.*

## Backend: API y comunicación en tiempo real

### Arquitectura implementada

La implementación respeta las capas definidas en el mapeo de clases de la Fase 2. Las rutas del API reciben cada petición y la validan con los contratos compartidos; los servicios aplican las reglas de negocio dentro de una transacción después de verificar que el usuario pertenece al negocio activo y que su rol tiene el permiso necesario; los repositorios leen y escriben en PostgreSQL con consultas parametrizadas. La aplicación del usuario solo se comunica con el API.

**Tabla 10. Capas de la arquitectura y módulos que las implementan**

| Capa (Fase 2) | Módulo implementado | Responsabilidad |
| --- | --- | --- |
| Controladores (Boundary) | apps/api/src/routes | Rutas REST, autenticación de la petición y respuesta con el formato común de errores |
| Contratos y DTO | packages/contracts | Esquemas Zod de cada petición y respuesta, compartidos por la aplicación y el API |
| Servicios | packages/db (comandos por módulo) | Reglas de negocio: existencias, saldos, crédito, idempotencia y permisos por rol |
| Repositorios | packages/db con Drizzle ORM | Acceso a PostgreSQL con consultas parametrizadas y transacciones |
| Entidades | packages/db/src/schema | Tablas, llaves foráneas y restricciones del modelo relacional |
| Procesador de IA | packages/assistant | Transcripción del audio y extracción de los datos de la frase |
| Interfaz | apps/app (Expo Router) | Pantallas, formularios, estados y suscripción a eventos en tiempo real |

*Relación entre las capas del diseño y los módulos del repositorio.*

### Endpoints del flujo núcleo

**Tabla 11. Endpoints principales del API**

| Grupo | Endpoints |
| --- | --- |
| Autenticación | POST /api/auth/sign-up/email, POST /api/auth/sign-in/email, POST /api/auth/sign-out, GET /v1/me |
| Gestión de usuarios | GET /v1/businesses/members, POST /v1/businesses/members, PATCH /v1/businesses/members/:id, POST /v1/businesses/members/:id/remove, GET /v1/businesses/roles |
| Negocio | GET /v1/businesses, POST /v1/businesses |
| Ventas | POST /v1/sales/itemized, GET /v1/sales/form-options, GET /v1/sales, GET /v1/sales/:id, POST /v1/sales/:id/void |
| Compras y proveedores | /v1/suppliers, POST /v1/purchases, GET /v1/purchases/:id, POST /v1/purchases/:id/payments, POST /v1/purchases/:id/void, GET /v1/payables/summary |
| Gastos y caja | /v1/expenses, /v1/cash/accounts, /v1/cash/adjustments, /v1/cash/transfers |
| Clientes y cuentas por cobrar | /v1/customers, /v1/receivables, /v1/receivables/:id/payments, GET /v1/receivables/debtors |
| Productos e inventario | /v1/catalog/categories, /v1/catalog/products, /v1/inventory/products/:id/movements |
| Reportes y movimientos | GET /v1/reports/operating, GET /v1/reports/cash-flow, GET /v1/reports/money-trend, GET /v1/movements |
| Asistente de IA | GET /v1/assistant/status, POST /v1/assistant/interpretations, POST /v1/assistant/transcriptions |
| Tiempo real | GET /v1/realtime (WebSocket) |

*La colección de Postman incluye una petición para cada endpoint.*

### Gestión de usuarios

El dueño del negocio administra a su personal desde Configuración. Puede agregar un usuario nuevo, en cuyo caso el API crea la cuenta con el mismo cifrado del registro y una contraseña inicial, o agregar una cuenta que ya existe; también puede cambiar el rol entre encargado y vendedor y quitar a una persona del negocio. Solo el dueño puede hacerlo, nadie puede convertirse en dueño por esta vía y el dueño no puede quitarse a sí mismo. Un usuario quitado pierde el acceso en su siguiente petición.

### Mecanismos de seguridad

- **Contraseñas cifradas:** se guardan con hash scrypt y nunca se devuelven en las respuestas del API.
- **Sesiones:** la sesión viaja en una cookie HttpOnly; al cerrar sesión se revoca en el servidor.
- **Control de acceso por roles:** cada petición se autoriza en el servidor según el rol del usuario en el negocio activo; el usuario no puede elegir otro negocio.
- **Origen y límites:** solo los orígenes permitidos pueden escribir, el inicio de sesión admite tres intentos cada diez segundos y cada usuario tiene un máximo de 300 lecturas y 60 escrituras por minuto.
- **Operaciones repetidas:** cada comando de dinero lleva una llave de idempotencia; si la misma petición se envía dos veces no se duplica el registro.

**Tabla 12. Permisos por rol**

| Acción | Dueño | Encargado | Vendedor |
| --- | --- | --- | --- |
| Configurar el negocio y gestionar sus usuarios | Sí | No | No |
| Registrar y consultar ventas | Sí | Sí | Sí |
| Anular o corregir ventas | Sí | Sí | No |
| Ver productos, existencias y clientes | Sí | Sí | Sí |
| Administrar productos e inventario | Sí | Sí | No |
| Cuentas por cobrar y abonos | Sí | Sí | No |
| Compras, proveedores y cuentas por pagar | Sí | Sí | No |
| Gastos, caja y bancos | Sí | Sí | No |
| Reportes | Sí | Sí | No |
| Usar el asistente de IA | Sí | Sí | Sí |

*Permisos que el servidor verifica en cada petición.*

### Manejo de errores

Todas las respuestas de error tienen la misma forma, con un código, un mensaje y un identificador de la petición, y usan el código HTTP correspondiente: 400 cuando los datos no son válidos (con el detalle de cada campo), 401 sin sesión, 403 sin permiso o desde un origen no permitido, 404 cuando el registro no existe, 409 cuando la operación contradice una regla del negocio o reutiliza una llave de idempotencia con otros datos, 429 cuando se superan los límites y 503 cuando un servicio externo no está disponible. Los mensajes no incluyen detalles internos del servidor.

**Figura 31. Respuestas del API ante errores y controles de seguridad**

![Respuestas del API ante errores y controles de seguridad](fase3/term-06-api-security.jpg)

*Peticiones reales al API: sin sesión, sin permiso, con datos inválidos, repetida con la misma llave, desde un origen no permitido y a un registro inexistente.*

### Comunicación en tiempo real

El WebSocket /v1/realtime admite solo a miembros del negocio activo que se conectan desde un origen permitido. Cuando una operación se guarda, el servidor envía a las demás sesiones del negocio el evento business.changed con el módulo afectado, y cada pantalla abierta vuelve a consultar sus datos sin que el usuario recargue la página.

**Figura 32. Eventos del WebSocket**

![Eventos del WebSocket](fase3/term-07-realtime.jpg)

*La sesión del vendedor recibe el evento business.changed cuando el dueño registra una venta desde otra sesión.*

**Figura 33. Pantalla Hoy del dueño antes de una venta registrada en otro equipo**

![Pantalla Hoy del dueño antes de una venta registrada en otro equipo](fase3/realtime-before-desktop.jpg)

*Dinero disponible y movimientos de hoy antes de la venta.*

**Figura 34. Pantalla Hoy del dueño actualizada en tiempo real**

![Pantalla Hoy del dueño actualizada en tiempo real](fase3/realtime-after-desktop.jpg)

*Sin recargar la página, aparecen la venta registrada por el vendedor y el nuevo saldo.*

## Base de datos y persistencia

### Migraciones

La base de datos se crea con doce migraciones SQL generadas con Drizzle a partir del modelo relacional. El comando bun run db:migrate las aplica en orden y deja creadas 38 tablas; el mismo procedimiento se usó para la base de datos en la nube.

**Figura 35. Migraciones y carga de los datos de prueba**

![Migraciones y carga de los datos de prueba](fase3/term-03-migrations.jpg)

*Ejecución de las migraciones y del seed sobre una base de datos nueva; la segunda ejecución del seed no duplica información.*

**Figura 36. Tablas creadas en PostgreSQL**

![Tablas creadas en PostgreSQL](fase3/term-04-tables.jpg)

*Listado de las tablas después de aplicar las migraciones.*

### Integridad de los datos

Las relaciones usan llaves foráneas que incluyen el negocio, de modo que ningún registro puede apuntar a datos de otro negocio. Las restricciones CHECK impiden montos negativos, estados no válidos o movimientos de caja sin su origen, y las restricciones únicas evitan registros duplicados, como dos productos con el mismo código en un negocio. Las cantidades de dinero se guardan como enteros en centavos para evitar errores de redondeo.

**Figura 37. Restricciones de integridad y contraseñas cifradas**

![Restricciones de integridad y contraseñas cifradas](fase3/term-05-integrity.jpg)

*Llaves foráneas, restricciones CHECK y restricciones únicas por tabla, y las contraseñas de los usuarios de prueba guardadas como hash.*

### Datos de prueba

El comando bun run db:seed crea los tres usuarios de prueba con sus roles y el negocio Abarrotes La Ceiba con seis semanas de historia. Cada registro se guarda con los mismos comandos que usa el API, por lo que las existencias, los saldos y las deudas quedan consistentes. Al terminar, el negocio tiene clientes con saldo pendiente, una deuda y una factura de proveedor vencidas, un producto con existencia baja y otro agotado, para que todas las pantallas muestren información.

**Tabla 13. Datos cargados en la demostración**

| Elemento | Cantidad | Detalle |
| --- | --- | --- |
| Usuarios | 3 | Dueño, encargado y vendedor |
| Productos | 13 | En cuatro categorías, con existencias y mínimo de alerta |
| Proveedores y clientes | 4 y 5 | Con contacto y condiciones de crédito |
| Ventas | 381 | Ventas diarias con productos, algunas dictadas o escritas al asistente |
| Compras | 22 | Compras semanales al contado y al crédito |
| Gastos | 19 | Alquiler, luz, agua, internet, fletes y pago al ayudante |
| Pagos y abonos | 22 | Pagos a proveedores y abonos de clientes |
| Depósitos | 6 | Traslados semanales de la caja al banco |

*Registros del negocio Abarrotes La Ceiba en la base de datos de la demostración.*

## Frontend: interfaz de usuario

Las pantallas se implementaron a partir de los prototipos de alta fidelidad de la Fase 2, con la misma paleta verde bosque y acento lima, la misma navegación y los mismos flujos. Todas consumen el API real y se actualizan con los eventos en tiempo real. En cada figura se muestra la versión de escritorio y la de teléfono, igual que en los prototipos.

**Tabla 14. Correspondencia entre los prototipos y las pantallas implementadas**

| Prototipo (Fase 2) | Pantalla implementada | Figura |
| --- | --- | --- |
| Figura 9. Inicio de sesión | Iniciar sesión | 39 |
| Figuras 10 y 11. Menú principal y menú de opciones | Hoy y menú ¿Qué quiere registrar? | 40, 41 |
| Figura 12. Nuevo registro | Dictado por voz | 42 |
| Figura 13. Revisar venta | Revisión del registro preparado por el asistente | 43 |
| Figura 14. Movimientos | Movimientos | 44 |
| Figura 15. Nueva venta | Nueva venta | 45 |
| Figura 16. Nueva compra | Nueva compra | 46 |
| Figura 17. Nuevo gasto | Nuevo gasto | 47 |
| Figura 18. Cuentas por cobrar | Cuentas por cobrar | 48 |
| Figura 19. Registrar abono | Registrar abono | 49 |
| Figura 20. Cuentas por pagar | Cuentas por pagar | 50 |
| Figura 21. Productos | Productos | 51 |
| Figura 22. Proveedores | Proveedores | 52 |
| Figura 23. Reportes | Reportes | 54 |
| Figura 24. Configuración | Configuración y gestión de usuarios | 56 |

*Las figuras de la izquierda corresponden al documento de la Fase 2.*

### Pantallas implementadas

**Figura 38. Página pública del sistema**

![Página pública del sistema](fase3/landing.jpg)

*Página que ve una persona antes de iniciar sesión, con un negocio de ejemplo y el registro por voz.*

**Figura 39. Pantalla Inicio de Sesión**

![Pantalla Inicio de Sesión](fase3/signin.jpg)

*Interfaz de inicio de sesión del sistema implementado.*

**Figura 40. Pantalla Hoy (menú principal)**

![Pantalla Hoy (menú principal)](fase3/home.jpg)

*Dinero disponible con su evolución de 30 días, registro por voz o texto, movimientos de hoy, cuentas por cobrar y próximo pago.*

**Figura 41. Pantalla del menú de opciones**

![Pantalla del menú de opciones](fase3/new-menu.jpg)

*Menú ¿Qué quiere registrar? con las cinco operaciones del prototipo.*

**Figura 42. Pantalla del módulo Nuevo registro**

![Pantalla del módulo Nuevo registro](fase3/dictation.jpg)

*Registro por voz: el sistema escucha la frase y, al detenerse, prepara el registro para revisarlo.*

**Figura 43. Pantalla del módulo Revisar Venta**

![Pantalla del módulo Revisar Venta](fase3/assistant-review.jpg)

*La frase dictada aparece con sus fragmentos numerados y el formulario de venta queda lleno con los mismos números; el usuario corrige lo necesario y confirma.*

**Figura 44. Pantalla del módulo Movimientos**

![Pantalla del módulo Movimientos](fase3/movements.jpg)

*Ventas, compras, gastos, abonos y pagos en un solo listado, con los totales del período.*

**Figura 45. Pantalla del módulo Nueva Venta**

![Pantalla del módulo Nueva Venta](fase3/sale-new.jpg)

*Venta con productos, forma de pago, cuenta que recibe y total.*

**Figura 46. Pantalla del módulo Nueva Compra**

![Pantalla del módulo Nueva Compra](fase3/purchase-new.jpg)

*Compra al crédito con sus productos, costos, fecha de vencimiento y total.*

**Figura 47. Pantalla del módulo Nuevo Gasto**

![Pantalla del módulo Nuevo Gasto](fase3/expense-new.jpg)

*Registro de un gasto con su categoría, monto y cuenta de la que sale el dinero.*

**Figura 48. Pantalla del módulo Cuentas por cobrar**

![Pantalla del módulo Cuentas por cobrar](fase3/receivables.jpg)

*Saldos de los clientes, antigüedad de las deudas y estado de cada cuenta.*

**Figura 49. Pantalla del módulo Registrar Abono**

![Pantalla del módulo Registrar Abono](fase3/payment.jpg)

*Abono de un cliente con el saldo actual y el saldo después del abono.*

**Figura 50. Pantalla del módulo Cuentas por Pagar**

![Pantalla del módulo Cuentas por Pagar](fase3/payables.jpg)

*Lo que el negocio debe a sus proveedores, lo vencido y el próximo pago.*

**Figura 51. Pantalla del módulo Productos**

![Pantalla del módulo Productos](fase3/products.jpg)

*Existencias contra el mínimo de cada producto, con existencia baja y agotado.*

**Figura 52. Pantalla del módulo Proveedores**

![Pantalla del módulo Proveedores](fase3/suppliers.jpg)

*Proveedores con su saldo pendiente y sus compras recientes.*

**Figura 53. Pantalla del módulo Clientes**

![Pantalla del módulo Clientes](fase3/customers.jpg)

*Clientes del negocio con su teléfono y saldo.*

**Figura 54. Pantalla del módulo Reportes**

![Pantalla del módulo Reportes](fase3/reports.jpg)

*Estado de resultados de octubre y flujo de caja de los últimos meses.*

**Figura 55. Pantalla del módulo Caja y bancos**

![Pantalla del módulo Caja y bancos](fase3/cash.jpg)

*Saldo de cada cuenta y sus movimientos recientes.*

**Figura 56. Pantalla del módulo Configuración**

![Pantalla del módulo Configuración](fase3/settings.jpg)

*Datos del negocio, usuarios con su rol y matriz de permisos.*

**Figura 57. Agregar un usuario al negocio**

![Agregar un usuario al negocio](fase3/settings-add-desktop.jpg)

*El dueño crea la cuenta de un empleado con su rol y una contraseña inicial.*

### Estados de la interfaz

Cada pantalla muestra el estado real de la información: una estructura de carga mientras llegan los datos, mensajes de validación junto al campo con error, una confirmación al guardar, el mensaje del servidor cuando una operación no se puede realizar y un aviso claro cuando el rol del usuario no tiene permiso.

**Figura 58. Estado de carga**

![Estado de carga](fase3/state-loading-desktop.jpg)

*La pantalla Reportes mientras llegan los datos.*

**Figura 59. Validación de un formulario**

![Validación de un formulario](fase3/state-validation-desktop.jpg)

*Al intentar revisar un gasto sin concepto ni monto, el formulario señala los campos obligatorios.*

**Figura 60. Confirmación de una operación**

![Confirmación de una operación](fase3/state-success-desktop.jpg)

*Después de guardar, la venta abre su detalle y aparece la notificación Venta guardada.*

**Figura 61. Visualización de errores**

![Visualización de errores](fase3/state-error-desktop.jpg)

*Mensaje al intentar iniciar sesión con una contraseña incorrecta.*

**Figura 62. Pantalla Hoy del vendedor**

![Pantalla Hoy del vendedor](fase3/seller-home-desktop.jpg)

*El vendedor solo ve los módulos que su rol permite.*

**Figura 63. Acceso denegado por rol**

![Acceso denegado por rol](fase3/state-denied-desktop.jpg)

*Si el vendedor abre Reportes, el sistema le indica que su rol no lo permite.*

## Colección de pruebas del API

En la carpeta docs/postman del repositorio se encuentran la colección exportada y dos entornos, uno local y otro para la demostración. La colección se importa en Postman o en Bruno y prueba de forma independiente cada endpoint: 147 peticiones organizadas en 16 carpetas que verifican el código de respuesta y el contenido. Para ejecutarla completa se usa una pausa de 1000 ms entre peticiones, porque el API limita la cantidad de escrituras por minuto.

**Figura 64. Ejecución de la colección de pruebas**

![Ejecución de la colección de pruebas](fase3/term-08-newman.jpg)

*Resultado de la colección ejecutada con Newman: las 147 peticiones y las 285 verificaciones terminan sin fallos.*

## Pruebas manuales realizadas

Antes de la demostración el equipo verificó el sistema de forma manual, usando la interfaz y la colección de peticiones. La tabla resume los casos principales y su resultado.

**Tabla 15. Casos de prueba manual**

| Caso | Pasos | Resultado esperado | Resultado |
| --- | --- | --- | --- |
| Inicio de sesión | Ingresar con dueno@pisto.test y su contraseña | Se abre la pantalla Hoy del negocio | Correcto |
| Contraseña incorrecta | Ingresar con una contraseña equivocada | Mensaje de error sin entrar al sistema | Correcto |
| Venta con productos y crédito | Agregar productos, cobrar una parte y elegir cliente y fecha de pago | Bajan las existencias y el saldo queda por cobrar | Correcto |
| Registro con el asistente | Escribir o dictar una venta y pulsar Revisar | El formulario aparece lleno para confirmar | Correcto |
| Compra al crédito | Elegir proveedor, productos y condición al crédito | Suben las existencias y la deuda aparece en Por pagar | Correcto |
| Pago mayor al saldo | Registrar un pago a proveedor mayor a lo que se debe | El sistema rechaza el pago | Correcto |
| Validación de gasto | Pulsar Revisar gasto sin concepto ni monto | Se señalan los campos obligatorios | Correcto |
| Permisos por rol | Ingresar como vendedor y abrir Reportes | Aviso de que el rol no lo permite | Correcto |
| Gestión de usuarios | Agregar un vendedor, cambiar su rol y quitarlo | Cada cambio se guarda y el usuario quitado pierde el acceso | Correcto |
| Tiempo real | Registrar una venta como vendedor mientras el dueño ve la pantalla Hoy | La venta aparece al dueño sin recargar | Correcto |
| API sin sesión | Enviar una petición a /v1/sales sin iniciar sesión | Respuesta 401 | Correcto |
| Colección completa | Ejecutar la colección con Newman | 147 peticiones y 285 verificaciones sin fallos | Correcto |

*Pruebas manuales y exploratorias realizadas sobre el sistema local y la demostración en vivo.*

## Demostración y despliegue

### Despliegue en la nube

El MVP está desplegado en Cloudflare Workers. Un Worker entrega la aplicación web y dirige las peticiones del API a un Durable Object, que se conecta a PostgreSQL en Neon con un usuario de permisos mínimos y usa Workers AI para el asistente. Las migraciones se aplican a la base de datos en la nube con un usuario distinto, reservado para cambios de estructura.

**Figura 65. Despliegue en Cloudflare Workers**

![Despliegue en Cloudflare Workers](fase3/term-09-deploy.jpg)

*Salida del despliegue con los servicios enlazados y la verificación del estado del servicio en la dirección pública.*

### Guion de la demostración en vivo

- Abrir https://pisto.contact-862.workers.dev, mostrar la página pública e iniciar sesión como dueno@pisto.test.
- En la pantalla Hoy, explicar el dinero disponible, las cuentas por cobrar y el próximo pago.
- Pulsar Dictar, o escribir en Registrar: «Le vendí a Rosa Ayala dos libras de arroz y una Coca-Cola, me pagó un dólar en efectivo y el resto me lo queda debiendo». Revisar el formulario, guardar la venta y mostrarla en Movimientos y en Cuentas por cobrar.
- Registrar una compra al crédito, revisar la deuda en Cuentas por pagar y registrar el pago al proveedor.
- Abrir otra ventana como vendedor@pisto.test, registrar una venta y mostrar que la pantalla del dueño se actualiza sola; mostrar que el vendedor no puede abrir Reportes.
- En Configuración, agregar un usuario con rol de vendedor y cambiar su rol.
- Mostrar la colección de Postman y una petición rechazada por falta de sesión o por datos inválidos.

## Matriz de cumplimiento de la Fase 3

**Tabla 16. Requisitos de la guía de la Fase 3 y su evidencia**

| Requisito | Evidencia |
| --- | --- |
| Repositorio con historial de trabajo y estrategia de ramas | Repositorio en GitHub (Anexo 1) y Figura 27 |
| README con prerrequisitos, instalación, variables de entorno, base de datos y seeds | Figuras 28, 29 y 30 |
| Arquitectura del sistema | Tabla de capas y módulos |
| Endpoints de autenticación, usuarios, recursos principales y soporte | Tabla de endpoints y colección de Postman |
| Contraseñas cifradas, sesiones y control por roles | Figura 37, tabla de permisos y Figura 63 |
| Manejo de errores del servidor | Figura 31 |
| Comunicación en tiempo real | Figuras 32, 33 y 34 |
| Migraciones e integridad de datos | Figuras 35, 36 y 37 |
| Datos de prueba con usuarios y roles | Figura 35 y tablas de usuarios y datos cargados |
| Pantallas basadas en los prototipos | Figuras 38 a 57 |
| Estados de la interfaz | Figuras 58 a 63 |
| Colección de pruebas del API | docs/postman y Figura 64 |
| Demostración en vivo | Figura 65, Anexo 3 y guion de la demostración |

*Relación entre cada requisito de la guía y la evidencia presentada en este documento.*

## Referencias Bibliográficas

- Better Auth. (s.f.). Better Auth documentation. https://www.better-auth.com/docs
- Cloudflare. (s.f.). Durable Objects. Cloudflare Docs. https://developers.cloudflare.com/durable-objects/
- Cloudflare. (s.f.). Workers AI. Cloudflare Docs. https://developers.cloudflare.com/workers-ai/
- Drizzle Team. (s.f.). Drizzle ORM documentation. https://orm.drizzle.team/docs/overview
- Elysia. (s.f.). Elysia documentation. https://elysiajs.com/
- Expo. (s.f.). Introduction to Expo Router. Expo Documentation. https://docs.expo.dev/router/introduction/
- Neon. (s.f.). Neon documentation. https://neon.com/docs
- Postman. (s.f.). Run collections using Newman CLI. Postman Docs. https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/
- The PostgreSQL Global Development Group. (s.f.). PostgreSQL 18 documentation. https://www.postgresql.org/docs/18/

## Anexos

### Anexo 1. Repositorio de GitHub

https://github.com/Eclalune-BTC/pisto-app

### Anexo 2. Tablero ágil de gestión en Trello

https://trello.com/b/PoTcegqU/sistema-financiero-mypes-product-backlog-y-sprint-1

### Anexo 3. Demostración en vivo

https://pisto.contact-862.workers.dev

### Anexo 4. Colección de pruebas del API

https://github.com/Eclalune-BTC/pisto-app/tree/main/docs/postman
