// The coverage gate: every export of every ported module needs a Godot counterpart with enough varied cases.
export const MIN_CASES = 30;
export const MIN_OUTCOMES = 3;

/**
 * @typedef {{ cases: number, outcomes: Set<string>, mutated: number }} Tally
 * @typedef {{ modules: string[], notPorted: Record<string, string>, elsewhere: Record<string, string>, functions: Record<string, { cases?: number, outcomes?: number, reason: string }>, constants?: Record<string, string>, branches?: Record<string, string> }} Whitelist
 */
/** Every module of `src/game` is ported, or says why not. */
export function moduleGate(found, whitelist) {
  const errors = [], { modules, notPorted } = whitelist;
  for (const m of found) if (!modules.includes(m) && !notPorted[m]) errors.push(`src/game/${m}.ts is not ported: add it to "modules" or, with a reason, to "notPorted"`);
  for (const m of [...modules, ...Object.keys(notPorted)]) if (!found.includes(m)) errors.push(`${m}: listed, but there is no src/game/${m}.ts`);
  for (const m of Object.keys(notPorted)) if (modules.includes(m)) errors.push(`${m}: listed as ported and as not ported`);
  return errors;
}

/** Exports without enough cases; those that other checks compare (`elsewhere`) say which. */
export function checkGate(mod, exports, tallies, whitelist) {
  const errors = [];
  for (const [name, value] of Object.entries(exports)) {
    if (typeof value !== 'function') continue;
    const key = `${mod}.${name}`;
    if (whitelist.elsewhere[key]) continue;
    const allowed = whitelist.functions[key], tally = tallies.get(name);
    if (!tally) { errors.push(`${key}: no cases`); continue; }
    const cases = allowed?.cases ?? MIN_CASES, outcomes = allowed?.outcomes ?? needed(tally, value);
    if (tally.cases < cases) errors.push(`${key}: ${tally.cases} cases, needs ${cases}`);
    if (tally.outcomes.size < outcomes) errors.push(`${key}: ${tally.outcomes.size} outcomes, needs ${outcomes}`);
    // An entry that is no longer needed hides the next gap.
    if (allowed?.outcomes !== undefined && tally.outcomes.size > allowed.outcomes) errors.push(`${key}: allowed ${allowed.outcomes} outcomes, but reached ${tally.outcomes.size}; remove the entry`);
  }
  for (const key of Object.keys(whitelist.elsewhere)) if (key.startsWith(`${mod}.`) && typeof exports[key.slice(mod.length + 1)] !== 'function') errors.push(`${key}: compared elsewhere, but not exported`);
  for (const [key, entry] of Object.entries(whitelist.functions)) {
    if (!key.startsWith(`${mod}.`)) continue;
    if (!(key.slice(mod.length + 1) in exports)) errors.push(`${key}: allowed, but not exported`);
    if (!entry.reason) errors.push(`${key}: allowed without a reason`);
  }
  return errors;
}
/** A yes/no answer has two outcomes and a function without parameters one; anything else must show three. */
function needed(tally, fn) {
  if (fn.length === 0 && tally.cases > 0 && tally.outcomes.size === 1 && !tally.mutated) return 1;
  return [...tally.outcomes].every((o) => o === 'true' || o === 'false') ? 2 : MIN_OUTCOMES;
}

/**
 * Branches of the checked modules that no process ran, unless allowed; and allowances nobody needs any more.
 * A process that never calls a function says nothing about the branches inside it, so the processes are compared
 * by which characters of the shared bundle ran, not by which branches each of them reports.
 */
export function branchGate(processes, whitelist, modules) {
  const ran = (at) => processes.some((p) => p.map[at] === 1), allowed = whitelist.branches ?? {}, errors = [], missed = new Set();
  for (const p of processes) for (const b of p.branches) if (modules.includes(b.key.split(':')[0]) && !ran(b.at)) missed.add(b.key);
  for (const key of missed) if (!allowed[key]) errors.push(`unreached branch ${key}`);
  for (const key of Object.keys(allowed)) if (modules.includes(key.split(':')[0]) && !missed.has(key)) errors.push(`allowed branch is reached now, remove it: ${key}`);
  return errors;
}
