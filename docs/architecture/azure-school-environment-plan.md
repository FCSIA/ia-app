---
tags: [architecture, azure, procurement, governance, platform]
---

# Azure School Environment Plan

[Home](../index.md)

This is the recommended plan for an Azure environment that Innovation Academy
(IA) owns and that will host the IA App first, then other school projects,
apps, and websites. It covers how to buy Azure, how to structure the
environment so it outlives any one student cohort, and what it will cost.

The migration of this app onto that environment is in a separate document:
[Azure hosting migration for the IA App](azure-hosting-migration.md).

> Prices are Microsoft list (pay-as-you-go) prices for **East US 2**, pulled
> from the Azure Retail Prices API on **2026-10-01**. Prices from a reseller or
> under a district agreement may differ. This is planning guidance, not legal
> or procurement advice. District procurement and legal make the final call.

## Requirements

| Requirement | Detail |
| --- | --- |
| Ownership | The environment belongs to the school, not to a student or volunteer. It must survive graduations and staff turnover. |
| Users | 1,600 students and 150–200 teachers and staff. Plan for **all ~1,800 online at once**. |
| Multi-project | The IA App first; more school apps, sites, and student projects later. |
| Student data | FERPA applies, along with Georgia student data privacy rules and FCS policy. |
| Budget | A public school budget: predictable monthly cost, purchase orders and invoices, no personal credit cards. |
| Operability | Run by a small team: a staff sponsor, district IT, and rotating student developers. |

## Key Facts That Shape the Recommendation

1. **IA is a Fulton County Schools (FCS) school, not a separate legal entity.**
   FCS signs contracts. "School-owned" in practice means *IA controls the
   subscriptions, access, and budget, inside an agreement the district signs.*
