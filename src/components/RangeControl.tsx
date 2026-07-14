interface RangeControlProps {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}

export function RangeControl({ label, hint, value, onChange }: RangeControlProps) {
  return (
    <label className="range-control">
      <span className="range-control__copy">
        <span>{label}</span>
        <small>{hint}</small>
      </span>
      <span className="range-control__input">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>{value}</output>
      </span>
    </label>
  );
}
