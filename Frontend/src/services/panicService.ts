import { apiClient } from "./apiClient";

export interface PanicProblemDto {
  ProblemAndActionId: number;
  Title?: string;
  Description?: string;
  MemberName?: string;
  FullName?: string;
  PassportNumber?: string;
  EmployerName?: string;
  Date?: string;
  Time?: string;
  [key: string]: unknown;
}

export async function getLatestPanic(params: { sinceId: number }): Promise<PanicProblemDto[]> {
  const res = await apiClient.get<PanicProblemDto[]>("/Api/Panic/Latest", {
    params: { sinceId: params.sinceId },
  });
  return res.data ?? [];
}
