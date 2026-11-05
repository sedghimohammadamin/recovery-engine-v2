export type ReviewKindUI = "initial" | "weekend" | "monthly" | "longterm";

export const KIND_COLORS: Record<ReviewKindUI, { bg: string; border: string; label: string }> = {
  initial:  { bg: "#3b82f6", border: "#2563eb", label: "مرور اولیه" },
  weekend:  { bg: "#10b981", border: "#059669", label: "مرور هفتگی" },
  monthly:  { bg: "#f59e0b", border: "#d97706", label: "مرور ماهانه" },
  longterm: { bg: "#ef4444", border: "#dc2626", label: "مرور بلندمدت" },
};
