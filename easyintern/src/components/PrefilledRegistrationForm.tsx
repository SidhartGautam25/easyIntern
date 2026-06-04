import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { formatRupees } from "@/lib/feeRules";
import { resolveStudentFeeBreakdown } from "@/lib/collegeFees";
import { runClientRazorpayCheckout } from "@/lib/clientRazorpayPayment";
import { withStoredDirectoryPassword } from "@/lib/studentCredentials";
import { displayCollegeName } from "@/lib/collegeDisplay";
import {
  checkStudentRegistrationAvailable,
  registrationFieldErrors,
} from "@/lib/registrationAvailability";
import {
  deriveSessionFromDate,
  inferDepartmentFromSubject,
  normalisePhone,
  normalizeDegree,
  normalizeDepartment,
  normalizeGender,
  normalizeSemester,
  normalizeSession,
  parseRollNumberHints,
  subjectCodeToCanonical,
} from "@/lib/collegeRoster";
import { createEphemeralSupabaseAuthClient } from "@/lib/createSubUser";
import { getSendMailApiUrl } from "@/lib/sendMailApi";
import { buildStudentCredentialLoginLink } from "@/lib/authRoutes";

interface University { id: string; name: string; pisa_fee?: number }
interface College {
  id: string;
  name: string;
  university_id: string;
  pisa_fee?: number;
  fee_base_paise?: number | null;
  fee_processing_paise?: number | null;
  show_fee_breakdown?: boolean | null;
  fees_managed?: boolean | null;
}
interface InternshipDomain { id: string; name: string }

/**
 * Pull the first matching value out of a CSV row's `raw_data` blob. Keys are
 * matched case-insensitively against the supplied regex patterns. Used to
 * auto-extract contact / email from common CSV column variations like
 * `"Mobile"`, `"Whatsapp Mobile No"`, `"Phone"`, `"Current Email"`, etc.
 */
function pickRaw(raw: any, patterns: RegExp[]): string {
  if (!raw || typeof raw !== "object") return "";
  for (const key of Object.keys(raw)) {
    for (const p of patterns) {
      if (p.test(key)) {
        const v = raw[key];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          return String(v).trim();
        }
      }
    }
  }
  return "";
}

export interface PrefilledStudent {
  id?: string;
  reference_number: string;
  full_name?: string;
  father_name?: string;
  gender?: string;
  dob?: string;
  university_id?: string | null;
  university_name?: string;
  college_id?: string | null;
  college_name?: string;
  degree?: string;
  department?: string;
  subject?: string;
  session?: string;
  semester?: string;
  internship_domain?: string;
  raw_data?: any;
}

