// 账房 COUNTINGHOUSE — sample receipts.
// Generated at runtime so dates always sit inside the 90-day filing window.
// The same builder writes the static files in samples/ (tools/gen-samples.mjs)
// for dragging into a real agent chat, and feeds the in-page "attach sample
// receipts" button and the text transcripts for agents without vision.

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function receiptSvg({ title, sub, date, rows, total, footer }) {
  const lineH = 22;
  const bodyTop = 118;
  const h = bodyTop + rows.length * lineH + 96;
  const items = rows
    .map(
      ([label, amt], i) =>
        `<text x="24" y="${bodyTop + i * lineH}" class="t">${esc(label)}</text>` +
        `<text x="296" y="${bodyTop + i * lineH}" class="t r">${esc(amt)}</text>`
    )
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="${h}" viewBox="0 0 320 ${h}">
  <style>
    .t { font: 13px "Courier New", monospace; fill: #222; }
    .b { font: bold 15px "Courier New", monospace; fill: #111; }
    .s { font: 11px "Courier New", monospace; fill: #555; }
    .r { text-anchor: end; }
    .c { text-anchor: middle; }
  </style>
  <rect width="320" height="${h}" fill="#fdfcf7"/>
  <rect x="8" y="8" width="304" height="${h - 16}" fill="none" stroke="#d8d4c6" stroke-dasharray="3 3"/>
  <text x="160" y="40" class="b c">${esc(title)}</text>
  <text x="160" y="58" class="s c">${esc(sub)}</text>
  <text x="160" y="76" class="s c">${esc(date)}</text>
  <line x1="24" y1="90" x2="296" y2="90" stroke="#bbb" stroke-dasharray="4 3"/>
  ${items}
  <line x1="24" y1="${bodyTop + rows.length * lineH + 4}" x2="296" y2="${bodyTop + rows.length * lineH + 4}" stroke="#bbb" stroke-dasharray="4 3"/>
  <text x="24" y="${bodyTop + rows.length * lineH + 30}" class="b">TOTAL</text>
  <text x="296" y="${bodyTop + rows.length * lineH + 30}" class="b r">${esc(total)}</text>
  <text x="160" y="${bodyTop + rows.length * lineH + 58}" class="s c">${esc(footer)}</text>
</svg>`;
}

// dates: { dinner, hotelIn, hotelOut, cab, berlin } as YYYY-MM-DD strings
export function makeSampleReceipts(dates) {
  return [
    {
      key: "dinner",
      filename: "harbor-grill-dinner.svg",
      svg: receiptSvg({
        title: "HARBOR GRILL",
        sub: "22 Long Wharf, Boston MA",
        date: `${dates.dinner} · TABLE 9 · GUESTS: 3`,
        rows: [
          ["Entrees x3", "118.00"],
          ["Chianti (bottle)", "38.00"],
          ["Dessert", "12.00"],
          ["Service 10%", "18.40"],
        ],
        total: "$186.40",
        footer: "Thank you! · card **** 4417",
      }),
      transcript: `RECEIPT "harbor-grill-dinner" — Harbor Grill, 22 Long Wharf, Boston MA · ${dates.dinner} · GUESTS: 3 · items: Entrees x3 $118.00; Chianti (bottle) $38.00; Dessert $12.00; Service 10% $18.40 · TOTAL $186.40`,
    },
    {
      key: "hotel",
      filename: "beacon-hill-suites-folio.svg",
      svg: receiptSvg({
        title: "BEACON HILL SUITES",
        sub: "Guest folio — CHEN XIAO",
        date: `${dates.hotelIn} → ${dates.hotelOut}`,
        rows: [
          ["Room 402, 2 NIGHTS @ 249.00", "498.00"],
        ],
        total: "$498.00",
        footer: "Folio F-88213 · incl. taxes",
      }),
      transcript: `RECEIPT "beacon-hill-suites-folio" — Beacon Hill Suites guest folio, Chen Xiao · ${dates.hotelIn} to ${dates.hotelOut} · Room 402, 2 NIGHTS @ $249.00 · TOTAL $498.00`,
    },
    {
      key: "cab",
      filename: "city-cab-boston.svg",
      svg: receiptSvg({
        title: "CITY CAB BOSTON",
        sub: "Medallion 7719",
        date: dates.cab,
        rows: [
          ["Logan Airport → Long Wharf", "38.50"],
          ["Tip", "4.00"],
        ],
        total: "$42.50",
        footer: "Paid by card",
      }),
      transcript: `RECEIPT "city-cab-boston" — City Cab Boston, medallion 7719 · ${dates.cab} · Logan Airport to Long Wharf $38.50; Tip $4.00 · TOTAL $42.50`,
    },
    {
      key: "berlin",
      filename: "berlin-airport-transfer.svg",
      svg: receiptSvg({
        title: "FLUGHAFEN TRANSFER GmbH",
        sub: "Berlin BER — Quittung",
        date: dates.berlin,
        rows: [["BER → Mitte (Festpreis)", "38.00"]],
        total: "EUR 38.00",
        footer: "MwSt. inkl.",
      }),
      transcript: `RECEIPT "berlin-airport-transfer" — Flughafen Transfer GmbH, Berlin · ${dates.berlin} · BER to Mitte fixed price · TOTAL EUR 38.00`,
    },
  ];
}

export function sampleDates(now) {
  const d = (days) => {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  return { dinner: d(3), hotelIn: d(4), hotelOut: d(2), cab: d(4), berlin: d(9) };
}

// The rehearsed demo prompt (copy-paste to a real agent). Receipt transcripts
// are embedded so the demo works with or without image input.
export function demoPrompt(dates) {
  const receipts = makeSampleReceipts(dates)
    .filter((r) => r.key !== "berlin")
    .map((r) => r.transcript)
    .join("\n");
  return (
    "I'm back from the Boston client workshop. Below are transcripts of my three receipts. " +
    "File one expense report for project FALCON on this page, fix any policy violations the desk raises, " +
    "link the receipt files I've attached in the page to their lines, and take it to my signature — I'll sign it myself.\n\n" +
    receipts
  );
}
