// src/page/api-client.js — same-origin client for the server-owned report aggregate.

import { toCents } from "../policy.js";

const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(code, status, message, body = null) {
    super(message || code || `HTTP ${status}`);
    this.name = "ApiError";
    this.code = code ?? "E_API";
    this.status = status;
    this.body = body;
  }
}

function objectBody(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("E_BAD_RESPONSE", 502, `${label} returned a non-object JSON response`);
  }
  return value;
}

function reportProjection(value, label) {
  const report = objectBody(value, label);
  if (typeof report.id !== "string" || typeof report.owner !== "string"
      || typeof report.title !== "string" || typeof report.project !== "string"
      || !["draft", "submitted"].includes(report.status)
      || !Number.isInteger(report.revision) || !Array.isArray(report.lines)) {
    throw new ApiError("E_BAD_RESPONSE", 502, `${label} has an invalid report projection`);
  }
  for (const [index, line] of report.lines.entries()) {
    objectBody(line, `${label}.lines[${index}]`);
    if (typeof line.id !== "string" || !line.provenance || typeof line.provenance !== "object"
        || Array.isArray(line.provenance)) {
      throw new ApiError("E_BAD_RESPONSE", 502, `${label}.lines[${index}] has an invalid line projection`);
    }
  }
  return report;
}

function receiptList(value, label) {
  if (!Array.isArray(value)) throw new ApiError("E_BAD_RESPONSE", 502, `${label} omitted receipts`);
  for (const [index, receipt] of value.entries()) {
    objectBody(receipt, `${label}[${index}]`);
    if (typeof receipt.id !== "string" || typeof receipt.filename !== "string"
        || !Number.isInteger(receipt.size) || typeof receipt.sha256 !== "string") {
      throw new ApiError("E_BAD_RESPONSE", 502, `${label}[${index}] is invalid`);
    }
  }
  return value;
}

function lineBody(fields) {
  const body = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (key === "amount") {
      body.amount_cents = toCents(typeof value === "number" ? value : NaN);
    } else if (key === "itemization" && Array.isArray(value)) {
      body.itemization = value.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const converted = {};
        for (const [itemKey, itemValue] of Object.entries(item)) {
          if (itemKey === "amount") {
            converted.amount_cents = toCents(typeof itemValue === "number" ? itemValue : NaN);
          } else {
            converted[itemKey] = itemValue;
          }
        }
        return converted;
      });
    } else {
      body[key] = value;
    }
  }
  return body;
}

export function createApiClient({ fetchImpl = globalThis.fetch, baseUrl = "", headers = {} } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("createApiClient needs a fetch implementation");

  async function request(path, { method = "GET", body, signal, raw = false } = {}) {
    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? { ...headers } : { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        signal: requestSignal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timeoutSignal.aborted) {
        throw new ApiError("E_TIMEOUT", 0, `${method} ${path} timed out after 20 seconds`);
      }
      throw error;
    }
    let json;
    try {
      json = await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timeoutSignal.aborted) {
        throw new ApiError("E_TIMEOUT", 0, `${method} ${path} timed out after 20 seconds`);
      }
      throw new ApiError("E_BAD_RESPONSE", response.status, `${method} ${path} returned invalid JSON`);
    }
    if (raw) return { ok: response.ok, status: response.status, body: json };
    if (!response.ok) {
      const code = typeof json?.error === "string" ? json.error : json?.error?.code;
      const message = json?.message ?? json?.error?.message ?? `${method} ${path} failed`;
      throw new ApiError(code, response.status, message, json);
    }
    return objectBody(json, `${method} ${path}`);
  }

  function reportPayload(body, label) {
    reportProjection(body?.report, `${label}.report`);
    objectBody(body?.provenance, `${label}.provenance`);
    receiptList(body?.receipts, `${label}.receipts`);
    return body;
  }

  return {
    async listReports(signal) {
      const body = await request("/api/reports", { signal });
      if (!Array.isArray(body.reports)) throw new ApiError("E_BAD_RESPONSE", 502, "GET /api/reports omitted reports");
      body.reports.forEach((report, index) => reportProjection(report, `GET /api/reports.reports[${index}]`));
      return body;
    },

    async getReport(reportId, signal) {
      return reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}`, { signal }),
        "GET report",
      );
    },

    async listReceipts(signal) {
      const body = await request("/api/receipts", { signal });
      receiptList(body.receipts, "GET /api/receipts.receipts");
      return body;
    },

    async createReport(args, signal) {
      return reportPayload(await request("/api/reports", { method: "POST", body: args, signal }), "create report");
    },

    async openReport(args, signal) {
      const { report_id: reportId, ...body } = args ?? {};
      return reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}/open`, { method: "POST", body, signal }),
        "open report",
      );
    },

    async addLine(reportId, fields, signal) {
      const body = reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}/lines`, {
          method: "POST", body: lineBody(fields), signal,
        }),
        "add line",
      );
      if (typeof body.line_id !== "string") throw new ApiError("E_BAD_RESPONSE", 502, "add line omitted line_id");
      return body;
    },

    async updateLine(reportId, args, signal) {
      const { line_id: lineId, ...fields } = args ?? {};
      return reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}/lines/${encodeURIComponent(lineId)}`, {
          method: "PATCH", body: lineBody(fields), signal,
        }),
        "update line",
      );
    },

    async removeLine(reportId, args, signal) {
      const { line_id: lineId, ...body } = args ?? {};
      return reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}/lines/${encodeURIComponent(lineId)}`, {
          method: "DELETE", body, signal,
        }),
        "remove line",
      );
    },

    async linkReceipt(reportId, args, signal) {
      const { line_id: lineId, ...body } = args ?? {};
      return reportPayload(
        await request(`/api/reports/${encodeURIComponent(reportId)}/lines/${encodeURIComponent(lineId)}/receipt`, {
          method: "POST", body, signal,
        }),
        "link receipt",
      );
    },

    async validateReport(reportId, signal) {
      const body = await request(`/api/reports/${encodeURIComponent(reportId)}/validation`, { signal });
      const { verdict } = body;
      objectBody(verdict, "validate report.verdict");
      return reportPayload(body, "validate report");
    },

    async attachReceiptMetadata(metadata, signal) {
      const body = await request("/api/ui/receipts", { method: "POST", body: metadata, signal });
      objectBody(body.receipt, "attach receipt.receipt");
      receiptList(body.receipts, "attach receipt.receipts");
      return body;
    },

    async updateReportAsHuman(reportId, patch, signal) {
      return reportPayload(
        await request(`/api/ui/reports/${encodeURIComponent(reportId)}`, { method: "PATCH", body: patch, signal }),
        "human report update",
      );
    },

    async updateLineAsHuman(reportId, lineId, patch, signal) {
      return reportPayload(
        await request(`/api/ui/reports/${encodeURIComponent(reportId)}/lines/${encodeURIComponent(lineId)}`, {
          method: "PATCH", body: lineBody(patch), signal,
        }),
        "human line update",
      );
    },

    commitReport: (reportId, requestId, signal) => request(
      `/api/reports/${encodeURIComponent(reportId)}/commit`,
      {
        method: "POST",
        body: { schema: "outpocket.commit_request/1", report_id: reportId, request_id: requestId },
        signal,
        raw: true,
      },
    ),

    dayBook: (signal) => request("/api/daybook", { signal, raw: true }),
  };
}
