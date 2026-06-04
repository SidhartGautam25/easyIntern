import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  CYBER_CAFE_LOGIN_PATH,
  STUDENT_LOGIN_PATH,
  isCyberCafePartnerPublicPath,
  isPublicLoginPath,
} from "@/lib/authRoutes";
import { Button } from "@/components/ui/button";
import { GraduationCap, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SiteNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onPublicLoginPage = isPublicLoginPath(pathname);
  const loginPath = isCyberCafePartnerPublicPath(pathname)
    ? CYBER_CAFE_LOGIN_PATH
    : STUDENT_LOGIN_PATH;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const checkRole = async (userId: string) => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (data || []).map(r => r.role);
      setIsAdmin(roles.includes("admin"));
      setIsSuperAdmin(roles.includes("super_admin"));
      setIsStaff(roles.includes("staff"));
    };

    const updateStatus = () => {
      setIsVerified(sessionStorage.getItem("2fa_verified") === "true");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setIsAuthed(!!s);
      updateStatus();
      if (s?.user) checkRole(s.user.id);
      else { setIsAdmin(false); setIsSuperAdmin(false); setIsStaff(false); }
    });

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthed(!!data.session);
      updateStatus();
      if (data.session?.user) checkRole(data.session.user.id);
    });

    // Listen for storage changes (for same-tab updates)
    window.addEventListener('storage', updateStatus);
    const interval = setInterval(updateStatus, 1000); // Polling as fallback for sessionStorage

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('storage', updateStatus);
      clearInterval(interval);
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex size-10 items-center justify-center rounded-lg overflow-hidden shadow-soft group-hover:shadow-glow transition-smooth">
            <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
          </div>
          <div className="leading-none">
            <div className="font-bold text-2xl tracking-tighter"><span className="text-[#5ea4e8]">Ezy</span><span className="text-black dark:text-white">intern</span></div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:block">Bihar's Trusted Internship Provider</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link to="/" className="text-muted-foreground hover:text-primary transition-smooth">Home</Link>
          <a href="/#why" className="text-muted-foreground hover:text-primary transition-smooth">Why Join</a>
          <Link to="/benefits" className="text-muted-foreground hover:text-primary transition-smooth">Benefits</Link>
          <a href="/#universities" className="text-muted-foreground hover:text-primary transition-smooth">Universities</a>
          <Link to="/verify" className="text-muted-foreground hover:text-primary transition-smooth">Verify</Link>
          <Link to="/contact" className="text-muted-foreground hover:text-primary transition-smooth">Contact</Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Menu */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {(isAuthed && (isSuperAdmin || isAdmin || isStaff || isVerified) && !onPublicLoginPage) ? (
              <>
                {isSuperAdmin ? (
                  <Button variant="accent" size="sm" onClick={() => navigate("/super-admin")}>Super Admin</Button>
                ) : isAdmin ? (
                  <Button variant="accent" size="sm" onClick={() => navigate("/admin")}>Admin Panel</Button>
                ) : isStaff ? (
                  <Button variant="accent" size="sm" onClick={() => navigate("/staff-dashboard")}>Staff Panel</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
                )}
                <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(loginPath)}>Login</Button>
                <Button variant="accent" size="sm" onClick={() => navigate("/register")}>Register</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen ? (
        <div
          id="mobile-menu"
          className="md:hidden flex flex-col bg-background border-b p-4 space-y-4 shadow-lg absolute w-full left-0 top-16 z-50"
        >
          <Link to="/" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <a href="/#why" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Why Join</a>
          <Link to="/benefits" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Benefits</Link>
          <a href="/#universities" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Universities</a>
          <Link to="/verify" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Verify</Link>
          <Link to="/contact" className="text-muted-foreground font-medium" onClick={() => setMobileMenuOpen(false)}>Contact</Link>

          <div className="pt-4 border-t flex flex-col gap-2">
            {(isAuthed && (isSuperAdmin || isAdmin || isStaff || isVerified) && !onPublicLoginPage) ? (
              <>
                {isSuperAdmin ? (
                  <Button variant="accent" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/super-admin"); }}>Super Admin</Button>
                ) : isAdmin ? (
                  <Button variant="accent" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/admin"); }}>Admin Panel</Button>
                ) : isStaff ? (
                  <Button variant="accent" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/staff-dashboard"); }}>Staff Panel</Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/dashboard"); }}>Dashboard</Button>
                )}
                <Button variant="ghost" className="w-full" onClick={() => { setMobileMenuOpen(false); logout(); }}>Logout</Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate(loginPath); }}>Login</Button>
                <Button variant="accent" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/register"); }}>Register</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
};
