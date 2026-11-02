export const operate = {
  loading: "Consultando las operaciones de tu negocio…",
  unavailableTitle: "No pudimos abrir las operaciones",
  unavailableDescription:
    "No pudimos comprobar tu acceso a las operaciones. Revisa tu conexión y vuelve a intentarlo.",
  noAccessTitle: "No tienes acceso a estas operaciones",
  noAccessDescription:
    "Tu membresía no incluye permisos de lectura para estas operaciones. Pídele acceso a una persona administradora del negocio.",
  home: {
    title: "Hoy",
    money: {
      title: "Dinero disponible",
      since: "desde el {{date}}",
      noChange: "sin cambio desde el {{date}}",
      rangeLabel: "Período del gráfico",
      ranges: { "7d": "7 días", "30d": "30 días", "6m": "6 meses" },
      chartLabel: "Dinero disponible al cierre de cada día",
      point: "{{date}}: {{amount}}",
      today: "Hoy",
      noAccountsTitle: "Aún no hay cuentas de dinero",
      noAccountsDescription:
        "Cree la caja o la cuenta de banco del negocio para ver aquí cuánto dinero tiene.",
      createAccount: "Crear cuenta",
      unavailableTitle: "No pudimos cargar el dinero disponible",
      unavailable: "Ningún registro cambió. Vuelva a intentarlo en un momento.",
      kinds: {
        cash: "Caja",
        bank: "Banco",
        mobile_money: "Billetera móvil",
        other: "Otras cuentas",
      },
      owed: "Le deben",
      overdue: "{{amount}} vencido",
      nothingOverdue: "Nada vencido",
    },
    today: {
      title: "Movimientos de hoy",
      all: "Ver todo",
      emptyTitle: "Hoy todavía no hay movimientos",
      emptyDescription: "Las ventas, gastos y abonos de hoy aparecen aquí al registrarlos.",
      unavailableTitle: "No pudimos cargar los movimientos de hoy",
      unavailable: "Revise su conexión y vuelva a intentarlo.",
    },
    debtors: {
      title: "Por cobrar",
      nothingOverdue: "Nada vencido",
      customers_one: "{{count}} cliente",
      customers_other: "{{count}} clientes",
      overdueSince: "Vencido desde el {{date}}",
      dueOn: "Vence el {{date}}",
      noDueDate: "Sin fecha de vencimiento",
      emptyTitle: "Nadie le debe",
      emptyDescription: "Las ventas al crédito y las cuentas por cobrar aparecen aquí.",
      unavailableTitle: "No pudimos cargar las cuentas por cobrar",
      all: "Ver todo",
    },
    recentSales: "Ventas recientes",
    allSales: "Ver todas",
    salesUnavailableTitle: "No pudimos cargar las ventas recientes",
    salesUnavailable: "Revise su conexión y vuelva a intentarlo.",
    noSalesTitle: "Aún no hay ventas",
    noSalesDescription: "Las ventas que registre aparecerán aquí con su fecha y total.",
  },
  groups: {
    money: "Dinero",
    accounts: "Cuentas",
    catalog: "Catálogo",
    insight: "Análisis",
  },
  modules: {
    movements: {
      label: "Movimientos",
      description: "Todo el dinero que entra y sale del negocio.",
    },
    sales: {
      label: "Ventas",
      description: "Registra ingresos y consulta el historial de ventas.",
    },
    expenses: {
      label: "Gastos",
      description: "Registra egresos revisados y consulta sus categorías.",
    },
    cash: {
      label: "Caja y bancos",
      description: "Controla saldos, movimientos, ajustes y transferencias.",
    },
    catalog: {
      label: "Productos",
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
      label: "Por cobrar",
      description: "Controla saldos pendientes, pagos y vencimientos.",
    },
    suppliers: {
      label: "Proveedores",
      description: "Datos de contacto, compras y saldo de cada proveedor.",
    },
    payables: {
      label: "Por pagar",
      description: "Lo que debe a sus proveedores y cuándo vence.",
    },
    reports: {
      label: "Reportes",
      description: "Consulta cifras exactas de un período y la posición operativa actual.",
    },
  },
} as const;
