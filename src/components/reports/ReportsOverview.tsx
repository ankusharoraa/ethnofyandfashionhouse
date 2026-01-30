import { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Stats = {
  lowStock: number;
  totalValue: number;
  totalMetres: number;
  totalItems: number;
};

export function ReportsOverview(props: {
  isOwner: boolean;
  stats: Stats;
  cards: ReactNode;
  onOpenGraphs: () => void;
  onOpenCategories: () => void;
  onOpenDeadStock: () => void;
}) {
  const { isOwner, stats, cards, onOpenGraphs, onOpenCategories, onOpenDeadStock } = props;

  return (
    <section className="space-y-4">
      {cards}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm font-medium">Quick actions</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onOpenGraphs}>
              Open Graphs
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenCategories}>
              Open Categories
            </Button>
            {isOwner && (
              <Button variant="secondary" size="sm" onClick={onOpenDeadStock}>
                Open Dead Stock
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Inventory snapshot</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {stats.totalItems.toLocaleString("en-IN")} SKUs • {stats.lowStock.toLocaleString("en-IN")} low stock
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            This page is split into tabs to keep reports focused.
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">Owner note</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Dead Stock loads only when you open the Dead Stock tab (faster initial load).
          </div>
          {!isOwner && (
            <div className="mt-3 text-sm text-muted-foreground">Ask the owner for access to Dead Stock actions.</div>
          )}
        </Card>
      </div>
    </section>
  );
}
