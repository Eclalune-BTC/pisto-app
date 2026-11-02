export const welcome = {
  signIn: "Iniciar sesión",
  createAccount: "Crear cuenta",
  pageTitle: "Pisto · Las cuentas de su negocio, sin cuaderno",
  title: "Las cuentas de su negocio, sin cuaderno.",
  description:
    "Ventas, compras, gastos, caja, cuentas por cobrar y por pagar, y reportes en un solo lugar: usted dice o escribe lo que pasó y Pisto deja el registro listo para revisar.",
  availability: "Funciona en el navegador de su computadora o de su teléfono.",
  preview: {
    label: "Ejemplo de la pantalla Hoy de Pisto con un negocio ficticio y cifras inventadas",
    example: "Negocio y cifras de ejemplo",
  },
  sample: {
    business: "Abarrotes La Ceiba",
    counterSale: "Venta de mostrador",
    electricity: "Factura de luz",
    people: {
      carlos: "Carlos Rivas",
      rosa: "Rosa Ayala",
      comedor: "Comedor El Pilar",
      pedro: "Pedro Alvarado",
      santaRita: "Panificadora Santa Rita",
      elSol: "Abarrotes Mayoreo El Sol",
      lacteos: "Lácteos San Julián",
      centro: "Distribuidora Centro",
    },
  },
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
  how: {
    title: "Cómo funciona",
    description:
      "Una venta, una compra o un gasto se registran con una frase. Nada se guarda hasta que usted lo confirma.",
    steps: {
      say: {
        title: "Dígalo o escríbalo",
        description: "Cuente qué pasó, con quién y cuánto. Si prefiere, escriba la frase.",
        figure: "Ejemplo: Pisto escucha la venta que usted dicta",
      },
      review: {
        title: "Revise lo que entendió",
        description: "Cada dato lleva el número de la parte de la frase de donde salió.",
        figure: "Ejemplo: la venta dictada, lista para revisar",
      },
      save: {
        title: "Guárdelo y véalo al instante",
        description: "La venta aparece en Movimientos y los saldos de caja y de cobros cambian.",
        figure: "Ejemplo: la venta guardada y los saldos que cambió",
      },
    },
  },
  modules: {
    title: "Lo que lleva Pisto",
    description:
      "Cada pantalla responde una pregunta del día con cifras exactas. También lleva productos, inventario, clientes, proveedores y gastos.",
    items: {
      movements: {
        title: "Movimientos",
        description: "Todo el dinero que entra y sale, con la hora, el tipo y cómo se registró.",
        figure: "Ejemplo de los movimientos de un día",
      },
      receivables: {
        title: "Cuentas por cobrar",
        description: "Quién le debe, cuánto y desde cuándo, con la antigüedad de cada saldo.",
        figure: "Ejemplo de las cuentas por cobrar y su antigüedad",
      },
      payables: {
        title: "Cuentas por pagar",
        description: "Lo que debe a sus proveedores y cuándo vence cada pago.",
        figure: "Ejemplo de las cuentas por pagar y el próximo pago",
      },
      reports: {
        title: "Reportes",
        description: "Cuánto entró y salió cada mes, con las cifras detrás de cada barra.",
        figure: "Ejemplo del flujo de caja de seis meses",
      },
    },
  },
  roles: {
    title: "Usted decide qué se guarda y quién lo ve",
    description:
      "Cada persona entra con su propio usuario y un rol: propietario, encargado o vendedor. Pisto revisa ese rol antes de mostrar o guardar cualquier dato.",
    trust: {
      confirmed: {
        title: "Usted confirma cada registro",
        description:
          "Lo que Pisto entiende de una frase es solo un borrador. Nada se guarda hasta que una persona lo revisa y lo confirma.",
      },
      business: {
        title: "Cada dato es de un solo negocio",
        description:
          "Ventas, cuentas y reportes quedan en el negocio donde se registraron, con su fecha, su cuenta y quién lo hizo.",
      },
      scope: {
        title: "Lo que Pisto no hace",
        description:
          "No emite factura electrónica (DTE), no calcula planillas y no se conecta con su banco. Sirve para llevar la operación del día; la contabilidad sigue a cargo de su contador.",
      },
    },
  },
  cta: {
    title: "Lleve sus cuentas desde hoy.",
    description: "Cree su cuenta, registre su negocio y anote su primera venta.",
  },
  footer: {
    links: "Acceso a Pisto",
  },
} as const;
