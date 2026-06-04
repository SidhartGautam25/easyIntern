export type CommsRecipient = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  college_name?: string | null;
  university_name?: string | null;
  internship_domain?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Domain for enrolled students or leads (payment metadata / draft payload). */
export function commsRecipientDomain(item: CommsRecipient): string {
  if (item.internship_domain?.trim()) return item.internship_domain.trim();
  const meta = item.metadata;
  if (!meta) return "";
  return String(
    meta.internship_domain ?? meta.domain ?? meta.course ?? meta.internship_mode ?? ""
  ).trim();
}

type CollegeRow = { id: string; name: string; university_id: string };
type UniRow = { id: string; name: string };

export function filterCommsRecipients(
  list: CommsRecipient[],
  opts: {
    uniFilter: string;
    collegeFilter: string;
    domainFilter: string;
    colleges: CollegeRow[];
    unis: UniRow[];
    type: "enrolled" | "unenrolled";
  }
): CommsRecipient[] {
  let result = list;

  if (opts.domainFilter !== "all") {
    result = result.filter((s) => commsRecipientDomain(s) === opts.domainFilter);
  }

  if (opts.uniFilter !== "all") {
    const uniId = opts.unis.find((u) => u.name === opts.uniFilter)?.id;
    const collegeNames = opts.colleges
      .filter((c) => c.university_id === uniId)
      .map((c) => c.name);

    if (opts.type === "enrolled") {
      result = result.filter(
        (s) =>
          s.university_name === opts.uniFilter ||
          (s.college_name != null && collegeNames.includes(s.college_name))
      );
    } else {
      result = result.filter((s) => {
        const meta = s.metadata;
        const college = String(meta?.college ?? meta?.college_name ?? "");
        const uni = String(meta?.university ?? meta?.university_name ?? "");
        return uni === opts.uniFilter || collegeNames.includes(college);
      });
    }
  }

  if (opts.collegeFilter !== "all") {
    if (opts.type === "enrolled") {
      result = result.filter((s) => s.college_name === opts.collegeFilter);
    } else {
      result = result.filter((s) => {
        const meta = s.metadata;
        const college = String(meta?.college ?? meta?.college_name ?? "");
        return college === opts.collegeFilter;
      });
    }
  }

  return result;
}

export function searchCommsRecipients(list: CommsRecipient[], term: string): CommsRecipient[] {
  const t = term.trim().toLowerCase();
  if (!t) return list;
  return list.filter((s) => {
    const name = (s.full_name || s.user_name || "").toLowerCase();
    const email = (s.email || s.user_email || "").toLowerCase();
    return name.includes(t) || email.includes(t);
  });
}
