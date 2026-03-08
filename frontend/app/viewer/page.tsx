"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import { clinicalApi } from "@/lib/clinical/client";
import type { ImagingLaunchResolveResponse } from "@/lib/clinical/contracts";

export default function ViewerFallbackPage() {
  const searchParams = useSearchParams();
  const launchToken = searchParams.get("launch");

  const [resolved, setResolved] = useState<ImagingLaunchResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!launchToken) {
        setLoading(false);
        setError("The viewer route requires an opaque launch token.");
        return;
      }

      try {
        const session = await clinicalApi.getSession();
        if (!session.authenticated) {
          window.location.href = `/login?next=${encodeURIComponent(`/viewer?launch=${launchToken}`)}`;
          return;
        }

        const launch = await clinicalApi.resolveLaunch(launchToken);
        if (!cancelled) {
          setResolved(launch);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Unable to resolve the clinical launch token.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [launchToken]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_38%),linear-gradient(180deg,_#020617,_#0f172a)] px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-cyan-400/20 bg-slate-950/70 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-300/80">
          <ShieldCheck className="h-4 w-4" />
          Viewer handoff
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">OHIF migration seam</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">
          The clinical viewer route is now owned by the dedicated OHIF app in the local clinical
          stack. This Next.js route remains as a migration-safe fallback when the shell is run
          standalone outside the reverse-proxied stack.
        </p>

        {loading && (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Resolving launch token through the governed backend contract...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && resolved && (
          <div className="mt-8 grid gap-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="text-sm font-medium text-white">Resolved launch</div>
              <div className="mt-4 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Study UID</div>
                  <div className="mt-1 break-all">{resolved.context.studyInstanceUID}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Launch token</div>
                  <div className="mt-1 break-all">{resolved.launchToken}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Viewer kind</div>
                  <div className="mt-1">{resolved.viewerRuntime.viewerKind}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">WADO root</div>
                  <div className="mt-1 break-all">{resolved.viewerRuntime.wadoRoot}</div>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/worklist"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
              >
                Back to worklist
              </Link>
              <a
                href={resolved.viewerRuntime.viewerBasePath + `?launch=${encodeURIComponent(resolved.launchToken)}`}
                className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
              >
                Open OHIF route
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
