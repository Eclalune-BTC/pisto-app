import { appearance } from "./es-SV/appearance";
import { auth } from "./es-SV/auth";
import { billing } from "./es-SV/billing";
import { business } from "./es-SV/business";
import { cash } from "./es-SV/cash";
import { catalog } from "./es-SV/catalog";
import { common } from "./es-SV/common";
import { customers } from "./es-SV/customers";
import { dataTable } from "./es-SV/data-table";
import { expenses } from "./es-SV/expenses";
import { filters } from "./es-SV/filters";
import { inventory } from "./es-SV/inventory";
import { notFound } from "./es-SV/not-found";
import { operate } from "./es-SV/operate";
import { productErrors } from "./es-SV/product-errors";
import { purchases } from "./es-SV/purchases";
import { receivables } from "./es-SV/receivables";
import { relationships } from "./es-SV/relationships";
import { remote } from "./es-SV/remote";
import { reports } from "./es-SV/reports";
import { routeState } from "./es-SV/route-state";
import { sales } from "./es-SV/sales";
import { session } from "./es-SV/session";
import { settings } from "./es-SV/settings";
import { shell } from "./es-SV/shell";
import { startup } from "./es-SV/startup";
import { welcome } from "./es-SV/welcome";

export const esSV = {
  dataTable,
  filters,
  common,
  welcome,
  startup,
  appearance,
  auth,
  session,
  shell,
  remote,
  routeState,
  business,
  operate,
  sales,
  settings,
  billing,
  cash,
  expenses,
  catalog,
  inventory,
  relationships,
  customers,
  receivables,
  purchases,
  reports,
  notFound,
  productErrors,
} as const;
