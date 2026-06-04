import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Sparkles, Plus, CheckCircle2, XCircle, Pencil, Save, Trash2,
  ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_option_index: number;
  marks: number;
}

interface AIAssignmentBuilderProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AIAssignmentBuilder({ open, onClose, onSaved }: AIAssignmentBuilderProps) {
  // Step 1: Config
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");
  const [difficulty, setDifficulty] = useState("medium");
  const [marksPerQ, setMarksPerQ] = useState("4");
  const [passingPercent, setPassingPercent] = useState("50");
  const [duration, setDuration] = useState("20");

  // Step 2: Generated questions (editable)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  // Status
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  const generateQuestions = async () => {
    if (!prompt.trim()) return toast.error("Please enter a topic or prompt.");
    if (!title.trim()) return toast.error("Please enter an assignment title.");

    if (!GEMINI_KEY) {
      setApiKeyMissing(true);
      return;
    }

    setGenerating(true);

    const systemPrompt = `You are an expert educational assessment designer. Generate exactly ${numQuestions} multiple-choice questions (MCQs) based on the following topic.

Topic/Prompt: "${prompt}"
Difficulty: ${difficulty}
Format: Each question must have exactly 4 options (A, B, C, D), with only one correct answer.

Respond ONLY with a valid JSON array. No explanation, no markdown, no code fences. Just the raw JSON array.

Schema for each object:
{
  "question_text": "The full question",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_option_index": 0  // 0-indexed: 0=A, 1=B, 2=C, 3=D
}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
          })
        }
      );

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody?.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Strip markdown fences if Gemini wraps in ```json
      const cleaned = rawText.replace(/```json|```/gi, "").trim();
      const parsed: GeneratedQuestion[] = JSON.parse(cleaned);

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid response format from AI.");

      const withMarks = parsed.map(q => ({ ...q, marks: parseInt(marksPerQ) }));
      setQuestions(withMarks);
      setExpandedIdx(0);
      setStep(2);
      toast.success(`${withMarks.length} questions generated successfully!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate questions. Check your Gemini API key.");
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (idx: number, field: keyof GeneratedQuestion, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const newOpts = [...q.options];
      newOpts[optIdx] = value;
      return { ...q, options: newOpts };
    }));
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const saveAssignment = async () => {
    if (questions.length === 0) return toast.error("No questions to save.");
    setSaving(true);
    try {
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const passingMarks = Math.ceil(totalMarks * (parseInt(passingPercent) / 100));

      const { data: assgn, error: aErr } = await supabase
        .from("assignments")
        .insert({
          title: title.trim(),
          description: description.trim() || prompt.trim(),
          duration_minutes: parseInt(duration),
          total_marks: totalMarks,
          passing_marks: passingMarks,
          is_active: true
        })
        .select("id")
        .single();

      if (aErr) throw aErr;

      const questionsToInsert = questions.map((q, idx) => ({
        assignment_id: assgn.id,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        marks: q.marks,
        order_index: idx + 1
      }));

      const { error: qErr } = await supabase.from("assignment_questions").insert(questionsToInsert);
      if (qErr) throw qErr;

      toast.success("Assignment saved and published to students!");
      onSaved();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setPrompt(""); setTitle(""); setDescription(""); setQuestions([]);
    setApiKeyMissing(false);
    onClose();
  };

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="size-6 text-primary" />
            AI Assignment Builder
          </DialogTitle>
          <DialogDescription>
            Generate MCQ questions using AI and publish them as a proctored assessment for students.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-3 mb-6">
          {[
            { n: 1, label: "Configure" },
            { n: 2, label: "Review & Edit" },
          ].map(({ n, label }) => (
            <div key={n} className={`flex items-center gap-2 ${n < step ? 'text-primary' : n === step ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
              <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${n < step ? 'bg-primary text-white border-primary' : n === step ? 'border-primary text-primary' : 'border-slate-200 text-slate-400'}`}>
                {n < step ? <CheckCircle2 className="size-4" /> : n}
              </div>
              <span className="text-sm hidden sm:block">{label}</span>
              {n < 2 && <div className="w-8 h-px bg-slate-200 mx-1" />}
            </div>
          ))}
        </div>

        {apiKeyMissing && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex gap-3">
            <AlertTriangle className="size-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-orange-800 text-sm">Gemini API Key Required</p>
              <p className="text-orange-700 text-sm mt-1">
                Open your <code className="bg-orange-100 px-1 rounded">.env</code> file and set{" "}
                <code className="bg-orange-100 px-1 rounded">VITE_GEMINI_API_KEY="your-key-here"</code>, then restart the dev server.
                Get a free key at{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-bold">
                  aistudio.google.com
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Configuration */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-bold">Assignment Title *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Python Fundamentals Assessment" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-bold">Topic / AI Prompt *</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Python programming basics: variables, loops, functions, and data types. Focus on beginner level concepts."
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-bold">Description (optional)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description for students..." />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">No. of Questions</Label>
                <Select value={numQuestions} onValueChange={setNumQuestions}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 25].map(n => <SelectItem key={n} value={String(n)}>{n} Questions</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Marks / Question</Label>
                <Select value={marksPerQ} onValueChange={setMarksPerQ}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 4, 5, 10].map(n => <SelectItem key={n} value={String(n)}>{n} Mark{n > 1 ? 's' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase text-slate-500">Duration (mins)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30, 45, 60].map(n => <SelectItem key={n} value={String(n)}>{n} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase text-slate-500">Passing Percentage</Label>
              <Select value={passingPercent} onValueChange={setPassingPercent}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[33, 40, 50, 60, 75].map(n => <SelectItem key={n} value={String(n)}>{n}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
              <span>📋 <b>{numQuestions} questions</b></span>
              <span>🎯 <b>{parseInt(numQuestions) * parseInt(marksPerQ)} total marks</b></span>
              <span>⏱ <b>{duration} minutes</b></span>
              <span>✅ <b>Pass at {passingPercent}%</b></span>
            </div>
          </div>
        )}

        {/* Step 2: Review & Edit */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-lg">{title}</p>
                <p className="text-sm text-slate-500">{questions.length} questions • {totalMarks} total marks • {duration} min</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setStep(1)}>
                <Pencil className="size-3.5" /> Edit Config
              </Button>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <Card key={idx} className={`border-l-4 overflow-hidden transition-all ${q.correct_option_index >= 0 ? 'border-l-green-400' : 'border-l-red-400'}`}>
                  <div
                    className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    <span className="text-xs font-black bg-slate-100 text-slate-500 rounded-full size-6 flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                    <p className="flex-1 font-medium text-slate-800 text-sm leading-relaxed">{q.question_text}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{q.marks}M</Badge>
                      {expandedIdx === idx ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                    </div>
                  </div>

                  {expandedIdx === idx && (
                    <div className="px-4 pb-4 space-y-4 border-t bg-slate-50">
                      <div className="pt-3 space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Question Text</Label>
                        <textarea
                          className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm min-h-[60px]"
                          value={q.question_text}
                          onChange={e => updateQuestion(idx, 'question_text', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Options (click radio to mark correct)</Label>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${q.correct_option_index === optIdx ? 'border-green-400 bg-green-50' : 'border-slate-100 bg-white'}`}>
                            <button
                              onClick={() => updateQuestion(idx, 'correct_option_index', optIdx)}
                              className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${q.correct_option_index === optIdx ? 'border-green-500' : 'border-slate-300'}`}
                            >
                              {q.correct_option_index === optIdx && <div className="size-2.5 rounded-full bg-green-500" />}
                            </button>
                            <span className="text-xs font-mono font-bold text-slate-400">{String.fromCharCode(65 + optIdx)}</span>
                            <Input
                              value={opt}
                              onChange={e => updateOption(idx, optIdx, e.target.value)}
                              className="flex-1 h-8 text-sm border-none bg-transparent focus-visible:ring-0 p-0"
                            />
                            {q.correct_option_index === optIdx && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs font-bold uppercase text-slate-500">Marks:</Label>
                          <Select value={String(q.marks)} onValueChange={v => updateQuestion(idx, 'marks', parseInt(v))}>
                            <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{[1, 2, 4, 5, 10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 gap-1.5" onClick={() => deleteQuestion(idx)}>
                          <Trash2 className="size-3.5" /> Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Button variant="outline" className="w-full border-dashed gap-2 text-slate-500"
              onClick={() => setQuestions(prev => [...prev, { question_text: "New question...", options: ["Option A", "Option B", "Option C", "Option D"], correct_option_index: 0, marks: parseInt(marksPerQ) }])}>
              <Plus className="size-4" /> Add Question Manually
            </Button>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t mt-4">
          {step === 1 ? (
            <Button className="w-full sm:w-auto gap-2 h-11 text-base" onClick={generateQuestions} disabled={generating}>
              {generating ? <><Loader2 className="size-4 animate-spin" /> Generating with AI...</> : <><Sparkles className="size-4" /> Generate Questions</>}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={generateQuestions} disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Regenerate
              </Button>
              <Button className="w-full sm:w-auto gap-2 h-11 text-base bg-green-600 hover:bg-green-700" onClick={saveAssignment} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save & Publish to Students
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
