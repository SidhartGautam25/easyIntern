import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { COLLEGE_LOGIN_PATH } from "@/lib/authRoutes";
import { displayCollegeName } from "@/lib/collegeDisplay";
import { type AssignedCollege } from "@/lib/collegeAdminScope";
import { fetchCollegeAdminPortalData } from "@/lib/collegeAdminStudents";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const PAGE_SIZE = 12;

const GENDER_COLORS: Record<string, string> = {
  Male: "#0ea5e9",
  Female: "#ec4899",
  Other: "#94a3b8",
};

const STREAM_COLORS: Record<string, string> = {
  "B.Com": "#6366f1",
  "B.Sc": "#22c55e",
  "B.A": "#f97316",
  Other: "#94a3b8",
};

function genderBucket(g: string | null | undefined): "Male" | "Female" | "Other" {
  const x = (g || "").trim().toLowerCase();
  if (["m", "male", "man"].includes(x)) return "Male";
  if (["f", "female", "woman"].includes(x)) return "Female";
  if (!x) return "Other";
  return "Other";
}

/** Group into B.Com / B.Sc / B.A / Other from course, degree, department text. */
function programStream(s: {
  course?: string | null;
  degree?: string | null;
  department?: string | null;
}): "B.Com" | "B.Sc" | "B.A" | "Other" {
  const raw = `${s.course || ""} ${s.degree || ""} ${s.department || ""}`.toLowerCase();
  if (/b\.?\s*com|bcom|\bcommerce\b|bachelor\s+of\s+commerce/.test(raw)) return "B.Com";
  if (/b\.?\s*sc|bsc|\bscience\b|bachelor\s+of\s+science/.test(raw)) return "B.Sc";
  if (/b\.?\s*a\b|\bba\b|\barts\b|bachelor\s+of\s+arts/.test(raw)) return "B.A";
  return "Other";
}