interface PrefilledRegistrationFormProps {
  data: PrefilledStudent;
  /** Optional cyber-café context (carries shop_name + email to attach to the student row). */
  cybercafeProfile?: { shop_name?: string; email?: string } | null;
  onSuccess?: () => void;
  /** Cyber cafe: open a fresh form for the next student. */
  onRegisterAnother?: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const PrefilledRegistrationForm = ({
  data,
  cybercafeProfile,
  onSuccess,
  onRegisterAnother,
}: PrefilledRegistrationFormProps) => {
  const navigate = useNavigate();
  const isCyberCafeMode = !!cybercafeProfile?.email;
  const [unis, setUnis] = useState<University[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [internshipDomains, setInternshipDomains] = useState<InternshipDomain[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Pull values out of the CSV's raw_data blob using header heuristics. The
  // roster table only indexes a handful of columns, so values like Mobile,
  // Programme Name, Major Subject etc. live inside the JSONB `raw_data` —
  // and even the indexed columns may have been left blank by an older
  // import. We always use the typed top-level value first and fall back
  // to a raw lookup so already-imported rows still autofill cleanly.
  const rawContact = useMemo(
    () => normalisePhone(pickRaw(data.raw_data, [
      /^mobile$/i,
      /^mob(ile)?\s*no/i,
      /^contact/i,
      /^phone/i,
      /^whats\s*app\s*mobile/i,
      /^whatsapp/i,
    ])),
    [data.raw_data]
  );
  const rawEmail = useMemo(
    () => pickRaw(data.raw_data, [
      /^current\s*email/i,
      /^email/i,
      /^e[-_\s]?mail/i,
    ]).trim().toLowerCase(),
    [data.raw_data]
  );
  const rawDob = useMemo(
    () =>
      data.dob ||
      pickRaw(data.raw_data, [
        /^dob$/i,
        /date[\s_-]*of[\s_-]*birth/i,
        /birth[\s_-]*date/i,
      ]),
    [data.dob, data.raw_data]
  );

  // The Marwari-style roll number ("MWC/23-27/SEM I/ACC/35") encodes session,
  // semester and a subject hint. We pull all three out at once and use them as
  // last-resort fallbacks so even rosters with sparse columns still autofill.
  const rollNoText = useMemo(
    () =>
      pickRaw(data.raw_data, [
        /^roll(\s*no)?$/i,
        /roll[\s_-]*number/i,
        /^receipt$/i,
        /admission[\s_-]*no/i,
      ]) || data.reference_number || "",
    [data.raw_data, data.reference_number]
  );
  const rollHints = useMemo(() => parseRollNumberHints(rollNoText), [rollNoText]);
  const rollSubjectCanon = useMemo(
    () => subjectCodeToCanonical(rollHints.subjectCode),
    [rollHints.subjectCode]
  );

  // The CSV's Date column is a payment/admission date — convert the year+month
  // into the academic session range (Jul-Jun → 4-year UG span).
  const dateText = useMemo(
    () =>
      pickRaw(data.raw_data, [
        /^date$/i,
        /admission[\s_-]*date/i,
        /payment[\s_-]*date/i,
        /enrol+ment[\s_-]*date/i,
      ]),
    [data.raw_data]
  );

  // Subject — try indexed col, then Major Subject in raw_data, then derived
  // from the subject-code in the roll number (e.g. "PSY/1" → Psychology).
  const rawSubject = useMemo(
    () =>
      data.subject ||
      pickRaw(data.raw_data, [
        /major[\s_-]*subject/i,
        /honou?rs[\s_-]*subject/i,
        /^subject$/i,
        /subject[\s_-]*name/i,
        /^paper$/i,
      ]) ||
      rollSubjectCanon?.subject ||
      "",
    [data.subject, data.raw_data, rollSubjectCanon]
  );

  // Department — explicit column → raw_data → roll-number subject code →
  // inferred from the Major Subject text itself. Final fallback ensures
  // values like "PSYCHOLOGY" resolve to "B.A." even when the CSV has no
  // department/programme column at all.
  const rawDepartment = useMemo(
    () =>
      data.department ||
      pickRaw(data.raw_data, [
        /^department$/i,
        /^dept/i,
        /programme[\s_-]*name/i,
        /^programme$/i,
        /^program$/i,
        /course[\s_-]*enrolled/i,
        /^course$/i,
      ]) ||
      rollSubjectCanon?.department ||
      inferDepartmentFromSubject(rawSubject) ||
      "",
    [data.department, data.raw_data, rollSubjectCanon, rawSubject]
  );
  const rawSession = useMemo(
    () =>
      data.session ||
      pickRaw(data.raw_data, [
        /session[\s_-]*year/i,
        /^session$/i,
        /batch/i,
        /academic[\s_-]*year/i,
      ]) ||
      rollHints.session ||
      deriveSessionFromDate(dateText) ||
      "",
    [data.session, data.raw_data, rollHints.session, dateText]
  );
  // Receipts in admission rosters look like "MWC/DE/23-24/366" — a single
  // academic year (23-24) means "first year of the session". Combined with the
  // Date column (Jul-Dec → odd sem, Jan-Jun → even sem) we can confidently
  // default to Semester 1 (or 2) for fresh admissions.
  const semFromAdmission = useMemo(() => {
    const receipt = pickRaw(data.raw_data, [/^receipt$/i, /receipt[\s_-]*no/i]);
    const isFirstYear = /\b\d{2}\s*[-–]\s*\d{2}\b/.test(receipt);
    if (!isFirstYear) return "";
    const m = dateText.match(/^(\d{4})[-/](\d{1,2})/) ||
      dateText.match(/^\d{1,2}[-/](\d{1,2})[-/](\d{4})/);
    if (m) {
      const month = parseInt(m[2], 10);
      // Jul-Dec = Sem 1 (start of academic year). Jan-Jun = Sem 2.
      if (month >= 7 && month <= 12) return "Semester 1";
      if (month >= 1 && month <= 6) return "Semester 2";
    }
    return "Semester 1";
  }, [data.raw_data, dateText]);

  const rawSemester = useMemo(
    () =>
      data.semester ||
      pickRaw(data.raw_data, [
        /^semester$/i,
        /^sem$/i,
        /current[\s_-]*year/i,
        /study[\s_-]*year/i,
        /^year$/i,
      ]) ||
      rollHints.semester ||
      semFromAdmission ||
      "",
    [data.semester, data.raw_data, rollHints.semester, semFromAdmission]
  );
  const rawDomain = useMemo(
    () =>
      data.internship_domain ||
      pickRaw(data.raw_data, [
        /internship[\s_-]*domain/i,
        /^domain$/i,
        /internship[\s_-]*course/i,
      ]),
    [data.internship_domain, data.raw_data]
  );

  // Pre-fill from the matched row, with light value normalisation so the
  // dropdowns select the option the form actually offers.
  const [fullName, setFullName] = useState(data.full_name || "");
  const [parentName, setParentName] = useState(data.father_name || "");
  const [gender, setGender] = useState<string>(
    normalizeGender(data.gender) || ""
  );
  const [contact, setContact] = useState(rawContact);
  const [email, setEmail] = useState(rawEmail);
  const [dob, setDob] = useState(rawDob);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // University Registration Number — entered manually by the student.
  // Distinct from the lookup `reference_number` (which the operator typed
  // on the previous screen).
  const [universityRegNo, setUniversityRegNo] = useState<string>("");

  // Optional signed consent form (PDF/JPG/PNG ≤ 75 KB).
  const [consentFile, setConsentFile] = useState<File | null>(null);

  const [universityId, setUniversityId] = useState<string>(data.university_id || "");
  const [collegeId, setCollegeId] = useState<string>(data.college_id || "");

  const initialDept = normalizeDepartment(rawDepartment) || "";
  const [degree, setDegree] = useState<string>(
    normalizeDegree(data.degree) || normalizeDegree(rawDepartment) || "UG"
  );
  const [departmentName, setDepartmentName] = useState<string>(initialDept);
  const [subject, setSubject] = useState<string>(
    matchSubjectToOption(rawSubject, initialDept) || ""
  );
  const [session, setSession] = useState<string>(
    normalizeSession(rawSession) || rawSession || ""
  );
  const [classSem, setClassSem] = useState<string>(
    normalizeSemester(rawSemester) || rawSemester || ""
  );

  // Internship domain — full list from `internship_domains`; prefilled value kept if set.
  const domainOptions = useMemo(() => {
    const explicit = rawDomain
      ? rawDomain.split("|").map((d) => d.trim()).filter(Boolean)
      : [];
    const fromDb = internshipDomains.map((d) => d.name);
    const combined = [...new Set([...explicit, ...fromDb])];
    return combined.length ? combined : ["General Training"];
  }, [rawDomain, internshipDomains]);

  const [course, setCourse] = useState<string>(
    () => (rawDomain && rawDomain.split("|")[0]?.trim()) || ""
  );

  // When department changes, drop a Subject value that no longer belongs to the
  // new department's option list (otherwise the dropdown shows the placeholder
  // text and the user is confused).
  useEffect(() => {
    if (!subject) return;
    const options = subjectsFor(departmentName);
    if (options.length && !options.includes(subject)) {
      // Try to re-match the original raw value first; fall back to "".
      const remap = matchSubjectToOption(rawSubject || subject, departmentName);
      setSubject(remap || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentName]);

  useEffect(() => {
    (async () => {
      const [{ data: u }, { data: c }, { data: d }, { data: ps }] = await Promise.all([
        supabase.from("universities").select("id, name, pisa_fee"),
        supabase.from("colleges").select(
          "id, name, university_id, pisa_fee, fee_base_paise, fee_processing_paise, show_fee_breakdown, fees_managed"
        ),
        supabase.from("internship_domains").select("id, name").order("name"),
        supabase.from("public_payment_config").select("*").maybeSingle(),
      ]);
      if (u) setUnis(u as University[]);
      if (c) setColleges(c as College[]);
      if (d) setInternshipDomains(d as InternshipDomain[]);
      if (ps) setPaymentSettings(ps);
    })();
  }, []);

  // Resolve university/college IDs by name if the prefilled row carried only
  // the names (older roster imports may not have the IDs set).
  useEffect(() => {
    if (universityId) return;
    if (!unis.length) return;
    const byName = unis.find(
      (u) =>
        data.university_name &&
        u.name.toLowerCase().includes(data.university_name.toLowerCase())
    );
    if (byName) setUniversityId(byName.id);
  }, [unis, universityId, data.university_name]);

  useEffect(() => {
    if (collegeId) return;
    if (!colleges.length) return;
    const byName = colleges.find(
      (c) =>
        data.college_name &&
        (c.name.toLowerCase().includes(data.college_name.toLowerCase()) ||
          displayCollegeName(c.name).toLowerCase().includes(data.college_name.toLowerCase()))
    );
    if (byName) {
      setCollegeId(byName.id);
      if (!universityId) setUniversityId(byName.university_id);
    }
  }, [colleges, collegeId, data.college_name, universityId]);

  const selectedUni = unis.find((u) => u.id === universityId);
  const selectedCollege = colleges.find((c) => c.id === collegeId);
  const filteredColleges = colleges.filter(
    (c) => !universityId || c.university_id === universityId
  );

  const feeBreakdown = useMemo(
    () =>
      resolveStudentFeeBreakdown(
        selectedUni?.name,
        selectedCollege?.name,
        selectedCollege,
        selectedUni,
        paymentSettings?.amount_paise
      ),
    [selectedCollege, selectedUni, paymentSettings]
  );

  function validate(): string | null {
    if (!fullName.trim()) return "Name is required";
    if (!parentName.trim()) return "Father's name is required";
    if (!gender) return "Gender is required";
    if (!/^\d{10}$/.test(contact.replace(/\D/g, "").slice(-10))) return "Valid 10-digit mobile required";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Valid email required";
    if (!universityRegNo.trim()) return "University Registration Number is required";
    if (!universityId) return "Select a university";
    if (!collegeId) return "Select a college";
    if (!degree) return "Degree is required";
    if (!departmentName) return "Department is required";
    if (!subject) return "Subject is required";
    if (!session) return "Session is required";
    if (!classSem) return "Semester is required";
    if (!course) return "Internship domain is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password !== confirmPw) return "Passwords do not match";
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const availability = await checkStudentRegistrationAvailable(
      supabase,
      email,
      contact
    );
    if (!availability.available) {
      toast.error(
        availability.message ||
          "This email or mobile number is already registered. Sign in if you already have an account."
      );
      return;
    }

    setSubmitting(true);
    try {
      const finalAmount = feeBreakdown.totalPaise;

      // Best-effort consent form upload. Failure is non-blocking — the student
      // can always email the form later. We try the dedicated `consent-forms`
      // bucket first, then fall back to `logos` if the dedicated bucket isn't
      // provisioned.
      let consentFormUrl: string | null = null;
      if (consentFile) {
        const ext = consentFile.name.split(".").pop() || "pdf";
        const safeRef = (data.reference_number || "ref").replace(/[^a-zA-Z0-9_-]/g, "_");
        const filePath = `consent-${safeRef}-${Date.now()}.${ext}`;
        for (const bucket of ["consent-forms", "logos"]) {
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(filePath, consentFile, { upsert: false });
          if (!upErr) {
            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
            consentFormUrl = pub?.publicUrl || null;
            break;
          }
        }
        if (!consentFormUrl) {
          // Non-blocking: continue with payment even if upload failed.
          console.warn("Consent form upload failed; proceeding without it.");
        }
      }

      const normalizedEmail = email.trim().toLowerCase();

      const payResult = await runClientRazorpayCheckout({
        paymentSettings: paymentSettings || {},
        amountPaise: finalAmount,
        prefill: { name: fullName, email: normalizedEmail, contact },
        description: "Internship Registration Fee",
      });

      if (!payResult.success) {
        if (!payResult.cancelled) {
          toast.error("Payment failed. Please try again.");
        }
        return;
      }

      const authClient = isCyberCafeMode ? createEphemeralSupabaseAuthClient() : supabase;
      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) {
        const low = authError.message.toLowerCase();
        if (
          low.includes("already registered") ||
          low.includes("already exists") ||
          authError.code === "user_already_exists"
        ) {
          throw new Error("This email is already registered. Sign in or use a different email.");
        }
        throw authError;
      }
      const userId = authData.user?.id;
      if (!userId) throw new Error("Signup failed");

      const { data: latestStudents } = await supabase
        .from("students")
        .select("registration_id")
        .not("registration_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      let nextSeq = 10001;
      if (latestStudents && latestStudents.length > 0) {
        const seqs = latestStudents
          .map((s) => {
            const parts = s.registration_id.split("/");
            return parts.length === 4 ? parseInt(parts[3], 10) : 0;
          })
          .filter((n) => !isNaN(n));
        if (seqs.length > 0) nextSeq = Math.max(...seqs) + 1;
      }
      const currentYear = new Date().getFullYear();
      let regId = `EZY/${currentYear}/INT/${nextSeq}`;

      const studentMeta: Record<string, unknown> = {
        subject,
        internship_mode: "Online",
        registration_method: "reference_number",
        reference_number: data.reference_number,
        prefilled_id: data.id,
      };
      if (consentFormUrl) studentMeta.consent_form_url = consentFormUrl;

      const studentData = withStoredDirectoryPassword(
        {
          id: userId,
          email: normalizedEmail,
          full_name: fullName,
          gender,
          parent_name: parentName,
          contact_number: contact,
          university_name: selectedUni?.name || "",
          college_name: displayCollegeName(selectedCollege?.name) || "",
          course,
          internship_domain: course,
          degree,
          department: departmentName,
          class_semester: classSem,
          academic_session: session,
          roll_number: universityRegNo,
          status: "Active",
          cybercafe_shop_name: cybercafeProfile?.shop_name || null,
          cybercafe_email: cybercafeProfile?.email || null,
          metadata: studentMeta,
        },
        password
      );

      let retryCount = 0;
      while (retryCount < 10) {
        studentData.registration_id = regId;
        const { error: insertErr } = await supabase.from("students").insert(studentData);
        if (!insertErr) break;
        if (insertErr.code === "23505" && insertErr.message.includes("registration_id")) {
          nextSeq++;
          regId = `EZY/${currentYear}/INT/${nextSeq}`;
          retryCount++;
          continue;
        }
        throw insertErr;
      }

      await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName,
        email: normalizedEmail,
        contact_number: contact,
        gender,
        parent_name: parentName,
      });

      await supabase.from("payment_success").insert({
        user_id: userId,
        payment_id: payResult.payment_id,
        amount_paise: payResult.amount,
        email: normalizedEmail,
        full_name: fullName,
        college_name: displayCollegeName(selectedCollege?.name),
        cybercafe_shop_name: cybercafeProfile?.shop_name || null,
        cybercafe_email: cybercafeProfile?.email || null,
        status: "success",
      });

      try {
        await supabase.rpc("claim_prefilled_student", {
          p_reference_number: data.reference_number,
          p_user_id: userId,
        });
      } catch (e) {
        console.warn("claim_prefilled_student failed", e);
      }

      try {
        await fetch(getSendMailApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: normalizedEmail,
            email: normalizedEmail,
            action: "registration_confirmation",
            data: {
              fullName,
              regId,
              password,
              loginLink: buildStudentCredentialLoginLink(window.location.origin),
            },
          }),
        });
      } catch (_e) {
        /* non-blocking */
      }

      setSuccess(true);
      toast.success(
        isCyberCafeMode
          ? "Student registered. Credentials sent to their email."
          : "Registration complete!"
      );
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="mx-auto size-16 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Registration complete</h2>
        {isCyberCafeMode ? (
          <>
            <p className="text-muted-foreground mb-2">Student added to the directory.</p>
            <p className="text-sm text-muted-foreground mb-6">
              Login credentials were sent to the student&apos;s email.
            </p>
            <Button className="w-full" onClick={() => onRegisterAnother?.()}>
              Register another student
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              Welcome aboard, {fullName.split(" ")[0]}! Your payment was received and your account is ready.
            </p>
            <Button onClick={() => navigate("/login")}>Go to login</Button>
          </>
        )}
      </div>
    );
  }

