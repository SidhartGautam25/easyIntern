import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle2, XCircle, ArrowLeft, Award, AlertTriangle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function AssignmentResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<any>(null);
  
  const scorecardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return navigate("/login");

        const { data: submission, error: subErr } = await supabase
          .from("assignment_submissions")
          .select("*, assignments(*), auth:student_id(email)")
          .eq("assignment_id", id)
          .eq("student_id", session.user.id)
          .maybeSingle();

        if (subErr || !submission) {
          toast.error("Result not found. Have you completed this assignment?");
          navigate("/dashboard");
          return;
        }

        const { data: questions } = await supabase
          .from("assignment_questions")
          .select("*")
          .eq("assignment_id", id)
          .order("order_index", { ascending: true });

        const { data: student } = await supabase.from("students").select("full_name").eq("id", session.user.id).maybeSingle();

        setData({
          submission,
          assignment: submission.assignments,
          questions: questions || [],
          studentName: student?.full_name || submission.auth?.email || "Student"
        });

      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load result");
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [id, navigate]);

  const downloadScorecard = async () => {
    if (!scorecardRef.current) return;
    setGenerating(true);

    try {
      const clone = scorecardRef.current.cloneNode(true) as HTMLElement;
      // We will render it off-screen temporarily for a clean capture
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "-9999px";
      wrapper.style.left = "-9999px";
      wrapper.style.width = "210mm"; // A4 width
      wrapper.style.backgroundColor = "white";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(clone, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Scorecard_${data.assignment.title.replace(/\s+/g, '_')}.pdf`);
      
      document.body.removeChild(wrapper);
      toast.success("Scorecard downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  const downloadQuestionSet = () => {
    if (!data) return;
    let text = `${data.assignment.title}\nTotal Marks: ${data.assignment.total_marks}\n\n`;
    data.questions.forEach((q: any, i: number) => {
      text += `Q${i + 1}. ${q.question_text} [${q.marks} Marks]\n`;
      q.options.forEach((opt: string, optIdx: number) => {
        text += `  ${String.fromCharCode(65 + optIdx)}. ${opt}\n`;
      });
      text += `Correct Answer: ${q.options[q.correct_option_index]}\n\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Questions_${data.assignment.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const { submission, assignment, questions, studentName } = data;
  const percentage = Math.round((submission.score / assignment.total_marks) * 100);
  
  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B";
  else if (percentage >= 60) grade = "C";
  else if (percentage >= 50) grade = "D";

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="container max-w-5xl mx-auto space-y-8">
        
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Scorecard Preview Component (Also used for PDF) */}
          <div className="lg:col-span-1 space-y-6">
            <div 
              ref={scorecardRef} 
              className="bg-white border-4 border-slate-900 rounded-3xl p-8 relative overflow-hidden shadow-2xl"
              style={{ minHeight: "500px" }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Award className="size-40" />
              </div>
              <div className="relative z-10 flex flex-col h-full items-center text-center">
                <img src="/logo.png" alt="EzyIntern" className="h-10 mb-8" />
                
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground mb-2">Official Scorecard</h2>
                <h1 className="text-2xl font-bold text-slate-900 mb-6">{assignment.title}</h1>
                
                <div className="size-32 rounded-full border-8 flex items-center justify-center mb-6 shadow-inner mx-auto bg-slate-50" 
                     style={{ borderColor: submission.is_passed ? '#22c55e' : '#ef4444' }}>
                  <div className="text-center">
                    <span className="text-3xl font-black">{percentage}%</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-left text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase font-bold">Score</p>
                      <p className="font-bold text-lg">{submission.score} / {assignment.total_marks}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase font-bold">Grade</p>
                      <p className="font-bold text-lg">{grade}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs uppercase font-bold">Candidate</p>
                      <p className="font-bold">{studentName}</p>
                    </div>
                  </div>
                </div>

                <div className={`mt-auto w-full py-3 rounded-lg font-bold text-sm ${submission.is_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {submission.is_passed ? 'PASS' : 'FAIL'}
                </div>
                
                <p className="text-[10px] text-muted-foreground mt-4">Verified by EzyIntern AI Assessment System</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button className="w-full gap-2 h-12 shadow-lg" onClick={downloadScorecard} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Scorecard
              </Button>
              <Button variant="outline" className="w-full gap-2 h-12" onClick={downloadQuestionSet}>
                <Download className="size-4" /> Download Question Set
              </Button>
            </div>
            
            {submission.warnings_received > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-bold">Proctoring Note</p>
                  <p>You received {submission.warnings_received} warning(s) during this assessment.</p>
                </div>
              </div>
            )}
          </div>

          {/* Question Review List */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xl font-bold mb-4">Detailed Performance Analysis</h3>
            
            {questions.map((q: any, idx: number) => {
              const selectedIdx = submission.answers[q.id];
              const isCorrect = selectedIdx === q.correct_option_index;
              const isUnanswered = selectedIdx === undefined;

              return (
                <Card key={q.id} className={`p-6 border-l-4 shadow-sm ${isCorrect ? 'border-l-green-500' : isUnanswered ? 'border-l-slate-400' : 'border-l-red-500'}`}>
                  <div className="flex gap-4">
                    <div className="shrink-0 mt-1">
                      {isCorrect ? <CheckCircle2 className="size-6 text-green-500" /> : 
                       isUnanswered ? <div className="size-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-400 font-bold">?</div> : 
                       <XCircle className="size-6 text-red-500" />}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900 leading-relaxed">
                            <span className="text-muted-foreground mr-2">Q{idx + 1}.</span> {q.question_text}
                          </h4>
                          <span className="shrink-0 text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-500 ml-4">
                            {isCorrect ? q.marks : 0} / {q.marks}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelectedOpt = selectedIdx === optIdx;
                          const isCorrectOpt = q.correct_option_index === optIdx;
                          
                          let bgClass = "bg-slate-50 border-transparent text-slate-600";
                          if (isCorrectOpt) {
                            bgClass = "bg-green-50 border-green-200 text-green-800 font-medium";
                          } else if (isSelectedOpt && !isCorrectOpt) {
                            bgClass = "bg-red-50 border-red-200 text-red-800 font-medium";
                          }

                          return (
                            <div key={optIdx} className={`p-3 rounded-lg border text-sm flex items-center gap-3 ${bgClass}`}>
                              <span className="font-mono text-xs uppercase opacity-50">{String.fromCharCode(65 + optIdx)}</span>
                              <span>{opt}</span>
                              {isCorrectOpt && <CheckCircle2 className="size-4 ml-auto text-green-500" />}
                              {isSelectedOpt && !isCorrectOpt && <XCircle className="size-4 ml-auto text-red-500" />}
                            </div>
                          );
                        })}
                      </div>
                      
                      {isUnanswered && (
                        <p className="text-sm text-slate-500 italic">You did not answer this question.</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
