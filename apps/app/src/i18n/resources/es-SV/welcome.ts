export const welcome = {
  signIn: "Iniciar sesión",
  createAccount: "Crear cuenta",
  pageTitle: "Pisto · Ventas, gastos, inventario y cobros",
  navigation: "Conoce Pisto",
  sectionLinks: { product: "Funciones", workflow: "Cómo empezar", questions: "Preguntas" },
  title: "Tu negocio, en orden.",
  description:
    "Registra tus ventas y gastos, organiza el inventario y da seguimiento a lo que te deben. Todo desde el mismo lugar.",
  explore: "Ver funciones",
  audience: "Gestión para pequeños negocios",
  availability: "Desde la web, en tu computadora o teléfono.",
  product: {
    title: "Una herramienta para cada parte de tu negocio.",
    description:
      "Explora cómo se llevan las operaciones, los productos, los clientes y los reportes en Pisto.",
    navigation: "Explorar funciones de Pisto",
    captureNote: "Interfaz de Pisto · formularios y controles de ejemplo.",
    money: {
      tab: "Dinero",
      title: "Cada movimiento, en su lugar.",
      description:
        "Registra lo que vendes y lo que pagas. Vuelve al historial cuando necesites revisar una operación.",
      imageAlt:
        "Formulario de Pisto para registrar una venta, con el monto y la descripción sin completar.",
    },
    stock: {
      tab: "Productos",
      title: "Ten claro qué tienes disponible.",
      description:
        "Organiza tu catálogo y lleva las entradas y ajustes de inventario con un historial de movimientos.",
      imageAlt:
        "Formulario de nuevo producto en Pisto: nombre, SKU y precio vacíos, con el selector de categoría.",
    },
    relationships: {
      tab: "Clientes",
      title: "Dale seguimiento a cada cobro.",
      description:
        "Mantén los contactos y sus cargos en orden. Distingue lo pendiente, lo vencido y lo que ya se pagó.",
      imageAlt:
        "Formulario real de Pisto para agregar un cliente, con los campos de contacto vacíos.",
    },
    insight: {
      tab: "Reportes",
      title: "Consulta el período que te interesa.",
      description:
        "Revisa ventas, gastos y movimientos de caja por fechas. Los saldos y existencias actuales se presentan por separado.",
      imageAlt:
        "Selector de fechas de un reporte de Pisto. La captura muestra los controles, no cifras de operaciones.",
    },
  },
  workflow: {
    title: "Empieza por lo que necesitas hoy.",
    description: "Configura tu negocio una vez. Después, registra y consulta a tu ritmo.",
    setup: {
      title: "Crea tu cuenta y tu negocio",
      description:
        "Elige la moneda y la zona horaria. Añade las cuentas, productos o clientes con los que vas a trabajar.",
    },
    record: {
      title: "Registra una operación",
      description:
        "Completa el formulario y revisa los datos antes de confirmar. Cada registro conserva su historial.",
    },
    understand: {
      title: "Consulta el historial",
      description:
        "Busca una operación o un cliente, filtra tus registros y consulta los reportes del período que te interesa.",
    },
  },
  questions: {
    title: "Preguntas frecuentes",
    description: "Qué incluye Pisto hoy y qué conviene tener claro antes de empezar.",
    sales: {
      question: "¿Una venta descuenta inventario o entra a caja automáticamente?",
      answer:
        "No. Hoy las ventas se registran por importe total. El inventario y la caja se llevan por separado. Los gastos pagados y los cobros de clientes sí generan su movimiento de caja al confirmarlos.",
    },
    accounting: {
      question: "¿Reemplaza mi contabilidad o emite facturas fiscales?",
      answer:
        "No. Pisto organiza la operación del negocio; no calcula impuestos, no emite facturas fiscales ni sincroniza bancos. Sus reportes no son estados contables ni un cálculo de utilidad.",
    },
    assistant: {
      question: "¿Ya puedo registrar con inteligencia artificial o con mi voz?",
      answer:
        "Todavía no. Hoy registras y consultas mediante formularios. El asistente por texto y la entrada por voz son funciones previstas, no incluidas en la versión actual.",
    },
    devices: {
      question: "¿Dónde puedo usarlo?",
      answer:
        "La interfaz web se adapta a computadora y teléfono. Las versiones nativas para Android e iOS siguen en validación y aún no están publicadas en tiendas. Necesitas conexión para consultar y confirmar operaciones.",
    },
  },
  closing: {
    title: "Dale un lugar a las cuentas de tu negocio.",
    description: "Crea tu cuenta, configura tu negocio y comienza con tu primer registro.",
  },
  footer: "Gestión para pequeños negocios.",
} as const;
