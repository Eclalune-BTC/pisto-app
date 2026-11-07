# Features

Every flow below works end to end, from the screen through the API to PostgreSQL. The
[Postman collection](postman/README.md) exercises each endpoint.

| User story | Screens | API |
| --- | --- | --- |
| Create an account, sign in and sign out | `/sign-up`, `/sign-in`, user menu | `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out` |
| Register my business with its currency and time zone | `/business`, `/settings` | `GET/POST /v1/businesses` |
| Dictate or type what happened and review the record the AI assistant drafted before saving it | **Dictar** in the top bar, **Registrar** on the home, `/operate/assistant/review` | `/v1/assistant/status`, `/v1/assistant/interpretations`, `/v1/assistant/transcriptions` |
| See the business at a glance: money available, today's movements, who owes and the next payment | `/operate` (home) | `/v1/reports/money-trend`, `/v1/movements`, `/v1/receivables/debtors`, `/v1/payables/summary` |
| See every sale, purchase, expense and payment in one ledger | `/operate/movements` | `GET /v1/movements` |
| Record a sale with products, payment and credit (stock leaves inventory, the balance becomes a receivable), or a total-only sale; see history, void or correct it | `/operate/sales`, `/operate/sales/new`, `/operate/sales/[saleId]`, `/operate/sales/correct/[saleId]` | `/v1/sales/itemized`, `/v1/sales/form-options`, `/v1/sales`, `/v1/sales/review`, `/v1/sales/:id/void`, `/v1/sales/:id/replace` |
| Register suppliers, record purchases on cash or credit (stock enters inventory), pay suppliers and follow accounts payable | `/operate/suppliers`, `/operate/purchases/new`, `/operate/purchases/[purchaseId]`, `/operate/payables` | `/v1/suppliers`, `/v1/purchases`, `/v1/purchases/:id/payments`, `/v1/purchases/:id/void`, `/v1/payables/summary` |
| Manage categories and products | `/operate/catalog`, `/operate/catalog/categories` | `/v1/catalog/categories`, `/v1/catalog/products` |
| Receive and adjust stock, reverse a movement | `/operate/inventory` | `/v1/inventory/stock`, `/v1/inventory/products/:id/movements`, `/v1/inventory/movements/:id/reverse` |
| Track cash accounts, adjustments and transfers | `/operate/cash` | `/v1/cash/accounts`, `/v1/cash/adjustments`, `/v1/cash/transfers`, `/v1/cash/movements` |
| Record and void paid expenses | `/operate/expenses` | `/v1/expenses` |
| Register customers, charge on credit, collect and reverse payments | `/operate/customers`, `/operate/receivables` | `/v1/customers`, `/v1/receivables`, `/v1/receivable-payments/:id/reverse` |
| See the income statement and the monthly cash flow | `/operate/reports` | `GET /v1/reports/operating`, `GET /v1/reports/cash-flow` |
| See the roles and the people of the business | `/settings` | `GET /v1/businesses/roles`, `GET /v1/businesses/members` |
| See changes from other devices live | Every screen refreshes its data; the top bar only speaks up after a lost connection | `GET /v1/realtime` (WebSocket) |

Billing adapters (Polar, RevenueCat) exist but are disabled by default. Voice dictation works in the
web app; native builds offer typed entry. [The capability matrix](production-capabilities.md)
owns the detailed status.
