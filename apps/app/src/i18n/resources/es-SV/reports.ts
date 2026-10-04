export const reports = {
  overview: {
    eyebrow: "Mi negocio",
    title: "Reportes",
    description:
      "Consulta ventas, gastos y movimientos de efectivo de un período junto con las posiciones operativas actuales.",
  },
  boundary: {
    loading: "Preparando el reporte exacto…",
    deniedTitle: "No puedes consultar reportes completos",
    deniedDescription:
      "El negocio seleccionado o tu rol actual no tiene permiso para leer este reporte.",
    unavailableTitle: "No pudimos consultar el reporte",
  },
  remote: {
    unavailable:
      "La consulta no terminó correctamente. No reemplazamos los valores por ceros inventados.",
  },
  range: {
    title: "Período del reporte",
    description: "Las fechas son inclusivas y usan la zona horaria del negocio.",
    startLabel: "Fecha inicial",
    endLabel: "Fecha final",
    datePlaceholder: "AAAA-MM-DD",
    apply: "Actualizar reporte",
    applying: "Actualizando reporte…",
    invalidStart: "Escribe una fecha inicial real con el formato AAAA-MM-DD.",
    invalidEnd: "Escribe una fecha final real con el formato AAAA-MM-DD.",
    reversed: "La fecha final no puede ser anterior a la fecha inicial.",
    tooLong: "El período no puede superar {{days}} días inclusivos.",
  },
  metadata: {
    period: "Período",
    queriedAt: "Consulta confirmada",
    through: "al",
  },
  period: {
    title: "Flujos del período",
    description: "Solo incluye registros publicados dentro de las fechas seleccionadas.",
    salesGross: "Ventas brutas",
    salesCount: "Ventas publicadas",
    expensesTotal: "Gastos registrados",
    expenseCount: "Gastos publicados",
    cashInflow: "Entradas de efectivo",
    cashOutflow: "Salidas de efectivo",
    cashNet: "Movimiento neto de efectivo",
    zeroTitle: "No hubo flujos publicados en este período",
    zeroDescription:
      "La consulta terminó correctamente y devolvió ceros reales para ventas, gastos y efectivo.",
    accountingBoundary:
      "Las ventas brutas y los gastos registrados se presentan por separado. Este reporte no calcula utilidad.",
  },
  expenses: {
    title: "Gastos por categoría",
    description: "Totales de los gastos publicados durante el período.",
    records: "Registros",
    amount: "Monto",
    empty: "No hay gastos publicados para desglosar en este período.",
  },
  cash: {
    title: "Movimiento por cuenta",
    description:
      "Incluye las cuentas del negocio aunque no hayan tenido movimientos durante el período.",
    inflow: "Entradas",
    outflow: "Salidas",
    net: "Neto",
    empty: "El negocio todavía no tiene cuentas de efectivo para mostrar.",
  },
  position: {
    title: "Posición operativa actual",
    description:
      "Estas posiciones usan el estado actual confirmado y corresponden al {{localDate}} en la zona horaria del negocio.",
    trackedProducts: "Productos activos con existencia controlada",
    lowStockProducts: "Productos activos con existencia baja",
    outstanding: "Cuentas por cobrar pendientes",
    overdue: "Cuentas por cobrar vencidas",
    openReceivables: "Cuentas por cobrar abiertas",
    overdueReceivables: "Cuentas vencidas",
  },
} as const;
