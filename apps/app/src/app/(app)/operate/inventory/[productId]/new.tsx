import { useLocalSearchParams } from "expo-router";

import { MovementFormRoute } from "@/features/inventory/movement-form-route";

export default function NewInventoryMovementRoute() {
  const params = useLocalSearchParams<{ productId?: string | string[] }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  return <MovementFormRoute productId={productId} />;
}