  // Visual marker for prefilled fields (per spec)
  const prefilledClass = "bg-sky-50/60 border-sky-200";

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-emerald-50/60 border-emerald-200 flex items-start gap-3">
        <ShieldCheck className="size-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-emerald-900">Reference verified — record loaded</p>
          <p className="text-emerald-800/80 text-xs mt-0.5">
            Reference No. <span className="font-mono">{data.reference_number}</span>. All prefilled
            fields are editable; correct anything that's wrong before paying.
          </p>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input className={prefilledClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Father's Name *</Label>
          <Input className={prefilledClass} value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Gender *</Label>
          <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4 pt-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Male" id="g-m" />
              <Label htmlFor="g-m">Male</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Female" id="g-f" />
              <Label htmlFor="g-f">Female</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>
            Date of Birth{" "}
            <span className="text-[10px] text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            className={rawDob ? prefilledClass : ""}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            placeholder="DD/MM/YYYY"
          />
        </div>

        <div className="space-y-2">
          <Label>Contact Number *</Label>
          <Input
            className={rawContact ? prefilledClass : ""}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="10-digit mobile"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-2">
          <Label>Email Address *</Label>
          <Input
            type="email"
            className={rawEmail ? prefilledClass : ""}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>University Registration Number *</Label>
          <Input
            value={universityRegNo}
            onChange={(e) => setUniversityRegNo(e.target.value)}
            placeholder="Enter your university registration number"
          />
          <p className="text-[11px] text-slate-500">
            This is your official university-issued registration number — different
            from the admission reference number used to look you up.
          </p>
        </div>

        <div className="space-y-2">
          <Label>University *</Label>
          <Select value={universityId} onValueChange={(v) => { setUniversityId(v); setCollegeId(""); }}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select university" />
            </SelectTrigger>
            <SelectContent>
              {unis.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>College *</Label>
          <Select value={collegeId} onValueChange={setCollegeId} disabled={!universityId}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select college" />
            </SelectTrigger>
            <SelectContent>
              {filteredColleges.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Degree *</Label>
          <Select value={degree} onValueChange={setDegree}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select degree" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UG">UG</SelectItem>
              <SelectItem value="PG">PG</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Department *</Label>
          <Select value={departmentName} onValueChange={setDepartmentName}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {(degree === "PG"
                ? ["M.A.", "M.Sc", "M.Com"]
                : ["B.A.", "B.Sc", "B.Com"]).map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Subject *</Label>
          <Select value={subject} onValueChange={(val) => { setSubject(val); setCourse(""); }} disabled={!departmentName}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder={departmentName ? "Select subject" : "Select department first"} />
            </SelectTrigger>
            <SelectContent>
              {subjectsFor(departmentName).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Session *</Label>
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2023-2027">2023-2027</SelectItem>
              <SelectItem value="2024-2028">2024-2028</SelectItem>
              <SelectItem value="2025-2029">2025-2029</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Semester *</Label>
          <Select value={classSem} onValueChange={setClassSem}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              {["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Internship Domain *</Label>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className={prefilledClass}>
              <SelectValue placeholder="Select internship domain" />
            </SelectTrigger>
            <SelectContent>
              {domainOptions.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Set Password *</Label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Confirm Password *</Label>
          <Input
            type={showPw ? "text" : "password"}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>
            Upload Filled &amp; Signed Consent Form{" "}
            <span className="text-slate-500 font-normal">(optional, ≤ 75 KB)</span>
          </Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f && f.size > 75 * 1024) {
                toast.error("Consent form must be 75 KB or smaller");
                e.target.value = "";
                setConsentFile(null);
                return;
              }
              setConsentFile(f);
            }}
            className="cursor-pointer"
          />
          {consentFile && (
            <p className="text-xs text-emerald-700 font-medium">
              {consentFile.name} ({Math.round(consentFile.size / 1024)} KB) ready to upload
            </p>
          )}
        </div>
      </div>

      <Card className="p-4 bg-amber-50/60 border-amber-200">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase font-bold tracking-wider text-amber-800">
              Payment Summary
            </p>
            <p className="text-xs text-amber-900/80 mt-1">
              {feeBreakdown.hasBreakdown && feeBreakdown.componentLineLabels
                ? feeBreakdown.note || "See amounts below."
                : feeBreakdown.note || "All-inclusive registration fee."}
            </p>
            {feeBreakdown.hasBreakdown && feeBreakdown.componentLineLabels && (
              <div className="mt-3 space-y-1 text-xs text-amber-900/90">
                <div className="flex justify-between gap-4">
                  <span>{feeBreakdown.componentLineLabels.base}</span>
                  <span className="font-semibold tabular-nums">{formatRupees(feeBreakdown.basePaise)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{feeBreakdown.componentLineLabels.gst}</span>
                  <span className="font-semibold tabular-nums">{formatRupees(feeBreakdown.gstPaise)}</span>
                </div>
              </div>
            )}
          </div>
          <p className="text-3xl font-black text-amber-900 tabular-nums">
            {formatRupees(feeBreakdown.totalPaise)}
          </p>
        </div>
      </Card>

      <Button
        className="w-full h-12 text-base font-bold"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" /> Processing…
          </>
        ) : (
          `Proceed to Payment — ${formatRupees(feeBreakdown.totalPaise)}`
        )}
      </Button>
    </div>
  );
};
