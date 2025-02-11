"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const cardBaseClass = "rounded-lg border bg-card text-card-foreground shadow-sm";
const cardBodyBaseClass = "p-6";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardBaseClass, className)}
    {...props}
  />
));
Card.displayName = "Card";

const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(cardBodyBaseClass, className)}
    {...props}
  />
));
CardBody.displayName = "CardBody";

export { Card, CardBody };