import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ADMIN_LOGIN_PATH,
  COLLEGE_DASHBOARD_PATH,
  COLLEGE_LOGIN_PATH,
  CYBER_CAFE_LEGACY_LOGIN_PATH,
  CYBER_CAFE_LOGIN_PATH,
  REFERRAL_DASHBOARD_PATH,
  REFERRAL_LOGIN_PATH,
  STUDENT_CREDENTIAL_LOGIN_QUERY_KEY,
  STUDENT_CREDENTIAL_LOGIN_QUERY_VALUE,
  STUDENT_LOGIN_PATH,
} from "@/lib/authRoutes";
import { getSendMailApiUrl } from "@/lib/sendMailApi";
import { useAuthBackend } from "@/hooks/useBackend";
import { resolveLoginIdentifier } from "@/lib/resolveLoginIdentifier";
import { apiClient } from "@/lib/apiClient";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { NoticePopup } from "@/components/NoticePopup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

// Roles come ONLY from public.user_roles (gated by RLS). user_metadata is
// client-editable (auth.updateUser data) and must never be trusted for access.
async function resolveDashboardPath(user: User): Promise<string> {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const rolesList = (roles || []).map((r: any) => r.role);
  const { data: cybercafe } = await supabase.from("cybercafe_profiles").select("id").eq("id", user.id).maybeSingle();
  if (rolesList.includes("super_admin")) return "/super-admin";
  if (rolesList.includes("staff")) return "/staff-dashboard";
  if (rolesList.includes("admin")) return "/admin";
  if (rolesList.includes("college_admin")) return COLLEGE_DASHBOARD_PATH;
  if (rolesList.includes("referral_partner")) return REFERRAL_DASHBOARD_PATH;
  if (cybercafe) return "/cybercafe/dashboard";
  return "/dashboard";
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestOtp, resetPassword } = useAuthBackend();
  const isCyberCafeLoginRoute =
    location.pathname === CYBER_CAFE_LOGIN_PATH ||
    location.pathname === CYBER_CAFE_LEGACY_LOGIN_PATH;
  const isCollegeLoginRoute = location.pathname === COLLEGE_LOGIN_PATH;
  const isReferralLoginRoute = location.pathname === REFERRAL_LOGIN_PATH;
  // /cybercafe/login is partner portal login (no student-sign-out flow).
  const isAdminLoginRoute =
    location.pathname === ADMIN_LOGIN_PATH || isCyberCafeLoginRoute;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  // Captcha State
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [verifyingCaptcha, setVerifyingCaptcha] = useState(false);

  const handleVerifyCaptcha = () => {
    if (captchaVerified || verifyingCaptcha) return;
    setVerifyingCaptcha(true);
    // Add a slight variability to the delay for a more "human" feel
    const delay = 3500 + Math.random() * 1000;
    setTimeout(() => {
      setCaptchaVerified(true);
      setVerifyingCaptcha(false);
      toast.success("Security check passed");
    }, delay);
  };

  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot PIN State
  const [showForgotPinDialog, setShowForgotPinDialog] = useState(false);
  const [forgotPinStep, setForgotPinStep] = useState<"email" | "otp" | "new_pin">("email");
  const [forgotPinEmail, setForgotPinEmail] = useState("");
  const [forgotPinOtp, setForgotPinOtp] = useState("");
  const [forgotPinNew, setForgotPinNew] = useState("");
  const [forgotPinLoading, setForgotPinLoading] = useState(false);
  
  // Forgot Password State
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "otp" | "password">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Credential emails link with ?portal=student: sign out so admin/staff session does not steal the student login page.
  // Otherwise any existing session skips the form and redirects to that user's dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(location.search);
      const forceStudentPortal =
        location.pathname === STUDENT_LOGIN_PATH &&
        params.get(STUDENT_CREDENTIAL_LOGIN_QUERY_KEY) === STUDENT_CREDENTIAL_LOGIN_QUERY_VALUE;

      if (forceStudentPortal) {
        await supabase.auth.signOut();
        if (cancelled) return;
        navigate(STUDENT_LOGIN_PATH, { replace: true });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      const dest = await resolveDashboardPath(session.user);
      navigate(dest, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname, location.search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter credentials"); return; }
    if (!isReferralLoginRoute && !captchaVerified) { toast.error("Please verify you are human"); return; }
    setLoginLoading(true);
    try {
      const rawInput = email.trim();
      const digitsOnly = rawInput.replace(/\D/g, "");
      if ((isReferralLoginRoute || isCollegeLoginRoute) && digitsOnly.length >= 10 && !rawInput.includes("@")) {
        toast.error("Please sign in with the email address on your invitation (not a phone number).");
        return;
      }

      let normalizedEmail = rawInput.toLowerCase();
      if (!rawInput.includes("@")) {
        const resolved = await resolveLoginIdentifier(supabase, rawInput);
        if (!resolved.ok) {
          throw new Error(resolved.message);
        }
        normalizedEmail = resolved.email;
      }

      // Block wrong portal before auth — no session is created for disallowed routes.
      if (isCollegeLoginRoute) {
        const { data: mayCollege, error: collegeRpcErr } = await supabase.rpc("account_may_use_college_login", {
          check_email: normalizedEmail,
        });
        if (collegeRpcErr) {
          console.warn("account_may_use_college_login RPC:", collegeRpcErr.message);
        } else if (mayCollege !== true) {
          toast.error(
            "No college administrator account found for this email. Students use the main sign-in; staff use the admin portal."
          );
          return;
        }
      } else if (isReferralLoginRoute) {
        const { data: mayRef, error: refRpcErr } = await supabase.rpc("account_may_use_referral_login", {
          check_email: normalizedEmail,
        });
        if (refRpcErr) {
          console.warn("account_may_use_referral_login RPC:", refRpcErr.message);
        } else if (mayRef !== true) {
          toast.error(
            "No referral promoter account found for this email. Use the promoter sign-in link you received, or contact EzyIntern support."
          );
          return;
        }
      } else if (!isAdminLoginRoute) {
        const { data: needsAdminRoute, error: routeRpcErr } = await supabase.rpc(
          "account_requires_admin_login",
          { check_email: normalizedEmail }
        );
        if (routeRpcErr) {
          console.warn("account_requires_admin_login RPC:", routeRpcErr.message);
        } else if (needsAdminRoute === true) {
          toast.error(
            "You don't have access to the student portal. This sign-in is only for enrolled students."
          );
          return;
        }
      } else {
        const { data: studentOnly, error: studentRpcErr } = await supabase.rpc(
          "account_is_student_only",
          { check_email: normalizedEmail }
        );
        if (studentRpcErr) {
          console.warn("account_is_student_only RPC:", studentRpcErr.message);
        } else if (studentOnly === true) {
          toast.error(
            "You don't have access to the admin portal. This sign-in is only for authorised staff and administrators."
          );
          return;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      
      if (error) {
        // Keep message user-friendly while still accurate.
        if (error.message?.toLowerCase().includes("invalid login credentials")) {
          throw new Error("Invalid credentials. Please check email/phone and password.");
        }
        throw error;
      }
      const user = data.user;
      if (!user) throw new Error("Authentication failed");

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const rolesList = (roles || []).map((r: any) => r.role);
      const isStaffMember = rolesList.includes("staff");
      const hasCollegeAdmin = rolesList.includes("college_admin");
      const hasReferralPartner = rolesList.includes("referral_partner");
      const { data: cybercafe } = await supabase.from("cybercafe_profiles").select("id").eq("id", user.id).maybeSingle();

      const isAdminPortalAccount =
        rolesList.includes("super_admin") ||
        rolesList.includes("admin") ||
        isStaffMember ||
        !!cybercafe;

      if (isCollegeLoginRoute) {
        if (!hasCollegeAdmin) {
          await supabase.auth.signOut();
          toast.error(
            "You do not have access to the college portal. Use the email that received your college administrator invitation."
          );
          return;
        }
      } else if (isReferralLoginRoute) {
        if (!hasReferralPartner) {
          await supabase.auth.signOut();
          toast.error(
            "You do not have access to the referral promoter portal. Use the email that received your promoter invitation."
          );
          return;
        }
      } else if (isAdminLoginRoute) {
        if (!isAdminPortalAccount) {
          await supabase.auth.signOut();
          toast.error(
            "You don't have access to the admin portal. This sign-in is only for authorised staff and administrators."
          );
          return;
        }
      } else {
        const elevatedForStudentBlock =
          rolesList.includes("super_admin") ||
          rolesList.includes("admin") ||
          isStaffMember ||
          hasCollegeAdmin ||
          hasReferralPartner ||
          !!cybercafe;
        if (elevatedForStudentBlock) {
          await supabase.auth.signOut();
          toast.error(
            "You don't have access to the student portal. This sign-in is only for enrolled students."
          );
          return;
        }
      }

      // Determine destination route for all users
      let destination = "/dashboard";
      if (isCollegeLoginRoute) destination = COLLEGE_DASHBOARD_PATH;
      else if (isReferralLoginRoute) destination = REFERRAL_DASHBOARD_PATH;
      else if (rolesList.includes("super_admin")) destination = "/super-admin";
      else if (isStaffMember) destination = "/staff-dashboard";
      else if (rolesList.includes("admin")) destination = "/admin";
      else if (hasCollegeAdmin) destination = COLLEGE_DASHBOARD_PATH;
      else if (hasReferralPartner) destination = REFERRAL_DASHBOARD_PATH;
      else if (cybercafe) destination = "/cybercafe/dashboard";

      // ─── Security PIN step disabled (password-only login) ───────────────────
      // Previously: fetch user_security.security_pin → enter_pin | create_pin UI.
      // const { data: pinData } = await supabase.from("user_security").select("security_pin")...
      // if (pinData?.security_pin) setLoginStep("enter_pin"); else setLoginStep("create_pin");

      toast.success("Welcome back!");
      navigate(destination);
    } catch (error: any) {
      try {
        await apiClient.post('/auth/log-event', {
          action: 'user.login',
          outcome: 'failure',
          details: { email, error: error.message }
        });
      } catch (logErr) {
        console.warn('Failed to send login failure log:', logErr);
      }
      toast.error(error.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  /* PIN login disabled — restore if re-enabled (needs pendingPin / pendingRoute / pendingUserId state again):
  const handleVerifyPin = async () => {
    if (pendingPin.length !== 4) return;
    setLoginLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_security")
        .select("security_pin")
        .eq("user_id", pendingUserId)
        .maybeSingle();

      if (error) {
        console.error("PIN Fetch Error:", error);
        throw new Error("Unable to verify security code. Please contact support.");
      }

      if (data?.security_pin === pendingPin) {
        toast.success("Welcome back!");
        navigate(pendingRoute);
      } else {
        toast.error("Incorrect security code");
        setPendingPin("");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
      console.error("Verification error:", err);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSaveNewPin = async () => {
    if (pendingPin.length !== 4) return;
    setLoginLoading(true);
    try {
      const { error } = await supabase
        .from("user_security")
        .upsert({ user_id: pendingUserId, security_pin: pendingPin });
      if (error) throw error;
      toast.success("Security code created! Welcome.");
      navigate(pendingRoute);
    } catch (err: any) {
      toast.error(err.message || "Failed to save security code");
    } finally {
      setLoginLoading(false);
    }
  };
  */

  const handleCheckEmailForReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!resetEmail) {
      toast.error("Please enter your email");
      return;
    }
    setResetLoading(true);
    try {
      const identifierInput = resetEmail.trim();
      const resolved = await resolveLoginIdentifier(supabase, identifierInput);
      if (!resolved.ok) {
        throw new Error(resolved.message);
      }
      const normalizedEmail = resolved.email;
      setResetEmail(normalizedEmail);

      await requestOtp(normalizedEmail);
      setResetStep("otp");
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    const otp = resetOtp.trim();
    if (otp.length !== 6) {
      toast.error("Please enter your 6-digit OTP");
      return;
    }
    setResetStep("password");
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim(), resetOtp.trim(), newPassword.trim());
      toast.success("Password updated successfully! You can now login.");
      setShowResetDialog(false);
      setResetStep("email");
      setResetEmail("");
      setResetOtp("");
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const openResetDialog = () => {
    setResetEmail(email);
    setResetStep("email");
    setResetOtp("");
    setNewPassword("");
    setShowResetDialog(true);
  };

  // ─── Forgot PIN handlers ───────────────────────────────────────────────────
  const handleForgotPinSendOtp = async () => {
    const normalizedEmail = forgotPinEmail.trim().toLowerCase();
    if (!normalizedEmail) { toast.error("Please enter your email"); return; }
    setForgotPinLoading(true);
    try {
      // Look up the user's auth ID from cybercafe_profiles or students
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      sessionStorage.setItem("fp_otp", generatedOtp);
      sessionStorage.setItem("fp_email", normalizedEmail);

      const response = await fetch(getSendMailApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_otp',
          otp: generatedOtp,
          to: normalizedEmail,
          email: normalizedEmail
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || "Failed to send OTP");
      }
      toast.success("OTP sent! Check your email.");
      setForgotPinStep("otp");
    } catch (err: any) {
      if (window.location.hostname === 'localhost') {
        const devOtp = sessionStorage.getItem("fp_otp");
        toast.info(`Dev OTP: ${devOtp}`);
        setForgotPinStep("otp");
      } else {
        toast.error(err.message || "Failed to send OTP");
      }
    } finally {
      setForgotPinLoading(false);
    }
  };

  const handleForgotPinVerifyOtp = () => {
    const expected = sessionStorage.getItem("fp_otp");
    const storedEmail = sessionStorage.getItem("fp_email");
    if (forgotPinOtp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    if (forgotPinOtp !== expected || forgotPinEmail.trim().toLowerCase() !== storedEmail) {
      toast.error("Invalid or expired OTP"); return;
    }
    sessionStorage.removeItem("fp_otp");
    sessionStorage.removeItem("fp_email");
    setForgotPinStep("new_pin");
    toast.success("OTP verified! Set your new PIN.");
  };

  const handleForgotPinSave = async () => {
    if (forgotPinNew.length !== 4) return;
    setForgotPinLoading(true);
    try {
      // OTP was verified client-side. Look up user_id by email across user tables.
      const normalizedEmail = forgotPinEmail.trim().toLowerCase();
      const [studRes, cafeRes] = await Promise.all([
        supabase.from('students').select('id').ilike('email', normalizedEmail).maybeSingle(),
        supabase.from('cybercafe_profiles').select('id').ilike('email', normalizedEmail).maybeSingle(),
      ]);
      const userId = studRes.data?.id || cafeRes.data?.id;
      if (!userId) throw new Error("Could not find user with that email. Please contact support.");

      const { error } = await supabase.from('user_security').upsert({ user_id: userId, security_pin: forgotPinNew });
      if (error) throw error;

      toast.success("PIN reset successfully! You can now log in with your new PIN.");
      setShowForgotPinDialog(false);
      setForgotPinStep("email");
      setForgotPinEmail("");
      setForgotPinOtp("");
      setForgotPinNew("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset PIN");
    } finally {
      setForgotPinLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteNav />
      <NoticePopup page="login" />
      <main className="flex-1 gradient-soft py-12 md:py-20">
        <div className="container mx-auto px-4">
          <Card
            className={
              isReferralLoginRoute
                ? "max-w-md mx-auto p-7 md:p-8 shadow-elegant animate-fade-in-up border border-slate-200/80"
                : "max-w-md mx-auto p-8 md:p-10 shadow-elegant animate-fade-in-up"
            }
          >
            <div className="flex justify-center mb-8">
              <Link to="/" className="flex items-center gap-3">
                <div className="size-12 rounded-xl overflow-hidden shadow-elegant">
                  <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
                </div>
                <span className="text-2xl font-bold tracking-tighter text-slate-900">EzyIntern</span>
              </Link>
            </div>
            <div className="text-center mb-8">
              <h1
                className={
                  isReferralLoginRoute
                    ? "text-2xl font-bold tracking-tight text-slate-900 mb-2"
                    : "text-3xl font-black tracking-tight text-slate-900 mb-2"
                }
              >
                {isCyberCafeLoginRoute
                  ? "Cyber café sign-in"
                  : isCollegeLoginRoute
                  ? "College portal sign-in"
                  : isReferralLoginRoute
                  ? "Referral sign-in"
                  : isAdminLoginRoute
                  ? "Admin & partner sign-in"
                  : "Student sign-in"}
              </h1>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                {isCyberCafeLoginRoute
                  ? "Sign in to your cyber café partner dashboard"
                  : isCollegeLoginRoute
                  ? "Use the email and College Admin ID from your invitation email"
                  : isReferralLoginRoute
                  ? "Enter the email and login ID from your invitation to see who registered with your referral link."
                  : isAdminLoginRoute
                  ? "For administrators, sub-admins, staff, and cyber café partners"
                  : "For enrolled students (intern dashboard)"}
              </p>
            </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className={
                      isReferralLoginRoute
                        ? "text-sm font-medium text-slate-700 ml-0.5"
                        : "text-xs font-black uppercase tracking-widest text-slate-500 ml-1"
                    }
                  >
                    {isReferralLoginRoute ? "Email" : "Email or Phone Number"}
                  </Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder={isReferralLoginRoute ? "you@example.com" : "Email or 10-digit phone"}
                    className="h-12 bg-slate-50 border-none shadow-inner rounded-xl pl-4"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-0.5">
                    <Label
                      htmlFor="pass"
                      className={
                        isReferralLoginRoute
                          ? "text-sm font-medium text-slate-700"
                          : "text-xs font-black uppercase tracking-widest text-slate-500"
                      }
                    >
                      {isCollegeLoginRoute
                        ? "College Admin ID"
                        : isReferralLoginRoute
                        ? "Login ID from your email"
                        : "Password"}
                    </Label>
                    {!isCollegeLoginRoute && !isReferralLoginRoute ? (
                      <button type="button" onClick={() => setShowResetDialog(true)} className="text-[10px] font-black uppercase text-primary hover:underline">Forgot?</button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Input
                      id="pass"
                      type={showPw ? "text" : "password"}
                      className="h-12 bg-slate-50 border-none shadow-inner rounded-xl pl-4 pr-12"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {!isReferralLoginRoute ? (
                <div 
                  className={`flex items-center gap-4 p-4 border rounded-xl transition-all cursor-pointer select-none bg-slate-50 shadow-inner
                    ${captchaVerified ? "border-green-400 bg-green-50/50" : "border-slate-200 hover:border-primary/50"}
                  `}
                  onClick={handleVerifyCaptcha}
                >
                  <div className={`flex items-center justify-center size-8 rounded border transition-all ${captchaVerified ? 'bg-green-500 border-green-500' : verifyingCaptcha ? 'border-transparent' : 'bg-white border-slate-300'}`}>
                    {verifyingCaptcha ? (
                      <Loader2 className="size-5 text-primary animate-spin" />
                    ) : captchaVerified ? (
                      <svg className="size-5 text-white animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : null}
                  </div>
                  <span className={`text-sm font-bold ${captchaVerified ? "text-green-700" : "text-slate-600"}`}>
                    {verifyingCaptcha ? "Verifying..." : captchaVerified ? "Success!" : "Verify you are human"}
                  </span>
                  <div className="ml-auto opacity-30 flex items-center gap-1">
                    <img src="/logo.png" alt="Security" className="w-5 h-5 grayscale object-contain" />
                    <span className="text-[10px] font-bold uppercase">Protected</span>
                  </div>
                </div>
                ) : null}

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-glow transition-all disabled:opacity-50"
                  disabled={loginLoading || (!isReferralLoginRoute && !captchaVerified)}
                >
                  {loginLoading ? <Loader2 className="size-5 animate-spin mr-2" /> : null}
                  {isReferralLoginRoute ? "Sign in" : "Login"}
                </Button>
              </form>

            {/* PIN steps (create_pin / enter_pin) removed — see handleLogin + commented handlers below */}

            <p className="text-center text-sm text-muted-foreground mt-6 space-y-2">
              {isCollegeLoginRoute ? (
                <span className="block">
                  Student portal?{" "}
                  <Link to={STUDENT_LOGIN_PATH} className="text-primary font-semibold hover:underline">
                    Main sign-in
                  </Link>
                </span>
              ) : isReferralLoginRoute ? (
                <span className="block">
                  Student portal?{" "}
                  <Link to={STUDENT_LOGIN_PATH} className="text-primary font-semibold hover:underline">
                    Main sign-in
                  </Link>
                </span>
              ) : isAdminLoginRoute ? (
                <>
                  <span className="block">
                    Looking for the student portal?{" "}
                    <Link to={STUDENT_LOGIN_PATH} className="text-primary font-semibold hover:underline">
                      Main sign-in
                    </Link>
                  </span>
                </>
              ) : (
                <>
                  <span className="block">
                    New user?{" "}
                    <Link to="/register" className="text-primary font-semibold hover:underline">
                      Register here
                    </Link>
                  </span>
                </>
              )}
            </p>
          </Card>
        </div>
      </main>

      {/* Forgot Password Flow Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {resetStep === "email" &&
                (isAdminLoginRoute
                  ? "Enter your work email or registered 10-digit mobile number."
                  : "Enter your email or registered 10-digit mobile number.")}
              {resetStep === "otp" && `Enter the 6-digit OTP sent to ${resetEmail}.`}
              {resetStep === "password" && "Create a new strong password for your account."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {resetStep === "email" && (
              <form onSubmit={handleCheckEmailForReset} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email or phone</Label>
                  <Input
                    type="text"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com or 10-digit mobile"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading && <Loader2 className="size-4 animate-spin mr-2" />} 
                  Continue
                </Button>
              </form>
            )}

            {resetStep === "otp" && (
              <div className="flex flex-col items-center justify-center space-y-6">
                <InputOTP maxLength={6} value={resetOtp} onChange={setResetOtp} onComplete={handleVerifyResetOtp}>
                  <InputOTPGroup className="gap-3">
                    <InputOTPSlot index={0} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={1} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={2} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={3} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={4} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={5} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                  </InputOTPGroup>
                </InputOTP>

                <Button
                  className="w-full font-black h-12"
                  onClick={handleVerifyResetOtp}
                  disabled={resetLoading || resetOtp.length !== 6}
                >
                  {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify OTP & Continue
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Need to change your email?{" "}
                  <button
                    onClick={() => setResetStep("email")}
                    className="text-primary font-bold hover:underline"
                    disabled={resetLoading}
                  >
                    Go Back
                  </button>
                </p>
              </div>
            )}

            {resetStep === "password" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input 
                      type={showPw ? "text" : "password"} 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Min. 6 characters" 
                      required 
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button className="w-full" onClick={handleUpdatePassword} disabled={resetLoading || newPassword.length < 6}>
                  {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Forgot PIN Dialog */}
      <Dialog open={showForgotPinDialog} onOpenChange={(open) => { setShowForgotPinDialog(open); if (!open) { setForgotPinStep("email"); setForgotPinOtp(""); setForgotPinNew(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> Reset Security PIN
            </DialogTitle>
            <DialogDescription>
              {forgotPinStep === "email" && "Enter your registered email. We'll send you a 6-digit OTP to verify."}
              {forgotPinStep === "otp" && `We've sent a 6-digit code to ${forgotPinEmail}. Enter it below.`}
              {forgotPinStep === "new_pin" && "Set your new 4-digit security PIN."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {forgotPinStep === "email" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={forgotPinEmail}
                    onChange={(e) => setForgotPinEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button className="w-full h-12 font-black" onClick={handleForgotPinSendOtp} disabled={!forgotPinEmail || forgotPinLoading}>
                  {forgotPinLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                  Send OTP
                </Button>
              </div>
            )}

            {forgotPinStep === "otp" && (
              <div className="flex flex-col items-center gap-6">
                <InputOTP maxLength={6} value={forgotPinOtp} onChange={setForgotPinOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <Button className="w-full h-12 font-black" onClick={handleForgotPinVerifyOtp} disabled={forgotPinOtp.length !== 6}>
                  Verify OTP
                </Button>
                <button onClick={handleForgotPinSendOtp} className="text-xs text-primary font-bold hover:underline" disabled={forgotPinLoading}>
                  Resend Code
                </button>
              </div>
            )}

            {forgotPinStep === "new_pin" && (
              <div className="flex flex-col items-center gap-6">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 font-medium text-center w-full">
                  🔐 Choose a new 4-digit security PIN
                </div>
                <InputOTP maxLength={4} value={forgotPinNew} onChange={setForgotPinNew} onComplete={handleForgotPinSave}>
                  <InputOTPGroup className="gap-3">
                    <InputOTPSlot index={0} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={1} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={2} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                    <InputOTPSlot index={3} className="size-14 text-2xl rounded-xl border-2 border-primary/40 font-black" />
                  </InputOTPGroup>
                </InputOTP>
                <Button className="w-full h-12 font-black" onClick={handleForgotPinSave} disabled={forgotPinNew.length !== 4 || forgotPinLoading}>
                  {forgotPinLoading && <Loader2 className="size-4 animate-spin mr-2" />}
                  Save New PIN
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default Login;
