// tools/check-ownership.mjs — node G0, owner L1.
//
// Implements erp/graph.json.conventions.ownership_rule EXACTLY and nothing else:
//
//   A seat may write a path if EITHER (a) it owns a node that lists that path in
//   `outputs`, OR (b) the longest-matching glob in `file_ownership` names it. (a) beats (b).
//
// The previous glob-only rule mechanically rejected 23 of the graph's own node outputs,
// which is why (a) exists and why it wins.
//
//   node tools/check-ownership.mjs --seat <SEAT> --files-from <file>
//   node tools/check-ownership.mjs --seat <SEAT> --file <path> [--file <path> ...]
//   node tools/check-ownership.mjs --who <path>            who may write this path
//
// Exit 0 = every listed path is writable by <SEAT>. Exit 1 = at least one is not, and
// every offender is printed with the rule that decided it.
import fs from 'node:fs';

export function loadGraph(p = 'erp/graph.json') {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Glob dialect used by file_ownership: literal segments, `*` (one segment, no `/`) and
// `**` (any number of segments, including zero). Nothing else appears in the list.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') { i++; re += '(?:[^/]+/)*'; } else { re += '.*'; }
      } else {
        re += '[^/]*';
      }
    } else if ('.+?^${}()|[]\\/'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

// (b) the longest-matching glob. "Longest" is the length of the glob string, which is the
// same order as specificity for every pattern in this list (`src/**` < `src/page/**` <
// `src/page/register.js`).
export function globOwner(path, graph) {
  let best = null;
  for (const row of graph.file_ownership) {
    if (!globToRegExp(row.glob).test(path)) continue;
    if (best === null || row.glob.length > best.glob.length) best = row;
  }
  return best;
}

// (a) a node that declares this path as an output. Outputs are compared with any trailing
// `/` removed, the same normalisation --check-accept-paths uses.
export function outputOwners(path, graph) {
  const norm = (s) => s.replace(/\/+$/, '');
  const want = norm(path);
  return graph.nodes.filter((n) => n.outputs.some((o) => norm(o) === want));
}

// The full rule. Returns { allowed, via, detail } for a (seat, path) pair.
export function decide(seat, path, graph) {
  const owners = outputOwners(path, graph);
  if (owners.length) {
    const mine = owners.filter((n) => n.owner === seat);
    if (mine.length) {
      return { allowed: true, via: 'output', detail: `declared output of ${mine.map((n) => n.id).join(',')} (owner ${seat})` };
    }
    return {
      allowed: false, via: 'output',
      detail: `declared output of ${owners.map((n) => `${n.id}(${n.owner})`).join(',')} — rule (a) beats the glob, and it does not name ${seat}`,
    };
  }
  const g = globOwner(path, graph);
  if (!g) return { allowed: false, via: 'unresolved', detail: 'no node output and no matching glob — the path is unowned' };
  if (g.seat === seat) return { allowed: true, via: 'glob', detail: `longest matching glob \`${g.glob}\` -> ${g.seat}` };
  return { allowed: false, via: 'glob', detail: `longest matching glob \`${g.glob}\` -> ${g.seat}, not ${seat}` };
}

// Who may write this path at all, ignoring any particular seat.
export function whoMayWrite(path, graph) {
  const owners = outputOwners(path, graph);
  if (owners.length) {
    return { resolved: true, via: 'output', seats: [...new Set(owners.map((n) => n.owner))], detail: owners.map((n) => `${n.id}(${n.owner})`).join(',') };
  }
  const g = globOwner(path, graph);
  if (g) return { resolved: true, via: 'glob', seats: [g.seat], detail: `\`${g.glob}\`` };
  return { resolved: false, via: 'unresolved', seats: [], detail: 'no node output and no matching glob' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
  const graph = loadGraph();

  const who = val('--who');
  if (who) {
    const r = whoMayWrite(who, graph);
    console.log(`${who}  ->  ${r.resolved ? r.seats.join('/') : 'UNOWNED'}  [${r.via}: ${r.detail}]`);
    process.exit(r.resolved ? 0 : 1);
  }

  const seat = val('--seat');
  if (!seat) {
    console.error('usage: check-ownership.mjs --seat <SEAT> --files-from <file> | --file <path>... | --who <path>');
    process.exit(2);
  }

  let files = [];
  const from = val('--files-from');
  if (from) {
    files = fs.readFileSync(from === '-' ? 0 : from, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  }
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--file') files.push(argv[i + 1]);
  if (!files.length) { console.error('no files given'); process.exit(2); }

  const bad = [];
  for (const f of files) {
    const d = decide(seat, f, graph);
    console.log(`${d.allowed ? 'OK  ' : 'DENY'}  ${f}  [${d.detail}]`);
    if (!d.allowed) bad.push(f);
  }
  console.log(`\n${files.length} path(s) checked for seat ${seat}; ${bad.length} violation(s).`);
  if (bad.length) {
    console.error('VIOLATIONS: ' + bad.join(' '));
    process.exit(1);
  }
  process.exit(0);
}
