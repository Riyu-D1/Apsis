import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type {
  ClockMsg,
  CrewMember,
  CrewPresence,
  CrewStatus,
  PingKind,
} from "./types";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Feature flag — the whole crew layer hides itself without credentials. */
export const crewAvailable = Boolean(SB_URL && SB_KEY);

let client: SupabaseClient | null = null;
const sb = () =>
  (client ??= createClient(SB_URL, SB_KEY, {
    realtime: { params: { eventsPerSecond: 6 } },
  }));

/* ------------------------------------------------------------------ */
/* Identity + room codes                                               */
/* ------------------------------------------------------------------ */

/* unambiguous alphabet — no 0/O, 1/I/L */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** ORB-XXXX-XX — 32^6 ≈ a billion rooms, unguessable enough for friends. */
export const genRoomCode = () => {
  const pick = (n: number) =>
    Array.from({ length: n }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  return `${pick(4)}-${pick(2)}`;
};

const CALLSIGNS = [
  "KESTREL", "VEGA", "SABLE", "ION", "DELTA", "ORCA",
  "NOVA", "HELIO", "TALON", "RIGEL", "LYRA", "PIONEER",
  "MERIDIAN", "VECTOR", "APEX", "ZENITH", "PROXIMA", "SOL",
];

export const genCallsign = () =>
  `${CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]}-${String(
    Math.floor(Math.random() * 90) + 10,
  )}`;

export const genClientId = () =>
  `c${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/* ------------------------------------------------------------------ */
/* Room                                                                */
/* ------------------------------------------------------------------ */

export interface RoomHandle {
  track: (p: CrewPresence) => void;
  ping: (kind: PingKind, from: string) => void;
  waypoint: (label: string, from: string) => void;
  clock: (m: ClockMsg) => void;
  leave: () => Promise<void>;
}

export interface RoomCallbacks {
  clientId: string;
  /** full presence roster on every sync — keys are clientIds */
  onPresence: (members: Record<string, CrewMember>) => void;
  onRadio: (from: string, kind: PingKind) => void;
  onWaypoint: (from: string, label: string) => void;
  onClock: (m: ClockMsg) => void;
  onStatus: (s: CrewStatus) => void;
}

/**
 * Join (or create) a crew room. Returns a handle, or null when the link
 * can't be established — callers should surface OFFLINE and move on.
 */
export async function joinRoom(
  code: string,
  cb: RoomCallbacks,
): Promise<RoomHandle | null> {
  if (!crewAvailable) return null;

  const build = () =>
    sb().channel(`orbital-crew:${code}`, {
      config: {
        private: false,
        broadcast: { self: false, ack: false },
        presence: { key: cb.clientId, enabled: true },
      },
    });

  let channel = build();
  const wire = (ch: RealtimeChannel) => {
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<CrewPresence>();
      const now = Date.now();
      const members: Record<string, CrewMember> = {};
      for (const [key, presences] of Object.entries(state)) {
        const p = presences[presences.length - 1];
        if (p) members[key] = { ...p, rxAt: now };
      }
      cb.onPresence(members);
    })
      .on("broadcast", { event: "radio" }, ({ payload }) =>
        cb.onRadio(payload.from, payload.kind),
      )
      .on("broadcast", { event: "wp" }, ({ payload }) =>
        cb.onWaypoint(payload.from, payload.label),
      )
      .on("broadcast", { event: "clock" }, ({ payload }) =>
        cb.onClock(payload as ClockMsg),
      );
  };
  wire(channel);

  const subscribe = (ch: RealtimeChannel) =>
    new Promise<boolean>((resolve) => {
      let settled = false;
      ch.subscribe((status) => {
        if (settled) return;
        if (status === "SUBSCRIBED") {
          settled = true;
          cb.onStatus("online");
          resolve(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          settled = true;
          resolve(false);
        }
      });
    });

  let ok = await subscribe(channel);
  if (!ok) {
    /* newer projects require a JWT even for public channels — anon sign-in
       satisfies that without accounts; harmless no-op when it isn't needed */
    try {
      await sb().auth.signInAnonymously();
    } catch {
      /* anonymous sign-ins may be disabled — still worth one retry */
    }
    await sb().removeChannel(channel).catch(() => undefined);
    channel = build();
    wire(channel);
    ok = await subscribe(channel);
    if (!ok) {
      cb.onStatus("offline");
      await sb().removeChannel(channel).catch(() => undefined);
      return null;
    }
  }

  return {
    track: (p) => channel.track(p).catch(() => undefined),
    ping: (kind, from) =>
      channel.send({
        type: "broadcast",
        event: "radio",
        payload: { from, kind },
      }),
    waypoint: (label, from) =>
      channel.send({
        type: "broadcast",
        event: "wp",
        payload: { from, label },
      }),
    clock: (m) =>
      channel.send({ type: "broadcast", event: "clock", payload: m }),
    leave: async () => {
      await channel.untrack().catch(() => undefined);
      await sb().removeChannel(channel).catch(() => undefined);
    },
  };
}