function countMap<T extends string>(items: T[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const k of items) m.set(k, (m.get(k) || 0) + 1);
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

type Section = "dashboard" | "students";

export default function CollegeDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [section, setSection] = useState<Section>("dashboard");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detailStudent, setDetailStudent] = useState<any | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [assignedColleges, setAssignedColleges] = useState<AssignedCollege[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate(COLLEGE_LOGIN_PATH, { replace: true });
        return;
      }

      try {
        const { assignedColleges: assigned, students: rows } = await fetchCollegeAdminPortalData(
          supabase,
          session.user.id
        );
        if (cancelled) return;
        setAssignedColleges(assigned);
        setStudents(rows as any[]);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setAssignedColleges([]);
          setStudents([]);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(COLLEGE_LOGIN_PATH, { replace: true });
  };

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return students;
    return students.filter((s) => {
      const blob = [
        s.full_name,
        s.email,
        s.contact_number,
        s.registration_id,
        s.college_name,
        s.course,
        s.degree,
        s.department,
        s.roll_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [students, q]);

  const genderData = useMemo(() => countMap(students.map((s) => genderBucket(s.gender))), [students]);
  const streamData = useMemo(() => countMap(students.map((s) => programStream(s))), [students]);

  const total = students.length;
  const maleN = students.filter((s) => genderBucket(s.gender) === "Male").length;
  const femaleN = students.filter((s) => genderBucket(s.gender) === "Female").length;
  const otherGenderN = total - maleN - femaleN;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("flex flex-col gap-1", mobile ? "p-4" : "p-3")}>
      <button
        type="button"
        onClick={() => {
          setSection("dashboard");
          setNavOpen(false);
        }}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors text-left",
          section === "dashboard"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <LayoutDashboard className="size-4 shrink-0" />
        Dashboard
      </button>
      <button
        type="button"
        onClick={() => {
          setSection("students");
          setNavOpen(false);
        }}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors text-left",
          section === "students"
            ? "bg-emerald-600 text-white shadow-md"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <Users className="size-4 shrink-0" />
        Students
      </button>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="size-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-900">
      <aside className="hidden md:flex w-56 flex-col border-r border-slate-200 bg-white shadow-sm shrink-0">
        <div className="p-4 border-b border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">College portal</p>
          <p className="font-black text-sm mt-0.5">EzyIntern</p>
        </div>
        <NavLinks />
        <div className="mt-auto p-3 border-t border-slate-100">
          <Button variant="outline" size="sm" className="w-full gap-2 font-semibold" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 flex flex-col">
                <div className="p-4 border-b">
                  <p className="text-[10px] font-black uppercase text-emerald-600">College portal</p>
                  <p className="font-black">EzyIntern</p>
                </div>
                <NavLinks mobile />
                <div className="mt-auto p-4 border-t">
                  <Button variant="outline" className="w-full gap-2" onClick={signOut}>
                    <LogOut className="size-4" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="font-black text-base md:text-lg truncate">
                {section === "dashboard" ? "Dashboard" : "Students"}
              </h1>
              <p className="text-[10px] md:text-xs text-slate-500 truncate hidden sm:block">
                {assignedColleges.length
                  ? `${students.length} students · ${assignedColleges.map((c) => displayCollegeName(c.name)).join(", ")}`
                  : "No colleges assigned — contact your administrator"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 font-semibold hidden md:flex" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {section === "dashboard" && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <Card className="p-4 border-none shadow-elegant bg-white">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total students</p>
                  <p className="text-2xl md:text-3xl font-black text-emerald-700 mt-1">{total}</p>
                </Card>
                <Card className="p-4 border-none shadow-elegant bg-white">
                  <p className="text-[10px] font-black uppercase text-slate-400">Male</p>
                  <p className="text-2xl md:text-3xl font-black text-sky-600 mt-1">{maleN}</p>
                </Card>
                <Card className="p-4 border-none shadow-elegant bg-white">
                  <p className="text-[10px] font-black uppercase text-slate-400">Female</p>
                  <p className="text-2xl md:text-3xl font-black text-pink-600 mt-1">{femaleN}</p>
                </Card>
                <Card className="p-4 border-none shadow-elegant bg-white">
                  <p className="text-[10px] font-black uppercase text-slate-400">Other / not set</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-500 mt-1">{otherGenderN}</p>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="p-4 md:p-6 border-none shadow-elegant bg-white">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Gender</h2>
                  <div className="h-[260px] w-full">
                    {genderData.length === 0 || total === 0 ? (
                      <p className="text-sm text-slate-500 py-12 text-center">No data yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={genderData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={88}
                            paddingAngle={2}
                          >
                            {genderData.map((e) => (
                              <Cell key={e.name} fill={GENDER_COLORS[e.name] || "#94a3b8"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${v} students`, "Count"]} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>

                <Card className="p-4 md:p-6 border-none shadow-elegant bg-white">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                    Program (B.Com / B.Sc / B.A)
                  </h2>
                  <div className="h-[260px] w-full">
                    {streamData.length === 0 || total === 0 ? (
                      <p className="text-sm text-slate-500 py-12 text-center">No data yet</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={streamData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                          <Tooltip formatter={(v: number) => [`${v}`, "Students"]} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Students">
                            {streamData.map((e) => (
                              <Cell key={e.name} fill={STREAM_COLORS[e.name] || "#94a3b8"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {section === "students" && (
            <div className="max-w-6xl mx-auto space-y-4">
              <Card className="p-4 md:p-6 border-none shadow-elegant bg-white">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      placeholder="Search name, email, phone, course…"
                      className="pl-10 h-10 bg-slate-50 border-slate-200"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {filtered.length} match{filtered.length === 1 ? "" : "es"} · Page {safePage + 1} / {pageCount}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80">
                        <TableHead className="text-[10px] font-black uppercase">Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Gender</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">College</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Course</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Program</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Reg. ID</TableHead>
                        <TableHead className="text-[10px] font-black uppercase w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500 text-sm">
                            No students match your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginated.map((s) => (
                          <TableRow
                            key={s.id}
                            className="cursor-pointer hover:bg-emerald-50/40"
                            onClick={() => setDetailStudent(s)}
                          >
                            <TableCell className="font-medium text-sm">{s.full_name || "—"}</TableCell>
                            <TableCell className="text-sm">{genderBucket(s.gender)}</TableCell>
                            <TableCell
                              className="text-sm max-w-[160px] truncate text-slate-700"
                              title={s.college_name}
                            >
                              {displayCollegeName(s.college_name) || "—"}
                            </TableCell>
                            <TableCell className="text-sm max-w-[140px] truncate" title={s.course}>
                              {s.course || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="font-semibold text-emerald-800">{programStream(s)}</span>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{s.registration_id || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="text-emerald-700 font-bold text-xs">
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="gap-1 font-bold"
                  >
                    <ChevronLeft className="size-4" /> Previous
                  </Button>
                  <span className="text-xs text-slate-500 font-medium">
                    Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
                    {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    className="gap-1 font-bold"
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      <Dialog open={!!detailStudent} onOpenChange={(o) => !o && setDetailStudent(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left">Student details</DialogTitle>
          </DialogHeader>
          {detailStudent && (
            <dl className="grid grid-cols-1 gap-3 text-sm">
              {[
                ["Full name", detailStudent.full_name],
                ["Email", detailStudent.email],
                ["Phone", detailStudent.contact_number],
                ["Gender", genderBucket(detailStudent.gender)],
                ["Parent / guardian", detailStudent.parent_name],
                ["University", detailStudent.university_name],
                ["College", displayCollegeName(detailStudent.college_name) || detailStudent.college_name],
                ["Degree", detailStudent.degree],
                ["Department", detailStudent.department],
                ["Course", detailStudent.course],
                ["Program group", programStream(detailStudent)],
                ["Semester", detailStudent.class_semester],
                ["Session", detailStudent.academic_session],
                ["Roll number", detailStudent.roll_number],
                ["Registration ID", detailStudent.registration_id],
                ["Internship domain", detailStudent.internship_domain],
                ["Status", detailStudent.status],
                ["Emergency contact", detailStudent.emergency_name],
                ["Emergency phone", detailStudent.emergency_contact],
                ["Relation", detailStudent.emergency_relation],
                ["Joined", detailStudent.created_at ? new Date(detailStudent.created_at).toLocaleString() : "—"],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex flex-col sm:flex-row sm:gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <dt className="text-[10px] font-black uppercase text-slate-400 shrink-0 sm:w-36">{label}</dt>
                  <dd className="font-medium text-slate-800 break-words">{val != null && val !== "" ? String(val) : "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
