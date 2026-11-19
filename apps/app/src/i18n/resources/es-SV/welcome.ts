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
    said: "Le vendí a doña Rosa tres libras de café, me dio cinco dólares y el resto me lo quedó debiendo.",
    fragments: {
      kind: "vendí",
      customer: "doña Rosa",
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
    filmTitle: "Una venta de café.",
    filmDescription:
      "Tres libras de café, cinco dólares en efectivo y una parte al fiado. Vea cómo queda registrada la venta en Pisto.",
    play: "Reproducir la venta de café",
    playShort: "Ver el vídeo",
    filmLabel: "Vídeo de ejemplo de una venta de café en Pisto",
    filmError: "El vídeo no se pudo cargar. Puede seguir los pasos que aparecen a continuación.",
    filmCaptions: "Español",
    cocoDemo: "Ver a Coco cotizar una venta",
    duration: "0:18",
    chapters: {
      product: "Elegir el producto",
      payment: "Revisar el pago",
      receipt: "Guardar la venta",
    },
    detail: {
      product: "Seleccione tres libras de café molido a $3.25 por libra.",
      payment: "De los $9.75, Rosa paga $5.00 en efectivo. Quedan $4.75 al fiado.",
      receipt: "Confirme la venta y consulte el total en su comprobante.",
    },
  },
  modules: {
    title: "Las cuentas de cada día.",
    previous: "Módulo anterior",
    day: "Día de los movimientos de ejemplo",
    today: "Hoy",
    yesterday: "Ayer",
    next: "Módulo siguiente",
    position: "{{current}} / {{total}}",
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
    title: "Un equipo, distintos permisos.",
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
