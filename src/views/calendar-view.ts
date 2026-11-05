import { App } from "obsidian";
import { toGregorian } from "../core/persian-bridge";
import { ReviewSession } from "../models/review-item";

export interface CalendarOptions {
  reviews?: ReviewSession[];
  learnedAt?: string;
  cellHeight?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onMonthChange?: (year: number, month: number) => void;
}

export function renderJalaliCalendar(
  app: App,
  container: HTMLElement,
  currentYear: number,
  currentMonth: number,
  options: CalendarOptions = {}
): void {
  container.empty();
  container.setAttr("dir", "rtl");
  container.addClass("re-cal-container");

  const KIND_COLORS: Record<string, string> = {
    initial: "#3b82f6",
    weekend: "#10b981",
    monthly: "#f59e0b",
    longterm: "#ef4444",
  };
  const KIND_LABELS: Record<string, string> = {
    initial: "مرور اولیه",
    weekend: "مرور هفتگی",
    monthly: "مرور ماهانه",
    longterm: "مرور بلندمدت",
  };

  const reviewsByDate = new Map<string, ReviewSession[]>();
  if (options.reviews) {
    for (const r of options.reviews) {
      if (!reviewsByDate.has(r.dueDate)) reviewsByDate.set(r.dueDate, []);
      reviewsByDate.get(r.dueDate)!.push(r);
    }
  }

  // --- هدر ---
  const header = container.createDiv({ cls: "re-cal-header" });
  header.setCssStyles({ 
    display: "flex", justifyContent: "space-between", alignItems: "center", 
    marginBottom: "8px", padding: "4px 8px", background: "var(--background-primary)", 
    borderRadius: "8px", border: "1px solid var(--background-modifier-border)" 
  });

  if (options.onMonthChange) {
    const prevBtn = header.createEl("button", { text: "‹" });
    prevBtn.setCssStyles({ padding: "2px 10px", cursor: "pointer", background: "transparent", border: "none", fontSize: "18px", color: "var(--text-muted)" });
    prevBtn.onclick = () => {
      let m = currentMonth - 1, y = currentYear;
      if (m < 1) { m = 12; y--; }
      options.onMonthChange!(y, m);
    };
  }

  const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  header.createEl("h4", { text: `${monthNames[currentMonth - 1]} ${currentYear}`, style: "margin: 0; font-size: 14px;" });

  if (options.onMonthChange) {
    const nextBtn = header.createEl("button", { text: "›" });
    nextBtn.setCssStyles({ padding: "2px 10px", cursor: "pointer", background: "transparent", border: "none", fontSize: "18px", color: "var(--text-muted)" });
    nextBtn.onclick = () => {
      let m = currentMonth + 1, y = currentYear;
      if (m > 12) { m = 1; y++; }
      options.onMonthChange!(y, m);
    };
  }

  // --- شبکه ---
  const grid = container.createDiv({ cls: "re-cal-grid" });
  grid.setCssStyles({ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" });

  const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  weekDays.forEach(d => {
    const cell = grid.createDiv({ text: d });
    cell.setCssStyles({ textAlign: "center", fontWeight: "bold", padding: "6px", color: "var(--text-muted)", fontSize: "11px" });
  });

  const daysInMonth = currentMonth <= 6 ? 31 : (currentMonth <= 11 ? 30 : 29);
  const firstG = toGregorian(app, currentYear, currentMonth, 1);
  const firstDay = new Date(firstG.gy, firstG.gm - 1, firstG.gd);
  const startOffset = (firstDay.getDay() + 1) % 7; // شنبه=0

  for (let i = 0; i < startOffset; i++) grid.createDiv();

  for (let d = 1; d <= daysInMonth; d++) {
    const g = toGregorian(app, currentYear, currentMonth, d);
    const iso = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
    const dayReviews = reviewsByDate.get(iso) || [];

    const inRange = (!options.rangeStart || iso >= options.rangeStart) && (!options.rangeEnd || iso <= options.rangeEnd);
    const cell = grid.createDiv({ cls: "re-cal-cell" });
    
    let bgColor = "var(--background-secondary)";
    let borderColor = "var(--background-modifier-border)";
    let textColor = "var(--text-normal)";
    let opacity = "1";
    let cursor = "default";
    
    if (dayReviews.length > 0) {
      const firstKind = dayReviews[0].kind;
      bgColor = KIND_COLORS[firstKind] || bgColor;
      borderColor = KIND_COLORS[firstKind] || borderColor;
      textColor = "white";
      cursor = "help";
    } else if (!inRange) {
      bgColor = "transparent";
      borderColor = "transparent";
      textColor = "var(--text-faint)";
      opacity = "0.2";
    }

    cell.setCssStyles({
      minHeight: options.cellHeight || "50px",
      padding: "4px",
      borderRadius: "6px",
      background: bgColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
      opacity,
      cursor,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      fontSize: "12px",
      position: "relative",
    });

    const dayNum = cell.createDiv({ text: String(d) });
    dayNum.setCssStyles({ fontWeight: "bold" });

    if (dayReviews.length > 0) {
      const badge = cell.createDiv({ text: String(dayReviews.length) });
      badge.setCssStyles({ fontSize: "10px", opacity: "0.9", alignSelf: "flex-start" });
      
      const tooltipLines = dayReviews.map(r => `${KIND_LABELS[r.kind] || "مرور"}: ${r.label}`);
      const tooltip = tooltipLines.join("\n");
      
      // ✅ تولتیپ با data-tooltip (CSS خالص، تضمینی)
      cell.setAttribute("data-tooltip", tooltip);
      cell.addClass("re-has-tooltip");
    }

    if (options.learnedAt === iso) {
      cell.setCssStyles({ border: "2px solid #ef4444" });
      if (dayReviews.length === 0) {
        cell.setAttribute("data-tooltip", "تاریخ یادگیری");
        cell.addClass("re-has-tooltip");
      }
    }
  }

  // --- افسانه ---
  const legend = container.createDiv({ cls: "re-cal-legend" });
  legend.setCssStyles({ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap", fontSize: "11px" });
  for (const [kind, label] of Object.entries(KIND_LABELS)) {
    const item = legend.createDiv();
    item.setCssStyles({ display: "flex", alignItems: "center", gap: "4px" });
    const dot = item.createDiv();
    dot.setCssStyles({ width: "12px", height: "12px", borderRadius: "3px", background: KIND_COLORS[kind] });
    item.createSpan({ text: label });
  }
}
