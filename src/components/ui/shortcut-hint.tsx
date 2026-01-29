import { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ShortcutHint({
  label,
  keys,
  children,
}: {
  label: string;
  keys?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children as any}</TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <div className="space-y-1">
          <div className="text-sm font-medium">{label}</div>
          {keys ? (
            <div className="text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                {keys}
              </kbd>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
