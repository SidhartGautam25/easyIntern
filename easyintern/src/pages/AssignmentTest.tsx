import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, Clock, Camera, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_WARNINGS = 3;

export default function AssignmentTest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android/i.test(userAgent) || /iPad|iPhone|iPod/.test(userAgent) || window.innerWidth < 768;
  });
  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  
  // Proctoring States
  const [warnings, setWarnings] = useState(0);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let timerId: any;
    if (timeLeft !== null && timeLeft > 0) {
      timerId = setInterval(() => setTimeLeft((prev) => (prev as number) - 1), 1000);
    } else if (timeLeft === 0) {
      toast.error("Time is up! Auto-submitting...");
      handleSubmit();
    }
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const loadAssignment = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate("/login");

      // Check if already submitted
      const { data: existing } = await supabase.from("assignment_submissions").select("id").eq("assignment_id", id).eq("student_id", session.user.id).maybeSingle();
      if (existing) {
        toast.info("You have already submitted this assignment.");
        navigate(`/assignment/${id}/result`);
        return;
      }

      const { data: assgn, error: aErr } = await supabase.from("assignments").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      if (aErr || !assgn) {
        toast.error("Assignment not found or inactive.");
        navigate("/dashboard");
        return;
      }

      const { data: qs, error: qErr } = await supabase.from("assignment_questions").select("*").eq("assignment_id", id).order("order_index", { ascending: true });
      if (qErr) throw qErr;

      setAssignment(assgn);
      setQuestions(qs || []);
      setTimeLeft(assgn.duration_minutes * 60);

      // Start Proctoring Media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        toast.error("Camera/Mic access is required to take this assignment.");
        navigate("/dashboard");
        return;
      }

      // Enter Fullscreen
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          toast.warning("Please enable full screen mode manually.");
        });
      }

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load assignment");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignment();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning("Tab switching detected. Do not leave the test environment.");
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerWarning("Copy-pasting is strictly prohibited.");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerWarning("Right-clicking is disabled.");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      
      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.log(e));
      }
    };
  }, []);

  const triggerWarning = (msg: string) => {
    setWarnings(prev => {
      const newCount = prev + 1;
      setWarningMessage(msg);
      setIsWarningOpen(true);
      
      if (newCount >= MAX_WARNINGS) {
        toast.error(`Maximum warnings reached (${MAX_WARNINGS}). Auto-submitting assignment.`);
        handleSubmit(true, newCount);
      }
      return newCount;
    });
  };

  const handleSubmit = async (isForced = false, finalWarnings = warnings) => {
    if (submitting) return;
    setSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Evaluate Score
      let score = 0;
      questions.forEach(q => {
        if (answers[q.id] === q.correct_option_index) {
          score += q.marks;
        }
      });
      
      const is_passed = score >= (assignment?.passing_marks || 0);

      const { error } = await supabase.from("assignment_submissions").insert({
        assignment_id: id,
        student_id: session.user.id,
        answers,
        score,
        is_passed,
        warnings_received: finalWarnings,
        cheating_detected: finalWarnings > 0
      });

      if (error) throw error;
      
      toast.success("Assignment submitted successfully.");
      
      // Stop media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.log(e));
      }
      
      navigate(`/assignment/${id}/result`);
      
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <AlertTriangle className="size-16 text-destructive mb-6" />
        <h1 className="text-2xl font-bold mb-4">Mobile Devices Not Supported</h1>
        <p className="text-slate-400 mb-8 max-w-md">
          To ensure strict proctoring and a secure testing environment, this assessment can only be taken on a PC or Laptop. Please switch to a computer to continue.
        </p>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => navigate("/dashboard")}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="size-10 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      <header className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-50">
        <div>
          <h1 className="font-bold text-xl">{assignment?.title}</h1>
          <p className="text-sm text-muted-foreground">{questions.length} Questions • {assignment?.total_marks} Marks</p>
        </div>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 font-bold px-4 py-2 rounded-full ${warnings > 0 ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-700'}`}>
            <AlertTriangle className="size-4" /> Warnings: {warnings}/{MAX_WARNINGS}
          </div>
          <div className="flex items-center gap-2 font-mono text-xl bg-slate-900 text-white px-4 py-2 rounded-full shadow-inner">
            <Clock className="size-5" /> {timeLeft !== null ? formatTime(timeLeft) : '00:00'}
          </div>
          <Button onClick={() => handleSubmit(false)} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Submit
          </Button>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl py-8 pb-32">
        <div className="space-y-8">
          {questions.map((q, idx) => (
            <Card key={q.id} className="p-6 shadow-sm border-t-4 border-t-transparent hover:border-t-primary transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg"><span className="text-muted-foreground mr-2">Q{idx + 1}.</span> {q.question_text}</h3>
                <span className="text-xs font-bold bg-muted px-2 py-1 rounded">[{q.marks} Marks]</span>
              </div>
              <div className="space-y-3">
                {q.options.map((opt: string, optIdx: number) => {
                  const isSelected = answers[q.id] === optIdx;
                  return (
                    <div 
                      key={optIdx} 
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3
                        ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted hover:border-slate-300 hover:bg-slate-50'}
                      `}
                    >
                      <div className={`size-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-slate-300'}`}>
                        {isSelected && <div className="size-2.5 rounded-full bg-primary" />}
                      </div>
                      <span className={`${isSelected ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{opt}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* Camera Feed */}
      <div className="fixed bottom-6 right-6 w-48 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-900 bg-black z-50">
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
          <span className="size-1.5 rounded-full bg-white"></span> REC
        </div>
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-xs text-center py-1 flex items-center justify-center gap-1">
          <Camera className="size-3" /> AI Proctor Active
        </div>
      </div>

      <Dialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <DialogContent className="sm:max-w-md border-destructive/20 border-2 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Warning Received!
            </DialogTitle>
            <DialogDescription className="text-base text-slate-700 font-medium py-4">
              {warningMessage}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 p-3 rounded-lg text-sm text-destructive font-bold text-center">
            You have received {warnings} out of {MAX_WARNINGS} warnings.<br/>
            Your assignment will be automatically submitted if you reach the limit.
          </div>
          <DialogFooter className="sm:justify-center">
            <Button variant="default" className="w-full sm:w-auto" onClick={() => setIsWarningOpen(false)}>
              I Understand, Continue Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
