"use client"

import { cn } from "@/lib/utils"
import { getLocalTimeZone, today } from "@internationalized/date"
import { cva, type VariantProps } from "class-variance-authority"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import {
  Button as AriaButton,
  CalendarCell as AriaCalendarCell,
  CalendarCellProps as AriaCalendarCellProps,
  CalendarGrid as AriaCalendarGrid,
  CalendarGridBody as AriaCalendarGridBody,
  CalendarGridBodyProps as AriaCalendarGridBodyProps,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarGridHeaderProps as AriaCalendarGridHeaderProps,
  CalendarGridProps as AriaCalendarGridProps,
  CalendarHeaderCell as AriaCalendarHeaderCell,
  CalendarHeaderCellProps as AriaCalendarHeaderCellProps,
  DateInput as AriaDateInput,
  DateInputProps as AriaDateInputProps,
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerProps as AriaDateRangePickerProps,
  DateSegment as AriaDateSegment,
  DateSegmentProps as AriaDateSegmentProps,
  DateValue as AriaDateValue,
  Dialog as AriaDialog,
  DialogProps as AriaDialogProps,
  FieldError as AriaFieldError,
  FieldErrorProps as AriaFieldErrorProps,
  Group as AriaGroup,
  GroupProps as AriaGroupProps,
  Heading as AriaHeading,
  Label as AriaLabel,
  LabelProps as AriaLabelProps,
  Popover as AriaPopover,
  PopoverProps as AriaPopoverProps,
  RangeCalendar as AriaRangeCalendar,
  RangeCalendarStateContext as AriaRangeCalendarStateContext,
  ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
  useLocale,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components"

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "focus-visible:outline-none focus-visible:ring-0 focus:outline-none",
  ],
  {
    variants: {
      variant: {
        default: "bg-blue-500 text-white hover:bg-blue-600",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-gray-300 bg-white hover:bg-gray-100 hover:text-gray-900",
        secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
        ghost: "bg-transparent hover:bg-gray-200 hover:text-gray-900",
        manual: "bg-transparent hover:bg-transparent",
        link: "text-blue-500 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "w-10 h-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends AriaButtonProps, VariantProps<typeof buttonVariants> {}

const Button = ({ className, variant, size, ...props }: ButtonProps) => (
  <AriaButton
    type="button"
    className={composeRenderProps(className, (className) =>
      cn(buttonVariants({ variant, size }), className)
    )}
    {...props}
  />
)

const labelVariants = cva([
  "text-sm font-medium leading-none",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-70",
  "group-data-[invalid]:text-destructive",
])

const Label = ({ className, ...props }: AriaLabelProps) => (
  <AriaLabel className={cn(labelVariants(), className)} {...props} />
)

function FieldError({ className, ...props }: AriaFieldErrorProps) {
  return <AriaFieldError className={cn("text-sm font-medium text-destructive", className)} {...props} />
}

const fieldGroupVariants = cva("", {
  variants: {
    variant: {
      default: [
        "relative flex h-10 w-full items-center overflow-hidden rounded-md bg-background px-3 text-sm",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        "disabled:opacity-50",
      ],
      ghost: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface GroupProps extends AriaGroupProps, VariantProps<typeof fieldGroupVariants> {}

function FieldGroup({ className, variant, ...props }: GroupProps) {
  return (
    <AriaGroup className={composeRenderProps(className, (cls) => cn(fieldGroupVariants({ variant }), cls))} {...props} />
  )
}

function DateSegment({ className, ...props }: AriaDateSegmentProps) {
  return (
    <AriaDateSegment
      className={composeRenderProps(className, (cls) =>
        cn(
          "inline rounded p-0.5 outline-0",
          "caret-white", // 👈 ADD THIS HERE
          "caret-white focus-visible:ring-1 focus-visible:ring-white",
          "data-[placeholder]:text-muted-foreground",
          "data-[disabled]:opacity-50",
          "data-[focused]:bg-accent data-[focused]:text-accent-foreground",
          cls
        )
      )}
      {...props}
    />
  )
}


interface DateInputProps extends AriaDateInputProps, VariantProps<typeof fieldGroupVariants> {}

function DateInput({ className, variant, ...props }: Omit<DateInputProps, "children">) {
  return (
    <AriaDateInput
      className={composeRenderProps(className, (cls) => cn(fieldGroupVariants({ variant }), "text-sm", cls))}
      {...props}
    >
      {(segment) => <DateSegment segment={segment} />}
    </AriaDateInput>
  )
}

const Popover = ({ className, offset = 4, ...props }: AriaPopoverProps) => (
  <AriaPopover
    offset={offset}
    data-is-react-aria-popover
    className={composeRenderProps(className, (cls) =>
      cn(
        "z-50 rounded-md bg-gray-800 text-popover-foreground shadow-lg ring-1 ring-gray-700",
        "data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95",
        "data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95",
        cls
      )
    )}
    {...props}
  />
)

const CalendarHeading = (props: React.HTMLAttributes<HTMLElement>) => {
  let { direction } = useLocale()

  return (
    <header className="flex w-full items-center justify-between px-2 pb-4" {...props}>
      <AriaButton slot="previous">
        {direction === "rtl" ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5 text-white" />}
      </AriaButton>
      <AriaHeading className="text-center text-sm font-medium" />
      <AriaButton slot="next">
        {direction === "rtl" ? <ChevronLeft className="size-5 text-white" /> : <ChevronRight className="size-5 text-white" />}
      </AriaButton>
    </header>
  )
}

const CalendarGrid = ({ className, ...props }: AriaCalendarGridProps) => (
  <AriaCalendarGrid className={cn("border-separate border-spacing-y-1", className)} {...props} />
)
const CalendarGridHeader = (props: AriaCalendarGridHeaderProps) => <AriaCalendarGridHeader {...props} />
const CalendarHeaderCell = ({ className, ...props }: AriaCalendarHeaderCellProps) => (
  <AriaCalendarHeaderCell className={cn("w-9 text-[0.8rem] text-muted-foreground", className)} {...props} />
)
const CalendarGridBody = ({ className, ...props }: AriaCalendarGridBodyProps) => (
  <AriaCalendarGridBody className={cn("[&>tr>td]:p-0", className)} {...props} />
)
const CalendarCell = ({ className, ...props }: AriaCalendarCellProps) => {
  const isRange = Boolean(React.useContext(AriaRangeCalendarStateContext))
  return (
    <AriaCalendarCell
      className={composeRenderProps(className, (cls, renderProps) =>
        cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative flex items-center justify-center p-0 text-sm cursor-text", // Added cursor-text
          renderProps.isDisabled && "opacity-50",
          renderProps.isSelected && "bg-gray-600 text-white",
          renderProps.isOutsideMonth && "opacity-50",
          renderProps.date.compare(today(getLocalTimeZone())) === 0 && !renderProps.isSelected && "bg-accent text-accent-foreground",
          cls
        )
      )}
      {...props}
    />
  )
}

const RangeCalendar = AriaRangeCalendar
const DateRangePicker = AriaDateRangePicker

const DatePickerContent = ({ className, popoverClassName, ...props }: AriaDialogProps & { popoverClassName?: AriaPopoverProps['className'] }) => (
  <Popover className={composeRenderProps(popoverClassName, (cls) => cn("w-auto p-3", cls))}>
    <AriaDialog className={cn("flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0", className)} {...props} />
  </Popover>
)

interface JollyDateRangePickerProps<T extends AriaDateValue> extends AriaDateRangePickerProps<T> {
  label?: string
  description?: string
  errorMessage?: string | ((validation: AriaValidationResult) => string)
}

function JollyDateRangePicker<T extends AriaDateValue>({
  label = "Date range",
  description,
  errorMessage,
  className,
  onOpenChange,
  ...props
}: JollyDateRangePickerProps<T>) {
  return (
    <DateRangePicker onOpenChange={onOpenChange} className={composeRenderProps(className, (cls) => cn("flex flex-col gap-2", cls))} {...props}>
      <Label>{label}</Label>
      <FieldGroup
        className={cn(
          "inline-flex items-center justify-between rounded-md bg-transparent px-3 py-2 text-sm",
          "w-full max-w-[280px]",
          className
        )}
        >
        <Button variant="ghost" size="icon" className="w-13 h-10 -ml-3 bg-transparent hover:bg-transparent mr-2" aria-label="Open calendar">
          <CalendarIcon aria-hidden style={{ width: '42px', height: '42px', transform: 'scale(1)' }} />
        </Button>
        <DateInput
          variant="ghost"
          className="flex cursor-text caret-white"
          slot="start"
        />
        <span aria-hidden className="mx-[4px] text-sm text-muted-foreground">to</span>
        <DateInput
          variant="ghost"
          className="flex-1 cursor-text caret-white"
          slot="end"
        />
        </FieldGroup>
      {description && (
        <Text className="text-sm text-muted-foreground" slot="description">
          {description}
        </Text>
      )}
      <FieldError>{errorMessage}</FieldError>
      <DatePickerContent>
        <RangeCalendar>
          <CalendarHeading />
          <CalendarGrid>
            <CalendarGridHeader>{(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody>{(date) => <CalendarCell date={date} />}</CalendarGridBody>
          </CalendarGrid>
        </RangeCalendar>
      </DatePickerContent>
    </DateRangePicker>
  )
}

export { JollyDateRangePicker }
