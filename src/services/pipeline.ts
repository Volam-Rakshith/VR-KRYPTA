// Pipeline engine: runs an ordered chain of operation steps with strict
// type-compatibility checks, per-step results, and safe JSON import/export
// (data only — imported files can never execute code).
import { getOp } from '../operations/core/registry';
import { isCompatible } from '../operations/core/types';
import type { IOValue, OperationDefinition, OpContext } from '../operations/core/types';
import type { PipelineStep, SavedPipeline } from './store';

export interface StepResult {
  step: PipelineStep;
  op?: OperationDefinition;
  value?: IOValue;
  error?: string;
  skipped?: boolean;
}

export interface PipelineResult {
  ok: boolean;
  results: StepResult[];
  final?: IOValue;
}

function missingOpResult(step: PipelineStep): StepResult {
  return { step, error: `Unknown operation "${step.opId}" — it may have been removed from the library.` };
}

export async function runPipeline(
  steps: PipelineStep[],
  input: IOValue,
  ctx: OpContext,
  onStep?: (r: StepResult, index: number) => void
): Promise<PipelineResult> {
  const results: StepResult[] = [];
  let current: IOValue = input;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const op = getOp(step.opId);
    if (!op) {
      const r = missingOpResult(step);
      results.push(r);
      return { ok: false, results };
    }
    if (!step.enabled) {
      const r: StepResult = { step, op, value: current, skipped: true };
      results.push(r);
      onStep?.(r, i);
      continue;
    }
    if (!isCompatible(current.kind, op.input)) {
      const r: StepResult = {
        step, op,
        error: `Type mismatch: step ${i + 1} “${op.name}” expects ${op.input.toUpperCase()} input, but the previous step produced ${current.kind.toUpperCase()}. Insert an explicit conversion (e.g. “Text → Bytes”) between them.`
      };
      results.push(r);
      return { ok: false, results };
    }
    const action = op.actions.find((a) => a.id === step.actionId) ?? op.actions[0];
    try {
      const out = await action.run(current, step.options, ctx);
      current = out;
      const r: StepResult = { step, op, value: out };
      results.push(r);
      onStep?.(r, i);
    } catch (e) {
      const r: StepResult = { step, op, error: e instanceof Error ? e.message : String(e) };
      results.push(r);
      return { ok: false, results };
    }
  }
  return { ok: true, results, final: current };
}

/* --------------------------- import / export ------------------------------ */

export const PIPELINE_FORMAT = 'vr-krypta/pipeline';

export function exportPipeline(p: SavedPipeline): string {
  return JSON.stringify(
    {
      format: PIPELINE_FORMAT,
      version: 1,
      name: p.name,
      steps: p.steps
    },
    null,
    2
  );
}

export function importPipeline(json: string): { name: string; steps: PipelineStep[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not valid JSON — check that the file or text is a VR KRYPTA pipeline export.');
  }
  const obj = parsed as { format?: unknown; version?: unknown; name?: unknown; steps?: unknown };
  if (obj.format !== PIPELINE_FORMAT) throw new Error('This JSON is not a VR KRYPTA pipeline (missing format tag).');
  if (obj.version !== 1) throw new Error(`Unsupported pipeline version ${String(obj.version)} — this app understands version 1.`);
  if (!Array.isArray(obj.steps)) throw new Error('Pipeline has no steps array.');
  if (obj.steps.length === 0) throw new Error('Pipeline is empty.');
  if (obj.steps.length > 50) throw new Error('Pipeline exceeds the 50-step safety limit.');

  const steps: PipelineStep[] = obj.steps.map((raw, i) => {
    const s = raw as Partial<PipelineStep>;
    const op = typeof s.opId === 'string' ? getOp(s.opId) : undefined;
    if (!op) throw new Error(`Step ${i + 1}: unknown operation "${String(s.opId)}".`);
    const action = op.actions.find((a) => a.id === s.actionId);
    if (!action) throw new Error(`Step ${i + 1}: "${s.actionId}" is not an action of ${op.name}.`);
    // Options: keep only known keys, coerce to schema types. Never executed.
    const options: Record<string, unknown> = {};
    for (const f of op.options ?? []) {
      const val = (s.options as Record<string, unknown> | undefined)?.[f.key];
      options[f.key] = val === undefined ? f.default : val;
    }
    return { opId: op.id, actionId: action.id, options, enabled: s.enabled !== false };
  });

  return { name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.slice(0, 80) : 'Imported pipeline', steps };
}
