import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDateRange } from "@/lib/date-range-context";
import { CalendarDate } from "@internationalized/date";
import { Activity } from "lucide-react";
import * as React from "react";
import { ReactNode } from "react";
import { DateValue } from "react-aria-components";
import { JollyDateRangePicker } from "./jolly-date-range-picker";


interface ChartComparisonDialogProps {
  title: string;
  children: ReactNode;  // expect exactly two chart nodes
}

export function ChartComparisonDialog({
  title,
  children,
}: ChartComparisonDialogProps) {
    const { dateRange: initialDateRange } = useDateRange();
    const [dateRange1, setDateRange1] = React.useState(initialDateRange);
    const [dateRange2, setDateRange2] = React.useState(initialDateRange);

  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute right-2 top-2">
          <Activity className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-6xl p-0 bg-transparent border-none shadow-none">
        <div className="fixed inset-0 z-40 bg-black/80" />
        <div className="relative z-50 h-full w-full bg-background p-6 rounded-lg border shadow-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* grid → 2 columns; gap between charts */}
          <div className="bg-background p-4 rounded-lg grid grid-cols-2 gap-4">
            {React.Children.toArray(children).map((child, idx) => (
              <div key={idx} className="flex-1 flex flex-col gap-4">
                <JollyDateRangePicker
                  value={idx === 0 ? dateRange1 : dateRange2}
                  onChange={(newRange: { start: DateValue, end: DateValue } | null) => {
                    if (newRange) {
                      const newDateRange = {
                        start: new CalendarDate(newRange.start.year, newRange.start.month, newRange.start.day),
                        end: new CalendarDate(newRange.end.year, newRange.end.month, newRange.end.day),
                      };
                      if (idx === 0) {
                        setDateRange1(newDateRange);
                      } else {
                        setDateRange2(newDateRange);
                      }
                    }
                  }}
                />
                {React.cloneElement(child as React.ReactElement<any>, {
                  dateRange: idx === 0 ? dateRange1 : dateRange2,
                })}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}