export type LeadHuntRow = {
  id: string;
  created_at: string;
  email: string;
  full_name: string;
  contact_number?: string | null;
  college_name: string;
  course: string;
  amount_paise: number;
  failure_reason: string;
  payment_id: string | null;
  original: Record<string, unknown>;
};

type DraftLead = {
  id: string;
  email?: string | null;
  phone?: string | null;
  updated_at: string;
  payload?: Record<string, unknown> | null;
  cybercafe_shop_name?: string | null;
  cybercafe_email?: string | null;
};

type PayLead = Record<string, unknown>;

export function buildLeadHuntRows(params: {
  registrationDraftLeads: DraftLead[];
  failedPayments: PayLead[];
  cancelledPayments: PayLead[];
  enrolledEmails: Set<string>;
  searchTerm?: string;
}): LeadHuntRow[] {
  const { registrationDraftLeads, failedPayments, cancelledPayments, enrolledEmails } = params;
  const search = params.searchTerm?.trim().toLowerCase() ?? "";

  const draftRows: LeadHuntRow[] = registrationDraftLeads
    .filter((d) => d.email && !enrolledEmails.has(String(d.email).toLowerCase()))
    .map((d) => {
      const pl = (d.payload || {}) as Record<string, unknown>;
      const meta = {
        ...pl,
        fullName: pl.fullName,
        parentName: pl.parentName,
        gender: pl.gender,
        contact: pl.contact,
        university: pl.university,
        college: pl.college,
        degree: pl.degree,
        department: pl.department,
        session: pl.session,
        semester: pl.semester,
        rollNo: pl.rollNo,
        course: pl.course,
      };
      return {
        id: `reg-draft-${d.id}`,
        created_at: d.updated_at,
        email: String(d.email),
        full_name: String(pl.fullName || d.email),
        contact_number: (pl.contact as string) || d.phone,
        college_name: String(pl.college || "—"),
        course: String(pl.course || "—"),
        amount_paise: 0,
        failure_reason: "Incomplete registration",
        payment_id: null,
        original: {
          registration_draft: true,
          draft_id: d.id,
          user_email: d.email,
          user_phone: pl.contact || d.phone,
          full_name: pl.fullName,
          gender: pl.gender,
          college_name: pl.college,
          university_name: pl.university,
          metadata: meta,
          cybercafe_shop_name: d.cybercafe_shop_name,
          cybercafe_email: d.cybercafe_email,
        },
      };
    });

  const payRows: LeadHuntRow[] = [...failedPayments, ...cancelledPayments].map((cp) => {
    const metadata = (cp.metadata || {}) as Record<string, unknown>;
    return {
      id: String(cp.id),
      created_at: String(cp.created_at),
      email: String(cp.email || cp.user_email || ""),
      full_name: String(cp.full_name || metadata.fullName || cp.user_email || ""),
      contact_number: (cp.contact_number as string) || (metadata.contact as string),
      college_name: String(cp.college_name || "No College"),
      course: String(metadata.course || "No Domain"),
      amount_paise: Number(cp.amount_paise || cp.amount || 0),
      failure_reason: String(cp.failure_reason || cp.reason || "Payment Failed"),
      payment_id: (cp.payment_id as string) || null,
      original: cp,
    };
  });

  const merged = [...draftRows, ...payRows]
    .filter((cp) => {
      if (cp.email && enrolledEmails.has(cp.email.toLowerCase())) return false;
      if (!search) return true;
      return (
        cp.email?.toLowerCase().includes(search) ||
        cp.full_name?.toLowerCase().includes(search) ||
        String(cp.contact_number || "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return merged;
}
