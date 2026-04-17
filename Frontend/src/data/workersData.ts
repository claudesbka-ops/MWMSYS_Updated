export interface Worker {
  id: number;
  name: string;
  passportNo: string;
  country: string;
  dob: string;
  maritalStatus: string;
  status: "Active" | "Inactive";
  employer?: string;
  permitExpiry?: string;
  insuranceExpiry?: string;
  phone?: string;
  entryDate?: string;
}

export const workersData: Worker[] = [
  { id: 1, name: "RAM", passportNo: "A12345U8", country: "Nepal", dob: "26/07/1995", maritalStatus: "Single", status: "Active", employer: "ACME Construction SDN BHD", permitExpiry: "15/06/2024", insuranceExpiry: "20/08/2024", phone: "+60 12-111-2222", entryDate: "01/03/2019" },
  { id: 2, name: "test 0806001", passportNo: "0806001", country: "Nepal", dob: "01/08/2021", maritalStatus: "", status: "Active", employer: "DN CLEANING & SERVICES", permitExpiry: "01/02/2023", insuranceExpiry: "01/02/2023", entryDate: "06/08/2021" },
  { id: 3, name: "Milesh test 7_4_2021", passportNo: "123654JKK", country: "Nepal", dob: "11/09/2000", maritalStatus: "", status: "Active", employer: "TRANSPORT RESOURCES SDN BHD", permitExpiry: "10/09/2024", insuranceExpiry: "10/09/2024", entryDate: "04/07/2021" },
  { id: 4, name: "fasdfasdfasdf", passportNo: "123654JKK", country: "Bangladesh", dob: "01/12/2010", maritalStatus: "", status: "Inactive", employer: "ACE MODE SDN BHD", permitExpiry: "01/01/2022", insuranceExpiry: "01/01/2022", entryDate: "15/06/2020" },
  { id: 5, name: "MD JUAHURUL 6_29_2021_2", passportNo: "BQ0410779", country: "Bangladesh", dob: "01/01/1999", maritalStatus: "Married", status: "Active", employer: "WONG BROTHERS' BUILDING CONSTRUCTION SDN BHD", permitExpiry: "29/06/2025", insuranceExpiry: "29/06/2025", entryDate: "29/06/2021" },
  { id: 6, name: "MD JUAHURUL 6_29_2021", passportNo: "BQ0410779", country: "Nepal", dob: "26/07/2000", maritalStatus: "", status: "Active", employer: "AZ EXPRESS RESOURCES SDN BHD", permitExpiry: "15/12/2024", insuranceExpiry: "20/01/2025", entryDate: "29/06/2021" },
  { id: 7, name: "test 0629001", passportNo: "BQ0410779", country: "Nepal", dob: "01/06/2021", maritalStatus: "", status: "Active", employer: "ELECOL SWITCHGEAR SDN BHD", permitExpiry: "01/06/2023", insuranceExpiry: "01/06/2023", entryDate: "29/06/2021" },
  { id: 8, name: "Jamil Hussain", passportNo: "BQ125874", country: "Bangladesh", dob: "03/09/1995", maritalStatus: "Married", status: "Active", employer: "CHOW WING KIN CONSTRUCTION SDN BHD", permitExpiry: "03/09/2025", insuranceExpiry: "03/09/2025", phone: "+60 14-555-6666", entryDate: "10/01/2019" },
  { id: 9, name: "Mehedi Kazi", passportNo: "BQ0884563", country: "Bangladesh", dob: "01/01/1998", maritalStatus: "Single", status: "Active", employer: "SPC INDUSTRIES SDN BHD", permitExpiry: "01/01/2025", insuranceExpiry: "01/04/2025", phone: "+60 17-888-9999", entryDate: "15/03/2018" },
  { id: 10, name: "Milesh Tandukar", passportNo: "N2356781", country: "Nepal", dob: "03/18/1990", maritalStatus: "Married", status: "Active", employer: "ACME Construction SDN BHD", permitExpiry: "18/03/2024", insuranceExpiry: "18/06/2024", phone: "+60 12-345-6789", entryDate: "20/05/2017" },
];

export const employersData = [
  { id: 1, name: "ACME Construction SDN BHD", contact: "Ahmad Razak", phone: "+60 3-1234-5678", email: "ahmad@acme.com.my", address: "Lot 12, Jalan Industri, Shah Alam", workerCount: 2 },
  { id: 2, name: "DN CLEANING & SERVICES", contact: "Diana Ng", phone: "+60 3-2345-6789", email: "diana@dncleaning.com", address: "No. 5, Jalan Pudu, KL", workerCount: 1 },
  { id: 3, name: "TRANSPORT RESOURCES SDN BHD", contact: "Raj Kumar", phone: "+60 3-3456-7890", email: "raj@transport.com", address: "Block A, Pelabuhan Klang", workerCount: 1 },
  { id: 4, name: "ACE MODE SDN BHD", contact: "Lee Wei Ming", phone: "+60 3-4567-8901", email: "lee@acemode.com", address: "Jalan Ipoh, KL", workerCount: 1 },
  { id: 5, name: "WONG BROTHERS' BUILDING CONSTRUCTION SDN BHD", contact: "Wong Ah Kow", phone: "+60 3-5678-9012", email: "wong@wongbros.com", address: "Jalan Gombak, KL", workerCount: 1 },
  { id: 6, name: "AZ EXPRESS RESOURCES SDN BHD", contact: "Azman bin Ismail", phone: "+60 3-6789-0123", email: "azman@azexpress.com", address: "Subang Jaya, Selangor", workerCount: 1 },
  { id: 7, name: "ELECOL SWITCHGEAR SDN BHD", contact: "Chong Siew Lin", phone: "+60 3-7890-1234", email: "chong@elecol.com", address: "Petaling Jaya, Selangor", workerCount: 1 },
  { id: 8, name: "CHOW WING KIN CONSTRUCTION SDN BHD", contact: "Chow Wing Kin", phone: "+60 3-8901-2345", email: "chow@cwk.com", address: "Bukit Jalil, KL", workerCount: 1 },
  { id: 9, name: "SPC INDUSTRIES SDN BHD", contact: "Suresh Pillai", phone: "+60 3-9012-3456", email: "suresh@spc.com", address: "Rawang, Selangor", workerCount: 1 },
  { id: 10, name: "SINOSTEEL EQUIPMENT & ENGINEERING (MALAYSIA) SDN. BHD.", contact: "Zhang Wei", phone: "+60 3-0123-4567", email: "zhang@sinosteel.com.my", address: "Port Klang, Selangor", workerCount: 0 },
];
