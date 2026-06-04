import { GraduationCap, Briefcase, Phone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EDIT_DOMAIN_SENTINEL } from "@/lib/studentCredentials";
import { displayCollegeName } from "@/lib/collegeDisplay";
import { matchSubjectToOption, subjectsFor } from "@/lib/subjectOptions";

const SESSION_OPTIONS = ["2023-2027", "2024-2028", "2025-2029"] as const;
const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => `Semester ${s}`);
const MODE_OPTIONS = ["Online", "Offline", "Hybrid"] as const;

const DEPARTMENT_UG = ["B.A.", "B.Sc", "B.Com"] as const;
const DEPARTMENT_PG = ["M.A.", "M.Sc", "M.Com"] as const;
const DEPARTMENT_OTHER = "__other__";

const SUBJECT_UNSET = "__subject_unset__";
const SUBJECT_CUSTOM = "__subject_custom__";

export type StudentEditFormFieldsProps = {
  editData: Record<string, any>;
  setEditData: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  domains: { id: string; name: string }[];
  unis: { id: string; name: string }[];
  colleges: { id: string; name: string; university_id: string }[];
  registrationNumLabel?: string;
};

export function StudentEditFormFields({
  editData,
  setEditData,
  domains,
  unis,
  colleges,
  registrationNumLabel = "Registration number",
}: StudentEditFormFieldsProps) {
  const uniId = unis.find((u) => u.name === editData.university_name)?.id ?? "";
  const collegeOptions = uniId ? colleges.filter((c) => c.university_id === uniId) : [];

  const internshipMode =
    (editData.internship_mode as string) ||
    (typeof editData.metadata === "object" && editData.metadata?.internship_mode) ||
    "Online";

  const subjectFromRow =
    typeof editData.subject === "string"
      ? editData.subject
      : typeof editData.metadata === "object" && editData.metadata && "subject" in editData.metadata
        ? String((editData.metadata as { subject?: string }).subject ?? "")
        : "";

  const subjectDeptOptions = subjectsFor(editData.department as string);
  const subjectCanonical = matchSubjectToOption(subjectFromRow, editData.department as string);
  const subjectResolved =
    subjectCanonical ||
    (subjectDeptOptions.includes(subjectFromRow) ? subjectFromRow : "");

  let subjectSelectValue: string;
  if (subjectDeptOptions.length === 0) {
    subjectSelectValue = SUBJECT_CUSTOM;
  } else if (!subjectResolved.trim()) {
    subjectSelectValue = SUBJECT_UNSET;
  } else if (subjectDeptOptions.includes(subjectResolved)) {
    subjectSelectValue = subjectResolved;
  } else {
    subjectSelectValue = SUBJECT_CUSTOM;
  }

  const deptOptions =
    editData.degree === "UG" ? DEPARTMENT_UG : editData.degree === "PG" ? DEPARTMENT_PG : [];
  const deptKnown =
    deptOptions.length > 0 && deptOptions.includes(editData.department as (typeof deptOptions)[number]);
  const deptSelectValue =
    !editData.degree || deptOptions.length === 0
      ? "__unset__"
      : deptKnown
        ? editData.department
        : editData.department
          ? DEPARTMENT_OTHER
          : "__unset__";

  return (
    <>
      <Separator className="bg-slate-100" />

      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <GraduationCap className="size-3" /> Academic details
        </h4>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <Label className="text-xs">University</Label>
            <Select
              value={uniId || "__unset__"}
              onValueChange={(id) => {
                if (id === "__unset__") {
                  setEditData({ ...editData, university_name: "", college_name: "" });
                  return;
                }
                const u = unis.find((x) => x.id === id);
                setEditData({ ...editData, university_name: u?.name ?? "", college_name: "" });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select university" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">Not specified</SelectItem>
                {unis.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">College</Label>
            <Select
              value={
                collegeOptions.find(
                  (c) =>
                    c.name === editData.college_name ||
                    displayCollegeName(c.name) === editData.college_name
                )?.id ?? "__unset__"
              }
              onValueChange={(id) => {
                if (id === "__unset__") {
                  setEditData({ ...editData, college_name: "" });
                  return;
                }
                const c = colleges.find((x) => x.id === id);
                setEditData({ ...editData, college_name: displayCollegeName(c?.name) ?? "" });
              }}
              disabled={!uniId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select college" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">Not specified</SelectItem>
                {collegeOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {displayCollegeName(c.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Degree</Label>
            <Select
              value={editData.degree === "UG" || editData.degree === "PG" ? editData.degree : "__unset__"}
              onValueChange={(v) => {
                const deg = v === "__unset__" ? "" : v;
                const nextOpts =
                  deg === "UG" ? DEPARTMENT_UG : deg === "PG" ? DEPARTMENT_PG : [];
                const keep =
                  nextOpts.length > 0 &&
                  nextOpts.includes(editData.department as (typeof nextOpts)[number]);
                setEditData({
                  ...editData,
                  degree: deg,
                  ...(keep ? {} : { department: "" }),
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Degree" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">Not specified</SelectItem>
                <SelectItem value="UG">UG</SelectItem>
                <SelectItem value="PG">PG</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Department</Label>
            {editData.degree === "UG" || editData.degree === "PG" ? (
              <>
                <Select
                  value={deptSelectValue}
                  onValueChange={(v) => {
                    if (v === "__unset__") {
                      setEditData({ ...editData, department: "" });
                      return;
                    }
                    if (v === DEPARTMENT_OTHER) {
                      setEditData({ ...editData, department: "" });
                      return;
                    }
                    setEditData({ ...editData, department: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Not specified</SelectItem>
                    {deptOptions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                    <SelectItem value={DEPARTMENT_OTHER}>Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
                {(deptSelectValue === DEPARTMENT_OTHER || (!deptKnown && !!editData.department)) && (
                  <Input
                    className="mt-2"
                    value={editData.department || ""}
                    onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                    placeholder="e.g. B.A. (English), or faculty name"
                  />
                )}
              </>
            ) : (
              <Input
                value={editData.department || ""}
                onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                placeholder="Choose UG/PG above for standard departments, or type here"
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Academic session</Label>
            <Select
              value={
                SESSION_OPTIONS.includes(editData.academic_session as any)
                  ? editData.academic_session
                  : "__unset__"
              }
              onValueChange={(v) =>
                setEditData({
                  ...editData,
                  academic_session: v === "__unset__" ? "" : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">Not specified</SelectItem>
                {SESSION_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Semester</Label>
            <Select
              value={
                SEMESTER_OPTIONS.includes(editData.class_semester) ? editData.class_semester : "__unset__"
              }
              onValueChange={(v) =>
                setEditData({
                  ...editData,
                  class_semester: v === "__unset__" ? "" : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unset__">Not specified</SelectItem>
                {SEMESTER_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("Semester ", "Sem ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{registrationNumLabel}</Label>
            <Input
              value={editData.roll_number || ""}
              onChange={(e) => setEditData({ ...editData, roll_number: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Subject</Label>
            {subjectDeptOptions.length > 0 ? (
              <>
                <Select
                  value={subjectSelectValue}
                  onValueChange={(v) => {
                    if (v === SUBJECT_UNSET) {
                      setEditData({ ...editData, subject: "" });
                      return;
                    }
                    if (v === SUBJECT_CUSTOM) {
                      setEditData({
                        ...editData,
                        subject: (editData.subject as string) || subjectFromRow || "",
                      });
                      return;
                    }
                    setEditData({ ...editData, subject: v });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SUBJECT_UNSET}>Not specified</SelectItem>
                    {subjectDeptOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value={SUBJECT_CUSTOM}>Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
                {subjectSelectValue === SUBJECT_CUSTOM && (
                  <Input
                    className="mt-2"
                    value={(editData.subject as string) ?? subjectFromRow}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Enter subject name"
                  />
                )}
              </>
            ) : (
              <Input
                value={subjectFromRow}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    subject: e.target.value,
                  })
                }
                placeholder="e.g. M.A. specialization (no preset list for this department)"
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Internship domain</Label>
            <Select
              value={
                editData.internship_domain && domains.some((d) => d.name === editData.internship_domain)
                  ? editData.internship_domain
                  : EDIT_DOMAIN_SENTINEL
              }
              onValueChange={(v) =>
                setEditData({
                  ...editData,
                  internship_domain: v === EDIT_DOMAIN_SENTINEL ? "" : v,
                  course: v === EDIT_DOMAIN_SENTINEL ? editData.course : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EDIT_DOMAIN_SENTINEL}>Not specified</SelectItem>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Internship mode</Label>
            <Select
              value={MODE_OPTIONS.includes(internshipMode as any) ? internshipMode : "Online"}
              onValueChange={(v) => setEditData({ ...editData, internship_mode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-100" />

      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Briefcase className="size-3" /> Internship information
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <Label className="text-xs">Registration ID</Label>
            <Input
              value={editData.registration_id || ""}
              onChange={(e) => setEditData({ ...editData, registration_id: e.target.value })}
              placeholder="e.g. EZY/2026/INT/10001"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Internship duration</Label>
            <Input
              value={editData.internship_duration || ""}
              onChange={(e) => setEditData({ ...editData, internship_duration: e.target.value })}
              placeholder="e.g. 120 Hours"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date of joining</Label>
            <Input
              type="date"
              value={editData.joining_date || ""}
              onChange={(e) => setEditData({ ...editData, joining_date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date of completion</Label>
            <Input
              type="date"
              value={editData.completion_date || ""}
              onChange={(e) => setEditData({ ...editData, completion_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Separator className="bg-slate-100" />

      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
          <Phone className="size-3" /> Emergency contacts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <Label className="text-xs">Contact name</Label>
            <Input
              value={editData.emergency_name || ""}
              onChange={(e) => setEditData({ ...editData, emergency_name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Relationship</Label>
            <Input
              value={editData.emergency_relation || ""}
              onChange={(e) => setEditData({ ...editData, emergency_relation: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact phone</Label>
            <Input
              value={editData.emergency_contact || ""}
              onChange={(e) => setEditData({ ...editData, emergency_contact: e.target.value })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
