# Research Report: Google SSO and Social Authentication for ExamIQ

## Research Summary

**Research Question:** What authentication methods should ExamIQ implement to simplify student/teacher registration and login for Indian CBSE/ICSE schools (Class 7-12)?

**Methodology:** Multi-source web research across Google's developer documentation, Indian EdTech industry data, DPDP Act legal analysis, authentication library comparisons, and pricing/cost analysis from multiple credible sources.

**Key Constraints:** ExamIQ is a FastAPI + React SPA with existing email/password auth, JWT tokens, workspace tenancy model, and class join code infrastructure. Users include minors (Class 7 = age ~12).

---

## 1. Google Workspace for Education in India: Adoption Data

### Quantitative Findings

| Metric | Value | Source |
|--------|-------|--------|
| Google-CBSE partnership schools | 22,000 schools | Google/CBSE announcement |
| Teachers trained by Google in India | 1,000,000+ | Google Education India |
| Total CBSE/ICSE schools in India | ~1,470,000 | UDISE+ data |
| Google Workspace global reach | 170M+ students/educators, 230 countries | Google for Education |
| India rank in Google Classroom adoption | Top 7 globally | TechCrunch / Google |
| Indian teachers planning to use Google tools regularly | 76% (surveyed across 3 states) | Google India survey |
| India rank in Gemini for learning usage | Highest globally | Google VP for Education |

### Assessment

Google Workspace for Education has **significant but not universal** penetration in Indian schools. The 22,000-school CBSE partnership covers roughly 1.5% of all Indian schools, but these tend to be urban, private, English-medium schools -- precisely ExamIQ's target demographic for CBSE/ICSE Class 7-12. The 76% figure for teachers planning continued Google tool usage is encouraging.

**Critical insight:** Not all students in Google Workspace schools have individual Google accounts. Many schools provide shared devices or lab-based access. However, the trend is toward individual accounts, especially in private CBSE/ICSE schools in Tier 1 and Tier 2 cities.

**Estimated coverage for ExamIQ's target market (private CBSE/ICSE schools, Class 7-12):** Roughly 30-50% of target schools likely have Google Workspace for Education. This percentage is higher in metropolitan areas and top-tier private schools.

### Google Classroom Roster API

Google provides a Classroom API with roster import capabilities:
- `courses.list` to enumerate courses
- `students.list` and `teachers.list` to retrieve roster data
- Scopes: `classroom.courses.readonly`, `classroom.rosters.readonly`, `classroom.profile.emails`
- Push notifications via `registrations.create()` for real-time roster sync
- OneRoster-compliant SIS integration is available but requires Google Workspace admin approval

**Verdict on roster sync:** This is a P3 feature. It requires schools to have Google Workspace admin cooperation, OAuth verification for restricted scopes, and significant development effort. Not worth implementing until ExamIQ has 50+ school deployments.

---

## 2. OAuth Implementation for FastAPI

### Library Comparison

| Library | Pros | Cons | Recommendation |
|---------|------|------|----------------|
| **Authlib** | Comprehensive, well-documented, native FastAPI/Starlette support, handles OpenID Connect discovery automatically, async via httpx | Requires SessionMiddleware for state management | **PRIMARY RECOMMENDATION** |
| **httpx-oauth** | Pure-async, lightweight, designed for modern async Python | Less documentation, narrower feature set | Good alternative |
| **python-social-auth** | Mature, supports many providers | Django-centric, sync-first design, awkward with FastAPI | Not recommended |
| **fastapi-users** | Complete user management (registration, password reset, OAuth) | Opinionated, may conflict with ExamIQ's existing user model | Not recommended (ExamIQ already has custom user management) |

**Recommendation: Authlib** -- It is the most mature, best-documented library for FastAPI OAuth. ExamIQ already has `httpx` in its requirements, which Authlib uses for async requests. The Starlette OAuth Client integration maps directly to FastAPI.

### Implementation Pattern: Authorization Code Flow with Authlib

The implementation consists of three parts:

**Backend (FastAPI):**

