// Shared test world: the same erp + toolset + scripts the page uses,
// with an injectable "auto-human" for attach/sign steps.
import { createErp } from "../src/erp.js";
import { createToolset } from "../src/tools.js";
import { makeSampleReceipts, sampleDates } from "../src/samples.js";

export function makeWorld({ now = () => new Date(2026, 7, 28, 10, 0, 0), signImpl } = {}) {
  const erp = createErp({ now });
  const outputs = []; // every tool result text, for budget assertions
  const hooks = {
    requestSignature: signImpl ?? (async () => ({ signed: true })),
    onCallEnd: (_rec, r) => outputs.push(r.text),
  };
  const toolset = createToolset(erp, hooks);
  const dates = sampleDates(now());
  const receiptData = makeSampleReceipts(dates);
  const human = {
    async attach(keys) {
      const out = {};
      for (const k of keys) {
        const r = receiptData.find((x) => x.key === k);
        const rec = await erp.attachReceipt({ filename: r.filename, bytes: new TextEncoder().encode(r.svg) }, "human");
        out[k] = rec.id;
      }
      return out;
    },
    async signin(personaId) {
      erp.signIn(personaId, "human");
    },
  };
  const dispatch = (name, args, opts = {}) => toolset.call(name, args, { source: "sim", ...opts });
  return { erp, toolset, dates, human, dispatch, outputs, receiptData };
}

export function names(toolset) {
  return toolset.surface().map((d) => d.name);
}

// A minimal clean report: small amounts, below every threshold, no receipts needed.
export async function buildCleanReport(world, { title = "Cafeteria week", project = "FALCON" } = {}) {
  const { erp, dates } = world;
  erp.createReport({ title, project }, "test");
  erp.addLine({ date: dates.cab, merchant: "Heron Cafeteria", category: "meals", amount: 18.2, attendees: 1, description: "Lunch" }, "test");
  erp.addLine({ date: dates.cab, merchant: "T Pass", category: "transport", amount: 12.0, description: "Subway" }, "test");
  return erp.openReportOrNull();
}
