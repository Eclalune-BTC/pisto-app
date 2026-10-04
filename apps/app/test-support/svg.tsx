import { createElement, type PropsWithChildren } from "react";

// Node tests render icons and the brand mark as inert SVG markup; native drawing is not under test.
function element(tag: string) {
  return function SvgElement({ children }: PropsWithChildren) {
    return createElement(tag, {}, children);
  };
}

export const Svg = element("svg");
export const G = element("g");
export const Path = element("path");
export const Rect = element("rect");
export const Circle = element("circle");
export const Ellipse = element("ellipse");
export const Line = element("line");
export const Polygon = element("polygon");
export const Polyline = element("polyline");
export default Svg;
