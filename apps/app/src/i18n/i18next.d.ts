import "i18next";

import type { resources } from "@/i18n/config";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    strictKeyChecks: true;
    resources: (typeof resources)["es-SV"];
  }
}
