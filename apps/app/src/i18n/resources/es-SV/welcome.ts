export const welcome = {
  signIn: "Iniciar sesión",
  createAccount: "Crear cuenta",
  pageTitle: "Pisto · Ventas, caja y cuentas por cobrar",
  title: "De su voz\na sus cuentas.",
  description:
    "Escriba la venta o díctela en la web. Pisto separa el efectivo de lo que quedó fiado y le deja el borrador para revisar.",
  howLink: "Ver cómo funciona",
  nav: {
    label: "Secciones de esta página",
    menu: "Menú",
    modules: "El producto",
    roles: "Roles y permisos",
  },
  preview: {
    label: "Ejemplo del dinero disponible en Abarrotes La Ceiba",
    phoneLabel: "Ejemplo de la pantalla Hoy de Pisto en un teléfono",
    example: "Negocio y cifras de ejemplo",
  },
  sample: {
    business: "Abarrotes La Ceiba",
    counterSale: "Venta de mostrador",
    electricity: "Factura de luz",
    rent: "Alquiler del local",
    people: {
      carlos: "Carlos Rivas",
      rosa: "Rosa Ayala",
      comedor: "Comedor El Pilar",
      pedro: "Pedro Alvarado",
      santaRita: "Panadería Santa Rita",
      elSol: "Mayoreo El Sol",
      lacteos: "Lácteos San Julián",
      centro: "Distribuidora Centro",
    },
  },
  example: {
    label: "Venta de ejemplo",
    views: { sentence: "Frase", draft: "Borrador" },
    play: "Ver el desglose",
    product: "Café molido",
    line: "{{count}} lb × {{price}}",
    total: "Total de la venta",
    cash: "En efectivo",
    said: "Le vendí a don Carlos tres libras de café, me dio cinco dólares y el resto me lo quedó debiendo.",
    fragments: {
      kind: "vendí",
      customer: "don Carlos",
      product: "tres libras de café",
      received: "cinco dólares",
      credit: "el resto me lo quedó debiendo",
    },
    unsaved: "Sin guardar",
    fields: {
      kind: "Tipo",
      customer: "Cliente",
      product: "Producto",
      received: "Pago",
      credit: "Saldo",
    },
  },
  how: {
    title: "Cómo funciona",
    steps: {
      say: {
        title: "Cuente qué pasó",
        description:
          "Escriba la venta como se la contaría a otra persona. En la web también puede dictarla.",
      },
      review: {
        title: "Revise el borrador",
        description:
          "Compruebe el cliente, los productos y el pago. Puede corregir los datos antes de guardar.",
      },
      save: {
        title: "Confirme la venta",
        description:
          "El efectivo entra en caja y el saldo pendiente queda en la cuenta del cliente.",
      },
    },
  },
  modules: {
    title: "Las cuentas de cada día.",
    description: "Explore las cuentas de Abarrotes La Ceiba con datos de ejemplo.",
    items: {
      movements: {
        tab: "Movimientos",
        title: "¿Qué pasó en caja?",
        description:
          "Todo el dinero que entra y sale, día por día, con la hora y cómo se registró.",
        figure: "Ejemplo de los movimientos de un día",
      },
      receivables: {
        tab: "Por cobrar",
        title: "¿Quién se atrasó en pagar?",
        description: "Cuánto le deben, cuánto está vencido y desde hace cuánto.",
        figure: "Ejemplo del resumen de las cuentas por cobrar y su antigüedad",
      },
      payables: {
        tab: "Por pagar",
        title: "¿Qué factura vence primero?",
        description: "Lo que debe a sus proveedores, factura por factura, y cuándo vence.",
        figure: "Ejemplo de las cuentas por pagar por factura",
      },
      reports: {
        tab: "Reportes",
        title: "¿Cómo cerró el mes?",
        description: "Cuánto entró y salió cada mes, con las cifras detrás de cada barra.",
        figure: "Ejemplo del flujo de caja de seis meses",
      },
    },
  },
  roles: {
    title: "Quién puede ver las cuentas.",
    description:
      "Cada persona entra con su usuario. Su rol define qué puede consultar y registrar.",
    trust: {
      confirmed: {
        title: "Usted confirma cada registro",
        description:
          "Lo que Pisto entiende de una frase es solo un borrador. Nada se guarda hasta que una persona lo revisa y lo confirma.",
      },
      business: {
        title: "Cada dato es de un solo negocio",
        description:
          "Ventas, cuentas y reportes quedan en el negocio donde se registraron, con su fecha, la cuenta de caja o banco y quién lo registró.",
      },
    },
    scope: {
      title: "Lo que Pisto no hace",
      description:
        "No emite factura electrónica (DTE), no calcula planillas ni se conecta con su banco. La contabilidad sigue a cargo de su contador.",
    },
  },
  cta: {
    title: "Anote su primera venta.",
  },
  footer: {
    rights: "© {{year}} Pisto",
    links: "Acceso a Pisto",
    product: "Producto",
    account: "Cuenta",
  },
} as const;
