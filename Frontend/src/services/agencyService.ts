import { apiClient } from "./apiClient";

export type AgencyListRow = {
  User_Id: string;
  Agent_Name: string;
  Agent_Organization_Name: string;
  Agent_IC_Passport: string | null;
  Agent_EmailID: string;
  Agent_ContactNumber: string | null;
  Agent_Country: number | null;
  Agent_CountryCode: string | null;
  Created_On: string | null;
};

export async function getAgenciesList(): Promise<AgencyListRow[]> {
  const res = await apiClient.get<AgencyListRow[]>("/Api/Agencies/List");
  return res.data ?? [];
}
