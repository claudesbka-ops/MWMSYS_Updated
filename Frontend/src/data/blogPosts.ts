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
];

export function findBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
