import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as THREE from "three";
import * as Tone from "tone";

const AGENTS = [
  { id: "alpha", name: "Alpha", role: "Trader", color: 0x14f195, status: "working", tasks: 47, balance: 12.4 },
  { id: "bravo", name: "Bravo", role: "DeFi Strategist", color: 0x9945ff, status: "working", tasks: 32, balance: 8.7 },
  { id: "cipher", name: "Charlie", role: "Data Analyst", color: 0x00d1ff, status: "idle", tasks: 28, balance: 5.2 },
  { id: "delta", name: "Delta", role: "NFT Scout", color: 0xff6b6b, status: "idle", tasks: 19, balance: 3.1 },
  { id: "echo", name: "Echo", role: "Tx Executor", color: 0xffaa22, status: "working", tasks: 55, balance: 21.8 },
  { id: "flux", name: "Foxtrot", role: "Market Monitor", color: 0xff44aa, status: "idle", tasks: 41, balance: 6.9 },
];

const CHAT_RESPONSES = [
  "Copy that. Executing now.",
  "On it. Checking the orderbook...",
  "Roger. I'll have results in ~30s.",
  "Confirmed. Transaction submitted.",
  "Analyzing the data. Stand by.",
  "Market conditions look volatile. Proceeding with caution.",
  "Found 3 opportunities. Sending report.",
  "Done. TX hash: 5xK7m...9pQ2",
];

const ACTIVITY_TEMPLATES = [
  (a) => ({ hl: a.name, text: `scanned 12 new token launches` }),
  (a) => ({ hl: a.name, text: `executed swap: 0.5 SOL → USDC` }),
  (a) => ({ hl: a.name, text: `detected price anomaly on RAY/SOL` }),
  (a) => ({ hl: a.name, text: `updated portfolio allocation` }),
  (a) => ({ hl: a.name, text: `monitoring 3 active positions` }),
  (a) => ({ hl: a.name, text: `synced wallet: ${a.balance.toFixed(1)} SOL` }),
  (a) => ({ hl: a.name, text: `flagged suspicious on-chain transfer` }),
  (a) => ({ hl: a.name, text: `completed DCA order #${Math.floor(Math.random() * 100) + 1}` }),
];

