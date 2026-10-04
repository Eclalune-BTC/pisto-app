import {
  Boxes,
  ChartColumn,
  CircleDollarSign,
  ContactRound,
  HandCoins,
  type LucideIcon,
  PackageSearch,
  ReceiptText,
  WalletCards,
} from "lucide-react-native";
import type { OperateModuleId } from "./navigation";

export const operateModuleIcons: Record<OperateModuleId, LucideIcon> = {
  sales: ReceiptText,
  expenses: CircleDollarSign,
  cash: WalletCards,
  catalog: PackageSearch,
  inventory: Boxes,
  customers: ContactRound,
  receivables: HandCoins,
  reports: ChartColumn,
};
