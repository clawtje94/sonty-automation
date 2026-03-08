# Sonty — Testing Strategy

> Status: Design phase. No live systems connected.
> Last updated: 2026-03-08

---

## Testing Goals

1. Verify each integration connector works correctly in isolation
2. Verify each automation workflow produces the correct outcome end-to-end
3. Catch regressions when workflows or integrations change
4. Ensure no test ever touches real customer data or sends real messages

---

## Test Levels

| Level | Scope | Runs in |
|---|---|---|
| **Unit tests** | Single function / data transform | Local |
| **Integration tests** | One connector against its sandbox API | Local + Staging |
| **Workflow tests** | Full n8n workflow end-to-end | Staging |
| **Regression tests** | Re-run all workflow tests after changes | Staging |
| **Manual QA** | Human verification of key user flows | Staging |

---

## Unit Tests

Location: `tests/unit/`

Coverage targets:

| Module | What to test |
|---|---|
| Field mappers | Ad platform payload → HubSpot contact schema |
| Deduplication logic | Match by email, phone, fallback behavior |
| Business hours validator | Time-based trigger scheduling |
| Amount calculators | Deposit % logic, invoice totals |
| Postgres ETL transforms | Raw API response → normalized schema |

Tools: Python `pytest` or Node.js `jest` (to be confirmed based on implementation language).

---

## Integration Tests

Location: `tests/integration/`

One test file per connector. Each test:
- Uses sandbox/test credentials from `.env.test`
- Creates a resource, reads it back, verifies data, cleans up

| Connector | Test File | Key assertions |
|---|---|---|
| HubSpot | `test_hubspot.py` | Create contact, create deal, update stage, log activity, delete |
| Gripp | `test_gripp.py` | Create quote, fetch quote, create invoice, fetch status |
| Microsoft Bookings | `test_bookings.py` | Create appointment, fetch status, cancel |
| Outlook | `test_outlook.py` | Send email to test mailbox, verify delivery |
| WhatsApp | `test_whatsapp.py` | Send message to test number, verify delivery status |
| Reuzenpanda | `test_reuzenpanda.py` | Fetch product config, generate quote |
| Meta Ads | `test_meta.py` | Fetch lead form submissions (test leads) |
| Google Ads | `test_google.py` | Fetch lead form submissions (test leads) |
| Postgres | `test_postgres.py` | UPSERT lead, UPSERT deal, query funnel_events |

**Integration tests are never run against production credentials.**

---

## Workflow Tests

Location: `tests/workflows/`

Each workflow test simulates an end-to-end scenario by triggering an n8n workflow with a test payload and verifying the outcomes in all affected systems.

### Test Format

```
GIVEN: initial system state (e.g. HubSpot deal in stage X)
WHEN:  trigger fires (e.g. webhook received / timer)
THEN:  expected outcomes in each system
```

### Workflow Test Cases

#### WF-01: Lead Intake
```
GIVEN:  no existing contact for test email
WHEN:   Meta webhook fires with test lead payload
THEN:
  - HubSpot contact created with correct fields
  - HubSpot deal created in stage "New Lead"
  - Postgres leads row created
  - Postgres funnel_event (new_lead) created
  - WF-02 timer scheduled
```

#### WF-01b: Duplicate Lead
```
GIVEN:  contact already exists with same email
WHEN:   second webhook fires with same email
THEN:
  - No new contact created
  - Existing contact updated
  - Duplicate flag logged
```

#### WF-04: First Quote Send — Happy Path
```
GIVEN:  deal in stage "Call Attempt 2"
WHEN:   WF-04 triggers
THEN:
  - Reuzenpanda API called with correct params
  - Quote PDF linked to deal
  - Email sent to test address (not customer)
  - HubSpot deal stage = "First Quote Sent"
  - Postgres funnel_event written
```

#### WF-04b: First Quote Send — Reuzenpanda API Failure
```
GIVEN:  deal in stage "Call Attempt 2"
         Reuzenpanda API returns 500
WHEN:   WF-04 triggers
THEN:
  - No email sent
  - HubSpot task created: "Stuur eerste offerte handmatig"
  - Error logged in n8n
  - No Postgres write for quote_sent event
```

#### WF-09: Deal Won
```
GIVEN:  Gripp quote status = "Accepted"
WHEN:   n8n polls Gripp and detects acceptance
THEN:
  - HubSpot deal stage = "Won"
  - Gripp deposit invoice created
  - Invoice PDF emailed to test address
  - Postgres funnel_event (won) + revenue_event (deposit) written
```

#### WF-12: Post-Installation Wrap-up
```
GIVEN:  Installation appointment marked completed in Bookings
WHEN:   WF-12 triggers
THEN:
  - Gripp final invoice created
  - Invoice emailed to test address
  - Review request queued (24h delay)
  - HubSpot deal stage = "Completed"
  - Postgres funnel_event (completed) + revenue_event (final) written
```

#### Full Pipeline Test (TD-04)
```
GIVEN:  empty system
WHEN:   synthetic lead enters, staff progresses through all stages
THEN:
  - All 14 workflow stages trigger correctly
  - All HubSpot stage transitions occur
  - All Postgres events written in correct order
  - All emails sent to test addresses
  - Final deal state = "Completed"
  - Revenue events match expected amounts
```

---

## Manual QA Checklist

Run before promoting any workflow from staging to production:

**Lead Intake**
- [ ] Lead arrives from test Meta form → appears in HubSpot
- [ ] Duplicate lead → no duplicate contact created

**Call Flow**
- [ ] Call attempt 1 task appears at correct time
- [ ] Call attempt 2 task appears 24h later if no contact

**Quote Flow**
- [ ] First quote email received at test mailbox
- [ ] Email contains correct attachment
- [ ] WhatsApp follow-up received on test number

**Measurement Flow**
- [ ] Booking confirmation email received
- [ ] HubSpot stage updated correctly

**Gripp Flow**
- [ ] Final quote PDF correct
- [ ] Deposit invoice amount = 50% of quote
- [ ] Final invoice created after installation

**Reporting**
- [ ] Postgres rows created for each stage
- [ ] KPI snapshot reflects correct counts
- [ ] Dashboard displays data without errors

---

## Test Data Management

- All test contacts use `@sonty-test.invalid` email domain (non-deliverable, safe)
- All test phone numbers use Dutch test range or a dedicated internal test number
- Test data is cleaned up after each test run via teardown scripts in `tests/fixtures/teardown.py`
- A separate test data seed script lives at `tests/fixtures/seed.py`

---

## Regression Policy

- Any change to a connector or workflow requires re-running its associated tests before deployment
- A full regression suite runs every Monday against staging automatically (once CI/CD is set up)
- If a regression is found in staging, it is fixed before any production deployment proceeds
