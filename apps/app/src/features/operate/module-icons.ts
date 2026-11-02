import {
  ArrowLeftRight,
  ChartColumn,
  HandCoins,
  Landmark,
  type LucideIcon,
  Package,
  ReceiptText,
  ShoppingBag,
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
  catalog: Package,
  inventory: Warehouse,
  customers: UsersRound,
  reports: ChartColumn,
};
