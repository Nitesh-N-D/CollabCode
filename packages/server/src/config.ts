function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendOrigins: [
    ...(process.env.FRONTEND_URL ?? "http://localhost:5173").split(","),
    ...(process.env.STUDENT_PORTAL_URL ?? "http://localhost:5174").split(",")
  ].map((value) => value.trim()).filter(Boolean),
  get supabaseUrl() { return required("SUPABASE_URL"); },
  get supabaseAnonKey() { return required("SUPABASE_ANON_KEY"); },
  get supabaseServiceRoleKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); }
};

export function assertProductionConfig(): void {
  required("SUPABASE_URL");
  required("SUPABASE_ANON_KEY");
  required("SUPABASE_SERVICE_ROLE_KEY");
}