1. Configure Authlib OAuth client with Google's OpenID Connect discovery URL
2. Login redirect route: `GET /api/auth/google/login` redirects browser to Google
3. Callback route: `GET /api/auth/google/callback` receives the authorization code, exchanges it for tokens, extracts user info from the `id_token`
4. Find-or-create user logic: Look up user by email, auto-register if new, then issue ExamIQ JWT

**User Exists vs New User (Auto-Register) Pattern:**

```
Google callback returns {email, name, picture, hd}
  -> SELECT user WHERE email = google_email
  -> IF exists: issue ExamIQ JWT (login)
  -> IF NOT exists: create User + StudentProfile/TeacherProfile, issue ExamIQ JWT (register)
```

**Role mapping strategy:**
- If `hd` claim is present (Google Workspace domain) and matches a known school domain registered in ExamIQ, the user could be auto-assigned a role based on domain configuration
- Otherwise, a role selection step is needed during first-time OAuth registration (student vs teacher)
- For the join-via-class-code flow: if the user arrives via `/join/{code}`, auto-assign "student" role

**Detecting Google Workspace for Education accounts:**
- The `hd` (hosted domain) claim in the Google ID token indicates the user belongs to a Google Workspace organization
- The `hd` claim contains the domain (e.g., `school.edu.in`)
- You CANNOT definitively detect if it is an "Education" edition versus a Business edition from the token alone
- However, the presence of `hd` combined with a `.edu` or `.ac.in` domain is a strong signal

### Dependencies to Add

```
authlib>=1.3.0
itsdangerous>=2.1.0  # for SessionMiddleware secret key handling
```

Note: `httpx` is already in `requirements.txt`.

---

## 3. Microsoft SSO (Azure AD for Education)

### India Adoption Assessment

Microsoft 365 for Education has **significantly lower adoption** in Indian schools compared to Google Workspace. Research findings:

- No equivalent of the CBSE partnership exists for Microsoft in India
- Indian schools overwhelmingly prefer Google Workspace due to free tier, simpler admin, and mobile-first design
- Microsoft 365 Education is more prevalent in universities and higher education, less so in K-12
- Some premium private schools (DPS, Ryan International) use Microsoft, but these are a minority

### Technical Implementation

- **MSAL Python** (`pip install msal`) supports OAuth2/OpenID Connect for Azure AD
- Azure AD B2C provides a consumer identity platform, but is overkill for school SSO
- Microsoft Entra ID (formerly Azure AD) supports education tenants with School Data Sync (SDS) for roster management

### Verdict

**Not worth implementing in Phase 1.** Microsoft SSO should be a P2 or P3 feature, implemented only after Google SSO is live and specific school partners request it. The implementation effort is similar to Google OAuth (~3 days), but the user coverage in Indian K-12 is much lower.

---

## 4. Other Auth Methods for India

### Phone OTP (Already in FR-005 as P2)

| Provider | Cost per SMS | Python SDK | Notes |
|----------|-------------|------------|-------|
| **MSG91** | ~Rs 0.25/SMS (~$0.003) | `msg91-otp` PyPI package | India-preferred, DLT registered, WhatsApp OTP support |
| **Twilio** | ~Rs 0.50/SMS (~$0.006) | `twilio` PyPI package | Global, more expensive in India |

Phone OTP is the **most universal** authentication method for India. Every parent has a phone number. The `msg91-otp` Python package provides send, verify, and resend OTP functionality. DLT (Distributed Ledger Technology) registration with Indian telecom authorities is required for transactional SMS.

**Verdict:** Phone OTP is important for India but is correctly placed as P2 in FR-003. It requires SMS gateway setup, DLT registration, and ongoing per-SMS costs. Google SSO has zero marginal cost and should come first for the tech-savvy school segment.

### DigiLocker Integration

DigiLocker is India's government digital document platform. It supports:
- Aadhaar-based OTP verification for registration
- Digital document storage (mark sheets, certificates)
- NAD (National Academic Depository) for academic records

**Verdict:** DigiLocker is useful for **document verification** (verifying student identity, academic records) but is NOT suitable as a primary authentication method for ExamIQ. It requires Aadhaar, which raises privacy concerns for minors. Best treated as a future enhancement for verified academic credentials, not login.

### UDISE+ Integration

UDISE+ is the government's school data management platform. It assigns unique school IDs and tracks student enrollment nationally.

