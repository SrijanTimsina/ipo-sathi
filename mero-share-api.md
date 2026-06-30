# MeroShare External API Documentation

> **Source:** CDSC MeroShare Web Backend  
> **Base URL:** `https://webbackend.cdsc.com.np`  
> **Origin Required:** `https://meroshare.cdsc.com.np`  
> **Note:** All authenticated requests must include the JWT token obtained from the login endpoint in the `Authorization` header (not as a Bearer prefix — sent as a raw token value as returned by the login API).

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Applicable Issues (Open IPOs)](#2-applicable-issues-open-ipos)
3. [IPO Detail](#3-ipo-detail)
4. [Bank Details](#4-bank-details)
5. [Application Report (List)](#5-application-report-list)
6. [Application Detail](#6-application-detail)
7. [Portfolio](#7-portfolio)
8. [Status Reference](#8-status-reference)
9. [TypeScript Types](#9-typescript-types)
10. [Implementation Notes](#10-implementation-notes)

---

## 1. Authentication

Authenticates a Mero Share account user and returns a JWT session token.

**Endpoint:** `POST /api/meroShare/auth/`

**Request Headers:**

```
Content-Type: application/json
Authorization: null
Origin: https://meroshare.cdsc.com.np
```

**Request Body:**

```json
{
  "clientId": 146,
  "username": "01234567",
  "password": "plaintext-password"
}
```

| Field      | Type     | Description                                                                                                                  |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `clientId` | `number` | The Mero Share/depository participant ID. Each Mero Share account provider has a unique ID. Stored in `mero_share_accounts`. |
| `username` | `string` | The MeroShare login username (typically a numeric string).                                                                   |
| `password` | `string` | The account password in plain text.                                                                                          |

**Response — 200 OK:**

The JWT token is returned in the **`Authorization` response header**, not in the body.

```
Authorization: eyJhbGciOiJIUzI1NiJ9.<payload>.<signature>
```

**Response Body:**

```json
{
  "statusCode": 200,
  "passwordPolicyChanged": false,
  "passwordExpired": false,
  "changePassword": false,
  "accountExpired": false,
  "dematExpired": false,
  "message": "Log in successful.",
  "isTransactionPINNotSetBefore": false,
  "isTransactionPINReset": false
}
```

| Field                          | Type      | Description                                              |
| ------------------------------ | --------- | -------------------------------------------------------- |
| `statusCode`                   | `number`  | HTTP-equivalent status code.                             |
| `passwordPolicyChanged`        | `boolean` | Whether password policy has changed.                     |
| `passwordExpired`              | `boolean` | Whether the account password has expired.                |
| `changePassword`               | `boolean` | Whether a password change is required before proceeding. |
| `accountExpired`               | `boolean` | Whether the account is expired.                          |
| `dematExpired`                 | `boolean` | Whether the DEMAT account has expired.                   |
| `message`                      | `string`  | Human-readable login status message.                     |
| `isTransactionPINNotSetBefore` | `boolean` | Whether a transaction PIN has never been set.            |
| `isTransactionPINReset`        | `boolean` | Whether the transaction PIN was reset.                   |

> **Critical Implementation Note:**  
> The JWT token is extracted from the `Authorization` **response header** after login. This token must be stored (in memory or encrypted in DB) and passed as the `Authorization` header on all subsequent requests for that Mero Share account session.

---

## 2. Applicable Issues (Open IPOs)

Fetches the list of IPOs/FPOs currently open and applicable for the authenticated account.

**Endpoint:** `POST /api/meroShare/companyShare/applicableIssue/`

**Request Headers:**

```
Content-Type: application/json
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Request Body:**

```json
{
  "filterFieldParams": [
    { "key": "companyIssue.companyISIN.script", "alias": "Scrip" },
    { "key": "companyIssue.companyISIN.company.name", "alias": "Company Name" },
    {
      "key": "companyIssue.assignedToClient.name",
      "value": "",
      "alias": "Issue Manager"
    }
  ],
  "page": 1,
  "size": 10,
  "searchRoleViewConstants": "VIEW_APPLICABLE_SHARE",
  "filterDateParams": [
    { "key": "minIssueOpenDate", "condition": "", "alias": "", "value": "" },
    { "key": "maxIssueCloseDate", "condition": "", "alias": "", "value": "" }
  ]
}
```

| Field                     | Type     | Description                                                             |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| `filterFieldParams`       | `array`  | Field-level filters. Send as shown — these are fixed structural params. |
| `page`                    | `number` | Page number (1-indexed).                                                |
| `size`                    | `number` | Page size (number of results).                                          |
| `searchRoleViewConstants` | `string` | Fixed value: `"VIEW_APPLICABLE_SHARE"`.                                 |
| `filterDateParams`        | `array`  | Date range filters. Send empty values to retrieve all open issues.      |

**Response — 200 OK:**

```json
{
  "object": [
    {
      "companyShareId": 791,
      "subGroup": "For General Public",
      "scrip": "SARVPIL",
      "companyName": "Sarvottam Paints Industries Ltd.",
      "shareTypeName": "IPO",
      "shareGroupName": "Ordinary Shares",
      "statusName": "CREATE_APPROVE",
      "action": "inProcess",
      "issueOpenDate": "Jun 11, 2026 9:00:00 AM",
      "issueCloseDate": "Jun 16, 2026 5:00:00 PM"
    },

    {
      "companyShareId": 792,
      "subGroup": "For General Public",
      "scrip": "PDB2093",
      "companyName": "6.25% Prime Bank Debenture 2093",
      "shareTypeName": "IPO",
      "shareGroupName": "Debentures",
      "statusName": "CREATE_APPROVE",
      "issueOpenDate": "Jun 30, 2026 9:00:00 AM",
      "issueCloseDate": "Jul 3, 2026 5:00:00 PM"
    }
  ],
  "totalCount": 0
}
```

**Response Object Fields:**

| Field            | Type     | Description                                                                                    |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `companyShareId` | `number` | Unique identifier for this IPO/FPO issue. Used as the ID in subsequent detail and apply calls. |
| `subGroup`       | `string` | Target applicant group (e.g. `"For General Public"`).                                          |
| `scrip`          | `string` | Stock market ticker symbol.                                                                    |
| `companyName`    | `string` | Full legal company name.                                                                       |
| `shareTypeName`  | `string` | Issue type — `"IPO"` or `"FPO"`.                                                               |
| `shareGroupName` | `string` | Share class (e.g. `"Ordinary Shares"`).                                                        |
| `statusName`     | `string` | Current status of the issue from the API.                                                      |
| `action`         | `string` | Action state (e.g. `"inProcess"`).                                                             |
| `issueOpenDate`  | `string` | Human-readable opening date string.                                                            |
| `issueCloseDate` | `string` | Human-readable closing date string.                                                            |

> **Note:** `totalCount` may return `0` even when results are present. Do not rely on `totalCount` to determine if results exist — use `object.length` instead.

---

## 3. IPO Detail

Fetches the full details of a specific open IPO/FPO by its `companyShareId`.

**Endpoint:** `GET /api/meroShare/active/{companyShareId}`

**Request Headers:**

```
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Path Parameters:**

| Parameter        | Type     | Description                                         |
| ---------------- | -------- | --------------------------------------------------- |
| `companyShareId` | `number` | The IPO identifier from the applicable issues list. |

**Response — 200 OK:**

```json
{
  "clientName": "GLOBAL IME CAPITAL LIMITED",
  "companyCode": "202604242",
  "companyName": "Sarvottam Paints Industries Ltd.",
  "companyShareId": 791,
  "maxIssueCloseDate": "2026-06-16T11:15:00Z",
  "maxIssueCloseDateStr": "2026-06-16 05:00 PM",
  "maxUnit": 5000,
  "minIssueOpenDate": "2026-06-11T03:15:00Z",
  "minIssueOpenDateStr": "2026-06-11 09:00 AM",
  "minUnit": 10,
  "multipleOf": 10,
  "prospectusPath": "http://172.16.1.66/prospectus/98ldbrobgr1rjd5dqjn6acftlu25551943391447673.pdf",
  "prospectusRemarks": "public IPO",
  "scrip": "SARVPIL",
  "shareGroupName": "Ordinary Shares",
  "sharePerUnit": 100.0,
  "shareTypeName": "IPO",
  "shareValue": 705500.0,
  "subGroup": "For General Public"
}
```

**Response Fields:**

| Field                  | Type     | Description                                                 |
| ---------------------- | -------- | ----------------------------------------------------------- |
| `clientName`           | `string` | Issue manager / Mero Share account provider name.           |
| `companyCode`          | `string` | Internal company registration code.                         |
| `companyName`          | `string` | Full company name.                                          |
| `companyShareId`       | `number` | IPO identifier (same as path param).                        |
| `maxIssueCloseDate`    | `string` | ISO 8601 UTC close date-time.                               |
| `maxIssueCloseDateStr` | `string` | Human-readable close date-time.                             |
| `maxUnit`              | `number` | Maximum number of units (kitta) applicable per application. |
| `minIssueOpenDate`     | `string` | ISO 8601 UTC open date-time.                                |
| `minIssueOpenDateStr`  | `string` | Human-readable open date-time.                              |
| `minUnit`              | `number` | Minimum number of units required to apply (typically 10).   |
| `multipleOf`           | `number` | Applied units must be a multiple of this value.             |
| `prospectusPath`       | `string` | URL to the IPO prospectus PDF.                              |
| `prospectusRemarks`    | `string` | Short description of the issue type.                        |
| `scrip`                | `string` | Stock ticker symbol.                                        |
| `shareGroupName`       | `string` | Share class name.                                           |
| `sharePerUnit`         | `number` | Face value per share (NPR).                                 |
| `shareTypeName`        | `string` | `"IPO"` or `"FPO"`.                                         |
| `shareValue`           | `number` | Total issue value (NPR).                                    |
| `subGroup`             | `string` | Applicant group.                                            |

---

## 4. Bank Details

Fetches the ASBA-linked bank accounts associated with the authenticated MeroShare account. The result is used to obtain the `id` needed in the portfolio request (`clientCode`) and any apply flow.

**Endpoint:** `GET /api/meroShare/bank/`

**Request Headers:**

```
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Response — 200 OK:**

Returns an array of linked bank objects.

```json
[
  {
    "code": "1901",
    "id": 14,
    "name": "GLOBAL IME BANK LTD."
  }
]
```

**Response Array Item Fields:**

| Field  | Type     | Description                                                                                |
| ------ | -------- | ------------------------------------------------------------------------------------------ |
| `code` | `string` | The bank's internal CDSC branch/bank code.                                                 |
| `id`   | `number` | Unique bank record ID within MeroShare. Used as the `clientCode` in the portfolio request. |
| `name` | `string` | Full display name of the bank.                                                             |

> **Note:** A user may have multiple linked banks. The array will contain one entry per linked bank account.

---

## 5. Application Report (List)

Fetches the paginated list of all IPO/FPO applications made by the authenticated account, along with their high-level statuses.

**Endpoint:** `POST /api/meroShare/applicantForm/active/search/`

**Request Headers:**

```
Content-Type: application/json
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Request Body:**

```json
{
  "filterFieldParams": [
    { "key": "companyShare.companyIssue.companyISIN.script", "alias": "Scrip" },
    {
      "key": "companyShare.companyIssue.companyISIN.company.name",
      "alias": "Company Name"
    }
  ],
  "page": 1,
  "size": 200,
  "searchRoleViewConstants": "VIEW_APPLICANT_FORM_COMPLETE",
  "filterDateParams": [
    { "key": "appliedDate", "condition": "", "alias": "", "value": "" },
    { "key": "appliedDate", "condition": "", "alias": "", "value": "" }
  ]
}
```

| Field                     | Type     | Description                                                             |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| `filterFieldParams`       | `array`  | Field-level filters. Send as shown — fixed structural params.           |
| `page`                    | `number` | Page number (1-indexed).                                                |
| `size`                    | `number` | Page size. Use `200` to retrieve all applications in one call.          |
| `searchRoleViewConstants` | `string` | Fixed value: `"VIEW_APPLICANT_FORM_COMPLETE"`.                          |
| `filterDateParams`        | `array`  | Date range filters on `appliedDate`. Send empty values to retrieve all. |

**Response — 200 OK:**

```json
{
  "object": [
    {
      "companyShareId": 791,
      "subGroup": "For General Public",
      "scrip": "SARVPIL",
      "companyName": "Sarvottam Paints Industries Ltd.",
      "shareTypeName": "IPO",
      "shareGroupName": "Ordinary Shares",
      "statusName": "BLOCKED_APPROVE",
      "applicantFormId": 123456
    },
    {
      "companyShareId": 787,
      "subGroup": "For General Public",
      "scrip": "KAHL",
      "companyName": "Kalanga Hydro Limited",
      "shareTypeName": "IPO",
      "shareGroupName": "Ordinary Shares",
      "statusName": "TRANSACTION_SUCCESS",
      "applicantFormId": 123456
    },
    {
      "companyShareId": 770,
      "subGroup": "For General Public",
      "scrip": "SOPAN",
      "companyName": "Sopan Pharmaceuticals Limited",
      "shareTypeName": "IPO",
      "shareGroupName": "Ordinary Shares",
      "statusName": "BLOCK_FAILED",
      "applicantFormId": 123456
    }
  ],
  "totalCount": 86
}
```

**Response Object Fields:**

| Field             | Type     | Description                                                                                         |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `companyShareId`  | `number` | IPO identifier. Use to fetch IPO detail.                                                            |
| `subGroup`        | `string` | Applicant group.                                                                                    |
| `scrip`           | `string` | Stock ticker.                                                                                       |
| `companyName`     | `string` | Company name.                                                                                       |
| `shareTypeName`   | `string` | `"IPO"` or `"FPO"`.                                                                                 |
| `shareGroupName`  | `string` | Share class.                                                                                        |
| `statusName`      | `string` | High-level application status. See [Status Reference §7.1](#71-application-report-list-statusname). |
| `applicantFormId` | `number` | Unique application ID. Use to fetch the application detail.                                         |

---

## 6. Application Detail

Fetches the full detail and current status of a single IPO application by its `applicantFormId`.

**Endpoint:** `GET /api/meroShare/applicantForm/report/detail/{applicantFormId}`

**Request Headers:**

```
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Path Parameters:**

| Parameter         | Type     | Description                                               |
| ----------------- | -------- | --------------------------------------------------------- |
| `applicantFormId` | `number` | The application form ID from the application report list. |

### 6.1 Status Variant: Amount Blocked (Application Pending)

Conditions: Application submitted. Bank has blocked the funds. Awaiting allotment result.

```json
{
  "accountNumber": "00000000000000",
  "accountTypeName": "SAVING ACCOUNT",
  "action": "",
  "amount": 1000.0,
  "applicantFormId": 123456,
  "appliedDate": "2026-06-12T15:44:25Z",
  "appliedKitta": 10,
  "clientName": "GLOBAL IME BANK LTD.",
  "companyShareId": 791,
  "demat": "1301120000000000",
  "maxIssueCloseDate": "2026-06-16T11:15:00Z",
  "meroShareId": 1000000,
  "meroshareRemark": "Block Amount Status - Amount Blocked",
  "reasonOrRemark": "Block Amount Status - Amount Blocked",
  "registeredBranchName": "Global IME Bank Ltd.-Dulabari Branch",
  "stageName": "BRANCH_BLOCKED_UPLOADED",
  "statusDescription": "BLOCKED",
  "statusName": "Verified",
  "suspectStatusName": "SUSPECT_PENDING"
}
```

### 6.2 Status Variant: Application Rejected (Block Failed)

Conditions: Application submitted but bank blocked amount failed (e.g. insufficient balance). No allotment possible.

```json
{
  "accountNumber": "00000000000000",
  "accountTypeName": "SAVING ACCOUNT",
  "action": "",
  "amount": 1000.0,
  "applicantFormId": 123456,
  "appliedDate": "2026-04-21T10:47:04Z",
  "appliedKitta": 10,
  "clientName": "GLOBAL IME BANK LTD.",
  "companyShareId": 770,
  "demat": "1301120000000000",
  "maxIssueCloseDate": "2026-04-21T11:15:00Z",
  "meroShareId": 1000000,
  "meroshareRemark": "Block Amount Status - Amount Rejected (Insufficient balance)",
  "reason": "Insufficient balance",
  "reasonOrRemark": "Insufficient balance",
  "registeredBranchName": "Global IME Bank Ltd.-Dulabari Branch",
  "stageName": "BRANCH_BLOCKED_UPLOADED",
  "statusDescription": "BLOCK_FAILED",
  "statusName": "Rejected",
  "suspectStatusName": "SUSPECT_PENDING"
}
```

> **Unique field in this variant:** `reason` — populated with the rejection reason (e.g. `"Insufficient balance"`).

### 6.3 Status Variant: Not Allotted (Amount Released)

Conditions: Application was valid, allotment result published, applicant was not selected, blocked amount has been released.

> **Note:** Response not yet captured. Based on the allotted variant structure, expected fields are the same but `receivedKitta` will be `0` or absent, `stageName` will be `"SHARED_RESULT_UPLOADED"`, and `statusName` will differ. To be confirmed and updated with a live sample.

### 6.4 Status Variant: Allotted (Shares Received)

Conditions: Application was valid, allotment result published, applicant was selected, shares credited to DEMAT.

```json
{
  "accountNumber": "00000000000000",
  "accountTypeName": "SAVING ACCOUNT",
  "action": "",
  "amount": 4120.0,
  "applicantFormId": 123456,
  "appliedDate": "2023-12-18T10:32:28Z",
  "appliedKitta": 20,
  "clientName": "GLOBAL IME BANK LTD.",
  "companyShareId": 615,
  "demat": "1301120000000000",
  "maxIssueCloseDate": "2023-12-18T11:15:00Z",
  "meroShareId": 1000000,
  "meroshareRemark": "Block Amount Status - Amount Released",
  "reasonOrRemark": "Block Amount Status - Amount Released",
  "receivedKitta": 20,
  "registeredBranchName": "Global IME Bank Ltd.-Dulabari Branch",
  "remarks": "ASBAHREL1301120000000000",
  "stageName": "SHARED_RESULT_UPLOADED",
  "statusDescription": "TRANSACTION SUCCESS",
  "statusName": "Alloted",
  "suspectStatusName": "SUSPECT_COMPLETED"
}
```

> **Unique field in this variant:** `receivedKitta` — the number of shares actually allotted.

**All Application Detail Fields:**

| Field                  | Type     | Nullable | Description                                                                                                        |
| ---------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `accountNumber`        | `string` | No       | ASBA bank account number.                                                                                          |
| `accountTypeName`      | `string` | No       | Bank account type (e.g. `"SAVING ACCOUNT"`).                                                                       |
| `action`               | `string` | No       | Pending action string (often empty).                                                                               |
| `amount`               | `number` | No       | Amount blocked/applied in NPR.                                                                                     |
| `applicantFormId`      | `number` | No       | Unique application form identifier.                                                                                |
| `appliedDate`          | `string` | No       | ISO 8601 UTC datetime of application submission.                                                                   |
| `appliedKitta`         | `number` | No       | Number of units (shares) applied for.                                                                              |
| `clientName`           | `string` | No       | ASBA bank name.                                                                                                    |
| `companyShareId`       | `number` | No       | IPO identifier.                                                                                                    |
| `demat`                | `string` | No       | DEMAT account number.                                                                                              |
| `maxIssueCloseDate`    | `string` | No       | ISO 8601 UTC IPO close date.                                                                                       |
| `meroShareId`          | `number` | No       | The applicant's internal MeroShare user ID.                                                                        |
| `meroshareRemark`      | `string` | No       | MeroShare system remark on block status.                                                                           |
| `reason`               | `string` | Yes      | Rejection reason. Only present on `BLOCK_FAILED`.                                                                  |
| `reasonOrRemark`       | `string` | No       | Human-readable remark or reason string.                                                                            |
| `receivedKitta`        | `number` | Yes      | Units allotted. Only present when `statusName === "Alloted"`.                                                      |
| `registeredBranchName` | `string` | No       | The registered ASBA bank branch.                                                                                   |
| `remarks`              | `string` | Yes      | Additional remarks. Present on allotted applications.                                                              |
| `stageName`            | `string` | No       | Internal processing stage. See [Status Reference §8.3](#83-stagename-values).                                      |
| `statusDescription`    | `string` | No       | Internal status code string. See [Status Reference §8.2](#82-application-detail-statusname-and-statusdescription). |
| `statusName`           | `string` | No       | Display status name. See [Status Reference §8.2](#82-application-detail-statusname-and-statusdescription).         |
| `suspectStatusName`    | `string` | No       | Fraud/suspect check status.                                                                                        |

### 6.5 Apply IPO

Submits a new application for an open IPO.

**Endpoint:** `POST /api/meroShare/applicantForm/share/apply`

**Request Headers:**

```
Content-Type: application/json
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Request Body:**

```json
{
  "appliedKitta": 10,
  "companyShareId": 791,
  "customerId": 1000000,
  "boid": "01234567",
  "crnNumber": "XXXXXXXX",
  "bankId": 14,
  "accountNumber": "00000000000000",
  "demat": "1301120000000000",
  "accountBranchId": 1145,
  "transactionPIN": "0000",
  "accountTypeId": 1
}
```

> **Note:** The response format is typically a success object if the application is accepted by the CDSC system.

### 6.6 Reapply IPO

Conditions: Application was rejected due to a block failure (e.g. insufficient balance) but the IPO is still open.

**Endpoint:** `POST /api/meroShare/applicantForm/share/reapply/{applicantFormId}`

**Request Headers:**

```
Content-Type: application/json
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Path Parameters:**

| Parameter         | Type     | Description                                               |
| ----------------- | -------- | --------------------------------------------------------- |
| `applicantFormId` | `number` | The application form ID from the application report list. |

**Request Body:**

```json
{
  "appliedKitta": 10,
  "companyShareId": 791,
  "customerId": 1000000,
  "boid": "01234567",
  "crnNumber": "XXXXXXXX",
  "bankId": 11,
  "accountNumber": "00000000000000",
  "demat": "1301120000000000",
  "accountBranchId": 2234,
  "transactionPIN": "0000",
  "accountTypeId": 1
}
```

> **Note:** The response format is currently uncaptured but is expected to be similar to the standard apply response.

---

## 7. Portfolio

Fetches the current share portfolio holdings for a linked Mero Share account.

**Endpoint:** `POST /api/meroShareView/myPortfolio/`

**Request Headers:**

```
Content-Type: application/json
Authorization: <token-from-login-response-header>
Origin: https://meroshare.cdsc.com.np
```

**Request Body:**

```json
{
  "sortBy": "script",
  "demat": ["1301120000000000"],
  "clientCode": "11200",
  "page": 1,
  "size": 200,
  "sortAsc": true
}
```

| Field        | Type       | Description                                                                                                                                         |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sortBy`     | `string`   | Sort field. Use `"script"` to sort alphabetically by ticker.                                                                                        |
| `demat`      | `string[]` | Array of DEMAT account number(s) to fetch the portfolio for.                                                                                        |
| `clientCode` | `string`   | The bank record `id` from the Bank Details response (§4), cast to string. For example, if `GET /api/meroShare/bank/` returns `id: 14`, pass `"14"`. |
| `page`       | `number`   | Page number (1-indexed).                                                                                                                            |
| `size`       | `number`   | Page size. Use `200` to retrieve all holdings in one call.                                                                                          |
| `sortAsc`    | `boolean`  | Sort direction. `true` for ascending.                                                                                                               |

> **Critical:** The `clientCode` value is the numeric `id` field from the Bank Details response (`GET /api/meroShare/bank/`), not the broker `clientId` used in login. Fetch bank details first to obtain this value.

**Response — 200 OK:**

```json
{
  "meroShareMyPortfolio": [
    {
      "currentBalance": 3.0,
      "lastTransactionPrice": "1042.0",
      "previousClosingPrice": "1042.0",
      "script": "NRIC",
      "scriptDesc": "NEPAL RE-INSURANCE COMPANY LIMITED - ORDINARY SHARE",
      "valueAsOfLastTransactionPrice": "3126.00",
      "valueAsOfPreviousClosingPrice": "3126.00",
      "valueOfLastTransPrice": 3126.0,
      "valueOfPrevClosingPrice": 3126.0
    },
    {
      "currentBalance": 1.0,
      "lastTransactionPrice": "1370.0",
      "previousClosingPrice": "1370.0",
      "script": "NRN",
      "scriptDesc": "NRN INFRASTRUCTURE AND DEVELOPMENT LIMITED- ORDINARY SHARE",
      "valueAsOfLastTransactionPrice": "1370.00",
      "valueAsOfPreviousClosingPrice": "1370.00",
      "valueOfLastTransPrice": 1370.0,
      "valueOfPrevClosingPrice": 1370.0
    }
  ],
  "totalItems": 2,
  "totalValueAsOfLastTransactionPrice": "4496.00",
  "totalValueAsOfPreviousClosingPrice": "4496.00",
  "totalValueOfLastTransPrice": 4496.0,
  "totalValueOfPrevClosingPrice": 4496.0
}
```

**Portfolio Item Fields (`meroShareMyPortfolio[]`):**

| Field                           | Type     | Description                                                            |
| ------------------------------- | -------- | ---------------------------------------------------------------------- |
| `currentBalance`                | `number` | Number of shares currently held (kitta).                               |
| `lastTransactionPrice`          | `string` | Price at the last recorded transaction (NPR), as a numeric string.     |
| `previousClosingPrice`          | `string` | Previous day's closing price (NPR), as a numeric string.               |
| `script`                        | `string` | Stock ticker symbol.                                                   |
| `scriptDesc`                    | `string` | Full descriptive name of the security including share class.           |
| `valueAsOfLastTransactionPrice` | `string` | Total holding value at last transaction price (NPR), formatted string. |
| `valueAsOfPreviousClosingPrice` | `string` | Total holding value at previous closing price (NPR), formatted string. |
| `valueOfLastTransPrice`         | `number` | Total holding value at last transaction price (NPR), as a number.      |
| `valueOfPrevClosingPrice`       | `number` | Total holding value at previous closing price (NPR), as a number.      |

**Response Summary Fields:**

| Field                                | Type     | Description                                                            |
| ------------------------------------ | -------- | ---------------------------------------------------------------------- |
| `totalItems`                         | `number` | Total number of distinct securities held.                              |
| `totalValueAsOfLastTransactionPrice` | `string` | Sum of all holdings at last transaction price (NPR), formatted string. |
| `totalValueAsOfPreviousClosingPrice` | `string` | Sum of all holdings at previous closing price (NPR), formatted string. |
| `totalValueOfLastTransPrice`         | `number` | Sum of all holdings at last transaction price (NPR), as a number.      |
| `totalValueOfPrevClosingPrice`       | `number` | Sum of all holdings at previous closing price (NPR), as a number.      |

> **Note:** Price fields are returned in two formats — a formatted `string` (e.g. `"3126.00"`) and a raw `number` (`3126.0`). Use the `number` variants for calculations and the `string` variants for display.

---

## 8. Status Reference

### 8.1 Application Report List — `statusName`

These appear in the application report list response (`object[].statusName`).

| `statusName`          | Meaning                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `BLOCKED_APPROVE`     | Amount successfully blocked in bank. Allotment result pending.                                  |
| `TRANSACTION_SUCCESS` | Allotment result processed. May be allotted or not allotted — check detail for `receivedKitta`. |
| `BLOCK_FAILED`        | Amount block failed (e.g. insufficient balance). Application effectively rejected.              |

### 8.2 Application Detail — `statusName` and `statusDescription`

These appear in the individual application detail response.

| `statusName`        | `statusDescription`     | Meaning                                                     |
| ------------------- | ----------------------- | ----------------------------------------------------------- |
| `"Verified"`        | `"BLOCKED"`             | Amount blocked. Waiting for allotment result.               |
| `"Rejected"`        | `"BLOCK_FAILED"`        | Block failed. Application rejected.                         |
| `"Alloted"`         | `"TRANSACTION SUCCESS"` | Allotted. `receivedKitta` field will be present.            |
| _(to be confirmed)_ | `"TRANSACTION SUCCESS"` | Not allotted. Amount released. `receivedKitta` absent or 0. |

### 8.3 `stageName` Values

| `stageName`               | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `BRANCH_BLOCKED_UPLOADED` | Bank branch has uploaded the block status.        |
| `SHARED_RESULT_UPLOADED`  | Allotment result has been published and uploaded. |

### 8.4 Mapping to Internal `ipo_applications.status` Enum

Use this mapping when persisting or displaying application status in the platform database:

| MeroShare `statusName` (detail) | MeroShare `statusDescription` | Internal `status` Enum Value |
| ------------------------------- | ----------------------------- | ---------------------------- |
| `"Verified"`                    | `"BLOCKED"`                   | `applied`                    |
| `"Rejected"`                    | `"BLOCK_FAILED"`              | `rejected`                   |
| _(not allotted — to confirm)_   | `"TRANSACTION SUCCESS"`       | `not_allotted`               |
| `"Alloted"`                     | `"TRANSACTION SUCCESS"`       | `allotted`                   |

---

## 8. TypeScript Types

```typescript
// ─── Auth ──────────────────────────────────────────────────────────────────

export interface MeroShareLoginRequest {
  clientId: number;
  username: string;
  password: string;
}

export interface MeroShareLoginResponse {
  statusCode: number;
  passwordPolicyChanged: boolean;
  passwordExpired: boolean;
  changePassword: boolean;
  accountExpired: boolean;
  dematExpired: boolean;
  message: string;
  isTransactionPINNotSetBefore: boolean;
  isTransactionPINReset: boolean;
}

// ─── Applicable Issues ─────────────────────────────────────────────────────

export interface MeroShareApplicableIssueItem {
  companyShareId: number;
  subGroup: string;
  scrip: string;
  companyName: string;
  shareTypeName: "IPO" | "FPO";
  shareGroupName: string;
  statusName: string;
  action: string;
  issueOpenDate: string;
  issueCloseDate: string;
}

export interface MeroShareApplicableIssueResponse {
  object: MeroShareApplicableIssueItem[];
  totalCount: number;
}

// ─── IPO Detail ────────────────────────────────────────────────────────────

export interface MeroShareIpoDetail {
  clientName: string;
  companyCode: string;
  companyName: string;
  companyShareId: number;
  maxIssueCloseDate: string;
  maxIssueCloseDateStr: string;
  maxUnit: number;
  minIssueOpenDate: string;
  minIssueOpenDateStr: string;
  minUnit: number;
  multipleOf: number;
  prospectusPath: string;
  prospectusRemarks: string;
  scrip: string;
  shareGroupName: string;
  sharePerUnit: number;
  shareTypeName: "IPO" | "FPO";
  shareValue: number;
  subGroup: string;
}

// ─── Application Report List ────────────────────────────────────────────────

export type MeroShareApplicationListStatus =
  | "BLOCKED_APPROVE"
  | "TRANSACTION_SUCCESS"
  | "BLOCK_FAILED";

export interface MeroShareApplicationListItem {
  companyShareId: number;
  subGroup: string;
  scrip: string;
  companyName: string;
  shareTypeName: "IPO" | "FPO";
  shareGroupName: string;
  statusName: MeroShareApplicationListStatus;
  applicantFormId: number;
}

export interface MeroShareApplicationListResponse {
  object: MeroShareApplicationListItem[];
  totalCount: number;
}

// ─── Application Detail ─────────────────────────────────────────────────────

export type MeroShareApplicationDetailStatusName =
  | "Verified"
  | "Rejected"
  | "Alloted";
// Note: Not-allotted status name to be confirmed from live API

export type MeroShareApplicationDetailStatusDescription =
  | "BLOCKED"
  | "BLOCK_FAILED"
  | "TRANSACTION SUCCESS";

export interface MeroShareApplicationDetail {
  accountNumber: string;
  accountTypeName: string;
  action: string;
  amount: number;
  applicantFormId: number;
  appliedDate: string; // ISO 8601 UTC
  appliedKitta: number;
  clientName: string;
  companyShareId: number;
  demat: string;
  maxIssueCloseDate: string; // ISO 8601 UTC
  meroShareId: number;
  meroshareRemark: string;
  reason?: string; // Present only on BLOCK_FAILED
  reasonOrRemark: string;
  receivedKitta?: number; // Present only when allotted
  registeredBranchName: string;
  remarks?: string; // Present on allotted applications
  stageName: string;
  statusDescription: MeroShareApplicationDetailStatusDescription;
  statusName: MeroShareApplicationDetailStatusName;
  suspectStatusName: string;
}
```

---

## 9. Implementation Notes

### 9.1 Session Management

- After login, **extract the `Authorization` value from the response headers** using `axios`'s `response.headers['authorization']`.
- This token must be stored and passed as-is in the `Authorization` header of all subsequent requests for that Mero Share account.
- The token is a short-lived JWT (approximately 30 minutes based on the `exp` claim in the payload).
- **No cookie-based session is required** for the MeroShare API — the JWT header alone is sufficient for authenticated endpoints.

### 9.2 Required `mero_share_accounts` Schema Update

Based on the auth API, the `clientId` field in `mero_share_accounts` is **mandatory** and must be a `number`, not nullable. Each Mero Share account provider (e.g. Global IME Capital = `146`) has a fixed `clientId`. Update the schema column accordingly:

```
clientId  integer  NOT NULL  -- Broker/DP firm ID, required for MeroShare login
```

### 9.3 Identifying Allotted vs. Not Allotted

Both allotted and not-allotted applications may show `statusName: "TRANSACTION_SUCCESS"` in the **application report list**. To determine the actual result, fetch the **application detail** and check:

- `statusName === "Alloted"` → allotted (`receivedKitta` will be present and > 0)
- `receivedKitta` absent or `0` + `statusDescription === "TRANSACTION SUCCESS"` → not allotted

### 9.4 Endpoints Pending Documentation

The following endpoints are known to exist but their full request/response shapes have not yet been captured:

| Endpoint                        | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| Not-allotted application detail | A live sample where `receivedKitta` is `0` and allotment was not given |
| Apply / Reapply response        | A live sample of the success response when submitting an application   |

> These must be captured before the corresponding backend service methods can be implemented.
