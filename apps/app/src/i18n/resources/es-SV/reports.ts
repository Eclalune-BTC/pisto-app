export const reports = {
  title: "Reportes",
  description: "Cómo le fue al negocio y cuánto dinero entró y salió.",
  loading: "Preparando el reporte…",
  deniedTitle: "No puede consultar reportes",
  deniedDescription: "Su rol en este negocio no incluye permiso para leer reportes.",
  unavailableTitle: "No pudimos cargar el reporte",
  unavailable: "No pudimos obtener las cifras de este mes. Vuelva a intentarlo en un momento.",
  queriedAt: "Consultado el {{date}}",
  month: {
    label: "Mes del reporte",
    previous: "Mes anterior",
    next: "Mes siguiente",
  },
  period: {
    saleCount_one: "{{value}} venta",
    saleCount_other: "{{value}} ventas",
  },
  statement: {
    title: "Estado de resultados",
    period: "Del {{start}} al {{end}}",
    sales: "Ventas",
    operatingExpenses: "Gastos de operación",
    totalExpenses: "Total de gastos",
    result: "Ventas menos gastos",
    resultShare: "{{share}} de las ventas",
    noActivity: "No se registraron ventas, gastos ni movimientos de caja en este mes.",
    scope:
      "Incluye ventas al crédito aunque no se hayan cobrado y excluye lo anulado. No descuenta el costo de la mercadería vendida, que Pisto aún no registra por venta.",
  },
  expenses: {
    empty: "No se registraron gastos en este mes.",
  },
  cashFlow: {
    title: "Flujo de caja",
    range: "De {{start}} a {{end}}",
    loadingDescription: "Entradas y salidas por mes",
    inflow: "Entró",
    outflow: "Salió",
    monthToDate: "{{month}}, al {{day}}",
    tableLabel: "Flujo de caja por mes",
    columns: {
      month: "Mes",
      inflow: "Entró",
      outflow: "Salió",
      net: "Diferencia",
      closing: "Saldo al cierre",
    },
    scope:
      "Todo el dinero que entró a las cuentas del negocio o salió de ellas; las transferencias entre sus propias cuentas no cuentan. El saldo al cierre suma todas las cuentas.",
    unavailableTitle: "No pudimos cargar el flujo de caja",
    unavailableDescription: "El estado de resultados sigue disponible. Vuelva a intentarlo.",
  },
} as const;