**Verdict:** UDISE+ data could be useful for school onboarding (verify school identity, import school metadata), but it does not provide student-level authentication. Not relevant for SSO.

### Aadhaar-Based Verification

**Legal restriction for minors:** The DPDP Act 2023 and DPDP Rules 2025 impose strict requirements for processing children's data. Using Aadhaar for minor authentication would require verifiable parental consent and raises significant compliance complexity.

**Verdict:** Do not implement Aadhaar-based auth. The legal and compliance burden is too high for a startup.

---

## 5. Implementation Simplification: Build vs Buy

### Managed Auth Providers (Clerk / Auth0 / Supabase Auth)

| Provider | Free Tier | Cost at 50K MAU | FastAPI Support | Social + Phone OTP | Verdict |
|----------|-----------|-----------------|-----------------|--------------------|---------|
| **Clerk** | 10,000 MAU | ~$800/mo | Yes (Python SDK, JWT middleware) | Google, Microsoft, Phone | Good DX, expensive at scale |
| **Auth0** | 7,500 MAU | ~$500+/mo | Yes (MSAL compatible) | Google, Microsoft, Phone | Enterprise overkill |
| **Supabase Auth** | 50,000 MAU | ~$25/mo | Limited (no native FastAPI SDK) | Google, Microsoft, Phone | Cheapest, but requires Supabase ecosystem |
| **Custom (Authlib)** | Unlimited | $0 | Native | Build each provider | Most control, moderate effort |

### Analysis for ExamIQ

ExamIQ already has a **fully functional custom auth system** (email/password, JWT tokens, workspace context, role-based access). The question is whether to:

**Option A: Adopt a managed provider (Clerk/Auth0)**
- Pros: Phone OTP built-in, social login pre-built, less custom code
- Cons: Requires **replacing** the entire auth system (JWT structure, workspace tokens, role mapping). ExamIQ's JWT tokens embed `workspace_id` and `workspace_role` -- no managed provider supports this out of the box. Migration cost is 2-3 weeks minimum. Vendor lock-in. Ongoing cost at scale.

**Option B: Extend custom auth with Authlib (add Google OAuth alongside existing email/password)**
- Pros: Zero migration risk, preserves existing JWT/workspace logic, zero ongoing cost, full control
- Cons: Each new provider (Google, Microsoft, Phone OTP) requires custom implementation (~2-3 days each)

**Recommendation: Option B (extend custom auth).** ExamIQ's auth system is already production-ready with workspace-aware JWT tokens. Adopting Clerk or Auth0 would require a complete auth rewrite. The custom Authlib approach adds Google SSO in ~2-3 days of development and costs $0.

### The 80% Coverage Path

For Indian schools (CBSE/ICSE, Class 7-12), the following covers approximately 80% of users:

1. **Email + password** (already implemented) -- covers all users
2. **Google SSO** (add with Authlib) -- covers schools with Google Workspace, tech-savvy users
3. **Class join codes** (already in FR-003 plan) -- simplifies enrollment regardless of auth method

Adding phone OTP later as a P2 fills the remaining gap for non-email, non-Google users.

---

## 6. Security and Privacy for Minors

### DPDP Act 2023 + DPDP Rules 2025 -- Critical Compliance Requirements

| Requirement | Details | ExamIQ Impact |
|-------------|---------|---------------|
| **Child definition** | Anyone under 18 years | All Class 7-12 students (ages ~12-17) are "children" |
| **Verifiable parental consent** | Must verify identity of parent/guardian before processing child's data | Required before ANY data collection, including Google SSO |
| **Consent mechanism** | Government-backed verification (DigiLocker, OTP to parent phone) or document check | Need parent email/phone during registration |
| **Prohibited activities** | Tracking, behavioral monitoring, targeted advertising of children | ExamIQ's learning analytics must be framed as educational, not behavioral |
| **Penalties** | Up to INR 250 crore per contravention | Significant financial risk |
| **Applies to** | Both for-profit and non-profit educational institutions | ExamIQ is covered |

### Google OAuth and Minors -- Key Findings

**COPPA (US) restriction:** Google's policy states that apps "directed primarily at children" should NOT use Google Sign-In. However, ExamIQ is an **education platform used by both teachers and students**, not a child-directed app. This distinction matters.

