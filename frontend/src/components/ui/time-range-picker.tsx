// time-range-picker.tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimeRangePickerProps {
  startDate?: Date
  endDate?: Date
  onRangeChange?: (start: Date | undefined, end: Date | undefined) => void
  placeholder?: string
  className?: string
}

export function TimeRangePicker({
  startDate,
  endDate,
  onRangeChange,
  placeholder = "Pick a time range",
  className,
}: TimeRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempStart, setTempStart] = React.useState<Date | undefined>(startDate)
  const [selectingEnd, setSelectingEnd] = React.useState(false)

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    if (!tempStart || selectingEnd) {
      if (tempStart && date >= tempStart) {
        onRangeChange?.(tempStart, date)
        close()
      } else if (!tempStart) {
        setTempStart(date)
        setSelectingEnd(true)
      }
    } else {
      if (date >= tempStart) {
        onRangeChange?.(tempStart, date)
        close()
      } else {
        setTempStart(date)
        setSelectingEnd(true)
      }
    }
  }

  const close = () => {
    setIsOpen(false)
    setSelectingEnd(false)
    setTempStart(undefined)
  }

  const formatRange = () =>
    startDate && endDate
      ? `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`
      : placeholder

  return (
    <Popover open={isOpen} onOpenChange={(o) => (o ? setIsOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !startDate && !endDate && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="p-3">
          {selectingEnd && tempStart && (
            <div className="mb-3 text-sm text-muted-foreground">
              Start: {format(tempStart, "MMM dd, yyyy")} — select end date
            </div>
          )}
          <Calendar
            mode="single"
            selected={tempStart || startDate}
            onSelect={handleDateSelect}
            initialFocus
            className="pointer-events-auto"
            disabled={(date) =>
              tempStart && selectingEnd ? date < tempStart : false
            }
          />
        </div>
      </PopoverContent>
    </Popover>
)
}
