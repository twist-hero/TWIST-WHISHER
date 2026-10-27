/**
 * Boot wordmark shown while the local backend starts.
 *
 * One motion idea — a meter that keeps time — instead of a generic spinner.
 * The bars are decorative; the product name carries the meaning, and the gate's
 * status text below stays the thing screen readers announce.
 */
const BARS = [0, 1, 2, 3, 4, 5, 6];

export function BootWordmark({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex h-10 items-end gap-[4px]" aria-hidden="true">
        {BARS.map((bar) => (
          <span key={bar} className="vs-boot-bar" style={{ animationDelay: `${bar * 80}ms` }} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        {/* Set tight and slightly large: a wordmark reads as a product, not a
            heading, when the letterfit is deliberate rather than default. */}
        <span className="vs-boot-in text-[1.75rem] leading-none font-medium tracking-[-0.035em]">
          {label}
        </span>
        <span className="h-px w-14 bg-border" aria-hidden="true" />
      </div>
    </div>
  );
}