**Google Workspace for Education exception:** For students with school-managed Google Workspace accounts:
- The school acts as the consenting party under COPPA
- Google Workspace admins can configure third-party app access for under-18 users
- There is an auto-allow setting for apps that only request basic Sign-in with Google information (name, email, profile picture)
- If ExamIQ requests only `openid email profile` scopes, many schools can auto-approve it without per-app admin configuration

**DPDP Act compliance for Google SSO:**
- Google SSO itself collects minimal data (email, name, profile picture)
- ExamIQ must still obtain verifiable parental consent for the student account, regardless of how they authenticate
- **Recommended approach:** Require parent email or phone during registration. Send OTP or verification link to parent. Parent confirms consent. Then allow the student to use Google SSO for subsequent logins.

### Recommended Data Minimization Scopes

```
scopes: openid email profile
```

**DO NOT request:** `contacts`, `drive`, `calendar`, `classroom.rosters`, or any other scope beyond basic identity.

---

## 7. Frontend Implementation

### @react-oauth/google Package

This is the standard React library for Google Sign-In. Key features:
- `<GoogleLogin />` component for the standard "Sign in with Google" button
- `useGoogleOneTapLogin` hook for the One Tap prompt
- FedCM (Federated Credential Management) support with automatic fallback
- 90% increase in signups reported with One Tap implementation

### One Tap Sign-In Considerations

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome (desktop) | Full | FedCM-based since 2025 |
| Chrome (Android) | Full | FedCM-based |
| Chrome (iOS) | Limited | FedCM not supported, falls back to popup |
| Safari | Limited | ITP blocks normal One Tap UX |
| Firefox | Partial | Falls back to redirect flow |

**Dismissal cooldown:** If a user dismisses One Tap, it is suppressed for increasing periods (2 hours, 1 day, 1 week, 4 weeks). Always provide a standard "Sign in with Google" button as fallback.

### Implementation Pattern for ExamIQ

1. Add `@react-oauth/google` to frontend
2. Wrap app with `<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>`
3. On login page: show Google One Tap + standard Google button + existing email/password form
4. On register page: show "Sign up with Google" + existing registration form
5. On join page (`/join/:code`): show Google SSO option alongside registration form
6. Google credential (JWT) is sent to `POST /api/auth/google/callback` on the backend
7. Backend verifies the Google JWT, finds-or-creates user, issues ExamIQ JWT
8. Frontend stores ExamIQ JWT in localStorage (existing pattern)

**Two implementation approaches for the OAuth flow:**

**Approach A: Backend redirect flow (Authlib)**
- Frontend: `<a href="/api/auth/google/login">Sign in with Google</a>`
- Backend handles the full OAuth redirect dance
- More secure, traditional OAuth2 authorization code flow
- Requires SessionMiddleware for state management

**Approach B: Frontend credential flow (@react-oauth/google)**
- Frontend: `<GoogleLogin onSuccess={handleCredential} />`
- Google returns a JWT credential directly to the frontend
- Frontend sends JWT to `POST /api/auth/google/verify`
- Backend verifies JWT using Google's public keys
- Simpler, no session needed, works with One Tap

**Recommendation: Approach B (frontend credential flow).** It is simpler, works with One Tap, does not require SessionMiddleware, and aligns with modern Google Identity Services architecture. The backend only needs to verify the Google JWT and issue an ExamIQ JWT -- no redirect handling needed.

---

## 8. Cost Analysis

### Cost-Effort Matrix

| Auth Method | Dev Effort | Ongoing Cost | User Coverage (India) | Priority |
|-------------|-----------|--------------|----------------------|----------|
| **Email + password** | Already done | $0 | 100% (baseline) | Existing |
| **Google SSO** | 2-3 days | $0 (Google OAuth is free) | 30-50% of target schools | **P1** |
| **Phone OTP (MSG91)** | 3-5 days | ~$0.003/SMS (~$30/10K verifications) | 95%+ of Indian users | P2 |
| **Microsoft SSO** | 2-3 days | $0 | 5-10% of target schools | P3 |
| **Magic link (email)** | 2-3 days | ~$0.001/email (SendGrid) | Depends on email access | P3 |
| **Clerk (managed)** | 5-7 days (migration) | $800+/mo at 50K MAU | All methods included | Not recommended |
| **Auth0 (managed)** | 5-7 days (migration) | $500+/mo at 50K MAU | All methods included | Not recommended |
| **Google Classroom roster sync** | 7-10 days | $0 | Schools with Google Workspace | P3 |
| **SIS/OneRoster integration** | 15-20 days | Varies | Enterprise schools only | P4 |

