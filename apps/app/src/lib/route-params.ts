/** A route parameter as Expo Router delivers it: absent, single or repeated. */
export type RouteParam = string | string[] | undefined;

export function firstParam(value: RouteParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
