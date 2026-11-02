import {
  ArrowLeftRight,
  CalendarClock,
  ChartColumn,
  HandCoins,
  Landmark,
  type LucideIcon,
  Package,
  ReceiptText,
  ShoppingBag,
  Store,
  UsersRound,
  Warehouse,
} from "lucide-react-native";
import type { OperateModuleId } from "./navigation";

export const operateModuleIcons: Record<OperateModuleId, LucideIcon> = {
  movements: ArrowLeftRight,
  sales: ShoppingBag,
  expenses: ReceiptText,
  cash: Landmark,
  receivables: HandCoins,
  payables: CalendarClock,
  catalog: Package,
  inventory: Warehouse,
  customers: UsersRound,
  suppliers: Store,
  reports: ChartColumn,
};
