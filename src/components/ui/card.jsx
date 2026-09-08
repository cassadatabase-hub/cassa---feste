import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardProps
 */

/** @param {CardProps} props */
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props} />
))
Card.displayName = "Card"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardHeaderProps
 */

/** @param {CardHeaderProps} props */
const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardTitleProps
 */

/** @param {CardTitleProps} props */
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardDescriptionProps
 */

/** @param {CardDescriptionProps} props */
const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardContentProps
 */

/** @param {CardContentProps} props */
const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

/**
 * @typedef {{ className?: string; [key: string]: any; }} CardFooterProps
 */

/** @param {CardFooterProps} props */
const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
