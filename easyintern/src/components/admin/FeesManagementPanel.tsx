import { useCallback, useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 15;
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, IndianRupee, Pencil, Building2 } from "lucide-react";
import {
  buildCollegeFeeUpdatePayload,
  resolveStudentFeeBreakdown,
  type CollegeWithFees,
} from "@/lib/collegeFees";
import { formatRupees } from "@/lib/feeRules";

type UniversityRow = { id: string; name: string };

const COLLEGES_SELECT_WITH_FEES =
  "id, name, university_id, pisa_fee, fee_base_paise, fee_processing_paise, show_fee_breakdown, fees_managed, universities(name)";

const COLLEGES_SELECT_BASIC =
  "id, name, university_id, pisa_fee, universities(name)";

function isMissingFeeColumnsError(err: { code?: string; message?: string; details?: string } | null): boolean {
  if (!err) return false;
  const msg = `${err.message || ""} ${err.details || ""}`.toLowerCase();
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    msg.includes("fee_base_paise") ||
    msg.includes("fee_processing_paise") ||
    msg.includes("show_fee_breakdown") ||
    msg.includes("fees_managed") ||
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find")))
  );
}

export function FeesManagementPanel({
  onLogAction,
}: {
  onLogAction?: (
    action: string,
    entity: string,
    description: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** True when fee columns are not in DB yet — list still loads via fallback query. */
  const [needsMigration, setNeedsMigration] = useState(false);
  const [colleges, setColleges] = useState<CollegeWithFees[]>([]);
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  /** `pick` = none selected yet; university id = show that uni's colleges; `all` = every college */
  const [uniFilter, setUniFilter] = useState<string>("pick");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editCollege, setEditCollege] = useState<CollegeWithFees | null>(null);
  const [form, setForm] = useState({
    showBreakdown: false,
    baseRupees: 500,
    processingRupees: 49,
    totalRupees: 549,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uniRes = await supabase.from("universities").select("id, name").order("name");
      if (uniRes.error) throw uniRes.error;

      let migrationRequired = false;
      let colRes = await supabase
        .from("colleges")
        .select(COLLEGES_SELECT_WITH_FEES)
        .order("name");

      if (colRes.error) {
        if (isMissingFeeColumnsError(colRes.error)) migrationRequired = true;
        colRes = await supabase
          .from("colleges")
          .select(COLLEGES_SELECT_BASIC)
          .order("name");
      }

      if (colRes.error) {
        colRes = await supabase
          .from("colleges")
          .select("*, universities(name)")
          .order("name");
      }

      if (colRes.error) throw colRes.error;

      setNeedsMigration(migrationRequired);
      setColleges((colRes.data || []) as CollegeWithFees[]);
      setUniversities(uniRes.data || []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof e.message === "string"
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to load colleges";
      toast.error(msg);
      setColleges([]);
      setUniversities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedUniversity = useMemo(
    () => universities.find((u) => u.id === uniFilter) ?? null,
    [universities, uniFilter]
  );

  const filtered = useMemo(() => {
    if (uniFilter === "pick") return [];

    const q = search.trim().toLowerCase();
    return colleges.filter((c) => {
      if (uniFilter !== "all" && c.university_id !== uniFilter) return false;
      if (!q) return true;
      const uniName = c.universities?.name?.toLowerCase() || "";
      return c.name.toLowerCase().includes(q) || uniName.includes(q);
    });
  }, [colleges, uniFilter, search]);

  const showUniversityColumn = uniFilter === "all";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginatedColleges = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(0);
  }, [uniFilter, search]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [filtered.length, page]);

  const openEdit = (college: CollegeWithFees) => {
    const uniName = college.universities?.name;
    const preview = resolveStudentFeeBreakdown(
      uniName,
      college.name,
      college,
      null,
      null
    );
    const total = (college.pisa_fee ?? preview.totalPaise) / 100;
    const processing = (college.fee_processing_paise ?? preview.gstPaise) / 100;
    const base = (college.fee_base_paise ?? preview.basePaise) / 100;
    const showBreakdown = college.fees_managed
      ? !!college.show_fee_breakdown
      : preview.hasBreakdown;

    setEditCollege(college);
    setForm({
      showBreakdown,
      baseRupees: showBreakdown ? base : total,
      processingRupees: showBreakdown ? processing : 0,
      totalRupees: total,
    });
  };

  const syncTotalFromParts = (base: number, processing: number) =>
    Math.round((base + processing) * 100) / 100;

  const previewFee = useMemo(() => {
    if (!editCollege) return null;
    const payload = buildCollegeFeeUpdatePayload({
      totalRupees: form.showBreakdown
        ? syncTotalFromParts(form.baseRupees, form.processingRupees)
        : form.totalRupees,
      baseRupees: form.baseRupees,
      processingRupees: form.processingRupees,
      showBreakdown: form.showBreakdown,
    });
    return resolveStudentFeeBreakdown(
      editCollege.universities?.name,
      editCollege.name,
      payload,
      null,
      null
    );
  }, [editCollege, form]);

  const handleSave = async () => {
    if (!editCollege) return;
    if (needsMigration) {
      toast.error("Run the fees migration in Supabase SQL Editor first (see yellow banner).");
      return;
    }
    const total = form.showBreakdown
      ? syncTotalFromParts(form.baseRupees, form.processingRupees)
      : form.totalRupees;

    if (total <= 0) {
      toast.error("Total fee must be greater than zero");
      return;
    }
    if (
      form.showBreakdown &&
      Math.abs(form.baseRupees + form.processingRupees - total) > 0.001
    ) {
      toast.error("Base + processing must equal total");
      return;
    }

    setSaving(true);
    try {
      const payload = buildCollegeFeeUpdatePayload({
        totalRupees: total,
        baseRupees: form.showBreakdown ? form.baseRupees : total,
        processingRupees: form.processingRupees,
        showBreakdown: form.showBreakdown,
      });

      const { error } = await supabase
        .from("colleges")
        .update(payload)
        .eq("id", editCollege.id);

      if (error) throw error;

      await onLogAction?.(
        "UPDATE",
        "college",
        `Updated fees for ${editCollege.name}: ₹${total}${form.showBreakdown ? ` (${form.baseRupees} + ${form.processingRupees})` : " flat"}`,
        { college_id: editCollege.id, ...payload }
      );

      toast.success(`Fees updated for ${editCollege.name}`);
      setEditCollege(null);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save fees";
      if (isMissingFeeColumnsError({ message: msg })) {
        setNeedsMigration(true);
        toast.error(
          "Run the fees migration in Supabase SQL Editor first (see yellow banner on this page)."
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const displayFee = (college: CollegeWithFees) => {
    const uniName = college.universities?.name;
    return resolveStudentFeeBreakdown(uniName, college.name, college, null, null);
  };

  return (
    <>
      <Card className="p-6 md:p-8 border-none shadow-elegant bg-gradient-to-br from-emerald-50/40 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900">
              <IndianRupee className="size-7 text-emerald-600" />
              Fees Management
            </h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Choose a university, then edit fees for each college under it. Changes apply to new student registrations immediately.
            </p>
          </div>
          <Badge variant="secondary" className="self-start px-3 py-1 font-bold max-w-[220px] truncate">
            {uniFilter === "pick"
              ? "Select a university"
              : selectedUniversity
                ? `${filtered.length} colleges · ${selectedUniversity.name}`
                : `${filtered.length} colleges (all universities)`}
          </Badge>
        </div>

        {needsMigration && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-bold">Run the fees migration in Supabase to save edits</p>
            <p className="mt-1">
              Open <strong>Supabase → SQL Editor</strong>, paste and run{" "}
              <code className="text-xs bg-white px-1 rounded">20260519150000_college_fees_management.sql</code>{" "}
              from <code className="text-xs">supabase/migrations/</code>, then refresh this page.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 order-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                uniFilter === "pick"
                  ? "Select a university first…"
                  : "Search college name…"
              }
              disabled={uniFilter === "pick"}
              className="pl-9 h-11 rounded-xl border-slate-200"
            />
          </div>
          <div className="order-1 w-full sm:w-[min(100%,28rem)] shrink-0">
          <Select value={uniFilter} onValueChange={setUniFilter}>
            <SelectTrigger className="h-11 w-full rounded-xl font-medium">
              <SelectValue placeholder="Select university" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(20rem,70vh)]">
              <SelectItem value="pick" disabled>
                Select university
              </SelectItem>
              {universities.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
              <SelectItem value="all" className="text-muted-foreground border-t mt-1 pt-2">
                Show all universities (full list)
              </SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="rounded-2xl border bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  {showUniversityColumn && (
                    <TableHead className="font-black text-[10px] uppercase">University</TableHead>
                  )}
                  <TableHead className="font-black text-[10px] uppercase">College</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Total</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">Breakdown</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showUniversityColumn ? 5 : 4}
                      className="text-center py-10 text-muted-foreground"
                    >
                      {uniFilter === "pick"
                        ? "Select a university from the dropdown above to see its colleges and edit fees."
                        : "No colleges match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedColleges.map((c) => {
                    const fee = displayFee(c);
                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/50">
                        {showUniversityColumn && (
                          <TableCell className="text-xs font-medium text-muted-foreground max-w-[180px] truncate">
                            {c.universities?.name || "—"}
                          </TableCell>
                        )}
                        <TableCell className="font-bold text-sm">{c.name}</TableCell>
                        <TableCell className="font-black text-emerald-700">
                          {formatRupees(fee.totalPaise)}
                        </TableCell>
                        <TableCell>
                          {fee.hasBreakdown ? (
                            <span className="text-xs text-muted-foreground">
                              {formatRupees(fee.basePaise)} + {formatRupees(fee.gstPaise)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Flat total</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 font-bold rounded-lg"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {filtered.length > 0 && (
              <div className="p-4 bg-slate-50/80 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground font-medium">
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length} colleges
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-bold text-muted-foreground px-1">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-bold"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Dialog open={!!editCollege} onOpenChange={(open) => !open && setEditCollege(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black flex items-center gap-2">
              <Building2 className="size-5 text-emerald-600" />
              Edit college fees
            </DialogTitle>
            <DialogDescription>
              {editCollege?.name}
              {editCollege?.universities?.name ? ` · ${editCollege.universities.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between rounded-xl border p-4 bg-slate-50/50">
              <Label htmlFor="show-breakdown" className="font-bold cursor-pointer">
                Show fee breakdown to students
              </Label>
              <Switch
                id="show-breakdown"
                checked={form.showBreakdown}
                onCheckedChange={(checked) => {
                  setForm((f) => {
                    const total = checked
                      ? syncTotalFromParts(f.baseRupees, f.processingRupees)
                      : f.totalRupees;
                    return {
                      ...f,
                      showBreakdown: checked,
                      totalRupees: total,
                      baseRupees: checked ? f.baseRupees || 500 : total,
                      processingRupees: checked ? f.processingRupees || 49 : 0,
                    };
                  });
                }}
              />
            </div>

            {form.showBreakdown ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Registration / course (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.baseRupees}
                    onChange={(e) => {
                      const base = Number(e.target.value) || 0;
                      setForm((f) => ({
                        ...f,
                        baseRupees: base,
                        totalRupees: syncTotalFromParts(base, f.processingRupees),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Processing / GST (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={form.processingRupees}
                    onChange={(e) => {
                      const processing = Number(e.target.value) || 0;
                      setForm((f) => ({
                        ...f,
                        processingRupees: processing,
                        totalRupees: syncTotalFromParts(f.baseRupees, processing),
                      }));
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Total fee (₹)</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.totalRupees}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      totalRupees: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            )}

            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                Student preview
              </p>
              {previewFee?.hasBreakdown && previewFee.componentLineLabels && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{previewFee.componentLineLabels.base}</span>
                    <span>{formatRupees(previewFee.basePaise)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{previewFee.componentLineLabels.gst}</span>
                    <span>{formatRupees(previewFee.gstPaise)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between font-black border-t border-emerald-200/60 pt-2">
                <span>Total payable</span>
                <span className="text-emerald-700">
                  {formatRupees(previewFee?.totalPaise ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditCollege(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="font-bold">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save fees"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
