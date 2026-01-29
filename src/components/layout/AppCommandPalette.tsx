import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  const role = target.getAttribute("role");
  return role === "textbox";
}

type PaletteAction = {
  id: "new_sales" | "new_purchase" | "add_item";
  title: string;
  shortcut?: string;
  run: () => void;
};

export function AppCommandPalette() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  }, []);

  const paletteKey = isMac ? "⌘K" : "Ctrl K";

  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [];

    const isPurchases = location.pathname === "/purchases";
    if (isPurchases) {
      list.push({
        id: "add_item",
        title: "Add item (Search SKU)",
        shortcut: "Enter",
        run: () => {
          window.dispatchEvent(new CustomEvent("app:open-sku-search"));
        },
      });
    }

    list.push({
      id: "new_sales",
      title: "New Sales Bill",
      shortcut: "Sales",
      run: () => navigate("/sales"),
    });
    list.push({
      id: "new_purchase",
      title: "New Purchase Bill",
      shortcut: "Purch",
      run: () => navigate("/purchases"),
    });

    return list;
  }, [location.pathname, navigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        if (isTextEditingTarget(e.target)) return;
        e.preventDefault();
        setOpen(true);
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={`Type a command… (${paletteKey})`} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Bills">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={action.title}
              onSelect={() => {
                setOpen(false);
                // Run after closing to avoid focus issues with dialogs
                setTimeout(action.run, 0);
              }}
            >
              <span>{action.title}</span>
              {action.shortcut ? (
                <CommandShortcut>{action.shortcut}</CommandShortcut>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
