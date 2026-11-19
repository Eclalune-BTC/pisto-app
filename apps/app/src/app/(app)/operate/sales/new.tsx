import { catalogQuantitySchema, uuidSchema } from "@pisto/contracts";
import { useLocalSearchParams } from "expo-router";
import { RouteState } from "@/components/route-state";
import NewSaleScreen from "@/features/sales/sale-create-screen";

export default function NewSaleRoute() {
  const { productId, quantity } = useLocalSearchParams<{
    productId?: string | string[];
    quantity?: string | string[];
  }>();
  const selected = uuidSchema.optional().safeParse(productId);
  const amount = catalogQuantitySchema.optional().safeParse(quantity);
  if (!selected.success || !amount.success || (amount.data && !selected.data))
    return <RouteState kind="notFound" width="form" />;
  return <NewSaleScreen initialProductId={selected.data} initialQuantity={amount.data} />;
}
