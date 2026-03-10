"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Stethoscope } from "lucide-react";

import { clinicalApi } from "@/lib/clinical/client";
import type {
  ClinicalPlatformConfig,
  SessionClaims,
  WorklistRow,
} from "@/lib/clinical/contracts";

export default function WorklistPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ClinicalPlatformConfig | null>(null);
  const [session, setSession] = useState<SessionClaims | null>(null);
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [launchingStudyUid, setLaunchingStudyUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessionResponse = await clinicalApi.getSession();
        if (!sessionResponse.authenticated || !sessionResponse.session) {
          router.replace("/login?next=%2Fworklist");
          return;
        }

        const [platformConfig, worklist] = await Promise.all([
          clinicalApi.getPlatformConfig(),
          clinicalApi.getWorklist(),
        ]);

        if (!cancelled) {
          setSession(sessionResponse.session);
          setConfig(platformConfig);
          setRows(worklist.rows);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load clinical worklist.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const headline = useMemo(() => {
    if (!config) {
      return "Loading clinical platform posture...";
    }
    return `Clinical worklist in ${config.mode} mode`;
  }, [config]);

  const handleOpenViewer = async (row: WorklistRow) => {
    setLaunchingStudyUid(row.studyInstanceUID);
    try {
      const launch = await clinicalApi.launchImaging({
        studyInstanceUID: row.studyInstanceUID,
      });
      window.location.assign(launch.viewerUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to launch viewer.");
    } finally {
      setLaunchingStudyUid(null);
    }
  };

  const handleLogout = async () => {
    try {
      await clinicalApi.logout();
      router.replace("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to end clinical session.");
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0b1220] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-cyan-400/30 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))] p-8 shadow-2xl shadow-cyan-950/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-cyan-300/80">
                <ShieldCheck className="h-4 w-4" />
                RadSysX Clinical Workspace
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-white">{headline}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                The worklist is now backed by the FastAPI clinical surface. Study launch is
                opaque and signed, triage remains shadow-first unless governance enables higher
                modes, and the legacy upload/analyze flows are treated as research-only.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {session && (
                <div className="text-right text-sm text-slate-300">
                  <div>{session.name}</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {session.roles.join(", ")}
                  </div>
                </div>
              )}
              <Link
                href="/"
                className="rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
              >
                Research workstation
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Sign out
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4">
            {rows.map((row) => (
              <div
                key={row.studyInstanceUID}
                className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 lg:grid-cols-[1.7fr_1fr_auto]"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300/70">
                    <Stethoscope className="h-4 w-4" />
                    {row.modality} study
                  </div>
                  <div className="mt-2 text-lg font-medium text-white">{row.description}</div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                    <span>Accession {row.accessionNumber}</span>
                    <span>Patient {row.patientRef}</span>
                    <span>Status {row.status}</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Study UID {row.studyInstanceUID}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                  <div>Priors {row.priorStudyUIDs.length}</div>
                  <div>
                    Triage score{" "}
                    {row.triageScore == null ? "Unavailable" : row.triageScore.toFixed(2)}
                  </div>
                  <div>Archive {row.archiveRef}</div>
                  <div>Updated {new Date(row.lastUpdatedAt).toLocaleString()}</div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => void handleOpenViewer(row)}
                    className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
                    disabled={launchingStudyUid === row.studyInstanceUID}
                  >
                    {launchingStudyUid === row.studyInstanceUID ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Launching
                      </span>
                    ) : (
                      "Open viewer"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
