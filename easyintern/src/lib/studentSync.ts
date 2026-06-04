/** Keeps students.metadata aligned with registration-style keys for leads / prefill / exports. */
export function mergeRegistrationMetadataFromStudentRow(editData: Record<string, unknown>) {
  const prev =
    typeof editData.metadata === "object" && editData.metadata !== null
      ? (editData.metadata as Record<string, unknown>)
      : {};
  const domain = (editData.internship_domain || editData.course || "") as string;
  const pwdRaw = editData.password ?? prev.password;
  const pwd =
    typeof pwdRaw === "string" && pwdRaw.trim() ? pwdRaw.trim() : undefined;
  const modeRaw = editData.internship_mode ?? prev.internship_mode;
  const internship_mode =
    typeof modeRaw === "string" && modeRaw.trim() ? modeRaw.trim() : undefined;

  const merged: Record<string, unknown> = {
    ...prev,
    ...(pwd ? { password: pwd } : {}),
    ...(internship_mode ? { internship_mode } : {}),
    fullName: editData.full_name,
    gender: editData.gender,
    parentName: editData.parent_name,
    email: editData.email,
    contact: editData.contact_number,
    university: editData.university_name,
    college: editData.college_name,
    degree: editData.degree,
    department: editData.department,
    session: editData.academic_session,
    semester: editData.class_semester,
    rollNo: editData.roll_number,
    course: domain,
    internship_domain: domain,
    emName: editData.emergency_name,
    emPhone: editData.emergency_contact,
    emRel: editData.emergency_relation,
  };

  if ("subject" in editData) {
    const t = typeof editData.subject === "string" ? editData.subject.trim() : "";
    if (t) merged.subject = t;
    else delete merged.subject;
  }

  return merged;
}
