"use client";

import { useMemo } from "react";
import Image from "next/image";
import { toQR } from "toqr";

const QUIET_ZONE = 4;
const MODULE_COLOR = "#c2410c";

export function FriendLinkQr({ value }: { value: string }) {
  const { path, size, viewBoxSize } = useMemo(() => {
    const modules = toQR(value, 2);
    const size = Math.sqrt(modules.length);
    let nextPath = "";

    for (let index = 0; index < modules.length; index += 1) {
      if (!modules[index]) continue;
      const moduleX = index % size;
      const moduleY = Math.floor(index / size);
      const isFinderModule =
        (moduleX < 7 && moduleY < 7) ||
        (moduleX >= size - 7 && moduleY < 7) ||
        (moduleX < 7 && moduleY >= size - 7);
      if (isFinderModule) continue;

      const x = moduleX + QUIET_ZONE;
      const y = moduleY + QUIET_ZONE;
      nextPath += `M${x} ${y}h1v1h-1z`;
    }

    return {
      path: nextPath,
      size,
      viewBoxSize: size + QUIET_ZONE * 2,
    };
  }, [value]);

  const finderOrigins = [
    [QUIET_ZONE, QUIET_ZONE],
    [QUIET_ZONE + size - 7, QUIET_ZONE],
    [QUIET_ZONE, QUIET_ZONE + size - 7],
  ] as const;

  return (
    <div className="relative mx-auto size-44 overflow-hidden rounded-lg bg-white ring-1 ring-orange-500/20">
      <svg
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="size-full"
        role="img"
        aria-label="Friend link QR code"
        shapeRendering="crispEdges"
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="white" />
        <path d={path} fill={MODULE_COLOR} />
        {finderOrigins.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect
              x={x}
              y={y}
              width="7"
              height="7"
              rx="0.8"
              fill={MODULE_COLOR}
            />
            <rect
              x={x + 1}
              y={y + 1}
              width="5"
              height="5"
              rx="0.5"
              fill="white"
            />
            <rect
              x={x + 2}
              y={y + 2}
              width="3"
              height="3"
              rx="0.45"
              fill={MODULE_COLOR}
            />
          </g>
        ))}
      </svg>
      <span className="absolute left-1/2 top-1/2 flex size-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[24%] bg-white p-1">
        <Image
          src="/icons/logo.png"
          alt=""
          width={48}
          height={48}
          className="size-full rounded-[20%]"
        />
      </span>
    </div>
  );
}
