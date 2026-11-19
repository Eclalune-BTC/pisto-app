import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Coco } from "./coco";
import { NewEntryDialog } from "./new-entry-dialog";
import { useAssistantAvailability } from "./queries";

export function AssistantButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const availability = useAssistantAvailability();
  const [open, setOpen] = useState(false);
  if (availability.kind === "hidden") return null;
  return (
    <>
      <Button
        accessibilityLabel={t("assistant.companion.open")}
        variant="outline"
        onPress={() => setOpen(true)}
        size={compact ? "icon-sm" : "sm"}
      >
        <Coco size={24} />
        {!compact ? <Text>{t("assistant.companion.name")}</Text> : null}
      </Button>
      <NewEntryDialog
        availability={availability}
        initialMode="tools"
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}
