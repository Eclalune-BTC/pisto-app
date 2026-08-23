import { useLocalSearchParams } from "expo-router";

import { ProductFormRoute } from "@/features/catalog/product-form-route";

export default function EditProductRoute() {
  const params = useLocalSearchParams<{ productId?: string | string[] }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  return <ProductFormRoute mode="edit" productId={productId} />;
}
