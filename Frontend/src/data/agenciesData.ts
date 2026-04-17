export interface Agency {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  employerCount: number;
  workerCount: number;
}

export const agenciesData: Agency[] = [
  {
    id: 1,
    name: "FWWMC SEELAAN",
    contact: "Operations Desk",
    phone: "+60 3-1111-2222",
    email: "ops@fwwmc.example",
    address: "Kuala Lumpur, Malaysia",
    employerCount: 38,
    workerCount: 124,
  },
  {
    id: 2,
    name: "Global Manpower Services",
    contact: "Aisha Karim",
    phone: "+60 3-2222-3333",
    email: "aisha@globalmanpower.example",
    address: "Shah Alam, Selangor",
    employerCount: 21,
    workerCount: 86,
  },
  {
    id: 3,
    name: "Asia Workforce Solutions",
    contact: "Lim Wei Jian",
    phone: "+60 3-3333-4444",
    email: "lim@asiaworkforce.example",
    address: "Petaling Jaya, Selangor",
    employerCount: 15,
    workerCount: 57,
  },
];
