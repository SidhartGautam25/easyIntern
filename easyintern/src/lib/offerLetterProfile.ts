import { displayCollegeName } from "@/lib/collegeDisplay";
import { isLnmuStudent } from "@/lib/feeRules";
import { normalizeInternshipMode } from "@/lib/collegeRoster";

/** LNMU internship window (fixed on offer letter). */
export const LNMU_INTERNSHIP_START = "1 June 2026";
export const LNMU_INTERNSHIP_END = "20 June 2026";
export const LNMU_INTERNSHIP_DURATION = "120 Hours";
export const LNMU_STIPEND = "Not Applicable";

export type OfferLetterResolved = {
  isLnmu: boolean;
  letterRefNo: string;
  applicationDateIso: string | null;
  fullName: string;
  /** University / college roll no. from registration (not EZY letter ref). */
  registrationNo: string;
  collegeName: string;
  departmentSemester: string;
  internshipDomain: string;
  internshipDuration: string;
  internshipMode: string;
  startDate: string;
  endDate: string;
  stipend: string;
};

function metaOf(profile: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const m = profile?.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

export function fmtOfferLetterDate(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return fallback;
  }
}

/** Letter ref. for LNMU students: auto-generated EZY registration id at enrolment. */
export function lnmuLetterRefNo(profile: Record<string, unknown> | null | undefined): string {
  const regId = profile?.registration_id;
  if (regId && String(regId).trim()) return String(regId).trim();

  const yr =
    (profile?.created_at && new Date(String(profile.created_at)).getFullYear()) ||
    new Date().getFullYear();
  const raw = String(profile?.id || profile?.user_id || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  const tail = raw ? raw.slice(-6) : Date.now().toString().slice(-6);
  return `EZY/LNMU/${yr}/${tail}`;
}

function formatSemesterLabel(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/semester/i.test(s)) return s;
  if (/^sem\s/i.test(s)) return s.replace(/^sem\s/i, "Semester ");
  return `Semester ${s}`;
}

function lnmuDepartmentSemester(profile: Record<string, unknown>, m: Record<string, unknown>): string {
  const subject = String(profile.subject || m.subject || "").trim();
  const semesterRaw = String(
    profile.class_semester || profile.class_sem || m.semester || m.classSem || ""
  ).trim();
  const sem = formatSemesterLabel(semesterRaw);
  if (subject && sem) return `${subject} — ${sem}`;
  return subject || sem || "—";
}

function lnmuCollegeName(profile: Record<string, unknown>, m: Record<string, unknown>): string {
  const raw =
    String(profile.college_name || "").trim() ||
    String(profile.college || m.college || m.college_name || "").trim();
  return displayCollegeName(raw) || "—";
}

function rollRegistrationNo(profile: Record<string, unknown>, m: Record<string, unknown>): string {
  return (
    String(profile.roll_number || "").trim() ||
    String(m.rollNo || m.roll_number || "").trim() ||
    String(profile.registration_number || m.registrationNumber || "").trim() ||
    "—"
  );
}

function internshipDomain(profile: Record<string, unknown>, m: Record<string, unknown>): string {
  return (
    String(profile.internship_domain || "").trim() ||
    String(profile.course || m.course || "").trim() ||
    "—"
  );
}

function applicationDateIso(
  profile: Record<string, unknown>,
  payment?: Record<string, unknown> | null
): string | null {
  const candidates = [
    profile.application_date,
    profile.applied_at,
    profile.created_at,
    payment?.created_at,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c);
  }
  return null;
}

/**
 * Merge student row + payment + metadata for offer letter rendering.
 * LNMU-specific fields follow registration form mapping (requirements 1–12).
 */
export function resolveOfferLetterFields(
  profile: Record<string, unknown> | null | undefined,
  payment?: Record<string, unknown> | null
): OfferLetterResolved {
  const p = profile || {};
  const m = metaOf(p);
  const uni = String(p.university_name || p.university || p.universityName || "");
  const isLnmu = isLnmuStudent(uni);

  const mode =
    normalizeInternshipMode(
      String(p.internship_mode || m.internship_mode || "Online")
    ) || "Online";

  const appIso = applicationDateIso(p, payment);

  if (isLnmu) {
    return {
      isLnmu: true,
      letterRefNo: lnmuLetterRefNo(p),
      applicationDateIso: appIso,
      fullName: String(p.full_name || "—").trim() || "—",
      registrationNo: rollRegistrationNo(p, m),
      collegeName: lnmuCollegeName(p, m),
      departmentSemester: lnmuDepartmentSemester(p, m),
      internshipDomain: internshipDomain(p, m),
      internshipDuration: LNMU_INTERNSHIP_DURATION,
      internshipMode: mode,
      startDate: LNMU_INTERNSHIP_START,
      endDate: LNMU_INTERNSHIP_END,
      stipend: LNMU_STIPEND,
    };
  }

  const department = String(p.department || p.degree || "").trim();
  const semester = String(p.class_semester || p.class_sem || m.semester || m.classSem || "").trim();
  const defaultDepartment =
    `${department}${department && semester ? " — " : ""}${semester ? formatSemesterLabel(semester) : ""}`.trim() ||
    "—";

  return {
    isLnmu: false,
    letterRefNo: String(p.registration_id || "EZY/2026/INT/PENDING"),
    applicationDateIso: appIso,
    fullName: String(p.full_name || "—").trim() || "—",
    registrationNo: rollRegistrationNo(p, m),
    collegeName:
      String(p.college_name || p.college || p.collegeName || "").trim() ||
      String(p.university_name || p.university || "").trim() ||
      "N/A",
    departmentSemester: defaultDepartment,
    internshipDomain:
      String(p.course || p.internship_domain || m.course || "General Training").trim() ||
      "General Training",
    internshipDuration: String(p.internship_duration || "120 Hours"),
    internshipMode: mode,
    startDate: fmtOfferLetterDate(
      String(p.joining_date || ""),
      "Programme dates will be confirmed by your coordinator."
    ),
    endDate: fmtOfferLetterDate(
      String(p.completion_date || ""),
      "As per academic internship completion norms."
    ),
    stipend: "Not Applicable — Academic Programme",
  };
}

/** Normalize raw student + optional payment row before passing to OfferLetter. */
export function normalizeOfferLetterProfile(
  profile: Record<string, unknown> | null | undefined,
  payment?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!profile) return {};
  const m = metaOf(profile);
  const mode =
    normalizeInternshipMode(String(profile.internship_mode || m.internship_mode || "")) || "Online";
  const payCreated = payment?.created_at ? String(payment.created_at) : null;

  return {
    ...profile,
    internship_mode: mode,
    application_date: profile.application_date || profile.applied_at || profile.created_at || payCreated,
    metadata: {
      ...m,
      ...(mode ? { internship_mode: mode } : {}),
    },
  };
}
