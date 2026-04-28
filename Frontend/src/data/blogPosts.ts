export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  author: string;
  publishedAt: string; // ISO date
  readingMinutes: number;
  body: BlogBlock[];
};

export type BlogBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "quote"; text: string; cite?: string };

export const blogPosts: BlogPost[] = [
  {
    slug: "foreign-worker-permit-requirements-malaysia-2025",
    title: "Foreign Worker Permit Requirements Malaysia 2025 — Official JTKSM Guide",
    description:
      "Complete 2025 guide to Malaysian foreign worker permits — eligibility, documentation, PLKS approvals, and compliance with JTKSM and the Immigration Department.",
    heroImage:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-01-14",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "Malaysia's foreign worker framework is one of the most document-heavy employment regimes in Southeast Asia. Employers who hire migrant workers must work across three authorities — the Ministry of Human Resources (KSM), the Department of Labour (JTKSM), and the Immigration Department (JIM) — before a single worker can be legally employed. This guide walks through every step of the 2025 permit process and the paperwork you are expected to retain.",
      },
      { type: "h2", text: "Who qualifies as a foreign worker?" },
      {
        type: "p",
        text: "Under the Employment Act 1955 and the Employees' Provident Fund Act 1991, a foreign worker is any non-citizen working for wages in Malaysia. In practice this covers five approved source countries (Bangladesh, Indonesia, Nepal, Myanmar, and the Philippines) and five approved sectors: manufacturing, construction, plantation, agriculture, and services.",
      },
      { type: "h2", text: "Documents you must prepare before applying" },
      { type: "h3", text: "From the employer" },
      {
        type: "ul",
        items: [
          "Company SSM Form 9 / 24 / 49 (or Form B for sole proprietors)",
          "Latest audited financial statement",
          "JTKSM labour quota approval letter",
          "Proof of levy payment for the full permit period",
          "Insurance cover (SKHPPA and SPIKPA, where applicable)",
        ],
      },
      { type: "h3", text: "From the worker" },
      {
        type: "ul",
        items: [
          "Passport with at least 24 months' validity",
          "FOMEMA medical screening pass result",
          "Attested pre-departure training certificate",
          "Source-country insurance policy (SC Insurance)",
          "Signed demand letter and standardised employment contract",
        ],
      },
      { type: "h2", text: "The PLKS (Visit Pass Temporary Employment) process" },
      {
        type: "p",
        text: "Once JTKSM approves the sector quota, the employer submits a Visa Approval Letter (VDR) request through the eKL system. Upon VDR issuance, the worker enters Malaysia and must complete a second FOMEMA screening within 30 days. A passing result triggers the issuance of the PLKS sticker in the passport — the sticker is the legal right to work.",
      },
      { type: "h2", text: "Renewals and the 10+3 rule" },
      {
        type: "p",
        text: "PLKS permits are issued for 12 months and can be renewed annually. Since 2022 the maximum cumulative duration is ten years, with a three-year compassionate extension available for skilled workers in manufacturing and services. Plan your renewals inside the MWMS platform — the Document Expiry module fires alerts at 90, 60, and 30 days, colour-coded red/amber/green, so no permit lapses unnoticed.",
      },
      { type: "h2", text: "Common pitfalls to avoid" },
      {
        type: "ul",
        items: [
          "Employing a worker on a tourist Visit Pass — this is illegal and carries a fine up to RM 50,000 per head",
          "Failing to renew SPIKPA insurance at the same cadence as the permit",
          "Retaining passports against the worker's consent — a direct breach of Section 5 of the Anti-Trafficking in Persons Act",
          "Missing the 14-day reporting window for worker absconding cases",
        ],
      },
      {
        type: "quote",
        text: "A compliant permit file is not a bureaucratic formality — it is the single strongest legal protection for both the employer and the worker.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "Using MWMS to stay compliant" },
      {
        type: "p",
        text: "MWMS centralises all permit, insurance, and FOMEMA expiry dates on one dashboard. Agencies linked to your account receive the same alerts so renewals are never missed. Salary payment receipts, attestations, and complaint records are retained in-system for the JTKSM audit window.",
      },
    ],
  },
  {
    slug: "socso-coverage-foreign-workers-malaysia",
    title: "SOCSO Coverage for Foreign Workers in Malaysia",
    description:
      "How the 2019 extension of SOCSO to foreign workers works in practice — contributions, benefits, claim procedures, and what employers must do.",
    heroImage:
      "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-02-03",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "Since 1 January 2019, foreign workers employed in Malaysia are covered under the Employment Injury Scheme of SOCSO (Social Security Organisation). The change replaced the older Workmen's Compensation Scheme (FWCS) for work-related injuries and has materially strengthened the safety net available to migrant workers.",
      },
      { type: "h2", text: "What the Employment Injury Scheme covers" },
      {
        type: "ul",
        items: [
          "Medical treatment for injuries sustained at work or during commuting",
          "Temporary disablement benefit (80% of assumed daily wage)",
          "Permanent disablement benefit, paid as pension or lump sum",
          "Constant-attendance allowance for severe cases",
          "Dependants' benefit and funeral benefit (RM 2,000) in case of fatal accident",
          "Rehabilitation benefit including artificial aids and vocational retraining",
        ],
      },
      { type: "h2", text: "Who contributes and how much" },
      {
        type: "p",
        text: "Contributions are paid entirely by the employer at 1.25% of the worker's insured wage, capped at a monthly wage of RM 5,000. Workers do not contribute to the Employment Injury Scheme. Contributions are remitted monthly through the ASSIST Portal together with domestic employee contributions.",
      },
      { type: "h2", text: "Registering a foreign worker with SOCSO" },
      { type: "h3", text: "Step-by-step" },
      {
        type: "ul",
        items: [
          "Log in to the ASSIST Portal with the employer's SOCSO ID",
          "Add the worker under 'Register Employee' with passport number and PLKS details",
          "Upload a scanned copy of the PLKS and passport data page",
          "Submit the initial Form 2 within 30 days of the worker's start date",
          "Remit the first contribution on the 15th of the following month",
        ],
      },
      { type: "h2", text: "Claim procedure after a workplace accident" },
      {
        type: "p",
        text: "The employer must report the accident to the nearest SOCSO office within 48 hours using Form 21 (accident report). The treating medical officer completes Form 10 (medical report). Claims can now be submitted digitally through the ASSIST Portal; average adjudication time in 2024 was 14 working days for straightforward cases.",
      },
      { type: "h2", text: "Common employer mistakes" },
      {
        type: "ul",
        items: [
          "Mis-classifying the worker as a contractor to avoid contribution — this is a strict-liability offence",
          "Paying through the FWCS after 2019 — SOCSO supersedes FWCS for injury coverage",
          "Late contribution filing — each defaulted month compounds a 6% interest penalty",
          "Failing to keep the worker's SOCSO reference slip accessible for the worker",
        ],
      },
      { type: "h2", text: "MWMS SOCSO tracking" },
      {
        type: "p",
        text: "Inside MWMS, every worker's SOCSO number and contribution status sits alongside their insurance and permit data. Agencies reviewing their linked employers can export the monthly SOCSO register directly from the Compliance report in one click.",
      },
    ],
  },
  {
    slug: "employer-obligations-employment-act-1955",
    title: "Employer Obligations Under Employment Act 1955",
    description:
      "A practical breakdown of the Employment Act 1955 and its 2022 amendments — wages, hours, termination, and the rights every employer must respect.",
    heroImage:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Legal",
    publishedAt: "2025-02-20",
    readingMinutes: 9,
    body: [
      {
        type: "p",
        text: "The Employment Act 1955 (EA) is the backbone of private-sector labour law in Peninsular Malaysia. The 2022 amendments — effective 1 January 2023 — brought the Act closer to ILO Conventions 87 and 98 and widened coverage to every employee regardless of salary. This changes how you must structure contracts, hours, overtime, and terminations for foreign workers.",
      },
      { type: "h2", text: "Who is now covered" },
      {
        type: "p",
        text: "Before 2023, the EA only fully applied to employees earning up to RM 2,000 per month plus manual labour categories. As of the amendments, all employees (including migrant workers) are covered, with certain Part XII-A provisions (overtime, termination benefits) reserved for those earning up to RM 4,000.",
      },
      { type: "h2", text: "Working hours and rest days" },
      {
        type: "ul",
        items: [
          "Maximum 45 ordinary working hours per week (down from 48)",
          "At least one full rest day per week",
          "Overtime is capped at 104 hours per month",
          "Work on a rest day is paid at 1.5× the hourly rate for the first 8 hours",
          "Public holiday work is paid at 3× the hourly rate",
        ],
      },
      { type: "h2", text: "Written employment contracts are mandatory" },
      {
        type: "p",
        text: "Every foreign worker must receive a written contract in a language they understand, detailing wages, allowances, deductions, working hours, and grounds for termination. The contract template issued by JTKSM is the safest baseline — deviations require JTKSM pre-approval.",
      },
      { type: "h2", text: "Wages and lawful deductions" },
      {
        type: "p",
        text: "Foreign workers must be paid at least the national minimum wage (RM 1,700/month as of 1 February 2025 for employers with five or more employees). Wages must be paid not later than the 7th of the following month. Deductions are strictly limited — any deduction beyond those listed in Section 24 of the EA requires the worker's written consent and, in some cases, Director-General approval.",
      },
      { type: "h2", text: "Sick leave, annual leave, and maternity" },
      {
        type: "ul",
        items: [
          "Sick leave: 14 / 18 / 22 days depending on service length, plus 60 days hospitalisation",
          "Annual leave: 8 / 12 / 16 days depending on service length",
          "Maternity leave: 98 consecutive days (2022 amendment)",
          "Paternity leave: 7 consecutive days for married male employees",
        ],
      },
      { type: "h2", text: "Termination — doing it lawfully" },
      {
        type: "p",
        text: "Dismissal without just cause or excuse can be challenged at the Industrial Court for up to 60 days after the dismissal date. Foreign workers enjoy the same protection as citizens. A clear disciplinary process — warning, show-cause, domestic inquiry — is the single strongest defence against a wrongful-dismissal claim.",
      },
      {
        type: "quote",
        text: "Treat the Employment Act as the floor, not the ceiling — the workers you keep are the ones whose contracts you honour beyond the minimum.",
        cite: "MWMS Legal",
      },
      { type: "h2", text: "What MWMS automates for you" },
      {
        type: "p",
        text: "The HRMS module (Attendance, Leave, Payroll, Contracts, Roster, Timesheets) enforces statutory limits automatically — it refuses to accept an overtime claim that breaches the 104-hour monthly cap, for example. Contracts generated inside MWMS follow the JTKSM template by default.",
      },
    ],
  },
  {
    slug: "work-visa-categories-malaysia",
    title: "Work Visa Categories Malaysia — Manufacturing, Construction, Plantation",
    description:
      "Understand the differences between PLKS, PVP, DP10, and sector-specific permits — and which category applies to your workforce.",
    heroImage:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-03-09",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "Not every foreign worker in Malaysia is on the same permit. Understanding which visa category applies to your workforce determines what you can and cannot ask them to do, which ministry handles renewals, and how transfers between employers are processed.",
      },
      { type: "h2", text: "The four categories every employer should know" },
      { type: "h3", text: "1. PLKS — Pas Lawatan Kerja Sementara" },
      {
        type: "p",
        text: "The default permit for low-skilled migrant workers. Valid for 12 months at a time and renewable up to ten years. Used in manufacturing, construction, services, plantation, and agriculture. Workers on PLKS cannot change employer without a new VDR issued to the receiving employer.",
      },
      { type: "h3", text: "2. PVP — Pas Visit Pass (Professional)" },
      {
        type: "p",
        text: "Issued for short assignments under 12 months, typically trainers, installation engineers, or conference speakers. Not a substitute for PLKS — using PVP to onboard a permanent worker is an enforcement flag.",
      },
      { type: "h3", text: "3. Employment Pass (DP10 / EP I, II, III)" },
      {
        type: "p",
        text: "For expatriates earning above RM 5,000/month in skilled and managerial roles. Tied to an approved position at a specific company. DP10 is the most flexible category and is the one used by multinationals.",
      },
      { type: "h3", text: "4. Resident Pass-Talent (RP-T)" },
      {
        type: "p",
        text: "A ten-year residency pass for talents endorsed by TalentCorp, decoupled from any single employer. Holders can switch employers without cancelling the pass.",
      },
      { type: "h2", text: "Which category fits which sector" },
      {
        type: "ul",
        items: [
          "Manufacturing — PLKS for operators; EP for line managers and above",
          "Construction — PLKS, plus CIDB Green Card required for site work",
          "Plantation — PLKS, usually tied to estate locations",
          "Services (retail, hospitality) — PLKS with tighter quota restrictions; EP for regional managers",
          "Agriculture — PLKS with MPIC endorsement",
        ],
      },
      { type: "h2", text: "Transfers and the consent process" },
      {
        type: "p",
        text: "Worker transfers between employers were previously effectively impossible without re-importing the worker. Since 2023 the government has allowed inter-employer transfers inside the same sector, subject to the original employer's written consent and a new levy payment. MWMS handles the paperwork trail for these transfers inside the Worker Linking module.",
      },
      { type: "h2", text: "What happens when a permit expires" },
      {
        type: "p",
        text: "A worker whose permit has lapsed loses the right to work immediately and must be repatriated within 30 days. Continuing to employ a worker after permit expiry exposes the company to fines under Section 55E of the Immigration Act. MWMS expiry alerts at 90 / 60 / 30 days are designed to make this impossible to miss.",
      },
    ],
  },
  {
    slug: "migrant-worker-rights-malaysia-ilo",
    title: "Migrant Worker Rights Malaysia — ILO Standards",
    description:
      "How Malaysia's labour framework maps to ILO core conventions — and what rights migrant workers can exercise in practice today.",
    heroImage:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-03-27",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "Malaysia has ratified six of the eight ILO fundamental conventions. While it has not yet ratified C87 (freedom of association) or C105 (forced labour abolition), the 2022 amendments to the Employment Act and the 2021 Anti-Trafficking in Persons Act have materially strengthened migrant worker rights in practice.",
      },
      { type: "h2", text: "The rights every migrant worker holds" },
      {
        type: "ul",
        items: [
          "Right to a written contract in a language they understand",
          "Right to keep their own passport and personal documents at all times",
          "Right to the national minimum wage and timely payment",
          "Right to statutory rest days, annual leave, and sick leave",
          "Right to SOCSO coverage for workplace injury",
          "Right to file a complaint with JTKSM without fear of retaliation",
          "Right to repatriation at the employer's cost at contract end",
        ],
      },
      { type: "h2", text: "Forced labour indicators Malaysia prosecutes" },
      {
        type: "p",
        text: "The US Department of Labor's 11 ILO indicators of forced labour have been absorbed into Malaysia's enforcement practice. Any one of the following, proven during inspection, can trigger criminal charges: document confiscation, wage withholding, debt bondage, restriction of movement, abusive working conditions, excessive overtime, intimidation, isolation, deception about the nature of work, physical or sexual violence, or abuse of vulnerability.",
      },
      { type: "h2", text: "How a worker files a complaint" },
      { type: "h3", text: "Through official channels" },
      {
        type: "ul",
        items: [
          "JTKSM: complaint portal at jtksm.mohr.gov.my or any district office",
          "MyBantuan hotline: 15050",
          "Source-country embassy (for nationality-specific support)",
          "Tenaganita and other NGOs for trafficking or abuse cases",
        ],
      },
      { type: "h3", text: "Through MWMS" },
      {
        type: "p",
        text: "Inside the MWMS worker app, the Complaint and Salary Dispute modules let workers escalate directly to their employer, with visibility for their linked agency, the destination embassy (for their nationality), and the Labour Department. The audit trail — timestamps, attached evidence photos, employer responses — is admissible evidence if the matter later goes to the Industrial Court.",
      },
      {
        type: "quote",
        text: "A worker who knows their rights and has a documented paper trail is the single best deterrent against exploitation.",
        cite: "MWMS Editorial",
      },
      { type: "h2", text: "Employer duty of care checklist" },
      {
        type: "ul",
        items: [
          "Conduct induction in the worker's language within the first week",
          "Post the Employment Act summary in multiple languages at the worksite",
          "Give workers unrestricted access to their own passports",
          "Maintain complaint boxes or a confidential digital channel",
          "Run quarterly welfare interviews and record them",
        ],
      },
      { type: "h2", text: "The road ahead" },
      {
        type: "p",
        text: "Ratification of C87 and C105 remains on the policy agenda. In the meantime, platforms like MWMS make compliance with existing standards measurable and auditable. The next generation of audit requests from international brands will demand evidence at this level of detail as a baseline — not as a premium.",
      },
    ],
  },
  {
    slug: "fomema-medical-screening-malaysia",
    title: "FOMEMA Medical Screening — What Every Employer and Worker Must Know",
    description:
      "Full guide to FOMEMA screening in Malaysia — the tests, the costs, common reasons for 'unfit' results, and how to manage re-examinations.",
    heroImage:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-04-11",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "FOMEMA (the Foreign Workers Medical Examination Monitoring Agency) screening is the mandatory health gate every migrant worker passes through before their PLKS is issued — and every year for renewal. A worker who does not hold a valid FOMEMA 'fit' certificate cannot legally be employed, regardless of any other permit being in order.",
      },
      { type: "h2", text: "When screening is required" },
      {
        type: "ul",
        items: [
          "Pre-departure screening in the source country (SC Screening)",
          "First screening in Malaysia within 30 days of arrival",
          "Annual renewal screening for every PLKS renewal",
          "Ad-hoc screening on request after suspected infectious exposure",
        ],
      },
      { type: "h2", text: "What tests are included" },
      {
        type: "p",
        text: "The standard panel covers chest X-ray, full blood count, urine analysis, and serology for HIV, hepatitis B, VDRL (syphilis), and malaria. Pregnancy testing is part of the panel for female workers. The examining clinic uploads results directly to the FOMEMA system within three working days.",
      },
      { type: "h2", text: "Cost breakdown for 2025" },
      {
        type: "ul",
        items: [
          "Medical examination fee: RM 180 (male) / RM 190 (female)",
          "FOMEMA administration fee: RM 5",
          "SST and clinic-specific surcharges: up to RM 25",
          "Re-examination fee (if applicable): RM 100",
        ],
      },
      { type: "h2", text: "Common reasons for an 'unfit' result" },
      {
        type: "ul",
        items: [
          "Active pulmonary tuberculosis on chest X-ray",
          "Positive HIV or active hepatitis B viraemia",
          "Untreated syphilis (positive VDRL with confirmatory titre)",
          "Pregnancy (for new arrivals; renewals are handled separately)",
          "Severe uncontrolled hypertension or diabetes",
        ],
      },
      { type: "h2", text: "What happens after an 'unfit' result" },
      {
        type: "p",
        text: "An unfit result triggers a mandatory Special Pass request at the Immigration Department and repatriation within 30 days at the employer's cost. There is a narrow appeal window — the worker may request a re-examination at a second FOMEMA-panel clinic within 14 days if the result was borderline. The appeal must be lodged by the employer, not the worker.",
      },
      {
        type: "quote",
        text: "FOMEMA is a pass/fail gate, but its downstream effects are entirely within the employer's control — plan the medical calendar the same way you plan payroll.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "Tracking FOMEMA inside MWMS" },
      {
        type: "p",
        text: "The Document Expiry module pulls FOMEMA certificate dates alongside PLKS and insurance. Workers approaching their annual screening window receive in-app reminders in their native language, and employers see a consolidated calendar across the whole workforce so clinic appointments can be batched.",
      },
    ],
  },
  {
    slug: "foreign-worker-levy-rates-malaysia-2025",
    title: "Foreign Worker Levy Rates Malaysia 2025 — Sector-by-Sector Guide",
    description:
      "Updated 2025 levy schedule for migrant workers in Malaysia — who pays, how much per sector, and when the Multi-Tier Levy System kicks in.",
    heroImage:
      "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-04-24",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "The foreign worker levy is the single largest recurring government cost in hiring migrant labour. Rates are set by sector and paid annually in advance. Since 2020 the Federal Court has confirmed that the levy is the employer's liability — deducting it from worker wages is unlawful and a common source of JTKSM complaints.",
      },
      { type: "h2", text: "Levy rates by sector (2025)" },
      {
        type: "ul",
        items: [
          "Manufacturing — RM 1,850 per worker per year",
          "Construction — RM 1,850 per worker per year",
          "Services (Cat. 1 — restaurant, retail, cargo) — RM 1,850",
          "Services (Cat. 2 — cleaning, welfare, wholesale) — RM 1,850",
          "Plantation — RM 640",
          "Agriculture — RM 640",
          "Domestic worker — RM 410",
        ],
      },
      { type: "h2", text: "The Multi-Tier Levy System (MTLS)" },
      {
        type: "p",
        text: "Announced in Budget 2024 and phased in from 2025, MTLS layers a second tier on top of the base levy when an employer's foreign-worker headcount exceeds 15% of total employees. The surcharge starts at 20% of the base rate and scales up to 100% at the 40% dependency threshold. MTLS is designed to nudge sectors toward automation and Malaysian labour.",
      },
      { type: "h2", text: "Who pays and when" },
      {
        type: "ul",
        items: [
          "The employer pays the full levy directly to the Immigration Department",
          "Payment is due in one lump sum before the VDR is issued",
          "Renewal levy is due at least 30 days before PLKS expiry",
          "Deduction from wages — partial or full — is prohibited under Section 24 of the Employment Act",
        ],
      },
      { type: "h2", text: "Levy refunds and transfers" },
      {
        type: "p",
        text: "If a worker leaves employment before the permit year ends, the employer can apply for a pro-rated levy refund through the MyEG or eKL system. Documented reasons — medical repatriation, contract expiry, death, worker absconding — are required. Refund timelines average 60 to 90 working days.",
      },
      { type: "h2", text: "Common compliance mistakes" },
      {
        type: "ul",
        items: [
          "Deducting levy from the worker's first few months of wages — illegal",
          "Treating levy and PLKS fee as interchangeable — they are separate payments",
          "Missing the renewal deadline and paying late-renewal surcharges (up to 100%)",
          "Failing to apply for a refund when a worker leaves early",
        ],
      },
      { type: "h2", text: "MWMS levy tracking" },
      {
        type: "p",
        text: "Each worker record in MWMS stores the levy receipt, expiry date, and next renewal cost. Employers preparing annual budgets can export the consolidated levy forecast for the next 12 months in a single CSV.",
      },
    ],
  },
  {
    slug: "worker-repatriation-process-malaysia",
    title: "Worker Repatriation in Malaysia — Employer Duties and Legal Process",
    description:
      "Step-by-step guide to repatriating a foreign worker from Malaysia — documentation, costs, Special Pass procedures, and how to close the file cleanly.",
    heroImage:
      "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-05-08",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "Every foreign worker in Malaysia must eventually be repatriated — at end of contract, at permit expiry, or after an early termination. The repatriation file is the last thing JTKSM looks at when assessing an employer's compliance history, and getting it wrong can block future quota approvals.",
      },
      { type: "h2", text: "When repatriation is triggered" },
      {
        type: "ul",
        items: [
          "Contract completion or the end of the ten-year maximum service window",
          "FOMEMA 'unfit' result that cannot be appealed",
          "Permit cancellation following termination with just cause",
          "Voluntary resignation with at least 30 days' notice",
          "Work stoppage by the authority (raids, business closure)",
        ],
      },
      { type: "h2", text: "The employer's non-negotiable duties" },
      {
        type: "ul",
        items: [
          "Pay the return airfare to the worker's home country (not a third country)",
          "Settle all outstanding wages, bonus, and unused annual leave before departure",
          "Return the worker's passport and personal documents in full",
          "Cancel the PLKS through MyEG within 14 days of departure",
          "Submit the cancellation confirmation and boarding pass to JTKSM",
        ],
      },
      { type: "h2", text: "The Special Pass scenario" },
      {
        type: "p",
        text: "If the worker's permit has already lapsed, a Special Pass is required before they can legally remain in Malaysia while travel arrangements are made. It is issued for a maximum of 30 days at RM 100 per pass. During this period the worker cannot work. The employer remains legally responsible for accommodation and basic needs until departure.",
      },
      { type: "h2", text: "Runaway or absconding cases" },
      {
        type: "p",
        text: "If a worker goes missing, the employer must file a Form G within 14 days at the Immigration Department. Failure to file the G form on time converts the case into an 'illegal employment' matter against the employer — even if the worker has clearly absconded. A filed Form G preserves the right to recover the remaining levy and to apply for a replacement worker under the same quota.",
      },
      { type: "h2", text: "Cost summary for a standard repatriation" },
      {
        type: "ul",
        items: [
          "One-way economy airfare — RM 700 to RM 1,800 depending on source country",
          "Special Pass (if required) — RM 100 per 30-day pass",
          "Outstanding wages and unused leave — variable, must be settled in full",
          "Bond refund (where applicable) — released by Immigration after cancellation confirms",
        ],
      },
      {
        type: "quote",
        text: "Close the repatriation file as carefully as you opened the hiring file — the audit trail is what allows next year's quota to be approved.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "Repatriation workflow in MWMS" },
      {
        type: "p",
        text: "Marking a worker as 'Offboarding' in MWMS triggers a checklist covering wage settlement, document return, PLKS cancellation, and airfare receipt upload. Once every item is checked, the worker record is archived with a clean compliance stamp that survives future audits.",
      },
    ],
  },
  {
    slug: "atipsom-anti-trafficking-employer-compliance-malaysia",
    title: "ATIPSOM Compliance for Employers — Avoiding Forced-Labour Liability",
    description:
      "What the Anti-Trafficking in Persons and Anti-Smuggling of Migrants Act means for employers — indicators, penalties, and practical safeguards.",
    heroImage:
      "https://images.unsplash.com/photo-1521791055366-0d553872125f?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Legal",
    publishedAt: "2025-05-22",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "The Anti-Trafficking in Persons and Anti-Smuggling of Migrants Act 2007 (ATIPSOM), amended most recently in 2022, is the statute under which Malaysian employers can face criminal prosecution for forced-labour practices. Since Malaysia was downgraded to the US TIP Report Tier 2 Watchlist in 2021 and then partially upgraded in 2024, enforcement has sharpened significantly.",
      },
      { type: "h2", text: "What the Act covers" },
      {
        type: "p",
        text: "ATIPSOM defines trafficking to include the recruitment, transport, harbouring or receipt of a person for the purpose of exploitation — whether through threat, coercion, deception, abuse of power, or debt bondage. A case under ATIPSOM does not require the worker to have been moved across borders; purely domestic exploitation also qualifies.",
      },
      { type: "h2", text: "The 11 ILO forced-labour indicators used by enforcement" },
      {
        type: "ul",
        items: [
          "Abuse of vulnerability",
          "Deception about the nature of work or wages",
          "Restriction of movement",
          "Isolation from family or community",
          "Physical and sexual violence",
          "Intimidation and threats",
          "Retention of identity documents",
          "Withholding of wages",
          "Debt bondage",
          "Abusive working and living conditions",
          "Excessive overtime",
        ],
      },
      { type: "h2", text: "Penalties under ATIPSOM" },
      {
        type: "ul",
        items: [
          "Trafficking involving an adult — up to 15 years imprisonment and a fine",
          "Trafficking involving a child — up to 20 years and a mandatory fine",
          "Corporate officers deemed personally liable under Section 66",
          "Confiscation of assets used in the offence",
          "Ten-year ban on hiring foreign workers (administrative)",
        ],
      },
      { type: "h2", text: "Practical safeguards every employer should run" },
      { type: "h3", text: "On the paper trail" },
      {
        type: "ul",
        items: [
          "Written contracts in the worker's language, countersigned line by line",
          "Wage payment exclusively through bank transfer with monthly payslips",
          "Passport storage facility that the worker controls — never the employer",
          "Documented grievance mechanism with timestamped responses",
        ],
      },
      { type: "h3", text: "On the working conditions" },
      {
        type: "ul",
        items: [
          "Accommodation that meets Act 446 standards (see the separate housing guide)",
          "Overtime logs that stay under the 104-hour monthly cap",
          "Rest days honoured on a weekly cycle, not banked",
          "Access to medical care without employer gate-keeping",
        ],
      },
      { type: "h2", text: "What auditors ask for" },
      {
        type: "p",
        text: "International brand audits now routinely request 36 months of wage records, attendance logs, dormitory inspection reports, and documented exit interviews for departed workers. The standard has moved from 'have a policy' to 'show evidence it was followed every month'.",
      },
      {
        type: "quote",
        text: "Forced labour is rarely a single dramatic act — it is the quiet accumulation of small compromises that each look defensible until an auditor strings them together.",
        cite: "MWMS Legal",
      },
      { type: "h2", text: "How MWMS creates the evidence trail" },
      {
        type: "p",
        text: "Every attendance punch, salary payout, complaint, attestation, and document return is timestamped and immutable in MWMS. Exit interviews are captured in the worker app in the worker's language. The full 36-month audit package for any worker can be exported as a signed PDF in a single click.",
      },
    ],
  },
  {
    slug: "worker-housing-standards-act-446-malaysia",
    title: "Act 446 Housing Standards — What Malaysian Employers Must Provide",
    description:
      "The Workers' Minimum Standards of Housing and Amenities Act (Act 446) after the 2019 amendment — practical requirements for dormitories and inspections.",
    heroImage:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-06-05",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "The Workers' Minimum Standards of Housing and Amenities Act 1990 — known as Act 446 — was substantially amended in 2019 and came into force across all sectors on 1 June 2020. For the first time it set a national floor for migrant worker accommodation in manufacturing, construction, services, and plantations. Non-compliance now carries a fine of up to RM 50,000 per worker affected.",
      },
      { type: "h2", text: "Who is covered" },
      {
        type: "p",
        text: "Any employer who provides or arranges accommodation for any employee — local or foreign — is caught by Act 446. This includes employer-owned dormitories, centralised labour quarters (CLQ), and accommodation rented by the employer on the worker's behalf. Self-arranged private rentals by the worker are out of scope, but the employer must still document that arrangement.",
      },
      { type: "h2", text: "Minimum standards, at a glance" },
      {
        type: "ul",
        items: [
          "Minimum 3.6 square metres of floor space per adult occupant",
          "No more than four workers per bedroom",
          "One toilet and one bathroom per fifteen occupants",
          "Beds raised from the floor with individual mattress and linen",
          "One lockable storage per worker for personal belongings",
          "Continuous supply of clean water and 24-hour electricity",
          "Separate quarters for men and women",
          "Fire-fighting equipment inspected every 12 months",
        ],
      },
      { type: "h2", text: "The Certificate for Accommodation" },
      {
        type: "p",
        text: "Every accommodation site — whether owned or rented — must hold a valid Certificate for Accommodation (CFA) issued by JTKSM. The CFA is tied to the premises, not the employer; a change of site or a change of employer using the site requires a fresh application. The CFA is valid for 36 months and renewable after re-inspection.",
      },
      { type: "h2", text: "Inspection regime in 2025" },
      {
        type: "ul",
        items: [
          "Unannounced JTKSM site visits — frequency rising after the 2024 TIP Report",
          "Joint inspections with Bomba (Fire and Rescue) for construction sites",
          "Third-party audits required by brand customers — SMETA, Sedex, amfori BSCI",
          "Local council (PBT) inspections where dormitories exceed 50 occupants",
        ],
      },
      { type: "h2", text: "Common findings that fail inspections" },
      {
        type: "ul",
        items: [
          "Double-bunking beyond four workers per room",
          "Shared toilets in excess of 1:15 ratio",
          "Blocked fire exits or missing extinguishers",
          "No lockable storage, forcing workers to hang belongings",
          "Poor ventilation or lighting below 100 lux at bed level",
          "Mould, leaking plumbing, or pest infestations",
        ],
      },
      { type: "h2", text: "What to do when a CFA is rejected" },
      {
        type: "p",
        text: "Rejection is not the end of the road. JTKSM issues a remediation notice specifying the failings and a correction window of 30 to 90 days. During this window the employer may continue to house workers provided the immediate safety issues (fire, electrical, water) are resolved first. Repeat rejections escalate the case to compounding fines.",
      },
      {
        type: "quote",
        text: "A dormitory that passes inspection is the quiet backbone of every ethical-audit report — get it right once and the next three years get materially easier.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "Tracking accommodation inside MWMS" },
      {
        type: "p",
        text: "MWMS stores each dormitory's CFA number, occupancy cap, last inspection date, and the next renewal date. Workers are linked to accommodation records so audit requests — 'show me where worker X slept on 12 March 2024' — can be answered in seconds instead of days. Expiry alerts mirror the PLKS and insurance cadence at 90, 60, and 30 days.",
      },
    ],
  },
  {
    slug: "recruitment-agency-licensing-act-246-malaysia",
    title: "Recruitment Agency Licensing — Act 246 and the JTKSM PEA Licence",
    description:
      "How the Private Employment Agencies Act 1981 governs migrant worker recruitment in Malaysia — licence classes, fee caps, and employer due diligence.",
    heroImage:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-06-19",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "Every agency that recruits migrant workers into Malaysia must hold a valid Private Employment Agency (PEA) licence under the Private Employment Agencies Act 1981 (Act 246). The Act was amended in 2017 and again in 2022 to align with ILO Convention 181 on private employment agencies and to harden the response to recruitment-fee abuses.",
      },
      { type: "h2", text: "The four PEA licence classes" },
      {
        type: "ul",
        items: [
          "Class A — recruitment of foreign workers from any approved source country",
          "Class B — recruitment of Malaysian citizens for jobs in Malaysia",
          "Class C — placement of Malaysian citizens in jobs abroad",
          "Class D — placement of any worker (local or foreign) in domestic service",
        ],
      },
      { type: "h2", text: "Fee caps that cannot be exceeded" },
      {
        type: "p",
        text: "Schedule II of the 2017 amendment caps the placement fee a PEA may charge an employer at 25% of the worker's first-month wage. Charging the worker is now restricted to a tightly defined list of items — passport processing, medical screening, and standardised pre-departure training — capped at the equivalent of one month's basic wage. Anything else is recoverable as an unlawful recruitment fee.",
      },
      { type: "h2", text: "Employer due diligence checklist" },
      {
        type: "ul",
        items: [
          "Verify the PEA licence number on the JTKSM public register",
          "Insist on a written placement contract with itemised fees",
          "Refuse to accept any fee invoice issued to the worker",
          "Cross-check the source-country sub-agent's accreditation",
          "Document the recruitment chain end to end for ATIPSOM defence",
        ],
      },
      { type: "h2", text: "What happens when an agency loses its licence" },
      {
        type: "p",
        text: "Suspension or revocation freezes all in-flight recruitment files. Employers with workers mid-pipeline must transfer the file to a licensed agency within 30 days or risk losing the quota slot. The previous agency remains liable for refunds owed to workers regardless of its licence status.",
      },
      {
        type: "quote",
        text: "Recruitment is the single most fragile link in the migrant-worker compliance chain — the wrong agency can wipe out a decade of clean operations downstream.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "How MWMS validates your agencies" },
      {
        type: "p",
        text: "Every agency linked to your MWMS account carries its PEA licence number, expiry date, and inspection history on file. Renewal alerts mirror the PLKS cadence at 90, 60, and 30 days so an expired licence cannot quietly process a new worker.",
      },
    ],
  },
  {
    slug: "foreign-worker-bank-accounts-malaysia",
    title: "Bank Accounts for Foreign Workers — Why Cashless Wages Matter",
    description:
      "BNM's e-payroll directive, the practical steps to open a Malaysian bank account for a migrant worker, and how digital wages reduce dispute risk.",
    heroImage:
      "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-07-04",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "Bank Negara Malaysia's e-Payment Roadmap and the 2022 amendment to Section 25 of the Employment Act together make electronic wage payment the default for every employee in Malaysia, including migrant workers. Cash and cheque payments are now exception cases that require the worker's written consent and Director-General notification.",
      },
      { type: "h2", text: "Why cashless wages matter for compliance" },
      {
        type: "ul",
        items: [
          "Bank statements are admissible evidence of timely wage payment",
          "Eliminates the most common forced-labour indicator — wage withholding",
          "Removes the need for the employer to handle large cash floats",
          "Allows workers to remit earnings home without informal channels",
          "Creates an audit trail that brand customers expect by default",
        ],
      },
      { type: "h2", text: "Documents required to open the account" },
      {
        type: "ul",
        items: [
          "Original passport with valid PLKS sticker",
          "Employer's introduction letter on company letterhead",
          "Proof of Malaysian residential address (employer accommodation letter accepted)",
          "Source-country tax or national ID, where applicable",
        ],
      },
      { type: "h2", text: "Banks that actively serve migrant workers" },
      {
        type: "p",
        text: "Maybank, CIMB, Public Bank, and RHB run dedicated migrant-worker product lines with low minimum balances, multilingual mobile apps, and tie-ups with major source-country remittance corridors. Onboarding inside the employer's premises (group account opening) is widely available — banks send a relationship team for batches of 30 or more workers.",
      },
      { type: "h2", text: "When cash payment is still permitted" },
      {
        type: "p",
        text: "An employer may pay in cash only after written agreement with the worker and notification to the JTKSM Director-General. Even then, a signed receipt for each pay cycle must be retained. The administrative cost of doing this lawfully usually outweighs the cost of opening a bank account.",
      },
      { type: "h2", text: "Digital wage flow inside MWMS" },
      {
        type: "p",
        text: "MWMS Payroll exports a JomPay-compatible salary file every cycle and stores the bank-side acknowledgement against each worker's record. Salary disputes raised in the worker app cite the exact transaction reference, which dramatically shortens the JTKSM mediation timeline.",
      },
    ],
  },
  {
    slug: "minimum-wage-orders-malaysia-sector-rates",
    title: "Minimum Wage Orders — National and Sectoral Rates Explained",
    description:
      "How the National Wages Consultative Council Act 2011 sets the minimum wage, the 2025 RM 1,700 rate, and the sectoral floors employers cannot ignore.",
    heroImage:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Legal",
    publishedAt: "2025-07-18",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "Malaysia's national minimum wage is reset by the Minimum Wages Order (MWO) issued under the National Wages Consultative Council Act 2011. The 2024 MWO took effect on 1 February 2025 at RM 1,700 per month for employers with five or more employees, and applies in full to migrant workers.",
      },
      { type: "h2", text: "Headline rates for 2025" },
      {
        type: "ul",
        items: [
          "RM 1,700/month — employers with 5 or more employees",
          "RM 1,500/month — employers with fewer than 5 employees (until 31 July 2025, then RM 1,700)",
          "Hourly rate — RM 8.72 for the 5+ employee category",
          "Daily rate — RM 65.38 for a 26-day month",
        ],
      },
      { type: "h2", text: "Sectoral and shift-based variations" },
      {
        type: "p",
        text: "Several sectors layer additional wage protections on top of the MWO. Plantation and security-services subsectors operate under collective wage agreements that exceed the national floor, and the Wages Council for shop assistants sets a separate retail rate. Where two rules apply, the higher rate prevails.",
      },
      { type: "h2", text: "Components that count toward the minimum wage" },
      {
        type: "ul",
        items: [
          "Basic wage — counts in full",
          "Fixed monthly allowances (e.g. shift, attendance) — count only if guaranteed",
          "Overtime — never counts toward the minimum",
          "Service charge — never counts toward the minimum (separate distribution rule)",
          "Productivity incentives — count only if codified in the contract",
        ],
      },
      { type: "h2", text: "Penalties for non-compliance" },
      {
        type: "p",
        text: "An underpayment is a strict-liability offence under Section 23 of Act 732. Each affected month per worker is a separate offence, and the maximum fine has risen to RM 10,000 per offence. Repeat offences double the fine and can attract a daily continuing penalty.",
      },
      { type: "h2", text: "How MWMS Payroll guards the floor" },
      {
        type: "p",
        text: "Payroll inside MWMS rejects any net-of-allowance basic wage below the prevailing MWO. Sectoral overrides — plantation, security, shop — are configurable so multi-sector employers do not accidentally apply the wrong floor.",
      },
    ],
  },
  {
    slug: "sexual-harassment-act-2022-employer-duties-malaysia",
    title: "Anti-Sexual Harassment Act 2022 — What Employers Must Do",
    description:
      "Practical guide to the Anti-Sexual Harassment Act 2022, the new Tribunal, and the workplace policy duties imposed on every employer.",
    heroImage:
      "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Legal",
    publishedAt: "2025-08-01",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "The Anti-Sexual Harassment Act 2022 (Act 840) came into force in March 2024. It complements the existing Section 81A of the Employment Act and creates a dedicated Tribunal for Anti-Sexual Harassment that any worker — including a migrant worker — may approach without an employer-side process being exhausted first.",
      },
      { type: "h2", text: "Workplace policy obligations" },
      {
        type: "ul",
        items: [
          "Issue a written anti-sexual-harassment policy",
          "Display the policy at every worksite in the languages spoken by workers",
          "Run a mandatory induction covering definitions and reporting channels",
          "Maintain a confidential reporting channel insulated from line management",
          "Investigate every complaint within 60 days, with documented outcomes",
        ],
      },
      { type: "h2", text: "What the Tribunal can order" },
      {
        type: "p",
        text: "The Tribunal sits in regional centres and adjudicates on a balance-of-probabilities standard. It can order monetary compensation up to RM 250,000 per case, a written apology, and corrective action by the employer. Tribunal decisions are filed in the High Court and are enforceable like any civil judgment.",
      },
      { type: "h2", text: "Migrant workers — the language and access barrier" },
      {
        type: "p",
        text: "Migrant workers are statistically over-represented as victims and under-represented as complainants. The 2022 Act explicitly removes barriers to access — translation services are free at the Tribunal, and complainants cannot be retaliated against by way of permit cancellation while a case is pending.",
      },
      {
        type: "quote",
        text: "A workplace that handles its first sexual-harassment complaint well rarely sees a second one — the response, not the policy, is what shifts the culture.",
        cite: "MWMS Legal",
      },
      { type: "h2", text: "Reporting flow inside MWMS" },
      {
        type: "p",
        text: "The Complaint module supports a confidential category that bypasses immediate line management and routes directly to the appointed officer. Multilingual templates and immutable timestamps mean the audit trail meets the Tribunal's evidentiary standard out of the box.",
      },
    ],
  },
  {
    slug: "industrial-court-foreign-workers-malaysia",
    title: "Industrial Court for Foreign Workers — Filing, Evidence, and Awards",
    description:
      "How the Industrial Relations Act 1967 protects migrant workers from unfair dismissal — the 60-day window, evidence prep, and typical awards.",
    heroImage:
      "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Legal",
    publishedAt: "2025-08-15",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "The Industrial Relations Act 1967 (IRA) protects every employee from dismissal without just cause or excuse — and the Federal Court has consistently confirmed that this protection extends to foreign workers on PLKS. The 2020 amendments removed the Minister's gatekeeping role and gave direct access to the Industrial Court.",
      },
      { type: "h2", text: "The 60-day filing window" },
      {
        type: "p",
        text: "A dismissed worker has 60 days from the dismissal date to lodge a representation under Section 20 of the IRA at the nearest Department of Industrial Relations (JPP) office. Missing the window is fatal — extensions are not granted on hardship grounds.",
      },
      { type: "h2", text: "Evidence the Court expects" },
      {
        type: "ul",
        items: [
          "Show-cause letters and written responses",
          "Domestic inquiry minutes, if held",
          "Attendance and overtime records covering the disputed period",
          "Pay slips and any final settlement document",
          "Termination letter stating the grounds",
        ],
      },
      { type: "h2", text: "Typical awards in 2025" },
      {
        type: "ul",
        items: [
          "Reinstatement with back wages capped at 24 months",
          "Compensation in lieu of reinstatement at one month's wage per year of service",
          "Costs against the employer in egregious cases",
          "Mandatory wage settlement before repatriation in foreign-worker cases",
        ],
      },
      { type: "h2", text: "Practical points unique to migrant workers" },
      {
        type: "p",
        text: "Repatriation does not extinguish the claim — Industrial Court hearings can proceed by video link from the source country. Permit cancellation while a representation is pending is treated as victimisation under Section 20 and weakens the employer's defence considerably.",
      },
      { type: "h2", text: "What MWMS preserves automatically" },
      {
        type: "p",
        text: "Every disciplinary letter, attendance log, and payroll record sits behind an immutable timestamp inside MWMS. When an unfair-dismissal case lands, the entire 36-month evidence pack is exportable as a signed PDF and meets the Industrial Court's evidentiary standard.",
      },
    ],
  },
  {
    slug: "jtksm-inspection-preparation-malaysia",
    title: "JTKSM Inspections — How to Prepare and Pass First Time",
    description:
      "Inside view of a JTKSM labour inspection — the documents officers ask for, the typical findings, and how to get a clean closure letter.",
    heroImage:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-08-29",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "A JTKSM (Department of Labour) inspection is the single most consequential compliance event for any employer of migrant workers. Inspections are mostly unannounced, may last from a few hours to a full week, and end with a written closure letter that becomes part of the employer's permanent record.",
      },
      { type: "h2", text: "What inspectors typically ask for" },
      {
        type: "ul",
        items: [
          "Worker register with passport, PLKS, and FOMEMA details",
          "Time records covering the previous 36 months",
          "Wage register with payslip copies and bank acknowledgements",
          "Employment contracts in the worker's language",
          "Accommodation Certificate (CFA) and dormitory register",
          "Levy receipts and SOCSO contribution records",
          "Recruitment file — agency contract, demand letter, source-country docs",
        ],
      },
      { type: "h2", text: "The five most common adverse findings" },
      {
        type: "ul",
        items: [
          "Wages paid late or below the prevailing MWO",
          "Overtime exceeding the 104-hour monthly cap",
          "Levy or recruitment fee deducted from worker wages",
          "Accommodation occupancy above the four-per-room ceiling",
          "Permit holders working in a sector different from the approved one",
        ],
      },
      { type: "h2", text: "How to behave during the visit" },
      {
        type: "p",
        text: "Cooperation is mandatory under Section 65 of the Employment Act. Refusing access, withholding documents, or coaching workers during the inspection elevates the case from administrative to criminal. A nominated compliance officer should accompany inspectors throughout, take contemporaneous notes, and request the inspector's identification card before disclosing sensitive records.",
      },
      { type: "h2", text: "Closing the file cleanly" },
      {
        type: "p",
        text: "If findings are issued, the remediation notice gives 30 to 90 days. Submitting evidence of correction promptly — and asking for a re-inspection rather than waiting for the next cycle — is the fastest route to a clean closure letter that you can file alongside next year's quota application.",
      },
      {
        type: "quote",
        text: "Inspections are won at the filing cabinet, not at the front gate — the day-to-day discipline is what saves you.",
        cite: "MWMS Compliance Desk",
      },
      { type: "h2", text: "Inspection-ready inside MWMS" },
      {
        type: "p",
        text: "Selecting an inspection date in MWMS auto-generates the seven core registers JTKSM requests. Workers, contracts, attendance, payroll, levy, SOCSO, and accommodation are exported in a single bundle that mirrors the JTKSM inspection checklist row for row.",
      },
    ],
  },
  {
    slug: "source-country-mou-bangladesh-indonesia-nepal",
    title: "Source-Country MoUs — Bangladesh, Indonesia, Nepal",
    description:
      "What the bilateral MoUs governing recruitment from Bangladesh, Indonesia, and Nepal mean in practice — wage floors, fee responsibility, and grievance routes.",
    heroImage:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-09-12",
    readingMinutes: 8,
    body: [
      {
        type: "p",
        text: "Recruitment from Malaysia's largest source countries is structured by Government-to-Government MoUs that sit on top of domestic law. The Bangladesh MoU (renewed 2021), the Indonesia MoU (renewed 2022 with a separate Domestic Worker Protocol in 2023), and the Nepal MoU (renewed 2018, paused 2023, resumed 2024) each impose specific obligations on Malaysian employers.",
      },
      { type: "h2", text: "Common features across all three MoUs" },
      {
        type: "ul",
        items: [
          "Recruitment fees are payable by the Malaysian employer, not the worker",
          "Standardised contracts published by the source-country labour ministry",
          "Mandatory pre-departure orientation in the worker's language",
          "Source-country insurance to cover repatriation and welfare in Malaysia",
          "Bilateral grievance committees that meet at least annually",
        ],
      },
      { type: "h3", text: "Bangladesh — the all-cost-to-employer principle" },
      {
        type: "p",
        text: "Under the 2021 MoU the employer covers visa, return airfare, FOMEMA, levy, insurance, and PLKS — explicitly with no recovery from the worker. The Bangladesh High Commission runs an attestation step on the demand letter that must precede VDR issuance.",
      },
      { type: "h3", text: "Indonesia — the One-Channel System" },
      {
        type: "p",
        text: "All Indonesian worker placements flow through SISKOP2MI, the One-Channel system maintained by BP2MI. Employers cannot bypass the system even when working with a private Malaysian agency. The Domestic Worker Protocol caps monthly working hours and enforces a separate minimum wage of RM 1,500 plus food and lodging.",
      },
      { type: "h3", text: "Nepal — the post-2024 e-Visa flow" },
      {
        type: "p",
        text: "After the 2023 pause, the resumed flow uses a fully digital e-visa with end-to-end traceability. Recruitment fees from the worker side are zero — the Nepal Foreign Employment Board enforces the policy strictly and has revoked agency licences for documented breaches.",
      },
      { type: "h2", text: "Where the source-country embassy fits in" },
      {
        type: "p",
        text: "All three embassies operate active labour-attaché desks in Kuala Lumpur. They handle attestation, complaint reception, and welfare visits. Employers running large workforces should map the embassy contact list as a routine part of HR operations.",
      },
      { type: "h2", text: "Embassy linkage in MWMS" },
      {
        type: "p",
        text: "MWMS supports source-country and destination-country embassy logins. Workers raising a complaint can flag visibility to their embassy, who then sees the dispute thread, evidence, and employer responses without needing the employer's permission.",
      },
    ],
  },
  {
    slug: "employer-of-record-vs-direct-hiring-malaysia",
    title: "Employer of Record vs Direct Hiring in Malaysia — When Each Wins",
    description:
      "How EOR arrangements work for foreign workers in Malaysia, the legal limits, and a side-by-side comparison with direct hiring on the employer's quota.",
    heroImage:
      "https://images.unsplash.com/photo-1521737852567-6949f3f9f2b5?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-09-26",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "The Employer of Record (EOR) model — where a third party legally employs the worker and supplies labour to a host company — has grown rapidly in Malaysia, particularly in services and project-based construction. The model is lawful, but its boundary with the prohibited 'contractor for labour' arrangement under the Employment Act is narrower than most operators realise.",
      },
      { type: "h2", text: "What EOR is and is not" },
      {
        type: "p",
        text: "EOR is a tripartite arrangement: the EOR holds the PLKS quota, signs the employment contract, processes payroll, and pays statutory contributions. The host company directs day-to-day work. EOR is not labour outsourcing — the host cannot exercise authority over wage rates or working hours, which remain the EOR's responsibility.",
      },
      { type: "h2", text: "Direct hiring at a glance" },
      {
        type: "ul",
        items: [
          "Quota approval and levy paid by the hiring company",
          "Worker is legally employed by the company that benefits from the work",
          "Single-employer audit trail — simpler for ATIPSOM defence",
          "All compliance burden sits with the hiring company",
        ],
      },
      { type: "h2", text: "EOR at a glance" },
      {
        type: "ul",
        items: [
          "EOR holds the quota and the contractual employer relationship",
          "Host company pays a service fee that bundles wage, levy, and margin",
          "Faster to scale up and down than direct hiring",
          "Audit chain is longer — host must still document working conditions",
        ],
      },
      { type: "h2", text: "Where EOR most often goes wrong" },
      {
        type: "ul",
        items: [
          "Host company sets disciplinary policy and dismisses workers — converts the EOR into a sham",
          "EOR fails to remit SOCSO or levy on time and the host inherits enforcement risk",
          "Workers report to the host's HR for grievances — fragments the audit trail",
          "Source-country fees pushed onto the worker by the EOR's sub-agent",
        ],
      },
      { type: "h2", text: "Picking the right model" },
      {
        type: "p",
        text: "EOR wins for short-duration projects, multi-state operations, and businesses with no in-house migrant-worker compliance capability. Direct hiring wins for stable, single-site operations with HR maturity and a long-term workforce. A hybrid — direct hiring for the core, EOR for ramp — is increasingly common.",
      },
      { type: "h2", text: "MWMS for both models" },
      {
        type: "p",
        text: "Agencies operating as EORs use MWMS in agency mode and link to multiple employer accounts. Direct-hire companies use the employer mode. In both cases the worker app, attendance, and payroll experience are identical — the audit trail follows the worker, not the contracting party.",
      },
    ],
  },
  {
    slug: "osha-1994-foreign-worker-compliance-malaysia",
    title: "OSHA 1994 — Foreign Worker Safety Compliance for Malaysian Employers",
    description:
      "What the 2022 amendments to the Occupational Safety and Health Act 1994 mean for migrant workforces — risk assessments, training, and reporting duties.",
    heroImage:
      "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Compliance Desk",
    publishedAt: "2025-10-10",
    readingMinutes: 7,
    body: [
      {
        type: "p",
        text: "The 2022 amendments to the Occupational Safety and Health Act 1994 (OSHA) — fully in force from June 2024 — extend coverage to every workplace in Malaysia, including those previously out of scope, and apply equally to citizens and migrant workers. The amendments raise penalties tenfold and introduce a duty of care that is now actionable in tort.",
      },
      { type: "h2", text: "Headline duties of every employer" },
      {
        type: "ul",
        items: [
          "Conduct a written hazard identification, risk assessment, and risk control (HIRARC) for every task",
          "Appoint an Occupational Safety and Health Coordinator (OSHC) at any workplace with five or more workers",
          "Provide and document personal protective equipment (PPE) free of charge",
          "Run safety inductions in the worker's language within the first week",
          "Maintain a nearest-clinic and nearest-hospital chart at every worksite",
        ],
      },
      { type: "h2", text: "The new duty of care to non-employees" },
      {
        type: "p",
        text: "The 2022 amendment imports a UK-style duty of care to anyone affected by the employer's operations — sub-contractors, visitors, and members of the public. Construction principals who used to push safety obligations down to sub-contractors are now directly responsible if those sub-contractors employ migrant workers exposed to harm.",
      },
      { type: "h2", text: "Reporting obligations after an incident" },
      {
        type: "ul",
        items: [
          "Death or serious bodily injury — report to DOSH within 7 days using JKKP 6",
          "Dangerous occurrence (e.g. crane collapse) — report within 7 days even without injury",
          "Occupational disease — report within 7 days of medical confirmation",
          "Maintain an Accident Book on site for the previous 5 years",
        ],
      },
      { type: "h2", text: "Penalties under the new tariff" },
      {
        type: "p",
        text: "Maximum corporate fines have risen to RM 500,000 per offence with 2 years' imprisonment for officers. Repeat offences double the fine. DOSH may also issue a Prohibition Notice that halts work on the spot — the commercial cost of even a 24-hour stoppage now exceeds the historical fine in most projects.",
      },
      { type: "h2", text: "Safety logging in MWMS" },
      {
        type: "p",
        text: "MWMS captures HIRARC sign-offs, PPE issue records, induction completion, and incident reports against each worker and worksite. JKKP-format exports are generated automatically when a reportable incident is logged, cutting the post-incident administrative burden by hours.",
      },
    ],
  },
  {
    slug: "digitising-hr-migrant-workforces-roi-audit",
    title: "Digitising HR for Migrant Workforces — ROI and Audit Readiness",
    description:
      "Why migrant-employer HR is moving from spreadsheets to platforms — and the measurable returns in compliance, audit response time, and worker retention.",
    heroImage:
      "https://images.unsplash.com/photo-1551836022-b06985bceb24?auto=format&fit=crop&w=1600&q=80",
    author: "MWMS Editorial",
    publishedAt: "2025-10-24",
    readingMinutes: 6,
    body: [
      {
        type: "p",
        text: "Spreadsheet-based HR scales to roughly 50 migrant workers before the cracks show. Beyond that, expiry tracking, payroll variance, and audit-pack production become full-time jobs that absorb the very HR capacity meant to drive the business. Digitising HR is no longer an aspiration — it is a precondition for staying compliant at scale.",
      },
      { type: "h2", text: "Where digital platforms pay back" },
      {
        type: "ul",
        items: [
          "Permit and FOMEMA expiry alerts at 90/60/30 days — eliminates lapsed-permit fines",
          "Single source of truth for worker, employer, and agency views",
          "Payroll variance reports that catch underpayment before JTKSM does",
          "Audit packs assembled in minutes instead of days",
          "Worker-facing complaint and dispute channels that meet ATIPSOM evidentiary standards",
        ],
      },
      { type: "h2", text: "Typical 12-month ROI in 2025" },
      {
        type: "p",
        text: "Across MWMS deployments in manufacturing and services, the recurring savings track three drivers: avoided permit-lapse fines (averaging RM 18,000 per 100-worker site annually), audit-prep time reduction (from 6 person-days to 1 person-day per audit), and reduced worker turnover from clearer wage and grievance handling (typically 8 to 12 percentage points).",
      },
      { type: "h2", text: "What auditors now expect to see digitally" },
      {
        type: "ul",
        items: [
          "36 months of attendance records exportable in under 10 minutes",
          "Wage payment proof with bank-side acknowledgement against each pay cycle",
          "Document-return logs at end of contract with worker e-signature",
          "Incident and complaint history per worker and per worksite",
          "Accommodation occupancy snapshots for any historical date",
        ],
      },
      { type: "h2", text: "What to look for in a platform" },
      {
        type: "ul",
        items: [
          "Multilingual worker app — English plus the four core source-country languages",
          "Linkages between agency, employer, embassy, and labour-department roles",
          "Immutable timestamps on every transaction",
          "Offline-tolerant punch-in for remote sites and dormitories",
          "Single-click export packages mirroring JTKSM, DOSH, and brand-audit checklists",
        ],
      },
      {
        type: "quote",
        text: "The platforms that win the next decade will be the ones that make compliance the cheapest path through the day, not a separate workstream bolted onto operations.",
        cite: "MWMS Editorial",
      },
      { type: "h2", text: "Getting started with MWMS" },
      {
        type: "p",
        text: "Onboarding a 100-worker site to MWMS typically takes ten working days — passport and PLKS data import, attendance device pairing, and bank-payroll integration are the main milestones. Worker app rollout follows in week two with multilingual induction sessions delivered through the app itself.",
      },
    ],
  },
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