### 3-Year Total Cost Projection (50K MAU)

| Approach | Year 1 | Year 2 | Year 3 | Total |
|----------|--------|--------|--------|-------|
| Custom (Authlib + MSG91) | $0 + dev time | ~$360 (SMS) | ~$720 (SMS) | ~$1,080 |
| Clerk | $9,600 | $9,600 | $9,600 | $28,800 |
| Auth0 | $6,000 | $6,000 | $6,000 | $18,000 |

**Custom auth wins decisively on cost.** The dev effort difference (2-3 days for Google SSO vs 5-7 days for Clerk migration) also favors custom.

---

## 9. Impact on ExamIQ's Existing Auth Flow

### What Changes

| Component | Current State | After Google SSO |
|-----------|--------------|-----------------:|
| `User` model | `hashed_password` is `NOT NULL` | Must become `nullable=True` for OAuth-only users |
| `User` model | No OAuth fields | Add `oauth_provider` (String, nullable), `oauth_id` (String, nullable) |
| `auth.py` routes | Only `POST /register` and `POST /login` | Add `POST /auth/google/verify` callback |
| `security.py` | Only password-based auth | Add `verify_google_token()` function |
| `UserRegister` schema | Requires password | Add `Optional[str]` for password when using OAuth |
| Frontend login page | Email + password form | Add "Sign in with Google" button + One Tap |
| Frontend register page | Full registration form | Add "Sign up with Google" option |
| `requirements.txt` | No OAuth libraries | Add `authlib>=1.3.0` (or `google-auth>=2.0` for token verification only) |

### What Stays the Same

- JWT token structure (workspace_id, workspace_role embedded) -- **no change**
- `get_current_user` dependency -- **no change** (still validates ExamIQ JWT)
- Workspace tenancy model -- **no change**
- Class join code flow -- **no change** (Google SSO is just a different way to authenticate, join codes still work the same)
- Role-based access control -- **no change**
- Rate limiting -- **no change** (add limiter to new Google auth endpoint)

### Migration Notes

Since ExamIQ uses SQLite without Alembic, making `hashed_password` nullable requires either:
1. Dropping and re-seeding the database (acceptable in development)
2. Creating a new column `oauth_provider` and `oauth_id` (these are additive, not breaking)

**Recommended approach:** Add `oauth_provider` and `oauth_id` columns as nullable. Keep `hashed_password` as NOT NULL but store a random hash for OAuth-only users (simpler than schema migration). This way OAuth users cannot log in with password, but the schema does not break.

---

## 10. Recommendation: Implementation Priority and FR Classification

### Should This Be a Separate FR or Folded into FR-003?

**Recommendation: Create a new FR-007 (Social Authentication and SSO).**

Rationale:
- FR-003 is about **enrollment UX** (join codes, QR, CSV, roster management) -- it is already comprehensive with 7 tasks across 2 phases
- Google SSO is an **authentication concern**, not an enrollment concern. It changes how users prove their identity, not how they join classes
- SSO implementation touches `auth.py`, `security.py`, `User` model, and frontend login/register pages -- a different file surface than FR-003's enrollment files
- Phone OTP (already mentioned as P2 in FR-003) should be moved to this new FR as well, since it is also an authentication method

However, SSO and enrollment are **complementary**: Google SSO makes the `/join/{code}` flow smoother because students do not need to create a password. The join page should show "Sign up with Google + enter class code" as a combined flow.

### Recommended Implementation Order

**Phase 1 (P1 -- Implement Now, 2-3 days):**
- Google SSO via frontend credential flow
- `POST /api/auth/google/verify` backend endpoint
- "Sign in with Google" button on login page
- "Sign up with Google" on registration page
- Google SSO option on `/join/{code}` page (register + join in one step)
- `User` model additions: `oauth_provider`, `oauth_id`

