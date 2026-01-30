import { useMemo, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Category = {
  id: string;
  name: string;
  name_hindi: string | null;
};

type SKU = {
  id: string;
  category_id: string | null;
  price_type: "per_metre" | "fixed";
  rate: number | null;
  fixed_price: number | null;
  length_metres: number;
  quantity: number;
};

type SortMode = "value" | "count";

function skuValue(s: SKU) {
  return s.price_type === "per_metre" ? (s.rate || 0) * s.length_metres : (s.fixed_price || 0) * s.quantity;
}

export function ReportsCategories(props: { categories: Category[]; skus: SKU[] }) {
  const { categories, skus } = props;
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("value");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const computed = categories
      .map((c) => {
        const inCat = skus.filter((s) => s.category_id === c.id);
        const count = inCat.length;
        const value = inCat.reduce((sum, s) => sum + skuValue(s), 0);
        return { ...c, count, value };
      })
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.name_hindi ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortMode === "count") return b.count - a.count;
        return b.value - a.value;
      });

    return computed;
  }, [categories, skus, query, sortMode]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Category Breakdown</h2>
          <p className="text-sm text-muted-foreground">Search and expand categories to scan faster.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search category"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant={sortMode === "value" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortMode("value")}
          >
            Sort: Value
          </Button>
          <Button
            variant={sortMode === "count" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortMode("count")}
          >
            Sort: Count
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">No categories match your search.</Card>
      ) : (
        <Accordion type="multiple" className="rounded-lg border bg-card">
          {rows.map((c) => (
            <AccordionItem key={c.id} value={c.id} className="px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-start justify-between gap-4 pr-2">
                  <div className="text-left">
                    <div className="font-medium">{c.name}</div>
                    {c.name_hindi ? (
                      <div className="text-xs text-muted-foreground hindi">{c.name_hindi}</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{c.count} items</div>
                    <div className="text-xs text-muted-foreground">₹{c.value.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-4 text-sm text-muted-foreground">
                  Items: <span className="font-medium text-foreground">{c.count.toLocaleString("en-IN")}</span> • Value:{" "}
                  <span className="font-medium text-foreground">₹{c.value.toLocaleString("en-IN")}</span>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  );
}
