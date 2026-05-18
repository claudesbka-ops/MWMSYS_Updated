-- CreateTable
CREATE TABLE "Tbl_Agent" (
    "ID" SERIAL NOT NULL,
    "User_Id" VARCHAR(100) NOT NULL,
    "Agent_Name" VARCHAR(100) NOT NULL,
    "Agent_Organization_Name" VARCHAR(100) NOT NULL,
    "Agent_IC_Passport" VARCHAR(100) NOT NULL,
    "Agent_EmailID" VARCHAR(100) NOT NULL,
    "Agent_Department" INTEGER NOT NULL,
    "Agent_Country" INTEGER NOT NULL,
    "Agent_ContactNumber" VARCHAR(50) NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Agent_CountryCode" VARCHAR(10),

    CONSTRAINT "PK_Tbl_Agent" PRIMARY KEY ("User_Id","Agent_EmailID")
);

-- CreateTable
CREATE TABLE "Tbl_Branch" (
    "ID" SERIAL NOT NULL,
    "Branch_Name" VARCHAR(50) NOT NULL,
    "Branch_ShortName" VARCHAR(10) NOT NULL,
    "Branch_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Branch" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_City" (
    "ID" SERIAL NOT NULL,
    "Country_ID" INTEGER NOT NULL,
    "State_ID" INTEGER NOT NULL,
    "City_Name" VARCHAR(50) NOT NULL,
    "City_ShortName" VARCHAR(10),
    "City_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_City" PRIMARY KEY ("ID","Country_ID","State_ID")
);

-- CreateTable
CREATE TABLE "Tbl_Country" (
    "ID" SERIAL NOT NULL,
    "Country_Name" VARCHAR(50) NOT NULL,
    "Country_ShortName" VARCHAR(10),
    "Country_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Country_Flag" BYTEA,
    "CountryCode" VARCHAR(10),
    "FlagPath" VARCHAR(255)
);

-- CreateTable
CREATE TABLE "Tbl_Department" (
    "ID" SERIAL NOT NULL,
    "Department_Name" VARCHAR(50) NOT NULL,
    "Department_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Department" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Employer" (
    "ID" SERIAL NOT NULL,
    "User_Id" VARCHAR(100) NOT NULL,
    "Employer_Name" VARCHAR(100) NOT NULL,
    "Employer_Address" VARCHAR(500) NOT NULL,
    "Employer_ContactPerson" VARCHAR(100) NOT NULL,
    "Employer_ContactPerson_IC" VARCHAR(50),
    "Employer_ContactPerson_Email" VARCHAR(100),
    "Employer_ContactPerson_Phone" VARCHAR(20),
    "Employer_Position" VARCHAR(100) NOT NULL,
    "Employer_EmailID" VARCHAR(100) NOT NULL,
    "Employer_OfficeNumber" VARCHAR(20),
    "Employer_CompanyPhone" VARCHAR(20),
    "Employer_SSM_ROC_ROB_Number" VARCHAR(100),
    "Employer_SSM_Number" VARCHAR(100),
    "Employer_Sector" INTEGER,
    "Employer_SubSector" INTEGER,
    "Employer_PIC_MobileNumber" VARCHAR(20) NOT NULL,
    "Employer_Description" VARCHAR(500),
    "Employer_HFW" INTEGER,
    "Employer_LFW" INTEGER,
    "Employer_FWC " VARCHAR(500),
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "CountryCode" VARCHAR(10),

    CONSTRAINT "PK_Tbl_Employer" PRIMARY KEY ("User_Id","Employer_EmailID")
);

