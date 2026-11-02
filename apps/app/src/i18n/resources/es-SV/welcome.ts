export const welcome = {
  signIn: "Iniciar sesión",
  createAccount: "Crear cuenta",
  pageTitle: "Pisto · Las cuentas de su negocio, sin cuaderno",
  title: "Las cuentas de su negocio, sin cuaderno.",
  description:
    "Diga o escriba lo que vendió, compró o cobró. Pisto llena el registro y usted lo revisa antes de guardar.",
  availability: "Funciona en el navegador de su computadora o de su teléfono.",
  example: {
    label: "Ejemplo de una venta dictada",
    youSaid: "Usted dijo",
    said: "Le vendí a don Carlos tres libras de café, me dio cinco dólares y el resto me lo quedó debiendo.",
    fragments: {
      kind: "vendí",
      customer: "don Carlos",
      product: "tres libras de café",
      received: "cinco dólares",
      credit: "el resto me lo quedó debiendo",
    },
    reviewTitle: "Venta lista para revisar",
    unsaved: "Sin guardar",
    rows: {
      kind: { label: "Tipo", value: "Venta" },
      customer: { label: "Cliente", value: "Carlos Rivas" },
      product: { label: "Producto", value: "Café molido 1 lb, 3 a $3.25" },
      received: { label: "Recibido", value: "$5.00 en efectivo" },
      credit: { label: "Queda debiendo", value: "$4.75" },
    },
  },
  records: {
    title: "Lo que lleva Pisto",
    description: "Cada registro queda con su fecha, su cuenta y quién lo hizo.",
    items: {
      sales: {
        title: "Ventas",
        description:
          "Con productos, forma de pago y crédito. Lo que le quedan debiendo pasa a cuentas por cobrar.",
      },
      purchases: {
        title: "Compras y proveedores",
        description: "La mercadería que le venden, al contado o al crédito, con su proveedor.",
      },
      expenses: {
        title: "Gastos",
        description:
          "Luz, alquiler, transporte y otros pagos, con la cuenta de la que salió el dinero.",
      },
      cash: {
        title: "Caja y bancos",
        description: "El saldo de cada cuenta y sus entradas, salidas, ajustes y transferencias.",
      },
      accounts: {
        title: "Cuentas por cobrar y por pagar",
        description: "Quién le debe, a quién le debe, cuánto y desde cuándo.",
      },
      inventory: {
        title: "Inventario",
        description: "Las existencias de cada producto y cuáles se están terminando.",
      },
      reports: {
        title: "Reportes",
        description:
          "Ventas, gastos y movimiento de caja del período que elija, con cifras exactas.",
      },
    },
  },
  scope: {
    title: "Lo que Pisto no hace",
    description:
      "No emite factura electrónica (DTE), no calcula planillas y no se conecta con su banco. Sirve para llevar la operación del día; la contabilidad sigue a cargo de su contador.",
  },
  footer: "Sistema financiero para micro y pequeñas empresas de El Salvador.",
} as const;
