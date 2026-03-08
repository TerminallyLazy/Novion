"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Binary, ShieldCheck, Workflow } from "lucide-react";

export default function ViewerPage() {
  const searchParams = useSearchParams();

  const launchData = useMemo(
    () => ({
      study: searchParams.get("study") ?? "unknown",
      mode: searchParams.get("mode") ?? "diagnostic",
      signature: searchParams.get("signature") ?? "missing",
    }),
    [searchParams],
  );

  return (
    <div className="min-h-screen overflow-y-auto bg-[#060b16] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-cyan-400/20 bg-[linear-gradient(145deg,_rgba(8,15,31,0.98),_rgba(13,23,45,0.96))] p-8 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-300/80">
                <ShieldCheck className="h-4 w-4" />
                Viewer host route
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">Clinical imaging launch accepted</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                This route is the new signed handoff seam between the workflow shell and the
                long-term OHIF viewer application. For now it exposes the launch context and
                keeps the legacy workstation available as an explicit fallback.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/worklist"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
              >
                Back to worklist
              </Link>
              <Link
                href="/"
                className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-300/20"
              >
                Open research fallback
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Workflow className="h-4 w-4 text-cyan-300" />
                Launch context
              </div>
              <dl className="mt-4 space-y-4 text-sm text-slate-300">
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Study UID</dt>
                  <dd className="mt-1 break-all">{launchData.study}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Mode</dt>
                  <dd className="mt-1">{launchData.mode}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Signature</dt>
                  <dd className="mt-1 break-all">{launchData.signature}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Binary className="h-4 w-4 text-cyan-300" />
                Next implementation step
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Replace this host panel with the OHIF viewer surface, preserving the signed
                launch contract and keeping all DICOMweb access behind the backend gateway.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
