import { uuidSchema } from "@pisto/contracts";
import { useLocalSearchParams } from "expo-router";
import { RouteState } from "@/components/route-state";
import NewSaleScreen from "@/features/sales/sale-create-screen";

export default function NewSaleRoute() {
  const { productId } = useLocalSearchParams<{ productId?: string | string[] }>();
  const selected = uuidSchema.optional().safeParse(productId);
  if (!selected.success) return <RouteState kind="notFound" width="form" />;
  return <NewSaleScreen initialProductId={selected.data} />;
}
