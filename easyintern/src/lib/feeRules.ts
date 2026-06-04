/**
 * Fee resolution + breakdown shown to learners.
 *
 * LNMU (Lalit Narayan Mithila University and related patterns):
 *   Default: ₹549 total — ₹500 course fee + ₹49 processing (shown as breakdown when applicable).
 *   R. B. College, Dalsinghsarai: flat ₹500 total (no separate processing line in UI).
 *   BM College, Rahika: flat ₹500 total (same as above).
 *   Millat College: flat ₹500 total.
 *   MRSM College: flat ₹499 total.
 *   G.K.P.D. College, Karpoori Gram, Samastipur: ₹549 (₹500 registration + ₹49 processing).
 *   Exceptions (pricing unchanged vs this default): Marwari College, JK College Biraul,
 *   R.C.S.S. College Bihat, MRJD Begusarai — each keeps its existing published total (₹600 with ₹49 component where used).
 *
 * BNMU (Bhupendra Narayan Mandal University):
 *   Listed colleges: flat ₹249 total (no processing line in UI).
 *   Other BNMU colleges: use `pisa_fee` from DB.
 *
 * Non-LNMU/LNMU/BNMU listed: use `finalAmountPaise` from college/university/payment_config.
 */

export type FeeBreakdown = {
  totalPaise: number;
  basePaise: number;
  gstPaise: number;
  hasBreakdown: boolean;
  label?: string;
  note?: string;
  componentLineLabels?: { base: string; gst: string };
};

/** Per-college fee config stored in `colleges` (admin / migration backfill). */
export type CollegeFeeFields = {
  pisa_fee?: number | null;
  fee_base_paise?: number | null;
  fee_processing_paise?: number | null;
  show_fee_breakdown?: boolean | null;
  fees_managed?: boolean | null;
};

const DEFAULT_LINE_LABELS = {
  base: "Registration fee",
  gst: "Processing fee",
} as const;

const LNMU_PATTERNS = [
  /lalit\s*narayan/i,
  /lnmu/i,
  /mithila/i,
];

const BNMU_PATTERNS = [/bnmu/i, /bhupendra\s*narayan\s*mandal/i];

