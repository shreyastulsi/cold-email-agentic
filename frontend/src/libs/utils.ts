import { CalendarDate } from "@internationalized/date";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function filterDataByDateRange(data: any[], startDate: CalendarDate, endDate: CalendarDate) {
  return data.filter(item => {
    const itemDate = new Date(item.date);
    const start = new Date(startDate.toString());
    const end = new Date(endDate.toString());
    return itemDate >= start && itemDate <= end;
  });
}