function hexToCSS(hex) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgb(${r},${g},${b})`;
}

function timeStr() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function ClawHQ() {
  // Sports room position constants (computed from staircase geometry)
  const SPORTS_X = 40;
  const SPORTS_Z = 23.1;
  const LEFT_GYM_X = -30;
  const LEFT_GYM_Z = 23.1;
  const BOTTOM_ROOM_X = 0;
  const BOTTOM_ROOM_Z = 45.6;

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const agentMeshesRef = useRef({});
  const agentTargetsRef = useRef({});
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const clockRef = useRef(null);
  const cameraStateRef = useRef({ angle: Math.PI / 4, pitch: 0.6, distance: 25, target: new THREE.Vector3(0, 0, 0) });
  const dragRef = useRef({ dragging: false, button: 0, prevX: 0, prevY: 0 });
  const frameRef = useRef(null);
  const labelContainerRef = useRef(null);
  const labelElemsRef = useRef({});
  const followAgentRef = useRef(null);
  const seatPositionsRef = useRef({});
  const terminalLogsRef = useRef({});
  const gymPropsRef = useRef({});

  const [activePanel, setActivePanel] = useState("tasks");
  const [panelOpen, setPanelOpen] = useState(true);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef(null);
  const musicAutoStarted = useRef(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agents, setAgents] = useState(AGENTS.map(a => ({ ...a })));
  const [tasks, setTasks] = useState([]);
  const [chatLog, setChatLog] = useState([
    { from: "Alpha", text: "All systems nominal. Jupiter routes loaded.", color: hexToCSS(0x14f195) },
    { from: "Echo", text: "Mainnet connection stable. Ready to execute.", color: hexToCSS(0xffaa22) },
    { from: "Cipher", text: "Market data feed active. Monitoring 47 pairs.", color: hexToCSS(0x00d1ff) },
  ]);
  const [activityLog, setActivityLog] = useState([
    { time: timeStr(), hl: "MYCLAW3D", text: "initialized. 6 agents online." },
    { time: timeStr(), hl: "Echo", text: "connected to Solana mainnet-beta" },
    { time: timeStr(), hl: "Alpha", text: "loaded Jupiter aggregator routes" },
  ]);
  const [taskInput, setTaskInput] = useState("");
  const [taskAgent, setTaskAgent] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState("alpha");
  const [hqPanelOpen, setHqPanelOpen] = useState(false);
  const [hqTab, setHqTab] = useState("playbooks");
  const [chatModelByAgent, setChatModelByAgent] = useState({});
  const [chatShowToolsByAgent, setChatShowToolsByAgent] = useState({});
  const [settingsFocusAgent, setSettingsFocusAgent] = useState(null);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [marketTab, setMarketTab] = useState("browse"); // browse | importexport
  const [marketImportText, setMarketImportText] = useState("");
  const [marketMsg, setMarketMsg] = useState("");
  const [marketToolOutput, setMarketToolOutput] = useState("");
  const [marketToolBusy, setMarketToolBusy] = useState(false);
  const [analyticsLimit, setAnalyticsLimit] = useState(300);
  const [analyticsAgent, setAnalyticsAgent] = useState("all");
  const [analyticsType, setAnalyticsType] = useState("all");
  const [analyticsErrorsOnly, setAnalyticsErrorsOnly] = useState(false);
  const [monitorModal, setMonitorModal] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [toolAgent, setToolAgent] = useState("alpha");
  const [toolName, setToolName] = useState("sessions_list");
  const [toolAction, setToolAction] = useState("json");
  const [toolArgsText, setToolArgsText] = useState("{}");
  const [toolBusy, setToolBusy] = useState(false);
  const taskAbortRef = useRef({});
  const [reports, setReports] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [obsEvents, setObsEvents] = useState([]);
  const [archivedEvents, setArchivedEvents] = useState([]);
  const [obsStatsByAgent, setObsStatsByAgent] = useState(() => {
    const s = {};
    AGENTS.forEach(a => {
      s[a.id] = { calls: 0, errors: 0, timeMs: 0, inTok: 0, outTok: 0 };
    });
    return s;
  });
  const [obsFilterAgent, setObsFilterAgent] = useState("all");
  const [obsFilterType, setObsFilterType] = useState("all");
  const [obsErrorsOnly, setObsErrorsOnly] = useState(false);
  const [obsShowDetails, setObsShowDetails] = useState(false);
  const [playbooks, setPlaybooks] = useState([]);
  const buffsRef = useRef((() => {
    const m = {};
    AGENTS.forEach(a => { m[a.id] = {}; });
    return m;
  })());
  const anyRightSlideoutOpen = hqPanelOpen || marketplaceOpen || analyticsOpen;
  const anyPanelOverlayOpen = anyRightSlideoutOpen || chatPanelOpen;
  const settingsAgentRowRef = useRef({});
  const lastActivityFlagsRef = useRef((() => {
    const m = {};
    AGENTS.forEach(a => { m[a.id] = { gyming: false, cafe: false, playing: false }; });
    return m;
  })());
  const [buffsTick, setBuffsTick] = useState(0);
  const [agentSettings, setAgentSettings] = useState({});
  const [serverHealth, setServerHealth] = useState(null);
  const [serverHealthMeta, setServerHealthMeta] = useState({ ok: false, ms: null, error: "", at: 0 });
  const [agentTest, setAgentTest] = useState({});
  const [chatHistories, setChatHistories] = useState(() => {
    const h = {};
    AGENTS.forEach(a => { h[a.id] = []; });
    return h;
  });
  const chatHistoriesRef = useRef(chatHistories);
  useEffect(() => { chatHistoriesRef.current = chatHistories; }, [chatHistories]);
  const [terminalTick, setTerminalTick] = useState(0);

  const approxTokens = useCallback((text) => {
    if (!text) return 0;
    const s = typeof text === "string" ? text : JSON.stringify(text);
    return Math.max(1, Math.ceil(s.length / 4));
  }, []);

  const sanitizePreview = useCallback((value, maxLen = 900) => {
    if (value == null) return "";
    let s = "";
    try {
      s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    } catch {
      s = String(value);
    }
    // Basic redactions for common secret patterns.
    s = s.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
    s = s.replace(/("?(token|apiKey|api_key|authorization|password|secret)"?\s*:\s*)(".*?"|'.*?'|[A-Za-z0-9._-]+)/gi, '$1"[REDACTED]"');
    if (s.length > maxLen) s = s.slice(0, maxLen) + "\n…";
    return s;
  }, []);

  const pct = useCallback((rows, p) => {
    const vals = rows.map(r => Number(r)).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
    if (!vals.length) return null;
    const idx = Math.max(0, Math.min(vals.length - 1, Math.ceil((p / 100) * vals.length) - 1));
    return vals[idx];
  }, []);

  const curatedPlaybooks = useMemo(() => ([
    {
      title: "Morning standup (per agent)",
      desc: "Each agent posts a concise standup-style update to the inbox.",
      color: "#14f195",
      intervalMs: 6 * 60 * 60 * 1000,
      agentId: "random",
      taskText: "Post a 5-bullet standup update: what you did, what you'll do, blockers, risks, and next actions. Keep it tight.",
      enabled: true,
    },
    {
      title: "Error triage (observe feed)",
      desc: "Review recent errors and propose fixes + next checks.",
      color: "#ffaa22",
      intervalMs: 30 * 60 * 1000,
      agentId: "random",
      taskText: "Review the latest error events. Summarize root causes, propose fixes, and suggest what to verify next.",
      enabled: true,
    },
    {
      title: "Inbox sweeper",
      desc: "Summarize open inbox items and mark recommended priority order.",
      color: "#00d1ff",
      intervalMs: 45 * 60 * 1000,
      agentId: "random",
      taskText: "Summarize the open inbox items, group by theme, and propose a priority order with next actions.",
      enabled: true,
    },
    {
      title: "Cafeteria creativity burst",
      desc: "Generate 3 small product/UI improvements for MyClaw3D.",
      color: "#9945ff",
      intervalMs: 3 * 60 * 60 * 1000,
      agentId: "random",
      taskText: "Propose 3 small, high-leverage improvements to the MyClaw3D UX. For each: what, why, and a 3-step implementation plan.",
      enabled: false,
    },
    {
      title: "Weekly recap",
      desc: "High-level recap of playbook runs and outcomes.",
      color: "#c8a050",
      intervalMs: 7 * 24 * 60 * 60 * 1000,
      agentId: "random",
      taskText: "Write a short weekly recap: what ran, what worked, what failed, and what to improve next week.",
      enabled: false,
    },
  ]), []);

  async function fetchPlaybooksIntoState() {
    try {
      const r = await fetch("/api/playbooks");
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) return;
      if (Array.isArray(json.playbooks)) setPlaybooks(json.playbooks);
    } catch {
      // ignore
    }
  }

  async function fetchAgentSettingsIntoState() {
    try {
      const r = await fetch("/api/agent-settings");
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) return;
      setAgentSettings(json.settings || {});
    } catch {
      // ignore
    }
  }

  const installPlaybookTemplate = useCallback(async (tpl) => {
    setMarketMsg("");
    try {
      const r = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tpl),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) throw new Error(json?.error?.message || json?.error || `HTTP ${r.status}`);
      setMarketMsg(`Installed: ${tpl.title}`);
      fetchPlaybooksIntoState();
    } catch (e) {
      setMarketMsg(`Install failed: ${e?.message || String(e)}`);
    }
  }, []);

  const downloadJson = useCallback((filename, value) => {
    try {
      const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      // ignore
    }
  }, []);

  const exportMarketBundle = useCallback(async () => {
    setMarketMsg("");
    try {
      const [pbR, asR] = await Promise.all([fetch("/api/playbooks"), fetch("/api/agent-settings")]);
      const pbJ = await pbR.json().catch(() => null);
      const asJ = await asR.json().catch(() => null);
      if (!pbR.ok || !pbJ?.ok) throw new Error(`playbooks: HTTP ${pbR.status}`);
      if (!asR.ok || !asJ?.ok) throw new Error(`agent-settings: HTTP ${asR.status}`);
      const bundle = {
        version: 1,
        exportedAt: Date.now(),
        playbooks: Array.isArray(pbJ.playbooks) ? pbJ.playbooks : [],
        agentSettings: asJ.settings || {},
      };
      downloadJson(`myclaw3d-marketplace-bundle-${new Date().toISOString().slice(0, 10)}.json`, bundle);
      setMarketMsg("Exported JSON bundle.");
    } catch (e) {
      setMarketMsg(`Export failed: ${e?.message || String(e)}`);
    }
  }, [downloadJson]);

  const importMarketBundle = useCallback(async () => {
    setMarketMsg("");
    let bundle;
    try {
      bundle = JSON.parse(marketImportText || "{}");
    } catch (e) {
      setMarketMsg(`Invalid JSON: ${e?.message || String(e)}`);
      return;
    }
    try {
      const nextAgentSettings = bundle?.agentSettings;
      if (nextAgentSettings && typeof nextAgentSettings === "object" && !Array.isArray(nextAgentSettings)) {
        const r = await fetch("/api/agent-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextAgentSettings),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `agent-settings: HTTP ${r.status}`);
        fetchAgentSettingsIntoState();
      }

      const items = Array.isArray(bundle?.playbooks) ? bundle.playbooks : [];
      let ok = 0;
      let fail = 0;
      for (const pb of items.slice(0, 200)) {
        const payload = {
          title: String(pb?.title || "PLAYBOOK"),
          desc: String(pb?.desc || ""),
          color: String(pb?.color || "#c8a050"),
          intervalMs: Number(pb?.intervalMs || 60000),
          agentId: String(pb?.agentId || "random"),
          taskText: String(pb?.taskText || pb?.desc || pb?.title || "playbook run"),
          enabled: Boolean(pb?.enabled ?? true),
        };
        try {
          const r = await fetch("/api/playbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const j = await r.json().catch(() => null);
          if (!r.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
          ok++;
        } catch {
          fail++;
        }
      }
      fetchPlaybooksIntoState();
      setMarketMsg(`Imported. Playbooks: ${ok} ok, ${fail} failed${items.length > 200 ? " (capped at 200)" : ""}.`);
    } catch (e) {
      setMarketMsg(`Import failed: ${e?.message || String(e)}`);
    }
  }, [marketImportText]);

  const curatedToolCards = useMemo(() => ([
    {
      title: "List sessions",
      desc: "Sanity-check that the gateway is reachable.",
      tool: "sessions_list",
      action: "json",
      args: {},
    },
    {
      title: "List tools",
      desc: "Discover available tools exposed by the gateway/agent.",
      tool: "tools_list",
      action: "json",
      args: {},
    },
    {
      title: "Ping (echo)",
      desc: "Simple smoke test with a minimal payload.",
      tool: "echo",
      action: "json",
      args: { message: "ping" },
    },
  ]), []);

  const runToolCard = useCallback(async (card) => {
    setMarketToolOutput("");
    setMarketMsg("");
    setMarketToolBusy(true);
    try {
      const agentId = toolAgent || "alpha";
      const s = agentSettings?.[agentId] || {};
      const openclawAgentId = (s.openclawAgentId || "").trim() || undefined;
      const r = await fetch("/api/tools/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          openclawAgentId,
          tool: String(card.tool || "").trim(),
          action: String(card.action || "").trim() || undefined,
          args: card.args && typeof card.args === "object" ? card.args : {},
        }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        const msg = json?.error?.message || json?.error?.type || json?.error || json?.message || `HTTP ${r.status}`;
        setMarketToolOutput(sanitizePreview(json || msg, 2000));
        setMarketMsg(`Tool card failed: ${msg}`);
        return;
      }
      setMarketToolOutput(sanitizePreview(json, 4000));
      if (json?.ok) setMarketMsg("Tool card ran successfully.");
      else setMarketMsg("Tool card returned a non-ok response.");
    } catch (e) {
      setMarketMsg(`Tool card error: ${e?.message || String(e)}`);
      setMarketToolOutput(sanitizePreview(e?.message || String(e), 2000));
    } finally {
      setMarketToolBusy(false);
    }
  }, [toolAgent, agentSettings, sanitizePreview]);

  const analyticsEvents = useMemo(() => {
    let rows = Array.isArray(archivedEvents) ? archivedEvents : [];
    if (analyticsAgent !== "all") rows = rows.filter(e => e.agentId === analyticsAgent);
    if (analyticsType !== "all") rows = rows.filter(e => (e.type || "event") === analyticsType);
    if (analyticsErrorsOnly) rows = rows.filter(e => e.ok === false);
    return rows.slice(0, Math.max(10, Math.min(500, Number(analyticsLimit) || 300)));
  }, [archivedEvents, analyticsAgent, analyticsType, analyticsErrorsOnly, analyticsLimit]);

  const analyticsSummary = useMemo(() => {
    const rows = analyticsEvents;
    const total = rows.length;
    const errors = rows.filter(e => e.ok === false).length;
    const ok = total - errors;
    const msVals = rows.map(e => e.ms).filter(n => Number.isFinite(Number(n))).map(Number);
    const avg = msVals.length ? Math.round(msVals.reduce((a, b) => a + b, 0) / msVals.length) : null;
    const p95 = pct(msVals, 95);
    const byAgent = {};
    const byType = {};
    rows.forEach(e => {
      const a = e.agentId || "unknown";
      const t = e.type || "event";
      byAgent[a] = (byAgent[a] || 0) + 1;
      byType[t] = (byType[t] || 0) + 1;
    });
    const topAgents = Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const recentErrors = rows.filter(e => e.ok === false).slice(0, 8);
    return { total, ok, errors, avg, p95, topAgents, topTypes, recentErrors };
  }, [analyticsEvents, pct]);

  const logObs = useCallback((evt) => {
    const e = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      ts: Date.now(),
      ...evt,
    };
    setObsEvents(prev => [e, ...prev].slice(0, 120));
    // Best-effort persist to server for History/Playbooks/Inbox wiring.
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e),
    }).catch(() => {});

    if (e.agentId) {
      setObsStatsByAgent(prev => {
        const cur = prev[e.agentId] || { calls: 0, errors: 0, timeMs: 0, inTok: 0, outTok: 0 };
        const next = {
          calls: cur.calls + 1,
          errors: cur.errors + (e.ok ? 0 : 1),
          timeMs: cur.timeMs + (Number(e.ms) || 0),
          inTok: cur.inTok + (Number(e.inTok) || 0),
          outTok: cur.outTok + (Number(e.outTok) || 0),
        };
        return { ...prev, [e.agentId]: next };
      });
    }
  }, []);

  const getActiveBuffs = useCallback((agentId) => {
    const now = Date.now();
    const b = buffsRef.current?.[agentId] || {};
    const active = [];
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v.until === "number" && v.until > now) active.push({ key: k, ...v });
    }
    active.sort((a, b) => (b.until || 0) - (a.until || 0));
    return active;
  }, []);

  const formatBuffLine = useCallback((agentId) => {
    const active = getActiveBuffs(agentId);
    if (!active.length) return "";
    const names = active.map(x => x.label || x.key).join(", ");
    return `Active buffs: ${names}.`;
  }, [getActiveBuffs]);

  const grantBuff = useCallback((agentId, buff) => {
    const now = Date.now();
    if (!agentId) return;
    const next = {
      ...(buff || {}),
      until: now + Math.max(5_000, Number(buff?.ms) || 60_000),
    };
    const cur = buffsRef.current[agentId] || {};
    buffsRef.current[agentId] = { ...cur, [buff.key]: next };
    setBuffsTick(t => t + 1);
    logObs({
      type: "buff",
      agentId,
      label: `buff gained: ${next.label || buff.key}`,
      ok: true,
      ms: 0,
      inTok: 0,
      outTok: 0,
      req: sanitizePreview(next, 600),
      res: "",
    });

    if (buff.key === "sports_sync") {
      // Best-effort: generate a short team sync recap into Inbox.
      (async () => {
        try {
          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              agentName: AGENTS.find(a => a.id === agentId)?.name,
              agentRole: AGENTS.find(a => a.id === agentId)?.role,
              intent: "sports_sync",
              message:
                "You are currently socializing/playing in the sports room. Produce a short 5-bullet team sync recap: what you're doing, what you learned, and next actions. Keep it tight.",
              history: [],
            }),
          });
          const json = await r.json().catch(() => null);
          const text = json?.text || "";
          await fetch("/api/inbox", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId,
              title: "Team Sync recap (sports room)",
              body: text || "Sync buff triggered, but recap generation failed.",
              status: "open",
            }),
          });
        } catch {
          // ignore
        }
      })();
    }
  }, [logObs, sanitizePreview]);

  const getTimeoutsForAgent = useCallback((agentId) => {
    const active = getActiveBuffs(agentId).map(b => b.key);
    const stamina = active.includes("gym_stamina");
    const recovery = active.includes("cafe_recovery");
    return {
      toolMs: stamina ? 45_000 : 30_000,
      streamIdleMs: stamina ? 40_000 : (recovery ? 30_000 : 25_000),
    };
  }, [getActiveBuffs]);

  const refreshPlaybooks = useCallback(async () => {
    try {
      const r = await fetch("/api/playbooks");
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) return;
      if (Array.isArray(json.playbooks)) setPlaybooks(json.playbooks);
    } catch {
      // ignore
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const r = await fetch("/api/events?limit=200");
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) return;
      if (Array.isArray(json.events)) setArchivedEvents(json.events);
    } catch {
      // ignore
    }
  }, []);

  const refreshAgentSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/agent-settings");
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) return;
      setAgentSettings(json.settings || {});
    } catch {
      // ignore
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    const t0 = performance.now();
    try {
      const r = await fetch("/api/health");
      const json = await r.json().catch(() => null);
      const ms = Math.round(performance.now() - t0);
      if (!r.ok || !json?.ok) {
        setServerHealthMeta({ ok: false, ms, error: `HTTP ${r.status}`, at: Date.now() });
        return;
      }
      setServerHealth(json);
      setServerHealthMeta({ ok: true, ms, error: "", at: Date.now() });
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      setServerHealthMeta({ ok: false, ms, error: e?.message || String(e), at: Date.now() });
    }
  }, []);

  const getAgentRoute = useCallback((agentId) => {
    const s = agentSettings?.[agentId] || {};
    return {
      openclawAgentId: (s.openclawAgentId || "").trim() || undefined,
      model: (s.model || "").trim() || undefined,
    };
  }, [agentSettings]);

  // Detect activity starts and grant buffs.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      let changed = false;

      for (const a of AGENTS) {
        const id = a.id;
        const flags = lastActivityFlagsRef.current[id] || { gyming: false, cafe: false, playing: false };
        const target = agentTargetsRef.current?.[id];
        const gyming = Boolean(target?.gyming);
        const cafe = Boolean(target?.cafeSitting);
        const playing = Boolean(target?.playing);

        if (gyming && !flags.gyming) {
          grantBuff(id, { key: "gym_stamina", label: "Stamina+", ms: 90_000 });
          grantBuff(id, { key: "gym_focus", label: "Focus+", ms: 90_000 });
          changed = true;
        }
        if (cafe && !flags.cafe) {
          grantBuff(id, { key: "cafe_recovery", label: "Recovery+", ms: 60_000 });
          grantBuff(id, { key: "cafe_creativity", label: "Creativity+", ms: 60_000 });
          changed = true;
        }
        if (playing && !flags.playing) {
          grantBuff(id, { key: "sports_sync", label: "Team Sync+", ms: 75_000 });
          changed = true;
        }

        lastActivityFlagsRef.current[id] = { gyming, cafe, playing };
      }

      // Expiry tick (for UI refresh)
      if (changed) setBuffsTick(t => t + 1);
      // Also periodically tick so “remaining” updates.
      if (now % 5_000 < 500) setBuffsTick(t => t + 1);
    }, 500);
    return () => clearInterval(t);
  }, [grantBuff]);

  // ===== Runtime activity (must be defined before invokeTool/runTask callbacks) =====

  useEffect(() => {
    refreshPlaybooks();
    refreshEvents();
    refreshAgentSettings();
    refreshHealth();
    const t = setInterval(() => {
      refreshEvents();
      refreshPlaybooks();
      refreshHealth();
    }, 2500);
    return () => clearInterval(t);
  }, [refreshEvents, refreshPlaybooks, refreshAgentSettings, refreshHealth]);

  const ensureTerminalAgent = useCallback((agentId) => {
    if (!terminalLogsRef.current[agentId]) terminalLogsRef.current[agentId] = [];
  }, []);

  const appendTerminal = useCallback((agentId, text, type = "output") => {
    ensureTerminalAgent(agentId);
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    terminalLogsRef.current[agentId].push({ text, type, ts });
    if (terminalLogsRef.current[agentId].length > 400) terminalLogsRef.current[agentId] = terminalLogsRef.current[agentId].slice(-300);
    setTerminalTick(t => t + 1);
  }, [ensureTerminalAgent]);

  const cancelTask = useCallback((taskId) => {
    const ctrl = taskAbortRef.current[taskId];
    if (ctrl) ctrl.abort();
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "cancelled", endedAt: Date.now() } : t));
  }, []);

  const promoteTaskToReport = useCallback(async (task) => {
    const agent = AGENTS.find(a => a.id === task.agentId);
    const source = (task.result || (task.log || []).join("\n")).trim();
    if (!source) return;
    appendTerminal(task.agentId, "REPORT> promoting task output…", "info");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: task.agentId,
          agentName: agent?.name,
          agentRole: agent?.role,
          intent: "promote_report",
          message:
            "Convert the following task output into a concise markdown report with sections: Summary, Key points, Next actions.\n\n" +
            source,
          history: [],
        }),
      });
      const json = await r.json().catch(() => null);
      const text = json?.text;
      if (!r.ok || typeof text !== "string") {
        appendTerminal(task.agentId, `REPORT> failed (${r.status})`, "warning");
        return;
      }
      setReports(prev => [{ id: Date.now(), agentId: task.agentId, title: task.desc.slice(0, 64), md: text, createdAt: Date.now() }, ...prev]);
      appendTerminal(task.agentId, "REPORT> saved to Reports.", "success");
    } catch (e) {
      appendTerminal(task.agentId, `REPORT> error: ${e?.message || String(e)}`, "warning");
    }
  }, [appendTerminal]);

  const generateFollowupSubtasks = useCallback(async (task) => {
    const agent = AGENTS.find(a => a.id === task.agentId);
    const source = (task.result || (task.log || []).join("\n")).trim();
    if (!source) return;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: task.agentId,
          agentName: agent?.name,
          agentRole: agent?.role,
          intent: "followup_subtasks",
          message:
            "Based on this completed task, propose 1-3 short follow-up tasks. Output ONLY JSON: {\"subtasks\":[{\"desc\":\"...\"}]}.\n\n" +
            source,
          history: [],
        }),
      });
      const json = await r.json().catch(() => null);
      const text = json?.text || "";
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      const subs = parsed?.subtasks;
      if (!Array.isArray(subs) || subs.length === 0) return;
      const now = Date.now();
      const newTasks = subs
        .filter(s => typeof s?.desc === "string" && s.desc.trim().length)
        .slice(0, 3)
        .map((s, i) => ({
          id: now + 10 + i,
          agent: agent?.name || "Agent",
          agentId: task.agentId,
          desc: s.desc.trim(),
          status: "pending",
          log: [],
          result: "",
          parentId: task.id,
          createdAt: Date.now(),
        }));
      if (newTasks.length) {
        setTasks(prev => [...newTasks, ...prev]);
        appendTerminal(task.agentId, `SUBTASKS> queued ${newTasks.length} follow-ups`, "info");
      }
    } catch {
      // ignore follow-up failures (non-critical)
    }
  }, [appendTerminal]);

  const saveArtifactFromTask = useCallback((task) => {
    const content = (task.result || (task.log || []).join("\n")).trim();
    if (!content) return;
    const id = Date.now();
    setArtifacts(prev => [
      { id, agentId: task.agentId, title: task.desc.slice(0, 64), content, createdAt: Date.now(), pushed: false },
      ...prev,
    ]);
    appendTerminal(task.agentId, "NOTE> saved to File Cabinet.", "info");
  }, [appendTerminal]);

  const saveArtifactFromReport = useCallback((report) => {
    const content = (report.md || "").trim();
    if (!content) return;
    const id = Date.now();
    setArtifacts(prev => [
      { id, agentId: report.agentId, title: report.title, content, createdAt: Date.now(), pushed: false },
      ...prev,
    ]);
  }, []);

  const pushArtifactToMemory = useCallback(async (artifact) => {
    const agent = AGENTS.find(a => a.id === artifact.agentId);
    const t0 = performance.now();
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: artifact.agentId,
          agentName: agent?.name,
          agentRole: agent?.role,
          intent: "memory",
          message:
            "Store the following note into your long-term memory. Do not echo it back; just acknowledge internally.\n\n" +
            artifact.content,
          history: [],
        }),
      });
      if (!r.ok) {
        appendTerminal(artifact.agentId, `MEMORY> failed (${r.status})`, "warning");
        logObs({
          type: "memory",
          agentId: artifact.agentId,
          label: "push note to memory",
          ok: false,
          status: r.status,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens(artifact.content),
          outTok: 0,
          req: sanitizePreview({ intent: "memory", note: artifact.content }, 700),
          res: sanitizePreview(`HTTP ${r.status}`, 900),
        });
        return;
      }
      setArtifacts(prev => prev.map(a => a.id === artifact.id ? { ...a, pushed: true } : a));
      appendTerminal(artifact.agentId, "MEMORY> note forwarded to OpenClaw.", "success");
      logObs({
        type: "memory",
        agentId: artifact.agentId,
        label: "push note to memory",
        ok: true,
        status: r.status,
        ms: Math.round(performance.now() - t0),
        inTok: approxTokens(artifact.content),
        outTok: 0,
        req: sanitizePreview({ intent: "memory", note: artifact.content }, 700),
        res: sanitizePreview("ok", 900),
      });
    } catch (e) {
      appendTerminal(artifact.agentId, `MEMORY> error: ${e?.message || String(e)}`, "warning");
      logObs({
        type: "memory",
        agentId: artifact.agentId,
        label: "push note to memory",
        ok: false,
        error: e?.name === "AbortError" ? "timeout" : (e?.message || String(e)),
        ms: Math.round(performance.now() - t0),
        inTok: approxTokens(artifact.content),
        outTok: 0,
        req: sanitizePreview({ intent: "memory", note: artifact.content }, 700),
        res: sanitizePreview(e?.name === "AbortError" ? "timeout" : (e?.message || String(e)), 900),
      });
    }
  }, [appendTerminal, approxTokens, sanitizePreview, logObs]);

  // ===== Runtime activity + desk auto-walk (must be above invokeTool/runTask) =====
  const agentActivityRef = useRef((() => {
    const m = {};
    AGENTS.forEach(a => { m[a.id] = { thinking: 0, tool: 0, errorUntil: 0 }; });
    return m;
  })());

  const runtimeToColor = useCallback((runtime) => {
    if (runtime === "error") return 0xff4d4d;
    if (runtime === "tool") return 0x9945ff;
    if (runtime === "thinking") return 0x00d1ff;
    return 0xffaa22;
  }, []);

  const computeRuntime = useCallback((st) => {
    const now = Date.now();
    if (st.errorUntil && st.errorUntil > now) return "error";
    if ((st.tool || 0) > 0) return "tool";
    if ((st.thinking || 0) > 0) return "thinking";
    return "idle";
  }, []);

  const applyAgentRuntime = useCallback((agentId) => {
    const st = agentActivityRef.current?.[agentId] || { thinking: 0, tool: 0, errorUntil: 0 };
    const runtime = computeRuntime(st);
    setAgents(prev => prev.map(a => {
      if (a.id !== agentId) return a;
      const nextStatus = runtime === "idle" ? "idle" : "working";
      return { ...a, runtime, status: nextStatus };
    }));
    const mesh = agentMeshesRef.current?.[agentId];
    if (mesh?.userData?.ring?.material) {
      mesh.userData.ring.material.color.set(runtimeToColor(runtime));
    }
  }, [computeRuntime, runtimeToColor]);

  const bumpAgentActivity = useCallback((agentId, patch) => {
    if (!agentId) return;
    const cur = agentActivityRef.current[agentId] || { thinking: 0, tool: 0, errorUntil: 0 };
    const next = {
      thinking: Math.max(0, (cur.thinking || 0) + (patch.thinking || 0)),
      tool: Math.max(0, (cur.tool || 0) + (patch.tool || 0)),
      errorUntil: patch.error ? Math.max(cur.errorUntil || 0, Date.now() + (patch.errorMs || 8000)) : (cur.errorUntil || 0),
    };
    agentActivityRef.current[agentId] = next;
    applyAgentRuntime(agentId);
  }, [applyAgentRuntime]);

  const commandAgentToDesk = useCallback((agentId) => {
    const t = agentTargetsRef.current?.[agentId];
    const m = agentMeshesRef.current?.[agentId];
    const seat = seatPositionsRef.current?.[agentId];
    if (!t) return;
    // Clear activities and head to desk.
    t.sitting = false; t.goToDesk = true; t.commanded = true;
    t.sofaSitting = false; t.goToSofa = false; t.sofaSeatIdx = -1;
    t.cafeSitting = false; t.goToCafe = false; t.cafeSpotIdx = -1; t.cafeTimer = 0;
    t.gyming = false; t.goToGym = false; t.gymSpotIdx = -1; t.gymTimer = 0; t.gymActivity = "";
    t.playing = false; t.goToGame = false; t.gameSpotIdx = -1; t.playTimer = 0;
    if (seat) {
      t.x = seat.x;
      t.z = seat.z;
    }
    if (m) m.position.y = 0;
  }, []);

  const invokeTool = useCallback(async () => {
    const agentId = toolAgent;
    const agent = AGENTS.find(a => a.id === agentId);
    let argsObj = {};
    try {
      argsObj = toolArgsText.trim() ? JSON.parse(toolArgsText) : {};
    } catch (e) {
      const errText = `Tool args JSON error: ${e?.message || String(e)}`;
      appendTerminal(agentId, errText, "warning");
      return;
    }

    setToolBusy(true);
    appendTerminal(agentId, `TOOL> ${toolName}${toolAction ? ` (${toolAction})` : ""}`, "info");
    commandAgentToDesk(agentId);
    bumpAgentActivity(agentId, { tool: 1 });
    const route = getAgentRoute(agentId);
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), getTimeoutsForAgent(agentId).toolMs);
    try {
      const r = await fetch("/api/tools/invoke", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          openclawAgentId: route.openclawAgentId,
          tool: toolName.trim(),
          action: toolAction.trim() || undefined,
          args: argsObj,
        }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json) {
        appendTerminal(agentId, `Tool invoke failed (${r.status}).`, "warning");
        if (json) appendTerminal(agentId, JSON.stringify(json).slice(0, 1200), "warning");
        logObs({
          type: "tool",
          agentId,
          label: `${toolName}${toolAction ? ` (${toolAction})` : ""}`,
          ok: false,
          status: r.status,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens({ tool: toolName, action: toolAction, args: argsObj }),
          outTok: approxTokens(json ? JSON.stringify(json) : ""),
          req: sanitizePreview({ tool: toolName, action: toolAction, args: argsObj }, 700),
          res: sanitizePreview(json ? json : `HTTP ${r.status}`, 900),
        });
        bumpAgentActivity(agentId, { error: true });
        return;
      }
      if (json.ok) {
        const out = typeof json.result === "string" ? json.result : JSON.stringify(json.result, null, 2);
        appendTerminal(agentId, out.slice(0, 4000), "output");
        setActivityLog(prev => [{ time: timeStr(), hl: agent?.name || "Tool", text: `tool: ${toolName}` }, ...prev].slice(0, 50));
        logObs({
          type: "tool",
          agentId,
          label: `${toolName}${toolAction ? ` (${toolAction})` : ""}`,
          ok: true,
          status: r.status,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens({ tool: toolName, action: toolAction, args: argsObj }),
          outTok: approxTokens(out),
          req: sanitizePreview({ tool: toolName, action: toolAction, args: argsObj }, 700),
          res: sanitizePreview(out, 900),
        });
      } else {
        appendTerminal(agentId, JSON.stringify(json).slice(0, 2000), "warning");
        logObs({
          type: "tool",
          agentId,
          label: `${toolName}${toolAction ? ` (${toolAction})` : ""}`,
          ok: false,
          status: r.status,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens({ tool: toolName, action: toolAction, args: argsObj }),
          outTok: approxTokens(JSON.stringify(json)),
          req: sanitizePreview({ tool: toolName, action: toolAction, args: argsObj }, 700),
          res: sanitizePreview(json, 900),
        });
        bumpAgentActivity(agentId, { error: true });
      }
    } catch (e) {
      appendTerminal(agentId, `Tool network error: ${e?.message || String(e)}`, "warning");
      logObs({
        type: "tool",
        agentId,
        label: `${toolName}${toolAction ? ` (${toolAction})` : ""}`,
        ok: false,
        error: e?.name === "AbortError" ? "timeout" : (e?.message || String(e)),
        ms: Math.round(performance.now() - t0),
        inTok: approxTokens({ tool: toolName, action: toolAction, args: argsObj }),
        outTok: 0,
        req: sanitizePreview({ tool: toolName, action: toolAction, args: argsObj }, 700),
        res: sanitizePreview(e?.name === "AbortError" ? "timeout" : (e?.message || String(e)), 900),
      });
      bumpAgentActivity(agentId, { error: true });
    } finally {
      clearTimeout(timeout);
      setToolBusy(false);
      bumpAgentActivity(agentId, { tool: -1 });
    }
  }, [toolAgent, toolName, toolAction, toolArgsText, appendTerminal, approxTokens, sanitizePreview, logObs, commandAgentToDesk, bumpAgentActivity, getTimeoutsForAgent, getAgentRoute]);

  const toggleMusic = useCallback(async () => {
    if (musicPlaying) {
      if (musicRef.current) {
        musicRef.current.forEach(n => n.dispose());
        musicRef.current = null;
      }
      Tone.getTransport().stop();
      setMusicPlaying(false);
      return;
    }

    await Tone.start();

    const reverb = new Tone.Reverb({ decay: 8, wet: 0.7 }).toDestination();
    const delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.25 }).connect(reverb);
    const filter = new Tone.Filter({ frequency: 800, type: "lowpass" }).connect(delay);

    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 3, sustain: 0.4, release: 4 },
      volume: -18
    }).connect(filter);

    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2 },
      volume: -22
    }).connect(delay);

    const chords = [
      ["C3", "E3", "G3", "B3"],
      ["A2", "C3", "E3", "G3"],
      ["F2", "A2", "C3", "E3"],
      ["G2", "B2", "D3", "F3"],
    ];
    const melodyNotes = ["E4", "G4", "B4", "A4", "G4", "E4", "D4", "C4", "E4", "G4", "A4", "B4"];
    let chordIdx = 0;
    let melodyIdx = 0;

    const chordLoop = new Tone.Loop((time) => {
      pad.triggerAttackRelease(chords[chordIdx % chords.length], "3n", time);
      chordIdx++;
    }, "2m");

    const melodyLoop = new Tone.Loop((time) => {
      if (Math.random() > 0.35) {
        pluck.triggerAttackRelease(melodyNotes[melodyIdx % melodyNotes.length], "8n", time);
      }
      melodyIdx++;
    }, "4n");

    chordLoop.start(0);
    melodyLoop.start("1m");
    Tone.getTransport().bpm.value = 65;
    Tone.getTransport().start();

    musicRef.current = [pad, pluck, reverb, delay, filter, chordLoop, melodyLoop];
    setMusicPlaying(true);
  }, [musicPlaying]);

  useEffect(() => {
    return () => {
      if (musicRef.current) {
        musicRef.current.forEach(n => n.dispose());
        Tone.getTransport().stop();
      }
    };
  }, []);

  // Auto-play music on first user interaction
  useEffect(() => {
    const autoStart = () => {
      if (!musicAutoStarted.current) {
        musicAutoStarted.current = true;
        toggleMusic();
        window.removeEventListener("mousedown", autoStart);
        window.removeEventListener("wheel", autoStart);
        window.removeEventListener("keydown", autoStart);
      }
    };
    window.addEventListener("mousedown", autoStart);
    window.addEventListener("wheel", autoStart);
    window.addEventListener("keydown", autoStart);
    return () => {
      window.removeEventListener("mousedown", autoStart);
      window.removeEventListener("wheel", autoStart);
      window.removeEventListener("keydown", autoStart);
    };
  }, [toggleMusic]);

  const chatEndRef = useRef(null);
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  // ===== THREE.JS SCENE SETUP =====
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const frustum = 12;

    const camera = new THREE.OrthographicCamera(-frustum * aspect, frustum * aspect, frustum, -frustum, -100, 100);
    camera.position.set(20, 20, 20);
    // Safe initial look target. We'll retarget to the outdoor center after stairs/ground are computed.
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0x556677, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    // Expand shadow frustum to cover the whole map (office + sports + gym + cafeteria).
    // The default bounds only cover the main office area, so other rooms won't receive/cast shadows.
    dirLight.shadow.camera.left = -90;
    dirLight.shadow.camera.right = 90;
    dirLight.shadow.camera.top = 90;
    dirLight.shadow.camera.bottom = -90;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 140;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLight(0x9945ff, 0.15).translateX(-10).translateY(10).translateZ(-10));

    const mat = (c, em = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: em, emissiveIntensity: ei });

    // Floor (main office only)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 14), mat(0xd4c5a0));
    floor.position.set(0, -0.1, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const gm = mat(0xc4b590);
    for (let i = -9; i <= 9; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(i, 0.01, 0); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(18, 0.01, 0.02), gm); l.position.set(0, 0.01, i); scene.add(l); }

    // Walls
    const wm = mat(0x888888);
    const wallH = 1.5;
    // Back wall (main office only)
    const bw = new THREE.Mesh(new THREE.BoxGeometry(18, wallH, 0.15), wm); bw.position.set(0, wallH / 2, -7); bw.castShadow = true; scene.add(bw);
    // Left wall
    const lw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); lw.position.set(-9, wallH / 2, 0); lw.castShadow = true; scene.add(lw);
    // Right wall (main office only, x:9)
    const rw = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm); rw.position.set(9, wallH / 2, 0); rw.castShadow = true; scene.add(rw);
    // Front wall left
    const fwl = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwl.position.set(-6, wallH / 2, 7); scene.add(fwl);
    // Front wall middle-right (original)
    const fwr = new THREE.Mesh(new THREE.BoxGeometry(6, wallH, 0.15), wm); fwr.position.set(6, wallH / 2, 7); scene.add(fwr);

    // ===== STAIRCASE going down from front entrance =====
    const stairMat = mat(0x999990);
    const stairWidth = 4;
    const numSteps = 6;
    const stepDrop = 0.22; // Y drop per step
    const stepDepth = 0.6; // Z depth per step
    for (let i = 0; i < numSteps; i++) {
      const stepY = -i * stepDrop;
      const stepZ = 7.3 + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.22, stepDepth), stairMat);
      step.position.set(0, stepY, stepZ); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }
    // Ground outside — top surface meets the last step
    const lastStepY = -(numSteps - 1) * stepDrop; // Y of last step center
    const lastStepZ = 7.3 + (numSteps - 1) * stepDepth + stepDepth / 2; // front edge of last step
    // Outdoor ground is now a full park (grass base + paths + landscaping)
    const outsideGround = new THREE.Mesh(new THREE.BoxGeometry(50, 0.22, 25), mat(0x2f6b3a));
    outsideGround.position.set(6, lastStepY, lastStepZ + 12.5);
    outsideGround.receiveShadow = true; scene.add(outsideGround);

    // ===== CITY PARK (dense + beautiful) =====
    const parkCenter = { x: 15, z: lastStepZ + 12.5 }; // center of outdoor platform
    const park = new THREE.Group();

    // Deterministic RNG so the park looks stable every reload
    let seed = 20260316;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const groundCenter = { x: 6, z: lastStepZ + 12.5 };
    // Initialize orbit target to the outdoor ground center
    cameraStateRef.current.target.set(groundCenter.x, 0, groundCenter.z);
    const halfW = 25;
    const halfD = 12.5;

    const pathMat = mat(0xb7b09d);
    const stoneMat = mat(0x666666);
    const hedgeMat = mat(0x1f6a3a);
    const woodMat = mat(0x6a4a2a);
    const metalMat = mat(0x555560);

    // Curved-ish paths using short segments (cheap)
    const pathY = lastStepY + 0.145;
    function addPathSegment(x, z, w, d, rot = 0) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), pathMat);
      seg.position.set(x, pathY, z);
      seg.rotation.y = rot;
      seg.receiveShadow = true;
      park.add(seg);
    }

    // Main loop path around the park (rounded rectangle)
    for (let i = 0; i < 18; i++) {
      const t = i / 18;
      const ang = t * Math.PI * 2;
      const rx = 18.5;
      const rz = 8.5;
      const x = groundCenter.x + Math.cos(ang) * rx;
      const z = groundCenter.z + Math.sin(ang) * rz;
      const rot = Math.atan2(Math.cos(ang) * rz, -Math.sin(ang) * rx);
      addPathSegment(x, z, 3.3, 1.3, rot);
    }

    // Two diagonals for visual richness
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      addPathSegment(groundCenter.x - 18 + t * 36, groundCenter.z - 6 + t * 12, 3.0, 1.2, Math.PI / 4);
      addPathSegment(groundCenter.x - 18 + t * 36, groundCenter.z + 6 - t * 12, 3.0, 1.2, -Math.PI / 4);
    }

    // Dense pond (bigger than the Japanese garden pond)
    const pondBase = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 10.5), stoneMat);
    pondBase.position.set(parkCenter.x, lastStepY + 0.16, parkCenter.z + 1.6);
    pondBase.castShadow = true; pondBase.receiveShadow = true;
    park.add(pondBase);
    const pondWater = new THREE.Mesh(new THREE.BoxGeometry(17.0, 0.07, 9.6), mat(0x0b2a44, 0x003a66, 0.5));
    pondWater.position.set(parkCenter.x, lastStepY + 0.2, parkCenter.z + 1.6);
    pondWater.receiveShadow = true;
    pondWater.userData.parkWater = true;
    park.add(pondWater);
    scene.userData.parkWater = pondWater;

    // A simple footbridge across the pond
    const bridge = new THREE.Group();
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 1.4), woodMat);
    bridgeDeck.castShadow = true; bridgeDeck.receiveShadow = true;
    bridgeDeck.position.y = 0.35;
    bridge.add(bridgeDeck);
    const railL = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 0.08), woodMat);
    railL.position.set(0, 0.55, -0.65); railL.castShadow = true; bridge.add(railL);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 0.08), woodMat);
    railR.position.set(0, 0.55, 0.65); railR.castShadow = true; bridge.add(railR);
    bridge.position.set(parkCenter.x, lastStepY + 0.12, parkCenter.z + 1.6);
    bridge.rotation.y = Math.PI / 2;
    bridge.userData.parkBridge = true;
    park.add(bridge);
    scene.userData.parkBridge = bridge;

    // Hedges (borders + a couple of interior walls)
    function addHedge(x, z, w, d, rot = 0) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), hedgeMat);
      h.position.set(x, lastStepY + 0.27, z);
      h.rotation.y = rot;
      h.castShadow = true; h.receiveShadow = true;
      park.add(h);
    }
    // Outer border
    addHedge(groundCenter.x, groundCenter.z - (halfD - 1.2), 46, 0.55);
    addHedge(groundCenter.x, groundCenter.z + (halfD - 1.2), 46, 0.55);
    addHedge(groundCenter.x - (halfW - 1.2), groundCenter.z, 0.55, 22, 0);
    addHedge(groundCenter.x + (halfW - 1.2), groundCenter.z, 0.55, 22, 0);
    // Interior hedges
    addHedge(groundCenter.x - 10, groundCenter.z + 1.5, 14, 0.5, 0.2);
    addHedge(groundCenter.x - 2, groundCenter.z - 4.0, 12, 0.5, -0.25);

    // Trees (denser)
    function mkTree(x, z, s = 1) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.15 * s, 1.15 * s, 10), mat(0x5a3a22));
      trunk.position.set(x, lastStepY + 0.58 * s, z);
      trunk.castShadow = true; trunk.receiveShadow = true;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.7 * s, 14, 14), mat(0x2e7a3f));
      crown.position.set(x, lastStepY + 1.35 * s, z);
      crown.castShadow = true; crown.receiveShadow = true;
      park.add(trunk); park.add(crown);
    }
    for (let i = 0; i < 85; i++) {
      const x = groundCenter.x + (rnd() * 2 - 1) * (halfW - 2.5);
      const z = groundCenter.z + (rnd() * 2 - 1) * (halfD - 2.0);
      const nearPond = Math.abs(x - (parkCenter.x + 9.5)) < 10 && Math.abs(z - (parkCenter.z + 1.6)) < 7;
      const nearEntrance = Math.abs(x - 0) < 3.2 && z < groundCenter.z - 6;
      if (nearPond || nearEntrance) continue;
      mkTree(x, z, 0.75 + rnd() * 0.6);
    }

    // Flowerbeds
    function mkFlowerBed(x, z, w, d, baseColor = 0x2a2a30) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(baseColor));
      bed.position.set(x, lastStepY + 0.145, z);
      bed.receiveShadow = true; park.add(bed);
      const colors = [0xff6b6b, 0x00d1ff, 0xffaa22, 0x14f195];
      for (let i = 0; i < 26; i++) {
        const fx = x + (rnd() * 2 - 1) * (w * 0.44);
        const fz = z + (rnd() * 2 - 1) * (d * 0.44);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08 + rnd() * 0.06, 8, 8), mat(colors[Math.floor(rnd() * colors.length)]));
        bloom.position.set(fx, lastStepY + 0.22 + rnd() * 0.05, fz);
        bloom.castShadow = true;
        park.add(bloom);
      }
    }
    mkFlowerBed(groundCenter.x - 16, groundCenter.z - 7.8, 7.5, 3.2);
    mkFlowerBed(groundCenter.x + 16, groundCenter.z + 7.8, 7.5, 3.2);
    mkFlowerBed(groundCenter.x - 16, groundCenter.z + 7.8, 7.5, 3.2);

    // Playground (slide + swings)
    const playground = new THREE.Group();
    playground.position.set(groundCenter.x - 14.5, lastStepY + 0.12, groundCenter.z + 4.8);
    // Slide
    const slideLadder = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.7), metalMat);
    slideLadder.position.set(0, 0.55, -0.5); slideLadder.castShadow = true; playground.add(slideLadder);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.8), mat(0xffaa22));
    slide.position.set(1.2, 0.65, -0.5);
    slide.rotation.z = -0.45;
    slide.castShadow = true; slide.receiveShadow = true;
    playground.add(slide);
    // Swings frame
    const swingTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.08), metalMat);
    swingTop.position.set(0.8, 1.35, 1.4); swingTop.castShadow = true; playground.add(swingTop);
    [[-0.5, 1.4], [2.1, 1.4]].forEach(([sx, sz]) => {
      const legA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), metalMat);
      legA.position.set(sx, 0.7, sz - 0.35); legA.castShadow = true; playground.add(legA);
      const legB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), metalMat);
      legB.position.set(sx, 0.7, sz + 0.35); legB.castShadow = true; playground.add(legB);
    });
    // Swing seats
    for (let i = 0; i < 2; i++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.25), mat(0x222228));
      seat.position.set(0.2 + i * 1.2, 0.55, 1.4);
      seat.castShadow = true; seat.receiveShadow = true;
      seat.userData.parkSwing = true;
      seat.userData.swingPhase = rnd() * Math.PI * 2;
      playground.add(seat);
    }
    park.add(playground);
    scene.userData.parkPlayground = playground;

    // Benches
    function mkBench(x, z, rot = 0) {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.38), woodMat);
      seat.position.y = 0.35; seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.08), woodMat);
      back.position.set(0, 0.58, -0.15); back.castShadow = true; back.receiveShadow = true; g.add(back);
      [[-0.65, -0.14], [0.65, -0.14], [-0.65, 0.14], [0.65, 0.14]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), metalMat);
        leg.position.set(lx, 0.17, lz); leg.castShadow = true; g.add(leg);
      });
      g.position.set(x, lastStepY + 0.12, z);
      g.rotation.y = rot;
      park.add(g);
    }
    mkBench(groundCenter.x - 4.0, groundCenter.z - 9.0, 0);
    mkBench(groundCenter.x + 6.0, groundCenter.z + 9.0, Math.PI);
    mkBench(parkCenter.x + 2.0, parkCenter.z - 4.5, 0.2);

    // Lamps with glow pools
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3, transparent: true, opacity: 0.22, depthWrite: false });
    const lampPools = [];
    function mkLamp(x, z) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 10), metalMat);
      pole.position.set(x, lastStepY + 0.9, z);
      pole.castShadow = true;
      park.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), mat(0x0, 0xffe6a3, 1.15));
      head.position.set(x, lastStepY + 1.75, z);
      park.add(head);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.35, 22), glowMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, lastStepY + 0.155, z);
      pool.userData.parkLampPool = true;
      pool.userData.phase = rnd() * Math.PI * 2;
      park.add(pool);
      lampPools.push(pool);
    }
    mkLamp(groundCenter.x - 20, groundCenter.z - 7.5);
    mkLamp(groundCenter.x + 20, groundCenter.z - 7.5);
    mkLamp(groundCenter.x - 20, groundCenter.z + 7.5);
    mkLamp(groundCenter.x + 20, groundCenter.z + 7.5);
    mkLamp(groundCenter.x, groundCenter.z + 9.0);
    mkLamp(groundCenter.x, groundCenter.z - 9.0);

    scene.userData.parkLampPools = lampPools;
    scene.add(park);

    // ===== STAIRCASE on right side of ground going UP =====
    const groundRightEdge = 6 + 25; // ground center x + half width, no gap
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepX = groundRightEdge + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, 0.22, stairWidth), stairMat);
      step.position.set(stepX, stepY, lastStepZ + 12.5); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== STAIRCASE on left side of ground going UP =====
    const groundLeftEdge = 6 - 25; // ground center x - half width
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepX = groundLeftEdge - i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, 0.22, stairWidth), stairMat);
      step.position.set(stepX, stepY, lastStepZ + 12.5); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== STAIRCASE at bottom of ground going UP =====
    const groundBottomEdge = lastStepZ + 25;
    for (let i = 0; i < numSteps; i++) {
      const stepY = lastStepY + i * stepDrop;
      const stepZ = groundBottomEdge + i * stepDepth;
      const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.22, stepDepth), stairMat);
      step.position.set(0, stepY, stepZ); step.castShadow = true; step.receiveShadow = true; scene.add(step);
    }

    // ===== SPORTS ROOM — positioned at top of right staircase =====
    // Right stair top: x = groundRightEdge + (numSteps-1)*stepDepth = 31+3 = 34
    // Y at top = lastStepY + (numSteps-1)*stepDrop = 0
    // Z center = lastStepZ + 12.5
    const sportsX = 34 + 6; // center of sports room (offset from stair top)
    const sportsZ = lastStepZ + 12.5;
    const sportsY = 0; // same as building floor

    // Sports room floor
    const sportsFloor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 14), mat(0xcfbf95));
    sportsFloor.position.set(sportsX, sportsY - 0.1, sportsZ); sportsFloor.receiveShadow = true; scene.add(sportsFloor);

    // Sports room walls
    const srBackWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    srBackWall.position.set(sportsX, wallH / 2, sportsZ - 7); srBackWall.castShadow = true; scene.add(srBackWall);
    const srFrontWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    srFrontWall.position.set(sportsX, wallH / 2, sportsZ + 7); scene.add(srFrontWall);
    // Left wall — split with doorway for staircase entry (opening at center z, 4 units wide)
    const srLeftWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    srLeftWallTop.position.set(sportsX - 6, wallH / 2, sportsZ - 4.5); srLeftWallTop.castShadow = true; scene.add(srLeftWallTop);
    const srLeftWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    srLeftWallBot.position.set(sportsX - 6, wallH / 2, sportsZ + 4.5); srLeftWallBot.castShadow = true; scene.add(srLeftWallBot);
    const srRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    srRightWall.position.set(sportsX + 6, wallH / 2, sportsZ); srRightWall.castShadow = true; scene.add(srRightWall);

    // Sports room grid
    for (let i = -5; i <= 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(sportsX + i, 0.01, sportsZ); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(12, 0.01, 0.02), gm); l.position.set(sportsX, 0.01, sportsZ + i); scene.add(l); }

    // Billiard / Pool table
    const poolTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.4), mat(0x0a5c2a));
    poolTop.position.set(sportsX, 0.82, sportsZ - 3); poolTop.castShadow = true; scene.add(poolTop);
    const poolFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.6), mat(0x3a2a15));
    poolFrame.position.set(sportsX, 0.78, sportsZ - 3); poolFrame.castShadow = true; scene.add(poolFrame);
    [[-1.2,-0.6],[1.2,-0.6],[-1.2,0.6],[1.2,0.6]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), mat(0x3a2a15));
      leg.position.set(sportsX+lx, 0.38, sportsZ-3+lz); leg.castShadow = true; scene.add(leg);
    });
    const pocketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8);
    const pocketMat = mat(0x111111);
    [[-1.2,-0.6],[0,-0.6],[1.2,-0.6],[-1.2,0.6],[0,0.6],[1.2,0.6]].forEach(([px,pz]) => {
      const pocket = new THREE.Mesh(pocketGeo, pocketMat);
      pocket.position.set(sportsX+px, 0.87, sportsZ-3+pz); scene.add(pocket);
    });
    // Cue rack on back wall
    const cueRack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.08), mat(0x3a2a15));
    cueRack.position.set(sportsX, 0.8, sportsZ - 6.85); scene.add(cueRack);
    for (let ci = 0; ci < 3; ci++) {
      const cue = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.2, 0.02), mat(0xc8a050));
      cue.position.set(sportsX - 0.3 + ci * 0.3, 0.8, sportsZ - 6.82); scene.add(cue);
    }

    // Ping pong table
    const pp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 1.2), mat(0x1a5533));
    pp.position.set(sportsX, 0.75, sportsZ + 3); pp.castShadow = true; scene.add(pp);
    const ppn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 1.2), mat(0xcccccc));
    ppn.position.set(sportsX, 0.85, sportsZ + 3); scene.add(ppn);
    [[-0.9,-0.4],[0.9,-0.4],[-0.9,0.4],[0.9,0.4]].forEach(([lx,lz]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), mat(0x555555));
      l.position.set(sportsX+lx, 0.375, sportsZ+3+lz); scene.add(l);
    });
    // Sports room plants
    mkPlant(sportsX - 5, sportsZ - 6); mkPlant(sportsX - 5, sportsZ + 5.5); mkPlant(sportsX + 5, sportsZ - 6); mkPlant(sportsX + 5, sportsZ + 5.5);

    // ===== FITNESS GYM — positioned at top of left staircase =====
    const leftStairTopX = groundLeftEdge - (numSteps - 1) * stepDepth;
    const gymHalfW = 8;
    const gymHalfD = 7;
    const gymX = leftStairTopX - gymHalfW;
    const gymZ = lastStepZ + 12.5;

    // Gym floor
    const gymFloor = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, 0.2, gymHalfD * 2), mat(0xc6b68c));
    gymFloor.position.set(gymX, -0.1, gymZ); gymFloor.receiveShadow = true; scene.add(gymFloor);

    // Gym walls
    const gymBackWall = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, wallH, 0.15), wm);
    gymBackWall.position.set(gymX, wallH / 2, gymZ - gymHalfD); gymBackWall.castShadow = true; scene.add(gymBackWall);
    const gymFrontWall = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, wallH, 0.15), wm);
    gymFrontWall.position.set(gymX, wallH / 2, gymZ + gymHalfD); scene.add(gymFrontWall);
    const gymLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, gymHalfD * 2), wm);
    gymLeftWall.position.set(gymX - gymHalfW, wallH / 2, gymZ); gymLeftWall.castShadow = true; scene.add(gymLeftWall);
    // Right wall split with doorway for left staircase entry
    const gymRightWallTop = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    gymRightWallTop.position.set(gymX + gymHalfW, wallH / 2, gymZ - 4.5); gymRightWallTop.castShadow = true; scene.add(gymRightWallTop);
    const gymRightWallBot = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 5), wm);
    gymRightWallBot.position.set(gymX + gymHalfW, wallH / 2, gymZ + 4.5); gymRightWallBot.castShadow = true; scene.add(gymRightWallBot);

    // Gym grid
    for (let i = -(gymHalfW - 1); i <= gymHalfW - 1; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, gymHalfD * 2), gm); l.position.set(gymX + i, 0.01, gymZ); scene.add(l); }
    for (let i = -gymHalfD; i <= gymHalfD; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(gymHalfW * 2, 0.01, 0.02), gm); l.position.set(gymX, 0.01, gymZ + i); scene.add(l); }

    // Treadmill (x2)
    const treadmillPads = [
      { x: gymX - 2.6, z: gymZ + 4.2 },
      { x: gymX + 0.2, z: gymZ + 4.2 },
    ];
    const treadmillDecks = [];
    treadmillPads.forEach(({ x, z }) => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.8), mat(0x1e1e26));
      deck.position.set(x, 0.55, z); deck.castShadow = true; scene.add(deck);
      treadmillDecks.push(deck);
      const railL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0x666670));
      railL.position.set(x - 0.6, 0.8, z - 0.25); scene.add(railL);
      const railR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0x666670));
      railR.position.set(x + 0.6, 0.8, z - 0.25); scene.add(railR);
      const console = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.1), mat(0, 0x00d1ff, 0.5));
      console.position.set(x, 1.02, z - 0.25); scene.add(console);
    });

    // Elliptical cross trainer
    const ellipticalBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.55), mat(0x2a2a34));
    ellipticalBase.position.set(gymX + 3.1, 0.5, gymZ + 4.2); scene.add(ellipticalBase);
    const ellipticalPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), mat(0x666670));
    ellipticalPost.position.set(gymX + 3.1, 1.0, gymZ + 4.15); scene.add(ellipticalPost);
    const ellipticalHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x888890));
    ellipticalHandleL.position.set(gymX + 2.8, 1.1, gymZ + 4.05); ellipticalHandleL.rotation.z = 0.15; scene.add(ellipticalHandleL);
    const ellipticalHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x888890));
    ellipticalHandleR.position.set(gymX + 3.4, 1.1, gymZ + 4.05); ellipticalHandleR.rotation.z = -0.15; scene.add(ellipticalHandleR);

    // Stationary bike
    const bikeFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.15, 0.35), mat(0x2a2a34));
    bikeFrame.position.set(gymX + 5.5, 0.45, gymZ + 4.3); scene.add(bikeFrame);
    const bikeSeat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.2), mat(0x1d1d25));
    bikeSeat.position.set(gymX + 5.35, 0.9, gymZ + 4.3); scene.add(bikeSeat);
    const bikeBar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), mat(0x777777));
    bikeBar.position.set(gymX + 5.75, 1.02, gymZ + 4.3); scene.add(bikeBar);
    const bikeWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), mat(0x444444));
    bikeWheel.position.set(gymX + 5.95, 0.45, gymZ + 4.3); bikeWheel.rotation.x = Math.PI / 2; scene.add(bikeWheel);

    // Chest press machine
    const chestPressBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1), mat(0x2d2d36));
    chestPressBase.position.set(gymX + 5.2, 0.5, gymZ + 1.3); scene.add(chestPressBase);
    const chestPressBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.15), mat(0x1a1a22));
    chestPressBack.position.set(gymX + 4.8, 0.95, gymZ + 1.3); scene.add(chestPressBack);
    const chestPressHandleL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x888890));
    chestPressHandleL.position.set(gymX + 5.6, 1.02, gymZ + 1.0); scene.add(chestPressHandleL);
    const chestPressHandleR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), mat(0x888890));
    chestPressHandleR.position.set(gymX + 5.6, 1.02, gymZ + 1.6); scene.add(chestPressHandleR);

    // (Bench press, barbel rack, trampoline removed)

    // Ab wheel
    const abWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 10, 18), mat(0x333333));
    abWheel.position.set(gymX + 4.5, 0.2, gymZ - 3.3); abWheel.rotation.y = Math.PI / 2; scene.add(abWheel);
    const abAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8), mat(0xbbbbbb));
    abAxle.position.set(gymX + 4.5, 0.2, gymZ - 3.3); abAxle.rotation.z = Math.PI / 2; scene.add(abAxle);

    // Kettlebells
    const kettlebells = [
      { x: gymX + 4.1, z: gymZ - 5.8 },
      { x: gymX + 4.5, z: gymZ - 5.8 },
      { x: gymX + 4.9, z: gymZ - 5.8 },
    ];
    kettlebells.forEach(({ x, z }) => {
      const kb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), mat(0x2b2b2b));
      kb.position.set(x, 0.16, z); scene.add(kb);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 8, 14), mat(0x9a9a9a));
      handle.position.set(x, 0.28, z); handle.rotation.x = Math.PI / 2; scene.add(handle);
    });

    // Dumbbell rack + dumbbells + punching bag
    const dumbbellRack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.45), mat(0x2d2d36));
    dumbbellRack.position.set(gymX - 2.2, 0.45, gymZ - 6.2); dumbbellRack.castShadow = true; scene.add(dumbbellRack);
    for (let i = 0; i < 8; i++) {
      const dumbbell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8), mat(0x111111));
      dumbbell.rotation.z = Math.PI / 2;
      dumbbell.position.set(gymX - 3.45 + i * 0.35, 0.72, gymZ - 6.2); scene.add(dumbbell);
    }
    const bagTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), mat(0x777777));
    bagTop.position.set(gymX - 4.7, 1.3, gymZ - 3.8); scene.add(bagTop);
    const punchBag = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.1, 14), mat(0xaa2a2a));
    punchBag.position.set(gymX - 4.7, 0.65, gymZ - 3.8); punchBag.castShadow = true; scene.add(punchBag);

    gymPropsRef.current = {
      treadmillDecks,
      ellipticalHandleL,
      ellipticalHandleR,
      bikeWheel,
      chestPressHandleL,
      chestPressHandleR,
      // (bench press / barbel rack / trampoline removed)
      abWheel,
      punchBag,
    };

    // Gym plants
    mkPlant(gymX + 7, gymZ - 6);
    mkPlant(gymX + 7, gymZ + 5.5);

    // ===== BOTTOM ROOM — positioned at top of bottom staircase =====
    const bottomStairTopZ = groundBottomEdge + (numSteps - 1) * stepDepth;
    const bottomRoomX = 0;
    const bottomRoomZ = bottomStairTopZ + 7;

    // Bottom room floor
    const bottomFloor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 14), mat(0xc8b88e));
    bottomFloor.position.set(bottomRoomX, -0.1, bottomRoomZ); bottomFloor.receiveShadow = true; scene.add(bottomFloor);

    // Bottom room walls
    // Back wall split for staircase entry doorway (4 units opening centered at x=0)
    const brBackLeft = new THREE.Mesh(new THREE.BoxGeometry(4, wallH, 0.15), wm);
    brBackLeft.position.set(bottomRoomX - 4, wallH / 2, bottomRoomZ - 7); brBackLeft.castShadow = true; scene.add(brBackLeft);
    const brBackRight = new THREE.Mesh(new THREE.BoxGeometry(4, wallH, 0.15), wm);
    brBackRight.position.set(bottomRoomX + 4, wallH / 2, bottomRoomZ - 7); brBackRight.castShadow = true; scene.add(brBackRight);
    const brFrontWall = new THREE.Mesh(new THREE.BoxGeometry(12, wallH, 0.15), wm);
    brFrontWall.position.set(bottomRoomX, wallH / 2, bottomRoomZ + 7); scene.add(brFrontWall);
    const brLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    brLeftWall.position.set(bottomRoomX - 6, wallH / 2, bottomRoomZ); brLeftWall.castShadow = true; scene.add(brLeftWall);
    const brRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, wallH, 14), wm);
    brRightWall.position.set(bottomRoomX + 6, wallH / 2, bottomRoomZ); brRightWall.castShadow = true; scene.add(brRightWall);

    // Bottom room grid
    for (let i = -5; i <= 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 14), gm); l.position.set(bottomRoomX + i, 0.01, bottomRoomZ); scene.add(l); }
    for (let i = -6; i <= 6; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(12, 0.01, 0.02), gm); l.position.set(bottomRoomX, 0.01, bottomRoomZ + i); scene.add(l); }

    // Bottom room cafeteria setup
    const cafeCounter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 1.1), mat(0x3a3020));
    cafeCounter.position.set(bottomRoomX, 0.47, bottomRoomZ + 5.6); cafeCounter.castShadow = true; scene.add(cafeCounter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.06, 1.2), mat(0x4b3d26));
    counterTop.position.set(bottomRoomX, 0.96, bottomRoomZ + 5.6); counterTop.castShadow = true; scene.add(counterTop);

    const coffeeMachine = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.52, 0.55), mat(0x222228));
    coffeeMachine.position.set(bottomRoomX - 1.9, 1.25, bottomRoomZ + 5.6); scene.add(coffeeMachine);
    const machineLight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.01), mat(0, 0x14f195, 1.4));
    machineLight.position.set(bottomRoomX - 1.9, 1.3, bottomRoomZ + 5.89); scene.add(machineLight);
    const coffeeNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), mat(0x111118));
    coffeeNozzle.position.set(bottomRoomX - 1.9, 1.08, bottomRoomZ + 5.86); scene.add(coffeeNozzle);
    const register = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), mat(0x111118));
    register.position.set(bottomRoomX + 1.8, 1.12, bottomRoomZ + 5.6); scene.add(register);

    // Steam puffs for coffee machine
    const steamPuffs = [];
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xddeeea, transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), steamMat.clone());
      puff.position.set(bottomRoomX - 1.9, 1.15 + i * 0.07, bottomRoomZ + 5.9 + (Math.random() - 0.5) * 0.04);
      puff.userData = {
        baseX: bottomRoomX - 1.9,
        baseY: 1.12,
        baseZ: bottomRoomZ + 5.9,
        rise: Math.random() * 0.9,
        speed: 0.45 + Math.random() * 0.35,
        sway: Math.random() * Math.PI * 2,
      };
      scene.add(puff);
      steamPuffs.push(puff);
    }

    const cafeTableCenters = [
      { x: bottomRoomX - 2.1, z: bottomRoomZ + 1.3 },
      { x: bottomRoomX + 2.1, z: bottomRoomZ + 1.3 },
      { x: bottomRoomX, z: bottomRoomZ - 2.2 },
    ];
    cafeTableCenters.forEach(({ x, z }) => {
      const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 20), mat(0x4a3a24));
      tTop.position.set(x, 0.72, z); tTop.castShadow = true; scene.add(tTop);
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.66, 12), mat(0x2a2a30));
      tLeg.position.set(x, 0.35, z); scene.add(tLeg);

      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        const sx = x + Math.cos(ang) * 1.25;
        const sz = z + Math.sin(ang) * 1.25;
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 12), mat(0x6a5a45));
        stoolSeat.position.set(sx, 0.52, sz); scene.add(stoolSeat);
        const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), mat(0x555555));
        stoolLeg.position.set(sx, 0.24, sz); scene.add(stoolLeg);
      }
    });

    // Fridge (replaces vending machine)
    const fridgeBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.9, 0.85), mat(0xd8dee6));
    fridgeBody.position.set(bottomRoomX - 5.1, 0.95, bottomRoomZ + 4.6); fridgeBody.castShadow = true; scene.add(fridgeBody);
    const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.75, 0.75), mat(0xe8eef4));
    fridgeDoor.position.set(bottomRoomX - 4.55, 0.95, bottomRoomZ + 4.6); scene.add(fridgeDoor);
    const fridgeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.05), mat(0x8a9098));
    fridgeHandle.position.set(bottomRoomX - 4.52, 0.95, bottomRoomZ + 4.92); scene.add(fridgeHandle);
    const fridgeCoolGlow = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.5, 0.62), mat(0, 0x7cc7ff, 0.6));
    fridgeCoolGlow.position.set(bottomRoomX - 4.58, 0.95, bottomRoomZ + 4.6); scene.add(fridgeCoolGlow);
    const fridgeLeds = [];
    [0, 1, 2].forEach((idx) => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.01), mat(0, [0x14f195, 0x00d1ff, 0xffaa22][idx], 1.2));
      led.rotation.y = Math.PI / 2;
      led.position.set(bottomRoomX - 4.57, 1.72, bottomRoomZ + 4.35 + idx * 0.12);
      led.userData.phase = Math.random() * Math.PI * 2;
      scene.add(led);
      fridgeLeds.push(led);
    });

    // Bottom room plants
    mkPlant(bottomRoomX - 5, bottomRoomZ - 6);
    mkPlant(bottomRoomX + 5, bottomRoomZ - 6);
    mkPlant(bottomRoomX - 5, bottomRoomZ + 5.5);
    mkPlant(bottomRoomX + 5, bottomRoomZ + 5.5);

    // Wall screens with live trading charts
    const wallScreenTextures = [];

    function mkScreen(x, y, z, chartType = "line") {
      const f = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.06), mat(0x111118)); f.position.set(x, y, z); scene.add(f);
      const canvas = document.createElement("canvas");
      canvas.width = 192; canvas.height = 108;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const scrMat = new THREE.MeshBasicMaterial({ map: texture });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.65), scrMat);
      s.position.set(x, y, z + 0.04); scene.add(s);
      const data = [];
      let price = 50 + Math.random() * 50;
      for (let i = 0; i < 40; i++) {
        price += (Math.random() - 0.48) * 4;
        price = Math.max(10, Math.min(100, price));
        data.push(price);
      }
      wallScreenTextures.push({ ctx, texture, canvas, data, chartType, offset: Math.random() * 100 });
    }

    function updateWallScreens(time) {
      wallScreenTextures.forEach(({ ctx, texture, data, chartType, offset }) => {
        const w = 192, h = 108;
        ctx.fillStyle = "#060d06";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(20,241,149,0.08)";
        ctx.lineWidth = 0.5;
        for (let gy = 20; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
        for (let gx = 20; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
        let price = data[data.length - 1];
        price += (Math.sin(time * 2 + offset) * 1.5 + (Math.random() - 0.48) * 2);
        price = Math.max(10, Math.min(100, price));
        data.push(price);
        if (data.length > 60) data.shift();
        const minP = Math.min(...data) - 5;
        const maxP = Math.max(...data) + 5;
        const range = maxP - minP || 1;
        if (chartType === "line") {
          ctx.beginPath();
          data.forEach((p, i) => { const px = (i / (data.length - 1)) * w; const py = h - 15 - ((p - minP) / range) * (h - 30); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
          ctx.strokeStyle = "#14f195"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, "rgba(20,241,149,0.25)"); grad.addColorStop(1, "rgba(20,241,149,0.02)");
          ctx.fillStyle = grad; ctx.fill();
        } else if (chartType === "candle") {
          const barW = w / data.length;
          for (let i = 1; i < data.length; i++) {
            const open = data[i - 1], close = data[i];
            const high = Math.max(open, close) + Math.random() * 3, low = Math.min(open, close) - Math.random() * 3;
            const isUp = close >= open; const px = i * barW;
            const openY = h - 15 - ((open - minP) / range) * (h - 30);
            const closeY = h - 15 - ((close - minP) / range) * (h - 30);
            const highY = h - 15 - ((high - minP) / range) * (h - 30);
            const lowY = h - 15 - ((low - minP) / range) * (h - 30);
            ctx.strokeStyle = isUp ? "#14f195" : "#ff4444"; ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(px, highY); ctx.lineTo(px, lowY); ctx.stroke();
            ctx.fillStyle = isUp ? "#14f195" : "#ff4444";
            ctx.fillRect(px - barW * 0.3, Math.min(openY, closeY), barW * 0.6, Math.max(Math.abs(closeY - openY), 1));
          }
        } else if (chartType === "bar") {
          const barW = w / data.length;
          data.forEach((p, i) => {
            const barH = ((p - minP) / range) * (h - 30);
            ctx.fillStyle = (i > 0 ? data[i] >= data[i - 1] : true) ? "rgba(20,241,149,0.6)" : "rgba(255,68,68,0.6)";
            ctx.fillRect(i * barW + 1, h - 15 - barH, barW - 2, barH);
          });
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, w, 14);
        ctx.fillStyle = "#14f195"; ctx.font = "bold 8px monospace";
        ctx.fillText({ line: "SOL/USDC", candle: "BTC/USD", bar: "VOLUME 24H" }[chartType] || "MARKET", 4, 10);
        ctx.fillStyle = price > data[data.length - 2] ? "#14f195" : "#ff4444";
        ctx.textAlign = "right"; ctx.fillText("$" + price.toFixed(2), w - 4, 10); ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0, h - 10, w, 10);
        ctx.fillStyle = "#444444"; ctx.font = "6px monospace";
        const now = new Date();
        ctx.fillText(`${now.getHours()}:${now.getMinutes().toString().padStart(2,"0")}`, 4, h - 3);
        ctx.fillText("LIVE", w - 22, h - 3);
        texture.needsUpdate = true;
      });
    }

    // Sports room wall screens
    mkScreen(sportsX - 2, 1, sportsZ - 6.9, "line");
    mkScreen(sportsX + 2, 1, sportsZ - 6.9, "candle");

    // Main office screens
    mkScreen(0, 1, -6.9, "candle");
    mkScreen(4, 1, -6.9, "line");
    mkScreen(-4, 1, -6.9, "bar");

    // Game play positions
    // Ping pong — 2 players on opposite ends
    const pingPongSpots = [
      { x: sportsX - 1.4, z: sportsZ + 3, faceAngle: Math.PI / 2, game: "pingpong" },
      { x: sportsX + 1.4, z: sportsZ + 3, faceAngle: -Math.PI / 2, game: "pingpong" },
    ];
    // Billiards — 2 players on opposite sides
    const billiardSpots = [
      { x: sportsX - 1.8, z: sportsZ - 3, faceAngle: Math.PI / 2, game: "billiards" },
      { x: sportsX + 1.8, z: sportsZ - 3, faceAngle: -Math.PI / 2, game: "billiards" },
    ];
    const allGameSpots = [...pingPongSpots, ...billiardSpots];
    const occupiedGameSpots = new Set();

    // Cafeteria "sit" anchors are slightly in front of tables/counter.
    // We apply a small backward offset at runtime so agents don't clip/stick into table AABBs.
    const cafeSpots = [
      { x: bottomRoomX - 2.1, z: bottomRoomZ + 0.2, faceAngle: 0, back: 0.25 },
      { x: bottomRoomX - 3.0, z: bottomRoomZ + 1.3, faceAngle: Math.PI / 2, back: 0.25 },
      { x: bottomRoomX + 2.1, z: bottomRoomZ + 0.2, faceAngle: 0, back: 0.25 },
      { x: bottomRoomX + 3.0, z: bottomRoomZ + 1.3, faceAngle: -Math.PI / 2, back: 0.25 },
      { x: bottomRoomX, z: bottomRoomZ - 3.2, faceAngle: 0, back: 0.25 },
      // Counter spot: a bit less offset so they don't drift into the register/counter lip.
      { x: bottomRoomX - 0.7, z: bottomRoomZ + 5.05, faceAngle: 0, back: 0.45 },
    ];
    const occupiedCafeSpots = new Set();

    const gymSpots = [
      { x: gymX - 2.6, z: gymZ + 4.2, faceAngle: Math.PI, activity: "treadmill", back: 0.95 },
      { x: gymX + 0.2, z: gymZ + 4.2, faceAngle: Math.PI, activity: "treadmill", back: 0.95 },
      { x: gymX + 3.1, z: gymZ + 4.2, faceAngle: Math.PI, activity: "elliptical", back: 0.95 },
      { x: gymX + 5.5, z: gymZ + 4.3, faceAngle: Math.PI / 2, activity: "bike", back: 0.95 },
      { x: gymX + 5.2, z: gymZ + 1.3, faceAngle: Math.PI / 2, activity: "chestpress", back: 1.05 },
      { x: gymX + 4.5, z: gymZ - 3.3, faceAngle: -Math.PI / 2, activity: "ab_wheel", back: 0.85 },
      { x: gymX - 4.7, z: gymZ - 3.8, faceAngle: Math.PI / 2, activity: "punching_bag", back: 0.95 },
      { x: gymX + 4.5, z: gymZ - 5.8, faceAngle: Math.PI, activity: "kettlebell", back: 0.95 },
      { x: gymX - 2.2, z: gymZ - 6.2, faceAngle: Math.PI, activity: "dumbbell", back: 1.35, side: 0.25 },
      { x: gymX - 3.3, z: gymZ - 5.4, faceAngle: Math.PI, activity: "barbell", back: 1.2, side: -0.25 },
    ];
    const occupiedGymSpots = new Set();

    // Game balls — hidden until agents are playing
    // Ping pong ball (small white sphere)
    const ppBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    ppBall.position.set(sportsX, 0.9, sportsZ + 3);
    ppBall.visible = false;
    scene.add(ppBall);

    // Billiard balls (several colored balls on the table)
    const billiardBalls = [];
    const ballColors = [0xff0000, 0xffff00, 0x0000ff, 0xff8800, 0x00aa00, 0x880088];
    ballColors.forEach((color, i) => {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshLambertMaterial({ color })
      );
      // Spread balls across the table
      const bx = sportsX - 0.5 + (i % 3) * 0.5;
      const bz = sportsZ - 3.15 + Math.floor(i / 3) * 0.3;
      ball.position.set(bx, 0.9, bz);
      ball.visible = false;
      ball.userData.baseX = bx;
      ball.userData.baseZ = bz;
      scene.add(ball);
      billiardBalls.push(ball);
    });
    // Cue ball (white)
    const cueBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    cueBall.position.set(sportsX + 0.8, 0.9, sportsZ - 3);
    cueBall.visible = false;
    cueBall.userData.baseX = sportsX + 0.8;
    cueBall.userData.baseZ = sportsZ - 3;
    scene.add(cueBall);
    billiardBalls.push(cueBall);

    // Desks — each assigned to an agent with live screen
    const screenCanvases = {};
    const screenTextures = {};
    const screenCtxs = {};
    const monitorMeshes = {};

    function mkDesk(x, z, rot, agent) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.7), mat(0x3a3020)); top.position.y = 0.7; top.castShadow = true; g.add(top);
      const lgeo = new THREE.BoxGeometry(0.06, 0.7, 0.06); const lm = mat(0x2a2a30);
      [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([lx, lz]) => { const l = new THREE.Mesh(lgeo, lm); l.position.set(lx, 0.35, lz); g.add(l); });

      // Monitor frame
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.04), mat(0x111118)); mon.position.set(0, 1.05, -0.2); mon.castShadow = true; g.add(mon);

      // Live screen using canvas texture
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 96;
      const ctx = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const scrMat = new THREE.MeshBasicMaterial({ map: texture });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), scrMat);
      scr.position.set(0, 1.05, -0.17);
      g.add(scr);

      if (agent) {
        mon.userData.agentId = agent.id;
        scr.userData.agentId = agent.id;
        monitorMeshes[agent.id] = [mon, scr];
        screenCanvases[agent.id] = canvas;
        screenTextures[agent.id] = texture;
        screenCtxs[agent.id] = ctx;
      }

      // Monitor stand
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.06), mat(0x111118)); stand.position.set(0, 0.82, -0.2); g.add(stand);
      const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat(0x111118)); standBase.position.set(0, 0.74, -0.2); g.add(standBase);

      // Keyboard
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.12), mat(0x222228)); kb.position.set(0, 0.74, 0.05); g.add(kb);
      for (let row = 0; row < 3; row++) {
        const keyRow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.025), mat(0x333340));
        keyRow.position.set(0, 0.755, -0.01 + row * 0.035); g.add(keyRow);
      }
      const spacebar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.005, 0.025), mat(0x333340));
      spacebar.position.set(0, 0.755, 0.1); g.add(spacebar);

      // Mouse
      const mouseBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.09), mat(0x222228));
      mouseBody.position.set(0.28, 0.74, 0.05); g.add(mouseBody);
      const mouseTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.07), mat(0x2a2a35));
      mouseTop.position.set(0.28, 0.755, 0.045); g.add(mouseTop);
      const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.02), mat(0x444450));
      scroll.position.set(0.28, 0.762, 0.03); g.add(scroll);
      const mousePad = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.005, 0.2), mat(0x1a1a22));
      mousePad.position.set(0.28, 0.725, 0.05); g.add(mousePad);

      // Name plate on desk
      if (agent) {
        const plateColor = agent.color;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02), mat(plateColor));
        plate.position.set(-0.35, 0.78, -0.2); g.add(plate);
        // Name text via small canvas
        const nameCanvas = document.createElement("canvas");
        nameCanvas.width = 64; nameCanvas.height = 16;
        const nctx = nameCanvas.getContext("2d");
        nctx.fillStyle = "#0a0a0f";
        nctx.fillRect(0, 0, 64, 16);
        nctx.fillStyle = "#ffffff";
        nctx.font = "bold 10px monospace";
        nctx.textAlign = "center";
        nctx.fillText(agent.name, 32, 12);
        const nameTex = new THREE.CanvasTexture(nameCanvas);
        nameTex.minFilter = THREE.LinearFilter;
        const nameMat = new THREE.MeshBasicMaterial({ map: nameTex });
        const nameTag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.06), nameMat);
        nameTag.position.set(-0.35, 0.78, -0.19);
        g.add(nameTag);
      }

      // Office chair
      const chairColor = agent ? agent.color : 0x333345;
      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), mat(chairColor));
      seatMesh.position.set(0, 0.45, 0.55); seatMesh.castShadow = true; g.add(seatMesh);
      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.05), mat(chairColor));
      backMesh.position.set(0, 0.65, 0.73); backMesh.castShadow = true; g.add(backMesh);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), mat(0x555555));
      pole.position.set(0, 0.27, 0.55); g.add(pole);
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mat(0x555555));
        legMesh.position.set(Math.sin(angle) * 0.1, 0.1, 0.55 + Math.cos(angle) * 0.1);
        legMesh.rotation.y = angle;
        g.add(legMesh);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), mat(0x222222));
        wheel.position.set(Math.sin(angle) * 0.2, 0.04, 0.55 + Math.cos(angle) * 0.2);
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
      }

      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }

    // Assign desks to agents
    const deskPositions = [
      [-6,-5,0], [-3,-5,0], [0,-5,0],
      [-6,-2,Math.PI], [-3,-2,Math.PI], [0,-2,Math.PI]
    ];
    const agentSeatPositions = {};
    AGENTS.forEach((a, i) => {
      const [x, z, r] = deskPositions[i];
      mkDesk(x, z, r, a);
      // Chair is at local z=0.55, rotated by desk rotation
      const seatX = x + Math.sin(r) * 0.55;
      const seatZ = z + Math.cos(r) * 0.55;
      // Agent faces the desk (opposite of chair front)
      const faceAngle = r + Math.PI;
      agentSeatPositions[a.id] = { x: seatX, z: seatZ, faceAngle, deskRot: r };
    });
    seatPositionsRef.current = agentSeatPositions;

    // Screen update function — draws live terminal-style display
    AGENTS.forEach(a => { if (!terminalLogsRef.current[a.id]) terminalLogsRef.current[a.id] = []; });

    function updateScreen(agentId, time) {
      const ctx = screenCtxs[agentId];
      const tex = screenTextures[agentId];
      const agent = AGENTS.find(a => a.id === agentId);
      if (!ctx || !tex || !agent) return;

      // Check if agent is sitting at their desk
      const target = agentTargetsRef.current[agentId];
      const isAtDesk = target && target.sitting;

      const r = (agent.color >> 16) & 0xff;
      const g = (agent.color >> 8) & 0xff;
      const b = agent.color & 0xff;

      if (!isAtDesk) {
        // === IDLE SCREEN — agent not at desk ===
        ctx.fillStyle = "#050805";
        ctx.fillRect(0, 0, 128, 96);

        // Header bar dimmed
        ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
        ctx.fillRect(0, 0, 128, 12);
        ctx.fillStyle = "#444444";
        ctx.font = "bold 8px monospace";
        ctx.fillText(agent.name.toUpperCase(), 4, 9);

        // Status: IDLE
        ctx.fillStyle = "#ffaa22";
        ctx.fillRect(108, 3, 6, 6);
        ctx.fillStyle = "#555555";
        ctx.font = "6px monospace";
        ctx.fillText("IDLE", 88, 9);

        // Idle message centered
        ctx.fillStyle = "#333333";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Agent away", 64, 42);
        ctx.fillText("Waiting for return...", 64, 54);
        ctx.textAlign = "left";

        // Dim bottom bar
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 86, 128, 10);
        ctx.fillStyle = "#333333";
        ctx.font = "6px monospace";
        ctx.fillText("disconnected", 4, 93);

        tex.needsUpdate = true;
        return;
      }

      // === ACTIVE SCREEN — agent is working at desk ===
      ctx.fillStyle = "#0a0f0a";
      ctx.fillRect(0, 0, 128, 96);

      // Header bar
      ctx.fillStyle = `rgba(${r},${g},${b},0.3)`;
      ctx.fillRect(0, 0, 128, 12);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px monospace";
      ctx.fillText(agent.name.toUpperCase(), 4, 9);

      // Status: RUNNING
      ctx.fillStyle = "#14f195";
      ctx.fillRect(108, 3, 6, 6);
      ctx.fillStyle = "#666666";
      ctx.font = "6px monospace";
      ctx.fillText("RUN", 88, 9);

      // Terminal lines (real agent output)
      const term = terminalLogsRef.current[agentId] || [];
      const lines = term.slice(-7).map(l => l.text);

      ctx.fillStyle = "#14f195";
      ctx.font = "7px monospace";
      lines.forEach((line, i) => {
        const alpha = 0.4 + (i / lines.length) * 0.6;
        ctx.fillStyle = `rgba(20,241,149,${alpha})`;
        ctx.fillText("> " + line, 4, 22 + i * 10);
      });

      // Blinking cursor
      if (Math.floor(time * 2) % 2 === 0) {
        ctx.fillStyle = "#14f195";
        ctx.fillRect(4, 22 + Math.min(lines.length, 7) * 10, 5, 7);
      }

      // Bottom status bar
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, 86, 128, 10);
      ctx.fillStyle = "#666666";
      ctx.font = "6px monospace";
      const now = new Date();
      ctx.fillText(`${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`, 4, 93);
      ctx.fillText("solana-mainnet", 60, 93);

      tex.needsUpdate = true;
    }

    // Meeting table
    const mt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.08, 32), mat(0x3a3020)); mt.position.set(-5, 0.72, 4); mt.castShadow = true; scene.add(mt);
    const mtl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.72, 8), mat(0x2a2a30)); mtl.position.set(-5, 0.36, 4); scene.add(mtl);

    // Meeting chairs
    const tableCenter = { x: -5, z: 4 };
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const cx = tableCenter.x + Math.cos(angle) * 2.2;
      const cz = tableCenter.z + Math.sin(angle) * 2.2;
      
      // Compute angle FROM chair TO table center
      const toTableAngle = Math.atan2(tableCenter.x - cx, tableCenter.z - cz);
      
      const cg = new THREE.Group();
      // Seat
      const mSeat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.36), mat(0x444460));
      mSeat.position.y = 0.42; cg.add(mSeat);
      // Backrest — at +z in local space (will face AWAY from table after rotation)
      const mBack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.04), mat(0x444460));
      mBack.position.set(0, 0.6, 0.18); cg.add(mBack);
      // Pole
      const mPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6), mat(0x666666));
      mPole.position.y = 0.25; cg.add(mPole);
      // Base legs
      for (let j = 0; j < 5; j++) {
        const la = (j / 5) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.18), mat(0x666666));
        leg.position.set(Math.sin(la) * 0.09, 0.09, Math.cos(la) * 0.09);
        leg.rotation.y = la;
        cg.add(leg);
      }
      cg.position.set(cx, 0, cz);
      // rotation.y in Three.js rotates around Y axis; -z local axis faces direction of rotation.y
      // We want -z (open/front) to face the table, so set rotation.y = toTableAngle
      cg.rotation.y = toTableAngle + Math.PI;
      scene.add(cg);
    }

    // Couches
    function mkCouch(x, z, rot = 0, c = 0x2a2a55) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 0.8), mat(c)); s.position.y = 0.35; s.castShadow = true; g.add(s);
      const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.2), mat(c)); b.position.set(0, 0.6, -0.3); b.castShadow = true; g.add(b);
      const al = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); al.position.set(-0.92, 0.52, 0); g.add(al);
      const ar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.8), mat(c)); ar.position.set(0.92, 0.52, 0); g.add(ar);
      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }
    mkCouch(5, 3, 0, 0x2a2a55);
    mkCouch(5, 5.5, Math.PI, 0x352a40);
    mkCouch(7.5, 4.2, -Math.PI / 2, 0x2a3545);

    // Sofa seat positions — calculated from couch geometry
    // Couch backrest is at local z=-0.3, seat cushion at local z=0 to z=0.4
    // Agent should sit on cushion facing AWAY from backrest (toward +z in local space)
    const sofaSeats = [
      // Couch 1 (x:5, z:3, rot:0) — backrest at world z=2.7, seat at z=3.0-3.4, face +z
      { x: 4.4, z: 3.2, faceAngle: 0, seatY: 0.2 },
      { x: 5, z: 3.2, faceAngle: 0, seatY: 0.2 },
      { x: 5.6, z: 3.2, faceAngle: 0, seatY: 0.2 },
      // Couch 2 (x:5, z:5.5, rot:PI) — rotated 180, backrest at world z=5.8, seat at z=5.5-5.1, face -z
      { x: 4.4, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      { x: 5, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      { x: 5.6, z: 5.3, faceAngle: Math.PI, seatY: 0.2 },
      // Couch 3 (x:7.5, z:4.2, rot:-PI/2) — rotated -90, backrest at world x=7.8, seat at x=7.5-7.1, face -x
      { x: 7.3, z: 3.8, faceAngle: -Math.PI / 2, seatY: 0.2 },
      { x: 7.3, z: 4.6, faceAngle: -Math.PI / 2, seatY: 0.2 },
    ];
    const occupiedSofaSeats = new Set();

    // Coffee table
    const ct = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), mat(0x3a3020)); ct.position.set(5, 0.4, 4.25); scene.add(ct);
    // Coffee table legs
    const ctLegGeo = new THREE.BoxGeometry(0.05, 0.38, 0.05);
    const ctLegMat = mat(0x2a2a30);
    [[-0.5, -0.22], [0.5, -0.22], [-0.5, 0.22], [0.5, 0.22]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(ctLegGeo, ctLegMat);
      leg.position.set(5 + lx, 0.19, 4.25 + lz);
      scene.add(leg);
    });

    // (Ping pong moved to sports room)

    // Server racks
    function mkRack(x, z) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.5), mat(0x1a1a22)); r.position.set(x, 1, z); r.castShadow = true; scene.add(r);
      for (let i = 0; i < 5; i++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), mat(0, [0x14f195, 0x9945ff, 0x00d1ff][i % 3], 2));
        led.position.set(x - 0.2, 0.4 + i * 0.35, z - 0.26); scene.add(led);
      }
    }
    mkRack(8.2, -6); mkRack(8.2, -5); mkRack(8.2, -4);

    // Plants
    function mkPlant(x, z) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), mat(0x553322)); p.position.set(x, 0.15, z); scene.add(p);
      const lv = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.35, 0.6, 6), mat(0x226633, 0x14f195, 0.1)); lv.position.set(x, 0.6, z); scene.add(lv);
    }
    mkPlant(-8.3, -6); mkPlant(-8.3, 0); mkPlant(-8.3, 5);

    // ===== COLLISION OBSTACLES (AABB: { minX, maxX, minZ, maxZ }) =====
    const obstacles = [];
    // Main office walls
    obstacles.push({ minX: -9.1, maxX: 9.1, minZ: -7.15, maxZ: -6.85 }); // back wall
    obstacles.push({ minX: -9.15, maxX: -8.85, minZ: -7, maxZ: 7 }); // left wall
    obstacles.push({ minX: 8.85, maxX: 9.15, minZ: -7, maxZ: 7 }); // right wall
    obstacles.push({ minX: -9, maxX: -3, minZ: 6.85, maxZ: 7.15 }); // front wall left
    obstacles.push({ minX: 3, maxX: 9, minZ: 6.85, maxZ: 7.15 }); // front wall right
    // Sports room walls
    obstacles.push({ minX: sportsX - 6.1, maxX: sportsX + 6.1, minZ: sportsZ - 7.15, maxZ: sportsZ - 6.85 }); // back
    obstacles.push({ minX: sportsX - 6.1, maxX: sportsX + 6.1, minZ: sportsZ + 6.85, maxZ: sportsZ + 7.15 }); // front
    obstacles.push({ minX: sportsX - 6.15, maxX: sportsX - 5.85, minZ: sportsZ - 7, maxZ: sportsZ - 2 }); // left wall top
    obstacles.push({ minX: sportsX - 6.15, maxX: sportsX - 5.85, minZ: sportsZ + 2, maxZ: sportsZ + 7 }); // left wall bottom
    obstacles.push({ minX: sportsX + 5.85, maxX: sportsX + 6.15, minZ: sportsZ - 7, maxZ: sportsZ + 7 }); // right
    // Gym walls
    obstacles.push({ minX: gymX - 8.1, maxX: gymX + 8.1, minZ: gymZ - 7.15, maxZ: gymZ - 6.85 }); // back
    obstacles.push({ minX: gymX - 8.1, maxX: gymX + 8.1, minZ: gymZ + 6.85, maxZ: gymZ + 7.15 }); // front
    obstacles.push({ minX: gymX - 8.15, maxX: gymX - 7.85, minZ: gymZ - 7, maxZ: gymZ + 7 }); // left
    obstacles.push({ minX: gymX + 7.85, maxX: gymX + 8.15, minZ: gymZ - 7, maxZ: gymZ - 2 }); // right wall top
    obstacles.push({ minX: gymX + 7.85, maxX: gymX + 8.15, minZ: gymZ + 2, maxZ: gymZ + 7 }); // right wall bottom
    // Bottom room walls
    obstacles.push({ minX: -6.1, maxX: -1.9, minZ: bottomRoomZ - 7.15, maxZ: bottomRoomZ - 6.85 }); // back left
    obstacles.push({ minX: 1.9, maxX: 6.1, minZ: bottomRoomZ - 7.15, maxZ: bottomRoomZ - 6.85 }); // back right
    obstacles.push({ minX: -6.1, maxX: 6.1, minZ: bottomRoomZ + 6.85, maxZ: bottomRoomZ + 7.15 }); // front
    obstacles.push({ minX: -6.15, maxX: -5.85, minZ: bottomRoomZ - 7, maxZ: bottomRoomZ + 7 }); // left
    obstacles.push({ minX: 5.85, maxX: 6.15, minZ: bottomRoomZ - 7, maxZ: bottomRoomZ + 7 }); // right
    // Desks
    [[-6,-5],[-3,-5],[0,-5],[-6,-2],[-3,-2],[0,-2]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.5, maxZ: z + 0.5 });
    });
    // Meeting table
    obstacles.push({ minX: -6.8, maxX: -3.2, minZ: 2.2, maxZ: 5.8 });
    // Couches
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 2.4, maxZ: 3.6 });
    obstacles.push({ minX: 3.8, maxX: 6.2, minZ: 4.9, maxZ: 6.1 });
    obstacles.push({ minX: 6.9, maxX: 7.7, minZ: 3.0, maxZ: 5.4 });
    // Coffee table
    obstacles.push({ minX: 4.2, maxX: 5.8, minZ: 3.8, maxZ: 4.7 });
    // Server racks
    obstacles.push({ minX: 7.7, maxX: 8.7, minZ: -6.5, maxZ: -3.5 });
    // Billiard table (sports room)
    obstacles.push({ minX: sportsX - 1.7, maxX: sportsX + 1.7, minZ: sportsZ - 3.9, maxZ: sportsZ - 2.1 });
    // Ping pong table (sports room)
    obstacles.push({ minX: sportsX - 1.3, maxX: sportsX + 1.3, minZ: sportsZ + 2.2, maxZ: sportsZ + 3.8 });
    // Cue rack (sports room back wall)
    obstacles.push({ minX: sportsX - 0.8, maxX: sportsX + 0.8, minZ: sportsZ - 7, maxZ: sportsZ - 6.5 });
    // Gym equipment
    obstacles.push({ minX: gymX - 3.5, maxX: gymX - 1.7, minZ: gymZ + 3.7, maxZ: gymZ + 4.7 }); // treadmill left
    obstacles.push({ minX: gymX - 0.7, maxX: gymX + 1.1, minZ: gymZ + 3.7, maxZ: gymZ + 4.7 }); // treadmill right
    obstacles.push({ minX: gymX + 2.4, maxX: gymX + 3.8, minZ: gymZ + 3.8, maxZ: gymZ + 4.6 }); // elliptical
    obstacles.push({ minX: gymX + 4.9, maxX: gymX + 6.3, minZ: gymZ + 3.8, maxZ: gymZ + 4.8 }); // stationary bike
    obstacles.push({ minX: gymX + 4.4, maxX: gymX + 6.0, minZ: gymZ + 0.8, maxZ: gymZ + 1.8 }); // chest press machine
    obstacles.push({ minX: gymX - 3.9, maxX: gymX - 0.5, minZ: gymZ - 6.5, maxZ: gymZ - 5.9 }); // dumbbell rack
    obstacles.push({ minX: gymX + 3.9, maxX: gymX + 5.1, minZ: gymZ - 6.0, maxZ: gymZ - 5.6 }); // kettlebells
    obstacles.push({ minX: gymX - 5.05, maxX: gymX - 4.35, minZ: gymZ - 4.2, maxZ: gymZ - 3.4 }); // punching bag
    obstacles.push({ minX: gymX + 4.25, maxX: gymX + 4.75, minZ: gymZ - 3.55, maxZ: gymZ - 3.05 }); // ab wheel
    // Bottom room cafeteria props
    obstacles.push({ minX: -2.95, maxX: 2.95, minZ: bottomRoomZ + 4.95, maxZ: bottomRoomZ + 6.25 }); // counter
    obstacles.push({ minX: -3.1, maxX: -1.1, minZ: bottomRoomZ + 0.3, maxZ: bottomRoomZ + 2.3 }); // left table area
    obstacles.push({ minX: 1.1, maxX: 3.1, minZ: bottomRoomZ + 0.3, maxZ: bottomRoomZ + 2.3 }); // right table area
    obstacles.push({ minX: -1.05, maxX: 1.05, minZ: bottomRoomZ - 3.2, maxZ: bottomRoomZ - 1.2 }); // rear table area
    obstacles.push({ minX: -5.65, maxX: -4.5, minZ: bottomRoomZ + 4.15, maxZ: bottomRoomZ + 5.1 }); // fridge
    // Plants (main office + sports room + gym)
    [[-8.3,-6],[-8.3,0],[-8.3,5],[sportsX-5,sportsZ-6],[sportsX-5,sportsZ+5.5],[sportsX+5,sportsZ-6],[sportsX+5,sportsZ+5.5],[gymX+7,gymZ-6],[gymX+7,gymZ+5.5]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });
    [[bottomRoomX-5,bottomRoomZ-6],[bottomRoomX+5,bottomRoomZ-6],[bottomRoomX-5,bottomRoomZ+5.5],[bottomRoomX+5,bottomRoomZ+5.5]].forEach(([x,z]) => {
      obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    });

    const agentRadius = 0.35;

    function isBlocked(x, z) {
      for (const ob of obstacles) {
        if (x + agentRadius > ob.minX && x - agentRadius < ob.maxX &&
            z + agentRadius > ob.minZ && z - agentRadius < ob.maxZ) {
          return true;
        }
      }
      return false;
    }

    function pickValidTarget() {
      for (let attempts = 0; attempts < 30; attempts++) {
        let x;
        let z;
        const zoneRoll = Math.random();
        if (zoneRoll < 0.45) {
          x = -8 + Math.random() * 16;
          z = -6 + Math.random() * 12;
        } else if (zoneRoll < 0.6) {
          x = -16 + Math.random() * 36;
          z = 10 + Math.random() * 20;
        } else if (zoneRoll < 0.72) {
          x = sportsX - 5 + Math.random() * 10;
          z = sportsZ - 6 + Math.random() * 12;
        } else if (zoneRoll < 0.86) {
          x = gymX - 7 + Math.random() * 14;
          z = gymZ - 6 + Math.random() * 12;
        } else {
          x = bottomRoomX - 5 + Math.random() * 10;
          z = bottomRoomZ - 6 + Math.random() * 12;
        }
        if (!isBlocked(x, z)) return { x, z };
      }
      return { x: 2, z: 0 };
    }

    // ===== AGENTS =====
    // Spawn at valid non-colliding positions
    const startPositions = [];
    for (let i = 0; i < 6; i++) {
      startPositions.push(pickValidTarget());
    }

    // Hair styles and skin tones per agent for variety
    const agentStyles = [
      { skin: 0xddb88c, hair: 0x222222, hairStyle: "flat" },
      { skin: 0xc68c53, hair: 0x111111, hairStyle: "tall" },
      { skin: 0xf5d0a9, hair: 0x8b4513, hairStyle: "side" },
      { skin: 0xd4a373, hair: 0xcc3333, hairStyle: "mohawk" },
      { skin: 0xe8c49a, hair: 0xf0e68c, hairStyle: "flat" },
      { skin: 0xbf8b60, hair: 0x1a1a2e, hairStyle: "tall" },
    ];

    AGENTS.forEach((a, i) => {
      const g = new THREE.Group();
      const style = agentStyles[i];

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.3), mat(a.color));
      body.position.y = 0.7; body.castShadow = true; g.add(body);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.3), mat(style.skin));
      head.position.y = 1.2; head.castShadow = true; g.add(head);

      // === FACE (all on front face z=0.16) ===

      // Eyes — white sclera + dark pupil
      const scleraGeo = new THREE.BoxGeometry(0.08, 0.06, 0.01);
      const scleraMat = mat(0xffffff);
      const pupilGeo = new THREE.BoxGeometry(0.04, 0.05, 0.01);
      const pupilMat = mat(0x111111);

      const eyeLSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeLSclera.position.set(-0.08, 1.22, 0.16); g.add(eyeLSclera);
      const eyeLPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeLPupil.position.set(-0.08, 1.22, 0.17); g.add(eyeLPupil);

      const eyeRSclera = new THREE.Mesh(scleraGeo, scleraMat);
      eyeRSclera.position.set(0.08, 1.22, 0.16); g.add(eyeRSclera);
      const eyeRPupil = new THREE.Mesh(pupilGeo, pupilMat);
      eyeRPupil.position.set(0.08, 1.22, 0.17); g.add(eyeRPupil);

      // Eyebrows
      const browGeo = new THREE.BoxGeometry(0.1, 0.025, 0.01);
      const browMat = mat(style.hair);
      const browL = new THREE.Mesh(browGeo, browMat);
      browL.position.set(-0.08, 1.28, 0.16); browL.rotation.z = -0.1; g.add(browL);
      const browR = new THREE.Mesh(browGeo, browMat);
      browR.position.set(0.08, 1.28, 0.16); browR.rotation.z = 0.1; g.add(browR);

      // Nose
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), mat(style.skin * 0.9 | 0));
      nose.position.set(0, 1.17, 0.17); g.add(nose);

      // Mouth
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.01), mat(0x993333));
      mouth.position.set(0, 1.1, 0.16); g.add(mouth);

      // === HAIR ===
      const hairMat = mat(style.hair);

      if (style.hairStyle === "flat") {
        // Flat top hair
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.08, 0.32), hairMat);
        hairTop.position.set(0, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Side hair
        const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairL.position.set(-0.19, 1.3, -0.01); g.add(hairL);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
        // Back hair
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.25, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
      } else if (style.hairStyle === "tall") {
        // Tall/afro style
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.34), hairMat);
        hairTop.position.set(0, 1.46, -0.01); hairTop.castShadow = true; g.add(hairTop);
        const hairMid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.36), hairMat);
        hairMid.position.set(0, 1.38, -0.01); g.add(hairMid);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.3, 0.05), hairMat);
        hairBack.position.set(0, 1.32, -0.18); g.add(hairBack);
      } else if (style.hairStyle === "side") {
        // Side swept
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.32), hairMat);
        hairTop.position.set(0.03, 1.42, -0.01); hairTop.castShadow = true; g.add(hairTop);
        // Swept fringe
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), hairMat);
        fringe.position.set(-0.1, 1.38, 0.15); fringe.rotation.z = 0.2; g.add(fringe);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.28, 0.04), hairMat);
        hairBack.position.set(0, 1.32, -0.17); g.add(hairBack);
        const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.32), hairMat);
        hairR.position.set(0.19, 1.3, -0.01); g.add(hairR);
      } else if (style.hairStyle === "mohawk") {
        // Mohawk
        const spike1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.06), hairMat);
        spike1.position.set(0, 1.48, 0.05); g.add(spike1);
        const spike2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.06), hairMat);
        spike2.position.set(0, 1.47, -0.04); g.add(spike2);
        const spike3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.06), hairMat);
        spike3.position.set(0, 1.45, -0.12); g.add(spike3);
        // Shaved sides (slightly darker skin)
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideL.position.set(-0.18, 1.35, -0.01); g.add(sideL);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.28), mat(style.skin * 0.85 | 0));
        sideR.position.set(0.18, 1.35, -0.01); g.add(sideR);
      }

      // Legs with pivot at hip
      const legGeo = new THREE.BoxGeometry(0.16, 0.4, 0.2);
      const legM = mat(0x222233);

      const legLPivot = new THREE.Group();
      legLPivot.position.set(-0.12, 0.42, 0);
      const legLMesh = new THREE.Mesh(legGeo, legM);
      legLMesh.position.y = -0.2;
      legLPivot.add(legLMesh);
      g.add(legLPivot);

      const legRPivot = new THREE.Group();
      legRPivot.position.set(0.12, 0.42, 0);
      const legRMesh = new THREE.Mesh(legGeo, legM);
      legRMesh.position.y = -0.2;
      legRPivot.add(legRMesh);
      g.add(legRPivot);

      // Arms with pivot at shoulder
      const armGeo = new THREE.BoxGeometry(0.12, 0.45, 0.18);

      const armLPivot = new THREE.Group();
      armLPivot.position.set(-0.32, 0.92, 0);
      const armLMesh = new THREE.Mesh(armGeo, mat(a.color));
      armLMesh.position.y = -0.22;
      armLPivot.add(armLMesh);
      g.add(armLPivot);

      const armRPivot = new THREE.Group();
      armRPivot.position.set(0.32, 0.92, 0);
      const armRMesh = new THREE.Mesh(armGeo, mat(a.color));
      armRMesh.position.y = -0.22;
      armRPivot.add(armRMesh);
      g.add(armRPivot);

      // Status ring
      const ringGeo = new THREE.RingGeometry(0.3, 0.38, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: a.status === "working" ? 0x14f195 : 0xffaa22, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);

      g.userData = { ring, agentId: a.id, legLPivot, legRPivot, armLPivot, armRPivot, walkPhase: Math.random() * Math.PI * 2 };

      const sp = startPositions[i];
      g.position.set(sp.x, 0, sp.z);
      scene.add(g);
      agentMeshesRef.current[a.id] = g;
      agentTargetsRef.current[a.id] = {
        x: sp.x, z: sp.z, timer: Math.random() * 3 + 2,
        sitting: false, goToDesk: false, sitTimer: 0, commanded: false,
        sofaSitting: false, goToSofa: false, sofaSeatIdx: -1, sofaSitTimer: 0,
        cafeSitting: false, goToCafe: false, cafeSpotIdx: -1, cafeTimer: 0, cafePhase: 0,
        gyming: false, goToGym: false, gymSpotIdx: -1, gymTimer: 0, gymPhase: 0, gymActivity: "",
        playing: false, goToGame: false, gameSpotIdx: -1, playTimer: 0, playPhase: 0, waypoints: []
      };
    });

    // Camera update
    function updateCam() {
      const cs = cameraStateRef.current;
      const cam = cameraRef.current;
      const ren = rendererRef.current;
      if (!cam || !ren) return;
      const w = ren.domElement.clientWidth;
      const h = ren.domElement.clientHeight;
      const asp = w / h;
      cam.position.x = cs.target.x + Math.cos(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.z = cs.target.z + Math.sin(cs.angle) * cs.distance * Math.cos(cs.pitch);
      cam.position.y = cs.distance * Math.sin(cs.pitch);
      cam.lookAt(cs.target);
      const d = cs.distance * 0.55;
      cam.left = -d * asp; cam.right = d * asp; cam.top = d; cam.bottom = -d;
      cam.updateProjectionMatrix();
    }

    updateCam();

    // === WAYPOINT NAVIGATION ===
    const ZONE_OFFICE_CENTER = { x: -1.5, z: -3.5 }; // aisle between desk rows
    const ZONE_OFFICE_DOOR = { x: 0, z: 6.5 };
    const ZONE_GROUND_CENTER = { x: 15, z: lastStepZ + 12.5 };
    const ZONE_SPORTS_DOOR = { x: sportsX - 5.5, z: sportsZ };
    const ZONE_SPORTS_CENTER = { x: sportsX, z: sportsZ }; // center of sports room is clear

    function getZone(x, z) {
      if (x >= -9 && x <= 9 && z >= -7 && z <= 7) return "office";
      if (x >= sportsX - 6 && x <= sportsX + 6 && z >= sportsZ - 7 && z <= sportsZ + 7) return "sports";
      return "ground";
    }

    function buildWaypoints(fromX, fromZ, toX, toZ) {
      const fromZone = getZone(fromX, fromZ);
      const toZone = getZone(toX, toZ);
      if (fromZone === toZone) return [];
      const wp = [];
      if (fromZone === "office" && toZone === "sports") {
        wp.push(ZONE_OFFICE_CENTER, ZONE_OFFICE_DOOR, ZONE_GROUND_CENTER, ZONE_SPORTS_DOOR, ZONE_SPORTS_CENTER);
      } else if (fromZone === "sports" && toZone === "office") {
        wp.push(ZONE_SPORTS_CENTER, ZONE_SPORTS_DOOR, ZONE_GROUND_CENTER, ZONE_OFFICE_DOOR, ZONE_OFFICE_CENTER);
      } else if (fromZone === "office" && toZone === "ground") {
        wp.push(ZONE_OFFICE_CENTER, ZONE_OFFICE_DOOR);
      } else if (fromZone === "ground" && toZone === "office") {
        wp.push(ZONE_OFFICE_DOOR, ZONE_OFFICE_CENTER);
      } else if (fromZone === "sports" && toZone === "ground") {
        wp.push(ZONE_SPORTS_CENTER, ZONE_SPORTS_DOOR);
      } else if (fromZone === "ground" && toZone === "sports") {
        wp.push(ZONE_SPORTS_DOOR, ZONE_SPORTS_CENTER);
      }
      return wp;
    }

    function walkToward(mesh, tx, tz, dt) {
      const dx = tx - mesh.position.x;
      const dz = tz - mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.0) return true;
      const speed = 1.5 * dt;
      mesh.position.x += (dx / dist) * speed;
      mesh.position.z += (dz / dist) * speed;
      mesh.rotation.y = Math.atan2(dx, dz);
      const ud = mesh.userData;
      ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
      const swing = Math.sin(ud.walkPhase) * 0.6;
      if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
      if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
      if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
      if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
      mesh.position.y = 0;
      return false;
    }

    // Animate
    const clock = new THREE.Clock();
    clockRef.current = clock;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);

      // Move agents with collision
      Object.entries(agentTargetsRef.current).forEach(([id, target], agentIdx) => {
        const mesh = agentMeshesRef.current[id];
        if (!mesh) return;
        const ud = mesh.userData;

        // === SITTING STATE ===
        if (target.sitting) {
          const seat = agentSeatPositions[id];
          if (seat) {
            mesh.position.x = seat.x;
            mesh.position.z = seat.z;
            mesh.position.y = 0.18;
            mesh.rotation.y = seat.faceAngle;
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.2;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.2;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.5; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.5; ud.armRPivot.rotation.z = 0; }
          }
          // Auto-stand after sitTimer expires (only if not commanded to stay)
          if (!target.commanded) {
            target.sitTimer -= dt;
            if (target.sitTimer <= 0) {
              target.sitting = false;
              target.goToDesk = false;
              mesh.position.y = 0;
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
              // Step beside desk
              if (seat) {
                mesh.position.x = seat.x + Math.cos(seat.deskRot) * 1.2;
                mesh.position.z = seat.z - Math.sin(seat.deskRot) * 1.2;
              }
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 6 + 4;
            }
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO DESK ===
        if (target.goToDesk) {
          const seat = agentSeatPositions[id];
          if (seat) {
            const dx = seat.x - mesh.position.x;
            const dz = seat.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.sitting = true;
              target.goToDesk = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === SOFA SITTING STATE ===
        if (target.sofaSitting) {
          const seat = sofaSeats[target.sofaSeatIdx];
          if (seat) {
            mesh.position.x = seat.x;
            mesh.position.z = seat.z;
            mesh.position.y = seat.seatY;
            mesh.rotation.y = seat.faceAngle;
            // Relaxed sitting pose — legs bent forward, arms resting on armrests
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.1;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.1;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.2; ud.armLPivot.rotation.z = -0.4; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.2; ud.armRPivot.rotation.z = 0.4; }
          }
          // Auto-stand from sofa
          target.sofaSitTimer -= dt;
          if (target.sofaSitTimer <= 0) {
            target.sofaSitting = false;
            if (target.sofaSeatIdx >= 0) occupiedSofaSeats.delete(target.sofaSeatIdx);
            target.sofaSeatIdx = -1;
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            // Step away from sofa — teleport to clear walkway area
            mesh.position.x = 2 + (Math.random() - 0.5) * 2;
            mesh.position.z = 1 + (Math.random() - 0.5) * 2;
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO SOFA ===
        if (target.goToSofa) {
          const seat = sofaSeats[target.sofaSeatIdx];
          if (seat) {
            const dx = seat.x - mesh.position.x;
            const dz = seat.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.sofaSitting = true;
              target.goToSofa = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === CAFETERIA STATE ===
        if (target.cafeSitting) {
          const spot = cafeSpots[target.cafeSpotIdx];
          if (spot) {
            const back = typeof spot.back === "number" ? spot.back : 0.85;
            const sx = spot.x - Math.sin(spot.faceAngle) * back;
            const sz = spot.z - Math.cos(spot.faceAngle) * back;
            const side = typeof spot.side === "number" ? spot.side : 0;
            const rx = Math.cos(spot.faceAngle);
            const rz = -Math.sin(spot.faceAngle);
            mesh.position.x = sx + rx * side;
            mesh.position.z = sz + rz * side;
            mesh.position.y = 0.2;
            mesh.rotation.y = spot.faceAngle;
            target.cafePhase += dt * 4;
            if (ud.legLPivot) ud.legLPivot.rotation.x = -1.05;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -1.05;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.35; ud.armLPivot.rotation.z = -0.1; }
            if (ud.armRPivot) {
              ud.armRPivot.rotation.x = -0.55 + Math.sin(target.cafePhase) * 0.22;
              ud.armRPivot.rotation.z = 0.15;
            }
          }
          target.cafeTimer -= dt;
          if (target.cafeTimer <= 0) {
            target.cafeSitting = false;
            if (target.cafeSpotIdx >= 0) occupiedCafeSpots.delete(target.cafeSpotIdx);
            target.cafeSpotIdx = -1;
            target.cafePhase = 0;
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        if (target.goToCafe) {
          const spot = cafeSpots[target.cafeSpotIdx];
          if (spot) {
            const back = typeof spot.back === "number" ? spot.back : 0.85;
            const sx = spot.x - Math.sin(spot.faceAngle) * back;
            const sz = spot.z - Math.cos(spot.faceAngle) * back;
            const side = typeof spot.side === "number" ? spot.side : 0;
            const rx = Math.cos(spot.faceAngle);
            const rz = -Math.sin(spot.faceAngle);
            const tx = sx + rx * side;
            const tz = sz + rz * side;
            const dx = tx - mesh.position.x;
            const dz = tz - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.cafeSitting = true;
              target.goToCafe = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GYM ACTIVITY STATE ===
        if (target.gyming) {
          const spot = gymSpots[target.gymSpotIdx];
          if (spot) {
            const back = typeof spot.back === "number" ? spot.back : 1.0;
            const sx = spot.x - Math.sin(spot.faceAngle) * back;
            const sz = spot.z - Math.cos(spot.faceAngle) * back;
            const side = typeof spot.side === "number" ? spot.side : 0;
            const rx = Math.cos(spot.faceAngle);
            const rz = -Math.sin(spot.faceAngle);
            mesh.position.x = sx + rx * side;
            mesh.position.z = sz + rz * side;
            mesh.rotation.y = spot.faceAngle;
            target.gymPhase += dt * 6;
            const p = target.gymPhase;
            const pulse = Math.sin(p);
            mesh.position.y = 0;

            if (spot.activity === "treadmill") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 0.8;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 0.8;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -pulse * 0.55;
              if (ud.armRPivot) ud.armRPivot.rotation.x = pulse * 0.55;
            } else if (spot.activity === "elliptical") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 0.45;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 0.45;
              if (ud.armLPivot) ud.armLPivot.rotation.x = pulse * 0.65;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -pulse * 0.65;
            } else if (spot.activity === "bike") {
              mesh.position.y = 0.05;
              if (ud.legLPivot) ud.legLPivot.rotation.x = pulse * 1.0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -pulse * 1.0;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.65; ud.armLPivot.rotation.z = -0.1; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.65; ud.armRPivot.rotation.z = 0.1; }
            } else if (spot.activity === "chestpress") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.55;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.55;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.35 + Math.max(0, pulse) * 0.85;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.35 + Math.max(0, pulse) * 0.85;
            } else if (spot.activity === "ab_wheel") {
              mesh.position.y = 0.03;
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.25;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.25;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.8 - Math.abs(pulse) * 0.5;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 - Math.abs(pulse) * 0.5;
            } else if (spot.activity === "punching_bag") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0.1;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.12;
              if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.45; ud.armLPivot.rotation.z = -0.1; }
              if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.35 + Math.max(0, pulse) * 1.0; ud.armRPivot.rotation.z = 0.25; }
            } else if (spot.activity === "kettlebell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.25;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.25;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.7 + Math.max(0, pulse) * 0.9;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.7 + Math.max(0, pulse) * 0.9;
            } else if (spot.activity === "dumbbell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
              if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.45 + Math.abs(pulse) * 1.1;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.45 + Math.abs(Math.sin(p + Math.PI / 2)) * 1.1;
            } else if (spot.activity === "barbell") {
              if (ud.legLPivot) ud.legLPivot.rotation.x = -0.2;
              if (ud.legRPivot) ud.legRPivot.rotation.x = -0.2;
              if (ud.armLPivot) ud.armLPivot.rotation.x = -0.8 + Math.max(0, pulse) * 0.7;
              if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 + Math.max(0, pulse) * 0.7;
            }
          }

          target.gymTimer -= dt;
          if (target.gymTimer <= 0) {
            target.gyming = false;
            if (target.gymSpotIdx >= 0) occupiedGymSpots.delete(target.gymSpotIdx);
            target.gymSpotIdx = -1;
            target.gymActivity = "";
            mesh.position.y = 0;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        if (target.goToGym) {
          const spot = gymSpots[target.gymSpotIdx];
          if (spot) {
            const back = typeof spot.back === "number" ? spot.back : 1.0;
            const sx = spot.x - Math.sin(spot.faceAngle) * back;
            const sz = spot.z - Math.cos(spot.faceAngle) * back;
            const side = typeof spot.side === "number" ? spot.side : 0;
            const rx = Math.cos(spot.faceAngle);
            const rz = -Math.sin(spot.faceAngle);
            const tx = sx + rx * side;
            const tz = sz + rz * side;
            const dx = tx - mesh.position.x;
            const dz = tz - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.gyming = true;
              target.goToGym = false;
              target.gymActivity = spot.activity;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === PLAYING GAME ===
        if (target.playing) {
          const spot = allGameSpots[target.gameSpotIdx];
          if (spot) {
            mesh.position.x = spot.x;
            mesh.position.z = spot.z;
            mesh.position.y = 0;
            mesh.rotation.y = spot.faceAngle;

            // Check if partner is also at the table (playing, not still walking)
            let partnerReady = false;
            Object.entries(agentTargetsRef.current).forEach(([otherId, ot]) => {
              if (otherId === id) return;
              if (ot.playing && ot.gameSpotIdx >= 0) {
                const otherSpot = allGameSpots[ot.gameSpotIdx];
                if (otherSpot && otherSpot.game === spot.game) partnerReady = true;
              }
            });

            if (partnerReady) {
              // Both players at table — play!
              target.playPhase += dt * 6;

              if (spot.game === "pingpong") {
                if (ud.armRPivot) ud.armRPivot.rotation.x = -0.8 + Math.sin(target.playPhase) * 0.6;
                if (ud.armLPivot) ud.armLPivot.rotation.x = -0.3;
                if (ud.legLPivot) ud.legLPivot.rotation.x = Math.sin(target.playPhase * 0.5) * 0.15;
                if (ud.legRPivot) ud.legRPivot.rotation.x = -Math.sin(target.playPhase * 0.5) * 0.15;
              } else {
                if (ud.armRPivot) { ud.armRPivot.rotation.x = -0.6 + Math.sin(target.playPhase * 0.3) * 0.2; ud.armRPivot.rotation.z = 0; }
                if (ud.armLPivot) { ud.armLPivot.rotation.x = -0.6; ud.armLPivot.rotation.z = 0; }
                if (ud.legLPivot) ud.legLPivot.rotation.x = 0.1;
                if (ud.legRPivot) ud.legRPivot.rotation.x = -0.15;
              }

              // Only count down timer when both are playing
              target.playTimer -= dt;
            } else {
              // Waiting for partner — idle standing pose at the table
              if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.9;
              if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.9;
              if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.9;
              if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.9;
            }
          }
          // Auto-stop playing
          target.playTimer -= dt;
          if (target.playTimer <= 0) {
            // Find partner at the same table and stop them too
            const spot = allGameSpots[target.gameSpotIdx];
            const gameType = spot?.game;
            const mySpotIdx = target.gameSpotIdx;

            // Stop this agent
            target.playing = false;
            if (mySpotIdx >= 0) occupiedGameSpots.delete(mySpotIdx);
            target.gameSpotIdx = -1;
            if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
            if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
            mesh.position.x = sportsX + (Math.random() - 0.5) * 4;
            mesh.position.z = sportsZ + (Math.random() - 0.5) * 2;
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;

            // Find and stop partner
            Object.entries(agentTargetsRef.current).forEach(([otherId, otherTarget]) => {
              if (otherId === id) return;
              if (otherTarget.playing || otherTarget.goToGame) {
                const otherSpot = allGameSpots[otherTarget.gameSpotIdx];
                if (otherSpot && otherSpot.game === gameType) {
                  const otherMesh = agentMeshesRef.current[otherId];
                  otherTarget.playing = false;
                  otherTarget.goToGame = false;
                  if (otherTarget.gameSpotIdx >= 0) occupiedGameSpots.delete(otherTarget.gameSpotIdx);
                  otherTarget.gameSpotIdx = -1;
                  otherTarget.playTimer = 0;
                  if (otherMesh) {
                    const oud = otherMesh.userData;
                    if (oud.legLPivot) oud.legLPivot.rotation.x = 0;
                    if (oud.legRPivot) oud.legRPivot.rotation.x = 0;
                    if (oud.armLPivot) { oud.armLPivot.rotation.x = 0; oud.armLPivot.rotation.z = 0; }
                    if (oud.armRPivot) { oud.armRPivot.rotation.x = 0; oud.armRPivot.rotation.z = 0; }
                    otherMesh.position.x = sportsX + (Math.random() - 0.5) * 4;
                    otherMesh.position.z = sportsZ + (Math.random() - 0.5) * 2;
                    otherMesh.position.y = 0;
                  }
                  const v = pickValidTarget();
                  otherTarget.x = v.x;
                  otherTarget.z = v.z;
                  otherTarget.timer = Math.random() * 5 + 3;
                }
              }
            });
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === GOING TO GAME ===
        if (target.goToGame) {
          const spot = allGameSpots[target.gameSpotIdx];
          if (spot) {
            const dx = spot.x - mesh.position.x;
            const dz = spot.z - mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.3) {
              target.playing = true;
              target.goToGame = false;
              return;
            }
            const speed = 1.2 * dt;
            mesh.position.x += (dx / dist) * speed;
            mesh.position.z += (dz / dist) * speed;
            mesh.rotation.y = Math.atan2(dx, dz);
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) { ud.armLPivot.rotation.x = -swing * 0.7; ud.armLPivot.rotation.z = 0; }
            if (ud.armRPivot) { ud.armRPivot.rotation.x = swing * 0.7; ud.armRPivot.rotation.z = 0; }
            mesh.position.y = 0;
          }
          const ring = ud.ring;
          if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
          return;
        }

        // === NORMAL WALKING ===
        target.timer -= dt;
        if (target.timer <= 0) {
          const roll = Math.random();
          if (roll < 0.22) {
            // 22% — go sit at desk
            target.goToDesk = true;
            target.commanded = false;
            target.sitTimer = Math.random() * 30 + 30;
            target.timer = 999;
          } else if (roll < 0.34) {
            // 12% — go sit on a sofa
            const available = [];
            sofaSeats.forEach((s, idx) => {
              if (!occupiedSofaSeats.has(idx)) available.push(idx);
            });
            if (available.length > 0) {
              const seatIdx = available[Math.floor(Math.random() * available.length)];
              target.goToSofa = true;
              target.sofaSeatIdx = seatIdx;
              target.sofaSitTimer = Math.random() * 30 + 30;
              occupiedSofaSeats.add(seatIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.50) {
            // 16% — go to cafeteria
            const availableCafe = [];
            cafeSpots.forEach((s, idx) => {
              if (!occupiedCafeSpots.has(idx)) availableCafe.push(idx);
            });
            if (availableCafe.length > 0) {
              const spotIdx = availableCafe[Math.floor(Math.random() * availableCafe.length)];
              target.goToCafe = true;
              target.cafeSpotIdx = spotIdx;
              target.cafeTimer = Math.random() * 20 + 20;
              target.cafePhase = 0;
              occupiedCafeSpots.add(spotIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.66) {
            // 16% — go to gym activity
            const availableGym = [];
            gymSpots.forEach((s, idx) => {
              if (!occupiedGymSpots.has(idx)) availableGym.push(idx);
            });
            if (availableGym.length > 0) {
              const spotIdx = availableGym[Math.floor(Math.random() * availableGym.length)];
              target.goToGym = true;
              target.gymSpotIdx = spotIdx;
              target.gymTimer = Math.random() * 25 + 25;
              target.gymPhase = 0;
              target.gymActivity = gymSpots[spotIdx].activity;
              occupiedGymSpots.add(spotIdx);
              target.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else if (roll < 0.80) {
            // 14% — invite another agent to play a game
            const games = [
              { spots: [0, 1], name: "pingpong" },
              { spots: [2, 3], name: "billiards" },
            ];
            const availableGames = games.filter(g => g.spots.every(idx => !occupiedGameSpots.has(idx)));
            const freeAgents = Object.entries(agentTargetsRef.current).filter(([otherId, ot]) => {
              return otherId !== id && !ot.sitting && !ot.goToDesk && !ot.sofaSitting && !ot.goToSofa && !ot.cafeSitting && !ot.goToCafe && !ot.gyming && !ot.goToGym && !ot.playing && !ot.goToGame;
            });

            if (availableGames.length > 0 && freeAgents.length > 0) {
              const game = availableGames[Math.floor(Math.random() * availableGames.length)];
              const [partnerId, partnerTarget] = freeAgents[Math.floor(Math.random() * freeAgents.length)];
              const playTime = Math.random() * 30 + 30;

              // Send this agent to spot 0
              target.goToGame = true;
              target.gameSpotIdx = game.spots[0];
              target.playTimer = playTime;
              target.playPhase = 0;
              occupiedGameSpots.add(game.spots[0]);
              target.timer = 999;

              // Send partner to spot 1
              partnerTarget.goToGame = true;
              partnerTarget.gameSpotIdx = game.spots[1];
              partnerTarget.playTimer = playTime;
              partnerTarget.playPhase = Math.PI; // offset animation phase
              occupiedGameSpots.add(game.spots[1]);
              partnerTarget.timer = 999;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 10 + 5;
            }
          } else {
            // 20% — keep walking
            const valid = pickValidTarget();
            target.x = valid.x;
            target.z = valid.z;
            target.timer = Math.random() * 10 + 5;
          }
        }
        const dx = target.x - mesh.position.x;
        const dz = target.z - mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0.15) {
          const speed = 1.2 * dt;
          const nx = mesh.position.x + (dx / dist) * speed;
          const nz = mesh.position.z + (dz / dist) * speed;
          const prevX = mesh.position.x;
          const prevZ = mesh.position.z;

          // Check agent-agent collision
          const agentMinDist = 0.7;
          let agentBlocked = false;
          for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
            if (otherId === id || !otherMesh) continue;
            const adx = nx - otherMesh.position.x;
            const adz = nz - otherMesh.position.z;
            if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
              agentBlocked = true;
              break;
            }
          }

          if (agentBlocked) {
            const perpX = mesh.position.x + (-dz / dist) * speed;
            const perpZ = mesh.position.z + (dx / dist) * speed;
            let perpBlocked = false;
            for (const [otherId, otherMesh] of Object.entries(agentMeshesRef.current)) {
              if (otherId === id || !otherMesh) continue;
              const adx = perpX - otherMesh.position.x;
              const adz = perpZ - otherMesh.position.z;
              if (Math.sqrt(adx * adx + adz * adz) < agentMinDist) {
                perpBlocked = true;
                break;
              }
            }
            if (!perpBlocked && !isBlocked(perpX, perpZ)) {
              mesh.position.x = perpX;
              mesh.position.z = perpZ;
            }
          } else if (!isBlocked(nx, nz)) {
            mesh.position.x = nx;
            mesh.position.z = nz;
          } else {
            if (!isBlocked(nx, mesh.position.z)) {
              mesh.position.x = nx;
            } else if (!isBlocked(mesh.position.x, nz)) {
              mesh.position.z = nz;
            } else {
              const valid = pickValidTarget();
              target.x = valid.x;
              target.z = valid.z;
              target.timer = Math.random() * 3 + 2;
            }
          }

          // Check if agent actually moved
          const moved = Math.abs(mesh.position.x - prevX) > 0.001 || Math.abs(mesh.position.z - prevZ) > 0.001;
          const ud = mesh.userData;

          if (moved) {
            mesh.rotation.y = Math.atan2(dx, dz);

            // Walk animation
            ud.walkPhase = (ud.walkPhase || 0) + dt * 8;
            const swing = Math.sin(ud.walkPhase) * 0.6;
            if (ud.legLPivot) ud.legLPivot.rotation.x = swing;
            if (ud.legRPivot) ud.legRPivot.rotation.x = -swing;
            if (ud.armLPivot) ud.armLPivot.rotation.x = -swing * 0.7;
            if (ud.armRPivot) ud.armRPivot.rotation.x = swing * 0.7;
          } else {
            // Blocked — ease limbs to rest
            if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
            if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
            if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
            if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          }
          mesh.position.y = 0;
        } else {
          // Idle
          const ud = mesh.userData;
          if (ud.legLPivot) ud.legLPivot.rotation.x *= 0.85;
          if (ud.legRPivot) ud.legRPivot.rotation.x *= 0.85;
          if (ud.armLPivot) ud.armLPivot.rotation.x *= 0.85;
          if (ud.armRPivot) ud.armRPivot.rotation.x *= 0.85;
          const breathe = Math.sin(Date.now() * 0.002 + agentIdx * 1.5) * 0.015;
          mesh.position.y = 0;
          if (ud.armLPivot) ud.armLPivot.rotation.z = breathe;
          if (ud.armRPivot) ud.armRPivot.rotation.z = -breathe;
        }
        const ring = mesh.userData.ring;
        if (ring) ring.material.opacity = 0.3 + Math.sin(Date.now() * 0.003) * 0.2;
      });

      // Follow agent — smoothly track their position
      if (followAgentRef.current) {
        const followMesh = agentMeshesRef.current[followAgentRef.current];
        if (followMesh) {
          const cs = cameraStateRef.current;
          // Smoothly lerp camera target to agent position + mid-body height
          cs.target.x += (followMesh.position.x - cs.target.x) * 0.08;
          cs.target.y += (0.7 - cs.target.y) * 0.08;
          cs.target.z += (followMesh.position.z - cs.target.z) * 0.08;
        }
      } else {
        // When not following, ease target Y back to ground
        const cs = cameraStateRef.current;
        cs.target.y += (0 - cs.target.y) * 0.05;
      }

      updateCam();

      // Update label positions via direct DOM manipulation
      agentsRef.current.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        let el = labelElemsRef.current[a.id];
        if (!el && labelContainerRef.current) {
          el = document.createElement("div");
          el.style.cssText = `position:absolute;pointer-events:none;padding:3px 8px;background:rgba(10,10,15,0.85);border:1px solid ${hexToCSS(a.color)}40;border-radius:4px;font-family:'Courier New',monospace;font-size:10px;font-weight:600;color:#e0e0e8;display:flex;align-items:center;gap:4px;white-space:nowrap;transform:translate(-50%,-100%);will-change:left,top;`;
          const dot = document.createElement("span");
          dot.className = "status-dot";
          const rt = a.runtime || (a.status === "working" ? "thinking" : "idle");
          const dotColor = rt === "error" ? "#ff4d4d" : rt === "tool" ? "#9945ff" : rt === "thinking" ? "#00d1ff" : "#ffaa22";
          dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;`;
          el.appendChild(dot);
          el.appendChild(document.createTextNode(a.name));
          labelContainerRef.current.appendChild(el);
          labelElemsRef.current[a.id] = el;
        }
        if (el) {
          const pos = new THREE.Vector3(mesh.position.x, 1.7, mesh.position.z);
          pos.project(camera);
          const x = (pos.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
          const y = (-pos.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
          el.style.left = x + "px";
          el.style.top = y + "px";
          // Update status dot color
          const dot = el.querySelector(".status-dot");
          const rt = agentsRef.current.find(ag => ag.id === a.id)?.runtime || "idle";
          const dotColor = rt === "error" ? "#ff4d4d" : rt === "tool" ? "#9945ff" : rt === "thinking" ? "#00d1ff" : "#ffaa22";
          if (dot) dot.style.background = dotColor;
        }
      });

      // Update agent screens
      const elapsed = clock.elapsedTime;
      AGENTS.forEach(a => updateScreen(a.id, elapsed));

      // Update wall trading charts
      updateWallScreens(elapsed);

      // Cafeteria ambient animations — only when someone is actually in the cafeteria
      const cafeActive = Object.values(agentTargetsRef.current).some(t => t.cafeSitting);
      if (cafeActive) {
        steamPuffs.forEach((puff) => {
          const pu = puff.userData;
          pu.rise += dt * pu.speed;
          if (pu.rise > 1.1) pu.rise = 0;
          puff.position.x = pu.baseX + Math.sin(elapsed * 2.2 + pu.sway) * 0.06;
          puff.position.z = pu.baseZ + Math.cos(elapsed * 1.8 + pu.sway) * 0.05;
          puff.position.y = pu.baseY + pu.rise * 0.9;
          const s = 0.65 + pu.rise * 1.4;
          puff.scale.setScalar(s);
          puff.material.opacity = Math.max(0, 0.34 - pu.rise * 0.26);
        });
        machineLight.material.emissiveIntensity = 1 + (Math.sin(elapsed * 4.5) * 0.35 + 0.35);
        fridgeCoolGlow.material.emissiveIntensity = 0.45 + (Math.sin(elapsed * 2) * 0.25 + 0.25);
        fridgeLeds.forEach((led, idx) => {
          const pulse = Math.sin(elapsed * (3.2 + idx * 0.8) + led.userData.phase);
          led.material.emissiveIntensity = 0.4 + Math.max(0, pulse) * 1.2;
        });
      } else {
        // Freeze/quiet visuals when inactive (no drifting steam, no pulsing LEDs).
        steamPuffs.forEach((puff) => {
          puff.material.opacity = 0;
        });
        machineLight.material.emissiveIntensity = 0.2;
        fridgeCoolGlow.material.emissiveIntensity = 0.2;
        fridgeLeds.forEach((led) => {
          led.material.emissiveIntensity = 0.0;
        });
      }

      // Animate game balls — only when both players are at the table
      let ppPlayingCount = 0;
      let bilPlayingCount = 0;
      Object.values(agentTargetsRef.current).forEach(t => {
        if (t.playing && t.gameSpotIdx >= 0) {
          const spot = allGameSpots[t.gameSpotIdx];
          if (spot?.game === "pingpong") ppPlayingCount++;
          if (spot?.game === "billiards") bilPlayingCount++;
        }
      });
      const ppActive = ppPlayingCount >= 2;
      const bilActive = bilPlayingCount >= 2;

      // Gym prop animations — only when the matching activity is active
      const activeGymActivities = new Set();
      Object.values(agentTargetsRef.current).forEach(t => {
        if (t.gyming && t.gymSpotIdx >= 0) {
          const spot = gymSpots[t.gymSpotIdx];
          if (spot?.activity) activeGymActivities.add(spot.activity);
        }
      });

      const gp = gymPropsRef.current || {};
      // treadmill decks "vibrate"/pulse
      if (Array.isArray(gp.treadmillDecks)) {
        const on = activeGymActivities.has("treadmill");
        gp.treadmillDecks.forEach((d, i) => {
          d.position.y = 0.55 + (on ? Math.sin(elapsed * 18 + i) * 0.01 : 0);
        });
      }
      // elliptical handles swing
      if (gp.ellipticalHandleL && gp.ellipticalHandleR) {
        const on = activeGymActivities.has("elliptical");
        const swing = on ? Math.sin(elapsed * 6) * 0.35 : 0;
        gp.ellipticalHandleL.rotation.x = swing;
        gp.ellipticalHandleR.rotation.x = -swing;
      }
      // bike wheel spin
      if (gp.bikeWheel) {
        const on = activeGymActivities.has("bike");
        gp.bikeWheel.rotation.y = on ? (elapsed * 10) % (Math.PI * 2) : 0;
      }
      // chest press handles pump
      if (gp.chestPressHandleL && gp.chestPressHandleR) {
        const on = activeGymActivities.has("chestpress");
        const pump = on ? Math.max(0, Math.sin(elapsed * 5)) * 0.18 : 0;
        gp.chestPressHandleL.position.x = (gp.chestPressHandleL.userData.baseX ?? gp.chestPressHandleL.position.x);
        gp.chestPressHandleR.position.x = (gp.chestPressHandleR.userData.baseX ?? gp.chestPressHandleR.position.x);
        if (gp.chestPressHandleL.userData.baseX == null) gp.chestPressHandleL.userData.baseX = gp.chestPressHandleL.position.x;
        if (gp.chestPressHandleR.userData.baseX == null) gp.chestPressHandleR.userData.baseX = gp.chestPressHandleR.position.x;
        gp.chestPressHandleL.position.x = gp.chestPressHandleL.userData.baseX - pump;
        gp.chestPressHandleR.position.x = gp.chestPressHandleR.userData.baseX - pump;
      }
      // (bench press / barbel rack / trampoline removed)
      // ab wheel spin
      if (gp.abWheel) {
        const on = activeGymActivities.has("ab_wheel");
        gp.abWheel.rotation.x = on ? (elapsed * 12) % (Math.PI * 2) : 0;
      }
      // punching bag sway
      if (gp.punchBag) {
        const on = activeGymActivities.has("punching_bag");
        gp.punchBag.rotation.z = on ? Math.sin(elapsed * 5) * 0.18 : 0;
      }

      // Ping pong ball — bounces back and forth across the table
      ppBall.visible = ppActive;
      if (ppActive) {
        const t = elapsed * 3;
        ppBall.position.x = sportsX + Math.sin(t) * 1.0; // side to side
        ppBall.position.z = sportsZ + 3 + Math.sin(t * 1.7) * 0.3; // slight drift
        ppBall.position.y = 0.9 + Math.abs(Math.sin(t * 2)) * 0.3; // bouncing arc
      }

      // Billiard balls — slow rolling movement when playing
      billiardBalls.forEach((ball, i) => {
        ball.visible = bilActive;
        if (bilActive) {
          const t = elapsed * 0.4 + i * 2;
          const phase = Math.sin(t);
          // Balls slowly drift and settle
          if (i === billiardBalls.length - 1) {
            // Cue ball — moves more dramatically
            ball.position.x = ball.userData.baseX + Math.sin(elapsed * 0.8) * 0.4;
            ball.position.z = ball.userData.baseZ + Math.cos(elapsed * 0.6) * 0.3;
          } else {
            // Other balls — gentle rolling
            ball.position.x = ball.userData.baseX + Math.sin(t) * 0.15;
            ball.position.z = ball.userData.baseZ + Math.cos(t * 0.7) * 0.1;
          }
          ball.position.y = 0.9;
          ball.rotation.x += dt * (i + 1) * 0.5;
          ball.rotation.z += dt * (i + 1) * 0.3;
        }
      });

      // Park water animation (cheap: references stored on the scene)
      if (scene.userData.parkWater) {
        scene.userData.parkWater.material.emissiveIntensity = 0.25 + (Math.sin(elapsed * 2.2) * 0.1 + 0.1);
      }
      // Lamp glow pools flicker slightly
      if (scene.userData.parkLampPools) {
        scene.userData.parkLampPools.forEach((pool) => {
          const phase = pool.userData.phase || 0;
          pool.material.opacity = 0.18 + (Math.sin(elapsed * 2.6 + phase) * 0.05 + 0.05);
        });
      }
      // Playground swing motion
      if (scene.userData.parkPlayground) {
        scene.userData.parkPlayground.children.forEach((c) => {
          if (c?.userData?.parkSwing) {
            const ph = c.userData.swingPhase || 0;
            c.rotation.x = Math.sin(elapsed * 2.2 + ph) * 0.35;
          }
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    // Mouse handlers — left drag = pan, right drag = rotate, scroll = zoom
    const el = renderer.domElement;
    const onDown = (e) => {
      dragRef.current = { dragging: true, button: e.button, prevX: e.clientX, prevY: e.clientY };
    };
    const onMove = (e) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.prevX;
      const dy = e.clientY - dragRef.current.prevY;
      const cs = cameraStateRef.current;

      if (dragRef.current.button === 0) {
        // Left drag = pan (move target) — also breaks follow
        followAgentRef.current = null;
        const panSpeed = cs.distance * 0.0008;
        const angle = cs.angle;
        // Pan relative to camera orientation
        cs.target.x -= (Math.sin(angle) * dx + Math.cos(angle) * dy) * panSpeed;
        cs.target.z += (Math.cos(angle) * dx - Math.sin(angle) * dy) * panSpeed;
      } else if (dragRef.current.button === 2) {
        // Right drag = rotate horizontal + vertical
        cs.angle += dx * 0.002;
        cs.pitch = Math.max(0.1, Math.min(1.2, cs.pitch - dy * 0.002));
      }

      dragRef.current.prevX = e.clientX;
      dragRef.current.prevY = e.clientY;
    };
    const onUp = () => { dragRef.current.dragging = false; };
    const onWheel = (e) => {
      cameraStateRef.current.distance += e.deltaY * 0.02;
      cameraStateRef.current.distance = Math.max(3, Math.min(50, cameraStateRef.current.distance));
    };
    const onContext = (e) => { e.preventDefault(); }; // prevent right-click menu
    const onClick = (e) => {
      const rect = el.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Check monitor clicks first
      const allMonitorMeshes = [];
      Object.entries(monitorMeshes).forEach(([agentId, meshes]) => {
        meshes.forEach(m => allMonitorMeshes.push(m));
      });
      const monitorHits = raycaster.intersectObjects(allMonitorMeshes, false);
      if (monitorHits.length > 0 && monitorHits[0].object.userData.agentId) {
        setMonitorModal(monitorHits[0].object.userData.agentId);
        return;
      }

      // Then check agent clicks
      let closest = null, closestDist = Infinity;
      AGENTS.forEach(a => {
        const mesh = agentMeshesRef.current[a.id];
        if (!mesh) return;
        const ints = raycaster.intersectObjects(mesh.children, true);
        if (ints.length > 0 && ints[0].distance < closestDist) {
          closestDist = ints[0].distance;
          closest = a;
        }
      });
      if (closest) {
        if (followAgentRef.current === closest.id) {
          followAgentRef.current = null;
          setSelectedAgent(null);
        } else {
          followAgentRef.current = closest.id;
          setSelectedAgent(closest.id);
          cameraStateRef.current.distance = 3;
        }
      } else {
        followAgentRef.current = null;
        setSelectedAgent(null);
      }
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    el.addEventListener("wheel", onWheel);
    el.addEventListener("click", onClick);
    el.addEventListener("contextmenu", onContext);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", onResize);
      Object.values(labelElemsRef.current).forEach(e => e.remove());
      labelElemsRef.current = {};
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Resize renderer when panel opens/closes
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = canvasRef.current;
      const renderer = rendererRef.current;
      if (container && renderer) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
      }
    }, 320); // wait for CSS transition to finish
    return () => clearTimeout(timer);
  }, [panelOpen]);

  // Simulated agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => {
        const updated = [...prev];
        const idx = Math.floor(Math.random() * updated.length);
        if (Math.random() > 0.6) {
          updated[idx] = { ...updated[idx], status: updated[idx].status === "working" ? "idle" : "working" };
          const mesh = agentMeshesRef.current[updated[idx].id];
          if (mesh?.userData.ring) {
            mesh.userData.ring.material.color.set(updated[idx].status === "working" ? 0x14f195 : 0xffaa22);
          }
        }
        return updated;
      });
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const tmpl = ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
      setActivityLog(prev => [{ time: timeStr(), ...tmpl(a) }, ...prev].slice(0, 50));
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatLog]);

  const runTask = useCallback(async ({ agentId, desc, parentId, retryOf }) => {
    const agent = agents.find(a => a.id === agentId) || agents[0];
    const taskId = Date.now() + Math.floor(Math.random() * 1000);
    const task = {
      id: taskId,
      agent: agent.name,
      agentId,
      desc,
      status: "running",
      log: [],
      result: "",
      parentId,
      retryOf,
      createdAt: Date.now(),
    };
    setTasks(prev => [task, ...prev]);
    setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `task started: ${desc}` }, ...prev]);
    appendTerminal(agentId, `TASK> ${desc}`, "info");
    commandAgentToDesk(agentId);
    bumpAgentActivity(agentId, { thinking: 1 });
    const route = getAgentRoute(agentId);

    const ctrl = new AbortController();
    taskAbortRef.current[taskId] = ctrl;
    const t0 = performance.now();
    let lastChunkAt = Date.now();
    const idleTimer = setInterval(() => {
      if (Date.now() - lastChunkAt > getTimeoutsForAgent(agentId).streamIdleMs) ctrl.abort();
    }, 2_500);

    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName: agent.name,
          agentRole: agent.role,
          intent: "task",
          openclawAgentId: route.openclawAgentId,
          model: route.model,
          message:
            `You have been assigned a task. Provide a short execution plan and the result/output.\n` +
            (formatBuffLine(agentId) ? `\n${formatBuffLine(agentId)}\n` : "\n") +
            `\nTask: ${desc}`,
          history: [],
        }),
      });

      if (!r.ok || !r.body) {
        const t = await r.text().catch(() => "");
        const errText = `Task failed (${r.status}). ${t || ""}`.trim();
        setTasks(prev => prev.map(tt => tt.id === taskId ? { ...tt, status: "failed", endedAt: Date.now(), error: errText } : tt));
        setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: errText }, ...prev]);
        appendTerminal(agentId, errText, "warning");
        logObs({
          type: "task",
          agentId,
          label: desc,
          ok: false,
          status: r.status,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens(desc),
          outTok: approxTokens(t || errText),
          req: sanitizePreview({ intent: "task", message: desc }, 700),
          res: sanitizePreview(t || errText, 900),
        });
        bumpAgentActivity(agentId, { error: true });
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let lastFlushLen = 0;

      const flush = (force = false) => {
        const delta = acc.slice(lastFlushLen);
        if (!delta) return;
        if (!force && delta.length < 80 && !delta.includes("\n")) return;
        lastFlushLen = acc.length;
        const chunk = delta.replace(/\\s+/g, " ").trim();
        appendTerminal(agentId, chunk, "output");
        setTasks(prev => prev.map(tt => {
          if (tt.id !== taskId) return tt;
          const nextLog = [...(tt.log || []), chunk].slice(-200);
          return { ...tt, log: nextLog };
        }));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        lastChunkAt = Date.now();
        let idx;
        while ((idx = buf.indexOf("\\n\\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = frame.split("\\n").map(l => l.trimEnd());
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = null; }
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              acc += delta;
              flush(false);
            }
          }
        }
      }

      flush(true);
      const final = acc.trim();
      setTasks(prev => prev.map(tt => tt.id === taskId ? { ...tt, status: "done", result: final, endedAt: Date.now() } : tt));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: `task completed: ${desc}` }, ...prev]);
      appendTerminal(agentId, `DONE> ${desc}`, "success");

      logObs({
        type: "task",
        agentId,
        label: desc,
        ok: true,
        status: 200,
        ms: Math.round(performance.now() - t0),
        inTok: approxTokens(desc),
        outTok: approxTokens(final),
        req: sanitizePreview({ intent: "task", message: desc }, 700),
        res: sanitizePreview(final, 900),
      });
      generateFollowupSubtasks({ ...task, result: final, log: [] });
    } catch (e) {
      if (e?.name === "AbortError") {
        appendTerminal(agentId, "TASK> cancelled", "warning");
        logObs({
          type: "task",
          agentId,
          label: desc,
          ok: false,
          error: "timeout_or_cancelled",
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens(desc),
          outTok: 0,
          req: sanitizePreview({ intent: "task", message: desc }, 700),
          res: sanitizePreview("timeout_or_cancelled", 900),
        });
        bumpAgentActivity(agentId, { error: true });
        return;
      }
      const errText = `Task network error: ${e?.message || String(e)}`;
      setTasks(prev => prev.map(tt => tt.id === taskId ? { ...tt, status: "failed", endedAt: Date.now(), error: errText } : tt));
      setActivityLog(prev => [{ time: timeStr(), hl: agent.name, text: errText }, ...prev]);
      appendTerminal(agentId, errText, "warning");
      logObs({
        type: "task",
        agentId,
        label: desc,
        ok: false,
        error: e?.message || String(e),
        ms: Math.round(performance.now() - t0),
        inTok: approxTokens(desc),
        outTok: 0,
        req: sanitizePreview({ intent: "task", message: desc }, 700),
        res: sanitizePreview(e?.message || String(e), 900),
      });
      bumpAgentActivity(agentId, { error: true });
    } finally {
      clearInterval(idleTimer);
      delete taskAbortRef.current[taskId];
      bumpAgentActivity(agentId, { thinking: -1 });
    }
  }, [agents, appendTerminal, generateFollowupSubtasks, approxTokens, sanitizePreview, logObs, commandAgentToDesk, bumpAgentActivity, getTimeoutsForAgent, formatBuffLine, getAgentRoute]);

  const assignTask = useCallback(async () => {
    const desc = taskInput.trim();
    if (!desc) return;
    const agentId = taskAgent || AGENTS[Math.floor(Math.random() * AGENTS.length)].id;
    setTaskInput("");
    await runTask({ agentId, desc });
  }, [taskInput, taskAgent, runTask]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatLog(prev => [...prev, { from: "You", text: chatInput, color: "#e0e0e8" }]);
    const msg = chatInput;
    setChatInput("");
    setTimeout(() => {
      const a = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const resp = CHAT_RESPONSES[Math.floor(Math.random() * CHAT_RESPONSES.length)];
      setChatLog(prev => [...prev, { from: a.name, text: resp, color: hexToCSS(a.color) }]);
    }, 800 + Math.random() * 1200);
  }, [chatInput]);

  const chatMsgEndRef = useRef(null);
  useEffect(() => { chatMsgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistories, chatAgent]);

  useEffect(() => {
    if (!settingsOpen || !settingsFocusAgent) return;
    const el = settingsAgentRowRef.current?.[settingsFocusAgent];
    if (!el) return;
    const t = setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    return () => clearTimeout(t);
  }, [settingsOpen, settingsFocusAgent]);

  const sendAgentChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistories(prev => ({
      ...prev,
      [chatAgent]: [...(prev[chatAgent] || []), { from: "You", text: msg, time: timeStr() }]
    }));

    const agent = AGENTS.find(a => a.id === chatAgent);
    const lower = msg.toLowerCase();

    // Helper to reset agent from any current activity
    function resetAgent(agentId) {
      const t = agentTargetsRef.current[agentId];
      const m = agentMeshesRef.current[agentId];
      if (!t) return;
      // Free sofa seat
      if (t.sofaSeatIdx >= 0) { /* occupiedSofaSeats managed in useEffect scope */ }
      // Free game spot
      if (t.gameSpotIdx >= 0) { /* occupiedGameSpots managed in useEffect scope */ }
      t.sitting = false; t.goToDesk = false; t.commanded = false;
      t.sofaSitting = false; t.goToSofa = false; t.sofaSeatIdx = -1;
      t.cafeSitting = false; t.goToCafe = false; t.cafeSpotIdx = -1; t.cafeTimer = 0;
      t.gyming = false; t.goToGym = false; t.gymSpotIdx = -1; t.gymTimer = 0; t.gymActivity = "";
      t.playing = false; t.goToGame = false; t.gameSpotIdx = -1; t.playTimer = 0;
      if (m) {
        m.position.y = 0;
        const ud = m.userData;
        if (ud.legLPivot) ud.legLPivot.rotation.x = 0;
        if (ud.legRPivot) ud.legRPivot.rotation.x = 0;
        if (ud.armLPivot) { ud.armLPivot.rotation.x = 0; ud.armLPivot.rotation.z = 0; }
        if (ud.armRPivot) { ud.armRPivot.rotation.x = 0; ud.armRPivot.rotation.z = 0; }
      }
    }

    // Detect commands
    const sitKeywords = ["go to desk", "go to your desk", "work", "start working", "go work"];
    const standKeywords = ["stand", "stand up", "get up", "walk", "go walk", "stop", "leave", "move around"];
    const sofaKeywords = ["sofa", "couch", "relax", "chill", "take a break", "rest", "lounge"];
    const cafeteriaKeywords = ["cafeteria", "cafe", "coffee", "coffee break", "eat", "snack", "food", "lunch"];
    const gymKeywords = ["gym", "workout", "exercise", "train", "training", "fitness"];
    const gymEquipmentMap = [
      { keys: ["treadmill", "run"], idx: [0, 1] },
      { keys: ["elliptical"], idx: [2] },
      { keys: ["bike", "cycle"], idx: [3] },
      { keys: ["chest press", "chestpress"], idx: [4] },
      { keys: ["ab wheel", "abs"], idx: [5] },
      { keys: ["punch", "punching bag", "boxing"], idx: [6] },
      { keys: ["kettlebell", "kettle bell"], idx: [7] },
      { keys: ["dumbbell", "dumbbells"], idx: [8] },
      { keys: ["barbell", "barbells"], idx: [9] },
    ];
    const pingpongKeywords = ["ping pong", "pingpong", "table tennis", "play ping"];
    const billiardKeywords = ["billiard", "pool", "play pool", "shoot pool", "play billiard"];

    const isSitCommand = sitKeywords.some(k => lower.includes(k));
    const isStandCommand = standKeywords.some(k => lower.includes(k));
    const isSofaCommand = sofaKeywords.some(k => lower.includes(k));
    const isCafeteriaCommand = cafeteriaKeywords.some(k => lower.includes(k));
    const isGymCommand = gymKeywords.some(k => lower.includes(k));
    const isPingPongCommand = pingpongKeywords.some(k => lower.includes(k));
    const isBilliardCommand = billiardKeywords.some(k => lower.includes(k));

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function pickGymSpotFromMessage(text) {
      for (const row of gymEquipmentMap) {
        if (row.keys.some(k => text.includes(k))) return pickRandom(row.idx);
      }
      return Math.floor(Math.random() * gymSpots.length);
    }

    if (isSitCommand) {
      // Send agent to their desk (commanded — won't auto-stand)
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToDesk = true;
        target.commanded = true;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Copy that. Heading to my desk now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isSofaCommand) {
      // Send agent to sofa
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        // Find a free sofa seat — try from sofaSeatsRef or just set goToSofa
        target.goToSofa = true;
        target.sofaSeatIdx = -1; // will be assigned in movement loop
        // Find any free seat
        for (let i = 0; i < 8; i++) {
          target.sofaSeatIdx = i;
          break;
        }
        target.sofaSitTimer = 999; // commanded — stay until told otherwise
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Sure thing. Going to relax on the sofa.", time: timeStr() }]
        }));
      }, 600);
    } else if (isCafeteriaCommand) {
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToCafe = true;
        target.cafeSpotIdx = Math.floor(Math.random() * 6);
        target.cafeTimer = 999;
        target.cafePhase = 0;
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "On it. Heading to the cafeteria now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isGymCommand || gymEquipmentMap.some(row => row.keys.some(k => lower.includes(k)))) {
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.goToGym = true;
        target.gymSpotIdx = pickGymSpotFromMessage(lower);
        target.gymTimer = 999;
        target.gymPhase = 0;
        target.commanded = true;
        target.timer = 999;
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Got it. Going to the gym now.", time: timeStr() }]
        }));
      }, 600);
    } else if (isPingPongCommand || isBilliardCommand) {
      // Send agent to play — find a partner
      const gameName = isPingPongCommand ? "pingpong" : "billiards";
      const gameLabel = isPingPongCommand ? "ping pong" : "pool";

      // Find a free partner
      const freeAgents = Object.entries(agentTargetsRef.current).filter(([otherId, ot]) => {
        return otherId !== chatAgent && !ot.sitting && !ot.goToDesk && !ot.sofaSitting && !ot.goToSofa && !ot.cafeSitting && !ot.goToCafe && !ot.gyming && !ot.goToGym && !ot.playing && !ot.goToGame;
      });

      // Get the right spots (0,1 for pingpong, 2,3 for billiards)
      const spotOffset = isPingPongCommand ? 0 : 2;

      if (freeAgents.length > 0) {
        const [partnerId, partnerTarget] = freeAgents[Math.floor(Math.random() * freeAgents.length)];
        const partnerAgent = AGENTS.find(a => a.id === partnerId);
        const playTime = Math.random() * 30 + 30;

        resetAgent(chatAgent);
        resetAgent(partnerId);

        const target = agentTargetsRef.current[chatAgent];
        target.goToGame = true;
        target.gameSpotIdx = spotOffset;
        target.playTimer = playTime;
        target.playPhase = 0;
        target.timer = 999;

        partnerTarget.goToGame = true;
        partnerTarget.gameSpotIdx = spotOffset + 1;
        partnerTarget.playTimer = playTime;
        partnerTarget.playPhase = Math.PI;
        partnerTarget.timer = 999;

        setTimeout(() => {
          setChatHistories(prev => ({
            ...prev,
            [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: `Let's go! Invited ${partnerAgent?.name || "someone"} for a game of ${gameLabel}.`, time: timeStr() }]
          }));
        }, 600);
      } else {
        setTimeout(() => {
          setChatHistories(prev => ({
            ...prev,
            [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: `I'd love to play ${gameLabel}, but everyone's busy right now.`, time: timeStr() }]
          }));
        }, 600);
      }
    } else if (isStandCommand) {
      // Make agent stop whatever and walk
      resetAgent(chatAgent);
      const target = agentTargetsRef.current[chatAgent];
      if (target) {
        target.timer = Math.random() * 10 + 5;
        const mesh = agentMeshesRef.current[chatAgent];
        if (mesh) {
          // Move to open area
          mesh.position.x = 2 + (Math.random() - 0.5) * 4;
          mesh.position.z = (Math.random() - 0.5) * 4;
          mesh.position.y = 0;
          target.x = mesh.position.x + (Math.random() - 0.5) * 3;
          target.z = mesh.position.z + (Math.random() - 0.5) * 3;
        }
      }
      setTimeout(() => {
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: [...(prev[chatAgent] || []), { from: agent?.name || "Agent", text: "Roger. Getting up and moving around.", time: timeStr() }]
        }));
      }, 600);
    } else {
      // Real agent chat via OpenClaw (streamed)
      const replyId = Date.now();
      setChatHistories(prev => ({
        ...prev,
        [chatAgent]: [...(prev[chatAgent] || []), { id: replyId, from: agent?.name || "Agent", text: "", time: timeStr(), streaming: true }]
      }));

      appendTerminal(chatAgent, `USER> ${msg}`, "info");
      commandAgentToDesk(chatAgent);
      bumpAgentActivity(chatAgent, { thinking: 1 });
      const route = getAgentRoute(chatAgent);
      const chatModelOverride = (chatModelByAgent?.[chatAgent] || "").trim();
      const modelToUse = chatModelOverride || route.model;

      const history = (chatHistoriesRef.current?.[chatAgent] || [])
        .slice(-12)
        .filter(m => typeof m?.text === "string" && m.text.trim().length)
        .map(m => ({
          role: m.from === "You" ? "user" : "assistant",
          content: m.text
        }));

      const t0 = performance.now();
      const ctrl = new AbortController();
      let lastChunkAt = Date.now();
      const idleTimer = setInterval(() => {
        if (Date.now() - lastChunkAt > getTimeoutsForAgent(chatAgent).streamIdleMs) ctrl.abort();
      }, 2_500);
      try {
        const r = await fetch("/api/chat/stream", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: chatAgent,
            agentName: agent?.name,
            agentRole: agent?.role,
            intent: "chat",
            openclawAgentId: route.openclawAgentId,
            model: modelToUse,
            message: formatBuffLine(chatAgent) ? `${formatBuffLine(chatAgent)}\n\n${msg}` : msg,
            history
          }),
        });

        if (!r.ok || !r.body) {
          const t = await r.text().catch(() => "");
          const errText = `Gateway error (${r.status}). ${t || ""}`.trim();
          setChatHistories(prev => ({
            ...prev,
            [chatAgent]: (prev[chatAgent] || []).map(m => m.id === replyId ? { ...m, text: errText, streaming: false } : m)
          }));
          appendTerminal(chatAgent, errText, "warning");
          logObs({
            type: "chat",
            agentId: chatAgent,
            label: "chat",
            ok: false,
            status: r.status,
            ms: Math.round(performance.now() - t0),
            inTok: approxTokens(msg),
            outTok: approxTokens(t || errText),
            req: sanitizePreview({ intent: "chat", message: msg, model: modelToUse }, 700),
            res: sanitizePreview(t || errText, 900),
          });
          bumpAgentActivity(chatAgent, { error: true });
          return;
        }

        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        let lastFlushLen = 0;

        const flushTerminal = (force = false) => {
          const delta = acc.slice(lastFlushLen);
          if (!delta) return;
          if (!force && delta.length < 40 && !delta.includes("\n")) return;
          lastFlushLen = acc.length;
          appendTerminal(chatAgent, delta.replace(/\s+/g, " ").trim(), "output");
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          lastChunkAt = Date.now();

          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);

            const lines = frame.split("\n").map(l => l.trimEnd());
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              if (data === "[DONE]") {
                flushTerminal(true);
                setChatHistories(prev => ({
                  ...prev,
                  [chatAgent]: (prev[chatAgent] || []).map(m => m.id === replyId ? { ...m, streaming: false } : m)
                }));
                break;
              }
              let parsed;
              try { parsed = JSON.parse(data); } catch { parsed = null; }
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length) {
                acc += delta;
                setChatHistories(prev => ({
                  ...prev,
                  [chatAgent]: (prev[chatAgent] || []).map(m => m.id === replyId ? { ...m, text: acc } : m)
                }));
                flushTerminal(false);
              }
            }
          }
        }

        flushTerminal(true);
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: (prev[chatAgent] || []).map(m => m.id === replyId ? { ...m, text: acc, streaming: false } : m)
        }));
        logObs({
          type: "chat",
          agentId: chatAgent,
          label: "chat",
          ok: true,
          status: 200,
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens(msg),
          outTok: approxTokens(acc),
          req: sanitizePreview({ intent: "chat", message: msg }, 700),
          res: sanitizePreview(acc, 900),
        });
      } catch (e) {
        const errText = `Network error: ${e?.message || String(e)}`;
        setChatHistories(prev => ({
          ...prev,
          [chatAgent]: (prev[chatAgent] || []).map(m => m.id === replyId ? { ...m, text: errText, streaming: false } : m)
        }));
        appendTerminal(chatAgent, errText, "warning");
        logObs({
          type: "chat",
          agentId: chatAgent,
          label: "chat",
          ok: false,
          error: e?.name === "AbortError" ? "timeout" : (e?.message || String(e)),
          ms: Math.round(performance.now() - t0),
          inTok: approxTokens(msg),
          outTok: 0,
          req: sanitizePreview({ intent: "chat", message: msg }, 700),
          res: sanitizePreview(e?.name === "AbortError" ? "timeout" : (e?.message || String(e)), 900),
        });
        bumpAgentActivity(chatAgent, { error: true });
      } finally {
        clearInterval(idleTimer);
        bumpAgentActivity(chatAgent, { thinking: -1 });
      }
    }
  }, [chatInput, chatAgent, appendTerminal, approxTokens, sanitizePreview, logObs, commandAgentToDesk, bumpAgentActivity, getTimeoutsForAgent, formatBuffLine, getAgentRoute]);


  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0a0a0f", overflow: "hidden", position: "relative" }}>
      <div ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
      <div ref={labelContainerRef} style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none" }} />

      {/* TOP LEFT CAMERA CONTROLS */}
      <div style={{
        position: "fixed", top: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 0", border: "1px solid #2a2520", borderTop: "none", borderLeft: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Reset/overview angle */}
        <div onClick={() => {
          followAgentRef.current = null;
          setSelectedAgent(null);
          cameraStateRef.current.angle = Math.PI / 4;
          cameraStateRef.current.distance = 25;
          cameraStateRef.current.target.set(6, 0, 7.3 + (6 - 1) * 0.6 + 0.6 / 2 + 12.5);
        }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
        </div>
        {/* Front view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 2; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        {/* Isometric/3D view */}
        <div onClick={() => { cameraStateRef.current.angle = Math.PI / 4; }} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: "1px solid #3a3530", cursor: "pointer"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>

      {/* TOP BAR */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 16px 16px", border: "1px solid #2a2520", borderTop: "none",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "10px 28px 12px", gap: 8, minWidth: 500
      }}>
        {/* Title with decorative lines */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, transparent, #c8a050)" }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 600, fontSize: 13, letterSpacing: 6, color: "#c8a050" }}>
            MYCLAW3D
          </span>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(to left, transparent, #c8a050)" }} />
        </div>

        {/* Agent chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {agents.map(a => (
            <div key={a.id} onClick={() => {
              if (followAgentRef.current === a.id) {
                followAgentRef.current = null;
                setSelectedAgent(null);
              } else {
                followAgentRef.current = a.id;
                setSelectedAgent(a.id);
                cameraStateRef.current.distance = 3;
              }
            }} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
              background: selectedAgent === a.id ? "rgba(200,160,80,0.15)" : "rgba(30,28,24,0.8)",
              border: `1px solid ${selectedAgent === a.id ? "#c8a050" : "#3a3530"}`,
              borderRadius: 20, cursor: "pointer", transition: "all 0.2s"
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%",
                background: hexToCSS(a.color), flexShrink: 0,
                boxShadow: `0 0 6px ${hexToCSS(a.color)}60`
              }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#d4c5a0", fontFamily: "'Courier New', monospace" }}>{a.name}</span>
              {(() => {
                const active = getActiveBuffs(a.id);
                if (!active.length) return null;
                return (
                  <span style={{ display: "flex", gap: 4, marginLeft: 4 }}>
                    {active.slice(0, 2).map(b => (
                      <span key={b.key} style={{
                        fontSize: 8, fontWeight: 900, letterSpacing: 0.8,
                        padding: "2px 6px", borderRadius: 999,
                        border: "1px solid #2a2520",
                        background: "rgba(10,10,15,0.65)",
                        color: b.key.includes("gym") ? "#14f195" : b.key.includes("cafe") ? "#ffaa22" : "#00d1ff",
                        fontFamily: "'Courier New', monospace",
                        whiteSpace: "nowrap",
                      }}>
                        {(() => {
                          if (b.key === "sports_sync") return "SYNC";
                          if (b.key === "gym_stamina") return "STAM";
                          if (b.key === "gym_focus") return "FOCUS";
                          if (b.key === "cafe_recovery") return "RECOV";
                          if (b.key === "cafe_creativity") return "CREAT";
                          return String(b.label || b.key).replace(/\s+/g, "").split("+")[0].slice(0, 6).toUpperCase();
                        })()}
                      </span>
                    ))}
                  </span>
                );
              })()}
              <div style={{ display: "flex", gap: 5, marginLeft: 2 }} />
            </div>
          ))}
        </div>
      </div>

      {/* TOP RIGHT ICONS */}
      <div style={{
        position: "fixed", top: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 0 0 16px", border: "1px solid #2a2520", borderTop: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px"
      }}>
        {/* Tools icon */}
        <div onClick={() => setToolsOpen(true)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${toolsOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: toolsOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toolsOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <path d="M14.7 6.3a4 4 0 0 0-5.66 5.66l-5.2 5.2a2 2 0 0 0 2.83 2.83l5.2-5.2a4 4 0 0 0 5.66-5.66l-2.12 2.12-2.12-2.12 2.12-2.12Z"/>
          </svg>
        </div>
        {/* Settings icon */}
        <div onClick={() => setSettingsOpen(true)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${settingsOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: settingsOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={settingsOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4.7a7.2 7.2 0 0 0-1.7-1l-.4-2.5H10l-.4 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-.7-2 3.5 2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.7a7.2 7.2 0 0 0 1.7 1l.4 2.5h4.1l.4-2.5a7.2 7.2 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5Z"/>
          </svg>
        </div>
        {/* Tasks icon */}
        <div onClick={() => setTasksOpen(true)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${tasksOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: tasksOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tasksOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>
          </svg>
        </div>
      </div>

      {/* RIGHT SIDE VERTICAL TABS */}
      <div style={{
        position: "fixed", top: "50%", right: 0, transform: "translateY(-50%)", zIndex: 106,
        display: "flex", flexDirection: "column", gap: 6
      }}>
        <div onClick={() => { setHqPanelOpen(p => !p); setChatPanelOpen(false); }} style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace",
          color: hqPanelOpen ? "#0a0a0f" : "#c8a050",
          background: hqPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)",
          backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          transform: hqPanelOpen ? "translateX(-380px)" : "translateX(0)",
          opacity: (anyPanelOverlayOpen && !hqPanelOpen) ? 0 : 1,
          pointerEvents: (anyPanelOverlayOpen && !hqPanelOpen) ? "none" : "auto",
        }}>OPEN DASHBOARD</div>
        <div onClick={() => { setMarketplaceOpen(p => !p); setAnalyticsOpen(false); setHqPanelOpen(false); setChatPanelOpen(false); setMarketMsg(""); }} style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#9945ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          transform: marketplaceOpen ? "translateX(-420px)" : "translateX(0)",
          opacity: (anyPanelOverlayOpen && !marketplaceOpen) ? 0 : 1,
          pointerEvents: (anyPanelOverlayOpen && !marketplaceOpen) ? "none" : "auto",
        }}>MARKETPLACE</div>
        <div onClick={() => { setAnalyticsOpen(p => !p); setMarketplaceOpen(false); setHqPanelOpen(false); setChatPanelOpen(false); }} style={{
          writingMode: "vertical-rl", textOrientation: "mixed",
          padding: "18px 10px", fontSize: 9, letterSpacing: 3, fontWeight: 600,
          cursor: "pointer", transition: "all 0.3s ease", textAlign: "center",
          fontFamily: "'Courier New', monospace", color: "#00d1ff",
          background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
          border: "1px solid #2a2520", borderRight: "none",
          borderRadius: "10px 0 0 10px",
          transform: analyticsOpen ? "translateX(-420px)" : "translateX(0)",
          opacity: (anyPanelOverlayOpen && !analyticsOpen) ? 0 : 1,
          pointerEvents: (anyPanelOverlayOpen && !analyticsOpen) ? "none" : "auto",
        }}>ANALYTICS</div>
      </div>

      {/* MARKETPLACE PANEL */}
      <div style={{
        position: "fixed", top: 80, right: marketplaceOpen ? 0 : -420, bottom: 40, width: 420, zIndex: 105,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderRight: "none",
        borderRadius: "16px 0 0 16px",
        display: "flex", flexDirection: "column", transition: "right 0.3s ease",
        fontFamily: "'Courier New', monospace", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#9945ff", letterSpacing: 2, marginBottom: 4 }}>MARKETPLACE</div>
            <div style={{ fontSize: 10, color: "#6a6055" }}>Install and share playbooks + agent settings.</div>
          </div>
          <div onClick={() => setMarketplaceOpen(false)} style={{
            width: 26, height: 26, borderRadius: 8, border: "1px solid #2a2520",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: "#6a6055"
          }}>×</div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #2a2520", padding: "0 20px" }}>
          {[
            { k: "browse", label: "Browse" },
            { k: "importexport", label: "Import/Export" },
          ].map(t => (
            <div key={t.k} onClick={() => setMarketTab(t.k)} style={{
              padding: "10px 14px", fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s",
              color: marketTab === t.k ? "#e0e0e8" : "#6a6055",
              background: marketTab === t.k ? "rgba(153,69,255,0.12)" : "transparent",
              borderRadius: marketTab === t.k ? "6px 6px 0 0" : 0,
              borderBottom: marketTab === t.k ? "2px solid #9945ff" : "2px solid transparent",
            }}>{t.label}</div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {marketMsg ? (
            <div style={{ marginBottom: 10, fontSize: 10, color: marketMsg.startsWith("Install failed") || marketMsg.startsWith("Import failed") || marketMsg.startsWith("Export failed") || marketMsg.startsWith("Invalid JSON") ? "#ffaa22" : "#14f195" }}>
              {marketMsg}
            </div>
          ) : null}

          {marketTab === "browse" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {curatedPlaybooks.map((pb, idx) => (
                <div key={idx} style={{
                  padding: "12px 14px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520",
                  borderRadius: 10, borderLeft: `3px solid ${pb.color || "#9945ff"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#e0e0e8" }}>{pb.title}</div>
                    <button onClick={() => installPlaybookTemplate(pb)} style={{
                      padding: "7px 10px", fontSize: 10, fontWeight: 800, letterSpacing: 1,
                      background: "rgba(153,69,255,0.15)", border: "1px solid rgba(153,69,255,0.35)",
                      color: "#cdb6ff", borderRadius: 8, cursor: "pointer",
                    }}>INSTALL</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: "#6a6055", lineHeight: 1.4 }}>{pb.desc}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 9, color: "#4a4540" }}>
                    <span>interval: {Math.round((pb.intervalMs || 60000) / 60000)}m</span>
                    <span>agent: {pb.agentId || "random"}</span>
                    <span>{pb.enabled ? "enabled" : "disabled"}</span>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: "#4a4540", lineHeight: 1.5 }}>
                Tip: after installing, manage schedules in <b>OPEN DASHBOARD → playbooks</b>.
              </div>
            </div>
          )}

          {marketTab === "importexport" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={exportMarketBundle} style={{
                  padding: "9px 12px", fontSize: 10, fontWeight: 900, letterSpacing: 1,
                  background: "rgba(20,241,149,0.12)", border: "1px solid rgba(20,241,149,0.25)",
                  color: "#aaf3d1", borderRadius: 10, cursor: "pointer",
                }}>EXPORT JSON</button>
                <button onClick={importMarketBundle} style={{
                  padding: "9px 12px", fontSize: 10, fontWeight: 900, letterSpacing: 1,
                  background: "rgba(255,170,34,0.12)", border: "1px solid rgba(255,170,34,0.25)",
                  color: "#ffd39a", borderRadius: 10, cursor: "pointer",
                }}>IMPORT JSON</button>
                <button onClick={() => { setMarketImportText(""); setMarketMsg(""); }} style={{
                  padding: "9px 12px", fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  background: "transparent", border: "1px solid #2a2520",
                  color: "#6a6055", borderRadius: 10, cursor: "pointer",
                }}>CLEAR</button>
              </div>
              <div style={{ fontSize: 10, color: "#6a6055", lineHeight: 1.5 }}>
                Paste a bundle JSON containing <b>playbooks</b> (array) and/or <b>agentSettings</b> (object map).
              </div>
              <textarea value={marketImportText} onChange={(e) => setMarketImportText(e.target.value)} placeholder="{ ... }" style={{
                width: "100%", height: 280, resize: "vertical",
                background: "rgba(20,18,16,0.6)", border: "1px solid #2a2520",
                borderRadius: 10, padding: 12, color: "#e0e0e8",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                fontSize: 10, outline: "none",
              }} />
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #2a2520" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#6a6055" }}>TOOL CARDS</div>
              <div style={{ fontSize: 9, color: serverHealth?.hasToken ? "#14f195" : "#ffaa22" }}>
                {serverHealth?.hasToken ? "TOKEN OK" : "NO TOKEN"}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#6a6055", lineHeight: 1.5, marginBottom: 10 }}>
              These call <b>/api/tools/invoke</b>. Pick an agent from the Tools panel if you want; defaults to <b>{toolAgent}</b>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {curatedToolCards.map((c, idx) => (
                <div key={idx} style={{ padding: "12px 14px", background: "rgba(20,18,16,0.5)", border: "1px solid #2a2520", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#e0e0e8" }}>{c.title}</div>
                    <button disabled={marketToolBusy} onClick={() => runToolCard(c)} style={{
                      padding: "7px 10px", fontSize: 10, fontWeight: 900, letterSpacing: 1,
                      background: marketToolBusy ? "rgba(0,209,255,0.08)" : "rgba(0,209,255,0.12)",
                      border: "1px solid rgba(0,209,255,0.25)",
                      color: "#a7f0ff", borderRadius: 8, cursor: marketToolBusy ? "not-allowed" : "pointer",
                    }}>{marketToolBusy ? "RUNNING…" : "RUN"}</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: "#6a6055" }}>{c.desc}</div>
                  <div style={{ marginTop: 8, fontSize: 9, color: "#4a4540" }}>
                    tool: <b style={{ color: "#e0e0e8" }}>{c.tool}</b>{c.action ? ` · action: ${c.action}` : ""}
                  </div>
                </div>
              ))}
              {marketToolOutput ? (
                <pre style={{
                  marginTop: 2,
                  whiteSpace: "pre-wrap",
                  background: "rgba(10,10,15,0.7)",
                  border: "1px solid #2a2520",
                  borderRadius: 10,
                  padding: 12,
                  color: "#e0e0e8",
                  fontSize: 10,
                  overflowX: "auto",
                }}>{marketToolOutput}</pre>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ANALYTICS PANEL */}
      <div style={{
        position: "fixed", top: 80, right: analyticsOpen ? 0 : -420, bottom: 40, width: 420, zIndex: 105,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderRight: "none",
        borderRadius: "16px 0 0 16px",
        display: "flex", flexDirection: "column", transition: "right 0.3s ease",
        fontFamily: "'Courier New', monospace", overflow: "hidden"
      }}>
        <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#00d1ff", letterSpacing: 2, marginBottom: 4 }}>ANALYTICS</div>
            <div style={{ fontSize: 10, color: "#6a6055" }}>Summaries from local `/api/events`.</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={refreshEvents} style={{
              padding: "7px 10px", fontSize: 10, fontWeight: 900, letterSpacing: 1,
              background: "rgba(0,209,255,0.12)", border: "1px solid rgba(0,209,255,0.25)",
              color: "#a7f0ff", borderRadius: 10, cursor: "pointer",
            }}>REFRESH</button>
            <div onClick={() => setAnalyticsOpen(false)} style={{
              width: 26, height: 26, borderRadius: 8, border: "1px solid #2a2520",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              color: "#6a6055"
            }}>×</div>
          </div>
        </div>

        <div style={{ padding: "0 20px 12px", borderBottom: "1px solid #2a2520", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={analyticsAgent} onChange={(e) => setAnalyticsAgent(e.target.value)} style={{ background: "rgba(20,18,16,0.6)", border: "1px solid #2a2520", color: "#e0e0e8", borderRadius: 8, padding: "6px 8px", fontSize: 10 }}>
            <option value="all">all agents</option>
            {AGENTS.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <select value={analyticsType} onChange={(e) => setAnalyticsType(e.target.value)} style={{ background: "rgba(20,18,16,0.6)", border: "1px solid #2a2520", color: "#e0e0e8", borderRadius: 8, padding: "6px 8px", fontSize: 10 }}>
            <option value="all">all types</option>
            {Array.from(new Set((archivedEvents || []).map(e => e.type || "event"))).slice(0, 25).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#6a6055" }}>
            <input type="checkbox" checked={analyticsErrorsOnly} onChange={(e) => setAnalyticsErrorsOnly(e.target.checked)} />
            errors only
          </label>
          <select value={analyticsLimit} onChange={(e) => setAnalyticsLimit(Number(e.target.value))} style={{ background: "rgba(20,18,16,0.6)", border: "1px solid #2a2520", color: "#e0e0e8", borderRadius: 8, padding: "6px 8px", fontSize: 10 }}>
            {[120, 200, 300, 400, 500].map(n => <option key={n} value={n}>last {n}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { k: "total", label: "calls", v: analyticsSummary.total, c: "#00d1ff" },
              { k: "ok", label: "ok", v: analyticsSummary.ok, c: "#14f195" },
              { k: "err", label: "errors", v: analyticsSummary.errors, c: "#ff4d4d" },
              { k: "avg", label: "avg ms", v: analyticsSummary.avg ?? "—", c: "#c8a050" },
            ].map(card => (
              <div key={card.k} style={{ padding: "10px 12px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#6a6055", letterSpacing: 2, fontWeight: 800 }}>{card.label.toUpperCase()}</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: card.c }}>{card.v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10, color: "#6a6055" }}>
            <span>p95: <b style={{ color: "#e0e0e8" }}>{analyticsSummary.p95 ?? "—"}ms</b></span>
            <span>success: <b style={{ color: "#e0e0e8" }}>{analyticsSummary.total ? `${Math.round((analyticsSummary.ok / analyticsSummary.total) * 100)}%` : "—"}</b></span>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "10px 12px", background: "rgba(20,18,16,0.5)", border: "1px solid #2a2520", borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: "#6a6055", letterSpacing: 2, fontWeight: 800, marginBottom: 8 }}>TOP AGENTS</div>
              {analyticsSummary.topAgents.length ? analyticsSummary.topAgents.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#e0e0e8", marginBottom: 6 }}>
                  <span style={{ color: "#cdb6ff" }}>{k}</span>
                  <span style={{ color: "#6a6055" }}>{v}</span>
                </div>
              )) : <div style={{ fontSize: 10, color: "#4a4540" }}>—</div>}
            </div>
            <div style={{ padding: "10px 12px", background: "rgba(20,18,16,0.5)", border: "1px solid #2a2520", borderRadius: 10 }}>
              <div style={{ fontSize: 9, color: "#6a6055", letterSpacing: 2, fontWeight: 800, marginBottom: 8 }}>TOP TYPES</div>
              {analyticsSummary.topTypes.length ? analyticsSummary.topTypes.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#e0e0e8", marginBottom: 6 }}>
                  <span style={{ color: "#a7f0ff" }}>{k}</span>
                  <span style={{ color: "#6a6055" }}>{v}</span>
                </div>
              )) : <div style={{ fontSize: 10, color: "#4a4540" }}>—</div>}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520", borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: "#6a6055", letterSpacing: 2, fontWeight: 800, marginBottom: 8 }}>RECENT ERRORS</div>
            {analyticsSummary.recentErrors.length ? analyticsSummary.recentErrors.map(e => (
              <div key={e.id} style={{ padding: "8px 10px", border: "1px solid rgba(255,77,77,0.22)", background: "rgba(255,77,77,0.06)", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#ff8a8a" }}>{(e.type || "event").toUpperCase()}</span>
                  <span style={{ fontSize: 9, color: "#6a6055" }}>{new Date(Number(e.ts || Date.now())).toLocaleTimeString()}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "#e0e0e8", whiteSpace: "pre-wrap" }}>
                  {sanitizePreview(e.error || e.res || e.label || "error", 200)}
                </div>
              </div>
            )) : <div style={{ fontSize: 10, color: "#4a4540" }}>No errors in current filter.</div>}
          </div>
        </div>
      </div>

      {/* OPEN DASHBOARD PANEL */}
      <div style={{
        position: "fixed", top: 80, right: hqPanelOpen ? 0 : -380, bottom: 40, width: 380, zIndex: 105,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderRight: "none",
        borderRadius: "16px 0 0 16px",
        display: "flex", flexDirection: "column", transition: "right 0.3s ease",
        fontFamily: "'Courier New', monospace", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#14f195", letterSpacing: 2, marginBottom: 4 }}>MYCLAW3D</div>
          <div style={{ fontSize: 10, color: "#6a6055" }}>Monitor outputs, runs, and schedules.</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2a2520", padding: "0 20px" }}>
          {["inbox", "history", "playbooks", "observe"].map(tab => (
            <div key={tab} onClick={() => setHqTab(tab)} style={{
              padding: "10px 16px", fontSize: 10, letterSpacing: 1.5, fontWeight: 600,
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s",
              color: hqTab === tab ? "#e0e0e8" : "#6a6055",
              background: hqTab === tab ? "rgba(0,209,255,0.1)" : "transparent",
              borderRadius: hqTab === tab ? "6px 6px 0 0" : 0,
              borderBottom: hqTab === tab ? "2px solid #00d1ff" : "2px solid transparent",
            }}>{tab}</div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {hqTab === "inbox" && (
            <div>
              <div style={{ fontSize: 10, color: "#6a6055", textAlign: "center", padding: "40px 0" }}>No new messages in inbox.</div>
            </div>
          )}

          {hqTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {archivedEvents.length === 0 && (
                <div style={{ fontSize: 10, color: "#6a6055", textAlign: "center", padding: "40px 0" }}>
                  No history yet. Run a task, chat, or invoke a tool.
                </div>
              )}
              {archivedEvents.slice(0, 60).map(e => (
                <div key={e.id} style={{
                  padding: "10px 14px", background: "rgba(30,28,24,0.6)", border: "1px solid #2a2520",
                  borderRadius: 8, borderLeft: `3px solid ${e.ok ? "#14f195" : "#ffaa22"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: e.ok ? "#14f195" : "#ffaa22" }}>
                      {(e.type || "event").toUpperCase()}
                    </span>
                    <span style={{ fontSize: 9, color: "#4a4540" }}>
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#c8a050" }}>
                      {AGENTS.find(a => a.id === e.agentId)?.name || e.agentId || "—"}
                    </span>
                    <span style={{ fontSize: 9, color: "#4a4540" }}>
                      {typeof e.ms === "number" ? `${e.ms}ms` : "—"}
                    </span>
                    {!e.ok && (e.error || e.status) && (
                      <span style={{ fontSize: 9, color: "#ffaa22" }}>{e.error || `HTTP ${e.status}`}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#9a9590", lineHeight: 1.4 }}>
                    {e.label || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hqTab === "playbooks" && (
            <div>
              {/* Playbooks header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 4 }}>PLAYBOOKS</div>
                  <div style={{ fontSize: 10, color: "#4a4540" }}>Launch reusable schedules for the whole workspace.</div>
                </div>
                <button onClick={refreshPlaybooks} style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 9, fontWeight: 700,
                  background: "transparent", color: "#00d1ff", border: "1px solid #00d1ff",
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: 1
                }}>REFRESH</button>
              </div>

              {/* Active jobs */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 8 }}>ACTIVE JOBS</div>
                {playbooks.filter(p => p.enabled).length === 0 ? (
                  <div style={{ fontSize: 10, color: "#4a4540", padding: "8px 0" }}>No active playbooks yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {playbooks.filter(p => p.enabled).slice(0, 6).map(p => (
                      <div key={p.id} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "#e0e0e8", letterSpacing: 1 }}>{p.title}</div>
                          <div style={{ flex: 1 }} />
                          <button onClick={async () => {
                            try {
                              await fetch(`/api/playbooks/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: false }) });
                            } catch { /* ignore */ }
                            refreshPlaybooks();
                          }} style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: 9, fontWeight: 900,
                            background: "transparent", color: "#ffaa22", border: "1px solid #2a2520",
                            cursor: "pointer", letterSpacing: 1
                          }}>STOP</button>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 9, color: "#6a6055", lineHeight: 1.5 }}>
                          Every {Math.round((Number(p.intervalMs) || 60_000) / 1000)}s · next {p.nextRunAt ? new Date(p.nextRunAt).toLocaleTimeString() : "soon"}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 9, color: "#4a4540", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.taskText}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: "#2a2520", marginBottom: 16 }} />

              {/* Templates */}
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6a6055", letterSpacing: 2, marginBottom: 12 }}>TEMPLATES</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { title: "DAILY MORNING BRIEFING", desc: "Every 24h. Summarize priorities, blockers, and what changed overnight.", color: "#c8a050", intervalMs: 24 * 60 * 60 * 1000, taskText: "Create a morning briefing: priorities, blockers, and what changed overnight. Keep it concise." },
                  { title: "NIGHTLY CODE REVIEW DIGEST", desc: "Every 24h. Summarize risky changes or regressions.", color: "#c8a050", intervalMs: 24 * 60 * 60 * 1000, taskText: "Create a nightly digest: risky changes, regressions, and recommended follow-ups." },
                  { title: "HOURLY HEALTH CHECK", desc: "Every 60 min. Report runtime health and failures.", color: "#00d1ff", intervalMs: 60 * 60 * 1000, taskText: "Run a health check: note any failed tasks/tools, timeouts, and suspicious patterns. Suggest fixes." },
                  { title: "WEEKLY PROGRESS REPORT", desc: "Every 7d. Roll up wins and next steps.", color: "#14f195", intervalMs: 7 * 24 * 60 * 60 * 1000, taskText: "Create a weekly progress report: wins, unfinished work, and next steps." },
                  { title: "CONTINUOUS MONITOR", desc: "Every 15 min. Watch for drift or unusual errors.", color: "#9945ff", intervalMs: 15 * 60 * 1000, taskText: "Monitor for drift, silent failures, or unusual error spikes. Summarize findings and propose mitigations." },
                ].map((t, i) => (
                  <div key={i} onClick={async () => {
                    try {
                      await fetch("/api/playbooks", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: t.title,
                          desc: t.desc,
                          color: t.color,
                          intervalMs: t.intervalMs,
                          agentId: "random",
                          taskText: t.taskText || t.desc,
                          enabled: true,
                        }),
                      });
                    } catch { /* ignore */ }
                    refreshPlaybooks();
                    setActivityLog(prev => [{ time: timeStr(), hl: "MYCLAW3D", text: `playbook enabled: ${t.title}` }, ...prev].slice(0, 50));
                  }} style={{
                    padding: "14px 16px", background: "rgba(30,28,24,0.6)",
                    border: "1px solid #2a2520", borderRadius: 10,
                    borderLeft: `3px solid ${t.color}`, cursor: "pointer",
                    transition: "all 0.2s"
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#e0e0e8", letterSpacing: 1, marginBottom: 6 }}>{t.title}</div>
                    <div style={{ fontSize: 10, color: "#6a6055", lineHeight: 1.5 }}>{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hqTab === "observe" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#e0e0e8", letterSpacing: 1.2 }}>LIVE FEED</div>
                  <button onClick={() => { setObsEvents([]); setObsStatsByAgent(() => {
                    const s = {}; AGENTS.forEach(a => { s[a.id] = { calls: 0, errors: 0, timeMs: 0, inTok: 0, outTok: 0 }; }); return s;
                  }); }} style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 9, fontWeight: 800,
                    background: "transparent", color: "#6a6055", border: "1px solid #2a2520",
                    cursor: "pointer", letterSpacing: 1
                  }}>
                    CLEAR
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <select value={obsFilterAgent} onChange={(e) => setObsFilterAgent(e.target.value)} style={{
                    width: "100%", padding: "7px 9px", borderRadius: 10,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 10
                  }}>
                    <option value="all">All agents</option>
                    {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>

                  <select value={obsFilterType} onChange={(e) => setObsFilterType(e.target.value)} style={{
                    width: "100%", padding: "7px 9px", borderRadius: 10,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 10
                  }}>
                    <option value="all">All types</option>
                    {["tool", "task", "chat", "memory"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#6a6055", userSelect: "none" }}>
                    <input type="checkbox" checked={obsErrorsOnly} onChange={(e) => setObsErrorsOnly(e.target.checked)} />
                    errors only
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#6a6055", userSelect: "none", justifySelf: "end" }}>
                    <input type="checkbox" checked={obsShowDetails} onChange={(e) => setObsShowDetails(e.target.checked)} />
                    details
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {obsEvents.length === 0 && (
                    <div style={{ fontSize: 10, color: "#6a6055", textAlign: "center", padding: "18px 0" }}>
                      No events yet. Run a task, chat, or invoke a tool.
                    </div>
                  )}
                  {obsEvents
                    .filter(e => {
                      if (obsErrorsOnly && e.ok) return false;
                      if (obsFilterAgent !== "all" && e.agentId !== obsFilterAgent) return false;
                      if (obsFilterType !== "all" && (e.type || "") !== obsFilterType) return false;
                      return true;
                    })
                    .slice(0, 40)
                    .map(e => (
                    <div key={e.id} style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.55)",
                      borderLeft: `3px solid ${e.ok ? "#14f195" : "#ffaa22"}`
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: e.ok ? "#14f195" : "#ffaa22" }}>
                          {(e.type || "event").toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: "#c8a050", fontWeight: 700 }}>
                          {AGENTS.find(a => a.id === e.agentId)?.name || e.agentId || "—"}
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{ fontSize: 9, color: "#4a4540" }}>
                          {new Date(e.ts).toLocaleTimeString()}
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, color: "#9a9590", lineHeight: 1.4 }}>
                        {e.label || "—"}
                      </div>
                      <div style={{ marginTop: 6, display: "flex", gap: 10, fontSize: 9, color: "#6a6055" }}>
                        <span>{typeof e.ms === "number" ? `${e.ms}ms` : "—"}</span>
                        <span>in≈{e.inTok || 0} tok</span>
                        <span>out≈{e.outTok || 0} tok</span>
                        {!e.ok && (e.error || e.status) && (
                          <span style={{ color: "#ffaa22" }}>{e.error || `HTTP ${e.status}`}</span>
                        )}
                      </div>

                      {obsShowDetails && (e.req || e.res) && (
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                          {e.req && (
                            <div>
                              <div style={{ fontSize: 9, color: "#4a4540", marginBottom: 4 }}>req</div>
                              <pre style={{
                                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                fontSize: 9, color: "#cfc9c2", fontFamily: "'Courier New', monospace",
                                padding: 8, borderRadius: 10, border: "1px solid #2a2520",
                                background: "rgba(0,0,0,0.25)"
                              }}>{e.req}</pre>
                            </div>
                          )}
                          {e.res && (
                            <div>
                              <div style={{ fontSize: 9, color: "#4a4540", marginBottom: 4 }}>res</div>
                              <pre style={{
                                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                fontSize: 9, color: "#cfc9c2", fontFamily: "'Courier New', monospace",
                                padding: 8, borderRadius: 10, border: "1px solid #2a2520",
                                background: "rgba(0,0,0,0.25)"
                              }}>{e.res}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#e0e0e8", letterSpacing: 1.2, marginBottom: 8 }}>PER-AGENT STATS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {AGENTS.map(a => {
                    const s = obsStatsByAgent[a.id] || { calls: 0, errors: 0, timeMs: 0, inTok: 0, outTok: 0 };
                    return (
                      <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 10, border: "1px solid #2a2520", background: "rgba(10,10,15,0.55)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 999, background: hexToCSS(a.color), boxShadow: `0 0 8px ${hexToCSS(a.color)}80` }} />
                          <div style={{ fontSize: 10, fontWeight: 800, color: "#c8a050" }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: "#4a4540" }}>{a.role}</div>
                        </div>
                        <div style={{ fontSize: 9, color: "#6a6055", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                          <span>{s.calls} calls</span>
                          <span style={{ color: s.errors ? "#ffaa22" : "#14f195" }}>{s.errors} errs</span>
                          <span>{Math.round((s.timeMs || 0) / 1000)}s</span>
                          <span>in≈{s.inTok || 0}</span>
                          <span>out≈{s.outTok || 0}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM LEFT UTILITIES DOCK */}
      <div style={{
        position: "fixed", left: 0, bottom: 44, zIndex: 101,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 16px 16px 0", border: "1px solid #2a2520", borderLeft: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 10px"
      }}>
        {/* Map icon */}
        <div onClick={() => setMapOpen(prev => !prev)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${mapOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: mapOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={mapOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
        </div>
        {/* Docs/manual icon */}
        <div onClick={() => setDocsOpen(true)} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${docsOpen ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: docsOpen ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={docsOpen ? "#c8a050" : "#6a6055"} strokeWidth="1.8">
            <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/>
            <path d="M20 2H6.5A2.5 2.5 0 0 0 4 4.5v15"/>
            <path d="M8 6h8"/><path d="M8 10h8"/><path d="M8 14h6"/>
          </svg>
        </div>
        {/* Volume/mute icon */}
        <div onClick={toggleMusic} style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 8, border: `1px solid ${musicPlaying ? "#c8a050" : "#3a3530"}`, cursor: "pointer",
          background: musicPlaying ? "rgba(200,160,80,0.08)" : "transparent"
        }}>
          {musicPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </div>
      </div>

      {/* BOTTOM LEFT STATUS BAR */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, zIndex: 100,
        background: "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: "0 16px 0 0", border: "1px solid #2a2520", borderBottom: "none", borderLeft: "none",
        display: "flex", alignItems: "center", padding: "10px 24px", gap: 12,
        fontFamily: "'Courier New', monospace", fontSize: 10, color: "#6a6055"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: serverHealthMeta.ok ? "#14f195" : "#ff4d4d" }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: serverHealthMeta.ok ? "#14f195" : "#ff4d4d",
            boxShadow: serverHealthMeta.ok ? "0 0 6px #14f195" : "0 0 6px rgba(255,77,77,0.8)"
          }} />
          {serverHealthMeta.ok ? "CONNECTED" : "DISCONNECTED"}
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span style={{ color: serverHealth?.hasToken ? "#14f195" : "#ffaa22" }}>
          {serverHealth?.hasToken ? "TOKEN OK" : "NO TOKEN"}
        </span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{serverHealthMeta.ms != null ? `${serverHealthMeta.ms}ms` : "—"}</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.runtime === "thinking").length} thinking</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.runtime === "tool").length} tool</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => a.runtime === "error").length} error</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span>{agents.filter(a => !a.runtime || a.runtime === "idle").length} idle</span>
        <span style={{ color: "#3a3530" }}>·</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#c8a050" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></svg>
          quiet
        </span>
        {serverHealthMeta.ok ? null : (
          <>
            <span style={{ color: "#3a3530" }}>·</span>
            <span style={{ color: "#ffaa22" }}>
              {serverHealthMeta.error ? `server: ${serverHealthMeta.error}` : "server unreachable"}
            </span>
          </>
        )}
      </div>

      {/* BOTTOM RIGHT CHAT BUTTON */}
      <button onClick={() => { setChatPanelOpen(p => !p); setHqPanelOpen(false); }} style={{
        position: "fixed", bottom: chatPanelOpen ? 460 : 0, right: 0, zIndex: 110,
        background: chatPanelOpen ? "#c8a050" : "rgba(10,10,15,0.88)", backdropFilter: "blur(16px)",
        borderRadius: chatPanelOpen ? "10px 10px 0 0" : "16px 0 0 0",
        border: `1px solid ${chatPanelOpen ? "#c8a050" : "#2a2520"}`, borderBottom: "none", borderRight: "none",
        display: "flex", alignItems: "center", gap: 8, padding: "10px 24px",
        fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 600,
        color: chatPanelOpen ? "#0a0a0f" : "#c8a050", cursor: "pointer", letterSpacing: 1,
        transition: "all 0.3s ease"
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chatPanelOpen ? "#0a0a0f" : "#c8a050"} strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        CHAT
      </button>

      {/* CHAT PANEL */}
      <div style={{
        position: "fixed", bottom: chatPanelOpen ? 0 : -460, right: 0, zIndex: 105,
        width: 520, height: 460,
        background: "rgba(10,10,15,0.95)", backdropFilter: "blur(20px)",
        border: "1px solid #2a2520", borderBottom: "none", borderRight: "none",
        borderRadius: "16px 0 0 0",
        display: "flex", transition: "bottom 0.3s ease",
        fontFamily: "'Courier New', monospace"
      }}>
        {/* Agent list sidebar */}
        <div style={{
          width: 140, borderRight: "1px solid #2a2520", display: "flex", flexDirection: "column",
          padding: "14px 0", overflowY: "auto"
        }}>
          <div style={{ padding: "0 14px 10px", fontSize: 10, color: "#6a6055", fontWeight: 600, letterSpacing: 2 }}>
            AGENTS <span style={{ color: "#4a4540", marginLeft: 6 }}>{AGENTS.length}</span>
          </div>
          {agents.map(a => (
            <div key={a.id} onClick={() => setChatAgent(a.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              cursor: "pointer", transition: "all 0.15s",
              background: chatAgent === a.id ? "rgba(200,160,80,0.1)" : "transparent",
              borderLeft: chatAgent === a.id ? "2px solid #c8a050" : "2px solid transparent",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: (a.runtime === "error" ? "#ff4d4d" : a.runtime === "tool" ? "#9945ff" : a.runtime === "thinking" ? "#00d1ff" : "#6a6055"),
                flexShrink: 0
              }} />
              <span style={{ fontSize: 11, color: chatAgent === a.id ? "#e0e0e8" : "#6a6055" }}>{a.name}</span>
            </div>
          ))}
        </div>

        {/* Chat conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Chat header */}
          {(() => {
            const agent = AGENTS.find(a => a.id === chatAgent);
            return (
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid #2a2520",
                display: "flex", alignItems: "center", gap: 10
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: agent ? hexToCSS(agent.color) : "#555",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#0a0a0f", fontWeight: 700
                }}>{agent?.name?.[0]}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e8" }}>{agent?.name}</div>
                  <div style={{ fontSize: 9, color: "#6a6055" }}>{agent?.role}</div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setChatHistories(prev => ({ ...prev, [chatAgent]: [] }))} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: "#c8a050", color: "#0a0a0f", border: "none", cursor: "pointer",
                  fontFamily: "inherit", letterSpacing: 0.5
                }}>New session</button>
                <div
                  onClick={() => { setSettingsFocusAgent(chatAgent); setSettingsOpen(true); }}
                  title="Agent settings"
                  style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid #2a2520", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6a6055" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {(chatHistories[chatAgent] || []).length === 0 && (
              <div style={{ textAlign: "center", color: "#4a4540", fontSize: 10, padding: "40px 0" }}>
                Start a conversation with this agent
              </div>
            )}
            {(chatHistories[chatAgent] || []).map((m, i) => {
              const isYou = m.from === "You";
              const agent = AGENTS.find(a => a.id === chatAgent);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isYou ? "flex-end" : "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {!isYou && <span style={{ fontSize: 9, fontWeight: 600, color: agent ? hexToCSS(agent.color) : "#c8a050" }}>{m.from}</span>}
                    {isYou && <span style={{ fontSize: 9, fontWeight: 600, color: "#6a6055" }}>You</span>}
                    <span style={{ fontSize: 8, color: "#4a4540" }}>{m.time}</span>
                  </div>
                  <div style={{
                    padding: "8px 12px", maxWidth: "80%", fontSize: 11, lineHeight: 1.5,
                    borderRadius: isYou ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: isYou ? "rgba(200,160,80,0.15)" : "rgba(40,38,34,0.8)",
                    border: `1px solid ${isYou ? "#3a3520" : "#2a2520"}`,
                    color: "#d4d0c8"
                  }}>{m.text}</div>
                </div>
              );
            })}
            <div ref={chatMsgEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 16px 6px", borderTop: "1px solid #2a2520", display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendAgentChat()}
              placeholder="type a message"
              style={{
                flex: 1, background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 8,
                padding: "10px 14px", color: "#e0e0e8", fontFamily: "inherit", fontSize: 11, outline: "none"
              }} />
            <button onClick={sendAgentChat} style={{
              background: "#c8a050", color: "#0a0a0f", border: "none", borderRadius: 8,
              padding: "10px 18px", fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer"
            }}>Send</button>
          </div>
          {/* Model selector row */}
          <div style={{ padding: "4px 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <select value={chatModelByAgent?.[chatAgent] || ""} onChange={(e) => {
              const v = e.target.value;
              setChatModelByAgent(prev => ({ ...(prev || {}), [chatAgent]: v }));
            }} style={{
              background: "rgba(30,28,24,0.8)", border: "1px solid #2a2520", borderRadius: 6,
              padding: "5px 10px", color: "#c8a050", fontFamily: "inherit", fontSize: 10, outline: "none", cursor: "pointer"
            }}>
              <option value="">Auto (agent settings)</option>
              <option value="gpt-4.1-mini">GPT-4.1 mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-sonnet">Claude Sonnet</option>
              <option value="llama-3">Llama 3</option>
              <option value="deepseek">DeepSeek</option>
            </select>
            <span
              onClick={() => setChatShowToolsByAgent(prev => ({ ...(prev || {}), [chatAgent]: !prev?.[chatAgent] }))}
              style={{
                fontSize: 9,
                color: (chatShowToolsByAgent?.[chatAgent] ? "#c8a050" : "#4a4540"),
                cursor: "pointer",
                userSelect: "none"
              }}
              title="Toggle tool/terminal output"
            >
              Show
            </span>
            <span
              onClick={() => { setToolAgent(chatAgent); setToolsOpen(true); }}
              style={{ fontSize: 9, color: "#4a4540", cursor: "pointer", userSelect: "none" }}
              title="Open Tools console"
            >
              Tools
            </span>
          </div>

          {(chatShowToolsByAgent?.[chatAgent]) && (
            <div style={{
              padding: "10px 16px 12px",
              borderTop: "1px solid #2a2520",
              background: "rgba(10,10,15,0.6)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#6a6055", letterSpacing: 2 }}>TERMINAL</div>
                <div style={{ flex: 1 }} />
                <div onClick={() => { terminalLogsRef.current[chatAgent] = []; setTerminalTick(t => t + 1); }} style={{
                  fontSize: 9, color: "#4a4540", cursor: "pointer", border: "1px solid #2a2520",
                  padding: "4px 8px", borderRadius: 999, userSelect: "none"
                }}>CLEAR</div>
              </div>
              <div style={{
                maxHeight: 140,
                overflowY: "auto",
                borderRadius: 10,
                border: "1px solid #2a2520",
                background: "rgba(0,0,0,0.25)",
                padding: 10,
                fontFamily: "'Courier New', monospace",
                fontSize: 10,
                color: "#cfc9c2",
                whiteSpace: "pre-wrap",
                lineHeight: 1.4
              }}>
                {(terminalLogsRef.current?.[chatAgent] || []).slice(-80).map((l, i) => (
                  <div key={i} style={{ color: l.type === "warning" ? "#ffaa22" : l.type === "info" ? "#00d1ff" : "#cfc9c2" }}>
                    <span style={{ color: "#4a4540" }}>{l.ts} </span>{l.text}
                  </div>
                ))}
                {(terminalLogsRef.current?.[chatAgent] || []).length === 0 && (
                  <div style={{ color: "#4a4540" }}>No terminal output yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MINIMAP */}
      {mapOpen && (
        <div onClick={() => setMapOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 560, height: 420, background: "#0a0f0a", border: "2px solid rgba(200,160,80,0.25)",
            borderRadius: 16, overflow: "hidden", boxShadow: "0 0 40px rgba(200,160,80,0.1)",
            display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace"
          }}>
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, background: "rgba(200,160,80,0.08)", borderBottom: "1px solid rgba(200,160,80,0.2)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
              </svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e8" }}>FLOOR MAP</div>
                <div style={{ fontSize: 10, color: "#6a6055" }}>Live agent positions</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ padding: "4px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600, background: "rgba(20,241,149,0.15)", color: "#14f195", letterSpacing: 1 }}>LIVE</div>
              <div onClick={() => setMapOpen(false)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520" }}>×</div>
            </div>
            <div style={{ flex: 1, padding: 16, background: "#060a06" }}>
              <svg viewBox="-40 -12 95 80" width="100%" height="100%" style={{ borderRadius: 6 }}>
                {Array.from({length: 86}, (_, i) => i - 36).map(x => (<line key={`gx${x}`} x1={x} y1="-9" x2={x} y2="59" stroke="rgba(20,241,149,0.04)" strokeWidth="0.05"/>))}
                {Array.from({length: 69}, (_, i) => i - 9).map(z => (<line key={`gz${z}`} x1="-36" y1={z} x2="49" y2={z} stroke="rgba(20,241,149,0.04)" strokeWidth="0.05"/>))}
                {/* Outdoor park / ground */}
                <rect x={6-25} y={SPORTS_Z-12.5} width="50" height="25" fill="rgba(47,107,58,0.12)" stroke="rgba(47,107,58,0.4)" strokeWidth="0.08" rx="0.4"/>
                <text x={6} y={SPORTS_Z-12.8} fill="rgba(120,200,140,0.8)" fontSize="0.6" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PARK</text>
                <rect x="-9" y="-7" width="18" height="14" fill="rgba(20,241,149,0.03)" stroke="rgba(20,241,149,0.15)" strokeWidth="0.08"/>
                <rect x={LEFT_GYM_X-8} y={LEFT_GYM_Z-7} width="16" height="14" fill="rgba(255,120,120,0.03)" stroke="rgba(255,120,120,0.2)" strokeWidth="0.08"/>
                <rect x={SPORTS_X-6} y={SPORTS_Z-7} width="12" height="14" fill="rgba(200,160,80,0.03)" stroke="rgba(200,160,80,0.15)" strokeWidth="0.08"/>
                <rect x={BOTTOM_ROOM_X-6} y={BOTTOM_ROOM_Z-7} width="12" height="14" fill="rgba(100,210,255,0.03)" stroke="rgba(100,210,255,0.16)" strokeWidth="0.08"/>
                <rect x={LEFT_GYM_X-4.2} y={LEFT_GYM_Z+3.7} width="6.8" height="1.2" fill="rgba(255,120,120,0.12)" stroke="rgba(255,120,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X-0.8} y={LEFT_GYM_Z+4.45} fill="rgba(255,150,150,0.9)" fontSize="0.5" textAnchor="middle" opacity="0.9">CARDIO</text>
                <rect x={LEFT_GYM_X+4.4} y={LEFT_GYM_Z+0.8} width="1.6" height="1" fill="rgba(255,200,120,0.14)" stroke="rgba(255,200,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X+5.2} y={LEFT_GYM_Z+1.6} fill="rgba(255,200,120,0.9)" fontSize="0.42" textAnchor="middle" opacity="0.9">CHEST</text>
                <rect x={LEFT_GYM_X-1.8} y={LEFT_GYM_Z-2.0} width="4.2" height="1.8" fill="rgba(255,180,120,0.14)" stroke="rgba(255,180,120,0.35)" strokeWidth="0.06" rx="0.08"/>
                <text x={LEFT_GYM_X+0.3} y={LEFT_GYM_Z-0.75} fill="rgba(255,180,120,0.9)" fontSize="0.45" textAnchor="middle" opacity="0.9">RACK/BENCH</text>
                <circle cx={LEFT_GYM_X+2.2} cy={LEFT_GYM_Z-3.9} r="1" fill="rgba(255,107,107,0.14)" stroke="rgba(255,107,107,0.35)" strokeWidth="0.06"/>
                <text x={LEFT_GYM_X+2.2} y={LEFT_GYM_Z-2.8} fill="rgba(255,130,130,0.9)" fontSize="0.42" textAnchor="middle" opacity="0.9">TRAMP</text>
                {[[-6,-5],[-3,-5],[0,-5],[-6,-2],[-3,-2],[0,-2]].map(([x,z],i) => (<rect key={`d${i}`} x={x-0.6} y={z-0.35} width="1.2" height="0.7" fill="rgba(20,241,149,0.1)" stroke="rgba(20,241,149,0.25)" strokeWidth="0.04" rx="0.05"/>))}
                <circle cx="-5" cy="4" r="1.5" fill="rgba(20,241,149,0.06)" stroke="rgba(20,241,149,0.2)" strokeWidth="0.04"/>
                <rect x="3.8" y="2.6" width="2.4" height="0.8" fill="rgba(153,69,255,0.15)" stroke="rgba(153,69,255,0.3)" strokeWidth="0.04" rx="0.1"/>
                <rect x="3.8" y="5.1" width="2.4" height="0.8" fill="rgba(153,69,255,0.15)" stroke="rgba(153,69,255,0.3)" strokeWidth="0.04" rx="0.1"/>
                <rect x={SPORTS_X-1.3} y={SPORTS_Z-3.7} width="2.6" height="1.4" fill="rgba(10,92,42,0.4)" stroke="rgba(20,241,149,0.3)" strokeWidth="0.06" rx="0.1"/>
                <text x={SPORTS_X} y={SPORTS_Z-2.8} fill="#14f195" fontSize="0.5" textAnchor="middle" opacity="0.6">POOL</text>
                <rect x={SPORTS_X-1.1} y={SPORTS_Z+2.4} width="2.2" height="1.2" fill="rgba(26,85,51,0.4)" stroke="rgba(20,241,149,0.3)" strokeWidth="0.06" rx="0.05"/>
                <text x={SPORTS_X} y={SPORTS_Z+3.2} fill="#14f195" fontSize="0.5" textAnchor="middle" opacity="0.6">PONG</text>
                <rect x={BOTTOM_ROOM_X-2.8} y={BOTTOM_ROOM_Z+5.1} width="5.6" height="1.1" fill="rgba(100,210,255,0.18)" stroke="rgba(100,210,255,0.35)" strokeWidth="0.06" rx="0.1"/>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z+5.8} fill="rgba(100,210,255,0.8)" fontSize="0.5" textAnchor="middle" opacity="0.9">COUNTER</text>
                <circle cx={BOTTOM_ROOM_X-2.1} cy={BOTTOM_ROOM_Z+1.3} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <circle cx={BOTTOM_ROOM_X+2.1} cy={BOTTOM_ROOM_Z+1.3} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <circle cx={BOTTOM_ROOM_X} cy={BOTTOM_ROOM_Z-2.2} r="0.9" fill="rgba(190,150,90,0.18)" stroke="rgba(190,150,90,0.35)" strokeWidth="0.06"/>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z-1.1} fill="rgba(190,150,90,0.8)" fontSize="0.5" textAnchor="middle" opacity="0.8">SEATING</text>
                <rect x={BOTTOM_ROOM_X-5.6} y={BOTTOM_ROOM_Z+4.2} width="1" height="0.8" fill="rgba(124,199,255,0.2)" stroke="rgba(124,199,255,0.45)" strokeWidth="0.06" rx="0.05"/>
                <text x={BOTTOM_ROOM_X-5.1} y={BOTTOM_ROOM_Z+5.35} fill="rgba(124,199,255,0.85)" fontSize="0.45" textAnchor="middle" opacity="0.9">FRIDGE</text>
                <rect x="7.9" y="-6.3" width="0.6" height="2.6" fill="rgba(20,241,149,0.08)" stroke="rgba(20,241,149,0.2)" strokeWidth="0.04"/>
                <text x="0" y="-7.8" fill="rgba(20,241,149,0.5)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">MAIN OFFICE</text>
                <text x={LEFT_GYM_X} y={LEFT_GYM_Z-7.8} fill="rgba(255,120,120,0.7)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">FITNESS GYM</text>
                <text x={SPORTS_X} y={SPORTS_Z-7.8} fill="rgba(200,160,80,0.5)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">SPORTS ROOM</text>
                <text x={BOTTOM_ROOM_X} y={BOTTOM_ROOM_Z-7.8} fill="rgba(100,210,255,0.7)" fontSize="0.7" fontWeight="bold" textAnchor="middle" fontFamily="monospace">CAFETERIA</text>
                {AGENTS.map(a => {
                  const mesh = agentMeshesRef.current[a.id];
                  if (!mesh) return null;
                  const r = (a.color >> 16) & 0xff, g = (a.color >> 8) & 0xff, b = a.color & 0xff;
                  return (<g key={a.id}><circle cx={mesh.position.x} cy={mesh.position.z} r="0.6" fill={`rgb(${r},${g},${b})`} opacity="0.12"/><circle cx={mesh.position.x} cy={mesh.position.z} r="0.3" fill={`rgb(${r},${g},${b})`} opacity="0.9"/><text x={mesh.position.x} y={mesh.position.z + 0.9} fill="#e0e0e8" fontSize="0.5" textAnchor="middle" fontFamily="monospace">{a.name}</text></g>);
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* MONITOR MODAL */}
      {monitorModal && (() => {
        const agent = AGENTS.find(a => a.id === monitorModal);
        if (!agent) return null;
        return (
          <div onClick={() => setMonitorModal(null)} style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: 560, height: 420, background: "#0a0f0a",
              border: `2px solid ${hexToCSS(agent.color)}40`,
              borderRadius: 16, overflow: "hidden", boxShadow: `0 0 40px ${hexToCSS(agent.color)}20`,
              display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace"
            }}>
              {/* Modal header */}
              <div style={{
                padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
                background: `${hexToCSS(agent.color)}15`, borderBottom: `1px solid ${hexToCSS(agent.color)}30`
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: hexToCSS(agent.color),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "#0a0a0f"
                }}>{agent.name[0]}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e0e8" }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: "#6a6055" }}>{agent.role}</div>
                </div>
                <div style={{ flex: 1 }} />
                {(() => {
                  const target = agentTargetsRef.current[monitorModal];
                  const isAtDesk = target && target.sitting;
                  return (
                    <div style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                      background: isAtDesk ? "rgba(20,241,149,0.15)" : "rgba(255,170,34,0.15)",
                      color: isAtDesk ? "#14f195" : "#ffaa22",
                      letterSpacing: 1
                    }}>{isAtDesk ? "RUNNING" : "IDLE"}</div>
                  );
                })()}
                <div onClick={() => setMonitorModal(null)} style={{
                  width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
                }}>×</div>
              </div>

              {/* Live terminal */}
              <MonitorTerminal
                agentId={monitorModal}
                agent={agent}
                terminalLines={terminalLogsRef.current[monitorModal] || []}
                terminalTick={terminalTick}
                agentTargets={agentTargetsRef}
                buffsRef={buffsRef}
                buffsTick={buffsTick}
              />
            </div>
          </div>
        );
      })()}

      {/* DOCS MODAL */}
      {docsOpen && (
        <div onClick={() => setDocsOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 220,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 640, maxWidth: "calc(100vw - 40px)", height: 520, maxHeight: "calc(100vh - 60px)",
            background: "rgba(10,10,15,0.95)",
            border: "2px solid rgba(200,160,80,0.25)",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 0 40px rgba(200,160,80,0.12)",
            display: "flex", flexDirection: "column"
          }}>
            <div style={{
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
              background: "rgba(200,160,80,0.08)", borderBottom: "1px solid rgba(200,160,80,0.2)"
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(200,160,80,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
                  <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"/>
                  <path d="M20 2H6.5A2.5 2.5 0 0 0 4 4.5v15"/>
                  <path d="M8 6h8"/><path d="M8 10h8"/><path d="M8 14h6"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e0e8", letterSpacing: 0.4 }}>Agent Guide</div>
                <div style={{ fontSize: 11, color: "#6a6055", marginTop: 2, fontFamily: "'Courier New', monospace" }}>
                  What changed, how to use agents, and how to connect OpenClaw correctly.
                </div>
              </div>
              <div onClick={() => setDocsOpen(false)} style={{
                width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
              }}>×</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 8 }}>What changed recently</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                    - Expanded HQ dashboard: Inbox, History, Playbooks, Observe.<br />
                    - New operator surfaces: Tools, Settings, Tasks & Notes modals.<br />
                    - Local API now persists events, inbox, playbooks, and agent mappings.<br />
                    - Chat, streaming chat, and tool calls are routed through local API to OpenClaw.
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 8 }}>Chatting with agents</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                    - Open the chat panel, pick an agent, and type a message.<br />
                    - Normal messages go to the AI (OpenClaw) and stream back live.<br />
                    - Replies also appear in the desk terminal output when the agent is at their desk.
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 8 }}>Movement & activities</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                    These commands trigger in-world animations (local behaviors):<br />
                    - <b>go to desk</b>, <b>work</b><br />
                    - <b>relax</b>, <b>sofa</b><br />
                    - <b>cafeteria</b>, <b>coffee</b><br />
                    - <b>gym</b> or equipment terms (<b>treadmill</b>, <b>bike</b>, <b>bench</b>, <b>dumbbell</b>, etc.)<br />
                    - <b>play ping pong</b>, <b>play pool</b><br />
                    - <b>stand up</b>, <b>stop</b>
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 8 }}>Terminals & monitors</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                    - Desk screens show recent terminal lines when the agent is seated.<br />
                    - Click a desk monitor to open the full terminal modal.<br />
                    - If an agent is away from their desk, the terminal is idle.
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 8 }}>OpenClaw connection (required)</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                    Frontend talks to local API (<b>/api</b>), local API talks to OpenClaw gateway.<br />
                    - Start OpenClaw gateway (default base URL: <b>http://127.0.0.1:18789</b>)<br />
                    - In server terminal set:<br />
                    &nbsp;&nbsp;<b>$env:OPENCLAW_GATEWAY_TOKEN="..."</b><br />
                    &nbsp;&nbsp;<b>$env:OPENCLAW_BASE_URL="http://127.0.0.1:18789"</b><br />
                    - Run <b>npm run server</b> (port 8787)<br />
                    - Run <b>npm run dev</b> (frontend on port 3000)<br />
                    - Check <b>/api/health</b>: hasToken must be true
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(10,10,15,0.6)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e8", marginBottom: 8 }}>Tips</div>
                <div style={{ fontSize: 11, lineHeight: 1.7, color: "#b9b2aa", fontFamily: "'Courier New', monospace" }}>
                  - If you see a “missing token” error, the server isn’t configured with <b>OPENCLAW_GATEWAY_TOKEN</b>.<br />
                  - You can map each MyClaw3D agent to a different OpenClaw agent id from <b>Settings</b>.<br />
                  - Use the map icon to open the floor map overlay.
                </div>
              </div>

              <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 6 }}>Where did Tools go?</div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cfc9c2", fontFamily: "'Courier New', monospace" }}>
                  Skills & Tool Console now live in the dedicated <b>Tools</b> modal (wrench icon in the top-right).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOOLS MODAL */}
      {toolsOpen && (
        <div onClick={() => setToolsOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 220,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 680, maxWidth: "calc(100vw - 40px)", height: 560, maxHeight: "calc(100vh - 60px)",
            background: "rgba(10,10,15,0.95)",
            border: "2px solid rgba(200,160,80,0.25)",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 0 40px rgba(200,160,80,0.12)",
            display: "flex", flexDirection: "column"
          }}>
            <div style={{
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
              background: "rgba(200,160,80,0.08)", borderBottom: "1px solid rgba(200,160,80,0.2)"
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(200,160,80,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
                  <path d="M14.7 6.3a4 4 0 0 0-5.66 5.66l-5.2 5.2a2 2 0 0 0 2.83 2.83l5.2-5.2a4 4 0 0 0 5.66-5.66l-2.12 2.12-2.12-2.12 2.12-2.12Z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e0e8", letterSpacing: 0.4 }}>Tools</div>
                <div style={{ fontSize: 11, color: "#6a6055", marginTop: 2, fontFamily: "'Courier New', monospace" }}>
                  Role-aware quick skills + direct OpenClaw tool invocation.
                </div>
              </div>
              <div onClick={() => setToolsOpen(false)} style={{
                width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
              }}>×</div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
              <div style={{ padding: 14, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 4 }}>Skills & Tool Console (OpenClaw)</div>
                <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
                  Quick skills are role-aware presets; advanced users can still call raw tools below.
                </div>

                {/* Role-based quick skills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  <button
                    disabled={toolBusy}
                    onClick={() => {
                      setToolName("sessions_list");
                      setToolAction("json");
                      setToolArgsText(JSON.stringify({ filter: "market", limit: 20 }, null, 2));
                      invokeTool();
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.9)",
                      color: "#14f195",
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      cursor: toolBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Scan market
                  </button>

                  <button
                    disabled={toolBusy}
                    onClick={async () => {
                      const a = AGENTS.find(x => x.id === toolAgent);
                      const msg = "Summarize the latest market news in bullet points.";
                      appendTerminal(toolAgent, `SKILL> Summarize news`, "info");
                      try {
                        const r = await fetch("/api/chat/stream", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            agentId: toolAgent,
                            agentName: a?.name,
                            agentRole: a?.role,
                            intent: "summarize_news",
                            message: msg,
                            history: [],
                          }),
                        });
                        if (!r.ok || !r.body) {
                          appendTerminal(toolAgent, `Summarize failed (${r.status})`, "warning");
                          return;
                        }
                        const reader = r.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = "", acc = "", lastFlush = 0;
                        const flush = (force = false) => {
                          const delta = acc.slice(lastFlush);
                          if (!delta) return;
                          if (!force && delta.length < 60 && !delta.includes("\n")) return;
                          lastFlush = acc.length;
                          appendTerminal(toolAgent, delta.replace(/\s+/g, " ").trim(), "output");
                        };
                        while (true) {
                          const { value, done } = await reader.read();
                          if (done) break;
                          buf += decoder.decode(value, { stream: true });
                          let idx;
                          while ((idx = buf.indexOf("\n\n")) !== -1) {
                            const frame = buf.slice(0, idx);
                            buf = buf.slice(idx + 2);
                            const lines = frame.split("\n").map(l => l.trimEnd());
                            for (const line of lines) {
                              if (!line.startsWith("data:")) continue;
                              const data = line.slice(5).trim();
                              if (!data || data === "[DONE]") continue;
                              let parsed;
                              try { parsed = JSON.parse(data); } catch { parsed = null; }
                              const delta = parsed?.choices?.[0]?.delta?.content;
                              if (typeof delta === "string" && delta.length) {
                                acc += delta;
                                flush(false);
                              }
                            }
                          }
                        }
                        flush(true);
                      } catch (e) {
                        appendTerminal(toolAgent, `Summarize error: ${e?.message || String(e)}`, "warning");
                      }
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.9)",
                      color: "#00d1ff",
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      cursor: toolBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Summarize news
                  </button>

                  <button
                    disabled={toolBusy}
                    onClick={() => {
                      setToolName("wallet_inspect");
                      setToolAction("");
                      setToolArgsText(JSON.stringify({ address: "YOUR_WALLET_HERE" }, null, 2));
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.9)",
                      color: "#ffaa22",
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      cursor: toolBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Check wallet (configure)
                  </button>

                  <button
                    disabled={toolBusy}
                    onClick={() => {
                      setToolName("strategy_backtest");
                      setToolAction("run");
                      setToolArgsText(JSON.stringify({ symbol: "SOL/USDC", windowDays: 7 }, null, 2));
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.9)",
                      color: "#ff6b6b",
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      cursor: toolBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Run backtest (preset)
                  </button>

                  <button
                    disabled={toolBusy}
                    onClick={async () => {
                      const a = AGENTS.find(x => x.id === toolAgent);
                      const msg = "Draft a short markdown report summarizing today’s activity and key opportunities.";
                      appendTerminal(toolAgent, `SKILL> Draft report`, "info");
                      try {
                        const r = await fetch("/api/chat/stream", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            agentId: toolAgent,
                            agentName: a?.name,
                            agentRole: a?.role,
                            intent: "draft_report",
                            message: msg,
                            history: [],
                          }),
                        });
                        if (!r.ok || !r.body) {
                          appendTerminal(toolAgent, `Report failed (${r.status})`, "warning");
                          return;
                        }
                        const reader = r.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = "", acc = "", lastFlush = 0;
                        const flush = (force = false) => {
                          const delta = acc.slice(lastFlush);
                          if (!delta) return;
                          if (!force && delta.length < 80 && !delta.includes("\n")) return;
                          lastFlush = acc.length;
                          appendTerminal(toolAgent, delta.replace(/\s+/g, " ").trim(), "output");
                        };
                        while (true) {
                          const { value, done } = await reader.read();
                          if (done) break;
                          buf += decoder.decode(value, { stream: true });
                          let idx;
                          while ((idx = buf.indexOf("\n\n")) !== -1) {
                            const frame = buf.slice(0, idx);
                            buf = buf.slice(idx + 2);
                            const lines = frame.split("\n").map(l => l.trimEnd());
                            for (const line of lines) {
                              if (!line.startsWith("data:")) continue;
                              const data = line.slice(5).trim();
                              if (!data || data === "[DONE]") continue;
                              let parsed;
                              try { parsed = JSON.parse(data); } catch { parsed = null; }
                              const delta = parsed?.choices?.[0]?.delta?.content;
                              if (typeof delta === "string" && delta.length) {
                                acc += delta;
                                flush(false);
                              }
                            }
                          }
                        }
                        flush(true);
                      } catch (e) {
                        appendTerminal(toolAgent, `Report error: ${e?.message || String(e)}`, "warning");
                      }
                    }}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: "1px solid #2a2520",
                      background: "rgba(10,10,15,0.9)",
                      color: "#e0e0e8",
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      cursor: toolBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Draft report
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" }}>
                  <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>Agent</div>
                  <select value={toolAgent} onChange={(e) => setToolAgent(e.target.value)} style={{
                    width: "100%", padding: "8px 10px", borderRadius: 10,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                  }}>
                    {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                  </select>

                  <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>Tool name</div>
                  <input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="e.g. sessions_list" style={{
                    width: "100%", padding: "8px 10px", borderRadius: 10,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                  }} />

                  <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>Action</div>
                  <input value={toolAction} onChange={(e) => setToolAction(e.target.value)} placeholder="optional (e.g. json)" style={{
                    width: "100%", padding: "8px 10px", borderRadius: 10,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                  }} />

                  <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace", alignSelf: "start", paddingTop: 6 }}>Args (JSON)</div>
                  <textarea value={toolArgsText} onChange={(e) => setToolArgsText(e.target.value)} rows={5} style={{
                    width: "100%", padding: "10px 10px", borderRadius: 12,
                    background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                    border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12,
                    resize: "vertical"
                  }} />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
                  <button disabled={toolBusy} onClick={invokeTool} style={{
                    padding: "10px 12px", borderRadius: 12,
                    background: toolBusy ? "rgba(200,160,80,0.25)" : "#c8a050",
                    color: "#0a0a0f", border: "none", cursor: toolBusy ? "not-allowed" : "pointer",
                    fontWeight: 800, letterSpacing: 0.6
                  }}>
                    {toolBusy ? "Invoking…" : "Invoke tool"}
                  </button>
                  <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace", lineHeight: 1.5 }}>
                    This calls OpenClaw `POST /tools/invoke` and prints results into the agent’s terminal.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 220,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 760, maxWidth: "calc(100vw - 40px)", height: 560, maxHeight: "calc(100vh - 60px)",
            background: "rgba(10,10,15,0.95)",
            border: "2px solid rgba(200,160,80,0.25)",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 0 40px rgba(200,160,80,0.12)",
            display: "flex", flexDirection: "column"
          }}>
            <div style={{
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
              background: "rgba(200,160,80,0.08)", borderBottom: "1px solid rgba(200,160,80,0.2)"
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(200,160,80,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4.7a7.2 7.2 0 0 0-1.7-1l-.4-2.5H10l-.4 2.5a7.2 7.2 0 0 0-1.7 1l-2.4-.7-2 3.5 2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.7a7.2 7.2 0 0 0 1.7 1l.4 2.5h4.1l.4-2.5a7.2 7.2 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5Z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e0e8", letterSpacing: 0.4 }}>Settings</div>
                <div style={{ fontSize: 11, color: "#6a6055", marginTop: 2, fontFamily: "'Courier New', monospace" }}>
                  Map MyClaw3D agents to OpenClaw agent IDs + choose model per agent.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10, color: serverHealth?.hasToken ? "#14f195" : "#ffaa22", fontFamily: "'Courier New', monospace" }}>
                  {serverHealth?.hasToken ? "CONNECTED" : "NO TOKEN"}
                </div>
                <button onClick={() => { refreshAgentSettings(); refreshHealth(); }} style={{
                  padding: "6px 10px", borderRadius: 10, fontSize: 10, fontWeight: 800,
                  background: "transparent", color: "#00d1ff", border: "1px solid #2a2520",
                  cursor: "pointer", fontFamily: "'Courier New', monospace"
                }}>Refresh</button>
                <button onClick={async () => {
                  try {
                    const r = await fetch("/api/agent-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(agentSettings || {}) });
                    const json = await r.json().catch(() => null);
                    if (r.ok && json?.ok) {
                      setAgentSettings(json.settings || {});
                      setActivityLog(prev => [{ time: timeStr(), hl: "MYCLAW3D", text: "settings saved" }, ...prev].slice(0, 50));
                    }
                  } catch { /* ignore */ }
                }} style={{
                  padding: "6px 10px", borderRadius: 10, fontSize: 10, fontWeight: 900,
                  background: "#c8a050", color: "#0a0a0f", border: "none",
                  cursor: "pointer", fontFamily: "'Courier New', monospace"
                }}>Save</button>
                <div onClick={() => setSettingsOpen(false)} style={{
                  width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
                }}>×</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <div style={{ padding: 12, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(30,28,24,0.6)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#c8a050", marginBottom: 10 }}>Agent ↔ OpenClaw 1:1 mapping</div>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 90px 120px", gap: 8, alignItems: "center", fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
                  <div>MyClaw3D agent</div>
                  <div>OpenClaw agent ID</div>
                  <div>Model</div>
                  <div>Test</div>
                  <div style={{ textAlign: "right" }}>Status</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {AGENTS.map(a => {
                    const s = agentSettings?.[a.id] || {};
                    const connected = Boolean(serverHealth?.hasToken);
                    const t = agentTest?.[a.id] || {};
                    return (
                      <div
                        key={a.id}
                        ref={(el) => { if (el) settingsAgentRowRef.current[a.id] = el; }}
                        style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 90px 120px", gap: 8, alignItems: "center" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 999, background: hexToCSS(a.color) }} />
                          <div style={{ fontSize: 11, fontWeight: 900, color: "#e0e0e8", fontFamily: "'Courier New', monospace" }}>{a.name}</div>
                        </div>
                        <input value={s.openclawAgentId || ""} onChange={(e) => {
                          const v = e.target.value;
                          setAgentSettings(prev => ({ ...(prev || {}), [a.id]: { ...(prev?.[a.id] || {}), openclawAgentId: v } }));
                        }} placeholder="e.g. main / alpha-workspace / trader-01" style={{
                          width: "100%", padding: "8px 10px", borderRadius: 10,
                          background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                          border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                        }} />
                        <input value={s.model || ""} onChange={(e) => {
                          const v = e.target.value;
                          setAgentSettings(prev => ({ ...(prev || {}), [a.id]: { ...(prev?.[a.id] || {}), model: v } }));
                        }} placeholder="openclaw (default) / other model id" style={{
                          width: "100%", padding: "8px 10px", borderRadius: 10,
                          background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                          border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                        }} />
                        <button disabled={!connected || t.busy} onClick={async () => {
                          setAgentTest(prev => ({ ...(prev || {}), [a.id]: { busy: true, ok: null, ms: null, msg: "" } }));
                          try {
                            const r = await fetch("/api/agent-settings/test", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                agentId: a.id,
                                openclawAgentId: (s.openclawAgentId || "").trim() || undefined,
                                model: (s.model || "").trim() || undefined,
                              }),
                            });
                            const json = await r.json().catch(() => null);
                            if (!r.ok || !json?.ok) {
                              const m = json?.error?.message || json?.error?.type || `HTTP ${r.status}`;
                              setAgentTest(prev => ({ ...(prev || {}), [a.id]: { busy: false, ok: false, ms: json?.ms || null, msg: m } }));
                            } else {
                              setAgentTest(prev => ({ ...(prev || {}), [a.id]: { busy: false, ok: true, ms: json.ms, msg: (json.text || "").trim().slice(0, 60) } }));
                            }
                          } catch (e) {
                            setAgentTest(prev => ({ ...(prev || {}), [a.id]: { busy: false, ok: false, ms: null, msg: e?.message || String(e) } }));
                          }
                        }} style={{
                          width: "100%",
                          padding: "8px 10px", borderRadius: 10,
                          background: (!connected || t.busy) ? "rgba(58,53,48,0.35)" : "rgba(10,10,15,0.9)",
                          color: connected ? "#00d1ff" : "#4a4540",
                          border: "1px solid #2a2520",
                          cursor: (!connected || t.busy) ? "not-allowed" : "pointer",
                          fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900
                        }}>
                          {t.busy ? "…" : "Test"}
                        </button>
                        <div style={{ textAlign: "right", fontSize: 10, fontFamily: "'Courier New', monospace", color: connected ? "#14f195" : "#ffaa22" }}>
                          {connected ? (
                            t.ok == null ? "server ok" : t.ok ? `OK ${t.ms}ms` : `ERR${t.ms ? ` ${t.ms}ms` : ""}`
                          ) : "token missing"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.keys(agentTest || {}).some(k => agentTest[k]?.msg) && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid #2a2520", background: "rgba(10,10,15,0.55)" }}>
                    <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace", marginBottom: 6 }}>Latest test output</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {AGENTS.map(a => {
                        const t = agentTest?.[a.id];
                        if (!t?.msg) return null;
                        return (
                          <div key={a.id} style={{ fontSize: 10, color: t.ok ? "#14f195" : "#ffaa22", fontFamily: "'Courier New', monospace" }}>
                            {a.name}: {t.msg}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 10, color: "#4a4540", fontFamily: "'Courier New', monospace", lineHeight: 1.5 }}>
                  Tip: Leave fields blank to use server defaults. These settings are stored on the local server in <b>server/.data/agent-settings.json</b>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASKS & NOTES MODAL */}
      {tasksOpen && (
        <div onClick={() => setTasksOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 220,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 700, maxWidth: "calc(100vw - 40px)", height: 520, maxHeight: "calc(100vh - 60px)",
            background: "rgba(10,10,15,0.95)",
            border: "2px solid rgba(20,241,149,0.25)",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 0 40px rgba(20,241,149,0.12)",
            display: "flex", flexDirection: "column"
          }}>
            <div style={{
              padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
              background: "rgba(20,241,149,0.08)", borderBottom: "1px solid rgba(20,241,149,0.2)"
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(20,241,149,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14f195" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e0e8", letterSpacing: 0.4 }}>Tasks & Notes</div>
                <div style={{ fontSize: 11, color: "#6a6055", marginTop: 2, fontFamily: "'Courier New', monospace" }}>
                  Run tasks, stream logs, and capture artifacts into the File Cabinet.
                </div>
              </div>
              <div onClick={() => setTasksOpen(false)} style={{
                width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, cursor: "pointer", color: "#6a6055", fontSize: 18, border: "1px solid #2a2520"
              }}>×</div>
            </div>

            <div style={{ flex: 1, padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1.2fr)", gap: 12 }}>
              {/* Left: tasks */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(10,10,15,0.75)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e8" }}>New task</div>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>
                      {tasks.filter(t => t.status === "running").length} running
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr auto", gap: 8, alignItems: "center" }}>
                    <select value={taskAgent} onChange={(e) => setTaskAgent(e.target.value)} style={{
                      width: "100%", padding: "8px 10px", borderRadius: 10,
                      background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                      border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                    }}>
                      <option value="">Random agent</option>
                      {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                    </select>
                    <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="Describe a task…" style={{
                      width: "100%", padding: "8px 10px", borderRadius: 10,
                      background: "rgba(10,10,15,0.9)", color: "#e0e0e8",
                      border: "1px solid #2a2520", outline: "none", fontFamily: "'Courier New', monospace", fontSize: 12
                    }} />
                    <button onClick={assignTask} style={{
                      padding: "9px 12px", borderRadius: 12,
                      background: "#14f195", color: "#0a0a0f", border: "none",
                      cursor: "pointer", fontWeight: 900
                    }}>Run</button>
                  </div>
                </div>

                <div style={{ flex: 1, padding: 12, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(10,10,15,0.75)", minHeight: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e8", marginBottom: 6 }}>Recent tasks</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "100%", overflowY: "auto" }}>
                    {tasks.length === 0 && (
                      <div style={{ fontSize: 11, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>
                        No tasks yet. Create one above to get started.
                      </div>
                    )}
                    {tasks.slice(0, 10).map((t) => (
                      <div key={t.id} style={{
                        padding: 10, borderRadius: 12,
                        border: "1px solid #2a2520",
                        background: "rgba(30,28,24,0.55)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#e0e0e8" }}>{t.agent}</div>
                          <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: 1,
                            color:
                              t.status === "running" ? "#14f195" :
                              t.status === "done" ? "#00d1ff" :
                              t.status === "failed" ? "#ff6b6b" :
                              t.status === "cancelled" ? "#ffaa22" : "#6a6055"
                          }}>
                            {String(t.status || "").toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }} />
                          {t.status === "running" && (
                            <button onClick={() => cancelTask(t.id)} style={{
                              padding: "6px 10px", borderRadius: 999,
                              border: "1px solid #3a3530",
                              background: "rgba(10,10,15,0.9)", color: "#ffaa22",
                              cursor: "pointer", fontSize: 10, fontFamily: "'Courier New', monospace"
                            }}>Cancel</button>
                          )}
                          {(t.status === "failed" || t.status === "cancelled") && (
                            <button onClick={() => runTask({ agentId: t.agentId, desc: t.desc, retryOf: t.id })} style={{
                              padding: "6px 10px", borderRadius: 999,
                              border: "1px solid #3a3530",
                              background: "rgba(10,10,15,0.9)", color: "#14f195",
                              cursor: "pointer", fontSize: 10, fontFamily: "'Courier New', monospace"
                            }}>Retry</button>
                          )}
                          {t.status === "done" && (
                            <>
                              <button onClick={() => promoteTaskToReport(t)} style={{
                                padding: "6px 10px", borderRadius: 999,
                                border: "1px solid #3a3530",
                                background: "rgba(10,10,15,0.9)", color: "#c8a050",
                                cursor: "pointer", fontSize: 10, fontFamily: "'Courier New', monospace", marginRight: 4
                              }}>Promote</button>
                              <button onClick={() => saveArtifactFromTask(t)} style={{
                                padding: "6px 10px", borderRadius: 999,
                                border: "1px solid #3a3530",
                                background: "rgba(10,10,15,0.9)", color: "#b9b2aa",
                                cursor: "pointer", fontSize: 10, fontFamily: "'Courier New', monospace"
                              }}>Save note</button>
                            </>
                          )}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 11, color: "#cfc9c2", lineHeight: 1.5, fontFamily: "'Courier New', monospace" }}>
                          {t.desc}
                        </div>
                        {(t.log?.length > 0) && (
                          <pre style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid #2a2520",
                            background: "rgba(6,10,6,0.7)",
                            color: "#14f195",
                            fontSize: 11,
                            overflowX: "auto",
                            whiteSpace: "pre-wrap"
                          }}>
                            {t.log.slice(-3).join("\n")}
                          </pre>
                        )}
                        {t.status === "done" && t.result && (
                          <div style={{ marginTop: 8, fontSize: 10, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>
                            Result stored. Use Promote to save a report.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: reports + file cabinet */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(10,10,15,0.75)", minHeight: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e8", marginBottom: 8 }}>Reports</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto" }}>
                    {reports.length === 0 && (
                      <div style={{ fontSize: 11, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>
                        No reports yet. Promote a completed task to create one.
                      </div>
                    )}
                    {reports.slice(0, 5).map(r => (
                      <div key={r.id} style={{ padding: 10, borderRadius: 12, border: "1px solid #2a2520", background: "rgba(30,28,24,0.55)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#c8a050", flex: 1 }}>{r.title}</div>
                          <button onClick={() => saveArtifactFromReport(r)} style={{
                            padding: "4px 8px", borderRadius: 999,
                            border: "1px solid #3a3530",
                            background: "rgba(10,10,15,0.9)", color: "#b9b2aa",
                            cursor: "pointer", fontSize: 9, fontFamily: "'Courier New', monospace"
                          }}>Save note</button>
                        </div>
                        <pre style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#cfc9c2", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                          {r.md.slice(0, 420)}{r.md.length > 420 ? "\n…" : ""}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ flex: 1, padding: 12, borderRadius: 14, border: "1px solid #2a2520", background: "rgba(10,10,15,0.75)", minHeight: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e8", marginBottom: 8 }}>File Cabinet (Notes)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "100%", overflowY: "auto" }}>
                    {artifacts.length === 0 && (
                      <div style={{ fontSize: 11, color: "#6a6055", fontFamily: "'Courier New', monospace" }}>
                        No notes yet. Save from a task or report.
                      </div>
                    )}
                    {artifacts.slice(0, 8).map(a => (
                      <div key={a.id} style={{ padding: 10, borderRadius: 12, border: "1px solid #2a2520", background: "rgba(30,28,24,0.55)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#c8a050", flex: 1 }}>{a.title}</div>
                          <button onClick={() => pushArtifactToMemory(a)} style={{
                            padding: "4px 8px", borderRadius: 999,
                            border: "1px solid #3a3530",
                            background: a.pushed ? "rgba(20,241,149,0.18)" : "rgba(10,10,15,0.9)",
                            color: a.pushed ? "#14f195" : "#b9b2aa",
                            cursor: "pointer", fontSize: 9, fontFamily: "'Courier New', monospace"
                          }}>{a.pushed ? "Pushed" : "Push to memory"}</button>
                        </div>
                        <pre style={{ whiteSpace: "pre-wrap", color: "#cfc9c2", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                          {a.content.slice(0, 360)}{a.content.length > 360 ? "\n…" : ""}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Live terminal component for monitor modal
function MonitorTerminal({ agentId, agent, terminalLines, terminalTick, agentTargets, buffsRef, buffsTick }) {
  const bottomRef = useRef(null);
  const [isAtDesk, setIsAtDesk] = useState(false);

  // Check sitting state every 500ms
  useEffect(() => {
    const check = setInterval(() => {
      const target = agentTargets?.current?.[agentId];
      setIsAtDesk(target?.sitting || false);
    }, 500);
    return () => clearInterval(check);
  }, [agentId, agentTargets]);

  const bootLines = [
    { text: `[${agent.name.toUpperCase()}] Terminal initialized`, type: "system" },
    { text: `Connected to solana-mainnet-beta`, type: "system" },
    { text: `Agent status: ONLINE`, type: "system" },
    { text: `---`, type: "divider" },
  ];

  const [buffLine, setBuffLine] = useState("");
  useEffect(() => {
    const now = Date.now();
    const b = buffsRef?.current?.[agentId] || {};
    const active = Object.values(b).filter(v => v && typeof v.until === "number" && v.until > now);
    if (!active.length) {
      setBuffLine("");
      return;
    }
    const parts = active
      .sort((a, b) => (b.until || 0) - (a.until || 0))
      .slice(0, 3)
      .map(v => {
        const left = Math.max(0, Math.ceil((v.until - now) / 1000));
        const name = String(v.label || v.key || "buff");
        return `${name} ${left}s`;
      });
    setBuffLine(`BUFFS> ${parts.join(" · ")}`);
  }, [agentId, buffsRef, buffsTick]);

  const displayLines = isAtDesk ? [...bootLines, ...(terminalLines || []).slice(-120)] : [];
  const finalLines = isAtDesk ? (buffLine ? [...displayLines, { text: "---", type: "divider" }, { text: buffLine, type: "info" }] : displayLines) : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [finalLines.length, terminalTick, isAtDesk, buffLine]);

  const colors = {
    system: "#6a6055",
    output: "#14f195",
    success: "#14f195",
    info: "#00d1ff",
    warning: "#ffaa22",
    divider: "#2a2520",
  };

  if (!isAtDesk) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050805", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>💤</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#4a4540", marginBottom: 8, fontFamily: "'Courier New', monospace" }}>Screen Idle</div>
        <div style={{ fontSize: 11, color: "#333330", textAlign: "center", lineHeight: 1.6, fontFamily: "'Courier New', monospace" }}>
          {agent.name} is not at their desk.<br />
          Terminal will activate when the agent returns.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", background: "#060a06" }}>
      {finalLines.map((line, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, marginBottom: 4,
          fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.6
        }}>
          {line.ts && <span style={{ color: "#3a3530", flexShrink: 0 }}>{line.ts}</span>}
          {line.type === "divider" ? (
            <span style={{ color: "#2a2520" }}>{"─".repeat(40)}</span>
          ) : (
            <span style={{ color: colors[line.type] || "#14f195" }}>
              <span style={{ color: "#4a4540", marginRight: 6 }}>{">"}</span>
              {line.text}
            </span>
          )}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <span style={{ color: "#4a4540", fontFamily: "'Courier New', monospace", fontSize: 12 }}>{">"}</span>
        <span style={{
          width: 8, height: 14, background: "#14f195",
          animation: "blink 1s step-end infinite", display: "inline-block"
        }} />
        <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
