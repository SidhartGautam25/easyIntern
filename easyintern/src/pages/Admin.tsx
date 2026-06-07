import { useEffect, useMemo, useState } from "react";
import { createClient } from '@supabase/supabase-js';
import { useNavigate, useLocation } from "react-router-dom";
import Papa from "papaparse";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Award, Users, Building2, Edit, Eye, MoreHorizontal, Shield, Mail, Phone, User, BookOpen, Heart, LogIn, Ban, CheckCircle2, Download, Briefcase, UserPlus, Filter, Search, Calendar, ToggleLeft, ToggleRight, DollarSign, GraduationCap, Bell, FileText, Clock, Activity, TrendingUp, CheckSquare, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, LineChart, Line
} from 'recharts';
import AIAssignmentBuilder from "@/components/AIAssignmentBuilder";
import { ChangePinModal } from "@/components/ChangePinModal";
import { Sparkles, KeyRound, Store, Share2, FileSpreadsheet, IndianRupee, Settings } from "lucide-react";
import { sendCertificateEmail } from "@/lib/email";
import { OfferLetter } from "@/components/OfferLetter";
import { downloadOfferLetterPdf, OFFER_LETTER_CAPTURE_WIDTH_PX } from "@/lib/offerLetterPdf";
import { normalizeOfferLetterProfile } from "@/lib/offerLetterProfile";
import { RegistrationForm } from "@/components/RegistrationForm";
import { useRef } from "react";
import { ADMIN_LOGIN_PATH, buildCollegeLoginLink, buildStudentCredentialLoginLink } from "@/lib/authRoutes";
import { mergeRegistrationMetadataFromStudentRow } from "@/lib/studentSync";
import {
  EDIT_GENDER_SENTINEL,
  fetchLatestStudentCredentialRow,
  generateTempPassword,
  getStudentDirectoryPassword,
} from "@/lib/studentCredentials";
import {
  createCollegeAdminWithoutServiceRole,
  createSubUserWithoutServiceRole,
  generateCollegeAdminCode,
  updateCollegeAdminAssignments,
} from "@/lib/createSubUser";
import { CollegeAdminCollegePicker } from "@/components/admin/CollegeAdminCollegePicker";
import { displayCollegeName } from "@/lib/collegeDisplay";
import { adminUpsertStudentProfile } from "@/lib/adminProfileUpsert";
import { assertSendMailOk, getSendMailApiUrl } from "@/lib/sendMailApi";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { buildLeadHuntRows } from "@/lib/leadHunt";
import { StudentEditFormFields } from "@/components/StudentEditFormFields";
import { ReferralsPanel } from "@/components/admin/ReferralsPanel";
import { CollegeRostersPanel } from "@/components/admin/CollegeRostersPanel";
import { FeesManagementPanel } from "@/components/admin/FeesManagementPanel";

/** Cyber partner eKYC is not used for admin decisions — never show “KYC” in admin labels. */
function formatCyberCafeStatusLabel(status: string | undefined | null): string {
  if (!status) return "—";
  if (status === "pending_kyc") return "Pending approval";
  return status.replace(/_/g, " ");
}

