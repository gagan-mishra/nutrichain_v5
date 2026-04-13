import ExcelJS from "exceljs";

function fmtDMY(iso) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function qtyTotal(items) {
  let total = 0;
  for (const it of items || []) {
    const qty = Number(it?.qty || 0);
    if (!Number.isFinite(qty)) continue;
    total += qty;
  }
  return Number(total.toFixed(2));
}

function amountToWordsIndian(n) {
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function twoDigits(num) {
    if (num < 20) return units[num] || "";
    const t = Math.floor(num / 10);
    const u = num % 10;
    return `${tens[t]}${u ? ` ${units[u]}` : ""}`;
  }
  function threeDigits(num) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    return `${h ? `${units[h]} Hundred${rest ? " " : ""}` : ""}${rest ? twoDigits(rest) : ""}`;
  }
  function section(num, name) {
    return num ? `${threeDigits(num)}${name ? ` ${name}` : ""}` : "";
  }
  let value = Math.round(Number(n || 0));
  if (value === 0) return "Zero Rupees Only";
  const crore = Math.floor(value / 10000000);
  value %= 10000000;
  const lakh = Math.floor(value / 100000);
  value %= 100000;
  const thousand = Math.floor(value / 1000);
  value %= 1000;
  const hundred = value;
  const parts = [section(crore, "Crore"), section(lakh, "Lakh"), section(thousand, "Thousand"), threeDigits(hundred)].filter(Boolean);
  return `${parts.join(" ")} Rupees Only`;
}

const BORDER = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

const CURRENCY_FMT = '"₹" #,##0.00';
const NUMBER_FMT = "#,##0.00";

function styleRange(ws, startRow, endRow, startCol, endCol, styleFn) {
  for (let r = startRow; r <= endRow; r += 1) {
    for (let c = startCol; c <= endCol; c += 1) {
      const cell = ws.getCell(r, c);
      styleFn(cell, r, c);
    }
  }
}

function putMetaCell(ws, labelCell, valueCell, label, value) {
  ws.getCell(labelCell).value = label;
  ws.getCell(labelCell).font = { bold: true, color: { argb: "FF1F2937" } };
  ws.getCell(labelCell).alignment = { horizontal: "left", vertical: "middle" };
  ws.getCell(labelCell).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  ws.getCell(labelCell).border = BORDER;

  ws.getCell(valueCell).value = value || "-";
  ws.getCell(valueCell).font = { color: { argb: "FF111827" } };
  ws.getCell(valueCell).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getCell(valueCell).border = BORDER;
}