/** BNMU colleges with flat ₹249 total. */
const BNMU_FLAT_249_COLLEGES: FlatFeeEntry[] = [
  {
    patterns: [/tekriwal|m\.?\s*l\.?\s*t/i],
    label: "Manohar Lal Tekriwal (MLT) College, Saharsa",
    totalPaise: 24900,
    gstPaise: 0,
    note: "Flat registration fee ₹249.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
  {
    patterns: [/sarb\s*narayan/i, /ram\s*kumar/i],
    label: "Sarb Narayan Singh Ram Kumar Singh College, Saharsa",
    totalPaise: 24900,
    gstPaise: 0,
    note: "Flat registration fee ₹249.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
  {
    patterns: [/vanijya/i, /madhepura/i],
    label: "Bhupendra Narayan Mandal Vanijya Mahavidyalaya, Madhepura",
    totalPaise: 24900,
    gstPaise: 0,
    note: "Flat registration fee ₹249.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
];

type FlatFeeEntry = {
  patterns: RegExp[];
  label: string;
  totalPaise: number;
  gstPaise: number;
  note?: string;
  componentLineLabels?: { base: string; gst: string };
};

/** LNMU colleges with a flat ₹500 total (overrides ₹549 default; checked before ₹600 exceptions). */
const LNMU_FLAT_500_COLLEGES: FlatFeeEntry[] = [
  {
    patterns: [/dalsinghsarai|dalsighsarai/i, /r[\s.]*b/i],
    label: "R. B. College, Dalsinghsarai",
    totalPaise: 50000,
    gstPaise: 0,
    note: "Flat registration fee ₹500.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
  {
    patterns: [/rahika/i, /b[\s.]*m/i],
    label: "BM College, Rahika",
    totalPaise: 50000,
    gstPaise: 0,
    note: "Flat registration fee ₹500.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
  {
    patterns: [/millat/i],
    label: "Millat College",
    totalPaise: 50000,
    gstPaise: 0,
    note: "Flat registration fee ₹500.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
];

/** LNMU colleges with a flat ₹499 total (checked after ₹500 list, before ₹600 exceptions). */
const LNMU_FLAT_499_COLLEGES: FlatFeeEntry[] = [
  {
    patterns: [/mrsm/i],
    label: "MRSM College",
    totalPaise: 49900,
    gstPaise: 0,
    note: "Flat registration fee ₹499.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
];

/** LNMU colleges: ₹500 registration + ₹49 processing (₹549 total, shown as breakdown). */
const LNMU_REGISTRATION_549_COLLEGES: FlatFeeEntry[] = [
  {
    patterns: [/karpoori/i, /g[\s.]*k[\s.]*p[\s.]*d/i],
    label: "G.K.P.D. College, Karpoori Gram, Samastipur",
    totalPaise: 54900,
    gstPaise: 4900,
    note: "Registration fee ₹500 + ₹49 processing.",
    componentLineLabels: { base: "Registration fee", gst: "Processing fee" },
  },
];

/** LNMU colleges that do NOT use the ₹549 default (keep prior pricing). */
const LNMU_EXCEPTION_COLLEGES: FlatFeeEntry[] = [
  {
    patterns: [/marwari/i],
    label: "Marwari College",
    totalPaise: 60000,
    gstPaise: 4900,
    note: "Includes ₹49 GST + processing charges.",
    componentLineLabels: { base: "Registration fee", gst: "Processing charge" },
  },
  /** DB name e.g. `J. K. College, Biraul, Darbhanga` — must match dotted "J. K." not only `JK`. */
  {
    patterns: [/biraul/i, /j[\s.]*k/i],
    label: "JK College, Biraul",
    totalPaise: 60000,
    gstPaise: 4900,
    note: "Includes ₹49 GST + processing charges.",
    componentLineLabels: { base: "Registration fee", gst: "Processing charge" },
  },
  /** Matches `RCSS` or spaced/dotted `R.C.S.S.` etc. */
  {
    patterns: [/bihat/i, /r[\s.]*c[\s.]*s[\s.]*s/i],
    label: "R.C.S.S. College, Bihat",
    totalPaise: 60000,
    gstPaise: 4900,
    note: "Includes ₹49 GST + processing charges.",
    componentLineLabels: { base: "Registration fee", gst: "Processing charge" },
  },
  {
    patterns: [/begusarai/i, /m[\s.]*r[\s.]*j[\s.]*d/i],
    label: "MRJD, Begusarai",
    totalPaise: 60000,
    gstPaise: 4900,
    note: "Includes ₹49 GST + processing charges.",
    componentLineLabels: { base: "Registration fee", gst: "Processing charge" },
  },
];

const LNMU_DEFAULT_FLAT: FlatFeeEntry = {
  patterns: [],
  label: "LNMU internship enrolment",
  totalPaise: 54900,
  gstPaise: 4900,
  note: "Course fee ₹500 + ₹49 processing.",
  componentLineLabels: { base: "Course fee", gst: "Processing fee" },
};

function matchesAny(value: string | undefined | null, patterns: RegExp[]): boolean {
  if (!value) return false;
  return patterns.some((p) => p.test(value));
}

function matchesAll(value: string | undefined | null, patterns: RegExp[]): boolean {
  if (!value) return false;
  return patterns.every((p) => p.test(value));
}

function matchBnmuFlatFeeCollege(
  uniName?: string | null,
  collegeName?: string | null
): FlatFeeEntry | null {
  if (!matchesAny(uniName, BNMU_PATTERNS)) return null;
  for (const entry of BNMU_FLAT_249_COLLEGES) {
    if (matchesAll(collegeName, entry.patterns)) {
      return entry;
    }
  }
  return null;
}

function matchLnmuFlatFeeCollege(
  uniName?: string | null,
  collegeName?: string | null
): FlatFeeEntry | null {
  if (!matchesAny(uniName, LNMU_PATTERNS)) return null;
  for (const entry of LNMU_FLAT_500_COLLEGES) {
    if (matchesAll(collegeName, entry.patterns)) {
      return entry;
    }
  }
  for (const entry of LNMU_FLAT_499_COLLEGES) {
    if (matchesAll(collegeName, entry.patterns)) {
      return entry;
    }
  }
  for (const entry of LNMU_REGISTRATION_549_COLLEGES) {
    if (matchesAll(collegeName, entry.patterns)) {
      return entry;
    }
  }
  for (const entry of LNMU_EXCEPTION_COLLEGES) {
    if (matchesAll(collegeName, entry.patterns)) {
      return entry;
    }
  }
  return LNMU_DEFAULT_FLAT;
}

function matchInstitutionFlatFeeCollege(
  uniName?: string | null,
  collegeName?: string | null
): FlatFeeEntry | null {
  return matchBnmuFlatFeeCollege(uniName, collegeName) ?? matchLnmuFlatFeeCollege(uniName, collegeName);
}

export function isBnmuStudent(uniName?: string | null): boolean {
  return matchesAny(uniName, BNMU_PATTERNS);
}

export function isLnmuMarwari(uniName?: string | null, collegeName?: string | null): boolean {
  return matchesAny(uniName, LNMU_PATTERNS) && matchesAny(collegeName, [/marwari/i]);
}

export function isLnmuFlatFeeCollege(uniName?: string | null, collegeName?: string | null): boolean {
  return matchLnmuFlatFeeCollege(uniName, collegeName) !== null;
}

export function isLnmuStudent(uniName?: string | null): boolean {
  return matchesAny(uniName, LNMU_PATTERNS);
}

function computeFeeBreakdownFromDb(college: CollegeFeeFields): FeeBreakdown | null {
  if (!college.fees_managed) return null;

  const total = Math.max(0, Math.floor(college.pisa_fee ?? 0));
  const processing = Math.max(0, Math.floor(college.fee_processing_paise ?? 0));
  const showBreakdown = !!college.show_fee_breakdown && processing > 0;
  const baseFromCol =
    college.fee_base_paise != null
      ? Math.max(0, Math.floor(college.fee_base_paise))
      : Math.max(0, total - processing);

  if (total <= 0) return null;

  return {
    totalPaise: total,
    basePaise: showBreakdown ? baseFromCol : total,
    gstPaise: showBreakdown ? processing : 0,
    hasBreakdown: showBreakdown,
    componentLineLabels: DEFAULT_LINE_LABELS,
  };
}

export function computeFeeBreakdown(
  uniName: string | undefined | null,
  collegeName: string | undefined | null,
  finalAmountPaise: number,
  collegeFee?: CollegeFeeFields | null
): FeeBreakdown {
  const fromDb = collegeFee ? computeFeeBreakdownFromDb(collegeFee) : null;
  if (fromDb) return fromDb;

  const flat = matchInstitutionFlatFeeCollege(uniName, collegeName);
  if (flat) {
    const total = flat.totalPaise;
    const gst = flat.gstPaise;
    return {
      totalPaise: total,
      basePaise: Math.max(0, total - gst),
      gstPaise: gst,
      hasBreakdown: gst > 0,
      label: `${flat.label} — Internship enrolment`,
      note: flat.note,
      componentLineLabels: flat.componentLineLabels,
    };
  }

  return {
    totalPaise: Math.max(0, Math.floor(finalAmountPaise || 0)),
    basePaise: Math.max(0, Math.floor(finalAmountPaise || 0)),
    gstPaise: 0,
    hasBreakdown: false,
    componentLineLabels: DEFAULT_LINE_LABELS,
  };
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
