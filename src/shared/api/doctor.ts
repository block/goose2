import { invoke } from "@tauri-apps/api/core";

export interface DoctorCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fixUrl: string | null;
  fixCommand: string | null;
  path: string | null;
  bridgePath: string | null;
  rawOutput: string | null;
}

export interface DoctorReport {
  checks: DoctorCheck[];
}

export async function runDoctor(): Promise<DoctorReport> {
  return invoke("run_doctor");
}

export async function runDoctorFix(command: string): Promise<void> {
  return invoke("run_doctor_fix", { command });
}
