"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2, LogOut, Radio } from "lucide-react";
import { useMission } from "@/lib/store";
import { fmtClock } from "@/lib/format";
import type { CrewMember, PingKind } from "@/lib/types";
import SpotlightCard from "@/components/reactbits/SpotlightCard";

const PINGS: PingKind[] = ["ROGER", "COPY", "GO", "HOLD"];

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  FOCUS: { label: "FOCUS", cls: "text-cyan", dot: "bg-cyan" },
  REST: { label: "REST", cls: "text-amber", dot: "bg-amber" },
  HOLD: { label: "HOLD", cls: "text-dim", dot: "bg-dim" },
  ZEN: { label: "ZEN", cls: "text-bone/60", dot: "bg-bone/60" },
};

const statusOf = (m: CrewMember) =>
  m.zen ? "ZEN" : !m.running ? "HOLD" : m.phase !== "focus" ? "REST" : "FOCUS";

/** live elapsed for a member — extrapolate from the last broadcast */
const elapsedOf = (m: CrewMember, now: number) =>
  Math.round(
    m.running ? m.elapsedSec + (now - m.rxAt) / 1000 : m.elapsedSec,
  );

function MemberRow({
  m,
  isMe,
  isCapcom,
  now,
}: {
  m: CrewMember;
  isMe: boolean;
  isCapcom: boolean;
  now: number;
}) {
  const s = STATUS_META[statusOf(m)];
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.05] py-2 last:border-0">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} animate-pulse`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate font-mono text-[10px] tracking-[0.15em] ${
              isMe ? "text-amber" : "text-bone/90"
            }`}
          >
            {m.callsign}
          </span>
          {isMe && (
            <span className="font-mono text-[7px] tracking-[0.2em] text-faint">
              YOU
            </span>
          )}
          {isCapcom && (
            <span className="rounded-sm border border-amber/40 px-1 font-mono text-[7px] tracking-[0.15em] text-amber">
              CAPCOM
            </span>
          )}
        </div>
      </div>
      <span className={`font-mono text-[8px] tracking-[0.2em] ${s.cls}`}>
        {s.label}
      </span>
      <span className="w-11 text-right font-mono text-[9px] tabular-nums text-dim">
        {fmtClock(elapsedOf(m, now))}
      </span>
    </div>
  );
}

export default function CrewPanel({ open }: { open: boolean }) {
  const {
    crewAvailable,
    crewStatus,
    crewCode,
    callsign,
    setCallsign,
    crew,
    selfId,
    crewCount,
    isCapcom,
    followClock,
    setFollowClock,
    crewFeed,
    joinCrew,
    leaveCrew,
    sendPing,
  } = useMission();

  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const online = crewStatus === "online";

  /* slow local tick so crew elapsed times tick while the panel is open */
  useEffect(() => {
    if (!open || !online) return;
    const iv = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(iv);
  }, [open, online]);

  const members = Object.entries(crew).sort(
    ([, a], [, b]) => a.joinedAt - b.joinedAt,
  );
  const capcomId =
    members.length > 0
      ? members.reduce((a, b) => (a[1].joinedAt <= b[1].joinedAt ? a : b))[0]
      : null;

  const copyCode = () => {
    if (!crewCode) return;
    void navigator.clipboard?.writeText(crewCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -top-4 left-1/2 w-80 -translate-x-1/2 -translate-y-full"
        >
          <SpotlightCard
            className="w-80"
            spotlightColor="rgba(245, 165, 36, 0.1)"
            theme="dark"
            style={
              {
                padding: "1rem",
                borderRadius: "1rem",
                backdropFilter: "blur(24px) saturate(140%)",
                WebkitBackdropFilter: "blur(24px) saturate(140%)",
                "--spotlight-card-surface": "rgba(12, 12, 16, 0.6)",
              } as CSSProperties
            }
          >
            {/* header */}
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.3em] text-faint">
                CREW LINK // COMMS
              </span>
              <span
                className={`flex items-center gap-1.5 font-mono text-[8px] tracking-[0.2em] ${
                  online
                    ? "text-cyan"
                    : crewStatus === "connecting"
                      ? "text-amber"
                      : "text-faint"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    online
                      ? "bg-cyan animate-pulse"
                      : crewStatus === "connecting"
                        ? "bg-amber animate-pulse"
                        : "bg-faint"
                  }`}
                />
                {crewStatus.toUpperCase()}
              </span>
            </div>

            {!online ? (
              /* -------- join / create -------- */
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="mb-1 block font-mono text-[8px] tracking-[0.25em] text-faint">
                    CALLSIGN
                  </span>
                  <input
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    maxLength={12}
                    className="w-full rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.15em] text-bone outline-none focus:border-amber/50"
                    aria-label="Your callsign"
                  />
                </label>

                {!crewAvailable ? (
                  <div className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 font-mono text-[8px] leading-relaxed tracking-[0.15em] text-dim">
                    LINK OFFLINE — set{" "}
                    <span className="text-cyan">NEXT_PUBLIC_SUPABASE_URL</span>{" "}
                    and{" "}
                    <span className="text-cyan">
                      NEXT_PUBLIC_SUPABASE_ANON_KEY
                    </span>{" "}
                    in .env.local to enable crew mode.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        value={codeInput}
                        onChange={(e) =>
                          setCodeInput(e.target.value.toUpperCase().slice(0, 7))
                        }
                        placeholder="XXXX-XX"
                        className="w-full min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] tracking-[0.2em] text-bone outline-none placeholder:text-faint focus:border-cyan/50"
                        aria-label="Room code"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && codeInput.trim())
                            joinCrew(codeInput);
                        }}
                      />
                      <button
                        onClick={() => codeInput.trim() && joinCrew(codeInput)}
                        disabled={!codeInput.trim()}
                        className="rounded-md border border-white/15 px-3 font-mono text-[9px] tracking-[0.2em] text-dim transition-colors hover:border-white/30 hover:text-bone disabled:opacity-40"
                      >
                        JOIN
                      </button>
                    </div>
                    <button
                      onClick={() => joinCrew()}
                      disabled={crewStatus === "connecting"}
                      className="flex items-center justify-center gap-2 rounded-md bg-bone py-2 font-mono text-[9px] font-semibold tracking-[0.25em] text-void transition-opacity hover:opacity-85 disabled:opacity-50"
                    >
                      <Link2 className="h-3 w-3" strokeWidth={2} />
                      {crewStatus === "connecting"
                        ? "ESTABLISHING…"
                        : "CREATE LINK"}
                    </button>
                    <div className="font-mono text-[7px] leading-relaxed tracking-[0.2em] text-faint">
                      SHARE THE ROOM CODE — CREWMATES SEE YOUR MISSION STATE
                      AS TELEMETRY, NOT AVATARS.
                    </div>
                  </>
                )}

                {/* feed still visible offline — shows link status lines */}
                {crewFeed.length > 0 && (
                  <div className="max-h-24 overflow-y-auto border-t border-white/[0.06] pt-2 font-mono text-[8px] leading-relaxed tracking-[0.12em]">
                    {crewFeed.slice(-8).map((e) => (
                      <div key={e.id} className="text-faint">
                        {e.from && (
                          <span className="text-dim">{e.from} — </span>
                        )}
                        {e.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* -------- manifest -------- */
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] tracking-[0.25em] text-bone/80">
                    ORB {crewCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-1 font-mono text-[8px] tracking-[0.2em] text-faint transition-colors hover:text-bone"
                    aria-label="Copy room code"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-amber" strokeWidth={2} />
                    ) : (
                      <Copy className="h-3 w-3" strokeWidth={1.5} />
                    )}
                    {copied ? "COPIED" : "COPY"}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-md border border-white/[0.06] px-3">
                  {members.map(([id, m]) => (
                    <MemberRow
                      key={id}
                      m={m}
                      isMe={id === selfId}
                      isCapcom={id === capcomId}
                      now={now}
                    />
                  ))}
                </div>

                {/* radio calls */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[8px] tracking-[0.25em] text-faint">
                    <Radio className="h-3 w-3" strokeWidth={1.5} />
                    RADIO
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PINGS.map((p) => (
                      <button
                        key={p}
                        onClick={() => sendPing(p)}
                        className="rounded-md border border-white/10 py-1.5 font-mono text-[8px] tracking-[0.15em] text-dim transition-colors hover:border-amber/40 hover:text-amber"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* clock sync — followers only */}
                {!isCapcom && crewCount > 1 && (
                  <button
                    onClick={() => setFollowClock(!followClock)}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-[8px] tracking-[0.2em] transition-colors ${
                      followClock
                        ? "border-cyan/40 text-cyan"
                        : "border-white/10 text-dim hover:border-white/25"
                    }`}
                  >
                    FOLLOW CAPCOM CLOCK
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        followClock ? "bg-cyan" : "bg-faint"
                      }`}
                    />
                  </button>
                )}

                {/* event feed */}
                {crewFeed.length > 0 && (
                  <div className="max-h-28 overflow-y-auto border-t border-white/[0.06] pt-2 font-mono text-[8px] leading-relaxed tracking-[0.12em]">
                    {crewFeed.slice(-12).map((e) => (
                      <div key={e.id} className="flex gap-2 text-faint">
                        <span className="shrink-0 text-faint/60">
                          {new Date(e.t).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="truncate">
                          {e.from && (
                            <span className="text-dim">{e.from} — </span>
                          )}
                          <span
                            className={
                              e.kind === "ping"
                                ? "text-amber"
                                : e.kind === "wp"
                                  ? "text-cyan"
                                  : undefined
                            }
                          >
                            {e.text}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={leaveCrew}
                  className="flex items-center justify-center gap-2 rounded-md border border-white/10 py-2 font-mono text-[9px] tracking-[0.25em] text-dim transition-colors hover:border-alert/40 hover:text-alert"
                >
                  <LogOut className="h-3 w-3" strokeWidth={1.5} />
                  LEAVE STATION
                </button>
              </div>
            )}
          </SpotlightCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
