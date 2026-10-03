import type { ReactNode } from "react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="min-w-0 gap-4 py-6 shadow-none">
      <CardHeader className="items-start gap-2 px-4">
        <CardTitle className="text-lg leading-6">{title}</CardTitle>
        <CardDescription className="max-w-[560px] leading-6">{description}</CardDescription>
      </CardHeader>
      {action ? <CardFooter className="flex-wrap gap-3 px-4">{action}</CardFooter> : null}
    </Card>
  );
}
