export const operate = {
  loading: "Consultando las operaciones de tu negocio…",
  unavailableTitle: "No pudimos abrir las operaciones",
  unavailableDescription:
    "No pudimos comprobar tu acceso a las operaciones. Revisa tu conexión y vuelve a intentarlo.",
  noAccessTitle: "No tienes acceso a estas operaciones",
  noAccessDescription:
    "Tu membresía no incluye permisos de lectura para estas operaciones. Pídele acceso a una persona administradora del negocio.",
  home: {
    title: "Inicio",
    description: "{{month}} · Cifras en {{currency}}",
    newExpense: "Registrar gasto",
    sales: "Ventas del mes",
    saleCount_one: "{{count}} venta registrada",
    saleCount_other: "{{count}} ventas registradas",
    expenses: "Gastos del mes",
    expenseCount_one: "{{count}} gasto registrado",
    expenseCount_other: "{{count}} gastos registrados",
    netCash: "Neto de caja del mes",
    cashFlow: "Entradas {{inflow}} · Salidas {{outflow}}",
    receivables: "Por cobrar hoy",
    overdue: "{{amount}} vencido",
    openReceivables_one: "{{count}} cuenta abierta",
    openReceivables_other: "{{count}} cuentas abiertas",
    period:
      "Del {{start}} al {{end}}. Saldo por cobrar al {{position}}. Las ventas no se registran como movimientos de caja.",
    fullReport: "Ver reporte",
    reportUnavailableTitle: "No pudimos cargar el resumen del mes",
    reportUnavailable:
      "Las cifras aparecen cuando la consulta responde correctamente. Ningún registro cambió.",
    lowStock_one: "{{count}} producto tiene existencias bajas.",
    lowStock_other: "{{count}} productos tienen existencias bajas.",
    viewInventory: "Ver inventario",
    recentSales: "Ventas recientes",
    allSales: "Ver todas",
    salesUnavailableTitle: "No pudimos cargar las ventas recientes",
    salesUnavailable: "Revisa tu conexión y vuelve a intentarlo.",
    noSalesTitle: "Aún no hay ventas",
    noSalesDescription: "Las ventas que registres aparecerán aquí con su fecha y total.",
  },
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
