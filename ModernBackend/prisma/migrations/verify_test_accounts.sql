-- Migration to verify all test accounts
-- This updates the Is_Verified flag for all test accounts

UPDATE "Tbl_User" SET "Is_Verified" = true WHERE "User_Id" IN (
  'test_admin',
  'test_worker', 
  'test_employer',
  'test_agent',
  'test_embassy',
  'test_labour'
);

-- Verification query to check the results
SELECT "User_Id", "Email_Id", "Is_Verified" FROM "Tbl_User" 
WHERE "User_Id" IN (
  'test_admin',
  'test_worker', 
  'test_employer',
  'test_agent',
  'test_embassy',
  'test_labour'
);
