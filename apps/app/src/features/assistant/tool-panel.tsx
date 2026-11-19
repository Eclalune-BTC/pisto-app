import type { AssistantToolCall, BusinessPermission } from "@pisto/contracts";
import { Link, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  type LucideIcon,
  PackageSearch,
  PencilLine,
  ReceiptText,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";
import { ProductSearch } from "@/features/sales/itemized/product-search";
import { permitsTool, permitsTopic, suggestedQuestions } from "./business-questions";
import { CatalogConversation } from "./catalog-conversation";

function ToolRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <PressableSurface
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      className="min-h-14 flex-row items-center gap-3 border-b border-border py-2.5 web:focus-visible:ring-2 web:focus-visible:ring-ring"
      onPress={onPress}
    >
      <Icon as={icon} className="text-foreground" size={21} />
      <View className="min-w-0 flex-1">
        <Text className="font-heading text-base">{title}</Text>
        <Text className="text-sm text-muted-foreground">{detail}</Text>
      </View>
      <Icon as={ChevronRight} className="text-muted-foreground" size={16} />
    </PressableSurface>
  );
}

export function AssistantTools({
  permissions,
  onTool,
  onWrite,
  canInterpret,
  businessConversation,
}: {
  permissions: readonly BusinessPermission[];
  /** `question` is the sentence shown above the answer of a business question. */
  onTool: (tool: AssistantToolCall, question?: string) => void;
  onWrite: () => void;
  canInterpret: boolean;
  businessConversation: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="pisto-caption-in gap-3">
      <DialogDescription>{t("assistant.tools.menuHint")}</DialogDescription>
      <View className="border-t border-border">
        {permitsTool(permissions, { name: "start_sale" }) && (
          <ToolRow
            icon={ReceiptText}
            title={t("assistant.tools.sale")}
            detail={t("assistant.tools.saleHint")}
            onPress={() => onTool({ name: "start_sale" })}
          />
        )}
        {permitsTool(permissions, { name: "find_product", query: null }) && (
          <ToolRow
            icon={PackageSearch}
            title={t("assistant.tools.catalog")}
            detail={t("assistant.tools.catalogHint")}
            onPress={() => onTool({ name: "find_product", query: null })}
          />
        )}
        {canInterpret && (
          <ToolRow
            icon={PencilLine}
            title={t(businessConversation ? "assistant.tools.askOrWrite" : "assistant.tools.write")}
            detail={t(
              businessConversation ? "assistant.tools.askHint" : "assistant.tools.writeHint",
            )}
            onPress={onWrite}
          />
        )}
      </View>
      <View className="gap-1">
        <Heading size="item" level={2}>
          {t("assistant.tools.questions")}
        </Heading>
        {suggestedQuestions
          .filter(({ tool }) => permitsTopic(permissions, tool.topic))
          .map(({ key, tool }) => (
            <Button
              className="h-auto min-h-10 justify-start px-0"
              key={key}
              onPress={() => onTool(tool, t(`assistant.questions.suggested.${key}`))}
              size="sm"
              variant="ghost"
            >
              <Text className="min-w-0 shrink font-ui text-dense">
                {t(`assistant.questions.suggested.${key}`)}
              </Text>
              <Icon as={ChevronRight} className="text-muted-foreground" size={14} />
            </Button>
          ))}
      </View>
    </View>
  );
}

export function SaleToolPanel({
  catalogConversation,
  question,
  tool,
  businessId,
  permissions,
  canInterpret,
  onWrite,
  onBack,
  onClose,
}: {
  catalogConversation: boolean;
  question?: string;
  tool: AssistantToolCall;
  businessId: string;
  permissions: readonly BusinessPermission[];
  canInterpret: boolean;
  onWrite: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const sale = tool.name === "start_sale";
  const canSell = permissions.includes("sales:create");
  if (tool.name === "find_product" && catalogConversation && permissions.includes("catalog:read")) {
    return (
      <CatalogConversation
        key={JSON.stringify([businessId, tool.query])}
        businessId={businessId}
        initialSearch={tool.query ?? ""}
        question={question}
        canSell={canSell}
        onBack={onBack}
        onClose={onClose}
      />
    );
  }
  return (
    <View className="pisto-caption-in gap-4">
      <View className="gap-1.5">
        <View className="flex-row items-center gap-2">
          <Icon as={sale ? ReceiptText : PackageSearch} size={22} className="text-foreground" />
          <Heading level={2} size="page">
            {t(sale ? "assistant.tools.sale" : "assistant.tools.catalog")}
          </Heading>
        </View>
        <DialogDescription>
          {t(
            sale
              ? "assistant.tools.salePrompt"
              : canSell
                ? "assistant.tools.catalogPrompt"
                : "assistant.tools.catalogReadPrompt",
          )}
        </DialogDescription>
      </View>
      {permissions.includes("catalog:read") && (
        <ProductSearch
          key={JSON.stringify([businessId, tool])}
          businessId={businessId}
          disabled={false}
          initialSearch={tool.name === "find_product" ? (tool.query ?? "") : ""}
          viewOnly={!canSell}
          onAdd={({ product }) => {
            onClose();
            router.push({
              pathname: canSell ? "/operate/sales/new" : "/operate/catalog/[productId]",
              params: { productId: product.id },
            });
          }}
        />
      )}
      {canSell && (
        <View className="gap-1 border-t border-border pt-2">
          {canInterpret && (
            <ToolRow
              icon={PencilLine}
              title={t("assistant.tools.writeSale")}
              detail={t("assistant.tools.writeSaleHint")}
              onPress={onWrite}
            />
          )}
          <Link asChild href="/operate/sales/new">
            <Button
              accessibilityRole="link"
              className="min-h-11 justify-start px-0"
              onPress={onClose}
              variant="ghost"
            >
              <Icon as={ClipboardList} className="text-foreground" size={18} />
              <Text>{t("assistant.tools.openSale")}</Text>
              <Icon as={ArrowUpRight} className="text-muted-foreground" size={14} />
            </Button>
          </Link>
        </View>
      )}
      <Button className="self-start" onPress={onBack} size="sm" variant="outline">
        <Icon as={ArrowLeft} size={14} className="text-foreground" />
        <Text>{t("assistant.tools.menu")}</Text>
      </Button>
    </View>
  );
}
