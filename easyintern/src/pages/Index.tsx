import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NoticePopup } from "@/components/NoticePopup";
import { 
  GraduationCap, 
  CheckCircle2, 
  Users, 
  Award, 
  Building2, 
  Search, 
  ArrowRight, 
  Briefcase, 
  Clock, 
  ShieldCheck, 
  Smartphone, 
  UserCheck,
  ChevronDown,
  Instagram,
  Youtube,
  Linkedin,
  Facebook,
  MapPin,
  Phone,
  Mail,
  Zap,
  Star,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const statsRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ students: 0, unis: 0, domains: 0, certs: 0 });
  const [unis, setUnis] = useState<any[]>([]);
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    supabase.from("universities").select("*").order("name").then(({ data }) => setUnis(data || []));
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!scrollRef.current || isPaused) return;
    
    const scrollContainer = scrollRef.current;
    const interval = setInterval(() => {
      if (scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth) {
        scrollContainer.scrollLeft = 0;
      } else {
        scrollContainer.scrollLeft += 1;
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, [isPaused, unis]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !counted) {
        setCounted(true);
        const duration = 2000;
        const frames = 60;
        const interval = duration / frames;
        
        let frame = 0;
        const timer = setInterval(() => {
          frame++;
          const progress = frame / frames;
          setStats({
            students: Math.floor(progress * 12000),
            unis: Math.floor(progress * 11),
            domains: Math.floor(progress * 40),
            certs: Math.floor(progress * 8500),
          });
          if (frame === frames) clearInterval(timer);
        }, interval);
      }
    }, { threshold: 0.3 });

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [counted]);

  const faqs = [
    { q: "What is the registration fee?", a: "The registration fee is a one-time charge for the entire internship duration. There are no hidden charges or extra costs for certification." },
    { q: "What is the refund policy?", a: "We offer a full refund within 24 hours of payment if you have not attended any classes. After 24 hours, the fee is non-refundable." },
    { q: "Is the certificate valid / recognised?", a: "Yes, Ezyintern is a government authorized and certified company. Our certificates are recognized by universities as per UGC Guidelines 2023. We are MCA Registered, MSME Certified, and ISO Certified." },
    { q: "How long does the internship take?", a: "The internship is structured across 4 to 8 weeks. Classes are held online 3–4 times a week and are also available as recordings." },
    { q: "Is the internship online or offline?", a: "Completely online. Classes are conducted via YouTube Live, Google Meet or Zoom. You just need a smartphone or laptop with internet access." },
    { q: "How do I verify my certificate?", a: "Visit the verify page and enter your certificate number or scan the QR code on your certificate. It takes you to the verification page automatically." }
  ];

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary selection:text-white">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>
      {/* Announcement Banner */}
      <div className="bg-primary py-2.5 px-4 text-center text-[13px] font-medium text-white">
        🎓 Registrations Open for 2023–2027 Batch &nbsp;
        <Link to="/register" className="text-blue-200 underline hover:text-white transition-colors">Register Now →</Link>
      </div>

      <SiteNav />
      <NoticePopup page="home" />

      {/* Hero Section */}
      <section id="hero" className="relative overflow-hidden pt-32 pb-20 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="absolute -top-24 -right-48 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        
        <div className="container relative z-10 mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-primary text-[13px] font-bold mb-6">
                <span>🏆</span>
                AICTE & UGC Compliant Programs
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Bihar's Trusted <span className="text-primary">Internship Provider</span> — UGC Compliant
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-xl leading-relaxed">
                120-hour, 4-credit internship programmes for B.A., B.Sc., B.Com., BBA & BCA students. Earn a verifiable digital certificate recognised by top Bihar universities.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <Button size="lg" className="h-14 px-8 text-base font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 rounded-xl group" onClick={() => navigate("/register")}>
                  🚀 Register <ArrowRight className="ml-2 size-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="outline" size="lg" className="h-14 px-8 text-base font-bold border-2 border-primary text-primary hover:bg-blue-50 rounded-xl" onClick={() => navigate("/verify")}>
                  🔍 Verify Certificate
                </Button>
              </div>
              
          <div className="flex flex-wrap gap-3">
            {["MSME Certified", "AICTE Compliant", "UGC Compliant"].map((tag) => (
              <div key={tag} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-bold text-slate-700 shadow-sm">
                <CheckCircle2 className="size-4 text-primary" /> {tag}
              </div>
            ))}
          </div>
            </div>

            <div className="relative mt-16 lg:mt-0 flex justify-center lg:justify-end">
              {/* Glow Effects */}
              <div className="absolute -left-10 -bottom-10 lg:-left-20 lg:-bottom-20 size-60 lg:size-80 opacity-30 blur-3xl bg-primary/40 rounded-full animate-pulse" />
              <div className="absolute -right-10 -top-10 lg:-right-20 lg:-top-20 size-60 lg:size-80 opacity-30 blur-3xl bg-accent/40 rounded-full animate-pulse" />
              
              {/* Main 3D Illustration */}
              <div className="relative z-10 animate-float drop-shadow-[0_35px_35px_rgba(59,130,246,0.25)] w-full max-w-[450px] lg:max-w-[550px]">
                <img 
                  src="/student_real.png" 
                  alt="Student Intern" 
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
                
                {/* Achievement Badge Overlay */}
                <div className="absolute -bottom-4 -left-4 lg:-bottom-6 lg:-left-6 bg-white p-3 lg:p-5 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-3 lg:gap-4 animate-bounce">
                  <div className="size-10 lg:size-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                    <Award className="size-6 lg:size-7" />
                  </div>
                  <div>
                    <p className="text-[8px] lg:text-[10px] uppercase font-black text-slate-400 tracking-widest">Status</p>
                    <p className="text-xs lg:text-sm font-black text-slate-800">Verified Intern</p>
                  </div>
                </div>

                {/* Trust Badge Overlay */}
                <div className="absolute top-6 -right-4 lg:top-10 lg:-right-10 bg-white/80 backdrop-blur-md p-3 lg:p-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2 lg:gap-3">
                  <div className="size-8 lg:size-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                    <ShieldCheck className="size-5 lg:size-6" />
                  </div>
                  <p className="text-[10px] lg:text-xs font-bold text-slate-800 pr-1 lg:pr-2">UGC Compliant</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <div ref={statsRef} className="bg-slate-900 py-10">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { l: "Students Trained", v: stats.students, s: "+" },
              { l: "Partner Universities", v: stats.unis, s: "" },
              { l: "Domains", v: stats.domains, s: "+" },
              { l: "Certificates Issued", v: stats.certs, s: "+" }
            ].map((st, i) => (
              <div key={i} className="text-white">
                <div className="text-3xl md:text-4xl font-black mb-1">
                  {st.v.toLocaleString()}{st.s}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">{st.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Section */}
      <section id="why" className="py-20 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4 text-primary font-bold border-primary/20">Why Choose Us</Badge>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Designed for Bihar's UG Students</h2>
            <p className="text-slate-500">We understand the local university ecosystem and have built a programme that truly fits your academic calendar and needs.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { i: <Zap className="text-blue-600" />, t: "UGC & NEP-2020 Compliant", d: "Our curriculum is structured under CBCS / CCFUP guidelines with 4 academic credits, recognised across Bihar." },
              { i: <Clock className="text-green-600" />, t: "120-Hour Programme", d: "Structured training with live classes, notes, and quizzes — all tracked in your personal student dashboard." },
              { i: <ShieldCheck className="text-amber-600" />, t: "Verifiable Certificates", d: "Every certificate has a unique ID and QR code. Employers can verify it instantly on our portal — no fakes possible." },
              { i: <Target className="text-purple-600" />, t: "Affordable Fee", d: "Transparent pricing (₹400-₹500) with special discounts for BNMU and Purnea University students." },
              { i: <Smartphone className="text-pink-600" />, t: "100% Online & Flexible", d: "Attend classes on Google Meet from your phone. Access recordings and study materials anytime, anywhere." },
              { i: <UserCheck className="text-indigo-600" />, t: "Dedicated Mentor Support", d: "Assigned domain mentors guide you via WhatsApp and live sessions. Get feedback on all your assessments." }
            ].map((f, i) => (
              <Card key={i} className="p-8 hover:shadow-xl transition-all border-none group">
                <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {f.i}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.t}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Programs Section */}
      <section id="programs" className="py-20 bg-white">
        <div className="container mx-auto px-6 text-center">
          <Badge className="mb-4">Programmes</Badge>
          <h2 className="text-3xl md:text-4xl font-black mb-16">Available for All UG Streams</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {["B.A.", "B.Sc.", "B.Com."].map((p, i) => (
              <Card key={i} className={`p-6 hover:shadow-lg transition-all border-slate-100 ${i === 1 ? 'ring-2 ring-primary bg-primary/5 shadow-xl' : ''}`}>
                <div className="text-3xl mb-4">
                  {["🎨", "🔬", "📊"][i]}
                </div>
                <h3 className="text-xl font-black mb-2">{p}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">15+ Domains</p>
                <Button variant={i === 1 ? "hero" : "outline"} size="sm" className="w-full" onClick={() => navigate("/register")}>
                  View Domains
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-slate-50 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">How It Works — 4 Simple Steps</h2>
            <p className="text-slate-500">From registration to a verified certificate in easy steps.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary/40 to-primary/10" />
            {[
              { n: "1", t: "Register", d: "Fill form with academic details and pick your domain." },
              { n: "2", t: "Pay & Offer", d: "Pay registration fee and get your offer letter instantly." },
              { n: "3", t: "Train", d: "Attend live classes and complete online quizzes." },
              { n: "4", t: "Get Certificate", d: "Download your verifiable digital certificate." }
            ].map((s, i) => (
              <div key={i} className="text-center relative z-10">
                <div className="size-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-black mx-auto mb-6 shadow-xl shadow-primary/20">
                  {s.n}
                </div>
                <h3 className="font-bold mb-2">{s.t}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Universities */}
      <section id="universities" className="py-20 bg-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">11+ Universities Covered</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">We are recognised by and partner with top universities across Bihar to deliver academic credits.</p>
          <div className="relative mt-12 group">
            <div 
              ref={scrollRef}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="flex gap-6 overflow-x-auto pb-10 flex-nowrap no-scrollbar cursor-grab active:cursor-grabbing"
            >
              {unis.length > 0 ? unis.map((u) => {
                const abbr = u.name.match(/\((.*?)\)/)?.[1] || u.name.split(" ")[0].substring(0, 4).toUpperCase();
                return (
                  <div key={u.id} className="flex-shrink-0 w-[300px] px-6 py-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/20 transition-all cursor-default group/item text-left">
                    <div className="flex items-center gap-4 mb-4">
                      {u.logo_url ? (
                        <img src={u.logo_url} alt={u.name} className="size-14 rounded-xl object-contain bg-slate-50 p-1.5 group-hover/item:scale-110 transition-transform shadow-sm" />
                      ) : (
                        <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xl group-hover/item:scale-110 transition-transform">{abbr}</div>
                      )}
                    </div>
                    <p className="text-[15px] font-black text-slate-800 leading-tight h-12 line-clamp-2 mb-2">{u.name}</p>
                    <div className="flex items-center gap-2">
                      <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Partner University</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="w-full py-10 text-slate-400 font-medium italic">Loading universities...</div>
              )}
            </div>
            <div className="absolute left-0 top-0 bottom-10 w-20 bg-gradient-to-r from-white via-white/40 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-10 w-20 bg-gradient-to-l from-white via-white/40 to-transparent pointer-events-none" />
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <ArrowRight className="size-3 animate-pulse" /> Scroll to explore
          </div>
          <p className="mt-12 text-sm text-slate-400 flex items-center justify-center gap-2">
            <ShieldCheck className="size-4" /> UGC Internship Guidelines 2023 & NEP-2020 Compliant
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-50" id="faq">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black">Frequently Asked Questions</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((f, i) => (
              <Card key={i} className="overflow-hidden border-none shadow-sm">
                <button className="w-full p-5 text-left flex justify-between items-center group" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-bold text-slate-800">{f.q}</span>
                  <ChevronDown className={`size-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all ${openFaq === i ? 'max-h-40 p-5 pt-0 border-t border-slate-50' : 'max-h-0'}`}>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.a}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-slate-900 to-primary text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-black mb-6">Ready to Start Your Internship?</h2>
          <p className="text-lg opacity-80 mb-10 max-w-2xl mx-auto">Join 12,000+ students who have already earned their verified internship certificate with EzyIntern.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-12">
          {[
            { t: "MCA Registered", c: "bg-purple-500/10 text-purple-400 border-purple-500/20", img: "mca_logo.png" },
            { t: "MSME Certified", c: "bg-green-500/10 text-green-400 border-green-500/20", img: "msme_logo.png" },
            { t: "ISO 9001:2015", c: "bg-blue-500/10 text-blue-400 border-blue-500/20", img: "iso_logo.png" },
            { t: "AICTE Registered", c: "bg-orange-500/10 text-orange-400 border-orange-500/20", img: "aicte_logo.png" },
            { t: "UGC Compliant", c: "bg-pink-500/10 text-pink-400 border-pink-500/20", img: "ugc_logo.png" }
          ].map((b, i) => (
            <div key={i} className={`flex flex-col items-center justify-center p-6 rounded-2xl border backdrop-blur-sm transition-all hover:scale-105 ${b.c}`}>
              <div className="size-12 flex items-center justify-center p-2 bg-white rounded-xl mb-4 shadow-sm">
                <img src={`/certifications/${b.img}`} alt={b.t} className="max-h-full max-w-full object-contain" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-center leading-tight">{b.t}</span>
            </div>
          ))}
        </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default Index;
