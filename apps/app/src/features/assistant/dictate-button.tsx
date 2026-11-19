import { Mic } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { NewEntryDialog } from "./new-entry-dialog";
import { useAssistantAvailability } from "./queries";

/** The top-bar entry point to "Nuevo registro"; absent when the role cannot use the assistant. */
export function DictateButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const availability = useAssistantAvailability();
  const [open, setOpen] = useState(false);
  if (availability.kind === "hidden") return null;
  return (
    <>
      <Button
        accessibilityLabel={t("assistant.dictateLabel")}
        onPress={() => setOpen(true)}
        size={compact ? "icon-sm" : "sm"}
      >
        <Icon as={Mic} className="text-primary-foreground" size={15} />
        {!compact ? <Text>{t("assistant.dictate")}</Text> : null}
      </Button>
      <NewEntryDialog
        availability={availability}
        initialMode="voice"
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}
