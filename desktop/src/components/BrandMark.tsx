import type { SVGProps } from "react";

interface BrandMarkProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

/** Agnovexa 01 Folded A 主品牌标识。 */
export function BrandMark({ title, ...props }: BrandMarkProps) {
  const isLabelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 1000 1000"
      role={isLabelled ? "img" : undefined}
      aria-hidden={isLabelled ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <g fill="currentColor">
        <path d="M185 825 465 165l155 315H505l-40-85-165 430Z" />
        <path d="M415 548h285L574 652Z" />
        <path d="m574 652 126-104 135 277H665Z" />
      </g>
    </svg>
  );
}