**Phase 2 (P2 -- Next Sprint, 3-5 days):**
- Phone OTP authentication (MSG91)
- `POST /api/auth/otp/send` and `POST /api/auth/otp/verify`
- Parent consent verification via OTP to parent phone
- DPDP Act compliance: parental consent flow

**Phase 3 (P3 -- Future):**
- Microsoft SSO
- Magic link (passwordless email)
- Google Classroom roster sync API integration

**Phase 4 (P4 -- If Needed):**
- OneRoster/SIS integration
- DigiLocker document verification

---

## Technical Implementation Guide: Google SSO (Phase 1)

### Backend Changes

**New file: `backend/app/api/routes/oauth.py`**

Key endpoints:
- `POST /api/auth/google/verify` -- receives Google JWT credential from frontend, verifies it using Google's public keys, finds-or-creates user, issues ExamIQ JWT

**Modified files:**
- `backend/app/models/user.py` -- add `oauth_provider`, `oauth_id` columns to User
- `backend/app/core/security.py` -- add `verify_google_id_token()` function
- `backend/app/core/config.py` -- add `GOOGLE_CLIENT_ID` setting
- `backend/requirements.txt` -- add `google-auth>=2.0` (for ID token verification)
- `backend/app/main.py` -- register new OAuth router

**Token verification approach:**

```python
from google.oauth2 import id_token
from google.auth.transport import requests

def verify_google_id_token(token: str, client_id: str) -> dict:
    idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
    return idinfo  # contains: sub, email, name, picture, hd, email_verified
```

### Frontend Changes

**Modified files:**
- `frontend/package.json` -- add `@react-oauth/google`
- `frontend/src/App.tsx` -- wrap with `<GoogleOAuthProvider>`
- `frontend/src/pages/Login.tsx` -- add Google Sign-In button
- `frontend/src/pages/Register.tsx` -- add Google Sign-Up option
- `frontend/src/pages/JoinClass.tsx` -- add Google SSO to join flow
- `frontend/src/services/api.ts` -- add `authAPI.googleVerify()`

### Google Cloud Console Setup

1. Create project in Google Cloud Console
2. Enable "Google Identity" API
3. Configure OAuth consent screen (External, app name "ExamIQ")
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized JavaScript origins: `http://localhost:3000`, production domain
6. Add authorized redirect URIs (only needed for backend redirect flow, not for credential flow)
7. Request only `openid email profile` scopes (no verification required for these non-sensitive scopes)

