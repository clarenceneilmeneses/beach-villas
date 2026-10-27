import { ChipGroup } from "./chip-group";
import { PERIODS, type Period } from "@/lib/finance";

export function PeriodChips({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return <ChipGroup label="Period" value={value} onChange={onChange} chips={PERIODS} />;
}
