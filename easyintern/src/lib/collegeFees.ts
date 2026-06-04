import {
  computeFeeBreakdown,
  type CollegeFeeFields,
  type FeeBreakdown,
} from "@/lib/feeRules";

export type { CollegeFeeFields, FeeBreakdown };

export type CollegeWithFees = CollegeFeeFields & {
  id: string;
  name: string;
  university_id: string;
  pisa_fee?: number | null;
  universities?: { name: string } | null;
};

/** Resolve fallback amount before rules/DB (college → university → payment config). */
export function resolveBaseAmountPaise(
  college: { pisa_fee?: number | null } | null | undefined,
  university: { pisa_fee?: number | null } | null | undefined,
  paymentConfigAmount?: number | null
): number {
  if (college?.pisa_fee && college.pisa_fee > 0) return college.pisa_fee;
  if (university?.pisa_fee && university.pisa_fee > 0) return university.pisa_fee;
  if (paymentConfigAmount && paymentConfigAmount > 0) return paymentConfigAmount;
  return 50000;
}

export function resolveStudentFeeBreakdown(
  universityName: string | undefined | null,
  collegeName: string | undefined | null,
  college: CollegeFeeFields | null | undefined,
  university: { pisa_fee?: number | null } | null | undefined,
  paymentConfigAmount?: number | null
): FeeBreakdown {
  const fallback = resolveBaseAmountPaise(college ?? undefined, university, paymentConfigAmount);
  return computeFeeBreakdown(universityName, collegeName, fallback, college);
}

export function buildCollegeFeeUpdatePayload(input: {
  totalRupees: number;
  baseRupees: number;
  processingRupees: number;
  showBreakdown: boolean;
}) {
  const totalPaise = Math.round(input.totalRupees * 100);
  const processingPaise = input.showBreakdown
    ? Math.round(input.processingRupees * 100)
    : 0;
  const basePaise = input.showBreakdown
    ? Math.round(input.baseRupees * 100)
    : totalPaise;

  return {
    pisa_fee: totalPaise,
    fee_base_paise: basePaise,
    fee_processing_paise: processingPaise,
    show_fee_breakdown: input.showBreakdown,
    fees_managed: true,
  };
}
