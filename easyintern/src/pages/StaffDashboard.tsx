import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LOGIN_PATH, buildStudentCredentialLoginLink } from "@/lib/authRoutes";
import { mergeRegistrationMetadataFromStudentRow } from "@/lib/studentSync";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Target, 
  Bell, 
  Mail, 
  Video, 
  Award, 
  Shield,
  LogOut,
  Loader2,
  Menu,
  Search,
  Filter,
  Eye,
  MoreHorizontal,
  UserPlus,
  Phone,
  User,
  CheckCircle2,
  Lock,
  GraduationCap,
  MapPin,
  MessageSquare,
  BookOpen,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Send,
  Plus,
  Trash2,
  CheckSquare,
  Edit,
  Download,
  KeyRound,
  FileText,
  Briefcase,
  Store,
  LogIn,
  Megaphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import Papa from "papaparse";
import { OfferLetter } from "@/components/OfferLetter";
import { downloadOfferLetterPdf } from "@/lib/offerLetterPdf";
import { normalizeOfferLetterProfile } from "@/lib/offerLetterProfile";
import { EDIT_GENDER_SENTINEL } from "@/lib/studentCredentials";
import { adminUpsertStudentProfile } from "@/lib/adminProfileUpsert";
import { StudentEditFormFields } from "@/components/StudentEditFormFields";
import { RegistrationForm } from "@/components/RegistrationForm";
import { useAdmin } from "@/hooks/useBackend";

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { registerStudent } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data States
  const [students, setStudents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [failedPayments, setFailedPayments] = useState<any[]>([]);
  const [cancelledPayments, setCancelledPayments] = useState<any[]>([]);
  const [registrationDraftLeads, setRegistrationDraftLeads] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [unis, setUnis] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [addStudentFormKey, setAddStudentFormKey] = useState(0);
  
  // UI States
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [paySearchTerm, setPaySearchTerm] = useState("");
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeMessage, setNewNoticeMessage] = useState("");
  const [newNoticeTarget, setNewNoticeTarget] = useState("all");
  const [newNoticeTargetUserId, setNewNoticeTargetUserId] = useState("");

  const [newClassTitle, setNewClassTitle] = useState("");
  const [newClassType, setNewClassType] = useState("youtube");
  const [newClassUrl, setNewClassUrl] = useState("");
  const [newClassSchedule, setNewClassSchedule] = useState("");

  const [downloadEmail, setDownloadEmail] = useState("");
  const offerLetterRef = useRef<HTMLDivElement>(null);

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);

  useEffect(() => {
    if (loading || !permissions) return;
    const timer = setTimeout(() => {
      void fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchTerm, loading, permissions]);

  useEffect(() => {
    checkAuth();
    const leadsChannel = supabase
      .channel('staff_data_stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_cancelled' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_leads' }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(leadsChannel); };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate(ADMIN_LOGIN_PATH); return; }
    setCurrentUserId(session.user.id);
    
    // Authoritative role check — user_roles only. user_metadata is client
    // editable and MUST NOT gate access to the staff dashboard.
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    const hasAuthorizedRole = roles?.some(r => r.role === "admin" || r.role === "staff" || r.role === "super_admin");
    if (!hasAuthorizedRole) { navigate("/"); return; }

    setStaffName(session.user.user_metadata?.full_name || "Staff Member");
    const { data: perms } = await supabase.from("admin_permissions").select("*").eq("user_id", session.user.id).maybeSingle();
    const [{ data: staffById }, { data: staffByEmail }] = await Promise.all([
      supabase.from("admin_staff").select("permissions").eq("id", session.user.id).maybeSingle(),
      session.user.email
        ? supabase.from("admin_staff").select("permissions").eq("email", session.user.email).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const staffRow = staffById || staffByEmail;
    const defaults = {
      can_manage_students: true,
      can_view_payments: true,
      can_manage_leads: true,
      can_manage_notifications: true,
      can_manage_communications: true,
      can_manage_classes: true,
    };
    setPermissions({
      ...defaults,
      ...(typeof staffRow?.permissions === "object" && staffRow.permissions !== null ? staffRow.permissions : {}),
      ...(perms || {}),
    });
    
    await loadData();
    setLoading(false);
  };

  const sanitizeIlike = (raw: string) => raw.replace(/[%_,]/g, " ").trim();

  const fetchStudents = async (searchOverride?: string) => {
    setStudentsLoading(true);
    try {
      const term = sanitizeIlike(searchOverride ?? studentSearchTerm);
      let query = supabase
        .from("students")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (term) {
        query = query.or(
          `full_name.ilike.%${term}%,email.ilike.%${term}%,registration_id.ilike.%${term}%,contact_number.ilike.%${term}%,roll_number.ilike.%${term}%,college_name.ilike.%${term}%`
        );
      }

      const { data, count, error } = await query.limit(term ? 500 : 5000);
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      const superAdminIds = (roles || []).map((r) => r.user_id);
      setStudents((data || []).filter((s) => !superAdminIds.includes(s.id)));
      return count ?? 0;
    } catch (err: unknown) {
      console.error("Staff fetchStudents:", err);
      toast.error("Failed to load student directory");
      setStudents([]);
      return 0;
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [paymentSuccessRows, cancelledPaymentRows, regDraftRows] = await Promise.all([
        fetchAllSupabaseRows(supabase, "payment_success", {
          orderBy: "created_at",
          ascending: false,
        }),
        fetchAllSupabaseRows(supabase, "payment_cancelled", {
          orderBy: "created_at",
          ascending: false,
        }),
        fetchAllSupabaseRows(supabase, "registration_leads", {
          orderBy: "updated_at",
          ascending: false,
        }),
      ]);

      const [_, dom, cl, nt, uniRes, colRes] = await Promise.all([
        fetchStudents(),
        supabase.from("internship_domains").select("*"),
        supabase.from("classes").select("*, internship_domains(name)").order("scheduled_at", { ascending: false }),
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("universities").select("*").order("name"),
        supabase.from("colleges").select("*").order("name"),
      ]);

      setUnis(uniRes.data || []);
      setColleges(colRes.data || []);
      const allUnified = paymentSuccessRows;
      setPayments(allUnified.filter((p: any) => p.status === 'success' || !p.status));
      setFailedPayments(allUnified.filter((p: any) => p.status === 'failed'));
      setCancelledPayments(cancelledPaymentRows);
      setRegistrationDraftLeads(regDraftRows);
      setDomains(dom.data || []);
      setClassesList(cl.data || []);
      setNotifications(nt.data || []);
    } catch (e) { console.error("Load Error:", e); }
  };

  const handleDownloadOffer = async (student: any) => {
    setSelectedUser(normalizeOfferLetterProfile(student));
    setProcessing(true);
    
    // Give time for the hidden component to render with the new data
    setTimeout(async () => {
      if (!offerLetterRef.current) {
        toast.error("Generation failed - element not found");
        setProcessing(false);
        return;
      }

      try {
        await downloadOfferLetterPdf(offerLetterRef.current, {
          fileName: `EzyIntern_Offer_Letter_${student.full_name?.replace(/\s+/g, "_") || "Student"}.pdf`,
          captureInPlace: false,
        });
        toast.success("Offer letter downloaded successfully!");
      } catch (error) {
        console.error("PDF Error:", error);
        toast.error("Failed to generate PDF");
      } finally {
        setProcessing(false);
      }
    }, 800);
  };

  const handleManualDownload = async () => {
    if (!downloadEmail) return toast.error("Please enter an email address");
    setProcessing(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("email", downloadEmail.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("No student found with this email");
        setProcessing(false);
        return;
      }

      await handleDownloadOffer(data);
    } catch (e: any) {
      toast.error(e.message);
      setProcessing(false);
    }
  };

  const handleSendNotification = async () => {
    if (!newNoticeTitle || !newNoticeMessage) return toast.error("Fill all fields");
    setProcessing(true);
    try {
      let targetUid = null;
      if (newNoticeTarget === "specific") {
        const { data: student } = await supabase.from("students").select("id").or(`registration_id.eq.${newNoticeTargetUserId},id.eq.${newNoticeTargetUserId}`).maybeSingle();
        if (!student) throw new Error("Student not found");
        targetUid = student.id;
      }
      const { error } = await supabase.from("notifications").insert({ title: newNoticeTitle, message: newNoticeMessage, target_type: newNoticeTarget, target_user_id: targetUid, created_by: currentUserId });
      if (error) throw error;
      toast.success("Notification sent!");
      setNewNoticeTitle(""); setNewNoticeMessage(""); setNewNoticeTargetUserId("");
      
      await logAdminAction('CREATE', 'notification', `Sent notification: ${newNoticeTitle}`);
      
      loadData();
    } catch (e: any) { toast.error(e.message); } finally { setProcessing(false); }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData?.id) return;
    setProcessing(true);
    try {
      const mergedMeta = mergeRegistrationMetadataFromStudentRow(editData);
      const emailNorm = String(editData.email || "").trim().toLowerCase();
      if (!emailNorm) {
        toast.error("Student email is required.");
        return;
      }

      const courseVal = (editData.internship_domain || editData.course || "") as string;
      const dirPw =
        typeof mergedMeta.password === "string" && mergedMeta.password.trim()
          ? mergedMeta.password.trim()
          : "";
      const { data: updatedStudent, error } = await supabase
        .from("students")
        .update({
          full_name: editData.full_name,
          email: emailNorm,
          contact_number: editData.contact_number,
          gender: editData.gender,
          parent_name: editData.parent_name,
          university_name: editData.university_name,
          college_name: editData.college_name,
          degree: editData.degree,
          department: editData.department,
          academic_session: editData.academic_session,
          class_semester: editData.class_semester,
          roll_number: editData.roll_number,
          internship_domain: editData.internship_domain,
          course: courseVal,
          registration_id: editData.registration_id,
          joining_date: editData.joining_date,
          completion_date: editData.completion_date,
          internship_duration: editData.internship_duration,
          emergency_name: editData.emergency_name,
          emergency_relation: editData.emergency_relation,
          emergency_contact: editData.emergency_contact,
          metadata: mergedMeta,
          ...(dirPw ? { password: dirPw } : {}),
        })
        .eq("id", editData.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updatedStudent?.id) {
        throw new Error(
          "Student row was not updated (0 rows). Check RLS allows staff to UPDATE students (fix_staff_rls.sql)."
        );
      }
      await adminUpsertStudentProfile(supabase, {
        id: editData.id,
        full_name: editData.full_name || "Student",
        email: emailNorm,
        contact_number: editData.contact_number,
        gender: editData.gender,
        parent_name: editData.parent_name,
      });
      toast.success("Student updated");
      setIsEditDialogOpen(false);
      loadData();
      await logAdminAction("UPDATE", "student", `Staff updated student ${editData.full_name}`, {
        student_id: editData.id,
      });
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setProcessing(false);
    }
  };

  const logAdminAction = async (action_type: string, entity_type: string, description: string, metadata: any = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        admin_email: user.email,
        action_type,
        entity_type,
        description,
        metadata
      });
    } catch (err) {
      console.error('Failed to log admin action:', err);
    }
  };

  const handleTransferLead = async (lead: any) => {
    const leadEmail = lead.email || lead.user_email;
    const leadName = lead.full_name || lead.metadata?.fullName || leadEmail;

    if (!confirm(`Are you sure you want to transfer ${leadName} to registered students? This will create a student account.`)) return;

    let password = lead.metadata?.password;
    if (!password) {
      password = prompt(`No password found for this lead. Please enter a password to create their account:`);
      if (!password) return; // User cancelled
      if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    }

    const metadata = lead.metadata || {};
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expired. Please login again.");

      const rawAmount = lead.amount_paise || lead.amount || 9900;
      const amountRupees = rawAmount > 50000 ? rawAmount / 100 : rawAmount; // convert if in paise

      const payload = {
        admin_id: session.user.id,
        student_data: {
          email: String(leadEmail).trim().toLowerCase(),
          full_name: leadName,
          gender: metadata.gender,
          parent_name: metadata.parentName,
          contact_number: lead.user_phone || lead.contact_number || metadata.contact || "",
          university_name: lead.university_name || metadata.university || "",
          college_name: lead.college_name || metadata.college || "",
          course: metadata.course,
          internship_domain: metadata.course,
          degree: metadata.degree,
          department: metadata.department,
          class_semester: metadata.semester,
          academic_session: metadata.session,
          roll_number: metadata.rollNo,
          emergency_name: metadata.emName,
          emergency_contact: metadata.emPhone,
          emergency_relation: metadata.emRel,
          password,
        },
        payment_amount: amountRupees,
        transaction_id: `STAFF_TRANS_${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      };

      const result = await registerStudent(payload);
      const userId = result?.data?.userId;

      // 6. Delete Lead / draft
      if (lead.registration_draft && lead.draft_id) {
        await supabase.from("registration_leads").delete().eq("id", lead.draft_id);
        setRegistrationDraftLeads((prev) => prev.filter((r) => r.id !== lead.draft_id));
      } else if (lead.user_email) {
        await supabase.from("payment_cancelled").delete().eq("id", lead.id);
      } else {
        await supabase.from("payment_success").delete().eq("id", lead.id);
      }

      toast.success("Lead successfully transferred!");
      
      await logAdminAction(
        'TRANSFER', 
        'lead', 
        `Transferred lead ${leadEmail} to registered students`,
        { lead_id: lead.id, student_id: userId }
      );
      
      loadData();
    } catch (err: any) {
      console.error("Transfer error:", err);
      toast.error(err.message || "Failed to transfer lead.");
    } finally {
      setProcessing(false);
    }
  };

  const services = [
    { id: "can_manage_students", label: "Students", icon: Users, color: "text-blue-500", bg: "bg-blue-50", tab: "students" },
    { id: "can_view_payments", label: "Payments", icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-50", tab: "payments" },
    { id: "can_manage_leads", label: "Leads Hub", icon: Target, color: "text-orange-500", bg: "bg-orange-50", tab: "leads" },
    { id: "can_manage_notifications", label: "Notifications", icon: Bell, color: "text-purple-500", bg: "bg-purple-50", tab: "notifications" },
    { id: "can_manage_communications", label: "Communications", icon: Mail, color: "text-indigo-500", bg: "bg-indigo-50", tab: "comms" },
    { id: "can_manage_classes", label: "Live Classes", icon: Video, color: "text-red-500", bg: "bg-red-50", tab: "classes" },
  ];

  const enrolledEmails = new Set(students.map((s) => s.email?.toLowerCase()).filter(Boolean));

  const draftLeadRows = registrationDraftLeads
    .filter((d) => d.email && !enrolledEmails.has(String(d.email).toLowerCase()))
    .map((d) => {
      const pl = d.payload || {};
      const meta = { ...pl };
      const original = {
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
      };
      return {
        id: `reg-draft-${d.id}`,
        created_at: d.updated_at,
        email: d.email,
        full_name: pl.fullName || d.email,
        contact_number: pl.contact || d.phone,
        failure_reason: "Incomplete registration",
        original,
      };
    });

  const leadsUnified = [
    ...draftLeadRows,
    ...[...failedPayments, ...cancelledPayments].map((cp: any) => ({
      id: cp.id,
      created_at: cp.created_at,
      email: cp.email || cp.user_email,
      full_name: cp.full_name || cp.metadata?.fullName || cp.user_email || cp.email || "Lead",
      contact_number: cp.contact_number || cp.user_phone || cp.metadata?.contact,
      failure_reason: cp.failure_reason || cp.reason || "Payment Failed",
      original: cp,
    })),
  ].filter((cp) => {
    if (!cp.email || enrolledEmails.has(String(cp.email).toLowerCase())) return false;
    if (!leadsSearchTerm) return true;
    const s = leadsSearchTerm.toLowerCase();
    return (
      cp.email?.toLowerCase().includes(s) ||
      cp.full_name?.toLowerCase().includes(s) ||
      String(cp.contact_number || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <aside className="hidden md:flex w-64 h-screen bg-white border-r border-slate-200 sticky top-0 flex-col p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-8"><div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg"><LayoutDashboard className="size-5 text-white" /></div><span className="text-xl font-black tracking-tighter">StaffPanel</span></div>
        <nav className="space-y-1 flex-1">
          <button onClick={() => setActiveTab("dashboard")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-slate-50 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard className="size-4" /> Dashboard</button>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6 mb-4 px-3">Authorized Access</div>
          {services.map(s => permissions?.[s.id] && <button key={s.id} onClick={() => setActiveTab(s.tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === s.tab ? 'bg-slate-50 text-primary' : 'text-slate-600 hover:bg-slate-50'}`}><s.icon className={`size-4 ${s.color}`} /> {s.label}</button>)}
        </nav>
        <Button variant="ghost" className="mt-auto justify-start text-red-500 hover:bg-red-50 font-bold" onClick={() => { supabase.auth.signOut(); navigate(ADMIN_LOGIN_PATH); }}><LogOut className="size-4 mr-2" /> Logout</Button>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/80">
          <div><h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{activeTab === 'dashboard' ? `Hello, ${staffName.split(' ')[0]}` : services.find(s => s.tab === activeTab)?.label}</h1><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">EzyIntern Staff Access</p></div>
          <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-primary text-xs border border-slate-200">{staffName[0]}</div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service) => permissions?.[service.id] && (
                <Card key={service.id} className="p-6 border-none shadow-elegant hover:scale-105 transition-all cursor-pointer group bg-white" onClick={() => setActiveTab(service.tab)}>
                  <div className={`size-12 rounded-2xl ${service.bg} flex items-center justify-center mb-4 group-hover:shadow-md transition-all`}><service.icon className={`size-6 ${service.color}`} /></div>
                  <h3 className="font-bold text-slate-800 mb-1">{service.label}</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Manage {service.label.toLowerCase()}</p>
                </Card>
              ))}

              {/* Quick Offer Letter Download Card */}
              <Card className="p-6 border-none shadow-elegant bg-white border-t-4 border-t-indigo-600">
                <div className="size-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4"><FileText className="size-6 text-indigo-600" /></div>
                <h3 className="font-bold text-slate-800 mb-4">Quick Offer Letter</h3>
                <div className="space-y-3">
                  <Input 
                    placeholder="Student Email Address" 
                    value={downloadEmail} 
                    onChange={e => setDownloadEmail(e.target.value)}
                    className="h-10 text-xs"
                  />
                  <Button 
                    className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 font-bold gap-2 text-xs" 
                    onClick={handleManualDownload}
                    disabled={processing}
                  >
                    {processing ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    Download Letter
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <Card className="p-6 border-none shadow-elegant bg-white sticky top-28">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Megaphone className="size-5 text-purple-600" /> New Announcement</h3>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Target Audience</Label><Select value={newNoticeTarget} onValueChange={setNewNoticeTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Broadcast to All</SelectItem><SelectItem value="specific">Specific Student</SelectItem></SelectContent></Select></div>
                    {newNoticeTarget === "specific" && <div className="space-y-2"><Label>Student Reg ID or UUID</Label><Input value={newNoticeTargetUserId} onChange={e => setNewNoticeTargetUserId(e.target.value)} placeholder="EZY/..." /></div>}
                    <div className="space-y-2"><Label>Title</Label><Input value={newNoticeTitle} onChange={e => setNewNoticeTitle(e.target.value)} placeholder="Important Update" /></div>
                    <div className="space-y-2"><Label>Message Content</Label><textarea className="w-full h-32 p-4 rounded-xl border bg-slate-50 text-sm focus:ring-2 focus:ring-purple-200 transition-all outline-none" value={newNoticeMessage} onChange={e => setNewNoticeMessage(e.target.value)} placeholder="Type your message here..." /></div>
                    <Button className="w-full h-12 bg-purple-600 hover:bg-purple-700 font-bold" onClick={handleSendNotification} disabled={processing}>{processing ? <Loader2 className="size-4 animate-spin" /> : "Send Notification Now"}</Button>
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-2">
                <Card className="p-6 border-none shadow-elegant bg-white min-h-[600px]">
                  <h3 className="text-lg font-bold mb-6">Sent Notifications</h3>
                  <ScrollArea className="h-[700px]">
                    <div className="space-y-4">
                      {notifications.map(n => (
                        <div key={n.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-3">
                            <div><h4 className="font-bold text-slate-800">{n.title}</h4><p className="text-[10px] text-slate-400 font-black uppercase mt-0.5">{new Date(n.created_at).toLocaleString()}</p></div>
                            <Badge variant="outline" className="text-[9px] uppercase">{n.target_type === 'all' ? 'Universal' : 'Specific'}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed mb-4">{n.message}</p>
                          <div className="flex items-center justify-between text-[10px] pt-3 border-t border-slate-100">
                             <span className="text-slate-400 font-bold">Target: <span className="text-slate-600">{n.target_user_id ? "Direct Message" : "Global Announcement"}</span></span>
                             {n.target_user_id && <span className="text-indigo-600 font-black">ID: {n.target_user_id.substring(0, 12)}...</span>}
                          </div>
                        </div>
                      ))}
                      {notifications.length === 0 && <div className="text-center py-20 text-slate-400 italic">No notifications sent yet.</div>}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <Card className="p-6 border-none shadow-elegant bg-white">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      className="pl-9 h-11"
                      placeholder="Name, email, reg ID, phone, roll no, college..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                    />
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-none px-4 py-2 font-black">
                    {studentsLoading ? "Searching…" : `Showing: ${students.length}`}
                  </Badge>
                </div>
                {permissions?.can_manage_students && (
                  <Button
                    className="font-bold gap-2 bg-primary hover:bg-primary/90 shadow-soft"
                    onClick={() => {
                      setAddStudentFormKey((k) => k + 1);
                      setIsAddStudentOpen(true);
                    }}
                  >
                    <UserPlus className="size-4" /> Add Student
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {studentsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin inline mr-2" />
                        Loading students…
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                        {studentSearchTerm.trim()
                          ? "No students match your search."
                          : "No students in directory."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!studentsLoading &&
                    students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell><div className="flex items-center gap-3"><div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-primary font-black text-xs">{s.full_name?.charAt(0)}</div><div><p className="font-bold text-sm">{s.full_name}</p><p className="text-[10px] text-slate-500">{s.email}</p></div></div></TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] font-black uppercase">{s.internship_domain}</Badge></TableCell>
                      <TableCell><Badge className={s.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}>{s.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="size-8 p-0"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-elegant">
                            <DropdownMenuItem className="gap-2 font-bold" onClick={() => { setSelectedUser(s); setIsViewDialogOpen(true); }}><Eye className="size-4" /> View Profile</DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 font-bold"
                              onClick={() => {
                                setEditData({
                                  ...s,
                                  internship_mode:
                                    s.internship_mode || s.metadata?.internship_mode || "Online",
                                  subject:
                                    typeof s.metadata?.subject === "string"
                                      ? s.metadata.subject
                                      : (s as { subject?: string }).subject || "",
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="size-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 font-bold" onClick={() => { setSelectedUser(s); setIsResetPassOpen(true); }}><KeyRound className="size-4" /> Reset Password</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 font-bold text-indigo-600" onClick={() => handleDownloadOffer(s)}><FileText className="size-4" /> Offer Letter</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {activeTab === 'payments' && (
            <Card className="p-6 border-none shadow-elegant bg-white">
              <div className="flex items-center justify-between mb-6"><div><h3 className="text-lg font-bold">Successful Transactions</h3></div><div className="relative w-96"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input className="pl-9 h-10" placeholder="Search by Email, Name or ID..." value={paySearchTerm} onChange={e => setPaySearchTerm(e.target.value)} /></div></div>
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Email</TableHead><TableHead>ID</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.filter(p => p.email?.toLowerCase().includes(paySearchTerm.toLowerCase()) || p.full_name?.toLowerCase().includes(paySearchTerm.toLowerCase())).slice(0, 50).map(p => (<TableRow key={p.id}><TableCell className="text-[10px] font-medium">{new Date(p.created_at).toLocaleString()}</TableCell><TableCell className="font-bold text-sm">{p.full_name || '—'}</TableCell><TableCell className="text-[10px] font-black text-indigo-600">{p.email}</TableCell><TableCell className="text-[10px] font-mono">{p.payment_id}</TableCell><TableCell className="text-xs text-muted-foreground">Paid</TableCell></TableRow>))}
                </TableBody>
              </Table>
            </Card>
          )}

          {activeTab === 'leads' && (
            <Card className="p-6 border-none shadow-elegant bg-white">
              <div className="flex items-center justify-between mb-6"><div><h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600"><UserPlus className="size-5" /> Active Leads Hub</h3></div><div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input className="pl-9 h-9" placeholder="Search leads..." value={leadsSearchTerm} onChange={e => setLeadsSearchTerm(e.target.value)} /></div></div>
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead>Date</TableHead><TableHead>Student Details</TableHead><TableHead>Transaction ID</TableHead><TableHead>Payment</TableHead><TableHead>Error</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {leadsUnified.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-medium italic">
                        No leads yet (incomplete registrations and failed payments appear here).
                      </TableCell>
                    </TableRow>
                  ) : (
                    leadsUnified.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-[10px] font-medium">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800">{l.full_name}</div>
                          <div className="text-[10px] text-muted-foreground">{l.email}</div>
                          {l.contact_number && (
                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">📞 {l.contact_number}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {l.original.payment_id || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              l.failure_reason === "Incomplete registration"
                                ? "bg-amber-100 text-amber-900 border-none text-[10px] font-bold"
                                : "bg-red-100 text-red-700 border-none text-[10px] font-bold"
                            }
                          >
                            {l.failure_reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(l.original);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0 rounded-full hover:bg-emerald-600 hover:text-white transition-all"
                              onClick={() => handleTransferLead(l.original)}
                              disabled={processing}
                            >
                              <UserPlus className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border-none shadow-elegant">
          <DialogDescription className="sr-only">
            Edit student directory record (same fields as admin panel).
          </DialogDescription>
          <div className="bg-primary p-6 text-white">
            <DialogTitle className="text-2xl font-black">Edit student</DialogTitle>
          </div>
          {editData && (
            <ScrollArea className="max-h-[70vh]">
              <form onSubmit={handleEditStudent} className="p-8 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <User className="size-3" /> Personal information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Full name</Label>
                      <Input
                        value={editData.full_name || ""}
                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input
                        type="email"
                        value={editData.email || ""}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contact number</Label>
                      <Input
                        value={editData.contact_number || ""}
                        onChange={(e) => setEditData({ ...editData, contact_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Gender</Label>
                      <Select
                        value={
                          ["Male", "Female", "Other"].includes(editData.gender)
                            ? editData.gender
                            : EDIT_GENDER_SENTINEL
                        }
                        onValueChange={(v) =>
                          setEditData({
                            ...editData,
                            gender: v === EDIT_GENDER_SENTINEL ? "" : v,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EDIT_GENDER_SENTINEL}>Not specified</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">Parent / guardian</Label>
                      <Input
                        value={editData.parent_name || ""}
                        onChange={(e) => setEditData({ ...editData, parent_name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <StudentEditFormFields
                  editData={editData}
                  setEditData={setEditData}
                  domains={domains}
                  unis={unis}
                  colleges={colleges}
                />

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={processing}>
                    {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Save changes
                  </Button>
                </div>
              </form>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-black">
                  {(selectedUser?.full_name || selectedUser?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black leading-tight">
                    {selectedUser?.full_name || selectedUser?.metadata?.fullName || "User Profile"}
                  </DialogTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedUser?.registration_id && <Badge className="bg-white/20 hover:bg-white/30 border-none text-white font-bold">{selectedUser.registration_id}</Badge>}
                    <Badge className={`${selectedUser?.status === 'Active' ? 'bg-emerald-500' : 'bg-orange-500'} border-none text-white font-black`}>
                      {selectedUser?.status || (selectedUser?.failure_reason ? 'LEAD (FAILED)' : 'PENDING')}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            </div>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              {/* Core Information */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <User className="size-3" /> Personal & Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Email Address</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.email || selectedUser?.user_email || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Contact Number</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.contact_number || selectedUser?.user_phone || selectedUser?.metadata?.contact || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Gender</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.gender || selectedUser?.metadata?.gender || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Parent/Guardian Name</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.parent_name || selectedUser?.metadata?.parentName || "N/A"}</p>
                  </div>
                </div>
              </section>

              {/* Academic Details */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <GraduationCap className="size-3" /> Academic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">University</p>
                    <p className="text-sm font-black text-indigo-600 uppercase">{selectedUser?.university_name || selectedUser?.metadata?.university || "N/A"}</p>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">College</p>
                    <p className="text-sm font-black text-slate-800 uppercase">{selectedUser?.college_name || selectedUser?.metadata?.college || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Degree & Department</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.degree} - {selectedUser?.department || selectedUser?.metadata?.department || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Internship Domain</p>
                    <p className="text-sm font-black text-emerald-600 uppercase">{selectedUser?.internship_domain || selectedUser?.course || selectedUser?.metadata?.course || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Semester / Roll No</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.class_semester || selectedUser?.metadata?.semester} / {selectedUser?.roll_number || selectedUser?.metadata?.rollNo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Academic Session</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.academic_session || selectedUser?.metadata?.session || "N/A"}</p>
                  </div>
                </div>
              </section>

              {/* Emergency Contact */}
              {(selectedUser?.emergency_name || selectedUser?.metadata?.emName) && (
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                    <Phone className="size-3" /> Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-red-50 p-6 rounded-2xl border border-red-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-red-400 uppercase">Name</p>
                      <p className="text-sm font-black text-red-700">{selectedUser?.emergency_name || selectedUser?.metadata?.emName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-red-400 uppercase">Relation</p>
                      <p className="text-sm font-black text-red-700">{selectedUser?.emergency_relation || selectedUser?.metadata?.emRel}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-red-400 uppercase">Contact</p>
                      <p className="text-sm font-black text-red-700">{selectedUser?.emergency_contact || selectedUser?.metadata?.emPhone}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Metadata & Transaction Info */}
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <CreditCard className="size-3" /> Metadata & Transactions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">CyberCafe Partner</p>
                    <p className="text-sm font-black text-slate-800">{selectedUser?.cybercafe_shop_name || "Direct Registration"}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedUser?.cybercafe_email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Issue / Reason</p>
                    <p className="text-sm font-black text-red-600">{selectedUser?.failure_reason || selectedUser?.reason || "No issues recorded"}</p>
                  </div>
                  {selectedUser?.payment_id && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Payment ID</p>
                      <p className="text-sm font-mono font-black text-indigo-600">{selectedUser.payment_id}</p>
                    </div>
                  )}
                  {selectedUser?.created_at && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Created At</p>
                      <p className="text-sm font-black text-slate-800">{new Date(selectedUser.created_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </ScrollArea>
          
          <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground font-medium italic">Internal View - Authorized Staff Access Only</p>
            <Button variant="outline" className="font-bold px-8 rounded-xl" onClick={() => setIsViewDialogOpen(false)}>Close Window</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isResetPassOpen} onOpenChange={setIsResetPassOpen}><DialogContent className="rounded-3xl border-none"><DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader><div className="py-4"><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" /></div><Button className="w-full" onClick={async () => {
                          if (!selectedUser?.id || !newPassword) return;
                          try {
                            const { error } = await supabase.rpc('admin_reset_user_password', { target_user_id: selectedUser.id, new_pass: newPassword });
                            if (error) throw error;
                            const { data: prevRow } = await supabase.from("students").select("metadata").eq("id", selectedUser.id).maybeSingle();
                            const prevMeta = typeof prevRow?.metadata === "object" && prevRow.metadata !== null ? prevRow.metadata : {};
                            const mergedMeta = { ...(prevMeta as object), password: newPassword };
                            const { error: upErr } = await supabase.from("students").update({ password: newPassword, metadata: mergedMeta }).eq("id", selectedUser.id);
                            if (upErr) throw upErr;
                            toast.success("Reset!");
                            setIsResetPassOpen(false);
                            setNewPassword("");
                            loadData();
                          } catch (e: unknown) {
                            toast.error(e instanceof Error ? e.message : "Reset failed");
                          }
                        }}>Confirm</Button></DialogContent></Dialog>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-[min(100vw-2rem,56rem)] max-h-[90vh] overflow-y-auto border-none shadow-elegant rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <UserPlus className="size-6 text-primary" />
              Add student (full registration)
            </DialogTitle>
            <DialogDescription>
              Same workflow as the admin panel: complete all steps; no payment when disabled globally.
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm
            key={addStudentFormKey}
            variant="admin"
            onAdminComplete={async (info) => {
              await logAdminAction(
                "CREATE",
                "student",
                `Staff added student (full form): ${info.full_name}`,
                { email: info.email }
              );
              setIsAddStudentOpen(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="fixed left-[-10000px] top-0 pointer-events-none" aria-hidden>
        {selectedUser && <OfferLetter ref={offerLetterRef} profile={selectedUser} />}
      </div>
    </div>
  );
};

export default StaffDashboard;