2. **FCS already has an enterprise Microsoft relationship.** Every FCS student
   gets Microsoft 365 under the district's Microsoft agreement. FCS runs
   production and test Microsoft tenants and a hybrid Active Directory.
   Students already have `@fcstu.org` Microsoft identities, and staff have
   district identities.
   ([FCS Microsoft 365](https://www.fultonschools.org/all-departments/academics/learning-teaching/instructional-technology/microsoft-365),
   [Ytria FCS case study](https://www.ytria.com/resources/case-studies/customer-case-study-fulton-county-schools))
3. **Azure has no general academic discount for institutions.** Education
   pricing applies mainly to Microsoft 365 licenses. Azure usage costs roughly
   list price whichever channel you use. The real savings come from
   reservations and savings plans, plus partner discounts that the reseller
   negotiates.
4. **Schools cannot use Microsoft's nonprofit Azure grant** (the $2,000/year
   credit). Microsoft excludes schools, colleges, and universities, including
   nonprofit schools, and points them to academic programs instead.
   ([Microsoft Nonprofit FAQ](https://www.microsoft.com/en-us/nonprofits/faq))
5. **Microsoft is moving customers off Enterprise Agreements.** Organizations
   with roughly 2,400 or fewer users can no longer renew an EA after November 1,
   2025. They move to CSP (through a partner) or to the Microsoft Customer
   Agreement for Enterprise (MCA-E).
   ([Trusted Tech Team](https://www.trustedtechteam.com/blogs/microsoft-365/microsoft-ea-to-csp-frequently-asked-questions))
   FCS is large enough that it may keep an EA or EES. What matters is that new
   Azure purchases go through whatever vehicle the district already uses.

## Purchasing Options Evaluated

| # | Option | Who signs and pays | Fit for IA | Verdict |
| --- | --- | --- | --- | --- |
| A | **Subscriptions under the existing FCS Microsoft agreement**: a new IA billing profile or invoice section under the district's MCA-E or CSP billing account, or an IA account under the district EA/EES enrollment | FCS signs. Costs go to IA's cost center through the district's normal Microsoft invoice | Best. No new contract. Uses the district tenant, identities, security baseline, and Microsoft data protection terms already reviewed for FERPA. | **Recommended** |
| B | **CSP through a Georgia cooperative contract reseller**, such as Carahsoft or SHI under the State of Georgia / NASPO ValuePoint cloud solutions contracts | FCS or IA issues a purchase order. The reseller bills monthly | Good. Use it if the district won't add IA under its own agreement but approves the spend. The reseller must qualify FCS for the CSP *education* segment. | **Fallback** |
| C | Microsoft Customer Agreement, bought online directly (azure.com, card or invoice) | Whoever signs up | Poor. Usually ties to a personal or card account, and bypasses district procurement and data protection review. | Prototype only, never student data |
| D | MCA-E negotiated directly with Microsoft | FCS | Built for large commitments. Makes sense only if FCS consolidates district-wide. | District decision, not IA's |
| E | Azure free account ($200 credit, 30 days) | Individual | Useful to test the proof of concept on throwaway data. | POC only |
| F | Azure for Students ($100/yr) / Azure for Students Starter | An individual student | These are personal student benefits, not institutional accounts. They end when the student graduates, and must never hold school data. | Student learning only |
| G | Microsoft nonprofit Azure grant | — | Schools are ineligible. | Not available |
| H | Azure Government | FCS | FERPA doesn't require it. It costs more and offers fewer services. | Not needed |

Georgia cooperative contracts: Carahsoft and SHI hold State of Georgia cloud
solutions contracts that public agencies in Georgia can buy from, Microsoft CSP
included. Some of the listed contract periods ended on **2026-09-15**.
Procurement should confirm which vehicle is current before choosing Option B.
([Carahsoft: State of Georgia Cloud Solutions](https://www.carahsoft.com/buy/slg-contracts/georgia-state-contracts/state-georgia-cloud-solutions-contract-naspo),
[GA DOAS statewide contract index](https://doas.ga.gov/assets/State%20Purchasing/STATEWIDE%20CONTRACTS/STATEWIDE%20CONTRACT%20PORTFOLIO%20INDEX%20-%2010172022.pdf))

EES itself licenses Microsoft 365 and other Education Platform Products,
counted per user, with a 1,000-user minimum. Azure is consumption billing on
top of that.
([Microsoft Learn: EES](https://learn.microsoft.com/en-us/volume-licensing-central/learning/contracting/enrollment-for-education-solutions))

### Recommendation

**Choose Option A.** Ask FCS Technology to create an *Innovation Academy*
management group and subscriptions in the **FCS production Entra tenant**,
billed through the district's existing Microsoft agreement to an IA cost center
with a hard budget. Choose Option B only if the district declines Option A, and
even then keep the subscriptions in the FCS tenant if possible.

Avoid creating a separate "IA-only" Entra tenant unless the district requires
one. A separate tenant cuts the app off from `@fcstu.org` and staff single
sign-on, duplicates security work, and is easily orphaned when its creator
leaves.

### What to Ask the District For

1. One management group, `mg-innovation-academy`, under the district's
   management group tree.
2. Three subscriptions (layout below), billed to IA's cost center.
3. Owner access for **two named IA staff members** (not students) through
   Entra groups. District IT keeps break-glass access.
4. Approval of the Azure services listed in the [migration doc](azure-hosting-migration.md)
   and a US region. This plan uses **East US 2**.
5. One or more app registrations, so the IA App can later offer "Sign in with
   Microsoft" to `@fcstu.org` and staff accounts.
6. A budget alert recipient list and the monthly approved budget amount.
7. Written confirmation that the Microsoft Products and Services Data
   Protection Addendum and the district's FERPA and Georgia student-data
   agreements cover these subscriptions.

## Environment Structure

The design follows a cut-down Azure landing zone: shared pieces once, then one
resource group per app per environment.

```text
FCS tenant (Entra ID)
└── mg-innovation-academy                    ← IA policies + RBAC applied here
    ├── sub-ia-platform        Shared: Front Door, DNS zones, Container Registry,
    │                          Log Analytics workspace, budgets, IaC state
    ├── sub-ia-prod            Production apps with real student data
    │   ├── rg-iaapp-prod
    │   └── rg-<nextapp>-prod
    └── sub-ia-nonprod         Staging, dev, student sandboxes, POCs (no real student data)
        ├── rg-iaapp-staging
        ├── rg-<nextapp>-staging
        └── rg-sandbox-<student-or-team>   ← expiring, budget-capped
```

Three subscriptions keep production student data cleanly apart from
student-developer sandboxes. Each subscription gets its own budget, and a
runaway sandbox can never touch production.

### Shared Platform Services

These are built once and reused by every future app:

| Service | Purpose | Shared how |
| --- | --- | --- |
| Azure Container Apps environment, one per subscription | Runs every containerized app and website (Node, Python, etc.) | Every app is its own container app in the same environment |
| Azure Front Door Standard (1 profile) | TLS, CDN, and custom domains for every school site | One profile covers many domains and routes. Its fixed fee is paid once |
| Azure DNS zones | DNS for school-controlled domains | One zone per domain |
| Azure Container Registry (Basic) | Container images for every app | One registry, one repository per app |
| Log Analytics + Application Insights | Logs, metrics, alerts | One workspace; each app gets its own App Insights resource |
| Key Vault (one per app per environment) | Secrets | Kept separate per app so a breach in one app can't read another's secrets |
| Azure Database for PostgreSQL Flexible Server | Databases | The IA App gets its own server. Small future apps share one non-production server and one production server, with a database each |
| Azure Static Web Apps | Static or Jamstack school websites | Free tier, or Standard at about $9/app/month for custom auth and SLA |
| Microsoft Entra ID | Sign-in for staff, students, and apps | Already owned by FCS |

### Guardrails (Azure Policy at the Management Group)

- Allowed regions: East US 2, with Central US as an optional DR region.
- Required tags: `app`, `env`, `owner`, `costCenter`, `dataClass`
  (`public` / `internal` / `student-pii`).
- Deny public network access on PostgreSQL and storage accounts in
  `sub-ia-prod`, except where an app is explicitly exempted.
- Require diagnostic settings that send logs to the shared Log Analytics
  workspace.
- Deny expensive SKUs (GPU, large VMs, Premium Front Door) in `sub-ia-nonprod`.
- Microsoft Defender for Cloud: foundational CSPM (free) on every
  subscription. Paid Defender plans are optional (see Costs).

### Access Model

| Entra group | Members | Role |
| --- | --- | --- |
| `IA-Azure-Owners` | 2 IA staff members, plus a district IT liaison | Owner on the management group. Reviewed each semester |
| `IA-Azure-Prod-Operators` | Staff sponsor and vetted senior student maintainers | Contributor on `sub-ia-prod` through **PIM just-in-time** activation with approval, if FCS has Entra ID P2. Otherwise a time-boxed assignment reviewed monthly |
| `IA-Azure-Developers` | Student developers using school-issued `@fcstu.org` accounts | Contributor on `sub-ia-nonprod` only |
| `IA-Azure-Readers` | Teachers and admins who need visibility | Reader + Cost Management Reader |
| GitHub Actions workload identity | CI/CD | A federated credential (OIDC, no stored secret) per app per environment, scoped to that app's resource group |

Rules:

- **No personal accounts.** All access uses FCS-issued identities, so access
  ends automatically when a student graduates or a staff member leaves.
- Students under 18 get access only through school accounts and staff
  oversight. Production access is logged and reviewed.
- Anyone who can read production student data must qualify as a FERPA
  "school official" with legitimate educational interest under FCS policy.
- The code repository (GitHub) should also move to a school-owned GitHub
  organization with staff owners, so CI identities and secrets aren't tied to a
  student's personal account.

### Cost Controls

- **Budgets with alerts** at 50%, 80%, and 100% on each subscription. Sandbox
  resource groups also get an auto-shutdown or expiry tag.
- **Reservations** (1-year) for steady production databases, about 40% off
  PostgreSQL compute. Buy one only after 1–2 months of real usage data.
- **Azure savings plan for compute** once container usage has stabilized.
  Confirm current eligibility for Container Apps with the reseller.
- **Dev/Test pricing** for non-production subscriptions, if the district
  agreement supports the Dev/Test offer.
- Monthly cost review by the staff sponsor, using Cost Management grouped by
  the `app` tag.

## Expected Costs

### Fixed Platform Cost (Shared by All Apps)

| Item | Monthly (list) |
| --- | --- |
| Front Door Standard base fee | $35 |
| Container Registry Basic | ~$5 |
| DNS zones (1–3) | ~$1–2 |
| Log Analytics base (pay per GB, see app costs) | $0 |
| Defender for Cloud foundational CSPM | $0 |
| **Platform subtotal** | **~$41/month (~$500/year)** |

### IA App (First Tenant)

The [migration doc](azure-hosting-migration.md#expected-costs) has the full
breakdown, sized for 1,800 concurrent users.

| Environment | Monthly (list) |
| --- | --- |
| Production (no database HA) | ~$590 |
| Production (zone-redundant database HA, recommended) | ~$740 |
| Staging | ~$60 |

### Typical Future Workloads

| Workload type | Typical Azure shape | Rough monthly |
| --- | --- | --- |
| Static school website | Static Web Apps Free/Standard + Front Door route | $0–$10 |
| Small dynamic app (club tool, form, dashboard) | Container App, scale-to-zero, plus a database on the shared PostgreSQL server | $5–$40 |
| Student project / hackathon sandbox | Nonprod resource group with a $25–$50 budget cap and expiry | ≤$50 |
| Another real-time app like the IA App | Its own stack, similar to the IA App | $300–$700 |

### Year-One Budget Request

| Line | Annual |
| --- | --- |
| Platform | ~$500 |
| IA App production (with DB HA) | ~$8,900 |
| IA App staging | ~$720 |
| Future apps and sandbox headroom | ~$1,500 |
| Contingency (15%) | ~$1,750 |
| **Total** | **~$13,400/year** (≈ $1,120/month) |

Expected savings after year one: about $600–$1,200/year once PostgreSQL
reservations and a compute savings plan are in place.

## Rollout Timeline

| Week | Milestone |
| --- | --- |
| 0–2 | Meet FCS Technology: confirm the purchasing vehicle (Option A or B), tenant, region, and data protection coverage. Get budget approval. |
| 2–4 | District creates the management group and subscriptions and assigns Owner groups. IA applies policies, budgets, and the shared platform through Bicep in a school-owned GitHub repo. |
| 4–6 | Stand up IA App staging and run the proof of concept (see the migration doc). |
| 6–10 | Load test, data migration rehearsal, production stand-up, and cutover during a school break. |
| Ongoing | Monthly cost review. Access review each semester. Each new app follows the onboarding checklist below. |

## New App Onboarding Checklist

1. Classify the data (`public` / `internal` / `student-pii`). Apps marked
   `student-pii` need staff sponsor sign-off and a district data privacy check.
2. Create `rg-<app>-staging` and `rg-<app>-prod` from the shared Bicep module.
3. Add a Front Door route and DNS record.
4. Create a Key Vault and an App Insights resource. Connect diagnostics.
5. Set up a GitHub OIDC deploy identity scoped to the app's resource groups.
6. Add the app's budget and alert.
7. Name a staff owner and a student maintainer, and record them in the `owner`
   tag and a README.

## Open Questions for FCS Technology

- Which agreement does FCS use for Azure today (EA/EES, MCA-E, or CSP), and
  can IA have its own billing scope under it?
- Does FCS already have Azure landing-zone policies that IA's management group
  inherits?
- Does FCS have Entra ID P2 (Microsoft 365 A5), which PIM just-in-time access
  needs?
- Can IA app registrations get admin consent for `@fcstu.org` sign-in?
- Which domain should production use (`fcsia.com`, `fcsia.org`, or a
  `fultonschools.org` subdomain), and who controls its DNS?
- Are there district retention periods for chat messages, uploads, and audit
  logs?

## Related

- [Azure hosting migration for the IA App](azure-hosting-migration.md)
- [Azure portability review](azure-portability.md)
- [Deployment options](../reference/deployment-options.md)
