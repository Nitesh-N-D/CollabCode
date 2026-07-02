export const dependencyHealth = {
  persistence: "checking" as "checking" | "available" | "unavailable",
  checkedAt: 0
};

export function setPersistenceHealth(available: boolean): void {
  dependencyHealth.persistence = available ? "available" : "unavailable";
  dependencyHealth.checkedAt = Date.now();
}
