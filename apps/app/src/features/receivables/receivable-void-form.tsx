import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { VoidReceivableFormCopy } from "./types";

type ReceivableVoidFormProps = {
  canReview: boolean;
  copy: VoidReceivableFormCopy;
  error?: string;
  onCancel: () => void;
  onChangeReason: (reason: string) => void;
  onReview: () => void;
  reason: string;
};

export function ReceivableVoidForm({
  canReview,
  copy,
  error,
  onCancel,
  onChangeReason,
  onReview,
  reason,
}: ReceivableVoidFormProps) {
  return (
    <View className="gap-5">
      <Field
        error={error}
        label={copy.reason}
        multiline
        onChangeText={onChangeReason}
        value={reason}
      />
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button label={copy.cancel} onPress={onCancel} variant="ghost" />
        <Button disabled={!canReview} label={copy.review} onPress={onReview} variant="danger" />
      </View>
    </View>
  );
}
