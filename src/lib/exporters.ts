import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDate } from "./gym-utils";

interface MemberRow {
  member_code: string;
  full_name: string;
  phone: string;
  gender: string | null;
  age: number | null;
  joining_date: string;
  plan_months: number;
  plan_price: number | string;
  expiry_date: string;
  status: string;
}

export function exportMembersExcel(rows: MemberRow[]) {
  const data = rows.map((m) => ({
    "Member ID": m.member_code,
    Name: m.full_name,
    Phone: m.phone,
    Gender: m.gender ?? "",
    Age: m.age ?? "",
    Joining: fmtDate(m.joining_date),
    "Plan (months)": m.plan_months,
    Fee: Number(m.plan_price),
    Expiry: fmtDate(m.expiry_date),
    Status: m.status,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  XLSX.writeFile(wb, `members-${new Date().toISOString().slice(0,10)}.xlsx`);
}

export function exportMembersPdf(rows: MemberRow[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("IronCore — Members", 14, 16);
  doc.setFontSize(10);
  doc.text(`Generated ${new Date().toLocaleString()}  ·  ${rows.length} members`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [["ID","Name","Phone","Plan","Fee","Joining","Expiry","Status"]],
    body: rows.map((m) => [
      m.member_code, m.full_name, m.phone, `${m.plan_months}m`,
      String(m.plan_price), fmtDate(m.joining_date), fmtDate(m.expiry_date), m.status,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [200, 140, 30] },
  });
  doc.save(`members-${new Date().toISOString().slice(0,10)}.pdf`);
}