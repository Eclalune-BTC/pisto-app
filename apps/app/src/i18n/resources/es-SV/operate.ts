export const operate = {
  loading: "Consultando las operaciones de tu negocio…",
  unavailableTitle: "No pudimos abrir las operaciones",
  unavailableDescription:
    "No pudimos comprobar tu acceso a las operaciones. Revisa tu conexión y vuelve a intentarlo.",
  description: "Elige una tarea para registrar o consultar información de este negocio.",
  noAccessTitle: "No tienes acceso a estas operaciones",
  noAccessDescription:
    "Tu membresía no incluye permisos de lectura para estas operaciones. Pídele acceso a una persona administradora del negocio.",
  groups: {
    money: "Día a día",
    stock: "Productos",
    relationships: "Clientes y cobros",
    insight: "Análisis",
  },
  modules: {
    sales: {
      label: "Ventas",
      description: "Registra ingresos y consulta el historial de ventas.",
    },
    expenses: {
      label: "Gastos",
      description: "Registra egresos revisados y consulta sus categorías.",
    },
    cash: {
      label: "Caja y cuentas",
      description: "Controla saldos, movimientos, ajustes y transferencias.",
    },
    catalog: {
      label: "Catálogo",
      description: "Administra productos, precios y categorías.",
    },
    inventory: {
      label: "Inventario",
      description: "Consulta existencias y registra movimientos verificables.",
    },
    customers: {
      label: "Clientes",
      description: "Mantén los datos y el historial de cada cliente.",
    },
    receivables: {
      label: "Cuentas por cobrar",
      description: "Controla saldos pendientes, pagos y vencimientos.",
    },
    reports: {
      label: "Reportes",
      description: "Consulta cifras exactas de un período y la posición operativa actual.",
    },
  },
} as const;
