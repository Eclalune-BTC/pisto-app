import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { accountHref } from "./cash-account-list";
import { cashAccountQueryOptions } from "./queries";

type CashAccountNameProps = {
  accountId: string;
  businessId: string;
  className?: string;
  /** The name from an account list already on screen; it avoids reading the account again. */
  knownName?: string;
  /** Renders the name as a link to the account. */
  linked?: boolean;
};

/** Names the account a record belongs to; record payloads carry only its identifier. */
export function CashAccountName({ knownName, ...props }: CashAccountNameProps) {
  return knownName === undefined ? (
    <FetchedAccountName {...props} />
  ) : (
    <AccountNameText {...props} name={knownName} />
  );
}

function AccountNameText({
  accountId,
  className,
  linked,
  name,
}: Omit<CashAccountNameProps, "businessId" | "knownName"> & { name: string }) {
  const text = (
    <Text
      className={cn(
        "text-[13px]",
        linked && "text-foreground underline underline-offset-4",
        className,
      )}
      // Two lines, not one: a single unbreakable line would widen the tables that list it.
      numberOfLines={2}
    >
      {name}
    </Text>
  );
  return linked ? (
    <Link asChild href={accountHref(accountId)}>
      {text}
    </Link>
  ) : (
    text
  );
}

function FetchedAccountName({ businessId, ...props }: Omit<CashAccountNameProps, "knownName">) {
  const { t } = useTranslation();
  const account = useQuery(cashAccountQueryOptions(businessId, props.accountId));
  if (account.data) return <AccountNameText {...props} name={account.data.account.name} />;
  // Offline with nothing cached would otherwise look like a read that never ends.
  if (account.isError || account.fetchStatus === "paused") {
    return (
      <Text className={cn("text-[13px] text-muted-foreground", props.className)}>
        {t("cash.accountName.unavailable")}
      </Text>
    );
  }
  return <Skeleton accessibilityLabel={t("cash.accountName.loading")} className="h-3 w-24" />;
}
