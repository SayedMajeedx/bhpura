import * as React from "react";

import { cn } from "@/lib/utils";

function isNumericLike(props: React.ComponentProps<"input">) {
  if (props["data-no-auto-zero" as keyof typeof props] !== undefined) return false;
  const t = (props.type || "").toLowerCase();
  if (t === "number") return true;
  const im = (props.inputMode || "").toLowerCase();
  return im === "numeric" || im === "decimal";
}

function isZeroLike(v: unknown): boolean {
  if (v === 0) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s === "") return false;
  return /^-?0+(?:[.,]0*)?$/.test(s);
}

function zeroForShape(v: unknown): string | number {
  if (typeof v === "number") return 0;
  if (typeof v === "string") {
    const m = v.match(/^-?0+(?:[.,](0*))?$/);
    const decimals = m?.[1]?.length ?? 0;
    return decimals > 0 ? (0).toFixed(decimals) : "0";
  }
  return "";
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const numeric = isNumericLike({ type, ...props });
    const isControlled = props.value !== undefined;
    const [cleared, setCleared] = React.useState(false);

    // If parent value changes to non-zero, drop the "cleared" overlay.
    React.useEffect(() => {
      if (cleared && !isZeroLike(props.value)) setCleared(false);
    }, [props.value, cleared]);

    const overrides: React.ComponentProps<"input"> = {};

    if (numeric) {
      const originalFocus = props.onFocus;
      const originalBlur = props.onBlur;
      const originalChange = props.onChange;

      overrides.onFocus = (e) => {
        if (isZeroLike(e.currentTarget.value) || isZeroLike(props.value)) {
          setCleared(true);
          if (!isControlled) e.currentTarget.value = "";
        }
        originalFocus?.(e);
      };

      overrides.onChange = (e) => {
        // As soon as the user types anything, drop the overlay so their input shows.
        if (cleared) setCleared(false);
        originalChange?.(e);
      };

      overrides.onBlur = (e) => {
        setCleared(false);
        if (e.currentTarget.value.trim() === "") {
          const zero = zeroForShape(props.value);
          if (isControlled && originalChange) {
            // Synthesize a change event so parent state resets to 0.
            const target = e.currentTarget;
            const proto = Object.getPrototypeOf(target);
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            setter?.call(target, String(zero));
            const evt = new Event("input", { bubbles: true });
            target.dispatchEvent(evt);
          } else if (!isControlled) {
            e.currentTarget.value = String(zero);
          }
        }
        originalBlur?.(e);
      };

      if (isControlled && cleared) {
        overrides.value = "";
      }
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        {...overrides}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
