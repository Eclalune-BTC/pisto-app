import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

function nestedNodes(value: unknown): ReactNode[] {
  if (isValidElement(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(nestedNodes);
  return [];
}

/** Finds elements of `type` in a rendered tree, including elements passed through props such as `action`. */
export function elements<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
  const result: ReactElement<P>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) result.push(child as ReactElement<P>);
    const { children, ...props } = child.props;
    result.push(...elements<P>(children as ReactNode, type));
    for (const value of Object.values(props)) result.push(...elements<P>(nestedNodes(value), type));
  });
  return result;
}
