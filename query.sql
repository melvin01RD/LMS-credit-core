SELECT id, "principalAmount", "paymentFrequency", "termCount"
FROM "Loan"
WHERE "clientId" = (
  SELECT id FROM "Client" WHERE document = '00116100835'
)
AND "principalAmount" IN (10000, 20000)
ORDER BY "principalAmount";