-- CreateTable
CREATE TABLE "Tbl_Subscription" (
    "id" SERIAL NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "planType" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_Tbl_Subscription" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tbl_Attendance" (
    "id" SERIAL NOT NULL,
    "workerId" VARCHAR(100) NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "photoUrl" VARCHAR(500),

    CONSTRAINT "PK_Tbl_Attendance" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tbl_Leave" (
    "id" SERIAL NOT NULL,
    "workerId" VARCHAR(100) NOT NULL,
    "leaveType" VARCHAR(50) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,

    CONSTRAINT "PK_Tbl_Leave" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tbl_Payroll" (
    "id" SERIAL NOT NULL,
    "workerId" VARCHAR(100) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "voucherUrl" VARCHAR(500),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_Tbl_Payroll" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tbl_EmployerIndividual" (
    "ID" SERIAL NOT NULL,
    "User_Id" VARCHAR(100) NOT NULL,
    "Employer_Name" VARCHAR(100) NOT NULL,
    "Employer_Address" VARCHAR(500) NOT NULL,
    "Employer_ContactPerson" VARCHAR(100) NOT NULL,
    "Employer_EmailID" VARCHAR(100) NOT NULL,
    "CountryCode" VARCHAR(10),
    "Employer_PIC_MobileNumber" VARCHAR(20) NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Tbl_EmployerIndividual" PRIMARY KEY ("User_Id","Employer_EmailID")
);

-- CreateTable
CREATE TABLE "Tbl_Insurance" (
    "ID" SERIAL NOT NULL,
    "Insurance_Name" VARCHAR(50) NOT NULL,
    "Insurance_ShortName" VARCHAR(10) NOT NULL,
    "Insurance_Nationality" INTEGER NOT NULL,
    "Insurance_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Insurance" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_MaritalStatus" (
    "ID" SERIAL NOT NULL,
    "Marital_Status" VARCHAR(50) NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_MaritalStatus" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Menu_Details" (
    "ID" SERIAL NOT NULL,
    "PARENT_ID" INTEGER,
    "PAGE_NAME" VARCHAR(50),
    "PAGE_URL" VARCHAR(50),
    "Display_Priority" INTEGER,

    CONSTRAINT "PK_Tbl_Menu_Details" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_ProbSol" (
    "ID" SERIAL NOT NULL,
    "Prob_ID" VARCHAR(50),
    "Type" VARCHAR(50) NOT NULL,
    "Description" VARCHAR(500) NOT NULL,
    "ProbStatus" VARCHAR(50),
    "Updated_By" VARCHAR(50),
    "Updated_On" TIMESTAMP(3),
    "Title" VARCHAR(200),
    "Document" BYTEA,
    "worker_ID" VARCHAR(50),
    "DocumentPath" VARCHAR(500),
    "Current_Location" VARCHAR(250),
    "Company_Name" VARCHAR(250),
    "IsResolved" BOOLEAN DEFAULT false,
    "Lat" DECIMAL(10,7),
    "Lng" DECIMAL(10,7),

    CONSTRAINT "PK_ProbSol" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Rights_Master" (
    "ID" SERIAL NOT NULL,
    "Role_ID" INTEGER,
    "Menu_ID" INTEGER,
    "Status" BOOLEAN,
    "ISDefault" BOOLEAN,
    "UpdatedBy" VARCHAR(20),
    "UpdatedOn" TIMESTAMP(3),

    CONSTRAINT "PK_tbl_Rights_Master" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Role" (
    "ID" SERIAL NOT NULL,
    "Role_Name" VARCHAR(50) NOT NULL,
    "Role_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Role" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Sector" (
    "ID" SERIAL NOT NULL,
    "Sector_Name" VARCHAR(50) NOT NULL,
    "Sector_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Tbl_Sector" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_SourceCountry_Insurance" (
    "ID" SERIAL NOT NULL,
    "SC_Insurance_Name" VARCHAR(50) NOT NULL,
    "SC_Insurance_ShortName" VARCHAR(50) NOT NULL,
    "SC_Insurance_Nationality" INTEGER NOT NULL,
    "SC_Insurance_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_SourceCountry_Insurance" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_State" (
    "ID" SERIAL NOT NULL,
    "Country_ID" INTEGER NOT NULL,
    "State_Name" VARCHAR(50) NOT NULL,
    "State_ShortName" VARCHAR(10),
    "State_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_State" PRIMARY KEY ("ID","Country_ID")
);

-- CreateTable
CREATE TABLE "Tbl_Status" (
    "ID" SERIAL NOT NULL,
    "Status" VARCHAR(50) NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Status" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_SubSector" (
    "ID" SERIAL NOT NULL,
    "Sector_ID" INTEGER NOT NULL,
    "SubSector_Name" VARCHAR(50) NOT NULL,
    "SubSector_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Tbl_SubSector" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_Title" (
    "ID" SERIAL NOT NULL,
    "Title_Name" VARCHAR(50) NOT NULL,
    "Title_Status" INTEGER NOT NULL,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),

    CONSTRAINT "PK_Title" PRIMARY KEY ("ID")
);

-- CreateTable
CREATE TABLE "Tbl_User" (
    "ID" SERIAL NOT NULL,
    "User_Id" VARCHAR(100) NOT NULL,
    "Email_Id" VARCHAR(100) NOT NULL,
    "Login_Pwd" VARCHAR(50),
    "User_Status" INTEGER,
    "User_Role" INTEGER,
    "User_Title" INTEGER,
    "User_Branch" INTEGER,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "User_Name" VARCHAR(100),
    "Activated_By" VARCHAR(50),
    "Activated_On" TIMESTAMP(3),
    "Password_Changed" INTEGER,
    "Password_On" TIMESTAMP(3),
    "Is_Verified" BOOLEAN DEFAULT false,

    CONSTRAINT "PK_Tbl_User" PRIMARY KEY ("User_Id","Email_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_Attachments" (
    "Id" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Passport_Copy_Filename" VARCHAR(50),
    "Passport_Copy" TEXT,
    "Permit_Copy_Filename" VARCHAR(50),
    "Permit_Copy" TEXT,
    "Demand_Letter_Filename" VARCHAR(50),
    "Demand_Letter" TEXT,
    "Employment_Contract_Filename" VARCHAR(50),
    "Employment_Contract" TEXT,
    "Insurance_Policy_Filename" VARCHAR(50),
    "Insurance_Policy" TEXT,
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Ai_Extraction_Status" VARCHAR(20),
    "Ai_Extracted_Data" JSONB,
    "Ai_Confidence_Scores" JSONB,
    "Ai_Confidence_Overall" INTEGER,
    "Ai_Raw_Response" TEXT,
    "Ai_Extraction_Error" TEXT,
    "Ai_Extracted_At" TIMESTAMP(3),
    "Worker_Confirmed_At" TIMESTAMP(3),
    "Worker_Corrected_Data" JSONB,

    CONSTRAINT "PK_Tbl_Worker_Attachments" PRIMARY KEY ("Worker_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_EmployerInfo" (
    "id" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "SOC_ROC_ROC_No" VARCHAR(50),
    "Employer_Name" VARCHAR(50),
    "Employer_Address" VARCHAR(100),
    "Sector" INTEGER,
    "Sub_Sector" INTEGER,
    "Telephone_No" VARCHAR(20),
    "Contact_Person" VARCHAR(20),
    "Contact_Person_IC_No" VARCHAR(20),
    "Position" VARCHAR(20),
    "Hp_Number" VARCHAR(50),
    "Email" VARCHAR(50),
    "Contract_Expiry_Date" TIMESTAMP(3),
    "Contract_issue_Date" TIMESTAMP(3),
    "Employment_Description" VARCHAR(500),
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "TelephonenoCC" VARCHAR(10),

    CONSTRAINT "PK_Tbl_Worker_EmployerInfo" PRIMARY KEY ("Worker_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_PermitInsurance" (
    "Id" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Permit_Issue_Date" TIMESTAMP(3),
    "Permit_Expire_Date" TIMESTAMP(3),
    "Permit_Issue_Place" VARCHAR(100),
    "Insurance_Policy_Number" VARCHAR(20),
    "Source_Country_Insurance" VARCHAR(20),
    "Malaysia_Insurance" VARCHAR(20),
    "SOSCO_Number" VARCHAR(20),
    "Relationship_Two" VARCHAR(20),
    "Spouse_Name" VARCHAR(20),
    "Legal_Beneficiary_Two" VARCHAR(50),
    "Contact_Number_of_Spouse" VARCHAR(20),
    "Contact_Number_Two" VARCHAR(20),
    "Legal_Beneficiary_One" VARCHAR(50),
    "Contact_Number_One" VARCHAR(20),
    "Relationship_One" VARCHAR(50),
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Spouse_Contact_No_CC" VARCHAR(10),
    "Contact_No_Two_CC" VARCHAR(10),
    "Contact_No_One_CC" VARCHAR(10),

    CONSTRAINT "PK_Tbl_Worker_PermitInsurance" PRIMARY KEY ("Worker_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_PersonalInfo" (
    "ID" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Name" VARCHAR(100),
    "Passport_Number" VARCHAR(20),
    "Passport_Issue_Date" TIMESTAMP(3),
    "Passport_Expire_Date" TIMESTAMP(3),
    "Address" VARCHAR(250),
    "District" VARCHAR(50),
    "City" INTEGER,
    "Nationality" INTEGER,
    "State" INTEGER,
    "Gender" VARCHAR(10),
    "Date_Of_Birth" TIMESTAMP(3),
    "Contact_Number" VARCHAR(20),
    "Marital_Status" INTEGER,
    "Highest_Education" VARCHAR(20),
    "Email_Id" VARCHAR(50),
    "Mother_Name" VARCHAR(20),
    "Father_Name" VARCHAR(20),
    "Branch" INTEGER,
    "Photo" TEXT,
    "PhotoName" VARCHAR(50),
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Employer_Id" VARCHAR(20),
    "Contact_Number_Country_Code" VARCHAR(20),

    CONSTRAINT "PK_Tbl_Worker_PersonalInfo" PRIMARY KEY ("Worker_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_RecruitAgent" (
    "Id" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Malaysian_Reqruitment_Agency" VARCHAR(50),
    "Source_Country_Requirtment_Agency" VARCHAR(50),
    "License_No_M" VARCHAR(50),
    "License_NO_S" VARCHAR(50),
    "Address_M" VARCHAR(250),
    "Address_S" VARCHAR(250),
    "Email_Address_M" VARCHAR(50),
    "Email_Address_S" VARCHAR(50),
    "Contact_Person_M" VARCHAR(20),
    "Contact_Person_S" VARCHAR(20),
    "Contact_Number_M" VARCHAR(20),
    "Contact_Number_S" VARCHAR(20),
    "Website_M" VARCHAR(250),
    "Website_S" VARCHAR(250),
    "Created_By" VARCHAR(50),
    "Created_On" TIMESTAMP(3),
    "Contact_No_S_CC" VARCHAR(10),
    "Contact_N0_M_CC" VARCHAR(10),

    CONSTRAINT "PK_Tbl_Worker_Recruit_Agent" PRIMARY KEY ("Worker_Id")
);

-- CreateTable
CREATE TABLE "Tbl_Attestation" (
    "AttestationId" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Passport_Number" VARCHAR(20),
    "DocumentType" VARCHAR(50),
    "DocumentPath" VARCHAR(500),
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Submitted',
    "AdminRemarks" VARCHAR(500),
    "Created_On" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "Updated_On" TIMESTAMP(3),

    CONSTRAINT "PK_Tbl_Attestation" PRIMARY KEY ("AttestationId")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_Location" (
    "workerId" VARCHAR(100) NOT NULL,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "accuracy" DECIMAL(10,2),
    "updatedOn" TIMESTAMP(3),

    CONSTRAINT "PK_Tbl_Worker_Location" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "Tbl_Agency_Employer_Link" (
    "id" SERIAL NOT NULL,
    "agencyId" VARCHAR(100) NOT NULL,
    "employerId" VARCHAR(100) NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(100),

    CONSTRAINT "PK_Tbl_Agency_Employer_Link" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tbl_SalaryDispute" (
    "Id" SERIAL NOT NULL,
    "Worker_Id" VARCHAR(100) NOT NULL,
    "Employer_Id" VARCHAR(100) NOT NULL,
    "Dispute_Month" VARCHAR(20) NOT NULL,
    "Expected_Amount" DECIMAL(10,2) NOT NULL,
    "Received_Amount" DECIMAL(10,2) NOT NULL,
    "Description" VARCHAR(1000) NOT NULL,
    "Proof_File_Path" VARCHAR(500),
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "Employer_Comment" VARCHAR(500),
    "Submitted_At" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Reviewed_At" TIMESTAMP(3),
    "Reviewed_By" VARCHAR(100),

    CONSTRAINT "PK_Tbl_SalaryDispute" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Tbl_UserOtp" (
    "Id" SERIAL NOT NULL,
    "User_Id" VARCHAR(100) NOT NULL,
    "Otp_Code" VARCHAR(6) NOT NULL,
    "Otp_Type" VARCHAR(20) NOT NULL,
    "Created_At" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Expires_At" TIMESTAMP(3) NOT NULL,
    "Is_Used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_Tbl_UserOtp" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Tbl_Worker_EmployerLink" (
    "id" SERIAL NOT NULL,
    "workerId" VARCHAR(100) NOT NULL,
    "employerId" VARCHAR(100) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "createdBy" VARCHAR(100),

    CONSTRAINT "PK_Tbl_Worker_EmployerLink" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NonClusteredIndex_20250122_133511" ON "Tbl_Country"("ID");

-- CreateIndex
CREATE UNIQUE INDEX "UX_Tbl_Agency_Employer_Link_agency_employer" ON "Tbl_Agency_Employer_Link"("agencyId", "employerId");

-- CreateIndex
CREATE INDEX "IX_Tbl_SalaryDispute_Worker_Id" ON "Tbl_SalaryDispute"("Worker_Id");

-- CreateIndex
CREATE INDEX "IX_Tbl_SalaryDispute_Employer_Id" ON "Tbl_SalaryDispute"("Employer_Id");

-- CreateIndex
CREATE INDEX "IX_Tbl_SalaryDispute_Status" ON "Tbl_SalaryDispute"("Status");

-- CreateIndex
CREATE INDEX "IX_Tbl_UserOtp_user_type" ON "Tbl_UserOtp"("User_Id", "Otp_Type");

-- CreateIndex
CREATE INDEX "IX_Tbl_UserOtp_expires" ON "Tbl_UserOtp"("Expires_At");

-- CreateIndex
CREATE INDEX "IX_Tbl_Worker_EmployerLink_workerId" ON "Tbl_Worker_EmployerLink"("workerId");

-- CreateIndex
CREATE INDEX "IX_Tbl_Worker_EmployerLink_employerId" ON "Tbl_Worker_EmployerLink"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "UX_Tbl_Worker_EmployerLink_w_e_s" ON "Tbl_Worker_EmployerLink"("workerId", "employerId", "startDate");
