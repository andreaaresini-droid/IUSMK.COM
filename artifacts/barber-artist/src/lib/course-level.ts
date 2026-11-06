// Il livello arriva dal database in inglese ("intermediate"): qui diventa
// una parola chiara nella lingua del sito.
const LEVELS: Record<string, { it: string; en: string }> = {
  beginner:     { it: "Base",       en: "Beginner" },
  intermediate: { it: "Intermedio", en: "Intermediate" },
  advanced:     { it: "Avanzato",   en: "Advanced" },
  expert:       { it: "Esperto",    en: "Expert" },
  all:          { it: "Per tutti",  en: "All levels" },
};

export function courseLevelLabel(level: string | null | undefined, lang: string): string {
  if (!level) return "";
  const l = LEVELS[level.trim().toLowerCase()];
  if (!l) return level;
  return lang === "it" ? l.it : l.en;
}
