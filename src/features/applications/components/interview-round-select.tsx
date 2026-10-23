import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { laterInterviewRounds } from "@/config/application-status";

export function InterviewRoundSelect({id, value, onChange, disabled, autoSubmit = false}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  autoSubmit?: boolean;
}) {
  return <div className="space-y-2">
    <Label htmlFor={id}>面试轮次</Label>
    <Select id={id} name="interviewRound" value={value ?? ""} disabled={disabled} onChange={event => { onChange(event.target.value ? Number(event.target.value) : null); if (autoSubmit) event.currentTarget.form?.requestSubmit(); }}>
      <option value="">未指定轮次</option>
      {laterInterviewRounds.map(round => <option key={round} value={round}>第 {round} 面</option>)}
    </Select>
  </div>;
}
