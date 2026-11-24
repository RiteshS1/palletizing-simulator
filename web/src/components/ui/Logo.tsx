// The PalletLab mark: three cartons stacked on a pallet line, the top one offset like a
// box mid-placement. Drawn in currentColor with the signal colour on the active box.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
        <rect x="3" y="15" width="10" height="7" fill="currentColor" />
        <rect x="14" y="15" width="11" height="7" fill="currentColor" opacity="0.55" />
        <rect x="7" y="5" width="11" height="8" fill="#ff5a1f" />
        <rect x="2" y="23.5" width="24" height="2" fill="currentColor" />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-tight [font-stretch:115%]">PalletLab</span>
    </span>
  );
}
