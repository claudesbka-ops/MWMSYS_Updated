import { apiClient } from "./apiClient";

export interface ProblemAndActionDto {
  ProblemAndActionId: number;
  Title?: string;
  Description?: string;
  FullName?: string;
  CreatedOn?: string;
  Date?: string;
  Time?: string;
  NoOfComments?: number;
  MemberName?: string;
  PassportNumber?: string;
  EmployerName?: string;
  Status?: boolean;
  IsResolved?: boolean | number | null;
  Lat?: number | string | null;
  Lng?: number | string | null;
  [key: string]: unknown;
}

export interface ProblemsResponse {
  problemList?: ProblemAndActionDto[];
  problemActionList?: ProblemAndActionDto;
  userDetails?: { UserName?: string };
}

export async function getProblems(): Promise<ProblemAndActionDto[]> {
  const res = await apiClient.get<ProblemsResponse>("/Api/ProblemList", {
    params: { Id: 0 },
  });

  return res.data.problemList ?? [];
}

export type ProblemListFilters = {
  status?: "active" | "resolved" | "all";
  type?: "panic" | "issue" | "all";
  q?: string;
  limit?: number;
};

export async function getProblemsFiltered(filters: ProblemListFilters): Promise<ProblemAndActionDto[]> {
  const res = await apiClient.get<ProblemsResponse>("/Api/ProblemList", {
    params: {
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      type: filters.type && filters.type !== "all" ? filters.type : undefined,
      q: filters.q?.trim() ? filters.q.trim() : undefined,
      limit: filters.limit,
    },
  });

  return res.data.problemList ?? [];
}

export async function resolveProblem(id: number): Promise<void> {
  await apiClient.post("/Api/Problems/Resolve", { id });
}