### Environment Variables

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
```

No `GOOGLE_CLIENT_SECRET` needed for the frontend credential flow (the secret is only needed for the authorization code flow).

---

## Knowledge Gaps and Future Research

1. **Exact percentage of private CBSE/ICSE schools with Google Workspace for Education** -- No authoritative source provides this number. Consider surveying early ExamIQ school partners.
2. **DPDP Rules enforcement timeline** -- The rules are notified but enforcement mechanisms are still being operationalized. Monitor for updates.
3. **FedCM browser support evolution** -- FedCM is rapidly evolving. Monitor Chrome and Safari support changes.
4. **Indian SMS DLT registration process** -- Specific requirements for MSG91 DLT registration vary by telecom circle. Research needed before Phone OTP implementation.
5. **Google Workspace admin auto-allow adoption** -- Unknown what percentage of school admins have enabled the auto-allow setting for basic authentication apps.

---

## Sources

- [Google Partners with CBSE to Digitize Classrooms](https://www.businesstoday.in/technology/news/story/google-partners-with-cbse-to-digitise-classrooms-train-1-million-teachers-263862-2020-07-13)
- [India is Teaching Google How AI in Education Can Scale (TechCrunch)](https://techcrunch.com/2026/01/29/india-is-teaching-google-how-ai-in-education-can-scale/)
- [Google For Education Statistics 2026](https://www.aboutchromebooks.com/google-for-education-user-statistics/)
- [Google Workspace for Education: Future of Learning in India](https://ouriken.com/blog/google-workspace-for-education-the-future-of-digital-learning-in-india/)
- [Authlib FastAPI OAuth Client Documentation](https://docs.authlib.org/en/latest/client/fastapi.html)
- [Authlib FastAPI Google Login Blog](https://blog.authlib.org/2020/fastapi-google-login)
- [Google Authentication in FastAPI using OAuth2 (Medium)](https://medium.com/@shrinit.poojary12/google-authentication-in-fastapi-using-oauth2-e47f13a019aa)
- [Google OAuth with FastAPI and JWT (Hanchon Blog)](https://blog.hanchon.live/guides/google-login-with-fastapi-and-jwt/)
- [Google Identity Services: Verify ID Token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Google One Tap Login Complete Guide 2025](https://guptadeepak.com/the-complete-guide-to-google-one-tap-login-everything-developers-need-to-know/)
- [Google Classroom API Roster Import](https://developers.google.com/workspace/classroom/tutorials/import-rosters)
- [@react-oauth/google npm Package](https://www.npmjs.com/package/@react-oauth/google)
- [FedCM Migration for Google Identity Services](https://developers.googleblog.com/federated-credential-management-fedcm-migration-for-google-identity-services/)
- [DPDP Act Compliance for EdTech and Schools in India](https://ksandk.com/data-protection-and-data-privacy/dpdp-act-compliance-for-edtech-schools/)
- [DPDP Rules and Child Data Safety (ORF)](https://www.orfonline.org/english/expert-speak/dpdp-rules-and-the-future-of-child-data-safety)
- [Protecting Minor's Data in India: DPDP Compliance (IDfy)](https://www.idfy.com/blog/protecting-minors-data-in-india-dpdp-edtech-privacy-compliance-practical-checklist/)
- [Parental Consent Under DPDP Act (consent.in)](https://www.consent.in/blog/child-consent)
- [Google Workspace Third-Party App Access for Under 18](https://knowledge.workspace.google.com/admin/getting-started/editions/manage-access-to-unconfigured-third-party-apps-for-users-designated-as-under-18)
- [COPPA Compliance (Google Cloud)](https://cloud.google.com/security/compliance/coppa)
- [Google OAuth2 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Clerk vs Auth0 vs Supabase Auth 2026 Comparison](https://appstackbuilder.com/blog/clerk-vs-auth0-vs-supabase-auth)
- [Auth Pricing Comparison (Zuplo)](https://zuplo.com/learning-center/api-authentication-pricing)
- [Clerk vs Supabase Auth Budget Guide (Monetizely)](https://www.getmonetizely.com/articles/clerk-vs-supabase-auth-how-to-choose-the-right-authentication-service-for-your-budget)
- [fastapi-clerk-auth PyPI Package](https://pypi.org/project/fastapi-clerk-auth/)
- [Clerk Python Backend SDK](https://clerk.com/changelog/2024-10-08-python-backend-sdk-beta)
- [MSAL Python Documentation](https://learn.microsoft.com/en-us/entra/msal/python/)
- [MSG91 OTP Service India](https://msg91.com/in/otp)
- [MSG91 Python Package](https://pypi.org/project/msg91-otp/)
- [UDISE+ Portal 2025-26](https://udiseplus.gov.in/)
- [DigiLocker Official](https://www.digilocker.gov.in/)
- [Google OneRoster SIS Integration](https://developers.google.com/workspace/classroom/sis-integrations/validate-your-SIS)

---

## Relevant Files in the ExamIQ Codebase

These are the files that would need modification to implement Google SSO:

- `/Users/arunmenon/literate-giggle/backend/app/api/routes/auth.py` -- Current auth routes, add Google OAuth callback
- `/Users/arunmenon/literate-giggle/backend/app/core/security.py` -- Add Google ID token verification
- `/Users/arunmenon/literate-giggle/backend/app/core/config.py` -- Add GOOGLE_CLIENT_ID setting
- `/Users/arunmenon/literate-giggle/backend/app/models/user.py` -- Add oauth_provider, oauth_id columns
- `/Users/arunmenon/literate-giggle/backend/requirements.txt` -- Add google-auth dependency
- `/Users/arunmenon/literate-giggle/backend/app/main.py` -- Register OAuth router
- `/Users/arunmenon/literate-giggle/FEATURE_REQUESTS.md` -- SSO is mentioned as P2 item 11 in FR-003 (lines 180-185), should become its own FR-007
