import { forwardRef } from "react";
import {
  fmtOfferLetterDate,
  resolveOfferLetterFields,
} from "@/lib/offerLetterProfile";
import {
  OFFER_LETTER_CAPTURE_WIDTH_PX,
  OFFER_LETTER_PADDING_PX,
} from "@/lib/offerLetterPdf";

interface OfferLetterProps {
  profile: any;
}

const letterStyle: React.CSSProperties = {
  width: OFFER_LETTER_CAPTURE_WIDTH_PX,
  maxWidth: OFFER_LETTER_CAPTURE_WIDTH_PX,
  minWidth: OFFER_LETTER_CAPTURE_WIDTH_PX,
  boxSizing: "border-box",
  overflow: "visible",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
};

export const OfferLetter = forwardRef<HTMLDivElement, OfferLetterProps>(({ profile }, ref) => {
  const fields = resolveOfferLetterFields(profile);
  const pad = OFFER_LETTER_PADDING_PX;

  const topDateLabel = fields.isLnmu ? "Application Date" : "Date";
  const topDateValue = fields.isLnmu
    ? fmtOfferLetterDate(
        fields.applicationDateIso,
        fmtOfferLetterDate(new Date().toISOString())
      )
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const rows: { l: string; v: string }[] = [
    { l: "Name of the Student", v: fields.fullName },
    { l: "Registration No.", v: fields.registrationNo },
    { l: "College / Institution", v: fields.collegeName },
    { l: "Department & Semester", v: fields.departmentSemester },
    { l: "Internship Domain", v: fields.internshipDomain },
    { l: "Internship Duration", v: fields.internshipDuration },
    { l: "Mode of Internship", v: fields.internshipMode },
    { l: "Internship Start Date", v: fields.startDate },
    {
      l: fields.isLnmu ? "Internship End Date" : "Expected End Date",
      v: fields.endDate,
    },
    { l: "Stipend", v: fields.stipend },
  ];

  return (
    <div
      ref={ref}
      data-offer-letter-root
      className="bg-white text-slate-800 text-[14px] leading-snug relative"
      style={letterStyle}
    >
      {/* Watermark */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex select-none items-center justify-center"
        style={{ paddingTop: 120 }}
      >
        <img
          src="/logo.png"
          alt=""
          width={380}
          height={380}
          className="object-contain opacity-[0.12] grayscale"
          style={{ maxWidth: 420, maxHeight: 420, width: "72%" }}
          crossOrigin="anonymous"
          decoding="async"
        />
      </div>

      {/* Header — full width, no negative margins (PDF-safe) */}
      <div className="relative z-10 bg-white w-full">
        <div className="h-3 w-full bg-sky-500" />

        <div
          className="flex items-start justify-between gap-3 py-4"
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          <div className="flex items-center gap-3 min-w-0 shrink">
            <img
              src="/logo.png"
              alt="Ezyintern"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-md object-contain bg-white"
              crossOrigin="anonymous"
              decoding="sync"
            />
            <span className="text-[20px] font-bold text-sky-600 tracking-tight whitespace-nowrap">
              Ezy<span className="text-slate-700">intern</span>
            </span>
          </div>

          <div className="text-right text-[10px] leading-[1.4] text-slate-700 shrink-0 max-w-[240px]">
            <p>Arfabad Colony, East Nahar Road, Bajranngpuri,</p>
            <p>Patna - 800007</p>
            <p className="font-semibold">7050936593</p>
            <p>contact@ezyintern.in</p>
            <p>www.ezyintern.in</p>
          </div>
        </div>

        <div className="border-t-2 border-sky-600" style={{ marginLeft: pad, marginRight: pad }} />

        <h1
          className="text-center py-3 text-[17px] font-bold tracking-wide text-slate-900"
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          INTERNSHIP OFFER LETTER
        </h1>
      </div>

      <div
        className="relative z-10"
        style={{ paddingLeft: pad, paddingRight: pad, paddingBottom: pad }}
      >
        <div className="flex justify-between gap-3 text-[12px] font-bold mb-4 tabular-nums">
          <p className="min-w-0 break-words" style={{ maxWidth: "58%" }}>
            Letter Ref. No.:{" "}
            <span className="font-black text-slate-900">{fields.letterRefNo}</span>
          </p>
          <p className="shrink-0 text-right">
            {topDateLabel}: <span className="font-bold text-slate-900">{topDateValue}</span>
          </p>
        </div>

        <div className="text-[14px] space-y-1 mb-4">
          <p>To,</p>
          <p className="font-bold text-slate-900 uppercase break-words">{fields.fullName}</p>
          <p className="break-words">
            Registration No.: <span className="font-bold">{fields.registrationNo}</span>
          </p>
          <p className="break-words leading-snug">
            College / Institution:{" "}
            <span className="font-bold">{fields.collegeName}</span>
          </p>
        </div>

        <div className="text-[14px] space-y-3 leading-relaxed text-justify">
          <p className="font-bold">Dear Candidate,</p>
          <p>
            We are pleased to accept your application and formally offer you an internship at{" "}
            <span className="font-bold">Ezyintern SDP Technology Private Limited (Ezyintern)</span>.
            Our internship programmes are designed in full alignment with{" "}
            <span className="font-bold">NEP-2020, AICTE and UGC Internship Guidelines</span>, and your
            university&apos;s specific internship framework.
          </p>

          <div className="rounded-lg border border-sky-200 bg-sky-50 py-3 px-3">
            <p className="font-bold mb-2">Your internship details are as follows:</p>
            <table className="w-full border-collapse text-[13px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "44%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "52%" }} />
              </colgroup>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="align-top py-1 pr-1 text-slate-800 break-words">• {row.l}</td>
                    <td className="align-top py-1 text-center">:</td>
                    <td className="align-top py-1 font-bold text-slate-900 break-words">{row.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p>
            Please report to us on your start date as per the schedule above and bring this letter along
            with the <span className="font-bold">Consent Letter</span> issued by your College. We also
            request that you inform your{" "}
            <span className="font-bold">College Internship Nodal Officer (CINO)</span> upon receiving
            this acceptance letter. During the programme, you are required to maintain the minimum
            required attendance and complete all tasks and assignments given by your mentor.
          </p>

          <p>
            We look forward to a meaningful and enriching internship experience and appreciate your
            interest in <span className="font-bold">Ezyintern</span>.
          </p>
        </div>

        <div className="relative z-10 mt-4 w-full">
          <img
            src="/offer-letter-footer.png"
            alt="Official signature and accreditations"
            className="block w-full h-auto"
            style={{ width: OFFER_LETTER_CAPTURE_WIDTH_PX, maxWidth: "100%" }}
            crossOrigin="anonymous"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
});

OfferLetter.displayName = "OfferLetter";