export async function buildPartyBillXlsxBlob(data) {
  const meta = data?.meta || {};
  const firm = meta?.firm || {};
  const party = meta?.party || {};
  const items = data?.items || [];
  const totals = data?.totals || {};

  const wb = new ExcelJS.Workbook();
  wb.creator = "NutriChain";
  wb.created = new Date();
  const ws = wb.addWorksheet("Party Bill", {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  ws.columns = [
    { width: 5 },   // A
    { width: 12 },  // B
    { width: 12 },  // C
    { width: 28 },  // D
    { width: 14 },  // E
    { width: 10 },  // F
    { width: 8 },   // G
    { width: 12 },  // H
    { width: 13 },  // I
    { width: 14 },  // J
  ];

  let row = 1;

  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value = "TRADE BROKERAGE STATEMENT";
  ws.getCell(`A${row}`).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  ws.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell(`A${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
  ws.getRow(row).height = 24;
  row += 1;

  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value = firm.name || "";
  ws.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: "FF111827" } };
  ws.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
  row += 1;

  const firmLine = [firm.gst_no ? `GSTIN: ${firm.gst_no}` : "", firm.address || ""].filter(Boolean).join("  |  ");
  if (firmLine) {
    ws.mergeCells(`A${row}:J${row}`);
    ws.getCell(`A${row}`).value = firmLine;
    ws.getCell(`A${row}`).font = { size: 10, color: { argb: "FF4B5563" } };
    ws.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
    row += 1;
  }

  row += 1;

  putMetaCell(ws, `A${row}`, `D${row}`, "Bill No", meta.bill_no || "-");
  putMetaCell(ws, `G${row}`, `I${row}`, "Date", fmtDMY(meta.bill_date));
  ws.mergeCells(`D${row}:F${row}`);
  ws.mergeCells(`I${row}:J${row}`);
  row += 1;

  putMetaCell(ws, `A${row}`, `D${row}`, "From", fmtDMY(meta.from));
  putMetaCell(ws, `G${row}`, `I${row}`, "To", fmtDMY(meta.to));
  ws.mergeCells(`D${row}:F${row}`);
  ws.mergeCells(`I${row}:J${row}`);
  row += 1;

  putMetaCell(ws, `A${row}`, `D${row}`, "Party", party.name || "-");
  ws.mergeCells(`D${row}:J${row}`);
  row += 1;

  if (party.gst_no) {
    putMetaCell(ws, `A${row}`, `D${row}`, "Party GSTIN", party.gst_no);
    ws.mergeCells(`D${row}:J${row}`);
    row += 1;
  }

  if (party.address) {
    putMetaCell(ws, `A${row}`, `D${row}`, "Party Address", party.address);
    ws.mergeCells(`D${row}:J${row}`);
    ws.getRow(row).height = 22;
    row += 1;
  }

  row += 1;

  const headerRow = row;
  const headers = ["Sr.", "Contract No", "Date", "Other Party", "Product", "Qty", "Unit", "Price", "Brokerage", "Amount"];
  ws.getRow(headerRow).values = headers;
  styleRange(ws, headerRow, headerRow, 1, 10, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER;
  });
  ws.getRow(headerRow).height = 20;
  row += 1;

  const itemStart = row;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i] || {};
    const current = row + i;
    ws.getCell(`A${current}`).value = i + 1;
    ws.getCell(`B${current}`).value = it.contract_no || "";
    ws.getCell(`C${current}`).value = fmtDMY(it.order_date);
    ws.getCell(`D${current}`).value = it.other_party || "";
    ws.getCell(`E${current}`).value = it.product || "";
    ws.getCell(`F${current}`).value = Number(it.qty || 0);
    ws.getCell(`G${current}`).value = it.unit || "";
    ws.getCell(`H${current}`).value = it.price == null ? null : Number(it.price);
    ws.getCell(`I${current}`).value = Number(it.brokerage_rate || 0);
    ws.getCell(`J${current}`).value = Number(it.amount || 0);

    styleRange(ws, current, current, 1, 10, (cell, _r, c) => {
      cell.border = BORDER;
      const isNum = [6, 8, 9, 10].includes(c);
      cell.alignment = { horizontal: isNum ? "right" : "left", vertical: "middle", wrapText: c === 4 || c === 5 };
      if (isNum) cell.numFmt = NUMBER_FMT;
      if (i % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      }
    });
    ws.getRow(current).height = 18;
  }

  const itemEnd = Math.max(itemStart, row + items.length - 1);
  row = itemEnd + 2;

  function totalsRow(label, value, opts = {}) {
    ws.mergeCells(`H${row}:I${row}`);
    ws.getCell(`H${row}`).value = label;
    ws.getCell(`H${row}`).font = { bold: true, color: { argb: "FF111827" } };
    ws.getCell(`H${row}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`H${row}`).border = BORDER;
    ws.getCell(`H${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

    ws.getCell(`J${row}`).value = value;
    ws.getCell(`J${row}`).alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell(`J${row}`).border = BORDER;
    ws.getCell(`J${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    ws.getCell(`J${row}`).font = { bold: !!opts.bold, size: opts.bold ? 12 : 11, color: { argb: "FF111827" } };
    if (opts.currency) ws.getCell(`J${row}`).numFmt = CURRENCY_FMT;
    row += 1;
  }

  totalsRow("Total Qty", `${qtyTotal(items).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M.T.`);
  totalsRow("Subtotal", Number(totals.subtotal || 0), { currency: true });
  if (Number(totals.cgst || 0) > 0) totalsRow(`CGST (${Number(party.cgst_rate || 0).toFixed(0)}%)`, Number(totals.cgst || 0), { currency: true });
  if (Number(totals.sgst || 0) > 0) totalsRow(`SGST (${Number(party.sgst_rate || 0).toFixed(0)}%)`, Number(totals.sgst || 0), { currency: true });
  if (Number(totals.igst || 0) > 0) totalsRow(`IGST (${Number(party.igst_rate || 0).toFixed(0)}%)`, Number(totals.igst || 0), { currency: true });
  totalsRow("Total", Number(totals.total || 0), { currency: true, bold: true });

  row += 1;
  ws.mergeCells(`A${row}:J${row}`);
  ws.getCell(`A${row}`).value = `Amount in words: ${amountToWordsIndian(totals.total || 0)}`;
  ws.getCell(`A${row}`).font = { italic: true, color: { argb: "FF111827" } };
  ws.getCell(`A${row}`).alignment = { horizontal: "left", vertical: "middle" };
  ws.getCell(`A${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  ws.getCell(`A${row}`).border = BORDER;
  ws.getRow(row).height = 22;

  row += 2;
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = firm.name || "";
  ws.getCell(`A${row}`).font = { bold: true, color: { argb: "FF111827" } };
  ws.getCell(`A${row}`).alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells(`H${row}:J${row}`);
  ws.getCell(`H${row}`).value = "Authorised Signatory";
  ws.getCell(`H${row}`).font = { bold: true, color: { argb: "FF111827" } };
  ws.getCell(`H${row}`).alignment = { horizontal: "center", vertical: "middle" };
  ws.getCell(`H${row}`).border = { top: { style: "thin", color: { argb: "FF6B7280" } } };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