function cyberCafeRowForEdit(cafe: any) {
  return {
    ...cafe,
    status: cafe?.status === "pending_kyc" ? "pending_approval" : cafe?.status,
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [activeTab, setActiveTab] = useState(queryParams.get("tab") || "dashboard");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Data
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [collegeAdmins, setCollegeAdmins] = useState<any[]>([]);
  const [unis, setUnis] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [certs, setCerts] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [failedPayments, setFailedPayments] = useState<any[]>([]);
  const [cancelledPayments, setCancelledPayments] = useState<any[]>([]);
  const [visitorCount, setVisitorCount] = useState(0);
  const [uniqueVisitorCount, setUniqueVisitorCount] = useState(0);
  const [systemSettings, setSystemSettings] = useState<any[]>([]);
  const [myPermissions, setMyPermissions] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [cyberCafes, setCyberCafes] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAIBuilderOpen, setIsAIBuilderOpen] = useState(false);

  // Password Reset States
  const [isResetPassOpen, setIsResetPassOpen] = useState(false);
  const [resetPassUser, setResetPassUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");

  // Offer Letter States for Cyber Cafe
  const [offerEmail, setOfferEmail] = useState("");
  const [offerStudent, setOfferStudent] = useState<any>(null);
  const offerLetterRef = useRef<HTMLDivElement>(null);

  // Notification States
  const [newNoticeTitle, setNewNoticeTitle] = useState("");
  const [newNoticeMessage, setNewNoticeMessage] = useState("");
  const [newNoticeTarget, setNewNoticeTarget] = useState("all");
  const [newNoticeTargetUserId, setNewNoticeTargetUserId] = useState("");

  // Selection & Filters
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [uniFilter, setUniFilter] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [payStartDate, setPayStartDate] = useState("");
  const [payEndDate, setPayEndDate] = useState("");
  const [payCollegeFilter, setPayCollegeFilter] = useState("all");
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  const [leadsPage, setLeadsPage] = useState(0);

  // Pagination
  const [studentPage, setStudentPage] = useState(0);
  const [studentTotalCount, setStudentTotalCount] = useState(0);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const pageSize = 20;
  const leadsPageSize = 20;
  const payPageSize = 20;

  // Dialog States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  // Form States
  const [staffEmail, setStaffEmail] = useState("");
  const [certProgram, setCertProgram] = useState("");
  const [certDuration, setCertDuration] = useState("3 Months");

  // CRUD States
  const [newUni, setNewUni] = useState("");
  const [collegeUni, setCollegeUni] = useState("");
  const [newCollege, setNewCollege] = useState("");
  const [newDomain, setNewDomain] = useState("");

  // Class Scheduler States
  const [newClassTitle, setNewClassTitle] = useState("");
  const [newClassType, setNewClassType] = useState("youtube");
  const [newClassUrl, setNewClassUrl] = useState("");
  const [newClassSchedule, setNewClassSchedule] = useState("");
  const [newClassDomain, setNewClassDomain] = useState("all");

  // Bulk Email States
  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [commRecipientType, setCommRecipientType] = useState<"enrolled" | "unenrolled">("enrolled");
  const [bulkCertSearchTerm, setBulkCertSearchTerm] = useState("");
  const [allStudentsComms, setAllStudentsComms] = useState<any[]>([]);
  const [allLeadsComms, setAllLeadsComms] = useState<any[]>([]);

  // Attendance States
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [attendanceCriteria, setAttendanceCriteria] = useState(75);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState("");
  const [paySearchTerm, setPaySearchTerm] = useState("");
  const [payPage, setPayPage] = useState(0);
  const [oldLeadsSearchTerm, setOldLeadsSearchTerm] = useState("");
  const [selectedAttendanceStudent, setSelectedAttendanceStudent] = useState<any>(null);
  const [studentAttendanceHistory, setStudentAttendanceHistory] = useState<any[]>([]);
  const [isAttHistoryOpen, setIsAttHistoryOpen] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [isServiceAccessOpen, setIsServiceAccessOpen] = useState(false);

  // New Sub-User States
  const [newSubUserEmail, setNewSubUserEmail] = useState("");
  const [newSubUserPassword, setNewSubUserPassword] = useState("");
  const [newSubUserRoleTag, setNewSubUserRoleTag] = useState("");
  const [newSubUserRole, setNewSubUserRole] = useState<"admin" | "staff">("staff");
  const [newSubUserPermissions, setNewSubUserPermissions] = useState({
    can_manage_students: true,
    can_manage_classes: true,
    can_manage_certificates: true,
    can_manage_institutions: true,
    can_view_payments: true,
    can_manage_leads: true,
    can_manage_notifications: true,
    can_manage_assignments: true,
    can_manage_communications: true
  });

  const [newCollegeAdminEmail, setNewCollegeAdminEmail] = useState("");
  const [newCollegeAdminName, setNewCollegeAdminName] = useState("");
  const [newCollegeAdminUniId, setNewCollegeAdminUniId] = useState("");
  const [newCollegeAdminCollegeIds, setNewCollegeAdminCollegeIds] = useState<string[]>([]);
  /** College Admin ID = initial Supabase password; generate before create or type your own (min 6 chars). */
  const [newCollegeAdminCode, setNewCollegeAdminCode] = useState("");
  const [isEditCollegeAdminOpen, setIsEditCollegeAdminOpen] = useState(false);
  const [editingCollegeAdmin, setEditingCollegeAdmin] = useState<any | null>(null);
  const [editCollegeAdminName, setEditCollegeAdminName] = useState("");
  const [editCollegeAdminEmail, setEditCollegeAdminEmail] = useState("");
  const [editCollegeAdminUniId, setEditCollegeAdminUniId] = useState("");
  const [editCollegeAdminCollegeIds, setEditCollegeAdminCollegeIds] = useState<string[]>([]);
  const [editCollegeAdminCode, setEditCollegeAdminCode] = useState("");
  const [viewCollegeAdminRow, setViewCollegeAdminRow] = useState<any | null>(null);

  // Manage Permissions States
  const [isManagePermissionsOpen, setIsManagePermissionsOpen] = useState(false);
  const [selectedStaffMember, setSelectedStaffMember] = useState<any>(null);
  const [staffPermissions, setStaffPermissions] = useState<any>({});

  // Bulk Attendance States
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<string[]>([]);
  const [attendanceIncreasePercent, setAttendanceIncreasePercent] = useState<number>(0);

  // Cyber Cafe View States
  const [isCafeViewOpen, setIsCafeViewOpen] = useState(false);
  const [selectedCafe, setSelectedCafe] = useState<any>(null);
  const [isEditingCafe, setIsEditingCafe] = useState(false);
  const [editCafeData, setEditCafeData] = useState<any>(null);
  const [cafeStartDate, setCafeStartDate] = useState("");
  const [cafeEndDate, setCafeEndDate] = useState("");
  const [cafeViewStudents, setCafeViewStudents] = useState<any[]>([]);
  const [cafeStudentsLoading, setCafeStudentsLoading] = useState(false);

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [addStudentFormKey, setAddStudentFormKey] = useState(0);
  const [registrationDraftLeads, setRegistrationDraftLeads] = useState<any[]>([]);

  // Dashboard Visual Logic
  const getRevenueData = () => {
    const daily: any = {};
    payments.forEach(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      daily[date] = (daily[date] || 0) + (p.amount_paise / 100);
    });
    return Object.entries(daily).map(([date, amount]) => ({ date, amount })).slice(-7);
  };

  const totalRevenue = payments.reduce((acc, curr) => acc + (curr.amount_paise / 100), 0);
  const prevRevenue = totalRevenue * 0.9; // Mocking comparison

  const [dashStartDate, setDashStartDate] = useState("");
  const [dashEndDate, setDashEndDate] = useState("");
  const [livePulse, setLivePulse] = useState<{name: string, value: number}[]>(
    Array.from({length: 12}, (_, i) => ({name: i.toString(), value: 40 + Math.random() * 20}))
  );
  const [liveTraffic, setLiveTraffic] = useState(86);
  const [monitoringStatus, setMonitoringStatus] = useState("SCANNING...");

  useEffect(() => {
    const interval = setInterval(() => {
      setLivePulse(prev => {
        const newVal = 35 + Math.random() * 35;
        return [...prev.slice(1), {name: Date.now().toString(), value: newVal}];
      });
      setLiveTraffic(prev => prev + (Math.random() > 0.5 ? 1 : -1));
      
      const statuses = ["MONITORING...", "NODE ACTIVE", "TRAFFIC STABLE", "SYSTEM OPTIMIZED"];
      setMonitoringStatus(statuses[Math.floor(Math.random() * statuses.length)]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const getFilteredRevenueData = () => {
    let filtered = payments;
    if (dashStartDate) filtered = filtered.filter(p => p.created_at >= `${dashStartDate}T00:00:00`);
    if (dashEndDate) filtered = filtered.filter(p => p.created_at <= `${dashEndDate}T23:59:59`);
    
    const daily: any = {};
    filtered.forEach(p => {
      const date = new Date(p.created_at).toLocaleDateString();
      daily[date] = (daily[date] || 0) + (p.amount_paise / 100);
    });
    return Object.entries(daily).map(([date, amount]) => ({ date, amount }));
  };

  const getDashboardStats = () => {
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    
    const todayRevenue = payments.filter(p => new Date(p.created_at).toLocaleDateString() === today)
      .reduce((acc, curr) => acc + (curr.amount_paise / 100), 0);
    const yesterdayRevenue = payments.filter(p => new Date(p.created_at).toLocaleDateString() === yesterday)
      .reduce((acc, curr) => acc + (curr.amount_paise / 100), 0);
    
    const todayEnrolledCount = payments.filter(p => new Date(p.created_at).toLocaleDateString() === today).length;
    const todayLeadsCount = cancelledPayments.filter(p => new Date(p.created_at).toLocaleDateString() === today).length;
    
    const growth = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100);

    return { todayRevenue, yesterdayRevenue, growth, todayEnrolledCount, todayLeadsCount, today };
  };

  const stats = getDashboardStats();

  const logAdminAction = async (action_type: string, entity_type: string, description: string, metadata: any = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from("admin_logs").insert({
        user_id: session.user.id,
        admin_email: session.user.email,
        action_type,
        entity_type,
        description,
        metadata,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Log Action Error:", err);
    }
  };

  const handleResendCredentials = async (student: any) => {
    if (
      !confirm(
        `Resend login details to ${student.full_name}? The email uses the password stored in the student directory (registration / last admin reset / student's saved login password). Continue?`
      )
    )
      return;
    setProcessing(true);
    try {
      const latestData = await fetchLatestStudentCredentialRow(supabase, student.id);
      if (!latestData) throw new Error("Student record not found.");

      let finalPassword = getStudentDirectoryPassword(latestData);
      const finalRegId = latestData.registration_id || student.registration_id;

      if (!finalPassword) {
        const ok = confirm(
          "No password is stored for this student (common when they registered without saving one in the directory).\n\nGenerate a new temporary password, update their login, save it to the directory, and email it?"
        );
        if (!ok) {
          toast.message("Use Reset Password from the menu when you want to set one manually.");
          return;
        }
        finalPassword = generateTempPassword();
        const { error: rpcErr } = await supabase.rpc("admin_reset_user_password", {
          target_user_id: student.id,
          new_pass: finalPassword,
        });
        if (rpcErr) throw rpcErr;
        const prevMeta =
          typeof latestData.metadata === "object" && latestData.metadata !== null
            ? latestData.metadata
            : {};
        const mergedMeta = { ...prevMeta, password: finalPassword };
        const { error: saveErr } = await supabase
          .from("students")
          .update({ password: finalPassword, metadata: mergedMeta })
          .eq("id", student.id);
        if (saveErr) throw saveErr;
        toast.success("Temporary password generated and saved.");
      }

      const toEmail = String(latestData.email || student.email || "").trim();
      if (!toEmail) throw new Error("Student has no email address — update their profile first.");

      const res = await fetch(getSendMailApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          email: toEmail,
          action: 'registration_success',
          data: {
            fullName: latestData.full_name || student.full_name,
            regId: finalRegId || "",
            password: finalPassword,
            loginLink: buildStudentCredentialLoginLink(window.location.origin),
          }
        })
      });
      await assertSendMailOk(res);
      toast.success("Credentials sent successfully!");
      await logAdminAction('RESEND_CREDENTIALS', 'student', `Resent login credentials to ${student.full_name}`, { student_id: student.id });
      await fetchStudents();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassUser || !newPassword) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: resetPassUser.id,
        new_pass: newPassword,
      });
      if (error) throw error;

      const { data: prevRow } = await supabase
        .from("students")
        .select("metadata")
        .eq("id", resetPassUser.id)
        .maybeSingle();
      const prevMeta =
        typeof prevRow?.metadata === "object" && prevRow.metadata !== null ? prevRow.metadata : {};
      const mergedMeta = { ...prevMeta, password: newPassword };

      const { error: updateError } = await supabase
        .from("students")
        .update({ password: newPassword, metadata: mergedMeta })
        .eq("id", resetPassUser.id);
      if (updateError) throw updateError;

      const resetEmail = String(resetPassUser.email || "").trim();
      if (resetEmail) {
        try {
          const emailRes = await fetch(getSendMailApiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: resetEmail,
              email: resetEmail,
              action: 'admin_password_reset',
              data: {
                fullName: resetPassUser.full_name,
                password: newPassword,
                loginLink: buildStudentCredentialLoginLink(window.location.origin),
              }
            })
          });
          await assertSendMailOk(emailRes);
        } catch (mailErr: unknown) {
          const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
          toast.warning(`Password updated, but email failed: ${msg}`);
        }
      }

      toast.success("Password reset successfully!");
      await logAdminAction('RESET_PASSWORD', 'student', `Manually reset password for ${resetPassUser.full_name}`, { student_id: resetPassUser.id });
      setIsResetPassOpen(false);
      setNewPassword("");
      await fetchStudents();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPaymentStudent = async (email: string) => {
    setProcessing(true);
    try {
      // First check local state
      let student = students.find(s => s.email === email);
      
      if (!student) {
        // Fetch from DB if not in local paginated state
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        
        if (error) throw error;
        student = data;
      }
      
      if (student) {
        setSelectedUser(student);
        setIsViewDialogOpen(true);
      } else {
        toast.error("Student record not found in database.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNotification = async () => {
    if (!newNoticeTitle.trim() || !newNoticeMessage.trim()) return toast.error("Please fill title and message");
    if (newNoticeTarget === "specific" && !newNoticeTargetUserId.trim()) return toast.error("Please provide a student ID");
    
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let target_uid = null;
      if (newNoticeTarget === "specific") {
        const { data: studentCheck } = await supabase.from("students").select("id").or(`registration_id.eq.${newNoticeTargetUserId},id.eq.${newNoticeTargetUserId}`).maybeSingle();
        if (!studentCheck) {
          setProcessing(false);
          return toast.error("Student not found with this ID or Registration ID");
        }
        target_uid = studentCheck.id;
      }

      const { error } = await supabase.from("notifications").insert({
        title: newNoticeTitle,
        message: newNoticeMessage,
        target_type: newNoticeTarget,
        target_user_id: target_uid,
        created_by: session?.user.id
      });

      if (error) throw error;

      toast.success("Notification sent successfully!");
      setNewNoticeTitle("");
      setNewNoticeMessage("");
      setNewNoticeTargetUserId("");
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData) return;
    setProcessing(true);
    try {
      const mergedMeta = mergeRegistrationMetadataFromStudentRow(editData);
      const courseVal =
        (editData.internship_domain || editData.course || "") as string;
      const emailNorm = String(editData.email || "").trim().toLowerCase();
      if (!emailNorm) {
        toast.error("Student email is required.");
        return;
      }

      const dirPw =
        typeof mergedMeta.password === "string" && mergedMeta.password.trim()
          ? mergedMeta.password.trim()
          : "";

      const { data: updatedStudent, error } = await supabase.from("students").update({
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
      }).eq("id", editData.id).select("id").maybeSingle();

      if (error) throw error;
      if (!updatedStudent?.id) {
        throw new Error(
          "Student row was not updated (0 rows). Your role may lack UPDATE on students, or RLS is blocking — apply fix_staff_rls.sql / admin policies."
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

      await logAdminAction('UPDATE', 'student', `Updated student details: ${editData.full_name} (Admin)`, { student_id: editData.id });
      
      toast.success("Student updated successfully!");
      setIsEditDialogOpen(false);
      // loadAll() does not refresh paginated `students`; fetchStudents() drives the directory + View Details row snapshots.
      await Promise.all([loadAll(), fetchStudents()]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const fetchStudents = async () => {
    setIsStudentsLoading(true);
    try {
      let query = supabase
        .from("students")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      if (domainFilter !== "all") {
        query = query.eq("internship_domain", domainFilter);
      }
      if (uniFilter !== "all") {
        query = query.eq("university_name", uniFilter);
      }
      if (collegeFilter !== "all") {
        query = query.eq("college_name", collegeFilter);
      }
      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
      }
      if (dateFilter && !startDate && !endDate) {
        query = query.gte("created_at", `${dateFilter}T00:00:00`).lte("created_at", `${dateFilter}T23:59:59`);
      }

      const from = studentPage * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query.range(from, to);
      
      if (error) throw error;

      // Filter out super admins
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      const superAdminIds = (roles || []).map(r => r.user_id);
      
      setStudents((data || []).filter(student => !superAdminIds.includes(student.id)));
      setStudentTotalCount(count || 0);
    } catch (err) {
      console.error("Fetch Students Error:", err);
      toast.error("Failed to load students");
    } finally {
      setIsStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (!isCafeViewOpen || !selectedCafe?.id) {
      setCafeViewStudents([]);
      setCafeStudentsLoading(false);
      return;
    }
    let cancelled = false;
    setCafeStudentsLoading(true);
    const email = String(selectedCafe.email || "").trim();
    const shop = String(selectedCafe.shop_name || "").trim();
    void (async () => {
      try {
        const [r1, r2] = await Promise.all([
          email
            ? supabase.from("students").select("*").eq("cybercafe_email", email)
            : Promise.resolve({ data: [] as any[] }),
          shop
            ? supabase.from("students").select("*").eq("cybercafe_shop_name", shop)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        if (cancelled) return;
        const map = new Map<string, any>();
        [...(r1.data || []), ...(r2.data || [])].forEach((s) => map.set(s.id, s));
        setCafeViewStudents([...map.values()]);
      } finally {
        if (!cancelled) setCafeStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCafeViewOpen, selectedCafe?.id]);

  const loadAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);

      // Helper to execute queries safely without throwing on error
      const safeQuery = async (query: Promise<any>, tableName: string) => {
        try {
          const res = await query;
          if (res.error) {
            console.error(`Error loading table ${tableName}:`, res.error);
            toast.error(`Database error loading ${tableName}: ${res.error.message}`);
            return { data: [], error: res.error };
          }
          return res;
        } catch (err: any) {
          console.error(`Exception loading table ${tableName}:`, err);
          toast.error(`Error loading ${tableName}: ${err.message || String(err)}`);
          return { data: [], error: err };
        }
      };

      // Fetch only admin/super_admin roles and their profiles
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) {
        console.error("Roles error:", rolesError);
        toast.error("Failed to load user roles: " + rolesError.message);
      }

      const staffUserIds = (adminRoles || [])
        .filter(r => r.role === 'admin' || r.role === 'super_admin')
        .map(r => r.user_id);

      // Guard: if no staffUserIds, skip profiles fetch to avoid Supabase error
      const profilesQuery = staffUserIds.length > 0
        ? supabase.from("profiles").select("*").in("id", staffUserIds)
        : supabase.from("profiles").select("*").limit(0);

      let pcRows: any[] = [];
      let regDraftRows: any[] = [];
      let paymentSuccessRows: any[] = [];

      try {
        pcRows = await fetchAllSupabaseRows(supabase, "payment_cancelled", {
          orderBy: "created_at",
          ascending: false,
        });
      } catch (err: any) {
        console.error("Error fetching payment_cancelled:", err);
        toast.error("Failed to load cancelled payments: " + (err.message || String(err)));
      }

      try {
        regDraftRows = await fetchAllSupabaseRows(supabase, "registration_leads", {
          orderBy: "updated_at",
          ascending: false,
        });
      } catch (err: any) {
        console.error("Error fetching registration_leads:", err);
        toast.error("Failed to load registration leads: " + (err.message || String(err)));
      }

      try {
        paymentSuccessRows = await fetchAllSupabaseRows(supabase, "payment_success", {
          orderBy: "created_at",
          ascending: false,
        });
      } catch (err: any) {
        console.error("Error fetching payment_success:", err);
        toast.error("Failed to load payment history: " + (err.message || String(err)));
      }

      const [p, u, c, ce, dm, cl, ss, ap, notifs, asgnResult, v, cyber, customStaff] = await Promise.all([
        safeQuery(profilesQuery, "profiles"),
        safeQuery(supabase.from("universities").select("*").order("name"), "universities"),
        safeQuery(supabase.from("colleges").select("*, universities(name)").order("name"), "colleges"),
        safeQuery(supabase.from("certificates").select("*").order("created_at", { ascending: false }).limit(100), "certificates"),
        safeQuery(supabase.from("internship_domains").select("*").order("name"), "internship_domains"),
        safeQuery(supabase.from("classes").select("*, internship_domains(name)").order("scheduled_at", { ascending: true }), "classes"),
        safeQuery(supabase.from("system_settings").select("*"), "system_settings"),
        safeQuery(supabase.from("admin_permissions").select("*").eq("user_id", session.user.id).maybeSingle(), "admin_permissions"),
        safeQuery(supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50), "notifications"),
        safeQuery(supabase.from("assignments").select("*, assignment_submissions(id)").order("created_at", { ascending: false }), "assignments"),
        safeQuery(supabase.from("site_visits").select("id, visitor_id, created_at"), "site_visits"),
        safeQuery(supabase.from("cybercafe_profiles").select("*").order("created_at", { ascending: false }), "cybercafe_profiles"),
        safeQuery(supabase.from("admin_staff").select("*").order("created_at", { ascending: false }), "admin_staff")
      ]);

      setRegistrationDraftLeads(regDraftRows);

      console.log("Fetched Payments:", paymentSuccessRows.length);
      console.log("Fetched Leads:", pcRows.length);

      const rolesMap = (adminRoles || []).reduce((acc: any, curr: any) => {
        if (!acc[curr.user_id]) acc[curr.user_id] = [];
        acc[curr.user_id].push(curr.role);
        return acc;
      }, {});

      // Role check for current user
      const currentRoles = rolesMap[session.user.id] || [];
      const isSuper = currentRoles.includes("super_admin");
      
      if (isSuper) {
        navigate("/super-admin");
        return;
      }

      setStaff(customStaff.data || []);
      setUnis(u.data || []);

      let caa: any[] = [];
      try {
        const { data, error: caaErr } = await supabase
          .from("college_admin_assignments")
          .select("user_id, college_id, college_admin_code, created_at, colleges(name)")
          .order("created_at", { ascending: false });
        if (caaErr) {
          console.error("CAA fetch error:", caaErr);
        } else {
          caa = data || [];
        }
      } catch (err: any) {
        console.error("Exception fetching college admin assignments:", err);
      }

      if (caa && caa.length > 0) {
        const caIds = [...new Set(caa.map((r: any) => r.user_id).filter(Boolean))] as string[];
        let caProfiles: any[] = [];
        try {
          const { data, error: caProfError } = await supabase.from("profiles").select("id,email,full_name").in("id", caIds);
          if (caProfError) {
            console.error("caProfiles error:", caProfError);
          } else {
            caProfiles = data || [];
          }
        } catch (err: any) {
          console.error("Exception fetching caProfiles:", err);
        }
        const profById: Record<string, { email?: string; full_name?: string }> = {};
        caProfiles.forEach((p: any) => {
          profById[p.id] = { email: p.email, full_name: p.full_name };
        });
        const collegeList = c.data || [];
        const byUser = new Map<string, any>();
        for (const r of caa) {
          const collegeName =
            r.colleges?.name ?? collegeList.find((x: any) => x.id === r.college_id)?.name ?? "";
          const existing = byUser.get(r.user_id);
          if (!existing) {
            byUser.set(r.user_id, {
              user_id: r.user_id,
              college_admin_code: r.college_admin_code,
              created_at: r.created_at,
              profile_email: profById[r.user_id]?.email,
              profile_name: profById[r.user_id]?.full_name,
              college_ids: [r.college_id],
              college_names: collegeName ? [collegeName] : [],
            });
          } else {
            if (r.college_id && !existing.college_ids.includes(r.college_id)) {
              existing.college_ids.push(r.college_id);
            }
            if (collegeName && !existing.college_names.includes(collegeName)) {
              existing.college_names.push(collegeName);
            }
          }
        }
        setCollegeAdmins(Array.from(byUser.values()));
      } else {
        setCollegeAdmins([]);
      }

      setColleges(c.data || []);
      setCerts(ce.data || []);
      setDomains(dm.data || []);
      setClassesList(cl.data || []);
      setSystemSettings(ss.data || []);

      // Set permissions: try standard table first, fallback to admin_staff record
      let finalPermissions = ap.data;
      if (!finalPermissions && session.user.email) {
        const staffEntry = (customStaff.data || []).find(s => s.email === session.user.email);
        if (staffEntry) finalPermissions = staffEntry.permissions;
      }
      setMyPermissions(finalPermissions);

      const allUnified = paymentSuccessRows;
      setPayments(allUnified.filter((p: any) => p.status === 'success' || !p.status));
      setFailedPayments(allUnified.filter((p: any) => p.status === 'failed'));
      
      setCancelledPayments(pcRows);
      setNotifications(notifs.data || []);
      setAssignments(asgnResult.data || []);
      setCyberCafes(cyber.data || []);
      
      setVisitorCount(v.data?.length || 0);
      const uniqueVisitors = new Set((v.data || []).map(visit => visit.visitor_id));
      setUniqueVisitorCount(uniqueVisitors.size);

      // Fetch ALL students (paginated) for attendance, comms, and bulk cert
      let allStudents: any[] = [];
      try {
        allStudents = await fetchAllSupabaseRows(supabase, "students", {
          select: "*",
          orderBy: "created_at",
          ascending: false,
        });
        console.log('All students fetch (paginated):', allStudents.length);
        // Fallback: if paginated fetch returned nothing, try a direct unlimited query
        if (allStudents.length === 0) {
          console.warn('fetchAllSupabaseRows returned 0 — trying direct query fallback');
          const { data: fallbackStudents, error: fallbackErr } = await supabase
            .from('students')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50000);
          if (fallbackErr) {
            console.error('Fallback student fetch error:', fallbackErr);
            toast.error('Student data error: ' + fallbackErr.message);
          } else {
            allStudents = fallbackStudents || [];
            console.log('Fallback student fetch:', allStudents.length);
          }
        }
      } catch (err: any) {
        console.error('Students fetch error:', err);
        toast.error("Failed to load students: " + (err?.message || "Unknown error"));
        // Last-resort direct query
        try {
          const { data: fallbackStudents } = await supabase
            .from('students')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50000);
          allStudents = fallbackStudents || [];
        } catch (_) { /* ignore */ }
      }

      // Fetch attendance records and settings
      let attData: any[] = [];
      let attSettingsData: any = null;
      try {
        const [attResult, attSettingsResult] = await Promise.all([
          supabase.from('attendance').select('student_id, marked_at'),
          supabase.from('attendance_settings').select('*').eq('id', 1).maybeSingle()
        ]);
        if (attResult.error) {
          console.error('Attendance fetch error:', attResult.error);
          toast.error("Attendance load error: " + attResult.error.message);
        } else {
          attData = attResult.data || [];
        }
        if (attSettingsResult.data) {
          attSettingsData = attSettingsResult.data;
          setAttendanceCriteria(attSettingsData.min_percentage);
        }
      } catch (err: any) {
        console.error('Attendance/settings fetch error:', err);
      }

      const attGroups: Record<string, any[]> = {};
      attData.forEach((r: any) => {
        if (!attGroups[r.student_id]) attGroups[r.student_id] = [];
        attGroups[r.student_id].push(r);
      });

      const enriched = allStudents.map((s: any) => {
        const recs = attGroups[s.id] || [];
        const joiningDate = new Date(s.created_at);
        let daysSinceJoining = 1;
        if (joiningDate && !isNaN(joiningDate.getTime())) {
          daysSinceJoining = Math.max(1, Math.ceil((Date.now() - joiningDate.getTime()) / 86400000));
        }
        const pct = Math.min(100, (recs.length / daysSinceJoining) * 100);
        return { ...s, total_days: recs.length, percentage: pct, daysSinceJoining };
      });

      setAttendanceStudents(enriched);

      // Populate Communication Hub Data
      const combinedComms = allStudents.map(s => ({
        id: s.id,
        full_name: s.full_name,
        email: s.email,
        college_name: s.college_name,
      }));
      setAllStudentsComms(combinedComms);

      const existingEmails = new Set(combinedComms.map(s => s.email?.toLowerCase()));
      const leads = pcRows.filter((cp: any) => !existingEmails.has(cp.user_email?.toLowerCase()));
      setAllLeadsComms(leads);
    } catch (err: any) {
      console.error("Load Error:", err);
      toast.error("Global Load Error: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) {
      fetchStudents();
    }
  }, [allowed, studentPage, searchTerm, domainFilter, dateFilter, startDate, endDate, uniFilter, collegeFilter]);

  useEffect(() => {
    setLeadsPage(0);
  }, [leadsSearchTerm]);

  const enrolledEmailsForLeads = useMemo(
    () => new Set(allStudentsComms.map((s) => s.email?.toLowerCase()).filter(Boolean)),
    [allStudentsComms]
  );

  const leadHuntRows = useMemo(
    () =>
      buildLeadHuntRows({
        registrationDraftLeads,
        failedPayments,
        cancelledPayments,
        enrolledEmails: enrolledEmailsForLeads,
        searchTerm: leadsSearchTerm,
      }),
    [
      registrationDraftLeads,
      failedPayments,
      cancelledPayments,
      enrolledEmailsForLeads,
      leadsSearchTerm,
    ]
  );

  const leadsPageCount = Math.max(1, Math.ceil(leadHuntRows.length / leadsPageSize));
  const leadsSafePage = Math.min(leadsPage, leadsPageCount - 1);
  const paginatedLeads = useMemo(
    () =>
      leadHuntRows.slice(
        leadsSafePage * leadsPageSize,
        (leadsSafePage + 1) * leadsPageSize
      ),
    [leadHuntRows, leadsSafePage, leadsPageSize]
  );

  useEffect(() => {
    let mounted = true;

    const initAdmin = async (session: any) => {
      if (!mounted) return;
      if (!session) { navigate(ADMIN_LOGIN_PATH); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (!mounted) return;
      const rolesList = (roles || []).map((r: any) => r.role);

      if (rolesList.includes("super_admin")) {
        navigate("/super-admin");
        return;
      }

      const ok = rolesList.includes("admin");
      setAllowed(ok);
      if (ok) {
        await loadAll();
      } else {
        setLoading(false);
      }
    };

    // First try the existing session (covers page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      initAdmin(session);
    });

    // Also listen for auth state changes — this fires immediately after
    // signInWithPassword resolves, preventing the race-condition redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN') {
        initAdmin(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Bulk Actions
  const handleBulkCertificate = async () => {
    if (selectedStudents.length === 0) return toast.error("Select at least one student");
    setProcessing(true);
    try {
      const issues = selectedStudents.map(id => {
        const s = students.find(x => x.id === id);
        const certId = s.registration_id || `EZY-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        return {
          user_id: id,
          student_name: s.full_name,
          internship_name: certProgram,
          duration: certDuration,
          certificate_id: certId,
          status: "Active"
        };
      });

      const { error } = await supabase.from("certificates").insert(issues);
      if (error) throw error;

      await logAdminAction(
        'BULK_ACTION', 
        'certificate', 
        `Issued ${selectedStudents.length} certificates for ${certProgram} (Admin)`,
        { student_count: selectedStudents.length, program: certProgram, duration: certDuration }
      );

      toast.success(`Successfully generated ${selectedStudents.length} certificates!`);

      // Send certificate notification emails
      for (const issue of issues) {
        const s = students.find(x => x.id === issue.user_id);
        if (s?.email) {
          sendCertificateEmail({
            to: s.email,
            studentName: issue.student_name,
            programme: certProgram,
            certificateId: issue.certificate_id,
          });
        }
      }

      setSelectedStudents([]);
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) setSelectedStudents([]);
    else setSelectedStudents(filteredStudents.map(s => s.id));
  };

  const handleBulkAttendanceIncrease = async () => {
    if (selectedAttendanceIds.length === 0) return toast.error("Select at least one student");
    if (attendanceIncreasePercent <= 0) return toast.error("Enter a valid percentage");
    
    setProcessing(true);
    try {
      const inserts: any[] = [];
      let totalRecordsAdded = 0;

      for (const id of selectedAttendanceIds) {
        const student = attendanceStudents.find(s => s.id === id);
        if (!student) continue;

        const countToAdd = Math.ceil((attendanceIncreasePercent / 100) * student.daysSinceJoining);
        if (countToAdd > 0) {
          for (let i = 0; i < countToAdd; i++) {
            // Distribute over past hours to avoid potential duplicate timestamp issues
            const pastDate = new Date(Date.now() - (i * 3600000));
            inserts.push({
              student_id: id,
              marked_at: pastDate.toISOString()
            });
          }
          totalRecordsAdded += countToAdd;
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('attendance').insert(inserts);
        if (error) throw error;
      }

      await logAdminAction('BULK_ACTION', 'attendance', `Increased attendance by ${attendanceIncreasePercent}% for ${selectedAttendanceIds.length} students (Admin)`);
      
      toast.success(`Successfully added ${totalRecordsAdded} attendance records for ${selectedAttendanceIds.length} students!`);
      setSelectedAttendanceIds([]);
      setAttendanceIncreasePercent(0);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to increase attendance");
    } finally {
      setProcessing(false);
    }
  };

  const toggleAttendanceSelect = (id: string) => {
    setSelectedAttendanceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAttendanceSelectAll = () => {
    const visibleIds = attendanceStudents
      .filter(s => !attendanceSearchTerm || s.full_name?.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(attendanceSearchTerm.toLowerCase()))
      .map(s => s.id);
      
    if (selectedAttendanceIds.length === visibleIds.length && visibleIds.length > 0) {
      setSelectedAttendanceIds([]);
    } else {
      setSelectedAttendanceIds(visibleIds);
    }
  };


  // ─── Student Block / Unblock ───────────────────────────────────────────────
  // Toggles the student's status between "Active" and "Blocked".
  // - Blocked students cannot log in to the student portal.
  // - Action is logged to admin_logs for audit trail.
  // - Both loadAll() and fetchStudents() are called so the paginated
  //   student directory refreshes immediately without a manual page reload.
  const toggleBlock = async (user: any) => {
    // Determine the new status based on current status
    const newStatus = user.status === "Blocked" ? "Active" : "Blocked";

    // Update status in the students table
    await supabase.from("students").update({ status: newStatus }).eq("id", user.id);
    
    // Log the admin action for audit purposes
    await logAdminAction(
      'UPDATE', 
      'student', 
      `${newStatus === "Blocked" ? "Blocked" : "Unblocked"} student ${user.full_name} (Admin)`,
      { student_id: user.id, status: newStatus }
    );

    // Show success toast with clear message
    toast.success(`Student ${newStatus === "Blocked" ? "blocked" : "unblocked"} successfully!`);

    // Refresh both global data and paginated student directory
    await Promise.all([loadAll(), fetchStudents()]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const user = students.find(s => s.id === id);
    await supabase.from("students").delete().eq("id", id);
    
    await logAdminAction(
      'DELETE', 
      'student', 
      `Deleted student ${user?.full_name || id} (Admin)`,
      { entity_id: id, name: user?.full_name }
    );

    toast.success("Deleted");
    loadAll();
  };

  const handleCafeAction = async (id: string, action: 'approved' | 'rejected') => {
    let reason = null;
    if (action === 'rejected') {
      reason = prompt("Reason for rejection:");
      if (reason === null) return;
    }
    setProcessing(true);
    try {
      await supabase.from("cybercafe_profiles").update({ status: action, rejection_reason: reason }).eq("id", id);
      toast.success(`Cyber Cafe ${action}`);
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffEmail.trim()) return toast.error("Enter email");
    const { data } = await supabase.from("profiles").select("id").eq("email", staffEmail.trim()).single();
    if (!data) return toast.error("User not found");
    await supabase.from("user_roles").insert({ user_id: data.id, role: "admin" });
    
    await logAdminAction('CREATE', 'staff', `Granted admin access to ${staffEmail.trim()} (Admin)`, { user_id: data.id, email: staffEmail.trim() });
    
    toast.success("Admin added");
    setStaffEmail(""); setIsAddStaffOpen(false); loadAll();
  };

  // CRUD for Domains/Unis
  const addDomain = async () => {
    if (!newDomain.trim()) return;
    await supabase.from("internship_domains").insert({ name: newDomain.trim() });
    
    await logAdminAction('CREATE', 'domain', `Added internship domain: ${newDomain.trim()} (Admin)`);
    
    setNewDomain(""); loadAll();
  };

  const delDomain = async (id: string) => {
    if (!confirm("Delete domain?")) return;
    const domain = domains.find(d => d.id === id);
    await supabase.from("internship_domains").delete().eq("id", id);
    
    await logAdminAction('DELETE', 'domain', `Deleted internship domain: ${domain?.name || id} (Admin)`);
    
    loadAll();
  };

  const addUni = async () => {
    if (!newUni.trim()) return;
    const logo = prompt("Enter University Logo URL (optional):") || "";
    await supabase.from("universities").insert({ name: newUni.trim(), logo_url: logo });
    
    await logAdminAction('CREATE', 'university', `Added university: ${newUni.trim()} (Admin)`);
    
    setNewUni(""); loadAll();
  };

  const delUni = async (id: string) => {
    if (!confirm("Delete university?")) return;
    const uni = unis.find(u => u.id === id);
    await supabase.from("universities").delete().eq("id", id);
    
    await logAdminAction('DELETE', 'university', `Deleted university: ${uni?.name || id} (Admin)`);
    
    loadAll();
  };

  const addCollege = async () => {
    if (!newCollege.trim() || !collegeUni) return toast.error("Enter name and select university");
    await supabase.from("colleges").insert({ name: newCollege.trim(), university_id: collegeUni });
    
    const uniName = unis.find(u => u.id === collegeUni)?.name;
    await logAdminAction('CREATE', 'college', `Added college: ${newCollege.trim()} to ${uniName} (Admin)`);
    
    setNewCollege(""); loadAll();
    toast.success("College added");
  };

  const delCollege = async (id: string) => {
    if (!confirm("Delete college?")) return;
    const college = colleges.find(c => c.id === id);
    await supabase.from("colleges").delete().eq("id", id);
    
    await logAdminAction('DELETE', 'college', `Deleted college: ${college?.name || id} (Admin)`);
    
    loadAll();
  };

  const handleLogoUpload = async (file: File, uniId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${uniId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      await supabase.from("universities").update({ logo_url: publicUrl }).eq("id", uniId);
      toast.success("Logo uploaded!");
      loadAll();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    }
  };

  const editUni = async (u: any) => {
    const newName = prompt("Enter new name:", u.name);
    if (newName !== null) {
      await supabase.from("universities").update({ name: newName }).eq("id", u.id);
      loadAll();
    }
  };

  const exportToCSV = async () => {
    try {
      let query = supabase.from("students").select("*").order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      if (domainFilter !== "all") {
        query = query.eq("internship_domain", domainFilter);
      }
      if (uniFilter !== "all") {
        query = query.eq("university_name", uniFilter);
      }
      if (collegeFilter !== "all") {
        query = query.eq("college_name", collegeFilter);
      }
      if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
      }
      if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
      }
      if (dateFilter && !startDate && !endDate) {
        query = query
          .gte("created_at", `${dateFilter}T00:00:00`)
          .lte("created_at", `${dateFilter}T23:59:59`);
      }

      const { data, error } = await query.limit(30000);
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      const superAdminIds = new Set((roles || []).map((r) => r.user_id));
      const rows = (data || []).filter((s) => !superAdminIds.has(s.id));

      if (rows.length === 0) {
        toast.error("No rows match the current filters.");
        return;
      }

      const exportData = rows.map((s) => ({
        "Full Name": s.full_name,
        Email: s.email,
        Contact: s.contact_number,
        University: s.university_name,
        College: s.college_name,
        Domain: s.internship_domain,
        "Registration No": s.roll_number,
        "Batch/Session": s.academic_session,
        Semester: s.class_semester,
        "Parent Name": s.parent_name,
        "Emergency Contact": s.emergency_contact,
        Status: s.status,
        "Joined Date": new Date(s.created_at).toLocaleDateString(),
      }));

      const csv = Papa.unparse(exportData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `students_export_${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${rows.length} student(s) (same filters as the directory).`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  // Filtering Logic
  const filteredStudents = students;

  // Class Logic
  const addClass = async () => {
    if (!newClassTitle || !newClassUrl || !newClassSchedule) return toast.error("Please fill all required fields");
    try {
      await supabase.from("classes").insert({
        title: newClassTitle,
        link_type: newClassType,
        url: newClassUrl,
        scheduled_at: new Date(newClassSchedule).toISOString(),
        domain_id: newClassDomain === "all" ? null : newClassDomain
      });

      await logAdminAction('CREATE', 'class', `Scheduled class: ${newClassTitle} (Admin)`, { title: newClassTitle, schedule: newClassSchedule });

      toast.success("Class Scheduled!");
      setNewClassTitle(""); setNewClassUrl(""); setNewClassSchedule("");
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const delClass = async (id: string) => {
    if (!confirm("Delete this scheduled class?")) return;
    const cl = classesList.find(c => c.id === id);
    await supabase.from("classes").delete().eq("id", id);
    
    await logAdminAction('DELETE', 'class', `Deleted scheduled class: ${cl?.title || id} (Admin)`);
    
    toast.success("Class deleted");
    loadAll();
  };

  const toggleClassActive = async (cl: any) => {
    const newStatus = !cl.is_active;
    await supabase.from("classes").update({ is_active: newStatus }).eq("id", cl.id);
    
    await logAdminAction('UPDATE', 'class', `${newStatus ? "Enabled" : "Disabled"} class: ${cl.title} (Admin)`, { class_id: cl.id, active: newStatus });
    
    toast.success(newStatus ? "Class enabled — students can now see it" : "Class disabled — hidden from students");
    loadAll();
  };

  const isServiceEnabled = (key: string) => {
    const s = systemSettings.find(x => x.key === key);
    if (s && !s.is_enabled) return false;
    
    // Check granular per-admin permission
    if (myPermissions) {
      if (key === 'students' && myPermissions.can_manage_students === false) return false;
      if (key === 'classes' && myPermissions.can_manage_classes === false) return false;
      if (key === 'bulk' && myPermissions.can_manage_certificates === false) return false;
      if (key === 'payments' && myPermissions.can_view_payments === false) return false;
      if (key === 'leads' && myPermissions.can_manage_leads === false) return false;
      if (key === 'notifications' && myPermissions.can_manage_notifications === false) return false;
      if (key === 'assignments' && myPermissions.can_manage_assignments === false) return false;
      if (key === 'comms' && myPermissions.can_manage_communications === false) return false;
      
      // Special case for dashboard/settings - usually allowed
      if (key === 'settings' && myPermissions.can_manage_institutions === false) return true; // Keep settings accessible for other management
    }
    return true;
  };

  const runOfferLetterPdfFromStudent = (data: any) => {
    setOfferStudent(normalizeOfferLetterProfile(data));
    setTimeout(async () => {
      if (!offerLetterRef.current) {
        toast.error("Generation failed - element not found");
        setProcessing(false);
        return;
      }

      try {
        await downloadOfferLetterPdf(offerLetterRef.current, {
          fileName: `EzyIntern_Offer_Letter_${data.full_name?.replace(/\s+/g, "_") || "Student"}.pdf`,
          captureInPlace: false,
        });
        toast.success("Offer letter downloaded successfully!");
      } catch (pdfErr) {
        console.error(pdfErr);
        toast.error("Failed to generate PDF");
      } finally {
        setProcessing(false);
      }
    }, 800);
  };

  const handleDownloadOfferLetter = async () => {
    if (!offerEmail.trim()) return toast.error("Please enter student email");

    setProcessing(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("email", offerEmail.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setProcessing(false);
        return toast.error("Student not found with this email");
      }

      runOfferLetterPdfFromStudent(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch student");
      setProcessing(false);
    }
  };

  const handleCreateSubUser = async () => {
    if (!newSubUserEmail || !newSubUserPassword || !newSubUserRoleTag) {
      return toast.error("Please fill all required fields");
    }
    setProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expired. Please login again.");

      await createSubUserWithoutServiceRole(supabase, {
        email: newSubUserEmail,
        password: newSubUserPassword,
        roleTag: newSubUserRoleTag,
        role: newSubUserRole,
        permissions: newSubUserPermissions,
      });

      toast.success(`Staff member ${newSubUserRoleTag} created successfully!`);
      
      setNewSubUserEmail("");
      setNewSubUserPassword("");
      setNewSubUserRoleTag("");
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add staff member");
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateCollegeAdmin = async () => {
    if (!newCollegeAdminEmail?.trim() || !newCollegeAdminName?.trim()) {
      return toast.error("Please enter email and display name");
    }
    if (newCollegeAdminCollegeIds.length < 1) {
      return toast.error("Add at least one college: open the list, tick colleges, then press Add");
    }
    const collegeAdminCode = newCollegeAdminCode.trim();
    if (collegeAdminCode.length < 6) {
      return toast.error("Generate or enter a College Admin ID (at least 6 characters) before creating.");
    }
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expired. Please login again.");

      const { updatedExisting } = await createCollegeAdminWithoutServiceRole(supabase, {
        email: newCollegeAdminEmail.trim(),
        collegeAdminCode,
        fullName: newCollegeAdminName.trim(),
        collegeIds: newCollegeAdminCollegeIds,
      });

      const loginUrl = buildCollegeLoginLink();
      const toEmail = newCollegeAdminEmail.trim().toLowerCase();
      const displayName = newCollegeAdminName.trim();
      // Same mail path as ReferralsPanel (`bulk_custom_mail`) so hosts that strip custom actions still deliver.
      const message = `Hello ${displayName},

Your EzyIntern college portal access is ready.

Sign-in URL:
${loginUrl}

Email (sign-in): ${toEmail}
College Admin ID (enter this on the sign-in page with your email): ${collegeAdminCode}

Please keep your College Admin ID private. If you need help, contact your institution administrator.

Thank you,
EzyIntern Team`;

      const emailRes = await fetch(getSendMailApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          action: "bulk_custom_mail",
          subject: "EzyIntern — College portal access",
          message,
        }),
      });
      await assertSendMailOk(emailRes);

      toast.success(
        updatedExisting
          ? "This email was already a college admin — colleges and details were updated. Login email was sent again."
          : "College administrator created. Login details were emailed to the recipient."
      );
      setNewCollegeAdminEmail("");
      setNewCollegeAdminName("");
      setNewCollegeAdminUniId("");
      setNewCollegeAdminCollegeIds([]);
      setNewCollegeAdminCode("");
      loadAll();
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message || "");
      toast.error(msg || "Failed to create college administrator");
    } finally {
      setProcessing(false);
    }
  };

  const openEditCollegeAdmin = (row: any) => {
    const firstCollege = colleges.find((c) => c.id === row.college_ids?.[0]);
    setEditingCollegeAdmin(row);
    setEditCollegeAdminName(row.profile_name || "");
    setEditCollegeAdminEmail(row.profile_email || "");
    setEditCollegeAdminUniId(firstCollege?.university_id || "");
    setEditCollegeAdminCollegeIds([...(row.college_ids || [])]);
    setEditCollegeAdminCode("");
    setIsEditCollegeAdminOpen(true);
  };

  const handleUpdateCollegeAdmin = async () => {
    if (!editingCollegeAdmin?.user_id) return;
    if (!editCollegeAdminEmail?.trim() || !editCollegeAdminName?.trim()) {
      return toast.error("Please enter email and display name");
    }
    if (editCollegeAdminCollegeIds.length < 1) {
      return toast.error("Add at least one college: open the list, tick colleges, then press Add");
    }
    const emailNorm = editCollegeAdminEmail.trim().toLowerCase();
    setProcessing(true);
    try {
      const { data: clash } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", emailNorm)
        .neq("id", editingCollegeAdmin.user_id)
        .maybeSingle();
      if (clash?.id) {
        return toast.error(
          "This email is already used by another account. Enter a different email or edit that user from the table."
        );
      }

      await updateCollegeAdminAssignments(supabase, {
        userId: editingCollegeAdmin.user_id,
        email: editCollegeAdminEmail.trim(),
        fullName: editCollegeAdminName.trim(),
        collegeIds: editCollegeAdminCollegeIds,
        collegeAdminCode: editCollegeAdminCode.trim() || undefined,
      });
      toast.success("College administrator updated.");
      setIsEditCollegeAdminOpen(false);
      setEditingCollegeAdmin(null);
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update college administrator");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm("Remove this admin's access?")) return;
    try {
      await supabase.from("admin_staff").delete().eq("id", staffId);
      await supabase.rpc('remove_staff_access', { target_id: staffId });
      toast.success("Staff member removed.");
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to remove staff.");
    }
  };

  const handleDeleteCollegeAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to delete?")) return;
    try {
      const { error } = await supabase.rpc("delete_college_admin", { target_user_id: userId });
      if (error) {
        const msg = error.message || "";
        if (/delete_college_admin|does not exist|42883/i.test(msg)) {
          throw new Error(
            "Database function delete_college_admin is missing. Apply supabase/migrations/20260514150000_delete_college_admin_rpc.sql in the SQL Editor."
          );
        }
        throw error;
      }
      toast.success("College administrator access removed.");
      loadAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove college administrator.");
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
      // 1. Create a secondary client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const transferClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          }
        }
      });

      // 2. Sign up
      let userId: string | undefined;
      const { data: authData, error: authError } = await transferClient.auth.signUp({
        email: leadEmail,
        password: password,
        options: {
          data: { full_name: leadName }
        }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.message.toLowerCase().includes("already exists")) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", leadEmail)
            .maybeSingle();
          
          if (existingProfile) {
            userId = existingProfile.id;
          } else {
            const { data: rpcUserId, error: rpcError } = await supabase.rpc('get_user_id_by_email', { email_text: leadEmail });
            if (!rpcError && rpcUserId) {
              userId = rpcUserId;
            } else {
              throw new Error("User is registered in Auth but has no profile and search failed. Please run the SQL fix.");
            }
          }
        } else {
          throw authError;
        }
      } else {
        userId = authData.user?.id;
      }

      if (!userId) throw new Error("Failed to create or find auth user");

      // 3. Registration ID
      const { data: latestStudents } = await supabase
        .from("students")
        .select("registration_id")
        .not("registration_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      let nextSeq = 10001;
      if (latestStudents && latestStudents.length > 0) {
        const seqs = latestStudents.map(s => {
          const parts = s.registration_id.split('/');
          // Format: EZY/YEAR/INT/SEQ
          return parts.length === 4 ? parseInt(parts[3], 10) : 0;
        }).filter(n => !isNaN(n));
        if (seqs.length > 0) {
          nextSeq = Math.max(...seqs) + 1;
        }
      }
      
      const currentYear = new Date().getFullYear();
      let regId = `EZY/${currentYear}/INT/${nextSeq}`;

      // 4. Student Data with Collision Protection Loop
      let studentError = null;
      let retryCount = 0;

      const enrichedMeta = { ...(typeof metadata === "object" && metadata !== null ? metadata : {}), password };

      const studentDataPayload: any = {
        id: userId,
        email: leadEmail,
        full_name: leadName,
        gender: metadata.gender,
        parent_name: metadata.parentName,
        contact_number: lead.user_phone || metadata.contact,
        university_name: lead.university_name || metadata.university,
        college_name: lead.college_name || metadata.college,
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
        status: 'Active',
        cybercafe_shop_name: lead.cybercafe_shop_name,
        cybercafe_email: lead.cybercafe_email,
        password,
        metadata: enrichedMeta,
      };

      while (retryCount < 10) {
        studentDataPayload.registration_id = regId;
        const { error } = await supabase.from("students").upsert(studentDataPayload);
        
        if (error) {
          if (error.code === '23505' && (error.message.includes('registration_id') || error.detail?.includes('registration_id'))) {
            nextSeq++;
            regId = `EZY/${currentYear}/INT/${nextSeq}`;
            retryCount++;
            continue;
          }
          studentError = error;
        } else {
          studentError = null;
        }
        break;
      }

      if (studentError) throw studentError;

      // 5. Profile & Role
      await adminUpsertStudentProfile(supabase, {
        id: userId,
        full_name: leadName,
        email: String(leadEmail).trim().toLowerCase(),
        contact_number: lead.user_phone || metadata.contact,
        gender: metadata.gender,
        parent_name: metadata.parentName,
      });
      
      await supabase.from("user_roles").upsert({ user_id: userId, role: "student" }, { onConflict: 'user_id,role' });

      // 5.5 Create Payment Entry (Transaction)
      const { error: paymentError } = await supabase.from("payment_success").insert({
        user_id: userId,
        payment_id: `ADMIN_TRANS_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        amount_paise: lead.amount_paise || lead.amount || 9900,
        email: leadEmail,
        full_name: leadName,
        college_name: lead.college_name || metadata.college,
        status: 'success'
      });
      if (paymentError) console.error("Payment log error:", paymentError);

      // 6. Cleanup
      if (lead.registration_draft && lead.draft_id) {
        await supabase.from("registration_leads").delete().eq("id", lead.draft_id);
        setRegistrationDraftLeads((prev) => prev.filter((r) => r.id !== lead.draft_id));
      } else if (lead.user_email) {
        await supabase.from("payment_cancelled").delete().eq("id", lead.id);
        setCancelledPayments((prev) => prev.filter((p) => p.id !== lead.id));
      } else {
        await supabase.from("payment_success").delete().eq("id", lead.id);
        setFailedPayments((prev) => prev.filter((p) => p.id !== lead.id));
      }

      toast.success("Lead successfully transferred to registered students!");
      
      await logAdminAction(
        'TRANSFER', 
        'lead', 
        `Transferred lead ${leadEmail} to registered students (Admin)`,
        { lead_id: lead.id, student_id: userId }
      );
      
      loadAll();
    } catch (err: any) {
      console.error("Transfer error:", err);
      toast.error(err.message || "Failed to transfer lead.");
    } finally {
      setProcessing(false);
    }
  };

  // Payment Filtering Logic
  const filteredPayments = payments.filter(pay => {
    // Date filter
    if (payStartDate) {
      const payDate = new Date(pay.created_at);
      const start = new Date(payStartDate);
      start.setHours(0, 0, 0, 0);
      if (payDate < start) return false;
    }
    if (payEndDate) {
      const payDate = new Date(pay.created_at);
      const end = new Date(payEndDate);
      end.setHours(23, 59, 59, 999);
      if (payDate > end) return false;
    }
    
    // Search filter
    if (paySearchTerm) {
      const s = paySearchTerm.toLowerCase();
      const student = students.find(st => st.email === pay.email);
      if (!pay.full_name?.toLowerCase().includes(s) && 
          !pay.email?.toLowerCase().includes(s) && 
          !pay.payment_id?.toLowerCase().includes(s) &&
          !student?.contact_number?.toLowerCase().includes(s)) return false;
    }

    // College filter
    if (payCollegeFilter !== "all") {
      const student = students.find(s => s.email === pay.email);
      if (student?.college_name !== payCollegeFilter) return false;
    }
    
    return true;
  });

  const payPageCount = Math.max(1, Math.ceil(filteredPayments.length / payPageSize));
  const paySafePage = Math.min(payPage, payPageCount - 1);
  const paginatedPayments = useMemo(
    () =>
      filteredPayments.slice(
        paySafePage * payPageSize,
        (paySafePage + 1) * payPageSize
      ),
    [filteredPayments, paySafePage, payPageSize]
  );

  useEffect(() => {
    setPayPage(0);
  }, [payStartDate, payEndDate, payCollegeFilter, paySearchTerm]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (!allowed) return <div className="p-10 text-center">Access Denied</div>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg overflow-hidden bg-white border border-slate-100">
              <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-slate-900 hidden sm:block">Admin Portal</span>
          </div>

          <div className="flex items-center gap-4">
            {currentUserId && <ChangePinModal userId={currentUserId} />}
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-2" onClick={async () => {
              await supabase.auth.signOut();
              navigate(ADMIN_LOGIN_PATH);
            }}>
              <LogIn className="size-4 rotate-180" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-glow">
                <Shield className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">Admin Panel</h1>
                </div>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest text-[10px]">Unified Management & Bulk Certification</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6">
              {/* KPI Boxes */}
              <div className="flex gap-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                <div className="px-4 py-2 text-center border-r border-slate-100">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Page Views</div>
                  <div className="text-xl font-black text-blue-600">{visitorCount.toLocaleString()}</div>
                </div>
                <div className="px-4 py-2 text-center">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Visitors</div>
                  <div className="text-xl font-black text-indigo-600">{uniqueVisitorCount.toLocaleString()}</div>
                </div>
              </div>

              {/* Range Picker */}
              <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-2xl border border-slate-200/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Range:</span>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dashStartDate} onChange={e => setDashStartDate(e.target.value)} className="h-8 w-32 border-none bg-white rounded-lg text-[11px] font-bold shadow-sm" />
                  <Input type="date" value={dashEndDate} onChange={e => setDashEndDate(e.target.value)} className="h-8 w-32 border-none bg-white rounded-lg text-[11px] font-bold shadow-sm" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold text-xs" onClick={exportToCSV}>
                  <Download className="size-4" /> Export CSV
                </Button>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="sticky top-20 max-h-[calc(100vh-88px)] overflow-y-auto rounded-3xl">
                <TabsList className="flex flex-col h-auto bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-3 gap-1 w-full justify-start items-stretch shadow-elegant">
                  <div className="px-4 py-3 mb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100/50">Menu Options</div>
                  <TabsTrigger value="dashboard" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Activity className="size-4" /> Dashboard Overview</TabsTrigger>
                  {isServiceEnabled('students') && <TabsTrigger value="students" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Users className="size-4" /> Students Directory</TabsTrigger>}
                  {isServiceEnabled('attendance') && <TabsTrigger value="attendance" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><CheckSquare className="size-4" /> Attendance Tracking</TabsTrigger>}
                  {isServiceEnabled('bulk') && <TabsTrigger value="bulk" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Award className="size-4" /> Bulk Certification</TabsTrigger>}
                  {isServiceEnabled('classes') && <TabsTrigger value="classes" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><BookOpen className="size-4" /> Live Classes</TabsTrigger>}
                  {isServiceEnabled('payments') && <TabsTrigger value="payments" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><DollarSign className="size-4" /> Transactions & Revenue</TabsTrigger>}
                  {isServiceEnabled('leads') && <TabsTrigger value="leads" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><UserPlus className="size-4" /> Leads Hub</TabsTrigger>}
                  {isServiceEnabled('notifications') && <TabsTrigger value="notifications" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Bell className="size-4" /> Notifications</TabsTrigger>}
                  {isServiceEnabled('assignments') && <TabsTrigger value="assignments" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><FileText className="size-4" /> Assignments Portal</TabsTrigger>}
                  {isServiceEnabled('comms') && <TabsTrigger value="comms" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Mail className="size-4" /> Communications Center</TabsTrigger>}
                  <TabsTrigger value="cybercafe" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Store className="size-4" /> Cyber Cafes</TabsTrigger>
                  <TabsTrigger value="referrals" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Share2 className="size-4" /> Referrals</TabsTrigger>
                  <TabsTrigger value="college-rosters" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><FileSpreadsheet className="size-4" /> College Rosters</TabsTrigger>
                  <TabsTrigger value="fees-management" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><IndianRupee className="size-4" /> Fees Management</TabsTrigger>
                  <div className="my-2 border-t border-slate-100/80" />
                  <TabsTrigger value="settings" className="justify-start gap-3 w-full p-3.5 rounded-xl font-bold transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md hover:bg-slate-50"><Settings className="size-4" /> System Settings</TabsTrigger>
                </TabsList>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 bg-white/60 backdrop-blur-3xl rounded-[2rem] border border-white shadow-2xl p-6 md:p-10 w-full lg:w-auto overflow-y-auto max-h-[calc(100vh-88px)] sticky top-20">
              <TabsContent value="dashboard" className="animate-fade-in space-y-8 mt-0">
              {/* Visual Analytics Hub */}
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6 border-none shadow-soft bg-white group overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="size-32 text-primary -mr-8 -mt-8" />
                  </div>
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <DollarSign className="size-5 text-emerald-600" /> 
                        Revenue Statistics
                      </h2>
                      <div className="flex gap-4 mt-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Start Date</span>
                          <Input type="date" value={dashStartDate} onChange={e => setDashStartDate(e.target.value)} className="h-7 w-28 text-[10px] border-none bg-slate-50 font-bold" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">End Date</span>
                          <Input type="date" value={dashEndDate} onChange={e => setDashEndDate(e.target.value)} className="h-7 w-28 text-[10px] border-none bg-slate-50 font-bold" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Students</div>
                        <div className="text-xl font-black text-blue-600">{stats.todayEnrolledCount}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mb-1">Leads</div>
                        <div className="text-xl font-black text-orange-500">{stats.todayLeadsCount}</div>
                      </div>
                      <div className="text-right pl-4 border-l border-slate-100">
                        <div className="text-2xl font-black text-emerald-600">₹{stats.todayRevenue.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground mb-1 font-bold">Today's Revenue</div>
                        <Badge variant="outline" className={`${stats.growth >= 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"} text-[8px] font-black`}>
                          {stats.growth >= 0 ? "+" : ""}{stats.growth.toFixed(1)}% vs Yesterday
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getFilteredRevenueData()}>
                        <defs>
                          <linearGradient id="adminRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fill="url(#adminRev)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6 border-none shadow-soft bg-slate-900 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="flex items-center gap-1.5 bg-primary/20 px-2 py-1 rounded-full border border-primary/30">
                      <div className="size-1 bg-primary rounded-full animate-pulse" />
                      <span className="text-[7px] font-black text-primary tracking-widest">{monitoringStatus}</span>
                    </div>
                  </div>
                  <div className="relative z-10">
                    <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-6 shadow-glow">
                      <Activity className="size-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">Infrastructure</h3>
                    <p className="text-xs text-slate-400 font-medium mb-4">Traffic: {liveTraffic} pkts/s</p>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">API Speed</span>
                        <span className="text-lg font-bold text-emerald-400">Stable</span>
                      </div>
                      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-[92%] rounded-full shadow-glow" />
                      </div>
                    </div>
                  </div>
                  <div className="h-[100px] w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={livePulse}>
                        <defs>
                          <linearGradient id="pulseGradientAdmin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          fill="url(#pulseGradientAdmin)" 
                          isAnimationActive={true}
                          animationDuration={800}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-soft bg-white border-l-4 border-l-primary">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Enrolled Students</div>
                  <div className="text-3xl font-black">{studentTotalCount}</div>
                  <p className="text-[10px] text-muted-foreground mt-2">Active internship period</p>
                </Card>
                <Card className="p-6 border-none shadow-soft bg-white border-l-4 border-l-orange-500">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Abandoned Carts</div>
                  <div className="text-3xl font-black text-orange-600">{cancelledPayments.length}</div>
                  <p className="text-[10px] text-muted-foreground mt-2">Requires follow-up</p>
                </Card>
                <Card className="p-6 border-none shadow-soft bg-white border-l-4 border-l-emerald-500">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</div>
                  <div className="text-3xl font-black text-emerald-600">₹{totalRevenue.toLocaleString()}</div>
                  <p className="text-[10px] text-muted-foreground mt-2">Overall platform collection</p>
                </Card>
                <Card className="p-6 border-none shadow-soft bg-white border-l-4 border-l-blue-500">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Today's Revenue</div>
                  <div className="text-3xl font-black text-blue-600">₹{stats.todayRevenue.toLocaleString()}</div>
                  <Badge variant="hero" className="mt-2 text-[8px] bg-blue-50 text-blue-700 border-blue-100">
                    {stats.growth >= 0 ? "+" : ""}{stats.growth.toFixed(1)}% vs Yesterday
                  </Badge>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assignments">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="size-5 text-primary" /> Manage Assignments</h2>
                  <Button className="gap-2" onClick={() => setIsAIBuilderOpen(true)}>
                    <Sparkles className="size-4" /> Create with AI
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.length === 0 ? (
                    <div className="col-span-full text-center py-10 bg-white rounded-xl shadow-sm border">
                      <FileText className="size-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-muted-foreground">No assignments have been created yet.</p>
                      <Button className="mt-4 gap-2" onClick={() => setIsAIBuilderOpen(true)}>
                        <Sparkles className="size-4" /> Create with AI
                      </Button>
                    </div>
                  ) : (
                    assignments.map(a => (
                      <Card key={a.id} className="p-6 relative overflow-hidden group hover:border-primary transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <FileText className="size-20" />
                        </div>
                        <h3 className="font-bold text-lg mb-2">{a.title}</h3>
                        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{a.description}</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Duration</p>
                            <p className="font-bold flex items-center gap-1.5 text-sm"><Clock className="size-3" /> {a.duration_minutes}m</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Marks</p>
                            <p className="font-bold flex items-center gap-1.5 text-sm"><Award className="size-3" /> {a.total_marks}</p>
                          </div>
                          <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Status</p>
                              <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Inactive"}</Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Submissions</p>
                              <p className="font-bold">{a.assignment_submissions?.length || 0}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button className="flex-1 gap-2" onClick={() => toast.info('Detailed submissions view coming soon!')}>
                            <Users className="size-4" /> Submissions
                          </Button>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="p-6 border-none shadow-elegant">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Bell className="size-5 text-primary" /> Send Notification</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Notice Title</Label>
                        <Input value={newNoticeTitle} onChange={e => setNewNoticeTitle(e.target.value)} placeholder="e.g. Important Update" />
                      </div>
                      <div className="space-y-2">
                        <Label>Message</Label>
                        <textarea className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]" value={newNoticeMessage} onChange={e => setNewNoticeMessage(e.target.value)} placeholder="Write your message here..."></textarea>
                      </div>
                      <div className="space-y-2">
                        <Label>Target Audience</Label>
                        <Select value={newNoticeTarget} onValueChange={setNewNoticeTarget}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Students</SelectItem>
                            <SelectItem value="specific">Specific Student</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newNoticeTarget === "specific" && (
                        <div className="space-y-2">
                          <Label>Student Reg ID or UUID</Label>
                          <Input value={newNoticeTargetUserId} onChange={e => setNewNoticeTargetUserId(e.target.value)} placeholder="e.g. EZY-..." />
                        </div>
                      )}
                      <Button className="w-full gap-2" onClick={handleSendNotification} disabled={processing}>
                        {processing && <Loader2 className="size-4 animate-spin" />} Send Notification
                      </Button>
                    </div>
                  </Card>
                </div>
                <div className="lg:col-span-2 space-y-6">
                  <Card className="p-6 border-none shadow-elegant h-full flex flex-col">
                    <h3 className="text-lg font-bold mb-4">Recent Notifications</h3>
                    <ScrollArea className="flex-1 max-h-[500px]">
                      <div className="space-y-4">
                        {notifications.length === 0 ? (
                          <div className="text-center py-10 text-muted-foreground">No notifications sent yet.</div>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="p-4 rounded-xl border bg-card/50">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold">{n.title}</h4>
                                <Badge variant="outline">{new Date(n.created_at).toLocaleDateString()}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{n.message}</p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Target: <Badge variant="secondary" className="text-[10px] uppercase ml-1">{n.target_type === 'all' ? 'All Students' : 'Specific Student'}</Badge></span>
                                {n.target_type === 'specific' && n.target_user_id && <span className="text-slate-400">User ID: {n.target_user_id.substring(0, 8)}...</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="students">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><Users className="size-5 text-primary" /> Students Directory</h3>
                <Button
                  className="gap-2"
                  onClick={() => {
                    setAddStudentFormKey((k) => k + 1);
                    setIsAddStudentOpen(true);
                  }}
                >
                  <UserPlus className="size-4" /> Add Student
                </Button>
              </div>
              <Card className="p-6 border-none shadow-elegant mb-6 bg-card/50 backdrop-blur-sm">
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Name or email..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setStudentPage(0); }} />
                  </div>
                  
                  <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setStudentPage(0); }}>
                    <SelectTrigger className="gap-2"><Briefcase className="size-4" /><SelectValue placeholder="All Domains" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Domains</SelectItem>{domains.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>

                  <Select value={uniFilter} onValueChange={(v) => { setUniFilter(v); setStudentPage(0); }}>
                    <SelectTrigger className="gap-2"><Building2 className="size-4" /><SelectValue placeholder="All Universities" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Universities</SelectItem>{unis.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>

                  <Select value={collegeFilter} onValueChange={(v) => { setCollegeFilter(v); setStudentPage(0); }}>
                    <SelectTrigger className="gap-2"><GraduationCap className="size-4" /><SelectValue placeholder="All Colleges" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Colleges</SelectItem>
                      {colleges.filter(c => uniFilter === "all" || c.university_id === unis.find(u => u.name === uniFilter)?.id).map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Date</Label>
                    <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input type="date" className="pl-9" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Date</Label>
                    <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input type="date" className="pl-9" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => { 
                    setSearchTerm(""); setDateFilter(""); setDomainFilter("all"); 
                    setUniFilter("all"); setCollegeFilter("all"); setStartDate(""); setEndDate(""); 
                  }}><Filter className="size-4" /> Reset Filters</Button>
                </div>
              </Card>

              <Card className="overflow-hidden border-none shadow-elegant">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isStudentsLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="size-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : (
                      <>
                        {filteredStudents.map(s => (
                          <TableRow key={s.id} className="group hover:bg-muted/20">
                            <TableCell><Checkbox checked={selectedStudents.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">{s.full_name?.charAt(0)}</div>
                                <div><div className="font-bold text-sm">{s.full_name}</div><div className="text-[10px] text-muted-foreground">{s.email}</div></div>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="text-[9px] uppercase">{s.internship_domain || "Unassigned"}</Badge></TableCell>
                            <TableCell><div className="text-xs font-medium">{s.college_name || "—"}</div></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="size-8 p-0"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 shadow-elegant">
                                  <DropdownMenuItem onClick={() => { setSelectedUser(s); setIsViewDialogOpen(true); }} className="gap-2"><Eye className="size-4" /> View Details</DropdownMenuItem>
                                  <DropdownMenuItem
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
                                    className="gap-2 text-primary"
                                  >
                                    <Edit className="size-4" /> Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setResetPassUser(s); setIsResetPassOpen(true); }} className="gap-2 text-orange-600"><LogIn className="size-4" /> Reset Password</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleResendCredentials(s)} className="gap-2 text-indigo-600"><Mail className="size-4" /> Resend Credentials</DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setProcessing(true);
                                      runOfferLetterPdfFromStudent(s);
                                    }}
                                    className="gap-2 text-indigo-600"
                                  >
                                    <FileText className="size-4" /> Download offer letter
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {/* Block — only active when student is NOT already blocked */}
                                  <DropdownMenuItem
                                    onClick={() => s.status !== "Blocked" && toggleBlock(s)}
                                    disabled={s.status === "Blocked"}
                                    className={`gap-2 ${s.status === "Blocked" ? "opacity-40 cursor-not-allowed text-destructive" : "text-destructive"}`}
                                  >
                                    <Ban className="size-4" /> Block
                                  </DropdownMenuItem>
                                  {/* Unblock — only active when student IS currently blocked */}
                                  <DropdownMenuItem
                                    onClick={() => s.status === "Blocked" && toggleBlock(s)}
                                    disabled={s.status !== "Blocked"}
                                    className={`gap-2 ${s.status !== "Blocked" ? "opacity-40 cursor-not-allowed text-green-600" : "text-green-600"}`}
                                  >
                                    <CheckCircle2 className="size-4" /> Unblock
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {/* Permanently delete student record — irreversible */}
                                  <DropdownMenuItem onClick={() => handleDelete(s.id)} className="gap-2 text-destructive"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredStudents.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium italic">No interns found matching your filters.</TableCell></TableRow>}
                      </>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                <div className="p-4 bg-muted/10 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Showing {studentTotalCount === 0 ? 0 : studentPage * pageSize + 1} to {Math.min(studentTotalCount, (studentPage + 1) * pageSize)} of {studentTotalCount} students
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={studentPage === 0 || isStudentsLoading}
                      onClick={() => setStudentPage(p => p - 1)}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(studentTotalCount / pageSize) }, (_, i) => i)
                        .filter(pageNum => {
                          const totalPages = Math.ceil(studentTotalCount / pageSize);
                          if (totalPages <= 7) return true;
                          return Math.abs(pageNum - studentPage) <= 2 || pageNum === 0 || pageNum === totalPages - 1;
                        })
                        .map((pageNum, i, arr) => (
                          <div key={pageNum} className="flex items-center gap-1">
                            {i > 0 && pageNum - arr[i-1] > 1 && <span className="text-muted-foreground px-1 text-xs">...</span>}
                            <Button
                              variant={studentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="size-8 p-0"
                              onClick={() => setStudentPage(pageNum)}
                              disabled={isStudentsLoading}
                            >
                              {pageNum + 1}
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={(studentPage + 1) * pageSize >= studentTotalCount || isStudentsLoading}
                      onClick={() => setStudentPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="bulk">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="p-6 border-none shadow-elegant bg-primary/5">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Award className="size-5 text-primary" /> Bulk Certificate Generator</h3>
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      <div className="space-y-2">
                        <Label>Internship Program</Label>
                        <Select value={certProgram} onValueChange={setCertProgram}>
                          <SelectTrigger><SelectValue placeholder="Select Domain" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Domains</SelectItem>
                            {domains.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label>Duration</Label><Input value={certDuration} onChange={e => setCertDuration(e.target.value)} placeholder="e.g. 3 Months" /></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-primary/20">
                      <div><p className="text-sm font-bold">{selectedStudents.length} Students Selected</p><p className="text-xs text-muted-foreground">Selected students will receive certificates instantly.</p></div>
                      <Button variant="hero" className="gap-2" disabled={processing || selectedStudents.length === 0} onClick={handleBulkCertificate}>
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Generate & Issue
                      </Button>
                    </div>
                  </Card>

                  <Card className="overflow-hidden border-none shadow-elegant">
                    <div className="p-4 bg-muted/20 border-b flex justify-between items-center">
                      <h3 className="font-bold text-sm">Select Students for Certification</h3>
                      <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" /><Input className="pl-8 h-8 text-xs" placeholder="Search students..." value={bulkCertSearchTerm} onChange={e => setBulkCertSearchTerm(e.target.value)} /></div>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={selectedStudents.length === attendanceStudents.length && attendanceStudents.length > 0} onCheckedChange={() => {
                          if (selectedStudents.length === attendanceStudents.length) setSelectedStudents([]);
                          else setSelectedStudents(attendanceStudents.map(s => s.id));
                        }} /></TableHead><TableHead>Student</TableHead><TableHead>Domain</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {attendanceStudents
                            .filter(s => (!certProgram || certProgram === "all" || s.internship_domain === certProgram) && s.status !== "Blocked")
                            .filter(s => !bulkCertSearchTerm || s.full_name?.toLowerCase().includes(bulkCertSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(bulkCertSearchTerm.toLowerCase()))
                            .map(s => (
                            <TableRow key={s.id} className={selectedStudents.includes(s.id) ? "bg-primary/5" : ""}>
                              <TableCell><Checkbox checked={selectedStudents.includes(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                              <TableCell className="font-medium text-xs">{s.full_name}</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground">{s.internship_domain || '—'}</TableCell>
                            </TableRow>
                          ))}
                          {attendanceStudents.filter(s => (!certProgram || certProgram === "all" || s.internship_domain === certProgram) && s.status !== "Blocked").filter(s => !bulkCertSearchTerm || s.full_name?.toLowerCase().includes(bulkCertSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(bulkCertSearchTerm.toLowerCase())).length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">{attendanceStudents.length === 0 ? 'Loading students...' : certProgram && certProgram !== "all" ? `No active students found for "${certProgram}".` : 'No students found.'}</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="p-6 border-none shadow-elegant">
                    <h4 className="font-bold mb-4">Recent Certificates</h4>
                    <ScrollArea className="h-[400px]">
                      {certs.slice(0, 10).map(c => (
                        <div key={c.id} className="p-3 border-b last:border-0 hover:bg-muted/30 rounded transition-colors">
                          <div className="font-bold text-sm">{c.student_name}</div>
                          <div className="text-[10px] text-muted-foreground flex justify-between mt-1"><span>{c.certificate_id}</span><span>{new Date(c.created_at).toLocaleDateString()}</span></div>
                        </div>
                      ))}
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="classes">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <Card className="p-6 border-none shadow-elegant">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><BookOpen className="size-5 text-primary" /> Schedule New Class</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Target Domain</Label>
                        <Select value={newClassDomain} onValueChange={setNewClassDomain}>
                          <SelectTrigger><SelectValue placeholder="Target Audience" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Interns (Universal)</SelectItem>
                            {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Link Type</Label>
                        <Select value={newClassType} onValueChange={setNewClassType}>
                          <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="youtube">YouTube Live/Video Embed</SelectItem>
                            <SelectItem value="meet">Google Meet / Zoom Link</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Class Title / Topic</Label>
                        <Input value={newClassTitle} onChange={e => setNewClassTitle(e.target.value)} placeholder="e.g. Introduction to React JS" />
                      </div>

                      <div className="space-y-2">
                        <Label>Class Link URL</Label>
                        <Input value={newClassUrl} onChange={e => setNewClassUrl(e.target.value)} placeholder="https://..." />
                      </div>

                      <div className="space-y-2">
                        <Label>Scheduled Date & Time</Label>
                        <Input type="datetime-local" value={newClassSchedule} onChange={e => setNewClassSchedule(e.target.value)} />
                      </div>

                      <Button className="w-full gap-2 mt-2" onClick={addClass}><Calendar className="size-4" /> Schedule Class</Button>
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card className="overflow-hidden border-none shadow-elegant h-full">
                    <div className="p-4 bg-muted/20 border-b flex justify-between items-center">
                      <h3 className="font-bold">Scheduled Classes</h3>
                      <Badge variant="secondary">{classesList.length} Upcoming</Badge>
                    </div>
                    <ScrollArea className="h-[500px]">
                      {classesList.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No classes scheduled yet.</div>
                      ) : (
                        <Table>
                          <TableHeader><TableRow><TableHead>Date & Time</TableHead><TableHead>Title</TableHead><TableHead>Target</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {classesList.map(cl => (
                              <TableRow key={cl.id} className={!cl.is_active ? "opacity-50" : ""}>
                                <TableCell className="whitespace-nowrap font-medium text-xs">
                                  {new Date(cl.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </TableCell>
                                <TableCell className="font-bold">{cl.title}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] uppercase">{cl.internship_domains?.name || "All Interns"}</Badge></TableCell>
                                <TableCell>
                                  {cl.link_type === 'youtube' ? (
                                    <Badge className="bg-red-500 hover:bg-red-600">YouTube</Badge>
                                  ) : (
                                    <Badge className="bg-blue-500 hover:bg-blue-600">Meet</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {cl.is_active !== false ? (
                                    <Badge className="bg-green-500 text-white text-[10px]">Active</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title={cl.is_active !== false ? "Disable class" : "Enable class"}
                                      onClick={() => toggleClassActive(cl)}
                                      className={cl.is_active !== false ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-green-600"}
                                    >
                                      {cl.is_active !== false ? <ToggleRight className="size-5" /> : <ToggleLeft className="size-5" />}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => delClass(cl.id)}><Trash2 className="size-4 text-destructive" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="payments">
              <div className="space-y-6">
                <Card className="p-6 border-none shadow-elegant">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold flex items-center gap-2 text-green-600"><CheckCircle2 className="size-5" /> Successful Transactions</h3>
                      <Button variant="ghost" size="sm" onClick={loadAll} className="size-8 p-0"><Loader2 className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="hero" className="bg-green-100 text-green-700 hover:bg-green-200 border-none px-4 py-1.5 font-bold">
                        Count: {filteredPayments.length}
                      </Badge>
                    </div>
                  </div>
 
                  {/* Payment Filters */}
                  <Card className="p-4 border-none shadow-sm bg-muted/20 mb-6">
                    <div className="grid md:grid-cols-4 gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Date</Label>
                        <Input type="date" className="h-9" value={payStartDate} onChange={e => setPayStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Date</Label>
                        <Input type="date" className="h-9" value={payEndDate} onChange={e => setPayEndDate(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filter by College</Label>
                        <Select value={payCollegeFilter} onValueChange={setPayCollegeFilter}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="All Colleges" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Colleges</SelectItem>
                            {Array.from(new Set(students.map(s => s.college_name).filter(Boolean))).map(college => (
                              <SelectItem key={college} value={college}>{college}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Search Details</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                          <Input 
                            placeholder="Email, Phone, ID..." 
                            className="h-9 pl-9 text-xs" 
                            value={paySearchTerm} 
                            onChange={e => setPaySearchTerm(e.target.value)} 
                          />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => { setPayStartDate(""); setPayEndDate(""); setPayCollegeFilter("all"); setPaySearchTerm(""); }}>
                        <Filter className="size-3" /> Reset
                      </Button>
                    </div>
                  </Card>
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student Details</TableHead><TableHead>Contact</TableHead><TableHead>College</TableHead><TableHead>Transaction ID</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Profile</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {paginatedPayments.map(pay => {
                          const student = students.find(s => s.email === pay.email);
                          return (
                            <TableRow key={pay.id}>
                              <TableCell className="text-[10px] font-medium">{new Date(pay.created_at).toLocaleString()}</TableCell>
                              <TableCell>
                                <div className="font-bold text-slate-800">{pay.full_name || pay.email}</div>
                                <div className="text-[10px] text-muted-foreground">{pay.email}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[10px] font-medium text-slate-500">{student?.contact_number || "—"}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-[10px] font-bold text-slate-500 uppercase">{student?.college_name || "—"}</div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px] font-mono">{pay.payment_id}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">Paid</TableCell>
                              <TableCell><Badge className="bg-green-500 text-[10px] uppercase">Captured</Badge></TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="size-8 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors" 
                                  disabled={processing}
                                  onClick={() => handleViewPaymentStudent(pay.email)}
                                >
                                  {processing ? <Loader2 className="size-4 animate-spin text-indigo-600" /> : <Eye className="size-4" />}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {paginatedPayments.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No transactions found matching filters.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 bg-muted/10 border-t flex flex-col md:flex-row items-center justify-between gap-4 mt-0 rounded-b-xl">
                    <div className="text-xs text-muted-foreground font-medium">
                      Showing {filteredPayments.length === 0 ? 0 : paySafePage * payPageSize + 1} to{" "}
                      {Math.min(filteredPayments.length, (paySafePage + 1) * payPageSize)} of {filteredPayments.length}{" "}
                      transactions
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paySafePage === 0}
                        onClick={() => setPayPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: payPageCount }, (_, i) => i)
                          .filter((pageNum) => {
                            if (payPageCount <= 7) return true;
                            return (
                              Math.abs(pageNum - paySafePage) <= 2 ||
                              pageNum === 0 ||
                              pageNum === payPageCount - 1
                            );
                          })
                          .map((pageNum, i, arr) => (
                            <div key={pageNum} className="flex items-center gap-1">
                              {i > 0 && pageNum - arr[i - 1] > 1 && (
                                <span className="text-muted-foreground px-1 text-xs">...</span>
                              )}
                              <Button
                                variant={paySafePage === pageNum ? "default" : "outline"}
                                size="sm"
                                className="size-8 p-0"
                                onClick={() => setPayPage(pageNum)}
                              >
                                {pageNum + 1}
                              </Button>
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={paySafePage >= payPageCount - 1}
                        onClick={() => setPayPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="leads">
              <Card className="p-6 border-none shadow-elegant">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600"><UserPlus className="size-5" /> Active Leads</h3>
                    <p className="text-xs text-muted-foreground font-medium">New failed payments recorded in the unified system</p>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search leads..." 
                        className="pl-9 h-9" 
                        value={leadsSearchTerm}
                        onChange={e => setLeadsSearchTerm(e.target.value)}
                      />
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-700 border-none px-4 py-1.5 font-bold whitespace-nowrap">
                      Total Leads: {leadHuntRows.length}
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student Details</TableHead><TableHead>Transaction ID</TableHead><TableHead>Payment</TableHead><TableHead>Error</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {paginatedLeads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                            No current leads.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedLeads.map((cp) => (
                          <TableRow key={cp.id}>
                            <TableCell className="text-[10px] font-medium">
                              {new Date(cp.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-800">{cp.full_name}</div>
                              <div className="text-[10px] text-muted-foreground">{cp.email}</div>
                              {cp.contact_number && (
                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                  📞 {cp.contact_number}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge
                                  variant="outline"
                                  className="text-[8px] font-black uppercase text-indigo-500 border-indigo-100 leading-none py-0.5"
                                >
                                  {cp.college_name}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[8px] font-black uppercase text-emerald-500 border-emerald-100 leading-none py-0.5"
                                >
                                  {cp.course}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {cp.payment_id || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">—</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  cp.failure_reason === "Incomplete registration"
                                    ? "bg-amber-100 text-amber-900 hover:bg-amber-100 border-none text-[10px] font-bold"
                                    : "bg-red-100 text-red-700 hover:bg-red-100 border-none text-[10px] font-bold"
                                }
                              >
                                {cp.failure_reason}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0"
                                  onClick={() => {
                                    setSelectedUser(cp.original);
                                    setIsViewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="size-8 p-0 rounded-full hover:bg-emerald-600 hover:text-white transition-all"
                                  onClick={() => handleTransferLead(cp.original)}
                                  title="Transfer to Registered Students"
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
                </ScrollArea>
                <div className="p-4 bg-muted/10 border-t flex flex-col md:flex-row items-center justify-between gap-4 mt-0 rounded-b-xl">
                  <div className="text-xs text-muted-foreground font-medium">
                    Showing {leadHuntRows.length === 0 ? 0 : leadsSafePage * leadsPageSize + 1} to{" "}
                    {Math.min(leadHuntRows.length, (leadsSafePage + 1) * leadsPageSize)} of {leadHuntRows.length}{" "}
                    leads
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={leadsSafePage === 0}
                      onClick={() => setLeadsPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: leadsPageCount }, (_, i) => i)
                        .filter((pageNum) => {
                          if (leadsPageCount <= 7) return true;
                          return (
                            Math.abs(pageNum - leadsSafePage) <= 2 ||
                            pageNum === 0 ||
                            pageNum === leadsPageCount - 1
                          );
                        })
                        .map((pageNum, i, arr) => (
                          <div key={pageNum} className="flex items-center gap-1">
                            {i > 0 && pageNum - arr[i - 1] > 1 && (
                              <span className="text-muted-foreground px-1 text-xs">...</span>
                            )}
                            <Button
                              variant={leadsSafePage === pageNum ? "default" : "outline"}
                              size="sm"
                              className="size-8 p-0"
                              onClick={() => setLeadsPage(pageNum)}
                            >
                              {pageNum + 1}
                            </Button>
                          </div>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={leadsSafePage >= leadsPageCount - 1}
                      onClick={() => setLeadsPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="comms" className="animate-fade-in">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Compose Section */}
                <Card className="lg:col-span-2 p-6 shadow-soft border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Mail className="size-5 text-primary" />
                        Compose Bulk Email
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">Send custom announcements to your students</p>
                    </div>
                    {isSendingBulk && (
                      <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border border-primary/20">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        <span className="text-sm font-bold text-primary">Sending {bulkProgress}/{bulkTotal}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label>Email Subject</Label>
                      <Input 
                        placeholder="Enter email subject" 
                        value={bulkEmailSubject}
                        onChange={(e) => setBulkEmailSubject(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message Content (Supports text & basic HTML)</Label>
                      <textarea 
                        className="w-full min-h-[300px] p-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-y"
                        placeholder="Write your message here... \nUse <br/> for new lines or <p> for paragraphs."
                        value={bulkEmailBody}
                        onChange={(e) => setBulkEmailBody(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Recipients selected: </span>
                        <span className="font-bold text-primary">{selectedStudents.length + csvEmails.length}</span>
                      </div>
                      <Button 
                        variant="hero" 
                        size="lg" 
                        className="px-8 shadow-glow"
                        disabled={isSendingBulk || (!bulkEmailSubject || !bulkEmailBody) || (selectedStudents.length === 0 && csvEmails.length === 0)}
                        onClick={async () => {
                          const activeList = commRecipientType === 'enrolled' ? allStudentsComms : allLeadsComms;
                          const emailField = commRecipientType === 'enrolled' ? 'email' : 'user_email';
                          
                          const targets = [
                            ...activeList.filter((s: any) => selectedStudents.includes(s.id)).map((s: any) => s[emailField]),
                            ...csvEmails
                          ];
                          const uniqueTargets = Array.from(new Set(targets));
                          
                          if (!confirm(`Are you sure you want to send this email to ${uniqueTargets.length} recipients?`)) return;
                          
                          setIsSendingBulk(true);
                          setBulkTotal(uniqueTargets.length);
                          setBulkProgress(0);
                          
                          for (let i = 0; i < uniqueTargets.length; i++) {
                            try {
                              // Hostinger SMTP is strict — ~5s+ between messages reduces 451 ratelimit errors
                              if (i > 0) await new Promise(r => setTimeout(r, 5500));
                              
                              const response = await fetch(getSendMailApiUrl(), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  action: 'bulk_custom_mail',
                                  to: uniqueTargets[i],
                                  email: uniqueTargets[i],
                                  subject: bulkEmailSubject,
                                  message: bulkEmailBody
                                })
                              });
                              
                              const result = await response.json();
                              if (!result.success) throw new Error(result.message || "API Error");
                              
                              setBulkProgress(i + 1);
                            } catch (err: any) {
                              console.error(`Failed to send to ${uniqueTargets[i]}`, err);
                            }
                          }
                          
                          setIsSendingBulk(false);
                          toast.success(`Batch complete! Successfully sent to ${uniqueTargets.length} recipients.`);
                          setBulkEmailSubject("");
                          setBulkEmailBody("");
                        }}
                      >
                        {isSendingBulk ? "Sending..." : "Send Bulk Email Now"}
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Right: Selection & CSV Section */}
                <div className="space-y-6">
                  <Card className="p-5 shadow-soft border-slate-100">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      Target Selection
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-muted-foreground">Audience Type</Label>
                        <Select value={commRecipientType} onValueChange={(v: any) => {
                          setCommRecipientType(v);
                          setSelectedStudents([]); // Reset selection when switching audience
                        }}>
                          <SelectTrigger className="h-10 bg-slate-50 border-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="enrolled">Enrolled Students ({allStudentsComms.length})</SelectItem>
                            <SelectItem value="unenrolled">Unenrolled Leads ({allLeadsComms.length})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                        <p className="text-xs text-muted-foreground mb-3 text-center">Upload CSV with 'email' column</p>
                        <Input 
                          type="file" 
                          accept=".csv" 
                          className="bg-white"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              Papa.parse(file, {
                                header: true,
                                complete: (results) => {
                                  const emails = results.data
                                    .map((row: any) => row.email || row.Email || row.EMAIL)
                                    .filter(e => e && e.includes("@"));
                                  setCsvEmails(emails);
                                  toast.success(`Imported ${emails.length} emails from CSV`);
                                }
                              });
                            }
                          }}
                        />
                        {csvEmails.length > 0 && (
                          <div className="mt-3 flex items-center justify-between">
                            <Badge variant="outline" className="bg-white">{csvEmails.length} from CSV</Badge>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => setCsvEmails([])}>Clear</Button>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Filter & Select {commRecipientType === 'enrolled' ? 'Students' : 'Leads'}</p>
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full justify-start gap-2"
                            onClick={() => {
                              const list = commRecipientType === 'enrolled' ? allStudentsComms : allLeadsComms;
                              setSelectedStudents(list.map((s: any) => s.id));
                            }}
                          >
                            <CheckCircle2 className="size-4" /> Select All {commRecipientType === 'enrolled' ? 'Enrolled' : 'Leads'} ({commRecipientType === 'enrolled' ? allStudentsComms.length : allLeadsComms.length})
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start gap-2 text-red-500"
                            onClick={() => setSelectedStudents([])}
                          >
                            <Trash2 className="size-4" /> Clear Selection
                          </Button>
                        </div>
                        
                        <div className="mt-4 border rounded-md bg-white">
                          <div className="px-3 py-2 bg-slate-50 border-b text-[10px] font-black uppercase text-slate-500 flex justify-between">
                            <span>{selectedStudents.length} Selected</span>
                          </div>
                          <ScrollArea className="h-[200px]">
                            <div className="p-2 space-y-1">
                              {(commRecipientType === 'enrolled' ? allStudentsComms : allLeadsComms).map((item: any) => (
                                <label key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer group">
                                  <Checkbox 
                                    checked={selectedStudents.includes(item.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedStudents([...selectedStudents, item.id]);
                                      } else {
                                        setSelectedStudents(selectedStudents.filter(id => id !== item.id));
                                      }
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                      {item.full_name || item.user_name || "Unknown"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate">
                                      {item.email || item.user_email}
                                    </div>
                                  </div>
                                </label>
                              ))}
                              {(commRecipientType === 'enrolled' ? allStudentsComms : allLeadsComms).length === 0 && (
                                <div className="text-center p-4 text-xs text-muted-foreground">
                                  No {commRecipientType === 'enrolled' ? 'students' : 'leads'} found
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5 shadow-soft border-slate-100 bg-primary/5 border-primary/10">
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <Shield className="size-4 text-primary" />
                      Pro Tips
                    </h3>
                    <ul className="text-xs space-y-2 text-slate-600 list-disc pl-4">
                      <li>You can use basic HTML like <b>bold</b> or <i>italic</i>.</li>
                      <li>Check selection counts before sending.</li>
                      <li>CSV upload is the fastest way for large groups.</li>
                      <li>Do not close this window while sending is in progress.</li>
                    </ul>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="p-6 border-none shadow-elegant bg-white">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><Briefcase className="size-5 text-primary" /> Internship Domains</h3>
                  <div className="flex gap-2 mb-4"><Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="New Domain..." className="bg-slate-50 border-none" /><Button variant="hero" onClick={addDomain}><Plus className="size-4" /></Button></div>
                  <ScrollArea className="h-[200px] pr-2">
                    <div className="flex flex-wrap gap-2">{domains.map(d => <Badge key={d.id} variant="secondary" className="pl-3 pr-1 py-1 gap-2 bg-slate-100 text-slate-700 border-none rounded-lg">{d.name} <Button size="sm" variant="ghost" className="size-4 p-0 h-auto hover:bg-red-50 hover:text-red-600" onClick={() => delDomain(d.id)}><Trash2 className="size-3" /></Button></Badge>)}</div>
                  </ScrollArea>
                </Card>

                <Card className="p-6 border-none shadow-elegant bg-slate-900 text-white">
                  <h3 className="font-bold mb-4 flex items-center gap-2 text-primary"><Shield className="size-5" /> Security & Access</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Change Your Password</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-400">New Password</Label>
                      <div className="relative">
                        <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                        <Input 
                          type="password" 
                          value={newPassword} 
                          onChange={e => setNewPassword(e.target.value)} 
                          placeholder="••••••••"
                          className="bg-slate-800 border-none text-white pl-9 placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 font-black tracking-tight" 
                      disabled={processing || !newPassword}
                      onClick={async () => {
                        setProcessing(true);
                        try {
                          const { error } = await supabase.auth.updateUser({ password: newPassword });
                          if (error) throw error;
                          toast.success("Admin password updated successfully!");
                          setNewPassword("");
                          await logAdminAction('UPDATE', 'admin', 'Changed dashboard password (Admin Self-Service)');
                        } catch (err: any) {
                          toast.error(err.message);
                        } finally {
                          setProcessing(false);
                        }
                      }}
                    >
                      {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : "Update Credentials"}
                    </Button>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-6 animate-fade-in">
              {/* Criteria + Export Row */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 p-6 border-none shadow-elegant bg-slate-900 text-white">
                  <h3 className="font-black mb-1 flex items-center gap-2 text-primary"><CheckSquare className="size-5" /> Eligibility Criteria</h3>
                  <p className="text-slate-400 text-xs mb-4">Set minimum attendance % for certificate eligibility</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number" min={0} max={100}
                      value={attendanceCriteria}
                      onChange={e => setAttendanceCriteria(Number(e.target.value))}
                      className="w-24 h-10 rounded-xl bg-slate-800 border-none text-white text-center font-black text-lg focus:ring-2 focus:ring-primary/40 outline-none"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                    <Button
                      className="ml-auto bg-primary hover:bg-primary/90 font-black"
                      disabled={attendanceSaving}
                      onClick={async () => {
                        setAttendanceSaving(true);
                        const { error } = await supabase.from('attendance_settings').upsert({ id: 1, min_percentage: attendanceCriteria, updated_at: new Date().toISOString() });
                        if (error) toast.error('Failed to save'); else toast.success('Criteria saved!');
                        setAttendanceSaving(false);
                      }}
                    >
                      {attendanceSaving ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </Card>

                <Card className="md:col-span-2 p-6 border-none shadow-elegant bg-white flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><Users className="size-5 text-primary" /> Total Students Tracked</h3>
                    <div className="text-4xl font-black text-primary mt-1">{attendanceStudents.length}</div>
                    <p className="text-muted-foreground text-xs mt-1">Students with at least 1 attendance record</p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 rounded-xl font-bold"
                    onClick={() => {
                      if (attendanceStudents.length === 0) return toast.error('No data to export');
                      const rows = attendanceStudents.map(s => ({
                        'Student Name': s.full_name,
                        'Email': s.email,
                        'College': s.college_name || '',
                        'Domain': s.internship_domain || '',
                        'Total Days': s.total_days,
                        'Percentage': s.percentage.toFixed(1) + '%',
                        'Eligible': s.percentage >= attendanceCriteria ? 'Yes' : 'No'
                      }));
                      const csv = Papa.unparse(rows);
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                      toast.success('Attendance report downloaded!');
                    }}
                  >
                    <Download className="size-4" /> Export CSV
                  </Button>
                </Card>
              </div>

              {/* Student Attendance List */}
              <Card className="border-none shadow-elegant overflow-hidden">
                {selectedAttendanceIds.length > 0 && (
                  <div className="p-4 bg-primary/10 border-b flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="text-sm font-bold text-primary flex items-center gap-2">
                      <CheckSquare className="size-4" /> {selectedAttendanceIds.length} students selected
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border shadow-sm">
                        <Label className="text-xs font-bold text-slate-500 whitespace-nowrap">Increase By %</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          max={100}
                          value={attendanceIncreasePercent || ''} 
                          onChange={(e) => setAttendanceIncreasePercent(Number(e.target.value))}
                          className="w-16 h-7 text-xs border-none bg-slate-50 font-bold text-center p-0"
                          placeholder="10"
                        />
                      </div>
                      <Button 
                        size="sm" 
                        className="h-9 gap-2 shadow-sm bg-primary hover:bg-primary/90 text-white font-bold"
                        disabled={processing || attendanceIncreasePercent <= 0}
                        onClick={handleBulkAttendanceIncrease}
                      >
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
                        Apply Increase
                      </Button>
                    </div>
                  </div>
                )}
                <div className="p-4 border-b bg-muted/20 flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input className="pl-9 bg-white border-none" placeholder="Search student..." value={attendanceSearchTerm} onChange={e => setAttendanceSearchTerm(e.target.value)} />
                  </div>
                  <Button variant="ghost" size="sm" className="gap-2 text-violet-600 font-bold" onClick={loadAll}>
                    <Activity className="size-4" /> Refresh Data
                  </Button>
                </div>
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={
                            attendanceStudents.length > 0 && 
                            selectedAttendanceIds.length === attendanceStudents.filter(s => !attendanceSearchTerm || s.full_name?.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(attendanceSearchTerm.toLowerCase())).length
                          }
                          onCheckedChange={toggleAttendanceSelectAll}
                        />
                      </TableHead>
                      <TableHead className="uppercase text-[10px] font-black">Student</TableHead>
                      <TableHead className="uppercase text-[10px] font-black">College</TableHead>
                      <TableHead className="uppercase text-[10px] font-black">Total Days</TableHead>
                      <TableHead className="uppercase text-[10px] font-black">Attendance %</TableHead>
                      <TableHead className="uppercase text-[10px] font-black">Eligible</TableHead>
                      <TableHead className="uppercase text-[10px] font-black">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceStudents
                      .filter(s => !attendanceSearchTerm || s.full_name?.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) || s.email?.toLowerCase().includes(attendanceSearchTerm.toLowerCase()))
                      .map(s => (
                        <TableRow key={s.id} className={`hover:bg-muted/20 transition-colors ${selectedAttendanceIds.includes(s.id) ? 'bg-primary/5' : ''}`}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedAttendanceIds.includes(s.id)}
                              onCheckedChange={() => toggleAttendanceSelect(s.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-sm">{s.full_name}</div>
                            <div className="text-[10px] text-muted-foreground">{s.email}</div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{s.college_name || '—'}</TableCell>
                          <TableCell>
                            <span className="text-xl font-black text-violet-600">{s.total_days}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${s.percentage >= attendanceCriteria ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.min(s.percentage, 100)}%` }} />
                              </div>
                              <span className="text-xs font-black">{s.percentage.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {s.percentage >= attendanceCriteria
                              ? <Badge className="bg-emerald-50 text-emerald-700 border-none gap-1"><CheckCircle2 className="size-3" /> Eligible</Badge>
                              : <Badge className="bg-red-50 text-red-600 border-none gap-1"><XCircle className="size-3" /> Not Eligible</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="gap-1 font-bold text-xs" onClick={async () => {
                              setSelectedAttendanceStudent(s);
                              const { data } = await supabase.from('attendance').select('*').eq('student_id', s.id).order('marked_at', { ascending: false });
                              setStudentAttendanceHistory(data || []);
                              setIsAttHistoryOpen(true);
                            }}>
                              <Eye className="size-3" /> History
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    }
                    {attendanceStudents.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground">No attendance data found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                  <Card className="p-6 border-none shadow-elegant bg-gradient-to-br from-indigo-50 to-white">
                    <h3 className="font-black text-indigo-900 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <Shield className="size-4" /> Create Sub-Admin
                    </h3>
                    <p className="text-[11px] text-indigo-900/80 leading-relaxed mb-6">
                      Sub-admins and staff sign in at <strong>/admin/login</strong>. Accounts are created with secure signup (no server service-role key required); apply the <code className="text-[10px] bg-white/60 px-1 rounded">20260509200000_finalize_sub_admin_creation_rpc.sql</code> migration on Supabase so permissions sync correctly. Toggle sections below—each enabled module mirrors that area of the main Admin portal.
                    </p>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Email ID</Label>
                        <Input 
                          placeholder="staff@ezyintern.in" 
                          value={newSubUserEmail}
                          onChange={e => setNewSubUserEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Initial Password</Label>
                        <Input 
                          type="password"
                          placeholder="••••••••" 
                          value={newSubUserPassword}
                          onChange={e => setNewSubUserPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Role Tag (Full Name)</Label>
                        <Input 
                          placeholder="e.g. Finance Head" 
                          value={newSubUserRoleTag}
                          onChange={e => setNewSubUserRoleTag(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Access Level</Label>
                        <Select value={newSubUserRole} onValueChange={(v: any) => setNewSubUserRole(v)}>
                          <SelectTrigger className="h-9 bg-white border-indigo-100 font-bold text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">Staff Member (Staff Dashboard)</SelectItem>
                            <SelectItem value="admin">Sub-Admin (Full Admin Panel)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="pt-4 border-t border-indigo-100">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-3 block text-center underline">Assign Access Permissions</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { id: 'can_manage_students', label: 'Students' },
                            { id: 'can_view_payments', label: 'Payments' },
                            { id: 'can_manage_leads', label: 'Leads Hub' },
                            { id: 'can_manage_notifications', label: 'Notifications' },
                            { id: 'can_manage_assignments', label: 'Assignments' },
                            { id: 'can_manage_communications', label: 'Emails' },
                            { id: 'can_manage_classes', label: 'Classes' },
                            { id: 'can_manage_certificates', label: 'Certificates' },
                            { id: 'can_manage_institutions', label: 'Academic Partner' },
                          ].map(perm => (
                            <label key={perm.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer border border-transparent hover:border-indigo-100 transition-all">
                              <Checkbox 
                                checked={(newSubUserPermissions as any)[perm.id]}
                                onCheckedChange={(checked) => {
                                  setNewSubUserPermissions(prev => ({ ...prev, [perm.id]: !!checked }));
                                }}
                              />
                              <span className="text-[11px] font-bold text-slate-700">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <Button 
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-glow"
                        onClick={handleCreateSubUser}
                        disabled={processing}
                      >
                        {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : <UserPlus className="size-4 mr-2" />}
                        PROVISION ACCOUNT
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-6 border-none shadow-elegant bg-gradient-to-br from-emerald-50 to-white">
                    <h3 className="font-black text-emerald-900 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <GraduationCap className="size-4" /> Create College Admin
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Display name</Label>
                        <Input
                          placeholder="e.g. Dr. A. Kumar"
                          value={newCollegeAdminName}
                          onChange={(e) => setNewCollegeAdminName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Email</Label>
                        <Input
                          placeholder="principal@college.edu"
                          value={newCollegeAdminEmail}
                          onChange={(e) => setNewCollegeAdminEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">University</Label>
                        <Select
                          value={newCollegeAdminUniId || undefined}
                          onValueChange={(v) => {
                            setNewCollegeAdminUniId(v);
                            setNewCollegeAdminCollegeIds([]);
                          }}
                        >
                          <SelectTrigger className="h-9 bg-white border-emerald-100 font-bold text-xs">
                            <SelectValue placeholder="Select university" />
                          </SelectTrigger>
                          <SelectContent>
                            {unis.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">Colleges</Label>
                        <CollegeAdminCollegePicker
                          colleges={colleges}
                          universityId={newCollegeAdminUniId}
                          selectedIds={newCollegeAdminCollegeIds}
                          onChange={setNewCollegeAdminCollegeIds}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1">College Admin ID</Label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            className="h-9 bg-white border-emerald-100 font-mono text-xs font-bold tracking-tight"
                            placeholder="Click Generate or type your own (min 6 characters)"
                            value={newCollegeAdminCode}
                            onChange={(e) => setNewCollegeAdminCode(e.target.value)}
                            autoComplete="off"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 shrink-0 border-emerald-200 font-black text-[10px] uppercase bg-white"
                            onClick={() => setNewCollegeAdminCode(generateCollegeAdminCode())}
                            disabled={processing}
                          >
                            <KeyRound className="size-3.5 mr-1.5" />
                            Generate ID
                          </Button>
                        </div>
                        <p className="text-[10px] text-emerald-800/70 leading-snug">
                          This is their sign-in secret (stored as the account password). You can regenerate until you create the user.
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-glow"
                        onClick={handleCreateCollegeAdmin}
                        disabled={processing}
                      >
                        {processing ? (
                          <Loader2 className="size-4 animate-spin mr-2" />
                        ) : (
                          <Mail className="size-4 mr-2" />
                        )}
                        CREATE AND EMAIL LOGIN
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <Card className="p-6 border-none shadow-elegant">
                    <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <Users className="size-4 text-primary" /> Active Staff Management
                    </h3>
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase">Staff Member</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Role Tag</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Last Access</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staff.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No sub-admin staff found.</TableCell></TableRow>
                        ) : (
                          staff.map(member => (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="font-bold text-sm">{member.email}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="font-bold text-[10px]">{member.full_name || "Admin"}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {member.updated_at ? new Date(member.updated_at).toLocaleDateString() : "Never"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-blue-600 hover:bg-blue-50" 
                                    title="Manage Services"
                                    onClick={async () => {
                                      setSelectedStaffMember(member);
                                      // Try standard table first
                                      const { data: standardData } = await supabase.from("admin_permissions").select("*").eq("user_id", member.id).maybeSingle();
                                      
                                      if (standardData) {
                                        setStaffPermissions(standardData);
                                      } else {
                                        // Fallback to the permissions stored in the admin_staff record itself
                                        setStaffPermissions(member.permissions || {});
                                      }
                                      setIsManagePermissionsOpen(true);
                                    }}
                                  >
                                    <Shield className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteStaff(member.id)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>

                  <Card className="p-6 border-none shadow-elegant">
                    <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <GraduationCap className="size-4 text-emerald-600" /> College administrators
                    </h3>
                    <p className="text-[11px] text-muted-foreground mb-4">
                      Accounts for <code className="text-[10px]">/college/login</code>. Trash removes college portal access and restores a student role on that user (Auth user is not deleted).
                    </p>
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase">Email</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Name</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Colleges</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">College Admin ID</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Added</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collegeAdmins.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                              No college administrators yet. Create one using the card on the left.
                            </TableCell>
                          </TableRow>
                        ) : (
                          collegeAdmins.map((row) => (
                            <TableRow key={row.user_id}>
                              <TableCell className="font-bold text-sm">{row.profile_email || "—"}</TableCell>
                              <TableCell className="text-sm">{row.profile_name || "—"}</TableCell>
                              <TableCell className="text-sm">
                                {(row.college_names || []).length ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px] font-bold gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                                    onClick={() => setViewCollegeAdminRow(row)}
                                  >
                                    <Eye className="size-3.5 shrink-0" />
                                    View ({row.college_names.length})
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono font-semibold">{row.college_admin_code || "—"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:bg-blue-50"
                                    title="Edit college administrator"
                                    onClick={() => openEditCollegeAdmin(row)}
                                  >
                                    <Edit className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                    title="Remove college portal access"
                                    onClick={() => handleDeleteCollegeAdmin(row.user_id)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Card>

                  <Card className="p-6 border-none shadow-elegant bg-slate-900 text-white">
                    <h3 className="font-black text-primary mb-6 flex items-center gap-2 uppercase tracking-widest text-xs">
                      <Shield className="size-4" /> Domain Management
                    </h3>
                    <div className="space-y-6">
                      <div className="flex gap-2">
                        <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="New Domain..." className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/30" />
                        <Button size="sm" onClick={async () => {
                          if(!newDomain) return;
                          await supabase.from("internship_domains").insert({ name: newDomain });
                          setNewDomain("");
                          loadAll();
                        }}><Plus className="size-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {domains.map(d => (
                          <Badge key={d.id} variant="outline" className="bg-white/5 border-white/10 text-white font-bold py-1">
                            {d.name}
                            <Trash2 className="size-3 ml-2 cursor-pointer text-red-400" onClick={async () => {
                              if(confirm("Delete domain?")) { await supabase.from("internship_domains").delete().eq("id", d.id); loadAll(); }
                            }} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cybercafe">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Store className="size-5 text-primary" /> Cyber Cafe Management</h2>
                </div>
                
                <Card className="p-0 border-none shadow-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 border-b border-slate-100">
                        <TableRow>
                          <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Shop & Owner</TableHead>
                          <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Contact</TableHead>
                          <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Location</TableHead>
                          <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Status</TableHead>
                          <TableHead className="text-right font-bold text-slate-500 uppercase text-[10px] tracking-widest">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cyberCafes.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">No Cyber Cafes found.</TableCell></TableRow>
                        ) : cyberCafes.map(cafe => (
                          <TableRow key={cafe.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell>
                              <div className="font-bold text-sm text-slate-900">{cafe.shop_name}</div>
                              <div className="text-xs text-slate-500">{cafe.owner_name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-slate-900">{cafe.email}</div>
                              <div className="text-xs text-slate-500">{cafe.phone}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-700 max-w-[200px]">
                              {cafe.location || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${
                                cafe.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                cafe.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                                'bg-orange-50 text-orange-600 border-orange-200'
                              }`}>
                                {formatCyberCafeStatusLabel(cafe.status)}
                              </Badge>
                              {cafe.rejection_reason && <div className="text-[9px] text-red-500 mt-1 max-w-[150px] truncate" title={cafe.rejection_reason}>Reason: {cafe.rejection_reason}</div>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 text-xs font-bold gap-1"
                                  onClick={() => {
                                    setSelectedCafe(cafe);
                                    setIsCafeViewOpen(true);
                                  }}
                                >
                                  <Eye className="size-3" /> View
                                </Button>

                                {(cafe.status === 'pending_approval' || cafe.status === 'pending_kyc') && (
                                  <>
                                    <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 h-8 text-xs font-bold" onClick={() => handleCafeAction(cafe.id, 'approved')}>
                                      Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 h-8 text-xs font-bold" onClick={() => handleCafeAction(cafe.id, 'rejected')}>
                                      Reject
                                    </Button>
                                  </>
                                )}
                                {cafe.status === 'approved' && (
                                  <Button size="sm" variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 h-8 text-xs font-bold" onClick={() => handleCafeAction(cafe.id, 'rejected')}>
                                    Revoke
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="referrals">
              <ReferralsPanel />
            </TabsContent>

            <TabsContent value="college-rosters">
              <CollegeRostersPanel />
            </TabsContent>

            <TabsContent value="fees-management" className="mt-0">
              <FeesManagementPanel onLogAction={logAdminAction} />
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <Dialog
        open={!!viewCollegeAdminRow}
        onOpenChange={(open) => {
          if (!open) setViewCollegeAdminRow(null);
        }}
      >
        <DialogContent className="max-w-lg border-none shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-emerald-600" />
              Assigned colleges
            </DialogTitle>
            <DialogDescription>
              {viewCollegeAdminRow?.profile_name
                ? `${viewCollegeAdminRow.profile_name} (${viewCollegeAdminRow.profile_email || "—"})`
                : "Colleges this administrator can access in the college portal."}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[min(60vh,320px)] pr-3">
            <ol className="space-y-2 list-decimal list-inside">
              {(viewCollegeAdminRow?.college_names || []).map((name: string, idx: number) => (
                <li
                  key={`${name}-${idx}`}
                  className="text-sm font-medium text-slate-800 leading-snug pl-1 marker:text-emerald-600"
                >
                  {displayCollegeName(name)}
                </li>
              ))}
            </ol>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewCollegeAdminRow(null)}>
              Close
            </Button>
            {viewCollegeAdminRow ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  openEditCollegeAdmin(viewCollegeAdminRow);
                  setViewCollegeAdminRow(null);
                }}
              >
                <Edit className="size-4 mr-2" />
                Edit administrator
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCollegeAdminOpen} onOpenChange={setIsEditCollegeAdminOpen}>
        <DialogContent className="max-w-md border-none shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="size-5 text-emerald-600" />
              Edit college administrator
            </DialogTitle>
            <DialogDescription>
              Update name, email, and which colleges this account can view in the college portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">Display name</Label>
              <Input
                value={editCollegeAdminName}
                onChange={(e) => setEditCollegeAdminName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">Email</Label>
              <Input
                value={editCollegeAdminEmail}
                onChange={(e) => setEditCollegeAdminEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">University</Label>
              <Select
                value={editCollegeAdminUniId || undefined}
                onValueChange={(v) => {
                  setEditCollegeAdminUniId(v);
                  setEditCollegeAdminCollegeIds((ids) =>
                    ids.filter((id) => colleges.find((c) => c.id === id)?.university_id === v)
                  );
                }}
              >
                <SelectTrigger className="h-9 font-bold text-xs">
                  <SelectValue placeholder="Select university" />
                </SelectTrigger>
                <SelectContent>
                  {unis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">Colleges</Label>
              <CollegeAdminCollegePicker
                colleges={colleges}
                universityId={editCollegeAdminUniId}
                selectedIds={editCollegeAdminCollegeIds}
                onChange={setEditCollegeAdminCollegeIds}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">College Admin ID (optional)</Label>
              <Input
                className="font-mono text-xs"
                placeholder="Leave blank to keep current sign-in ID"
                value={editCollegeAdminCode}
                onChange={(e) => setEditCollegeAdminCode(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCollegeAdminOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleUpdateCollegeAdmin}
              disabled={processing}
            >
              {processing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-none shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" />
              Add student (same steps as registration)
            </DialogTitle>
            <DialogDescription>
              Multi-step form matching the public registration flow. Payment is skipped; credentials are emailed when possible.
            </DialogDescription>
          </DialogHeader>
          <RegistrationForm
            key={addStudentFormKey}
            variant="admin"
            onAdminComplete={async (info) => {
              await logAdminAction(
                "CREATE",
                "student",
                `Manually added student (full form): ${info.full_name} (Admin)`,
                { email: info.email }
              );
              setIsAddStudentOpen(false);
              loadAll();
              fetchStudents();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}><DialogContent><DialogHeader><DialogTitle>Add Administrator</DialogTitle><DialogDescription>Enter the staff email address to grant administrator dashboard access.</DialogDescription></DialogHeader>
        <div className="p-4 space-y-4"><div className="space-y-2"><Label>User Email</Label><Input value={staffEmail} onChange={e => setStaffEmail(e.target.value)} /></div></div>
        <DialogFooter><Button onClick={handleAddStaff}>Grant Access</Button></DialogFooter>
      </DialogContent></Dialog>

      {/* Attendance History Dialog */}
      <Dialog open={isAttHistoryOpen} onOpenChange={setIsAttHistoryOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-none shadow-elegant">
          <DialogDescription className="sr-only">
            Attendance summary and daily attendance records for the selected student.
          </DialogDescription>
          <div className="bg-slate-900 p-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <div className="size-10 rounded-xl bg-violet-500/20 flex items-center justify-center"><CheckSquare className="size-5 text-violet-400" /></div>
              <div>
                <DialogTitle className="text-lg font-black text-white">{selectedAttendanceStudent?.full_name}</DialogTitle>
                <p className="text-slate-400 text-xs">{selectedAttendanceStudent?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
              <div className="text-center">
                <div className="text-2xl font-black text-violet-400">{studentAttendanceHistory.length}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Days</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-black ${selectedAttendanceStudent?.percentage >= attendanceCriteria ? 'text-emerald-400' : 'text-red-400'}`}>
                  {selectedAttendanceStudent?.percentage?.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Attendance</div>
              </div>
              <div className="text-center">
                {selectedAttendanceStudent?.percentage >= attendanceCriteria
                  ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">✅ Eligible</Badge>
                  : <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Not Eligible</Badge>
                }
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 ml-1">Attendance Records</p>
            <ScrollArea className="max-h-[380px]">
              <div className="space-y-2 pr-1">
                {studentAttendanceHistory.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">No records found</div>
                ) : studentAttendanceHistory.map((rec, idx) => (
                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-black text-xs">{idx + 1}</div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">
                          {new Date(rec.marked_at).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(rec.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px] font-black">Present</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPassOpen} onOpenChange={setIsResetPassOpen}>
        <DialogContent className="sm:max-w-[425px] border-none shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="size-5 text-orange-600" />
              Reset Student Password
            </DialogTitle>
            <DialogDescription>
              Set a new manual password for {resetPassUser?.full_name}. This will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input 
                type="text" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="Enter new password"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPassOpen(false)}>Cancel</Button>
            <Button variant="hero" className="bg-orange-600 hover:bg-orange-700 shadow-orange-200" onClick={handleResetPassword} disabled={processing || !newPassword}>
              {processing && <Loader2 className="size-4 animate-spin mr-2" />} Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}><DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl border-none shadow-elegant">
        <DialogDescription className="sr-only">
          Student profile including personal, academic, emergency contacts, and stored metadata.
        </DialogDescription>
        <div className="bg-primary p-6 text-white">
          <DialogTitle className="text-2xl font-black">
            {selectedUser?.full_name || selectedUser?.metadata?.fullName || "Profile Details"}
          </DialogTitle>
          <p className="text-primary-foreground/80 text-xs mt-1">
            {selectedUser?.registration_id ? `Reg ID: ${selectedUser.registration_id}` : "Lead / Pending Registration"}
          </p>
        </div>
        {selectedUser && (
          <ScrollArea className="max-h-[70vh]">
            <div className="p-8 space-y-8">
              {/* Personal Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <User className="size-3" /> Personal Information
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Gender</Label><p className="text-sm font-bold">{selectedUser.gender || selectedUser.metadata?.gender || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Email</Label><p className="text-sm font-bold truncate">{selectedUser.email || selectedUser.user_email || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Contact</Label><p className="text-sm font-bold">{selectedUser.contact_number || selectedUser.user_phone || selectedUser.metadata?.contact_number || selectedUser.metadata?.contact || "—"}</p></div>
                  <div className="md:col-span-2"><Label className="text-[9px] uppercase text-muted-foreground font-bold">Parent / Guardian</Label><p className="text-sm font-bold">{selectedUser.parent_name || selectedUser.metadata?.parentName || "—"}</p></div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Academic Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <GraduationCap className="size-3" /> Academic Details
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="col-span-2"><Label className="text-[9px] uppercase text-muted-foreground font-bold">University</Label><p className="text-sm font-bold">{selectedUser.university_name || selectedUser.metadata?.university_name || selectedUser.metadata?.university || "—"}</p></div>
                  <div className="col-span-2"><Label className="text-[9px] uppercase text-muted-foreground font-bold">College</Label><p className="text-sm font-bold">{selectedUser.college_name || selectedUser.metadata?.college_name || selectedUser.metadata?.college || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Degree</Label><p className="text-sm font-bold">{selectedUser.degree || selectedUser.metadata?.degree || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Department</Label><p className="text-sm font-bold">{selectedUser.department || selectedUser.metadata?.department || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Subject</Label><p className="text-sm font-bold">{selectedUser.metadata?.subject || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Session</Label><p className="text-sm font-bold">{selectedUser.academic_session || selectedUser.metadata?.session || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Semester</Label><p className="text-sm font-bold">{selectedUser.class_semester || selectedUser.metadata?.semester || selectedUser.metadata?.classSem || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Roll Number</Label><p className="text-sm font-bold">{selectedUser.roll_number || selectedUser.metadata?.rollNo || "—"}</p></div>
                  <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Label className="text-[9px] uppercase text-primary font-bold">Internship Domain</Label>
                    <p className="text-base font-black text-slate-900">{selectedUser.internship_domain || selectedUser.metadata?.course || selectedUser.metadata?.internship_domain || "—"}</p>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Emergency Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <Phone className="size-3" /> Emergency Contacts
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Contact Name</Label><p className="text-sm font-bold">{selectedUser.emergency_name || selectedUser.metadata?.emName || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Relationship</Label><p className="text-sm font-bold">{selectedUser.emergency_relation || selectedUser.metadata?.emRel || "—"}</p></div>
                  <div><Label className="text-[9px] uppercase text-muted-foreground font-bold">Contact Phone</Label><p className="text-sm font-bold">{selectedUser.emergency_contact || selectedUser.metadata?.emPhone || "—"}</p></div>
                </div>
              </div>

              {typeof selectedUser.metadata?.consent_form_url === "string" &&
                selectedUser.metadata.consent_form_url.trim() !== "" && (
                  <>
                    <Separator className="bg-slate-100" />
                    <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                        <FileText className="size-3" /> Consent letter
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        File uploaded at registration — opens in a new tab.
                      </p>
                      <Button variant="outline" size="sm" className="font-bold" asChild>
                        <a
                          href={selectedUser.metadata.consent_form_url.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open consent letter
                        </a>
                      </Button>
                    </div>
                  </>
                )}

              {selectedUser.reason && (
                <>
                  <Separator className="bg-slate-100" />
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <Label className="text-[9px] uppercase text-red-600 font-bold">Lead Status / Payment Issue</Label>
                    <p className="text-sm font-bold text-red-700">{selectedUser.reason}</p>
                  </div>
                </>
              )}

              {/* Technical / A2Z Section */}
              <div className="space-y-4 pt-6 border-t border-slate-100 bg-slate-50 p-6 rounded-2xl">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2">
                  <Shield className="size-3" /> Technical Metadata (A2Z Details)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-[9px] uppercase text-orange-400 font-bold">Account Password (directory)</Label>
                    <p className="text-sm font-mono font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded inline-block">
                      {getStudentDirectoryPassword(selectedUser) || "Not stored — use Reset Password or Resend Credentials"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-[9px] uppercase text-muted-foreground font-bold">Address</Label>
                    <p className="text-sm font-bold">{selectedUser.metadata?.address || "—"}</p>
                  </div>
                </div>
                
                {/* JSON Raw Dump for A2Z Check */}
                <div className="mt-4">
                  <Label className="text-[9px] uppercase text-slate-400 font-bold">Raw JSON Metadata</Label>
                  <pre className="text-[9px] bg-slate-900 text-slate-300 p-4 rounded-xl mt-2 overflow-x-auto">
                    {JSON.stringify(selectedUser.metadata, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-8">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close View</Button>
                {!selectedUser.registration_id && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={() => { setIsViewDialogOpen(false); handleTransferLead(selectedUser); }}>
                    Transfer to Student
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent></Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border-none shadow-elegant">
          <DialogDescription className="sr-only">
            Edit student personal details, academic information, internship fields, and emergency contacts.
          </DialogDescription>
          <div className="bg-primary p-6 text-white">
            <DialogTitle className="text-2xl font-black">Edit Student Details</DialogTitle>
            <p className="text-primary-foreground/80 text-xs mt-1">Update personal and academic records</p>
          </div>
          {editData && (
            <ScrollArea className="max-h-[70vh]">
              <form onSubmit={handleEditStudentSubmit} className="p-8 space-y-8">
                {/* Personal Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <User className="size-3" /> Personal Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input value={editData.full_name || ""} onChange={e => setEditData({...editData, full_name: e.target.value})} required /></div>
                    <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={editData.email || ""} onChange={e => setEditData({...editData, email: e.target.value})} required /></div>
                    <div className="space-y-1"><Label className="text-xs">Contact Number</Label><Input value={editData.contact_number || ""} onChange={e => setEditData({...editData, contact_number: e.target.value})} /></div>
                    <div className="space-y-1"><Label className="text-xs">Gender</Label>
                      <Select
                        value={["Male", "Female", "Other"].includes(editData.gender) ? editData.gender : EDIT_GENDER_SENTINEL}
                        onValueChange={(v) =>
                          setEditData({ ...editData, gender: v === EDIT_GENDER_SENTINEL ? "" : v })
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EDIT_GENDER_SENTINEL}>Not specified</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 md:col-span-2"><Label className="text-xs">Parent / Guardian</Label><Input value={editData.parent_name || ""} onChange={e => setEditData({...editData, parent_name: e.target.value})} /></div>
                  </div>
                </div>

                <StudentEditFormFields
                  editData={editData}
                  setEditData={setEditData}
                  domains={domains}
                  unis={unis}
                  colleges={colleges}
                  registrationNumLabel="Registration number"
                />

                <div className="flex justify-end gap-4 mt-8">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={processing}>{processing ? <Loader2 className="size-4 animate-spin mr-2" /> : null} Save Changes</Button>
                </div>
              </form>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={isManagePermissionsOpen} onOpenChange={setIsManagePermissionsOpen}>
        <DialogContent className="max-w-md border-none shadow-elegant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-blue-600" />
              Manage Staff Services
            </DialogTitle>
            <DialogDescription>
              Toggle specific dashboard services for {selectedStaffMember?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'can_manage_students', label: 'Students Management' },
                { id: 'can_view_payments', label: 'Payments & Revenue' },
                { id: 'can_manage_leads', label: 'Leads Hub' },
                { id: 'can_manage_notifications', label: 'System Notifications' },
                { id: 'can_manage_communications', label: 'Email Communications' },
                { id: 'can_manage_classes', label: 'Live Classes' },
                { id: 'can_manage_certificates', label: 'Certificates Issue' },
                { id: 'can_manage_institutions', label: 'System Settings' },
              ].map((perm) => (
                <div key={perm.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Label htmlFor={perm.id} className="font-bold text-sm text-slate-700 cursor-pointer">{perm.label}</Label>
                  <Checkbox 
                    id={perm.id}
                    checked={staffPermissions[perm.id] === true}
                    onCheckedChange={(checked) => {
                      setStaffPermissions((prev: any) => ({ ...prev, [perm.id]: !!checked }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagePermissionsOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 shadow-blue-200 font-bold"
              disabled={processing}
              onClick={async () => {
                setProcessing(true);
                try {
                  // 1. Update our primary admin_staff table (Guaranteed to work)
                  const { error: staffTableError } = await supabase
                    .from("admin_staff")
                    .update({
                      permissions: staffPermissions
                    })
                    .eq("id", selectedStaffMember.id);
                  
                  if (staffTableError) throw staffTableError;

                  // 2. Try to sync to standard table as fallback (Silent failure if no auth user)
                  try {
                    await supabase
                      .from("admin_permissions")
                      .upsert({
                        user_id: selectedStaffMember.id,
                        ...staffPermissions,
                        updated_at: new Date().toISOString()
                      });
                  } catch (e) {
                    console.warn("Sync to standard permissions failed (likely no auth user yet):", e);
                  }

                  toast.success("Permissions updated successfully!");
                  loadAll();
                  setIsManagePermissionsOpen(false);
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setProcessing(false);
                }
              }}
            >
              {processing && <Loader2 className="size-4 animate-spin mr-2" />}
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cyber Cafe View Dialog */}
      <Dialog open={isCafeViewOpen} onOpenChange={setIsCafeViewOpen}>
        <DialogContent className="max-w-4xl border-none shadow-elegant max-h-[90vh] flex flex-col p-0">
          <DialogDescription className="sr-only">
            Cyber cafe dashboard summary, linked students, and transactions.
          </DialogDescription>
          <div className="p-6 border-b">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="size-5 text-primary" />
                  Cyber Cafe Dashboard View
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {selectedCafe && (() => {
            const cafeStudents = cafeViewStudents;
            const allCafeEmails = cafeStudents.map((s) => s.email).filter(Boolean);
            
            // Pending / Leads
            const cafePending = failedPayments.filter(fp => fp.cybercafe_email === selectedCafe.email || fp.cybercafe_shop_name === selectedCafe.shop_name || allCafeEmails.includes(fp.email));
            // Also check old legacy leads
            const oldCafePending = cancelledPayments.filter(cp => cp.cybercafe_email === selectedCafe.email || cp.cybercafe_shop_name === selectedCafe.shop_name || allCafeEmails.includes(cp.user_email));
            const allPending = [...cafePending, ...oldCafePending];

            const cafeTransactions = payments.filter(p => allCafeEmails.includes(p.email) || p.cybercafe_email === selectedCafe.email);

            const filterByDate = (item: any) => {
              if (!cafeStartDate && !cafeEndDate) return true;
              const date = new Date(item.created_at);
              if (cafeStartDate) {
                const start = new Date(cafeStartDate);
                start.setHours(0, 0, 0, 0);
                if (date < start) return false;
              }
              if (cafeEndDate) {
                const end = new Date(cafeEndDate);
                end.setHours(23, 59, 59, 999);
                if (date > end) return false;
              }
              return true;
            };

            const filteredStudents = cafeStudents.filter(filterByDate);
            const filteredPending = allPending.filter(filterByDate);
            const filteredTransactions = cafeTransactions.filter(filterByDate);

            return (
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-6 space-y-8">
                  {cafeStudentsLoading && (
                    <p className="text-xs font-medium text-slate-500">
                      Loading students linked to this center…
                    </p>
                  )}
                  {/* Offer Letter Download Section (New Request) */}
                  <Card className="p-6 border-none bg-blue-50/50 shadow-sm">
                    <h3 className="font-black text-blue-900 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText className="size-4" /> Student Offer Letter Download
                    </h3>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                        <Input 
                          placeholder="Enter student email ID..." 
                          className="pl-10 h-10 bg-white border-blue-100" 
                          value={offerEmail}
                          onChange={e => setOfferEmail(e.target.value)}
                        />
                      </div>
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700 font-bold gap-2"
                        onClick={handleDownloadOfferLetter}
                        disabled={processing}
                      >
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        Download Letter
                      </Button>
                    </div>
                    <p className="text-[10px] text-blue-600/70 mt-2 italic font-medium">
                      Enter the registered email of any student to download their official offer letter.
                    </p>
                  </Card>

                  {/* Filter Section */}
                  <div className="flex flex-wrap items-end justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Start Date</Label>
                        <Input type="date" className="h-8 text-xs bg-white border-slate-200" value={cafeStartDate} onChange={e => setCafeStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">End Date</Label>
                        <Input type="date" className="h-8 text-xs bg-white border-slate-200" value={cafeEndDate} onChange={e => setCafeEndDate(e.target.value)} />
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs mt-5 text-slate-500" onClick={() => { setCafeStartDate(""); setCafeEndDate(""); }}>Clear Filters</Button>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-black tracking-widest text-emerald-600 mb-1">Registrations</div>
                      <div className="text-2xl font-black text-emerald-700">{filteredTransactions.length}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Successful payments in range</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Shop Details */}
                    <Card className="p-4 border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Store className="size-3" /> Shop Details
                        </h4>
                        {!isEditingCafe ? (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 font-bold" onClick={() => { setIsEditingCafe(true); setEditCafeData(cyberCafeRowForEdit(selectedCafe)); }}>Edit Details</Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-red-500 font-bold" onClick={() => setIsEditingCafe(false)}>Cancel</Button>
                            <Button size="sm" className="h-6 text-[10px] px-2 font-bold bg-primary hover:bg-primary/90 text-white" disabled={processing} onClick={async () => {
                              setProcessing(true);
                              try {
                                const { error } = await supabase.from('cybercafe_profiles').update({
                                  shop_name: editCafeData.shop_name, owner_name: editCafeData.owner_name, email: editCafeData.email, phone: editCafeData.phone,
                                  status: editCafeData.status, rejection_reason: editCafeData.rejection_reason,
                                }).eq('id', selectedCafe.id);
                                if (error) throw error;
                                toast.success("Cyber Cafe details updated!");
                                setSelectedCafe(editCafeData);
                                setIsEditingCafe(false);
                                loadAll();
                              } catch(e: any) { toast.error(e.message); } finally { setProcessing(false); }
                            }}>
                              {processing ? <Loader2 className="size-3 animate-spin mr-1" /> : null} Save Changes
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-[10px] uppercase font-black text-muted-foreground">Shop Name</Label>
                          {isEditingCafe ? <Input className="h-7 text-xs mt-1" value={editCafeData.shop_name} onChange={e => setEditCafeData({...editCafeData, shop_name: e.target.value})} /> : <p className="text-sm font-bold">{selectedCafe.shop_name}</p>}
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase font-black text-muted-foreground">Owner Name</Label>
                          {isEditingCafe ? <Input className="h-7 text-xs mt-1" value={editCafeData.owner_name} onChange={e => setEditCafeData({...editCafeData, owner_name: e.target.value})} /> : <p className="text-sm font-bold">{selectedCafe.owner_name}</p>}
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase font-black text-muted-foreground">Email</Label>
                          {isEditingCafe ? <Input className="h-7 text-xs mt-1" value={editCafeData.email} onChange={e => setEditCafeData({...editCafeData, email: e.target.value})} /> : <p className="text-sm font-bold truncate">{selectedCafe.email}</p>}
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase font-black text-muted-foreground">Phone</Label>
                          {isEditingCafe ? <Input className="h-7 text-xs mt-1" value={editCafeData.phone} onChange={e => setEditCafeData({...editCafeData, phone: e.target.value})} /> : <p className="text-sm font-bold">{selectedCafe.phone}</p>}
                        </div>
                        <div className="col-span-2">
                          <Label className="text-[10px] uppercase font-black text-muted-foreground block mb-1">Status</Label>
                          {isEditingCafe ? (
                            <Select value={editCafeData.status} onValueChange={v => setEditCafeData({...editCafeData, status: v})}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${
                              selectedCafe.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                              selectedCafe.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-orange-50 text-orange-600 border-orange-200'
                            }`}>
                              {formatCyberCafeStatusLabel(selectedCafe.status)}
                            </Badge>
                          )}
                          {(!isEditingCafe && selectedCafe.status === 'rejected' && selectedCafe.rejection_reason) && (
                            <p className="text-xs text-red-600 mt-2"><strong>Reason:</strong> {selectedCafe.rejection_reason}</p>
                          )}
                          {(isEditingCafe && editCafeData.status === 'rejected') && (
                            <div className="mt-2">
                              <Label className="text-[10px] text-red-600">Rejection Reason</Label>
                              <Input className="h-7 text-xs" value={editCafeData.rejection_reason || ''} onChange={e => setEditCafeData({...editCafeData, rejection_reason: e.target.value})} />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                  </div>

                  <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="transactions" className="font-bold">Transactions ({filteredTransactions.length})</TabsTrigger>
                      <TabsTrigger value="students" className="font-bold">Registered Students ({filteredStudents.length})</TabsTrigger>
                      <TabsTrigger value="pending" className="font-bold">Pending / Leads ({filteredPending.length})</TabsTrigger>
                    </TabsList>

                    {/* Transactions Tab */}
                    <TabsContent value="transactions">
                      <Card className="border border-slate-100 shadow-sm">
                        <ScrollArea className="h-[300px]">
                          <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                              <TableRow>
                                <TableHead className="text-[10px] uppercase font-black">Date</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Student Details</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Payment ID</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredTransactions.map(tx => (
                                <TableRow key={tx.id}>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <div className="font-bold text-sm">{tx.full_name}</div>
                                    <div className="text-[10px] text-muted-foreground">{tx.email}</div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{tx.payment_id}</TableCell>
                                  <TableCell className="text-right text-xs text-muted-foreground">Paid</TableCell>
                                </TableRow>
                              ))}
                              {filteredTransactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell></TableRow>}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                    </TabsContent>

                    {/* Students Tab */}
                    <TabsContent value="students">
                      <Card className="border border-slate-100 shadow-sm">
                        <ScrollArea className="h-[300px]">
                          <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                              <TableRow>
                                <TableHead className="text-[10px] uppercase font-black">Date</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Student Details</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">College</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Reg. ID</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredStudents.map(s => (
                                <TableRow key={s.id}>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                                  <TableCell>
                                    <div className="font-bold text-sm">{s.full_name}</div>
                                    <div className="text-[10px] text-muted-foreground">{s.email} | {s.contact_number}</div>
                                  </TableCell>
                                  <TableCell className="text-xs font-medium">{s.college_name || '—'}</TableCell>
                                  <TableCell className="text-xs font-bold text-primary">{s.registration_id || 'Pending'}</TableCell>
                                </TableRow>
                              ))}
                              {filteredStudents.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No registered students found.</TableCell></TableRow>}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                    </TabsContent>

                    {/* Pending Leads Tab */}
                    <TabsContent value="pending">
                      <Card className="border border-slate-100 shadow-sm">
                        <ScrollArea className="h-[300px]">
                          <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                              <TableRow>
                                <TableHead className="text-[10px] uppercase font-black">Date</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Lead Details</TableHead>
                                <TableHead className="text-[10px] uppercase font-black">Error Reason</TableHead>
                                <TableHead className="text-[10px] uppercase font-black text-right">Payment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPending.map(p => (
                                <TableRow key={p.id}>
                                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</TableCell>
                                  <TableCell>
                                    <div className="font-bold text-sm">{p.full_name || p.metadata?.fullName || p.email || p.user_email}</div>
                                    <div className="text-[10px] text-muted-foreground">{p.email || p.user_email}</div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 border-red-100">
                                      {p.failure_reason || p.reason || 'Payment Failed'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                                </TableRow>
                              ))}
                              {filteredPending.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No pending leads found.</TableCell></TableRow>}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </Card>
                    </TabsContent>

                  </Tabs>
                </div>
              </div>
            );
          })()}

          <div className="p-4 border-t bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => setIsCafeViewOpen(false)}>Close View</Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="py-8 bg-slate-900 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} EzyIntern Admin. All rights reserved.</p>
        </div>
      </footer>

      {/* Must stay mounted outside dialogs so offerLetterRef works for Students directory + email download */}
      <div className="fixed left-[-10000px] top-0 pointer-events-none" aria-hidden>
        <div style={{ width: OFFER_LETTER_CAPTURE_WIDTH_PX }}>
          <OfferLetter ref={offerLetterRef} profile={offerStudent} />
        </div>
      </div>

      <AIAssignmentBuilder
        open={isAIBuilderOpen}
        onClose={() => setIsAIBuilderOpen(false)}
        onSaved={() => { loadAll(); }}
      />
    </div>
  );
};

export default Admin;
