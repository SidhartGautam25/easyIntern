import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SiteNav } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, GraduationCap, Phone, ShieldCheck, Download, FileText, ExternalLink, Calendar, MapPin, Award, Briefcase, Mail, Globe, BookOpen, CheckCircle2, LogOut, Bell, Clock, CheckSquare, Edit2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ChangePinModal } from "@/components/ChangePinModal";
import { syncDirectoryPasswordAfterAuthChange } from "@/lib/studentCredentials";
import { OfferLetter } from "@/components/OfferLetter";
import { downloadOfferLetterPdf } from "@/lib/offerLetterPdf";
import { normalizeOfferLetterProfile } from "@/lib/offerLetterProfile";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'home' | 'profile' | 'settings'>('home');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isAssignmentsOpen, setIsAssignmentsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [academic, setAcademic] = useState<any>(null);
  const [emergency, setEmergency] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cert, setCert] = useState<any>(null);
  const [isOfferLetterOpen, setIsOfferLetterOpen] = useState(false);
  const [isCertOpen, setIsCertOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const offerLetterRef = useRef<HTMLDivElement>(null);
  const certRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileData, setEditProfileData] = useState<any>({});
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [unis, setUnis] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);

  // Attendance States
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [attendanceMarkedToday, setAttendanceMarkedToday] = useState(false);
  const holdTimer = useRef<any>(null);
  const holdStart = useRef<number>(0);

  const offerLetterProfile = useMemo(
    () => normalizeOfferLetterProfile(profile, payment),
    [profile, payment]
  );

  useEffect(() => {
    (async () => {
      // Small delay to let Supabase initialize session from storage (helps on mobile)
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Double check after a small delay
        await new Promise(r => setTimeout(r, 500));
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }

      if (!session) { 
        console.log("No session found in Dashboard. Redirecting to login...");
        navigate("/login"); 
        return; 
      }
      
      const impersonateId = localStorage.getItem("impersonate_id");
      const uid = impersonateId || session.user.id;
      const isImpersonating = !!impersonateId;
      setCurrentUserId(session.user.id);

      const [s, r, c, ss, n, a, asub, pay] = await Promise.all([
        supabase.from("students").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("certificates").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("system_settings").select("*"),
        supabase.from("notifications").select("*").or(`target_type.eq.all,target_user_id.eq.${uid}`).order("created_at", { ascending: false }).limit(20),
        supabase.from("assignments").select("*").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("assignment_submissions").select("*").eq("student_id", uid),
        supabase.from("payment_success").select("*").eq("user_id", uid).maybeSingle()
      ]);
      const roles = r.data || [];
      const isAdminRole = roles.some((x: any) => x.role === "admin" || x.role === "super_admin");
      const isStaffRole = roles.some((x: any) => x.role === "staff");
      setIsAdmin(isAdminRole);
      
      // If staff and NOT impersonating, redirect to staff dashboard
      if (isStaffRole && !isImpersonating) {
        navigate("/staff-dashboard");
        return;
      }

      // If admin and NOT impersonating, redirect to admin panel
      if (isAdminRole && !isImpersonating) {
        navigate("/admin");
        return;
      }

      let studentData = s.data;

      // Fallback: If no record in 'students' table, try fetching from legacy tables
      if (!studentData) {
        const [p, ai, ec] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("academic_info").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("emergency_contacts").select("*").eq("user_id", uid).maybeSingle(),
        ]);
        
        if (p.data) {
          studentData = {
            ...p.data,
            university_name: ai.data?.university_name,
            college_name: ai.data?.college_name,
            course: ai.data?.course,
            degree: ai.data?.degree,
            department: ai.data?.department,
            class_semester: ai.data?.class_semester,
            academic_session: ai.data?.academic_session,
            roll_number: ai.data?.roll_number,
            emergency_name: ec.data?.contact_name,
            emergency_contact: ec.data?.contact_number,
            emergency_relation: ec.data?.relationship
          };
        }
      }

      setProfile(studentData);
      setCert(c.data);
      setPayment(pay.data);
      setSystemSettings(ss.data || []);
      setNotifications(n.data || []);

      // Fetch Attendance
      const { data: attData } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", uid)
        .order("marked_at", { ascending: false });
      const records = attData || [];
      setAttendanceList(records);
      const todayStr = new Date().toLocaleDateString();
      setAttendanceMarkedToday(records.some(r => new Date(r.marked_at).toLocaleDateString() === todayStr));
      
      const assignmentsWithSubs = (a.data || []).map(assgn => {
         const sub = (asub.data || []).find((sub: any) => sub.assignment_id === assgn.id);
         return { ...assgn, submission: sub };
      });
      setAssignmentsList(assignmentsWithSubs);
      
      // Fetch live classes
      const { data: clsData } = await supabase.from("classes").select("*, internship_domains(name)").order("scheduled_at", { ascending: true });
      if (clsData) {
        const domainName = studentData?.internship_domain;
        const relevantClasses = clsData.filter(c => c.is_active !== false && (!c.domain_id || c.internship_domains?.name === domainName));
        setLiveClasses(relevantClasses);
      }

      // Fetch unis, colleges, domains for profile edit
      const [uData, cData, dData] = await Promise.all([
        supabase.from("universities").select("*").order("name"),
        supabase.from("colleges").select("*").order("name"),
        supabase.from("internship_domains").select("*").order("name")
      ]);
      setUnis(uData.data || []);
      setColleges(cData.data || []);
      setDomains(dData.data || []);

      setLoading(false);
    })().catch(err => {
      console.error("Dashboard critical error:", err);
      toast.error("Failed to load dashboard data. Please refresh.");
      setLoading(false);
    });
  }, [navigate]);

  const downloadCert = async () => {
    if (!certRef.current) return;
    setGenerating(true);
    
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.top = "-9999px";
    wrapper.style.left = "-9999px";
    wrapper.style.width = "297mm";
    
    const clone = certRef.current.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4"); // Portrait for new certificate format
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Certificate_${profile?.full_name?.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificate downloaded!");
    } catch (error) {
      toast.error("Download failed");
    } finally {
      document.body.removeChild(wrapper);
      setGenerating(false);
    }
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    setGenerating(true);
    
    const wrapper = document.createElement("div");
    wrapper.style.position = "absolute";
    wrapper.style.top = "-9999px";
    wrapper.style.left = "-9999px";
    wrapper.style.width = "210mm";
    
    const clone = receiptRef.current.cloneNode(true) as HTMLElement;
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payment_Receipt_${profile?.full_name?.replace(/\s+/g, "_") || "EzyIntern"}.pdf`);
      toast.success("Receipt downloaded successfully!");
    } catch (error) {
      toast.error("Failed to generate PDF");
    } finally {
      document.body.removeChild(wrapper);
      setGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!offerLetterRef.current) return;
    setGenerating(true);
    try {
      await downloadOfferLetterPdf(offerLetterRef.current, {
        fileName: `EzyIntern_Offer_Letter_${profile?.full_name?.replace(/\s+/g, "_") || "Student"}.pdf`,
        captureInPlace: false,
      });
      toast.success("Offer letter downloaded successfully!");
    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = localStorage.getItem("impersonate_id") || session.user.id;

      const emailNorm = String(profile?.email || session.user.email || "").trim().toLowerCase();
      if (!emailNorm) {
        toast.error("Your account email is missing. Please contact support.");
        return;
      }

      const { data: freshSnap } = await supabase.from("students").select("password, metadata").eq("id", uid).maybeSingle();
      const snapMeta =
        typeof freshSnap?.metadata === "object" && freshSnap.metadata !== null
          ? { ...(freshSnap.metadata as Record<string, unknown>) }
          : {};

      const fullName =
        String(editProfileData.full_name || "").trim() ||
        profile?.full_name ||
        session.user.user_metadata?.full_name ||
        "Student";

      const mergedMeta = {
        ...snapMeta,
        subject: editProfileData.subject,
        internship_mode:
          editProfileData.internship_mode?.trim() ||
          snapMeta.internship_mode ||
          (profile?.metadata as Record<string, unknown>)?.internship_mode,
      };
      const snapPw =
        typeof freshSnap?.password === "string" && freshSnap.password.trim() ? freshSnap.password.trim() : "";
      if (snapPw) mergedMeta.password = snapPw;

      // NOT NULL email/full_name must be sent or INSERT branch of upsert fails
      const row = {
        id: uid,
        email: emailNorm,
        full_name: fullName,
        contact_number: editProfileData.contact_number ?? profile?.contact_number ?? "",
        parent_name: editProfileData.parent_name ?? profile?.parent_name ?? "",
        gender: editProfileData.gender ?? profile?.gender ?? "",
        university_name: editProfileData.university_name ?? profile?.university_name ?? "",
        college_name: editProfileData.college_name ?? profile?.college_name ?? "",
        degree: editProfileData.degree ?? profile?.degree ?? "",
        department: editProfileData.department ?? profile?.department ?? "",
        academic_session: editProfileData.academic_session ?? profile?.academic_session ?? "",
        class_semester: editProfileData.class_semester ?? profile?.class_semester ?? "",
        roll_number: editProfileData.roll_number ?? profile?.roll_number ?? "",
        internship_domain: editProfileData.internship_domain ?? profile?.internship_domain ?? profile?.course ?? "",
        course: editProfileData.internship_domain ?? profile?.internship_domain ?? profile?.course ?? "",
        internship_duration:
          editProfileData.internship_duration ?? profile?.internship_duration ?? "",
        joining_date: editProfileData.joining_date ?? profile?.joining_date ?? "",
        completion_date: editProfileData.completion_date ?? profile?.completion_date ?? "",
        emergency_name: editProfileData.emergency_name ?? profile?.emergency_name ?? "",
        emergency_contact: editProfileData.emergency_contact ?? profile?.emergency_contact ?? "",
        emergency_relation: editProfileData.emergency_relation ?? profile?.emergency_relation ?? "",
        status: profile?.status || "Active",
        metadata: mergedMeta,
        ...(snapPw ? { password: snapPw } : {}),
      };

      const { data: saved, error } = await supabase.from("students").upsert(row).select("id,email").maybeSingle();

      if (error) throw error;
      if (!saved?.id) {
        throw new Error("Could not save student profile (blocked or no row returned). Check database policies.");
      }

      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: uid,
        full_name: fullName,
        email: emailNorm,
        contact_number: row.contact_number,
        gender: row.gender,
        parent_name: row.parent_name,
      });
      if (profileErr) console.warn("profiles sync:", profileErr);

      // Update local state to reflect changes immediately
      setProfile({
        ...profile,
        ...editProfileData,
        email: emailNorm,
        full_name: fullName,
        metadata: mergedMeta,
        course: row.course,
        internship_domain: row.internship_domain,
        internship_duration: row.internship_duration,
        joining_date: row.joining_date,
        completion_date: row.completion_date,
        internship_mode: editProfileData.internship_mode || mergedMeta.internship_mode,
      });
      
      toast.success("Profile updated successfully!");
      setIsEditProfileOpen(false);
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const isServiceEnabled = (key: string) => {
    const s = systemSettings.find(x => x.key === key);
    return s ? s.is_enabled : true;
  };

  const startHold = () => {
    if (attendanceMarkedToday) return;
    setIsHolding(true);
    holdStart.current = Date.now();
    setHoldProgress(0);
    holdTimer.current = setInterval(() => {
      const elapsed = (Date.now() - holdStart.current) / 10000;
      const pct = Math.min(elapsed * 100, 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(holdTimer.current);
        markAttendance();
      }
    }, 50);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    setIsHolding(false);
    setHoldProgress(0);
  };

  const markAttendance = async () => {
    setIsHolding(false);
    setHoldProgress(0);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = localStorage.getItem("impersonate_id") || session.user.id;
    const todayStr = new Date().toLocaleDateString();
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", uid)
      .gte("marked_at", new Date(new Date().setHours(0,0,0,0)).toISOString());
    if (existing && existing.length > 0) {
      toast.info("Attendance already marked for today!");
      setAttendanceMarkedToday(true);
      return;
    }
    const { error } = await supabase.from("attendance").insert({ student_id: uid });
    if (error) { toast.error("Failed to mark attendance"); return; }
    toast.success("✅ Attendance marked successfully!");
    const { data: attData } = await supabase.from("attendance").select("*").eq("student_id", uid).order("marked_at", { ascending: false });
    setAttendanceList(attData || []);
    setAttendanceMarkedToday(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg overflow-hidden bg-white border border-slate-100">
              <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-slate-900 hidden sm:block">Student Portal</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <DropdownMenu open={isNotifOpen} onOpenChange={setIsNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative p-2">
                  <Bell className="size-5 text-slate-600" />
                  {notifications.length > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive animate-pulse"></span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 shadow-elegant">
                <div className="p-4 border-b bg-muted/20">
                  <h3 className="font-bold">Notifications</h3>
                </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                     <div className="p-4 text-sm text-center text-muted-foreground">No new notifications</div>
                  ) : (
                    notifications.map((notif: any) => (
                      <div key={notif.id} className="p-4 border-b hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-sm">{notif.title}</h4>
                          <span className="text-[10px] text-muted-foreground">{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-slate-600">{notif.message}</p>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" className={`text-slate-600 hover:text-primary gap-2 ${activeView === 'profile' ? 'bg-primary/10 text-primary' : ''}`} onClick={() => {
              setActiveView(prev => prev === 'profile' ? 'home' : 'profile');
            }}>
              <User className="size-4" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <Button variant="ghost" size="sm" className={`text-slate-600 hover:text-primary gap-2 ${activeView === 'settings' ? 'bg-primary/10 text-primary' : ''}`} onClick={() => setActiveView('settings')}>
              <ShieldCheck className="size-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-2" onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>

        </div>
      </header>

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
              <div className="size-16 md:size-20 rounded-2xl gradient-hero flex items-center justify-center text-white text-3xl font-bold shadow-elegant">
                {profile?.full_name?.charAt(0)}
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Howdy, {profile?.full_name?.split(" ")[0]}!</h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1">Student Dashboard</span>
                  <span className="size-1 rounded-full bg-muted-foreground/30"></span>
                  <span className="text-primary font-medium">Registration ID: {profile?.registration_id || "—"}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {localStorage.getItem("impersonate_id") && (
                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 w-full sm:w-auto" onClick={() => { localStorage.removeItem("impersonate_id"); window.location.reload(); }}>
                  Exit Preview
                </Button>
              )}
              {isAdmin && !localStorage.getItem("impersonate_id") && (
                <Button variant="outline" className="shadow-sm border-primary/20 hover:bg-primary/5 gap-2 w-full sm:w-auto" onClick={() => navigate("/admin")}>
                  <ShieldCheck className="size-4 text-primary" /> Admin Panel
                </Button>
              )}
              <Button variant="hero" className="gap-2 shadow-lg w-full sm:w-auto" onClick={() => setIsOfferLetterOpen(true)}>
                <FileText className="size-4" /> Offer Letter
              </Button>
            </div>
          </div>

          {activeView === 'settings' ? (
            <div className="max-w-md mx-auto">
              <Card className="p-8 shadow-elegant border-none bg-white">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Security Settings</h3>
                {currentUserId && (
                  <div className="mb-6 p-4 bg-slate-50 rounded-xl border">
                    <p className="text-sm font-bold text-slate-700 mb-3">4-Digit Security Code</p>
                    <p className="text-xs text-slate-500 mb-4">This code is used as an additional layer of protection when you login.</p>
                    <ChangePinModal userId={currentUserId} />
                  </div>
                )}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const newPass = (form.elements.namedItem('new_password') as HTMLInputElement).value;
                  const confirmPass = (form.elements.namedItem('confirm_password') as HTMLInputElement).value;

                  if (newPass !== confirmPass) return toast.error("Passwords do not match");
                  if (newPass.length < 6) return toast.error("Password must be at least 6 characters");

                  const { error } = await supabase.auth.updateUser({ password: newPass });
                  if (error) toast.error(error.message);
                  else {
                    try {
                      await syncDirectoryPasswordAfterAuthChange(supabase, newPass);
                    } catch (syncErr: unknown) {
                      const m = syncErr instanceof Error ? syncErr.message : String(syncErr);
                      toast.warning(
                        `Login password updated, but saving copy for admin emails failed: ${m}. Run migration 20260509232000_student_sync_directory_password_rpc.sql or contact support.`
                      );
                    }
                    toast.success("Password updated successfully!");
                    form.reset();
                  }
                }} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">New Password</label>
                    <input name="new_password" type="password" className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all" required placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Confirm New Password</label>
                    <input name="confirm_password" type="password" className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all" required placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full h-12 shadow-glow gap-2 mt-2">
                    <CheckCircle2 className="size-4" /> Update Password
                  </Button>
                </form>
              </Card>
            </div>
          ) : activeView === 'profile' ? (
            <>
              <div id="profile-section" className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-8 shadow-elegant border-none bg-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <User className="size-20 text-primary" />
                </div>
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2"><User className="size-5 text-primary" /> Personal Profile</h3>
                  <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 gap-2" onClick={() => {
                    setEditProfileData({
                      full_name: profile?.full_name || "",
                      contact_number: profile?.contact_number || "",
                      parent_name: profile?.parent_name || profile?.father_name || "",
                      gender: profile?.gender || "",
                      university_name: profile?.university_name || "",
                      college_name: profile?.college_name || "",
                      degree: profile?.degree || "",
                      department: profile?.department || "",
                      subject: profile?.metadata?.subject || "",
                      academic_session: profile?.academic_session || "",
                      class_semester: profile?.class_semester || "",
                      roll_number: profile?.roll_number || "",
                      internship_domain: profile?.internship_domain || profile?.course || "",
                      internship_mode:
                        profile?.internship_mode ||
                        profile?.metadata?.internship_mode ||
                        "Online",
                      internship_duration: profile?.internship_duration || "",
                      joining_date: profile?.joining_date || "",
                      completion_date: profile?.completion_date || "",
                      emergency_name: profile?.emergency_name || "",
                      emergency_contact: profile?.emergency_contact || "",
                      emergency_relation: profile?.emergency_relation || "",
                    });
                    setIsEditProfileOpen(true);
                  }}>
                    <Edit2 className="size-4" /> Edit Profile
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Full Name</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.full_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Email Address</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{profile?.email || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Contact Number</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.contact_number || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Gender</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.gender || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Parent / Guardian Name</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.parent_name || profile?.father_name || "—"}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 shadow-elegant border-none bg-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <GraduationCap className="size-20 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b pb-4"><GraduationCap className="size-5 text-primary" /> Academic Information</h3>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">University Name</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.university_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">College Name</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.college_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Degree Program</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.degree || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Department</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.department || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Major / Subject</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.metadata?.subject || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Academic Session</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.academic_session || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Class / Semester</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.class_semester || profile?.class_sem || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Registration No.</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.roll_number || "—"}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Internship Domain</p>
                    <p className="text-base font-black text-primary">{profile?.course || profile?.internship_domain || "—"}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-8 shadow-elegant border-none bg-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Phone className="size-20 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b pb-4"><Phone className="size-5 text-primary" /> Emergency Details</h3>
                <div className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Contact Name</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.emergency_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Contact Phone</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.emergency_contact || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Relationship</p>
                    <p className="text-sm font-bold text-slate-800">{profile?.emergency_relation || "—"}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-none bg-gradient-to-br from-primary to-accent text-white shadow-elegant">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-sm">
                    <Award className="size-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Status: Active</h4>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed">You are currently enrolled in the internship program. Your progress is being tracked by our team.</p>
                  </div>
                </div>
              </Card>

              <Card className="p-8 shadow-elegant border-none bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                  <Briefcase className="size-20" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-3">Support & Help</h3>
                  <p className="text-slate-400 text-sm mb-6 max-w-sm">Need help with your internship or have questions about the portal? Our support team is here to assist you 24/7.</p>
                  <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-white gap-2 w-full">
                    <ExternalLink className="size-4" /> Contact Support
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          <div className="grid md:grid-cols-1 gap-6">
            <Card className="p-8 shadow-elegant border-none bg-white overflow-hidden relative border-t-4 border-t-primary">
              <div className="absolute -bottom-6 -right-6 opacity-10">
                <FileText className="size-32 text-primary" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3">Internship Documents</h3>
                <p className="text-muted-foreground text-sm mb-8 max-w-2xl">Access and download your official internship documents. Your offer letter is available immediately, and your certificate will be generated upon successful completion of the program.</p>
                <div className="flex flex-wrap gap-4">
                  <Button variant="default" className="bg-primary hover:bg-primary/90 h-12 px-6 shadow-md gap-2" onClick={() => setIsOfferLetterOpen(true)}>
                    <Download className="size-5" /> Download Offer Letter
                  </Button>
                  <Button variant="outline" className="h-12 px-6 shadow-md gap-2 border-primary/20 hover:bg-primary/5 text-primary" onClick={() => setIsReceiptOpen(true)}>
                    <FileText className="size-5" /> Payment Receipt
                  </Button>
                  {isServiceEnabled('certificates') && (
                    cert ? (
                      <Button variant="hero" className="h-12 px-6 gap-2" onClick={() => setIsCertOpen(true)}>
                        <Award className="size-5" /> View & Download Certificate
                      </Button>
                    ) : (
                      <Button variant="outline" className="h-12 px-6 bg-slate-100 border-dashed border-slate-300 gap-2 cursor-not-allowed opacity-60 text-slate-500" disabled>
                        <Award className="size-5" /> Certificate Not Ready
                      </Button>
                    )
                  )}
                </div>
                {isServiceEnabled('certificates') && (
                  <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    {!cert ? (
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Loader2 className="size-4 text-primary animate-spin" /> 
                        Your internship is currently in progress. The certificate will be issued automatically after the evaluation phase.
                      </p>
                    ) : (
                      <p className="text-sm text-green-600 font-bold flex items-center gap-2">
                        <CheckCircle2 className="size-4" /> 
                        Congratulations! Your internship certificate has been issued and is ready for download.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
            </>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
              <Card className="p-8 flex flex-col items-center justify-center text-center gap-5 hover:-translate-y-2 transition-all cursor-pointer border-t-4 border-t-primary shadow-elegant bg-white" onClick={() => setIsOfferLetterOpen(true)}>
                 <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner"><FileText className="size-10" /></div>
                 <div><h3 className="font-bold text-xl">Offer Letter</h3><p className="text-sm text-muted-foreground mt-1">Download official letter</p></div>
              </Card>

              <Card className="p-8 flex flex-col items-center justify-center text-center gap-5 hover:-translate-y-2 transition-all cursor-pointer border-t-4 border-t-indigo-500 shadow-elegant bg-white" onClick={() => {
                 document.getElementById('live-classes-section')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                 <div className="size-20 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner"><BookOpen className="size-10" /></div>
                 <div><h3 className="font-bold text-xl">Learning</h3><p className="text-sm text-muted-foreground mt-1">View live classes</p></div>
              </Card>
              <Card className="p-8 flex flex-col items-center justify-center text-center gap-5 hover:-translate-y-2 transition-all cursor-pointer border-t-4 border-t-orange-500 shadow-elegant bg-white" onClick={() => setIsAssignmentsOpen(true)}>
                 <div className="size-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner"><FileText className="size-10" /></div>
                 <div><h3 className="font-bold text-xl">Assignments</h3><p className="text-sm text-muted-foreground mt-1">Take proctored tests</p></div>
              </Card>
              <Card className={`p-8 flex flex-col items-center justify-center text-center gap-5 transition-all shadow-elegant bg-white ${cert ? 'hover:-translate-y-2 cursor-pointer border-t-4 border-t-emerald-500' : 'opacity-70 cursor-not-allowed border-t-4 border-t-slate-300'}`} onClick={() => cert && setIsCertOpen(true)}>
                 <div className={`size-20 rounded-full flex items-center justify-center shadow-inner ${cert ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Award className="size-10" /></div>
                 <div><h3 className="font-bold text-xl">Certificate</h3><p className="text-sm text-muted-foreground mt-1">{cert ? "Download certificate" : "Not yet generated"}</p></div>
              </Card>
              <Card className="p-8 flex flex-col items-center justify-center text-center gap-5 hover:-translate-y-2 transition-all cursor-pointer border-t-4 border-t-violet-500 shadow-elegant bg-white" onClick={() => document.getElementById('attendance-section')?.scrollIntoView({ behavior: 'smooth' })}>
                 <div className="size-20 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 shadow-inner"><CheckSquare className="size-10" /></div>
                 <div>
                   <h3 className="font-bold text-xl">Attendance</h3>
                   <p className="text-sm text-muted-foreground mt-1">{attendanceList.length} days marked</p>
                   {attendanceMarkedToday && <Badge className="mt-2 bg-violet-100 text-violet-700 border-none text-[10px]">✅ Marked Today</Badge>}
                 </div>
              </Card>
            </div>
          )}

          {/* Attendance Section — always visible in home view */}
          {activeView === 'home' && (
            <div id="attendance-section" className="mt-10 mb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3"><CheckSquare className="size-6 text-violet-600" /> Attendance</h2>
                <div className="h-px flex-1 mx-6 bg-slate-200 hidden md:block"></div>
                <Badge className="bg-violet-100 text-violet-700 border-none font-black">{attendanceList.length} Total Days</Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Mark Attendance Card */}
                <Card className="p-8 border-none shadow-elegant bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5"><CheckSquare className="size-32" /></div>
                  <div>
                    <h3 className="text-xl font-black mb-1">Mark Attendance</h3>
                    <p className="text-slate-400 text-sm">
                      {attendanceMarkedToday ? "✅ You've marked attendance for today" : "Hold the button for 10 seconds to mark"}
                    </p>
                  </div>

                  {/* Circular Hold Button */}
                  <div className="relative flex items-center justify-center select-none py-4">
                    <div className="relative flex items-center justify-center">
                      <svg className="absolute" width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                        {/* Background Track */}
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#ffffff10" strokeWidth="10" />
                        {/* Progress Line */}
                        <circle
                          cx="80" cy="80" r="70"
                          fill="none"
                          stroke={attendanceMarkedToday ? "#10b981" : "#8b5cf6"}
                          strokeWidth="10"
                          strokeDasharray={`${2 * Math.PI * 70}`}
                          strokeDashoffset={`${2 * Math.PI * 70 * (1 - holdProgress / 100)}`}
                          strokeLinecap="round"
                          className="transition-all duration-75 ease-linear"
                          style={{ filter: isHolding ? 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))' : 'none' }}
                        />
                      </svg>
                      
                      <button
                        className={`size-32 rounded-full flex flex-col items-center justify-center gap-1 font-black transition-all select-none touch-none z-10
                          ${attendanceMarkedToday
                            ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed border-4 border-emerald-500/20'
                            : isHolding
                            ? 'bg-violet-600 text-white scale-90 shadow-[0_0_30px_rgba(139,92,246,0.6)]'
                            : 'bg-slate-800 hover:bg-slate-700 text-white shadow-xl active:scale-95 border-4 border-slate-700/50'
                          }`}
                        onMouseDown={startHold}
                        onMouseUp={cancelHold}
                        onMouseLeave={cancelHold}
                        onTouchStart={startHold}
                        onTouchEnd={cancelHold}
                        disabled={attendanceMarkedToday}
                      >
                        {attendanceMarkedToday ? (
                          <div className="flex flex-col items-center animate-in zoom-in duration-300">
                            <CheckCircle2 className="size-10 mb-1" />
                            <span className="text-[10px] uppercase tracking-tighter">Verified</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            {isHolding ? (
                              <>
                                <span className="text-2xl font-black">{Math.round(holdProgress)}%</span>
                                <span className="text-[10px] uppercase tracking-widest opacity-80">Marking...</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare className="size-10 mb-1 opacity-20" />
                                <span className="text-sm font-black uppercase tracking-widest">Hold</span>
                                <span className="text-[8px] opacity-60">10 Seconds</span>
                              </>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-6 pt-4 border-t border-white/10 w-full justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-black text-violet-400">{attendanceList.length}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Days</div>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="text-center">
                      <div className={`text-sm font-black ${attendanceMarkedToday ? 'text-emerald-400' : 'text-red-400'}`}>
                        {attendanceMarkedToday ? '✅ Present' : '❌ Absent'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Today</div>
                    </div>
                  </div>
                </Card>

                {/* Attendance History Card */}
                <Card className="p-6 border-none shadow-elegant bg-white flex flex-col">
                  <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="size-5 text-violet-600" /> Attendance History
                  </h3>
                  {attendanceList.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                      <div className="size-16 rounded-full bg-violet-50 flex items-center justify-center mb-4"><CheckSquare className="size-8 text-violet-300" /></div>
                      <p className="text-slate-500 font-medium text-sm">No attendance records yet</p>
                      <p className="text-slate-400 text-xs mt-1">Mark your first attendance using the button</p>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 max-h-[300px]">
                      <div className="space-y-2 pr-2">
                        {attendanceList.map((rec, idx) => (
                          <div key={rec.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-violet-50 hover:border-violet-100 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                <CheckCircle2 className="size-4 text-violet-600" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-800">
                                  {new Date(rec.marked_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {new Date(rec.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              </div>
                            </div>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px] font-black">Present</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </Card>
              </div>
            </div>
          )}

          {isServiceEnabled('live_classes') && (
            <div id="live-classes-section" className="mt-12">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-3"><BookOpen className="size-6 text-primary" /> Live Learning Sessions</h2>
                <div className="h-px flex-1 mx-6 bg-slate-200 hidden md:block"></div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{liveClasses.length} Scheduled</Badge>
              </div>

              {liveClasses.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {liveClasses.map(c => {
                    let embedUrl = c.url;
                    if (c.link_type === 'youtube') {
                      if (c.url.includes('watch?v=')) {
                        embedUrl = c.url.replace('watch?v=', 'embed/');
                      } else if (c.url.includes('youtu.be/')) {
                        embedUrl = c.url.replace('youtu.be/', 'youtube.com/embed/');
                      }
                    }

                    return (
                      <Card key={c.id} className="overflow-hidden border-none shadow-elegant flex flex-col group hover:-translate-y-2 transition-all duration-500 bg-white">
                        <div className="p-3 text-[10px] text-center font-black text-white uppercase tracking-[0.2em] bg-slate-900">
                          {new Date(c.scheduled_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
                        </div>
                        
                        {c.link_type === 'youtube' ? (
                          <div className="relative w-full aspect-video bg-black shadow-inner">
                            <iframe 
                              src={embedUrl} 
                              className="absolute inset-0 w-full h-full border-0" 
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            ></iframe>
                          </div>
                        ) : (
                          <div className="w-full aspect-video bg-indigo-50 flex items-center justify-center flex-col gap-3 p-6 text-center border-b border-indigo-100">
                            <div className="size-16 rounded-full bg-white flex items-center justify-center text-primary shadow-elegant group-hover:scale-110 transition-transform duration-500">
                              <ExternalLink className="size-8" />
                            </div>
                            <p className="font-bold text-sm text-indigo-900">Live Virtual Session</p>
                          </div>
                        )}
                        
                        <div className="p-6 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-wider">{c.internship_domains?.name || "General"}</span>
                            <span className="size-1 rounded-full bg-slate-300"></span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{c.link_type} Session</span>
                          </div>
                          <h3 className="font-bold text-lg leading-tight mb-6 flex-1 text-slate-900">{c.title}</h3>
                          
                          {c.link_type === 'meet' ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="w-full block">
                              <Button className="w-full h-11 bg-primary hover:bg-primary/90 gap-2 shadow-lg transition-all"><ExternalLink className="size-4" /> Join Live Meeting</Button>
                            </a>
                          ) : (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                              </span>
                              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Live Learning Session</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-16 text-center border-none shadow-elegant bg-white/80 backdrop-blur-sm">
                  <div className="size-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <BookOpen className="size-10 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">Stay Tuned for Classes</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto mt-3 leading-relaxed">There are currently no live sessions scheduled for your internship domain. We'll update this section soon!</p>
                </Card>
              )}
            </div>
          )}

        </div>
      </main>



      <Dialog open={isOfferLetterOpen} onOpenChange={setIsOfferLetterOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-2xl font-bold">Offer Letter Preview</DialogTitle>
              <DialogDescription>Review your official internship offer letter</DialogDescription>
            </div>
            <Button variant="hero" size="sm" className="gap-2" onClick={downloadPDF} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </Button>
          </DialogHeader>
          
          <ScrollArea className="max-h-[75vh] p-10 bg-slate-100">
            <OfferLetter ref={offerLetterRef} profile={offerLetterProfile} />
          </ScrollArea>
          </DialogContent>
        </Dialog>

      {/* Certificate Dialog */}
      <Dialog open={isCertOpen} onOpenChange={setIsCertOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-2xl font-bold">Internship Certificate</DialogTitle>
              <DialogDescription>Official certificate for completion of internship</DialogDescription>
            </div>
            <Button variant="hero" size="sm" className="gap-2" onClick={downloadCert} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download Certificate
            </Button>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] p-10 bg-slate-100">
            <div className="flex justify-center">
              <div 
                ref={certRef}
                className="w-full max-w-[210mm] bg-white shadow-2xl p-[12mm] md:p-[15mm] text-slate-900 font-sans leading-snug min-h-[297mm] relative overflow-hidden flex flex-col"
                style={{ height: 'auto' }}
              >
                {/* Background Watermark */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 mt-20 select-none opacity-[0.05]">
                  <div className="bg-[#5AA3E6] rounded-[3rem] w-[450px] h-[450px] flex items-center justify-center grayscale">
                    <span className="text-white font-black text-[300px] tracking-tighter leading-none">EI</span>
                  </div>
                </div>

                {/* Header */}
                <div className="-mx-[12mm] md:-mx-[15mm] -mt-[12mm] md:-mt-[15mm] mb-6 relative z-10 flex flex-col">
                  {/* Top Banner Shapes */}
                  <div className="w-full h-[14px] relative flex items-start">
                    <div className="w-full h-[7px] bg-[#0084FF] absolute top-0 left-0 z-0"></div>
                    <div className="h-[14px] w-[25%] bg-[#0084FF] absolute top-0 left-0 z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' }}></div>
                    <div className="h-[14px] w-[8%] bg-[#CDE6FE] absolute top-0 left-[22%] z-20" style={{ clipPath: 'polygon(25% 0, 100% 0, 75% 100%, 0% 100%)' }}></div>
                  </div>

                  {/* Header Content */}
                  <div className="flex justify-between items-center px-[12mm] md:px-[15mm] py-4 md:py-6">
                    {/* Left Logo */}
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="size-12 md:size-14 rounded-[10px] md:rounded-[12px] bg-[#5AA3E6] flex items-center justify-center shadow-sm">
                        <span className="text-white font-black text-2xl md:text-3xl tracking-tighter leading-none mt-0.5 md:mt-1">EI</span>
                      </div>
                      <div className="flex items-center text-[1.8rem] md:text-[2.2rem] tracking-tight leading-none mt-0.5 md:mt-1">
                        <span className="font-bold text-[#5AA3E6]">Ezy</span>
                        <span className="font-bold text-slate-900">intern</span>
                      </div>
                    </div>
                    
                    {/* Right Contact Info */}
                    <div className="flex flex-col items-end gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-medium text-slate-800">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>Arfabad Colony, East Nahar Road, Bajranngpuri, Patna - 800007</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><MapPin className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>7858967071, 9341143791</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Phone className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>infoezyintern@gmail.com</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Mail className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>www.ezyintern.com</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Globe className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Dark Blue Line */}
                  <div className="mx-[12mm] md:mx-[15mm] border-b-[1.5px] border-[#1E3A8A]"></div>
                </div>
                
                {/* Certificate Title & Text */}
                <div className="relative z-10 text-center space-y-1 mb-6">
                  <h1 className="text-2xl font-bold text-[#5AA3E6] mb-4">Certificate of Completion</h1>
                  <p className="text-[13px]">This is to certify that</p>
                  <p className="text-lg font-bold">Mr./Ms. {profile?.full_name},</p>
                  <p className="text-[13px]">S/o or D/o</p>
                  <p className="text-lg font-bold">{profile?.parent_name || profile?.father_name || "[Father's/Guardian's Name]"}</p>
                  <p className="text-[13px]">bearing University Registration/Enrolment No. <span className="font-bold">{profile?.registration_id}</span></p>
                  <p className="text-[13px]">of</p>
                  <p className="text-lg font-bold">{profile?.college_name}</p>
                  <p className="text-[13px]">Session {profile?.academic_session || "2024-25"}, with Major in <span className="font-bold">{profile?.degree}</span>,</p>
                  <p className="text-[13px]">has successfully completed his/her internship with our organisation.</p>
                </div>

                {/* Table 1 */}
                <div className="relative z-10 w-full border border-[#5AA3E6] mb-6 text-[12px]">
                  <div className="flex border-b border-[#5AA3E6]">
                    <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Internship Domain</div>
                    <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">{profile?.course}</div>
                  </div>
                   <div className="flex border-b border-[#5AA3E6]">
                     <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Internship Duration</div>
                     <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">
                       {profile?.joining_date && profile?.completion_date ? (
                         `From ${new Date(profile.joining_date).toLocaleDateString('en-GB')} to ${new Date(profile.completion_date).toLocaleDateString('en-GB')}`
                       ) : (
                         `From ${new Date(profile?.created_at || Date.now()).toLocaleDateString('en-GB')} to ${new Date(new Date(profile?.created_at || Date.now()).getTime() + 30*24*60*60*1000).toLocaleDateString('en-GB')}`
                       )}
                     </div>
                   </div>
                   <div className="flex border-b border-[#5AA3E6]">
                     <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Total Hours Completed</div>
                     <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">{profile?.internship_duration || "120 Hours"}</div>
                   </div>
                  <div className="flex border-b border-[#5AA3E6]">
                    <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Mode of Internship</div>
                    <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">Online</div>
                  </div>
                  <div className="flex border-b border-[#5AA3E6]">
                    <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Overall Attendance Percentage</div>
                    <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">100%</div>
                  </div>
                  <div className="flex">
                    <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">Overall Marks Percentage</div>
                    <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">100%</div>
                  </div>
                </div>

                {/* Table 2 */}
                <div className="relative z-10 w-full mb-8">
                  <h3 className="text-[13px] font-bold text-[#5AA3E6] mb-1">Internship Performance Assessment</h3>
                  <div className="border border-[#5AA3E6] text-[12px]">
                    <div className="flex bg-[#5AA3E6] text-white font-bold">
                      <div className="w-[70%] p-2 border-r border-[#5AA3E6] text-center">Assessment Criteria</div>
                      <div className="w-[30%] p-2 text-center">Rating</div>
                    </div>
                    <div className="flex bg-white/60">
                      <div className="w-[70%] p-3 border-r border-[#5AA3E6] text-center leading-snug">
                        Technical Knowledge & Application, Quality of Work & Task Completion, Initiative & Problem-Solving Ability, Communication & Interpersonal Skills, Punctuality, Discipline & Professional Conduct
                      </div>
                      <div className="w-[30%] p-3 flex flex-col items-center justify-center text-center text-[11px]">
                        <span className="font-bold">Outstanding</span> / Good / Satisfactory / Needs Improvement
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div className="-mx-[12mm] md:-mx-[15mm] -mb-[12mm] md:-mb-[15mm] relative z-10 mt-auto">
                  <div className="relative">
                    <img src="/cert-footer.png" alt="Certificate Footer" className="w-full h-auto block" onError={(e) => {
                      (e.target as HTMLImageElement).src = '/offer-letter-footer.png';
                    }} />
                    
                    {/* Verification Details Overlay - positioned on right side where empty space is */}
                    <div className="absolute bottom-40 right-6 md:right-8 flex items-center gap-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-[#5AA3E6]/20 shadow-sm z-20">
                      {/* QR Code */}
                      <div className="relative size-[68px] shrink-0 border border-slate-200 p-1 bg-white rounded-lg">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.ezyintern.com/certificate-verification/${cert?.certificate_id || 'EZY-DEMO-1001'}`} alt="QR Code" className="w-full h-full" crossOrigin="anonymous" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-[#5AA3E6] text-white font-black text-[9px] px-1 py-0.5 rounded-sm shadow-sm leading-none">EI</div>
                        </div>
                      </div>
                      
                      {/* Text Info */}
                      <div className="text-[11px] leading-snug space-y-1">
                        <p className="text-slate-800 flex items-center">
                          <span className="font-bold w-24">Reference No.</span> 
                          <span className="font-black mx-1">:</span>
                          <span className="text-[#5AA3E6] font-black tracking-wide">{profile?.registration_id || `EZY/${new Date().getFullYear()}/INT/PENDING`}</span>
                        </p>
                        <p className="text-slate-800 flex items-center">
                          <span className="font-bold w-24">Certificate ID</span> 
                          <span className="font-black mx-1">:</span>
                          <span className="text-[#5AA3E6] font-black tracking-wide">{profile?.registration_id || `EZY/${new Date().getFullYear()}/INT/PENDING`}</span>
                        </p>
                        <p className="text-slate-800 flex items-center">
                          <span className="font-bold w-24">Date of Issue</span> 
                          <span className="font-black mx-1">:</span>
                          <span className="text-[#5AA3E6] font-black">{new Date().toLocaleDateString('en-GB')}</span>
                        </p>
                        <div className="pt-1 mt-1 border-t border-slate-200">
                          <p className="text-[9px] text-slate-600 font-bold mb-0.5">To verify this certificate, go to our site:</p>
                          <p className="text-[10px] text-[#5AA3E6] font-black tracking-wide">www.ezyintern.com/certificate-verification</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Payment Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden shadow-2xl border-none">
          <DialogHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-2xl font-bold">Payment Receipt</DialogTitle>
              <DialogDescription>Official receipt for your enrollment payment</DialogDescription>
            </div>
            <Button variant="hero" size="sm" className="gap-2" onClick={downloadReceipt} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </Button>
          </DialogHeader>
          
          <ScrollArea className="max-h-[75vh] p-10 bg-slate-100">
            <div className="flex justify-center">
              <div 
                ref={receiptRef}
                className="w-full max-w-[210mm] bg-white shadow-2xl p-[12mm] md:p-[15mm] text-slate-900 font-sans leading-snug min-h-[297mm] flex flex-col relative overflow-hidden"
                style={{ height: 'auto' }}
              >
                {/* Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 mt-32 select-none">
                  <img src="/logo.png" alt="Watermark" className="w-[85%] max-w-[500px] h-auto object-contain opacity-[0.15] grayscale" crossOrigin="anonymous" />
                </div>

                {/* Custom Header from Certificate */}
                <div className="-mx-[12mm] md:-mx-[15mm] -mt-[12mm] md:-mt-[15mm] mb-8 relative z-10 flex flex-col">
                  {/* Top Banner Shapes */}
                  <div className="w-full h-[14px] relative flex items-start">
                    <div className="w-full h-[7px] bg-[#0084FF] absolute top-0 left-0 z-0"></div>
                    <div className="h-[14px] w-[25%] bg-[#0084FF] absolute top-0 left-0 z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' }}></div>
                    <div className="h-[14px] w-[8%] bg-[#CDE6FE] absolute top-0 left-[22%] z-20" style={{ clipPath: 'polygon(25% 0, 100% 0, 75% 100%, 0% 100%)' }}></div>
                  </div>

                  {/* Header Content */}
                  <div className="flex justify-between items-center px-[12mm] md:px-[15mm] py-4 md:py-6">
                    {/* Left Logo */}
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="size-12 md:size-14 rounded-[10px] md:rounded-[12px] bg-[#5AA3E6] flex items-center justify-center shadow-sm">
                        <span className="text-white font-black text-2xl md:text-3xl tracking-tighter leading-none mt-0.5 md:mt-1">EI</span>
                      </div>
                      <div className="flex items-center text-[1.8rem] md:text-[2.2rem] tracking-tight leading-none mt-0.5 md:mt-1">
                        <span className="font-bold text-[#5AA3E6]">Ezy</span>
                        <span className="font-bold text-slate-900">intern</span>
                      </div>
                    </div>
                    
                    {/* Right Contact Info */}
                    <div className="flex flex-col items-end gap-1 md:gap-1.5 text-[9px] md:text-[11px] font-medium text-slate-800">
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>Arfabad Colony, East Nahar Road, Bajranngpuri, Patna - 800007</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><MapPin className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>7858967071, 9341143791</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Phone className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>infoezyintern@gmail.com</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Mail className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span>www.ezyintern.com</span>
                        <div className="bg-[#0084FF] text-white rounded-full p-[2px] md:p-[2.5px]"><Globe className="size-[8px] md:size-[10px]" strokeWidth={3} /></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom Dark Blue Line */}
                  <div className="mx-[12mm] md:mx-[15mm] border-b-[1.5px] border-[#1E3A8A]"></div>
                </div>

                {/* Receipt Content */}
                <div className="relative z-10 flex-1 text-slate-800">
                  <div className="text-center mb-10">
                    <h1 className="text-3xl font-black tracking-tight text-[#1E3A8A] uppercase mb-2">Payment Receipt</h1>
                    <p className="text-slate-500 font-medium">Thank you for your payment</p>
                  </div>

                  <div className="flex justify-between items-start mb-10 pb-8 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Billed To</h3>
                      <p className="font-bold text-xl text-slate-900 mb-1">{profile?.full_name}</p>
                      <p className="text-slate-600">{profile?.email}</p>
                      <p className="text-slate-600">{profile?.phone_number}</p>
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Receipt Details</h3>
                      <p className="text-slate-700 mb-1"><span className="font-semibold w-24 inline-block text-left">Receipt No:</span> <span className="font-mono font-bold text-slate-900">{payment?.payment_id}</span></p>
                      <p className="text-slate-700 mb-1"><span className="font-semibold w-24 inline-block text-left">Date:</span> <span className="font-medium text-slate-900">{new Date(payment?.created_at || new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                      <p className="text-slate-700"><span className="font-semibold w-24 inline-block text-left">Status:</span> <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-sm">PAID</span></p>
                    </div>
                  </div>

                  <div className="mb-10">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b-2 border-slate-800">
                          <th className="py-3 font-bold text-slate-900 uppercase tracking-wider text-sm">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-5">
                            <p className="font-bold text-slate-800 text-lg">Internship Program Enrollment</p>
                            <p className="text-slate-500 text-sm mt-1">{profile?.internship_domain || "General"} Domain</p>
                            {profile?.registration_id && (
                              <p className="text-slate-500 text-sm mt-0.5">Reg ID: {profile?.registration_id}</p>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-center text-sm text-slate-600 mt-6">
                      Payment status:{" "}
                      <span className="text-green-600 font-bold">Completed</span>
                    </p>
                  </div>

                  <div className="mt-20 pt-8 border-t border-slate-200 text-center">
                    <p className="text-sm font-bold text-slate-900 mb-1">EzyIntern Educational Services</p>
                    <p className="text-xs text-slate-500">This is a computer-generated receipt and does not require a physical signature.</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignmentsOpen} onOpenChange={setIsAssignmentsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><FileText className="size-6 text-primary" /> My Assignments</DialogTitle>
            <DialogDescription>View and complete your scheduled assignments. Note: These are strictly proctored.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4 mt-4">
            <div className="space-y-4">
              {assignmentsList.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No assignments are currently available.</div>
              ) : (
                assignmentsList.map((a) => (
                  <Card key={a.id} className="p-5 border-none shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-lg">{a.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{a.description || 'Complete this assessment within the given time.'}</p>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {a.duration_minutes} Mins</span>
                        <span className="size-1 rounded-full bg-slate-300"></span>
                        <span className="flex items-center gap-1"><Award className="size-3" /> {a.total_marks} Marks</span>
                      </div>
                    </div>
                    <div>
                      {a.submission ? (
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/assignment/${a.id}/result`)}>
                          View Result
                        </Button>
                      ) : (
                        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90 gap-2" onClick={() => navigate(`/assignment/${a.id}`)}>
                          Start Test
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-muted/30 border-b">
            <DialogTitle className="text-2xl font-bold">Edit Profile Details</DialogTitle>
            <DialogDescription>Update your personal and emergency contact information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile}>
            <div className="max-h-[75vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200">
              <div className="space-y-8">
              {/* Personal Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <User className="size-3" /> Personal Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Email Address (Read-only)</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-100 text-slate-500 cursor-not-allowed outline-none transition-all"
                      value={profile?.email || ""}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Full Name</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.full_name || ""}
                      onChange={e => setEditProfileData({...editProfileData, full_name: e.target.value})}
                      placeholder="Your Full Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contact Number</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.contact_number || ""}
                      onChange={e => setEditProfileData({...editProfileData, contact_number: e.target.value})}
                      placeholder="Your Phone Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gender</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.gender || ""}
                      onChange={e => setEditProfileData({...editProfileData, gender: e.target.value})}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Parent / Guardian Name</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.parent_name || ""}
                      onChange={e => setEditProfileData({...editProfileData, parent_name: e.target.value})}
                      placeholder="Father's or Mother's Name"
                    />
                  </div>
                </div>
              </div>

              {/* Academic Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <GraduationCap className="size-3" /> Academic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">University</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.university_name || ""}
                      onChange={e => setEditProfileData({...editProfileData, university_name: e.target.value, college_name: ""})}
                    >
                      <option value="">Select University</option>
                      {unis.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">College</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.college_name || ""}
                      onChange={e => setEditProfileData({...editProfileData, college_name: e.target.value})}
                      disabled={!editProfileData.university_name}
                    >
                      <option value="">Select College</option>
                      {colleges.filter(c => !editProfileData.university_name || c.university_id === unis.find(u => u.name === editProfileData.university_name)?.id).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Degree</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.degree || ""}
                      onChange={e => setEditProfileData({...editProfileData, degree: e.target.value})}
                    >
                      <option value="">Select Degree</option>
                      <option value="UG">UG</option>
                      <option value="PG">PG</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Department</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.department || ""}
                      onChange={e => setEditProfileData({...editProfileData, department: e.target.value})}
                    >
                      <option value="">Select Department</option>
                      <option value="B.A.">B.A.</option>
                      <option value="B.Sc">B.Sc</option>
                      <option value="B.Com">B.Com</option>
                      <option value="M.A.">M.A.</option>
                      <option value="M.Sc">M.Sc</option>
                      <option value="M.Com">M.Com</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Major / Subject</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.subject || ""}
                      onChange={e => setEditProfileData({...editProfileData, subject: e.target.value})}
                      placeholder="e.g. Physics, History"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Academic Session</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.academic_session || ""}
                      onChange={e => setEditProfileData({...editProfileData, academic_session: e.target.value})}
                    >
                      <option value="">Select Session</option>
                      <option value="2023-2027">2023-2027</option>
                      <option value="2024-2028">2024-2028</option>
                      <option value="2025-2029">2025-2029</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Semester</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.class_semester || ""}
                      onChange={e => setEditProfileData({...editProfileData, class_semester: e.target.value})}
                    >
                      <option value="">Select Semester</option>
                      {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`Semester ${s}`}>Semester {s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Registration number</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.roll_number || ""}
                      onChange={e => setEditProfileData({...editProfileData, roll_number: e.target.value})}
                      placeholder="Registration number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Internship domain</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.internship_domain || ""}
                      onChange={e => setEditProfileData({...editProfileData, internship_domain: e.target.value, course: e.target.value })}
                    >
                      <option value="">Select Domain</option>
                      {domains.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Internship mode</label>
                    <select 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.internship_mode || "Online"}
                      onChange={e => setEditProfileData({...editProfileData, internship_mode: e.target.value})}
                    >
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Internship duration</label>
                    <input 
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.internship_duration || ""}
                      onChange={e => setEditProfileData({...editProfileData, internship_duration: e.target.value})}
                      placeholder="e.g. 120 Hours"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Internship start date</label>
                    <input 
                      type="date"
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.joining_date || ""}
                      onChange={e => setEditProfileData({...editProfileData, joining_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Expected completion date</label>
                    <input 
                      type="date"
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.completion_date || ""}
                      onChange={e => setEditProfileData({...editProfileData, completion_date: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Phone className="size-4 text-primary" />
                  <h4 className="font-bold text-sm">Emergency contact (optional)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contact Name</label>
                    <input
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.emergency_name || ""}
                      onChange={e => setEditProfileData({...editProfileData, emergency_name: e.target.value})}
                      placeholder="Emergency Contact Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contact Phone</label>
                    <input
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.emergency_contact || ""}
                      onChange={e => setEditProfileData({...editProfileData, emergency_contact: e.target.value})}
                      placeholder="Emergency Phone Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Relationship</label>
                    <input
                      className="w-full p-3 rounded-xl border bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={editProfileData.emergency_relation || ""}
                      onChange={e => setEditProfileData({...editProfileData, emergency_relation: e.target.value})}
                      placeholder="e.g. Father, Brother"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button type="submit" className="gap-2 shadow-glow" disabled={isUpdatingProfile}>
              {isUpdatingProfile ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  );
};

export default Dashboard;
