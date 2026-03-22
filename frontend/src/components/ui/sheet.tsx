"use client";

import * as React from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// vaul Drawer wired as a right-side sheet.
// direction="right" gives slide-in-from-right with vaul's built-in
// spring physics, velocity-based dismiss, and overlay fade.

function Sheet({
  direction = "right",
  ...props
}: React.ComponentProps<typeof Drawer.Root>) {
  return <Drawer.Root direction={direction} {...props} />;
}
Sheet.displayName = "Sheet";

const SheetTrigger = Drawer.Trigger;
const SheetClose = Drawer.Close;
const SheetPortal = Drawer.Portal;

// ── Overlay ───────────────────────────────────────────────────────────────────

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof Drawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof Drawer.Overlay>
>(({ className, ...props }, ref) => (
  <Drawer.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]", className)}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

// ── Content ───────────────────────────────────────────────────────────────────

const SheetContent = React.forwardRef<
  React.ElementRef<typeof Drawer.Content>,
  React.ComponentPropsWithoutRef<typeof Drawer.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <Drawer.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 flex h-full w-full max-w-[500px] flex-col",
        "bg-card border-l border-border shadow-2xl outline-none",
        className,
      )}
      {...props}
    >
      {children}

      {/* Close button */}
      <Drawer.Close className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground transition-all hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Drawer.Close>
    </Drawer.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

// ── Header ────────────────────────────────────────────────────────────────────

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1 border-b border-border px-6 pb-4 pt-6 pr-14 shrink-0",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

// ── Body ──────────────────────────────────────────────────────────────────────

const SheetBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-6 py-5", className)}
    {...props}
  />
);
SheetBody.displayName = "SheetBody";

// ── Footer ────────────────────────────────────────────────────────────────────

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-3 border-t border-border bg-card px-6 py-4 shrink-0",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

// ── Title ─────────────────────────────────────────────────────────────────────

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof Drawer.Title>,
  React.ComponentPropsWithoutRef<typeof Drawer.Title>
>(({ className, ...props }, ref) => (
  <Drawer.Title
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

// ── Description ───────────────────────────────────────────────────────────────

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof Drawer.Description>,
  React.ComponentPropsWithoutRef<typeof Drawer.Description>
>(({ className, ...props }, ref) => (
  <Drawer.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
