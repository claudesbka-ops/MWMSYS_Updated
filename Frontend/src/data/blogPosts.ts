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
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
