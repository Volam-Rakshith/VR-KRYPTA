// Renders one option control from an operation's OptionField schema.
import type { OptionField as OptionFieldDef } from '../operations/core/types';
import { Select } from './select';

export function OptionField({ def, value, onChange }: {
  def: OptionFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (def.type === 'toggle') {
    return (
      <label className="opt opt--toggle">
        <span className="opt__label">
          <span className="toggle">
            <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
            <span className="toggle__track" />
          </span>
          {def.label}
        </span>
        {def.help && <span className="opt__help">{def.help}</span>}
      </label>
    );
  }
  if (def.type === 'number') {
    return (
      <label className="opt">
        <span className="opt__label">{def.label}</span>
        <input
          className="input"
          type="number"
          value={Number(value ?? def.default)}
          min={def.min} max={def.max} step={def.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {def.help && <span className="opt__help">{def.help}</span>}
      </label>
    );
  }
  if (def.type === 'select') {
    return (
      <label className="opt">
        <span className="opt__label">{def.label}</span>
        <Select
          value={String(value ?? def.default)}
          onChange={onChange}
          ariaLabel={def.label}
          options={def.options.map((o) => ({ value: o.value, label: o.label }))}
        />
        {def.help && <span className="opt__help">{def.help}</span>}
      </label>
    );
  }
  return (
    <label className="opt">
      <span className="opt__label">{def.label}</span>
      <input
        className="input input--mono"
        type="text"
        value={String(value ?? def.default ?? '')}
        placeholder={def.placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
      />
      {def.help && <span className="opt__help">{def.help}</span>}
    </label>
  );
}
