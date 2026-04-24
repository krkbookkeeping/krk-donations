# Post-MVP Backlog

Anything out-of-scope for the MVP lands here instead of being silently dropped or scope-creeping into Phase N. Each entry gets a one-line description and a rough category. Review this list after MVP ships to pick what's next.

> If you (Ken) want something added during MVP work, the rule is: propose it, and either (a) it replaces something already in scope, or (b) it comes here and waits. This keeps the MVP from stretching.

---

## Currently deferred

### CRM / Donors
- *(none yet)*

### Donations
- Recurring donations & pledges (monthly givers, auto-generated transactions)
- Payment processor live sync (Stripe, Square)

### Reporting
- Monthly summary reports
- Category trend reports (YoY comparisons)
- Advanced analytics dashboards (charts, KPIs)

### Receipting
- WYSIWYG receipt template editor (MVP is plain-text fields with merge tokens)
- Per-donor custom template overrides
- Multi-language receipts (English + French)

### Email / Delivery
- Email receipts directly to donors as PDF attachments (Firebase Trigger Email extension or SendGrid/Postmark with SPF/DKIM)
- Email open / click tracking
- Bulk email — send all yearly receipts in one action

### Access & Ops
- Role-based access control (treasurer vs read-only auditor vs admin)
- Multi-tenant / multi-organization support
- 2FA on admin accounts

### Platform
- Native mobile apps (iOS / Android)
- Offline support for donation entry (service worker + queue)

### Integrations
- Export to accounting software (QuickBooks, Xero)
- Google Workspace SSO
