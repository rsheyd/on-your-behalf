const DEFAULT_TITLE = "Fill this form with On Your Behalf";

export function actionIndicatorFor(operation) {
  if (!operation) return { text: "", color: "#00000000", title: DEFAULT_TITLE };
  if (operation.status === "running") return { text: "RUN", color: "#7c3aed", title: `OYB is running — ${operation.message || "filling a form"}` };
  if (operation.status === "paused") return { text: "Ⅱ", color: "#d97706", title: `OYB is paused — ${operation.message || "open OYB to continue"}` };
  if (operation.status === "failed") return { text: "!", color: "#dc2626", title: `OYB needs attention — ${operation.message || "the fill failed"}` };
  if (operation.status === "complete") return { text: "✓", color: "#16835f", title: "OYB finished filling. Open OYB to review the result." };
  return { text: "", color: "#00000000", title: DEFAULT_TITLE };
}
