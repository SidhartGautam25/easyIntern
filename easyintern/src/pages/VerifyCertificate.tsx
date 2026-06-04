import { useRef, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search, CheckCircle2, XCircle, Loader2, Award, User, Calendar, ShieldCheck, Download, MapPin, Phone, Mail, Globe } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const VerifyCertificate = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cert, setCert] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [error, setError] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const handleVerify = async () => {
    const q = query.trim();
    if (!q) return toast.error("Please enter a Certificate ID, Email, or Phone Number");
    setLoading(true);
    setError(false);
    setCert(null);
    setStudent(null);

    try {
      let certData: any = null;
      let studentData: any = null;

      // 1. Try by Certificate ID
      const { data: byId } = await supabase
        .from("certificates")
        .select("*")
        .eq("certificate_id", q)
        .maybeSingle();

      if (byId) {
        certData = byId;
      } else {
        // 2. Try by Email or Phone in students table
        const { data: foundStudent } = await supabase
          .from("students")
          .select("*")
          .or(`email.ilike.${q},contact_number.eq.${q}`)
          .maybeSingle();

        if (foundStudent) {
          studentData = foundStudent;
          const { data: byCert } = await supabase
            .from("certificates")
            .select("*")
            .eq("user_id", foundStudent.id)
            .maybeSingle();
          certData = byCert;
        }
      }

      // 3. If cert found but no student yet, fetch student
      if (certData && !studentData) {
        const { data: s } = await supabase
          .from("students")
          .select("*")
          .eq("id", certData.user_id)
          .maybeSingle();
        studentData = s;
      }

      if (certData) {
        setCert(certData);
        setStudent(studentData);
        toast.success("Certificate verified successfully!");
      } else {
        setError(true);
        toast.error("No certificate found for this query.");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadCert = async () => {
    if (!certRef.current) return;
    setGenerating(true);
    try {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:794px;background:white;";
      const clone = certRef.current.cloneNode(true) as HTMLElement;
      clone.style.width = "794px";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`EzyIntern_Certificate_${cert?.certificate_id || student?.full_name?.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificate downloaded!");
      document.body.removeChild(wrapper);
    } catch (e) {
      toast.error("Download failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteNav />
      <main className="flex-1 py-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Search className="size-8 text-primary" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-4">Certificate Verification</h1>
            <p className="text-slate-500 max-w-xl mx-auto">
              Verify the authenticity of EzyIntern certificates. Enter the Certificate ID, registered Email, or Phone Number.
            </p>
          </div>

          <Card className="p-8 md:p-12 shadow-elegant border-none mb-12">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Certificate ID / Email / Phone Number"
                  className="h-14 pl-12 text-lg font-bold border-2 focus:border-primary/50"
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
              </div>
              <Button size="lg" className="h-14 px-10 font-bold text-lg" onClick={handleVerify} disabled={loading}>
                {loading ? <Loader2 className="size-5 animate-spin" /> : "Verify Now"}
              </Button>
            </div>
          </Card>

          {/* Verified Result */}
          {cert && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Status Banner */}
              <div className="bg-green-600 p-5 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CheckCircle2 className="size-8 shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold">Authentic Certificate</h3>
                    <p className="text-sm opacity-80">Verified and issued by EzyIntern — Certificate ID: {cert.certificate_id}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="gap-2 shrink-0 font-bold"
                  onClick={downloadCert}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Download Certificate
                </Button>
              </div>

              {/* Quick Info Cards */}
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: User, label: "Intern Name", value: student?.full_name || cert.student_name },
                  { icon: Award, label: "Program", value: student?.course || cert.internship_name },
                  { icon: Calendar, label: "Duration", value: student?.internship_duration || cert.duration || "—" },
                  { icon: ShieldCheck, label: "Status", value: cert.status || "Active", green: true },
                ].map(({ icon: Icon, label, value, green }) => (
                  <Card key={label} className="p-4 border-none shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-primary shrink-0">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">{label}</p>
                        <p className={`font-bold text-sm ${green ? 'text-green-600' : ''}`}>{value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Full Certificate Preview */}
              <div className="bg-slate-200 p-6 rounded-2xl">
                <p className="text-xs font-bold uppercase text-slate-500 mb-4 text-center tracking-widest">Certificate Preview</p>
                <div className="flex justify-center overflow-x-auto">
                  <div
                    ref={certRef}
                    className="w-full max-w-[794px] bg-white shadow-2xl p-[12mm] md:p-[15mm] text-slate-900 font-sans leading-snug min-h-[297mm] relative overflow-hidden flex flex-col"
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

                    {/* Title */}
                    <div className="relative z-10 text-center space-y-1 mb-6">
                      <h1 className="text-2xl font-bold text-[#5AA3E6] mb-4">Certificate of Completion</h1>
                      <p className="text-[13px]">This is to certify that</p>
                      <p className="text-lg font-bold">Mr./Ms. {student?.full_name || cert.student_name},</p>
                      <p className="text-[13px]">S/o or D/o</p>
                      <p className="text-lg font-bold">{student?.parent_name || student?.father_name || "[Father's/Guardian's Name]"}</p>
                      <p className="text-[13px]">bearing University Registration/Enrolment No. <span className="font-bold">{student?.registration_id || "—"}</span></p>
                      <p className="text-[13px]">of</p>
                      <p className="text-lg font-bold">{student?.college_name || "—"}</p>
                      <p className="text-[13px]">Session {student?.academic_session || "2024-25"}, with Major in <span className="font-bold">{student?.degree || "—"}</span>,</p>
                      <p className="text-[13px]">has successfully completed his/her internship with our organisation.</p>
                    </div>

                    {/* Table 1 */}
                    <div className="relative z-10 w-full border border-[#5AA3E6] mb-6 text-[12px]">
                      {[
                        ["Internship Domain", student?.course || cert.internship_name || "—"],
                        ["Internship Duration", cert.duration || student?.internship_duration || "—"],
                        ["Total Hours Completed", "120 Hours"],
                        ["Mode of Internship", "Online"],
                        ["Overall Attendance Percentage", "100%"],
                        ["Overall Marks Percentage", "100%"],
                      ].map(([label, value], i, arr) => (
                        <div key={i} className={`flex ${i < arr.length - 1 ? 'border-b border-[#5AA3E6]' : ''}`}>
                          <div className="w-[40%] font-bold p-2 border-r border-[#5AA3E6] flex items-center justify-center text-center bg-white">{label}</div>
                          <div className="w-[60%] p-2 flex items-center justify-center text-center bg-white/60">{value}</div>
                        </div>
                      ))}
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

                    {/* Footer with QR */}
                    <div className="-mx-[12mm] md:-mx-[15mm] -mb-[12mm] md:-mb-[15mm] relative z-10 mt-auto">
                      <div className="relative">
                        <img src="/cert-footer.png" alt="Certificate Footer" className="w-full h-auto block" onError={(e) => {
                          (e.target as HTMLImageElement).src = '/offer-letter-footer.png';
                        }} />
                        <div className="absolute bottom-40 right-6 md:right-8 flex items-center gap-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-[#5AA3E6]/20 shadow-sm z-20">
                          <div className="relative size-[68px] shrink-0 border border-slate-200 p-1 bg-white rounded-lg">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.ezyintern.com/verify?id=${cert.certificate_id}`}
                              alt="QR Code"
                              className="w-full h-full"
                              crossOrigin="anonymous"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-[#5AA3E6] text-white font-black text-[9px] px-1 py-0.5 rounded-sm shadow-sm leading-none">EI</div>
                            </div>
                          </div>
                          <div className="text-[11px] leading-snug space-y-1">
                            <p className="text-slate-800 flex items-center">
                              <span className="font-bold w-24">Certificate ID</span>
                              <span className="font-black mx-1">:</span>
                              <span className="text-[#5AA3E6] font-black tracking-wide">{cert.certificate_id}</span>
                            </p>
                            <p className="text-slate-800 flex items-center">
                              <span className="font-bold w-24">Date of Issue</span>
                              <span className="font-black mx-1">:</span>
                              <span className="text-[#5AA3E6] font-black">{new Date(cert.created_at || Date.now()).toLocaleDateString('en-GB')}</span>
                            </p>
                            <div className="pt-1 mt-1 border-t border-slate-200">
                              <p className="text-[9px] text-slate-600 font-bold mb-0.5">To verify this certificate:</p>
                              <p className="text-[10px] text-[#5AA3E6] font-black tracking-wide">www.ezyintern.com/certificate-verification</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <Card className="p-10 text-center border-none shadow-elegant bg-red-50 animate-fade-in-up">
              <XCircle className="size-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-900 mb-2">Verification Failed</h3>
              <p className="text-red-700">No certificate found for the provided ID, email, or phone number. Please double-check and try again, or contact support.</p>
            </Card>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default VerifyCertificate;
