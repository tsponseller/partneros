import { useState, useEffect, useRef, useMemo } from "react";

const API_KEY_STORAGE  = "pc:apiKey";
const GIST_TOKEN_KEY   = "pc:gistToken";
const GIST_ID_KEY      = "pc:gistId";
const GIST_FILENAME    = "partneros-data.json";
const getApiKey    = () => localStorage.getItem(API_KEY_STORAGE) || "";
const getGistToken = () => localStorage.getItem(GIST_TOKEN_KEY)  || "";
const getGistId    = () => localStorage.getItem(GIST_ID_KEY)     || "";

const gistHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
});
const gistLoad = async (token, id) => {
  const r = await fetch(`https://api.github.com/gists/${id}`, { headers: gistHeaders(token) });
  if (!r.ok) throw new Error(`Load failed (${r.status})`);
  const j = await r.json();
  const content = j.files?.[GIST_FILENAME]?.content;
  if (!content) throw new Error("File not found in Gist");
  return JSON.parse(content);
};
const gistSave = async (token, id, data) => {
  const r = await fetch(`https://api.github.com/gists/${id}`, {
    method: "PATCH", headers: gistHeaders(token),
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(data) } } }),
  });
  if (!r.ok) throw new Error(`Save failed (${r.status})`);
};
const gistCreate = async (token, data) => {
  const r = await fetch("https://api.github.com/gists", {
    method: "POST", headers: gistHeaders(token),
    body: JSON.stringify({ description: "PartnerOS data sync", public: false, files: { [GIST_FILENAME]: { content: JSON.stringify(data) } } }),
  });
  if (!r.ok) throw new Error(`Create failed (${r.status})`);
  const j = await r.json();
  return j.id;
};

const MDP_TARGET = 14;
const ACTIVE_STAGES = ["Idea", "Lead", "Proposal", "Negotiation"];
const STAGE_PROB = { Idea: 10, Lead: 30, Proposal: 50, Negotiation: 75, Won: 100 };
const CADENCE_DAYS = { Weekly: 14, Monthly: 45, Quarterly: 100 };
const QUICK_PROMPTS = [
  "Prep me for my next meeting",
  "Triage my emails",
  "Who should I reach out to today?",
  "Draft outreach to a relationship I've gone cold on",
  "What's my biggest commercial risk right now?",
  "Where is my pipeline weakest — and who can fix it?",
  "Help me reconnect with Taylor Smith",
  "What new pipeline should I be opening this week?",
];

const now = Date.now();
const dago = (d) => new Date(now - d * 86400000).toISOString();
const dfwd = (d) => new Date(now + d * 86400000).toISOString();
const uid = () => Math.random().toString(36).slice(2, 9);
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000));
const fmt = (n) => (!n && n !== 0 ? "$0" : n >= 1 ? `$${n.toFixed(1)}M` : `$${Math.round(n * 1000)}K`);
// ── BCG COLOR PALETTE ──────────────────────────────────────────────────────
const BCG = {
  green800: "#071A0C", green700: "#0E3E1B", green500: "#197A56", green400: "#21BF61",
  green300: "#A8F0B8", green200: "#DCF9E3",
  neutral200: "#F1EEEA", neutral300: "#DFD7CD",
  blue400: "#0977D7", blue200: "#E0F1FF", blue500: "#0A477D",
  orange400: "#FF8306", orange200: "#FFE6CD", orange700: "#954B00",
  red300: "#F48067",   red200:  "#FCE1DC",  red500:  "#A1150C",
  gray700: "#323232",  gray500: "#535353",  gray400: "#B1B1B1",
  gray300: "#D4D4D4",  gray200: "#F2F2F2",
  white: "#FFFFFF",    black: "#000000",
};

const staleColor = (d, t = [7, 21]) => d <= t[0] ? BCG.green500 : d <= t[1] ? BCG.orange700 : BCG.red500;
const staleBg   = (d, t = [7, 21]) => d <= t[0] ? BCG.green200  : d <= t[1] ? BCG.orange200 : BCG.red200;
const staleText = (d, t = [7, 21]) => d <= t[0] ? BCG.green700  : d <= t[1] ? BCG.orange700 : BCG.red500;
const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const CONTACT_TYPES = ["Meeting", "Call", "Email", "Event", "Slack/Text"];

const SEED_DEALS = [
  { id: "d1", client: "Colgate", topic: "Leapfrog Phase 2", estimatedValue: 5.5, stage: "Lead", probability: 40, myRole: "Lead", mdp: "Derek", xo: "Peri, Nicole", lastTouched: dago(3), nextAction: "Finalize proposal with John Hazlin", notes: "Phase 1 complete $1.45M. John is economic buyer.", isAnchor: true, createdAt: dago(30) },
  { id: "d2", client: "Google", topic: "YT Creator Pilots", estimatedValue: 2.7, stage: "Proposal", probability: 50, myRole: "Lead", mdp: "Val", xo: "Derek", lastTouched: dago(7), nextAction: "Follow up with Alannah on proposal", notes: "Proposal submitted.", isAnchor: false, createdAt: dago(20) },
  { id: "d3", client: "Google", topic: "Supply Path Optimization", estimatedValue: 2.0, stage: "Proposal", probability: 50, myRole: "Co-Lead", mdp: "Val", xo: "Don", lastTouched: dago(12), nextAction: "Get Don aligned on approach", notes: "Helped source, not executing.", isAnchor: false, createdAt: dago(25) },
  { id: "d4", client: "Google", topic: "Admob", estimatedValue: 1.0, stage: "Proposal", probability: 40, myRole: "Lead", mdp: "Val", xo: "", lastTouched: dago(18), nextAction: "Define scope and commercials", notes: "Early stage.", isAnchor: false, createdAt: dago(15) },
  { id: "d5", client: "Perrigo", topic: "CMO Agency Model", estimatedValue: 0.5, stage: "Lead", probability: 25, myRole: "Lead", mdp: "Taylor", xo: "Palak", lastTouched: dago(22), nextAction: "Reconnect and qualify", notes: "Gone cold. Needs reactivation.", isAnchor: false, createdAt: dago(40) },
  { id: "d6", client: "Dentsu", topic: "Partnership TBD", estimatedValue: 1.0, stage: "Idea", probability: 10, myRole: "Lead", mdp: "Derek", xo: "Janet", lastTouched: dago(30), nextAction: "Initial outreach", notes: "Very early.", isAnchor: false, createdAt: dago(35) },
  { id: "d7", client: "Kimberly-Clark", topic: "Creator Pilot", estimatedValue: 0.5, stage: "Lead", probability: 30, myRole: "Lead", mdp: "", xo: "", lastTouched: dago(5), nextAction: "Define pilot scope", notes: "", isAnchor: false, createdAt: dago(10) },
  { id: "d8", client: "Colgate", topic: "CMO Leapfrog Ph1", estimatedValue: 1.46, stage: "Won", probability: 100, myRole: "Lead", mdp: "Derek", xo: "Peri, Ray", lastTouched: dago(0), nextAction: "Active delivery", notes: "Active. Strong reference.", isAnchor: true, createdAt: dago(90) },
  { id: "d9", client: "Google", topic: "Creator Program", estimatedValue: 0.8, stage: "Won", probability: 100, myRole: "Lead", mdp: "Val, Ray", xo: "Derek", lastTouched: dago(0), nextAction: "Complete", notes: "Complete.", isAnchor: false, createdAt: dago(120) },
  { id: "d10", client: "Google", topic: "3P Ecosystem", estimatedValue: 1.78, stage: "Won", probability: 100, myRole: "Lead", mdp: "Val", xo: "Derek", lastTouched: dago(0), nextAction: "Active delivery", notes: "Active.", isAnchor: false, createdAt: dago(80) },
  { id: "d11", client: "Google", topic: "Brand Media", estimatedValue: 1.4, stage: "Won", probability: 100, myRole: "Lead", mdp: "Val, Derek", xo: "Leo", lastTouched: dago(0), nextAction: "Complete", notes: "", isAnchor: false, createdAt: dago(150) },
  { id: "d12", client: "SCJ", topic: "GenAI Creative", estimatedValue: 2.0, stage: "Won", probability: 100, myRole: "Expert", mdp: "Shelby", xo: "Dan, Jimmy", lastTouched: dago(0), nextAction: "Complete", notes: "", isAnchor: false, createdAt: dago(100) },
];

const SEED_CONTACTS = [
  { id: "c1", name: "Alannah Sheerin", title: "Sr Director, Strategy & Ops", company: "Google", type: "Client-VP+", warmthScore: 4, lastContact: dago(7), lastContactType: "Meeting", targetCadence: "Weekly", linkedDeals: ["d2"], context: "Key operator on Google account. Drives ecosystem strategy. Very engaged." },
  { id: "c2", name: "Anne Marie Nelson-Bogle", title: "VP, Ads Marketing", company: "Google", type: "Client-VP+", warmthScore: 3, lastContact: dago(21), lastContactType: "Email", targetCadence: "Monthly", linkedDeals: [], context: "VP Ads Marketing. Key for YouTube budget narrative. Needs investment." },
  { id: "c3", name: "Paul Limbrey", title: "VP, Agency Partnerships", company: "Google", type: "Client-VP+", warmthScore: 3, lastContact: dago(35), lastContactType: "Meeting", targetCadence: "Monthly", linkedDeals: [], context: "VP Agency Partnerships. Ecosystem strategy. OVERDUE — needs touch." },
  { id: "c4", name: "Caroline Chulick", title: "Global CMO, Hill's", company: "Colgate", type: "CCO", warmthScore: 4, lastContact: dago(14), lastContactType: "Meeting", targetCadence: "Monthly", linkedDeals: ["d1", "d8"], context: "Hill's CMO. Key for Leapfrog Ph2. Strong relationship." },
  { id: "c5", name: "Carrick Massey", title: "US CMO, Hill's", company: "Colgate", type: "CCO", warmthScore: 3, lastContact: dago(28), lastContactType: "Call", targetCadence: "Monthly", linkedDeals: ["d1"], context: "US CMO Hill's. Needs regular cadence. Behind schedule." },
  { id: "c6", name: "Wendy Orner", title: "SVP Brand Design & Experience", company: "Colgate", type: "Client-VP+", warmthScore: 2, lastContact: dago(45), lastContactType: "Meeting", targetCadence: "Quarterly", linkedDeals: [], context: "SVP Colgate-Palmolive. Needs reactivation." },
  { id: "c7", name: "Derek Rodenhausen", title: "Managing Director & Partner", company: "BCG", type: "Internal-MDP", warmthScore: 5, lastContact: dago(3), lastContactType: "Meeting", targetCadence: "Weekly", linkedDeals: ["d1", "d2", "d10"], context: "Primary MDP sponsor. Weekly 1:1. Keep well-informed on all BD." },
  { id: "c8", name: "Peri Edelstein", title: "CCO, Consumer", company: "BCG", type: "CCO", warmthScore: 3, lastContact: dago(25), lastContactType: "Email", targetCadence: "Monthly", linkedDeals: ["d1"], context: "Consumer CCO. PDPC voter. Need more face time. Show Colgate traction." },
  { id: "c9", name: "Taylor Smith", title: "CCO, Consumer", company: "BCG", type: "CCO", warmthScore: 2, lastContact: dago(40), lastContactType: "Meeting", targetCadence: "Monthly", linkedDeals: [], context: "Consumer CCO. CRITICAL GAP. Underinvested. Key for election." },
  { id: "c10", name: "Val Elbert", title: "XO, Google Account", company: "BCG", type: "Internal-MDP", warmthScore: 5, lastContact: dago(5), lastContactType: "Meeting", targetCadence: "Weekly", linkedDeals: ["d2", "d3", "d4", "d10"], context: "Google XO. Very supportive. Giving runway to grow the account." },
];

const buildCtx = (deals, contacts) => {
  const active = deals.filter((d) => !["Won", "Lost"].includes(d.stage));
  const won = deals.filter((d) => d.stage === "Won" && !d.archivedYear);
  const weighted = active.reduce((s, d) => s + d.estimatedValue * (d.probability / 100), 0);
  const ytdWon = won.reduce((s, d) => s + d.estimatedValue, 0);
  const pace = (weighted + ytdWon) / MDP_TARGET;
  const paceStatus = pace < 0.7 ? "BEHIND_PACE" : pace < 1.0 ? "ON_PACE" : "AHEAD_OF_PACE";
  const staleDeals = active.filter((d) => daysSince(d.lastTouched) > 14).map((d) => `${d.client} "${d.topic}" ${fmt(d.estimatedValue)} — ${daysSince(d.lastTouched)}d stale`);
  const staleContacts = contacts.filter((c) => daysSince(c.lastContact) > CADENCE_DAYS[c.targetCadence]).map((c) => `${c.name} (${c.type}) — ${daysSince(c.lastContact)}d`);
  const topDeals = [...active].sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 5).map((d) => `${d.client}: ${d.topic} ${fmt(d.estimatedValue)} [${d.stage}]`);
  return { pace: Math.round(pace * 100), paceStatus, ytdWon: fmt(ytdWon), ytdWonRaw: ytdWon, weighted: fmt(weighted), weightedRaw: weighted, total: fmt(weighted + ytdWon), staleDeals, staleContacts, topDeals };
};

const buildSys = (ctx, calSummary = "", emailSummary = "") => {
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return `You are the commercial coach for a BCG Principal 1-2 years from MDP election. Be direct, entrepreneurial, push them toward senior client relationships and commercial wins.

TODAY'S DATE: ${todayStr}

⚠ LIVE DATA — AUTHORITATIVE: The data below reflects the current state of the pipeline and relationships as of RIGHT NOW. Any deal, contact, or status mentioned in earlier conversation history that contradicts this data is OUTDATED. Always defer to this system prompt, not prior messages.

COMMERCIAL POSITION: YTD Won ${ctx.ytdWon} | Weighted pipeline ${ctx.weighted} | ${ctx.pace}% to $14M MDP target | ${ctx.paceStatus}
TOP ACTIVE DEALS: ${ctx.topDeals.length ? ctx.topDeals.join(" | ") : "None"}
STALE PIPELINE (active deals >14d not touched): ${ctx.staleDeals.length ? ctx.staleDeals.join(" | ") : "None — all active deals recently touched"}
RELATIONSHIPS OVERDUE: ${ctx.staleContacts.length ? ctx.staleContacts.join(" | ") : "None"}
URGENCY: ${ctx.paceStatus === "BEHIND_PACE" ? "HIGH — push hard, every day matters" : ctx.paceStatus === "ON_PACE" ? "STEADY — maintain momentum" : "LEVERAGE — focus on quality and bigger bets"}
CALENDAR THIS WEEK: ${calSummary || "Not loaded"}
RECENT INBOX: ${emailSummary || "Not loaded"}
⚠ INBOX IS A SNAPSHOT — it reflects emails as of the last refresh and may be several days old. Trevor may have already acted on items. Never assert that something is definitely unaddressed — frame as "if you haven't yet..." or "check whether this is still open." Do not re-flag items Trevor has likely resolved.

ELECTION GAPS: (1) VP+ client relationships owned by user; (2) CCO relationships — Peri Edelstein + Taylor Smith are CRITICAL gaps; (3) Pipeline must sustain $14M MDP pace; (4) Constellation tightness with Derek, Val, Peri/Taylor.

MEETING INTELLIGENCE — cross-reference CALENDAR and INBOX to assess each meeting:
- Use email threads to understand what a meeting is actually about. A meeting title alone is ambiguous — the email thread shows who initiated it, what's at stake, and what Trevor's actual role is.
- INTERNAL vs CLIENT: If all named attendees are BCG people (Derek, Peri, Val, Sonia, Ray, Don, Shloka, Nicole, etc.) with no named external contact, it's internal. If a client name appears in the attendee list OR in a related email thread, it's client-facing.
- BCG INTERNAL names to recognize: Derek Rodenhausen, Peri Edelstein, Val Elbert, Sonia Thosar, Ray, Don Massoni, Shloka Sharan, Nicole, Kate Mann, Monica Zunick, Djon. Meetings with only these people = internal.
- CLIENT names to recognize: Niv Goldman, Scott Shealy, Alannah Sheerin, Carol Tang (Google); Kli Pappas, Wendy Orner, Carrick Massey, John Hazlin (Colgate); Lauren Staff, Theo Ricketts, Trevor Park (Kimberly-Clark); Nidhi Sinha, Alex Barocas (other clients).
- A senior client on an invite does NOT make it high-influence. Assess: Is Trevor presenting or driving? Is it a small group? Is there a live commercial decision? Or is he one of 6 BCG people in a standing sync?
- HIGH influence: 1:1 or small group (≤4) with a named client decision-maker; Trevor is presenting or owns an agenda item; explicit commercial context from email thread.
- LOW influence: all-BCG attendee list; large group where Trevor is one of many; [HOLD]/[TBR]/block tags; recurring status syncs with no email thread context suggesting a live decision.

PROACTIVE PIPELINE COACHING — always blend reactive (emails/meetings) with proactive (pipeline generation):
- Reactive alone is not enough. Every response should consider: who in the RELATIONSHIPS OVERDUE list should Trevor reach out to this week, and with what hook?
- Look at stale deals in STALE PIPELINE — what's the specific unblock needed? Who does Trevor need to call, not email?
- Identify whitespace: which client relationships haven't generated a deal thread yet but should? Which contacts are warm enough to convert to a commercial conversation?
- Suggest specific, contextual outreach — not "reach out to X" but "send X a note about Y referencing Z, because it positions you for W." Use what you know about their role, Trevor's recent work, and market context.
- Pipeline generation priority: (1) re-engage stale relationships with a sharp hook, (2) advance deals stuck in early stages, (3) open new relationships at CCO/VP+ level.

Rules: Be direct. Lead with the action. Max 3-4 short paragraphs or a tight bulleted list. Never sycophantic. Always end with a split: TODAY (1 reactive action) + THIS WEEK (1 proactive pipeline move).`;
};

const callAI = async (messages, sys) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, system: sys, messages }),
  });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("");
};

const REPUTABLE_SOURCES = "site:adweek.com OR site:ft.com OR site:wsj.com OR site:hbr.org OR site:marketingweek.com OR site:thecgr.com OR site:forbes.com OR site:nytimes.com OR site:theinformation.com OR site:digiday.com OR site:campaignlive.com OR site:businessinsider.com";

const callWebSearch = async (query, mode = "web") => {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
  const recencyNote = `Focus only on content published after ${twoWeeksAgo} (last 2 weeks). Skip anything older.`;
  let searchQuery;
  if (mode === "bcg") {
    searchQuery = `site:bcg.com ${query} after:${twoWeeksAgo}`;
  } else {
    searchQuery = `(${REPUTABLE_SOURCES}) ${query} after:${twoWeeksAgo}`;
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: `Search for: ${searchQuery}\n\n${recencyNote}\nReturn the top 3-5 most relevant results. For each include: title, publication, date, 1-2 sentence summary, and URL.` }],
      }),
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("") || "No recent results found.";
  } catch {
    const fallbackPrompt = mode === "bcg"
      ? `Search your knowledge for recent BCG articles or perspectives (last 2 weeks if possible) related to: "${query}". List 3-5 BCG pieces with title, approximate date, and 1-2 sentence description usable as a conversation hook.`
      : `Search your knowledge for very recent articles (last 2 weeks if possible) from reputable business/marketing sources (Adweek, FT, WSJ, HBR, Digiday, etc.) related to: "${query}". List 3-5 pieces with title, source, date, and 1-2 sentence description usable as a conversation hook.`;
    return callAI([{ role: "user", content: fallbackPrompt }], "You are a research assistant. Be concise and specific. Prioritize recency.");
  }
};

const callMCP = async (prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
      mcp_servers: [{ type: "url", url: "https://microsoft365.mcp.claude.com/mcp", name: "microsoft365" }],
    }),
  });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.content
    .filter((b) => b.type === "mcp_tool_result" || b.type === "text")
    .map((b) => (b.type === "mcp_tool_result" ? b.content?.[0]?.text : b.text))
    .filter(Boolean)
    .join("\n");
};

// ── STYLES ──
// ── THEME CSS (injected once; toggled via data-theme on root div) ──────────────
const THEME_CSS = `
  :root {
    --bg-app:#F1EEEA; --bg-card:#FFFFFF; --bg-alt:#F2F2F2;
    --text:#323232; --sub:#535353; --muted:#B1B1B1;
    --line:#D4D4D4; --line-lt:#DFD7CD;
    --won-bg:#DCF9E3; --won-line:#21BF61; --won-text:#0E3E1B; --won-sub:#535353;
    --recon-bg:#FCE1DC; --recon-line:#F48067;
    --badge-blue-bg:#E0F1FF; --badge-blue-text:#0A477D;
    --badge-orange-bg:#FFE6CD; --badge-orange-text:#954B00;
    --badge-red-bg:#FCE1DC; --badge-red-text:#A1150C;
    --badge-green-bg:#DCF9E3; --badge-green-text:#0E3E1B;
  }
  [data-theme="dark"] {
    --bg-app:#1C1C1E; --bg-card:#2C2C2E; --bg-alt:#3A3A3C;
    --text:#F2F2F7; --sub:#AEAEB2; --muted:#636366;
    --line:#48484A; --line-lt:#3A3A3C;
    --won-bg:#0A2B14; --won-line:#21BF61; --won-text:#7ee8a2; --won-sub:#AEAEB2;
    --recon-bg:#3B1219; --recon-line:#F48067;
    --badge-blue-bg:rgba(9,119,215,0.18); --badge-blue-text:#93c5fd;
    --badge-orange-bg:rgba(255,131,6,0.18); --badge-orange-text:#fdba74;
    --badge-red-bg:rgba(244,128,103,0.18); --badge-red-text:#fca5a5;
    --badge-green-bg:rgba(33,191,97,0.18); --badge-green-text:#7ee8a2;
  }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: var(--cal-icon, none); }
  [data-theme="dark"] { --cal-icon: invert(1); }
`;

const g = {
  app:        { fontFamily: "'Trebuchet MS', sans-serif", background: "var(--bg-app)", minHeight: "100vh", color: "var(--text)" },
  header:     { background: `linear-gradient(155deg, ${BCG.green700} 0%, ${BCG.green500} 100%)`, borderBottom: `1px solid ${BCG.green800}`, padding: "12px 20px", position: "sticky", top: 0, zIndex: 50 },
  logoRow:    { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  logo:       { fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BCG.white },
  statsRow:   { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  statCard:   { background: "rgba(0,0,0,0.22)", borderRadius: 10, padding: "10px 13px 12px", border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden" },
  statLabel:  { fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6, fontWeight: 600, paddingTop: 6 },
  statVal:    { fontSize: 22, fontWeight: 300, color: BCG.white, letterSpacing: "-0.02em", lineHeight: 1.1 },
  statSub:    { fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2, fontWeight: 400 },
  paceBar:    { height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2, marginTop: 8, overflow: "hidden" },
  nav:        { background: "var(--bg-card)", borderBottom: "1px solid var(--line)", padding: "0 20px", display: "flex", position: "sticky", top: 89, zIndex: 40 },
  navTab:     { padding: "10px 16px", fontSize: 13, fontWeight: 500, color: "var(--sub)", cursor: "pointer", border: "none", background: "none", borderBottom: "2px solid transparent", transition: "all 0.15s" },
  content:    { padding: 20 },
  sectionTitle: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sub)", marginBottom: 12 },
  kanban:     { display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 },
  col:        { minWidth: 210, width: 210, flexShrink: 0 },
  colHeader:  { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, marginBottom: 8, borderBottom: "2px solid" },
  dealCard:   { background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s" },
  tag:        { display: "inline-block", fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600 },
  btn:        { fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--line)", background: "var(--bg-card)", color: "var(--text)", fontFamily: "inherit", transition: "background 0.1s" },
  btnBlue:    { fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: "none", background: BCG.green500, color: BCG.white, fontFamily: "inherit" },
  addBtn:     { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 10, border: "1px dashed var(--line)", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--muted)", marginBottom: 8, background: "none", width: "100%", fontFamily: "inherit" },
  wonBox:     { background: "var(--bg-card)", borderRadius: 8, padding: "4px 14px", border: "1px solid var(--line)", borderLeft: "3px solid var(--won-line)" },
  contactGrid:  { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 },
  contactCard:  { background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, cursor: "pointer" },
  reconQueue:   { background: "var(--recon-bg)", border: "1px solid var(--recon-line)", borderRadius: 8, padding: 14, marginBottom: 20 },
  reconItem:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--line-lt)" },
  chatWrap:     { maxWidth: 740, margin: "0 auto" },
  bubble:       { padding: "10px 14px", fontSize: 13, lineHeight: 1.6, borderRadius: 10, display: "inline-block", maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  userBubble:   { background: BCG.green500, color: BCG.white, borderRadius: "10px 10px 4px 10px", marginLeft: "auto", display: "block" },
  aiBubble:     { background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "4px 10px 10px 10px", display: "block" },
  qpWrap:       { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  qpBtn:        { fontSize: 11, padding: "6px 11px", borderRadius: 20, border: "1px solid var(--line)", background: "var(--bg-card)", color: "var(--sub)", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" },
  inputRow:     { display: "flex", gap: 8, marginTop: 16, alignItems: "flex-end" },
  textarea:     { flex: 1, padding: "10px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg-alt)", color: "var(--text)", fontFamily: "inherit", resize: "none", minHeight: 44, outline: "none" },
  sendBtn:      { padding: "10px 16px", borderRadius: 8, border: "none", background: BCG.green500, color: BCG.white, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, minHeight: 44 },
  formField:    { marginBottom: 10 },
  formLabel:    { fontSize: 10, fontWeight: 700, color: "var(--sub)", marginBottom: 3, display: "block", textTransform: "uppercase", letterSpacing: "0.07em" },
  formInput:    { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-alt)", color: "var(--text)", fontFamily: "inherit", outline: "none" },
  formSelect:   { width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg-alt)", color: "var(--text)", fontFamily: "inherit", outline: "none" },
  modalBox:     { background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 10, padding: 18, marginBottom: 14 },
  draftBox:     { background: "var(--bg-alt)", borderRadius: 6, padding: 12, fontSize: 12, lineHeight: 1.7, color: "var(--text)", whiteSpace: "pre-wrap", marginTop: 10, border: "1px solid var(--line)" },
};

const STAGE_COLORS = { Idea: BCG.gray400, Lead: BCG.green500, Proposal: BCG.blue400, Negotiation: BCG.orange400 };

function Dots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px", alignItems: "center" }}>
      {[0, 150, 300].map((d) => (
        <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: BCG.gray400, animation: `bounce 1.2s ${d}ms infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function Header({ ctx, dark, onToggleDark, syncStatus, onOpenSync }) {
  const pColor = ctx.paceStatus === "BEHIND_PACE" ? BCG.red300 : ctx.paceStatus === "ON_PACE" ? BCG.orange400 : BCG.green400;
  const gap = Math.max(0, MDP_TARGET - ctx.ytdWonRaw - ctx.weightedRaw);
  const btnStyle = { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontSize: 11, color: BCG.white, fontFamily: "inherit", letterSpacing: "0.03em" };

  return (
    <div style={g.header}>
      <div style={g.logoRow}>
        <div style={g.logo}>BCG &nbsp;|&nbsp; Partner Copilot</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: ctx.paceStatus === "BEHIND_PACE" ? BCG.red300 : BCG.green300, fontWeight: 600 }}>
            {ctx.paceStatus === "BEHIND_PACE" ? "⚠ Behind pace" : ctx.paceStatus === "ON_PACE" ? "→ On pace" : "✓ Ahead of pace"}
          </div>
          {getGistToken() && (
            <span style={{ fontSize: 10, color: syncStatus === "error" ? BCG.red300 : syncStatus === "syncing" ? BCG.orange400 : "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>
              {syncStatus === "syncing" ? "⟳ Syncing…" : syncStatus === "error" ? "⚠ Sync error" : "✓ Synced"}
            </span>
          )}
          <button onClick={onOpenSync} style={{ ...btnStyle, fontSize: 13 }} title={getGistToken() ? "Sync settings" : "Set up cross-device sync"}>
            {getGistToken() ? "⟳" : "⟳?"}
          </button>
          <button onClick={onToggleDark} style={{ ...btnStyle, fontSize: 13 }} title="Toggle dark mode">
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </div>
      <div style={g.statsRow}>
        {/* YTD Won — green accent */}
        <div style={g.statCard}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: BCG.green400, borderRadius: "10px 10px 0 0" }} />
          <div style={g.statLabel}>YTD Won</div>
          <div style={{ ...g.statVal, color: "#7ee8a2" }}>{ctx.ytdWon}</div>
          {(() => {
            const wonPct  = Math.min(100, (ctx.ytdWonRaw  / MDP_TARGET) * 100);
            const pipePct = Math.min(100 - wonPct, (ctx.weightedRaw / MDP_TARGET) * 100);
            return (
              <div style={{ ...g.paceBar, display: "flex", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${wonPct}%`, background: BCG.green400, flexShrink: 0 }} />
                <div style={{ height: "100%", width: `${pipePct}%`, flexShrink: 0, background: `repeating-linear-gradient(90deg,${BCG.green300} 0px,${BCG.green300} 3px,transparent 3px,transparent 7px)` }} />
              </div>
            );
          })()}
          <div style={g.statSub}>of $14M target</div>
        </div>
        {/* Wtd Pipeline — blue accent */}
        <div style={g.statCard}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#60a5fa", borderRadius: "10px 10px 0 0" }} />
          <div style={g.statLabel}>Wtd Pipeline</div>
          <div style={{ ...g.statVal, color: "#93c5fd" }}>{ctx.weighted}</div>
          <div style={g.statSub}>weighted value</div>
        </div>
        {/* Gap — pace-color accent */}
        <div style={g.statCard}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: pColor, borderRadius: "10px 10px 0 0" }} />
          <div style={g.statLabel}>Gap to $14M</div>
          <div style={{ ...g.statVal, color: pColor }}>{gap > 0 ? fmt(gap) : "On track ✓"}</div>
          <div style={{ ...g.paceBar }}>
            <div style={{ height: "100%", borderRadius: 2, background: pColor, width: `${Math.min(100, ctx.pace)}%`, transition: "width 0.6s ease" }} />
          </div>
          <div style={g.statSub}>{ctx.pace}% to goal</div>
        </div>
        {/* Attention — red/amber accent */}
        <div style={g.statCard}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: ctx.staleContacts.length > 3 ? BCG.red300 : BCG.orange400, borderRadius: "10px 10px 0 0" }} />
          <div style={g.statLabel}>Attention Needed</div>
          <div style={{ ...g.statVal, color: ctx.staleContacts.length > 3 ? BCG.red300 : BCG.orange200 }}>
            {ctx.staleContacts.length} <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>contacts</span>
          </div>
          <div style={g.statSub}>{ctx.staleDeals.length} deals stale</div>
        </div>
      </div>
    </div>
  );
}

function NavTabs({ view, setView }) {
  return (
    <div style={g.nav}>
      {[["pipeline", "⬡ Pipeline"], ["relationships", "◎ Relationships"], ["coach", "◈ Coach"]].map(([id, label]) => (
        <button key={id} style={{ ...g.navTab, color: view === id ? BCG.green500 : "var(--sub)", borderBottomColor: view === id ? BCG.green500 : "transparent" }} onClick={() => setView(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function DealCard({ deal, onLogTouch, onMoveStage, onDraft, onEdit, onUpdateDeal }) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [logInput, setLogInput] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionStakeholder, setActionStakeholder] = useState("");
  const [showAllLog, setShowAllLog] = useState(false);
  const days = daysSince(deal.lastTouched);
  const stageIdx = ACTIVE_STAGES.indexOf(deal.stage);
  const log = deal.log || [];
  const actions = deal.actions || [];
  const openActions = actions.filter((a) => !a.done);

  const addLog = () => {
    if (!logInput.trim()) return;
    const entry = { id: uid(), date: new Date().toISOString().split("T")[0], text: logInput.trim() };
    onUpdateDeal(deal.id, { log: [entry, ...log], lastTouched: new Date().toISOString() });
    setLogInput("");
  };

  const addAction = () => {
    if (!actionText.trim()) return;
    const a = { id: uid(), text: actionText.trim(), stakeholder: actionStakeholder.trim(), done: false, createdAt: new Date().toISOString() };
    onUpdateDeal(deal.id, { actions: [...actions, a] });
    setActionText(""); setActionStakeholder("");
  };

  const toggleAction = (aId) => {
    const action = actions.find((a) => a.id === aId);
    if (!action) return;
    const completing = !action.done;
    const updated = actions.map((a) => a.id === aId ? { ...a, done: completing } : a);
    const newLog = completing
      ? [{ id: uid(), date: new Date().toISOString().split("T")[0], text: `✓ ${action.text}${action.stakeholder ? ` (${action.stakeholder})` : ""}` }, ...log]
      : log;
    onUpdateDeal(deal.id, { actions: updated, log: newLog, lastTouched: completing ? new Date().toISOString() : deal.lastTouched });
  };

  const deleteAction = (aId) => onUpdateDeal(deal.id, { actions: actions.filter((a) => a.id !== aId) });

  const fmtLogDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const visibleLog = showAllLog ? log : log.slice(0, 4);

  const sInput = { fontSize: 11, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg-alt)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" };

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("dealId", deal.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      style={{ ...g.dealCard, borderColor: open ? BCG.gray400 : "var(--line)", opacity: dragging ? 0.35 : 1, cursor: "grab" }}
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deal.client}</div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deal.topic}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text)", whiteSpace: "nowrap" }}>{fmt(deal.estimatedValue)}</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
        <span style={{ ...g.tag, background: staleBg(days), color: staleText(days) }}>{days}d ago</span>
        {deal.myRole && <span style={{ ...g.tag, background: "var(--bg-alt)", color: "var(--sub)" }}>{deal.myRole}</span>}
        {deal.isAnchor && <span style={{ ...g.tag, background: "var(--badge-blue-bg)", color: "var(--badge-blue-text)" }}>Anchor</span>}
        {openActions.length > 0 && <span style={{ ...g.tag, background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)" }}>{openActions.length} open</span>}
      </div>

      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid var(--line)` }}>
          {(deal.mdp || deal.xo) && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>
              {[deal.mdp && `MDP: ${deal.mdp}`, deal.xo && `XO: ${deal.xo}`].filter(Boolean).join(" · ")}
            </div>
          )}

          {/* ── OPEN ACTIONS ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Actions</div>
            {actions.length === 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontStyle: "italic" }}>No actions yet</div>}
            {actions.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                <input type="checkbox" checked={a.done} onChange={() => toggleAction(a.id)}
                  style={{ marginTop: 2, accentColor: BCG.green500, cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: a.done ? "var(--muted)" : "var(--text)", textDecoration: a.done ? "line-through" : "none" }}>{a.text}</span>
                  {a.stakeholder && <span style={{ marginLeft: 5, fontSize: 10, color: "var(--badge-blue-text)", background: "var(--badge-blue-bg)", borderRadius: 3, padding: "1px 5px" }}>{a.stakeholder}</span>}
                </div>
                <button onClick={() => deleteAction(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            {/* Add action row */}
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <input value={actionText} onChange={(e) => setActionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAction()}
                placeholder="Add action…" style={{ ...sInput, flex: 2 }} />
              <input value={actionStakeholder} onChange={(e) => setActionStakeholder(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAction()}
                placeholder="Who?" style={{ ...sInput, flex: 1 }} />
              <button onClick={addAction} style={{ ...g.btn, padding: "4px 8px", fontSize: 12, flexShrink: 0 }}>+</button>
            </div>
          </div>

          {/* ── ACTIVITY LOG ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Activity log</div>
            {log.length === 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontStyle: "italic" }}>No updates yet</div>}
            {visibleLog.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", marginTop: 1, minWidth: 40 }}>{fmtLogDate(entry.date)}</span>
                <span style={{ fontSize: 11, color: "var(--sub)", lineHeight: 1.4 }}>{entry.text}</span>
              </div>
            ))}
            {log.length > 4 && (
              <button onClick={() => setShowAllLog(!showAllLog)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "2px 0", fontFamily: "inherit" }}>
                {showAllLog ? "Show less ↑" : `Show ${log.length - 4} more ↓`}
              </button>
            )}
            {/* Add log entry */}
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <input value={logInput} onChange={(e) => setLogInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLog()}
                placeholder="Log an update…" style={sInput} />
              <button onClick={addLog} style={{ ...g.btn, padding: "4px 8px", fontSize: 12, flexShrink: 0 }}>↵</button>
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 8, borderTop: `1px solid var(--line)` }}>
            <button style={g.btn} onClick={() => onLogTouch(deal.id)}>✓ Log touch</button>
            {stageIdx >= 0 && stageIdx < ACTIVE_STAGES.length - 1 && (
              <button style={g.btn} onClick={() => onMoveStage(deal.id, 1)}>Advance →</button>
            )}
            <button style={g.btnBlue} onClick={() => onDraft(deal)}>Draft email ↗</button>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "4px 6px", fontFamily: "inherit" }} onClick={() => onEdit(deal)} title="Edit deal">✎</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftModal({ deal, ctx, onClose }) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    callAI([{ role: "user", content: `Draft a short, senior-executive-appropriate email to the key stakeholder at ${deal.client} about ${deal.topic}. Deal is ${fmt(deal.estimatedValue)}, currently in ${deal.stage} stage. Next action: ${deal.nextAction || "advance the conversation"}. Be direct, confident, MDP-level. Subject line + 3-4 sentences max.` }], buildSys(ctx))
      .then(setDraft).catch(() => setDraft("API error — check your Anthropic connection.")).finally(() => setLoading(false));
  }, []);
  return (
    <div style={g.modalBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Draft: {deal.client} — {deal.topic}</div>
        <button style={g.btn} onClick={onClose}>✕</button>
      </div>
      {loading ? <Dots /> : <div style={g.draftBox}>{draft}</div>}
      {!loading && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={g.btnBlue} onClick={() => { navigator.clipboard?.writeText(draft); }}>Copy</button>
          <button style={g.btn} onClick={onClose}>Close</button>
        </div>
      )}
    </div>
  );
}

function AddDealModal({ onAdd, onClose }) {
  const [f, setF] = useState({ client: "", topic: "", estimatedValue: "", stage: "Lead", myRole: "Lead", mdp: "", xo: "", nextAction: "", notes: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={g.modalBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Add deal</div>
        <button style={g.btn} onClick={onClose}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["client", "Client", "Colgate"], ["topic", "Topic", "AI transformation"]].map(([k, l, p]) => (
          <div key={k} style={g.formField}>
            <label style={g.formLabel}>{l}</label>
            <input style={g.formInput} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={p} />
          </div>
        ))}
        <div style={g.formField}>
          <label style={g.formLabel}>Value ($M)</label>
          <input style={g.formInput} type="number" step="0.1" value={f.estimatedValue} onChange={(e) => set("estimatedValue", e.target.value)} placeholder="0.0" />
        </div>
        <div style={g.formField}>
          <label style={g.formLabel}>Stage</label>
          <select style={g.formSelect} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            {ACTIVE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {[["myRole", "My role", "Lead / Expert"], ["mdp", "MDP", "Derek"]].map(([k, l, p]) => (
          <div key={k} style={g.formField}>
            <label style={g.formLabel}>{l}</label>
            <input style={g.formInput} value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={p} />
          </div>
        ))}
      </div>
      <div style={g.formField}>
        <label style={g.formLabel}>Next action</label>
        <input style={g.formInput} value={f.nextAction} onChange={(e) => set("nextAction", e.target.value)} placeholder="What needs to happen next?" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button style={{ ...g.btnBlue, padding: "8px 16px", fontSize: 13 }} onClick={() => {
          if (!f.client || !f.topic) return;
          onAdd({ ...f, id: uid(), estimatedValue: parseFloat(f.estimatedValue) || 0, probability: STAGE_PROB[f.stage] || 30, isAnchor: false, lastTouched: new Date().toISOString(), createdAt: new Date().toISOString(), log: [], actions: [] });
          onClose();
        }}>Add deal</button>
        <button style={g.btn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

const ALL_STAGES = [...ACTIVE_STAGES, "Won", "Lost"];

function EditDealModal({ deal, onSave, onClose }) {
  const [f, setF] = useState({
    client: deal.client, topic: deal.topic, estimatedValue: deal.estimatedValue,
    stage: deal.stage, probability: deal.probability, myRole: deal.myRole || "Lead",
    mdp: deal.mdp || "", xo: deal.xo || "", nextAction: deal.nextAction || "",
    notes: deal.notes || "", isAnchor: deal.isAnchor || false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div style={g.modalBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Edit — {deal.client} · {deal.topic}</div>
        <button style={g.btn} onClick={onClose}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["client", "Client"], ["topic", "Topic"]].map(([k, l]) => (
          <div key={k} style={g.formField}>
            <label style={g.formLabel}>{l}</label>
            <input style={g.formInput} value={f[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        <div style={g.formField}>
          <label style={g.formLabel}>Value ($M)</label>
          <input style={g.formInput} type="number" step="0.1" value={f.estimatedValue} onChange={(e) => set("estimatedValue", parseFloat(e.target.value) || 0)} />
        </div>
        <div style={g.formField}>
          <label style={g.formLabel}>Stage</label>
          <select style={g.formSelect} value={f.stage} onChange={(e) => { const s = e.target.value; set("stage", s); if (STAGE_PROB[s]) set("probability", STAGE_PROB[s]); }}>
            {ALL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={g.formField}>
          <label style={g.formLabel}>Likelihood</label>
          <select style={g.formSelect} value={f.probability} onChange={(e) => set("probability", parseInt(e.target.value))}>
            {[10, 25, 50, 75, 100].map((p) => <option key={p} value={p}>{p}% — {["Very unlikely","Low","Even odds","Likely","Certain"][([10,25,50,75,100].indexOf(p))]}</option>)}
          </select>
        </div>
        <div style={g.formField}>
          <label style={g.formLabel}>My role</label>
          <select style={g.formSelect} value={f.myRole} onChange={(e) => set("myRole", e.target.value)}>
            {["Lead", "Co-Lead", "Expert"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {[["mdp", "MDP"], ["xo", "XO"]].map(([k, l]) => (
          <div key={k} style={g.formField}>
            <label style={g.formLabel}>{l}</label>
            <input style={g.formInput} value={f[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div style={g.formField}>
        <label style={g.formLabel}>Next action</label>
        <input style={g.formInput} value={f.nextAction} onChange={(e) => set("nextAction", e.target.value)} />
      </div>
      <div style={g.formField}>
        <label style={g.formLabel}>Notes</label>
        <textarea style={{ ...g.formInput, minHeight: 56, resize: "vertical" }} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input type="checkbox" id="edit-anchor" checked={f.isAnchor} onChange={(e) => set("isAnchor", e.target.checked)} />
        <label htmlFor="edit-anchor" style={{ fontSize: 12, color: "var(--text)", cursor: "pointer" }}>Anchor deal</label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...g.btnBlue, padding: "8px 16px", fontSize: 13 }} onClick={() => { onSave({ ...deal, ...f }); onClose(); }}>Save changes</button>
        <button style={g.btn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

const ARCHIVE_YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 1 - i);

function WonDealActions({ deal, onEdit, onDelete, onArchive }) {
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear() - 1);
  const ghost = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "3px 5px" };
  if (confirming) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: BCG.red500 }}>Delete?</span>
      <button style={{ ...ghost, fontSize: 11, color: BCG.red500, fontWeight: 600 }} onClick={() => onDelete(deal.id)}>Yes</button>
      <button style={{ ...ghost, fontSize: 11, color: "var(--muted)" }} onClick={() => setConfirming(false)}>No</button>
    </div>
  );
  if (archiving) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select style={{ ...g.formSelect, width: "auto", fontSize: 11, padding: "2px 6px" }} value={archiveYear} onChange={(e) => setArchiveYear(Number(e.target.value))}>
        {ARCHIVE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <button style={{ ...ghost, fontSize: 11, color: BCG.green500, fontWeight: 600 }} onClick={() => { onArchive(deal.id, archiveYear); setArchiving(false); }}>Move ↓</button>
      <button style={{ ...ghost, fontSize: 11, color: "var(--muted)" }} onClick={() => setArchiving(false)}>Cancel</button>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: BCG.green500 }}>{fmt(deal.estimatedValue)}</div>
      <button style={{ ...ghost, color: "var(--muted)", fontSize: 11 }} onClick={() => setArchiving(true)} title="Archive to prior year">↓ Archive</button>
      <button style={{ ...ghost, color: "var(--muted)", fontSize: 13 }} onClick={() => onEdit(deal)} title="Edit">✎</button>
      <button style={{ ...ghost, color: "var(--line)", fontSize: 13 }} onClick={() => setConfirming(true)} title="Delete">✕</button>
    </div>
  );
}

function PipelineView({ deals, setDeals, ctx }) {
  const [showAdd, setShowAdd] = useState(false);
  const [draftDeal, setDraftDeal] = useState(null);
  const [editDeal, setEditDeal] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [priorYearsOpen, setPriorYearsOpen] = useState(false);
  const active = ACTIVE_STAGES.reduce((acc, s) => { acc[s] = deals.filter((d) => d.stage === s); return acc; }, {});
  const won = deals.filter((d) => d.stage === "Won" && !d.archivedYear);
  const archived = deals.filter((d) => d.archivedYear);
  const archivedByYear = archived.reduce((acc, d) => { acc[d.archivedYear] = [...(acc[d.archivedYear] || []), d]; return acc; }, {});
  const archivedYearsSorted = Object.keys(archivedByYear).map(Number).sort((a, b) => b - a);
  const logTouch = (id) => setDeals((ds) => ds.map((d) => d.id === id ? { ...d, lastTouched: new Date().toISOString() } : d));
  const updateDeal = (id, patch) => setDeals((ds) => ds.map((d) => d.id === id ? { ...d, ...patch } : d));
  const moveStage = (id, dir) => setDeals((ds) => ds.map((d) => {
    if (d.id !== id) return d;
    const i = ACTIVE_STAGES.indexOf(d.stage);
    const ni = i + dir;
    if (ni < 0 || ni >= ACTIVE_STAGES.length) return d;
    return { ...d, stage: ACTIVE_STAGES[ni], probability: STAGE_PROB[ACTIVE_STAGES[ni]] };
  }));
  const saveDeal = (updated) => setDeals((ds) => ds.map((d) => d.id === updated.id ? updated : d));
  const moveToStage = (id, stage) => setDeals((ds) => ds.map((d) => d.id === id ? { ...d, stage, probability: STAGE_PROB[stage] ?? d.probability } : d));
  const archiveDeal = (id, year) => setDeals((ds) => ds.map((d) => d.id === id ? { ...d, archivedYear: year } : d));
  const unarchiveDeal = (id) => setDeals((ds) => ds.map((d) => d.id === id ? { ...d, archivedYear: null } : d));
  return (
    <div>
      {showAdd && <AddDealModal onAdd={(d) => setDeals((ds) => [...ds, d])} onClose={() => setShowAdd(false)} />}
      {draftDeal && <DraftModal deal={draftDeal} ctx={ctx} onClose={() => setDraftDeal(null)} />}
      {editDeal && <EditDealModal deal={editDeal} onSave={saveDeal} onClose={() => setEditDeal(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={g.sectionTitle}>Active pipeline</div>
        <button style={g.btnBlue} onClick={() => setShowAdd(true)}>+ Add deal</button>
      </div>
      <div style={g.kanban}>
        {ACTIVE_STAGES.map((stage) => (
          <div
            key={stage}
            style={{ ...g.col, borderRadius: 8, outline: dragOverStage === stage ? `2px dashed ${STAGE_COLORS[stage]}` : "2px solid transparent", transition: "outline 0.1s" }}
            onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("dealId"); if (id) moveToStage(id, stage); setDragOverStage(null); }}
          >
            <div style={{ ...g.colHeader, borderColor: STAGE_COLORS[stage] }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: STAGE_COLORS[stage] }}>{stage}</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--sub)" }}>{active[stage].length} · {fmt(active[stage].reduce((s, d) => s + d.estimatedValue, 0))}</span>
            </div>
            <button style={g.addBtn} onClick={() => setShowAdd(true)}>+ Add</button>
            {active[stage].map((d) => <DealCard key={d.id} deal={d} onLogTouch={logTouch} onMoveStage={moveStage} onDraft={setDraftDeal} onEdit={setEditDeal} onUpdateDeal={updateDeal} />)}
          </div>
        ))}
      </div>

      {/* Won this year */}
      {won.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={g.sectionTitle}>Won this year · {fmt(won.reduce((s, d) => s + d.estimatedValue, 0))}</div>
          <div style={g.wonBox}>
            {won.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid var(--won-line)` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--won-text)" }}>{d.client} · {d.topic}</div>
                  <div style={{ fontSize: 11, color: "var(--won-sub)" }}>{d.myRole} {d.mdp ? `· MDP: ${d.mdp}` : ""}</div>
                </div>
                <WonDealActions deal={d} onEdit={setEditDeal} onDelete={(id) => setDeals((ds) => ds.filter((x) => x.id !== id))} onArchive={archiveDeal} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prior years archive */}
      {archivedYearsSorted.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0", marginBottom: priorYearsOpen ? 10 : 0 }}
            onClick={() => setPriorYearsOpen((v) => !v)}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
              Prior years ({archived.length} deals · {fmt(archived.reduce((s, d) => s + d.estimatedValue, 0))})
            </span>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{priorYearsOpen ? "▲" : "▼"}</span>
          </button>
          {priorYearsOpen && archivedYearsSorted.map((year) => (
            <div key={year} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sub)", marginBottom: 6 }}>
                {year} · {fmt(archivedByYear[year].reduce((s, d) => s + d.estimatedValue, 0))}
              </div>
              <div style={{ background: "var(--bg-alt)", borderRadius: 8, padding: "4px 14px", border: `1px solid var(--line)` }}>
                {archivedByYear[year].map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid var(--line)` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{d.client} · {d.topic}</div>
                      <div style={{ fontSize: 11, color: "var(--sub)" }}>{d.myRole}{d.mdp ? ` · MDP: ${d.mdp}` : ""} · {d.stage}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--sub)" }}>{fmt(d.estimatedValue)}</span>
                      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--muted)", fontFamily: "inherit", padding: "2px 5px" }} onClick={() => unarchiveDeal(d.id)} title="Move back to current year">↑ Restore</button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--muted)", fontFamily: "inherit", padding: "2px 5px" }} onClick={() => setEditDeal(d)} title="Edit">✎</button>
                      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--line)", fontFamily: "inherit", padding: "2px 5px" }} onClick={() => setDeals((ds) => ds.filter((x) => x.id !== d.id))} title="Delete">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_EDIT_CHIPS = ["Shorter", "More formal", "Warmer / more personal", "Punchier opening", "Add urgency", "Lead with a question"];

function ContactOutreachPanel({ contact, ctx, onClose }) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refining, setRefining] = useState(false);
  const [customEdit, setCustomEdit] = useState("");
  const [history, setHistory] = useState([]); // [{role, text}]
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState("web"); // "files" | "bcg" | "web"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState("");
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const historyRef = useRef(null);

  useEffect(() => {
    const days = daysSince(contact.lastContact);
    const initPrompt = `Draft a short, warm but direct reconnect note to ${contact.name}, ${contact.title} at ${contact.company}. It has been ${days} days since last contact. Context: ${contact.context}. Personal, confident, under 5 sentences. No subject line — just the message body.`;
    callAI([{ role: "user", content: initPrompt }], buildSys(ctx))
      .then((text) => { setDraft(text); setHistory([{ role: "ai", text }]); })
      .catch(() => { const err = "API error — check connection."; setDraft(err); setHistory([{ role: "ai", text: err }]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [history]);

  const refineWith = async (instruction) => {
    if (refining) return;
    const userMsg = { role: "user", text: instruction };
    setHistory((h) => [...h, userMsg]);
    setRefining(true);
    setCustomEdit("");
    try {
      const newDraft = await callAI(
        [{ role: "user", content: `Here is a reconnect message draft:\n\n${draft}\n\nPlease revise it with this instruction: ${instruction}\n\nReturn only the revised message body, nothing else.` }],
        buildSys(ctx)
      );
      setDraft(newDraft);
      setHistory((h) => [...h, { role: "ai", text: newDraft }]);
    } catch {
      setHistory((h) => [...h, { role: "ai", text: "API error — please try again." }]);
    } finally {
      setRefining(false);
    }
  };

  const useAsHook = (resultText) => {
    const hook = resultText.trim().split("\n")[0];
    refineWith(`Incorporate this content hook at the start or naturally within the message: "${hook}"`);
    setSearchOpen(false);
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults("");
    try {
      if (searchTab === "files") {
        // SharePoint/OneDrive — served from Claude Code's M365 connection via data.json
        const result = await callAI(
          [{ role: "user", content: `Based on your knowledge of BCG consulting work, suggest 3-5 BCG documents or frameworks related to: "${searchQuery}". For each: likely file name, what it would contain, and a 1-2 sentence hook for using it in client conversation. Note: for actual file search, ask Claude Code to search SharePoint and refresh the My Files cache.` }],
          "You are a BCG research assistant. Be specific to BCG's content library and methodologies."
        );
        setSearchResults(result || "No results found.");
      } else {
        const result = await callWebSearch(searchQuery, searchTab === "bcg" ? "bcg" : "web");
        setSearchResults(result || "No results found.");
      }
    } catch {
      setSearchResults("Search failed — please try again.");
    } finally {
      setSearching(false);
    }
  };

  const tabStyle = (active) => ({
    fontSize: 11, padding: "5px 12px", cursor: "pointer", border: "none", fontFamily: "inherit", fontWeight: active ? 700 : 500,
    borderBottom: active ? `2px solid ${BCG.green500}` : "2px solid transparent",
    background: "none", color: active ? BCG.green500 : BCG.gray500,
  });

  return (
    <div style={{ ...g.modalBox, borderColor: "var(--line)", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Draft outreach — {contact.name}</div>
        <button style={{ ...g.btn, fontSize: 11 }} onClick={onClose}>✕ Close</button>
      </div>

      {loading ? (
        <Dots />
      ) : (
        <>
          {/* Draft history scroll */}
          {history.length > 1 && (
            <div ref={historyRef} style={{ maxHeight: 140, overflowY: "auto", marginBottom: 10, padding: "8px 10px", background: "var(--bg-app)", borderRadius: 6, border: `1px solid var(--line)` }}>
              {history.slice(0, -1).map((m, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 11, color: m.role === "user" ? BCG.green400 : "var(--sub)" }}>
                  <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.role === "user" ? "Edit request" : "Draft"}</span>
                  <div style={{ marginTop: 2, lineHeight: 1.5, color: "var(--sub)", fontStyle: m.role === "user" ? "italic" : "normal" }}>{m.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Current draft (editable) */}
          <textarea
            style={{ ...g.textarea, minHeight: 120, fontSize: 12, lineHeight: 1.7, marginBottom: 10 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          {/* Quick-edit chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {QUICK_EDIT_CHIPS.map((chip) => (
              <button
                key={chip}
                style={{ ...g.qpBtn, opacity: refining ? 0.5 : 1 }}
                disabled={refining}
                onClick={() => refineWith(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Custom edit row */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              style={{ ...g.formInput, flex: 1 }}
              placeholder="Custom instruction (e.g. reference our Colgate work)…"
              value={customEdit}
              onChange={(e) => setCustomEdit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customEdit.trim() && refineWith(customEdit)}
            />
            <button
              style={{ ...g.btnBlue, fontSize: 11, opacity: refining || !customEdit.trim() ? 0.5 : 1 }}
              disabled={refining || !customEdit.trim()}
              onClick={() => refineWith(customEdit)}
            >
              {refining ? "Refining…" : "Refine →"}
            </button>
          </div>

          {/* Copy button */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <button
              style={{ ...g.btnBlue, fontSize: 11 }}
              onClick={() => { navigator.clipboard?.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? "Copied ✓" : "Copy message"}
            </button>
            <button
              style={{ ...g.btn, fontSize: 11 }}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? "▲ Hide content hooks" : "▼ Find content hooks"}
            </button>
          </div>

          {/* Content hooks search panel */}
          {searchOpen && (
            <div style={{ border: `1px solid var(--line)`, borderRadius: 8, overflow: "hidden" }}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid var(--line)`, background: "var(--bg-app)" }}>
                {[["files", "My Files"], ["bcg", "BCG.com"], ["web", "Open Web"]].map(([id, label]) => (
                  <button key={id} style={tabStyle(searchTab === id)} onClick={() => { setSearchTab(id); setSearchResults(""); }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div style={{ padding: "10px 12px", borderBottom: `1px solid var(--line)` }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    style={{ ...g.formInput, flex: 1 }}
                    placeholder={
                      searchTab === "files" ? "Search your OneDrive / SharePoint…"
                      : searchTab === "bcg" ? "Search BCG.com (e.g. creator economy, GenAI marketing)…"
                      : "Search the web (e.g. YouTube creator trends 2025)…"
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  />
                  <button
                    style={{ ...g.btnBlue, fontSize: 11, opacity: searching || !searchQuery.trim() ? 0.5 : 1 }}
                    disabled={searching || !searchQuery.trim()}
                    onClick={doSearch}
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>

              {/* Results */}
              {(searching || searchResults) && (
                <div style={{ padding: "10px 12px" }}>
                  {searching ? <Dots /> : (
                    <>
                      <div style={{ fontSize: 11, color: "var(--sub)", whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 8 }}>{searchResults}</div>
                      <button
                        style={{ ...g.btn, fontSize: 11 }}
                        onClick={() => useAsHook(searchResults)}
                      >
                        Use as hook ↑
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CONTACT_TYPES_OPTIONS = ["Client-VP+", "CCO", "Internal-MDP", "Internal-Other", "External"];

function EditContactModal({ contact, onSave, onClose }) {
  const blank = { id: uid(), name: "", title: "", company: "", type: "Client-VP+", warmthScore: 3, lastContact: new Date().toISOString(), lastContactType: "Meeting", targetCadence: "Monthly", linkedDeals: [], context: "", log: [], actions: [] };
  const [form, setForm] = useState(contact ? { ...contact } : blank);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !contact;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, width: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{isNew ? "Add contact" : `Edit — ${contact.name}`}</div>
          <button style={{ ...g.btn, fontSize: 11 }} onClick={onClose}>✕</button>
        </div>

        <div style={g.formField}><label style={g.formLabel}>Name</label><input style={g.formInput} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></div>
        <div style={g.formField}><label style={g.formLabel}>Title</label><input style={g.formInput} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. VP, Strategy" /></div>
        <div style={g.formField}><label style={g.formLabel}>Company</label><input style={g.formInput} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Google" /></div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={g.formLabel}>Type</label>
            <select style={g.formSelect} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {CONTACT_TYPES_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><label style={g.formLabel}>Cadence</label>
            <select style={g.formSelect} value={form.targetCadence} onChange={(e) => set("targetCadence", e.target.value)}>
              {Object.keys(CADENCE_DAYS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><label style={g.formLabel}>Last contact date</label>
            <input style={g.formInput} type="date" value={form.lastContact?.split("T")[0] || ""} onChange={(e) => set("lastContact", new Date(e.target.value).toISOString())} />
          </div>
          <div><label style={g.formLabel}>Contact type</label>
            <select style={g.formSelect} value={form.lastContactType} onChange={(e) => set("lastContactType", e.target.value)}>
              {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={g.formField}><label style={g.formLabel}>Warmth (1–5)</label>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            {[1,2,3,4,5].map((n) => (
              <button key={n} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${n <= form.warmthScore ? BCG.green400 : "var(--line)"}`, background: n <= form.warmthScore ? BCG.green400 : "var(--bg-alt)", cursor: "pointer" }} onClick={() => set("warmthScore", n)} />
            ))}
          </div>
        </div>

        <div style={g.formField}><label style={g.formLabel}>Context / notes</label>
          <textarea style={{ ...g.formInput, minHeight: 72, resize: "vertical" }} value={form.context} onChange={(e) => set("context", e.target.value)} placeholder="Relationship context, priorities, key notes…" />
        </div>

        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
          <button style={g.btn} onClick={onClose}>Cancel</button>
          <button style={{ ...g.btnBlue }} disabled={!form.name.trim()} onClick={() => { onSave(form); onClose(); }}>
            {isNew ? "Add contact" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ contact, onLogTouch, onDraft, onEdit, onDelete, onUpdateContact }) {
  const [open, setOpen] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logInput, setLogInput] = useState("");
  const [actionText, setActionText] = useState("");
  const [actionStakeholder, setActionStakeholder] = useState("");
  const [showAllLog, setShowAllLog] = useState(false);
  const days = daysSince(contact.lastContact);
  const threshold = CADENCE_DAYS[contact.targetCadence];
  const overdue = days > threshold;
  const typeColor = { CCO: BCG.orange400, "Internal-MDP": BCG.green500, "Client-VP+": "var(--sub)" }[contact.type] || "var(--sub)";
  const contactTypeIcon = { Meeting: "●", Call: "☏", Email: "✉", Event: "◆", "Slack/Text": "◉" };
  const log = contact.log || [];
  const actions = contact.actions || [];
  const openActions = actions.filter((a) => !a.done);
  const fmtLogDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const sInput = { fontSize: 11, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--line)", background: "var(--bg-alt)", color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" };
  const visibleLog = showAllLog ? log : log.slice(0, 4);

  const addLog = () => {
    if (!logInput.trim()) return;
    const entry = { id: uid(), date: new Date().toISOString().split("T")[0], text: logInput.trim() };
    onUpdateContact(contact.id, { log: [entry, ...log] });
    setLogInput("");
  };

  const addAction = () => {
    if (!actionText.trim()) return;
    const a = { id: uid(), text: actionText.trim(), stakeholder: actionStakeholder.trim(), done: false, createdAt: new Date().toISOString() };
    onUpdateContact(contact.id, { actions: [...actions, a] });
    setActionText(""); setActionStakeholder("");
  };

  const toggleAction = (aId) => {
    const action = actions.find((a) => a.id === aId);
    if (!action) return;
    const completing = !action.done;
    const updated = actions.map((a) => a.id === aId ? { ...a, done: completing } : a);
    const newLog = completing
      ? [{ id: uid(), date: new Date().toISOString().split("T")[0], text: `✓ ${action.text}${action.stakeholder ? ` (${action.stakeholder})` : ""}` }, ...log]
      : log;
    onUpdateContact(contact.id, { actions: updated, log: newLog });
  };

  const deleteAction = (aId) => onUpdateContact(contact.id, { actions: actions.filter((a) => a.id !== aId) });

  const handleLogTouch = (type) => {
    const entry = { id: uid(), date: logDate, text: `${contactTypeIcon[type] || "●"} ${type}` };
    onUpdateContact(contact.id, {
      lastContact: new Date(logDate).toISOString(),
      lastContactType: type,
      log: [entry, ...log],
    });
    setLogging(false);
  };

  return (
    <div style={{ ...g.contactCard, borderColor: overdue && contact.type === "CCO" ? BCG.red300 : "var(--line)", borderLeftWidth: overdue && contact.type === "CCO" ? 3 : 1 }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{contact.name}</div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 1 }}>{contact.title}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: typeColor, marginTop: 3 }}>{contact.company}</div>
        </div>
        <span style={{ ...g.tag, background: staleBg(days, [threshold / 2, threshold]), color: staleText(days, [threshold / 2, threshold]), flexShrink: 0 }}>{days}d</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--sub)", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "var(--muted)" }}>{contactTypeIcon[contact.lastContactType] || "●"}</span>
        <span style={{ color: "var(--text)", fontWeight: 500 }}>{contact.lastContactType}</span>
        <span style={{ color: "var(--muted)" }}>·</span>
        <span style={{ color: overdue ? staleText(days, [threshold / 2, threshold]) : "var(--muted)" }}>{fmtDate(contact.lastContact)}</span>
        {overdue && <span style={{ color: "var(--badge-red-text)", fontWeight: 600 }}>— overdue</span>}
      </div>

      <div style={{ display: "flex", gap: 3, marginTop: 7, alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: n <= contact.warmthScore ? BCG.green400 : "var(--line)" }} />
        ))}
        <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 4 }}>{contact.targetCadence}</span>
        {openActions.length > 0 && <span style={{ ...g.tag, background: "var(--badge-orange-bg)", color: "var(--badge-orange-text)", marginLeft: 4 }}>{openActions.length} open</span>}
      </div>

      {open && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid var(--line)` }}>
          {contact.context && <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 10, lineHeight: 1.5 }}>{contact.context}</div>}

          {/* ── OPEN ACTIONS ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Actions</div>
            {actions.length === 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontStyle: "italic" }}>No actions yet</div>}
            {actions.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                <input type="checkbox" checked={a.done} onChange={() => toggleAction(a.id)}
                  style={{ marginTop: 2, accentColor: BCG.green500, cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11, color: a.done ? "var(--muted)" : "var(--text)", textDecoration: a.done ? "line-through" : "none" }}>{a.text}</span>
                  {a.stakeholder && <span style={{ marginLeft: 5, fontSize: 10, color: "var(--badge-blue-text)", background: "var(--badge-blue-bg)", borderRadius: 3, padding: "1px 5px" }}>{a.stakeholder}</span>}
                </div>
                <button onClick={() => deleteAction(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <input value={actionText} onChange={(e) => setActionText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAction()}
                placeholder="Add action…" style={{ ...sInput, flex: 2 }} />
              <input value={actionStakeholder} onChange={(e) => setActionStakeholder(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAction()}
                placeholder="Who?" style={{ ...sInput, flex: 1 }} />
              <button onClick={addAction} style={{ ...g.btn, padding: "4px 8px", fontSize: 12, flexShrink: 0 }}>+</button>
            </div>
          </div>

          {/* ── ACTIVITY LOG ── */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Activity log</div>
            {log.length === 0 && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontStyle: "italic" }}>No activity yet</div>}
            {visibleLog.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
                <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", marginTop: 1, minWidth: 40 }}>{fmtLogDate(entry.date)}</span>
                <span style={{ fontSize: 11, color: "var(--sub)", lineHeight: 1.4 }}>{entry.text}</span>
              </div>
            ))}
            {log.length > 4 && (
              <button onClick={() => setShowAllLog(!showAllLog)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 10, padding: "2px 0", fontFamily: "inherit" }}>
                {showAllLog ? "Show less ↑" : `Show ${log.length - 4} more ↓`}
              </button>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <input value={logInput} onChange={(e) => setLogInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLog()}
                placeholder="Log a note…" style={sInput} />
              <button onClick={addLog} style={{ ...g.btn, padding: "4px 8px", fontSize: 12, flexShrink: 0 }}>↵</button>
            </div>
          </div>

          {/* ── BOTTOM ACTIONS ── */}
          {!logging ? (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: `1px solid var(--line)` }}>
              <button style={g.btn} onClick={() => setLogging(true)}>✓ Log touch</button>
              <button style={g.btnBlue} onClick={() => onDraft(contact)}>Draft outreach ↗</button>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: "4px 5px", fontFamily: "inherit" }} onClick={() => onEdit(contact)}>✎</button>
              {!confirmDelete
                ? <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--line)", fontSize: 13, padding: "4px 5px", fontFamily: "inherit" }} onClick={() => setConfirmDelete(true)}>✕</button>
                : <span style={{ fontSize: 11, color: BCG.red500 }}>Delete? <button style={{ ...g.btn, fontSize: 10, color: BCG.red500, borderColor: BCG.red300 }} onClick={() => onDelete(contact.id)}>Yes</button> <button style={{ ...g.btn, fontSize: 10 }} onClick={() => setConfirmDelete(false)}>No</button></span>
              }
            </div>
          ) : (
            <div style={{ paddingTop: 8, borderTop: `1px solid var(--line)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Date</div>
                <input type="date" style={{ ...g.formInput, width: "auto", fontSize: 11, padding: "3px 7px" }}
                  value={logDate} max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setLogDate(e.target.value)} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Type of contact</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {CONTACT_TYPES.map((t) => (
                  <button key={t} style={{ ...g.btn, background: "var(--badge-green-bg)", borderColor: BCG.green400, color: "var(--badge-green-text)" }}
                    onClick={() => handleLogTouch(t)}>
                    {contactTypeIcon[t]} {t}
                  </button>
                ))}
                <button style={{ ...g.btn, color: "var(--muted)" }} onClick={() => setLogging(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RelationshipsView({ contacts, setContacts, ctx }) {
  const [draftContact, setDraftContact] = useState(null);
  const [editContact, setEditContact] = useState(null); // null | contact | "new"
  const logTouch = (id, contactType = "Meeting", date = null) => setContacts((cs) => cs.map((c) => c.id === id ? { ...c, lastContact: date ? new Date(date).toISOString() : new Date().toISOString(), lastContactType: contactType } : c));
  const updateContact = (id, patch) => setContacts((cs) => cs.map((c) => c.id === id ? { ...c, ...patch } : c));
  const saveContact = (updated) => setContacts((cs) => cs.some((c) => c.id === updated.id) ? cs.map((c) => c.id === updated.id ? updated : c) : [...cs, updated]);
  const deleteContact = (id) => setContacts((cs) => cs.filter((c) => c.id !== id));
  const overdue = contacts.filter((c) => daysSince(c.lastContact) > CADENCE_DAYS[c.targetCadence]).sort((a, b) => daysSince(b.lastContact) - daysSince(a.lastContact));
  const sorted = [...contacts].sort((a, b) => (daysSince(b.lastContact) / CADENCE_DAYS[b.targetCadence]) - (daysSince(a.lastContact) / CADENCE_DAYS[a.targetCadence]));
  return (
    <div>
      {editContact && (
        <EditContactModal
          contact={editContact === "new" ? null : editContact}
          onSave={saveContact}
          onClose={() => setEditContact(null)}
        />
      )}
      {draftContact && <ContactOutreachPanel contact={draftContact} ctx={ctx} onClose={() => setDraftContact(null)} />}
      {overdue.length > 0 && (
        <div style={g.reconQueue}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: BCG.red500, marginBottom: 10 }}>⚑ Reconnect queue — {overdue.length} overdue</div>
          {overdue.slice(0, 5).map((c) => (
            <div key={c.id} style={{ ...g.reconItem, borderColor: c === overdue[overdue.length - 1] ? "transparent" : "var(--line)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>{c.title} · {c.company}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ ...g.tag, background: "var(--badge-red-bg)", color: "var(--badge-red-text)" }}>{daysSince(c.lastContact)}d</span>
                <button style={g.btnBlue} onClick={(e) => { e.stopPropagation(); setDraftContact(c); }}>Draft ↗</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={g.sectionTitle}>All relationships ({contacts.length})</div>
        <button style={{ ...g.btnBlue, fontSize: 11, padding: "5px 12px" }} onClick={() => setEditContact("new")}>+ Add contact</button>
      </div>
      <div style={g.contactGrid}>
        {sorted.map((c) => <ContactCard key={c.id} contact={c} onLogTouch={logTouch} onDraft={setDraftContact} onEdit={setEditContact} onDelete={deleteContact} onUpdateContact={updateContact} />)}
      </div>
    </div>
  );
}

function CoachView({ deals, contacts }) {
  // Always recompute ctx from live deals/contacts — never rely on a prop that might be a stale closure
  const ctx = useMemo(() => buildCtx(deals, contacts), [deals, contacts]);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [inited, setInited] = useState(false);
  const [calSummary, setCalSummary] = useState("");
  const [emailSummary, setEmailSummary] = useState("");
  const [calLoading, setCalLoading] = useState(false);
  const [calInput, setCalInput] = useState("");
  const [calOpen, setCalOpen] = useState(true);
  const [prepBriefs, setPrepBriefs] = useState({});
  const [prepLoading, setPrepLoading] = useState({});
  const [magicMoments, setMagicMoments] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadOutlookCalendar = async () => {
    setCalLoading(true);
    // Always try data.json first (source of truth), then fall back to localStorage
    const getStored = async (key) => {
      try {
        const r = await fetch("/data.json?t=" + Date.now());
        if (r.ok) {
          const json = await r.json();
          const val = json[key];
          if (val) { window.storage.set(key, val); return val; }
        }
      } catch {}
      try {
        const { value } = await window.storage.get(key);
        return value;
      } catch { return null; }
    };
    try {
      const [calVal, emailVal] = await Promise.all([
        getStored("pc:m365calendar"),
        getStored("pc:m365emails"),
      ]);
      if (!calVal) throw new Error("not found");
      setCalSummary(calVal);
      if (emailVal) setEmailSummary(emailVal);
      setCalInput("");
    } catch {
      setCalSummary("No Outlook data cached — ask Claude Code to refresh, or paste your calendar manually.");
    } finally {
      setCalLoading(false);
    }
  };

  const handleScreenshotUpload = async (file) => {
    if (!file) return;
    setCalLoading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 600,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: file.type || "image/png", data: base64 } },
            { type: "text", text: "Extract all calendar events from this screenshot. For each: title, day, start–end time, key attendees (up to 3). Flag meetings with senior clients/CCOs/VPs as '★ COMMERCIAL:' and free blocks 45+ min as '◯ OPEN:'. Under 300 words, clean list." }
          ]}],
        }),
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      setCalSummary(data.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    } catch (e) {
      setCalSummary(`Could not read screenshot (${e.message}). Paste your meetings as text instead.`);
    } finally {
      setCalLoading(false);
    }
  };

  const getMagicMoments = async () => {
    if (!calSummary || magicLoading) return;
    setMagicLoading(true);
    try {
      const result = await callAI(
        [{ role: "user", content: `Look at my calendar and free blocks this week. Identify the top 2-3 "magic moments" — open time slots I should use strategically.\n\nCross-reference the CALENDAR with the RECENT INBOX in your context. Use email threads to understand what each meeting is actually about and who's really involved — the invite title alone can be misleading. If a meeting title sounds client-facing but the attendee list is all BCG, it's internal. If an email thread shows a client is actively engaged on a topic tied to a meeting, flag that.\n\nBefore surfacing prep time for a meeting, filter ruthlessly: small group or 1:1 with a named client decision-maker = worth it. All-BCG attendee list, large group where I'm one of many, [HOLD]/[TBR] tagged, or a block = skip it. Don't recommend prep for meetings where I'm a passenger.\n\nFor each magic moment: name the exact time block, then give one concrete action tied to a real commercial or relationship move. Reference specific people, deals, or email threads. No generic suggestions.` }],
        buildSys(ctx, calSummary, emailSummary)
      );
      setMagicMoments(result);
    } catch {
      setMagicMoments("Unable to generate — check API connection.");
    } finally {
      setMagicLoading(false);
    }
  };

  const getPrep = async (meetingLine) => {
    if (prepLoading[meetingLine]) return;
    setPrepLoading((p) => ({ ...p, [meetingLine]: true }));
    try {
      const brief = await callAI(
        [{ role: "user", content: `Generate a prep brief for this meeting: "${meetingLine}"\n\nStep 1 — CROSS-REFERENCE: Check the RECENT INBOX in your context for any email threads related to this meeting. Look for: the same people, the same client/topic, any pre-read materials, or recent exchanges that reveal what's really at stake. The email thread tells you more than the invite title.\n\nStep 2 — CLASSIFY: Is this meeting internal (all-BCG attendees) or client-facing (at least one named external stakeholder)? Use both the attendee list AND any related email threads to determine this. If it's internal, say so clearly.\n\nStep 3 — ASSESS INFLUENCE: Is Trevor presenting or owning an agenda item? Small group with a decision-maker? Or a crowded sync where he's one of many? Tagged [HOLD]/[TBR]?\n\nIf influence is LOW or this is an internal meeting, say so in one sentence and give the ONE thing Trevor could do to make it count (e.g., a question to ask, a follow-up to plant).\n\nIf influence is HIGH and client-facing, give a full brief:\n1. What the email thread reveals about what's really at stake (1-2 sentences)\n2. What to accomplish — not just discuss (2-3 bullets)\n3. 2-3 sharp questions that signal MDP-level thinking\n4. One insight or "so what" the client hasn't heard\n5. Concrete next commercial step to propose` }],
        buildSys(ctx, calSummary, emailSummary)
      );
      setPrepBriefs((p) => ({ ...p, [meetingLine]: brief }));
    } catch {
      setPrepBriefs((p) => ({ ...p, [meetingLine]: "API error — check connection." }));
    } finally {
      setPrepLoading((p) => ({ ...p, [meetingLine]: false }));
    }
  };

  // Load chat history
  useEffect(() => {
    const load = async () => {
      try { const r = await window.storage.get("pc:chat"); setMsgs(JSON.parse(r.value)); } catch {}
      setInited(true);
    };
    load();
  }, []);

  // Calendar is entered manually — no auto-fetch

  // Save chat + scroll
  useEffect(() => {
    if (!inited) return;
    if (msgs.length > 0) window.storage.set("pc:chat", JSON.stringify(msgs.slice(-40))).catch(() => {});
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, inited]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const isEmailTriage = /triage.*email|email.*triage|check.*email|my emails/i.test(text);
    const userMsg = { role: "user", content: text.trim() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      let reply;
      if (isEmailTriage) {
        let emailCtx = "";
        try {
          let emailVal;
          try { ({ value: emailVal } = await window.storage.get("pc:m365emails")); }
          catch {
            const r = await fetch("/data.json");
            if (r.ok) { const j = await r.json(); emailVal = j["pc:m365emails"]; if (emailVal) window.storage.set("pc:m365emails", emailVal); }
          }
          if (emailVal) emailCtx = `\n\nRECENT INBOX (via Outlook):\n${emailVal}`;
        } catch {}
        const triagePrompt = `${text}${emailCtx}\n\n1. Flag any emails from CCOs, VP+, or senior clients that need a personal response from me — list sender and subject\n2. Identify commercial signals: clients mentioning problems, budget cycles, or new initiatives\n3. Flag anything time-sensitive or requiring action today\nFor each flagged item, draft a brief 2-3 sentence suggested response in a direct, senior voice.${emailCtx ? "" : "\n\n(No live Outlook data — ask Claude Code to refresh, or summarize based on context.)"}`;
        const history = [...msgs, { role: "user", content: triagePrompt }].slice(-12).map((m) => ({ role: m.role, content: m.content }));
        reply = await callAI(history, buildSys(ctx, calSummary, emailSummary));
      } else {
        const history = [...msgs, userMsg].slice(-12).map((m) => ({ role: m.role, content: m.content }));
        reply = await callAI(history, buildSys(ctx, calSummary, emailSummary));
      }
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `API error: ${e.message}` }]);
    }
    setLoading(false);
  };

  // Extract meeting lines for per-meeting prep — filter for lines with time/day markers, skip gap lines
  const meetingLines = calSummary
    ? calSummary
        .split("\n")
        .filter((l) => l.trim().length > 12 && /\d|AM|PM|monday|tuesday|wednesday|thursday|friday/i.test(l) && !/◯ OPEN|free block|gap/i.test(l))
        .slice(0, 6)
    : [];

  return (
    <div style={g.chatWrap}>
      {/* Calendar panel */}
      <div style={{ background: "var(--bg-card)", border: `1px solid var(--line)`, borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
        <button
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", width: "100%", cursor: "pointer", border: "none", background: "none", fontFamily: "inherit", borderBottom: calOpen ? `1px solid var(--line)` : "none" }}
          onClick={() => setCalOpen((o) => !o)}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sub)" }}>
            {calLoading ? "Reading screenshot…" : calSummary ? "This week ✓" : "This week — add manually"}
          </div>
          <span style={{ fontSize: 10, color: "var(--muted)" }}>{calOpen ? "▲" : "▼"}</span>
        </button>
        {calOpen && (
          <div style={{ padding: "12px 14px" }}>
            {calLoading && <Dots />}
            {!calLoading && !calSummary && (
              <div>
                <textarea
                  style={{ ...g.textarea, width: "100%", minHeight: 72, fontSize: 12, marginBottom: 8 }}
                  value={calInput}
                  onChange={(e) => setCalInput(e.target.value)}
                  placeholder={"Paste or type your meetings for the week:\n  Mon 9–10am: Colgate sync (Caroline Chulick)\n  Tue 2–3pm: Google review (Alannah Sheerin)"}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={g.btnBlue} onClick={loadOutlookCalendar}>Load from Outlook ↓</button>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>or</span>
                  <button style={g.btnBlue} disabled={!calInput.trim()} onClick={() => { setCalSummary(calInput.trim()); setCalInput(""); }}>
                    Use this ↓
                  </button>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>or</span>
                  <button style={g.btn} onClick={() => fileInputRef.current?.click()}>Upload screenshot 📷</button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleScreenshotUpload(e.target.files?.[0])} />
                </div>
              </div>
            )}
            {calSummary && !calLoading && (
              <div>
                <div style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>{calSummary}</div>
                {meetingLines.length > 0 && (
                  <div style={{ borderTop: `1px solid var(--line)`, paddingTop: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8 }}>Meeting prep</div>
                    {meetingLines.map((line, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <button
                          style={{ ...g.btn, fontSize: 11, textAlign: "left" }}
                          onClick={() => getPrep(line)}
                          disabled={!!prepLoading[line]}
                        >
                          {prepLoading[line] ? "Generating…" : "Prep →"}&nbsp;{line.length > 72 ? line.slice(0, 72) + "…" : line}
                        </button>
                        {prepBriefs[line] && (
                          <div style={{ ...g.draftBox, marginTop: 6, fontSize: 12 }}>{prepBriefs[line]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ borderTop: `1px solid var(--line)`, paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: magicMoments ? 8 : 0 }}>
                    <button style={{ ...g.btnBlue, fontSize: 11 }} onClick={getMagicMoments} disabled={magicLoading}>
                      {magicLoading ? "Thinking…" : "✦ Magic moments"}
                    </button>
                    <button style={{ ...g.btn, fontSize: 11 }} onClick={loadOutlookCalendar}>
                      Refresh Outlook ↺
                    </button>
                    <button style={{ ...g.btn, fontSize: 11 }} onClick={() => { setCalSummary(""); setMagicMoments(""); setPrepBriefs({}); }}>
                      Clear ✕
                    </button>
                  </div>
                  {magicMoments && <div style={{ ...g.draftBox, fontSize: 12 }}>{magicMoments}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Position card (empty chat only) */}
      {msgs.length === 0 && (
        <div style={{ background: "var(--won-bg)", borderRadius: 8, padding: "14px 16px", marginBottom: 18, border: `1px solid var(--won-line)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--won-text)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your position today</div>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>
            YTD Won: <strong style={{ color: BCG.green400 }}>{ctx.ytdWon}</strong> · Pipeline: <strong style={{ color: "#93c5fd" }}>{ctx.weighted}</strong> · <strong style={{ color: ctx.paceStatus === "BEHIND_PACE" ? BCG.red300 : BCG.orange400 }}>{ctx.pace}% to $14M</strong>
            {ctx.staleContacts.length > 0 && <> · <strong style={{ color: BCG.red500 }}>{ctx.staleContacts.length} relationships overdue</strong></>}
            {ctx.staleDeals.length > 0 && <> · <strong style={{ color: BCG.orange400 }}>{ctx.staleDeals.length} deals gone stale</strong></>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={g.qpWrap} >
          {QUICK_PROMPTS.map((p, i) => <button key={i} style={g.qpBtn} onClick={() => send(p)}>{p}</button>)}
        </div>
        {msgs.length > 0 && (
          <button style={{ ...g.btn, fontSize: 10, flexShrink: 0, marginLeft: 8, color: "var(--muted)" }} onClick={() => { setMsgs([]); window.storage.set("pc:chat", JSON.stringify([])).catch(() => {}); }}>
            Clear chat ↺
          </button>
        )}
      </div>
      {msgs.map((m, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4, textAlign: m.role === "user" ? "right" : "left" }}>
            {m.role === "user" ? "You" : "Coach"}
          </div>
          <div style={{ textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{ ...g.bubble, ...(m.role === "user" ? g.userBubble : g.aiBubble) }}>{m.content}</div>
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Coach</div>
          <div style={{ background: "var(--bg-card)", border: `1px solid var(--line)`, borderRadius: "4px 10px 10px 10px", display: "inline-block" }}><Dots /></div>
        </div>
      )}
      <div ref={bottomRef} />
      <div style={g.inputRow}>
        <textarea
          style={g.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask your coach anything — or tap a quick prompt above..."
          rows={2}
        />
        <button style={{ ...g.sendBtn, opacity: loading || !input.trim() ? 0.4 : 1 }} disabled={loading || !input.trim()} onClick={() => send(input)}>
          {loading ? "..." : "Send →"}
        </button>
      </div>
    </div>
  );
}

function SyncSetupModal({ onClose, onSaved }) {
  const [token, setToken] = useState(getGistToken());
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");

  const save = async () => {
    const t = token.trim();
    if (!t) return;
    setTesting(true); setStatus("");
    try {
      // Verify token works by fetching user info
      const r = await fetch("https://api.github.com/user", { headers: gistHeaders(t) });
      if (!r.ok) throw new Error(`GitHub said: ${r.status} — check the token`);
      const user = await r.json();
      localStorage.setItem(GIST_TOKEN_KEY, t);
      setStatus(`✓ Connected as ${user.login}`);
      setTimeout(() => { onSaved(t); onClose(); }, 800);
    } catch (e) {
      setStatus(`⚠ ${e.message}`);
    } finally { setTesting(false); }
  };

  const disconnect = () => {
    localStorage.removeItem(GIST_TOKEN_KEY);
    localStorage.removeItem(GIST_ID_KEY);
    onSaved("");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 28, width: "100%", maxWidth: 440, border: `1px solid var(--line)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>⟳ Cross-device sync</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--muted)" }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.7, marginBottom: 20 }}>
          Sync uses a <strong>private GitHub Gist</strong> as your database — your data lives in your own GitHub account and syncs automatically across all devices.
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--sub)", marginBottom: 6 }}>GitHub Personal Access Token</div>
        <input
          style={{ ...g.formInput, marginBottom: 8, fontSize: 12, fontFamily: "monospace" }}
          type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={token} onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        {status && <div style={{ fontSize: 12, color: status.startsWith("✓") ? BCG.green400 : BCG.red300, marginBottom: 10 }}>{status}</div>}
        <button
          style={{ ...g.btnBlue, width: "100%", padding: "9px 16px", fontSize: 13, opacity: testing || !token.trim() ? 0.5 : 1, marginBottom: 10 }}
          onClick={save} disabled={testing || !token.trim()}>
          {testing ? "Verifying…" : "Connect & enable sync →"}
        </button>
        {getGistToken() && <button onClick={disconnect} style={{ ...g.btn, width: "100%", fontSize: 12, color: "var(--muted)" }}>Disconnect sync</button>}
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, lineHeight: 1.7, borderTop: `1px solid var(--line)`, paddingTop: 14 }}>
          <strong>How to get a token:</strong><br />
          1. Go to <strong>github.com/settings/tokens</strong><br />
          2. Click <strong>"Generate new token (classic)"</strong><br />
          3. Give it any name, check only the <strong>"gist"</strong> scope<br />
          4. Copy and paste the token above
        </div>
      </div>
    </div>
  );
}

function ApiKeyGate({ children }) {
  const [key, setKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const save = async () => {
    const k = input.trim();
    if (!k.startsWith("sk-ant-")) { setError("Key should start with sk-ant-"); return; }
    setTesting(true);
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      localStorage.setItem(API_KEY_STORAGE, k);
      setKey(k);
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const clear = () => { localStorage.removeItem(API_KEY_STORAGE); setKey(""); setInput(""); };

  if (key) return (
    <>
      {children}
      <div style={{ position: "fixed", bottom: 12, right: 14, zIndex: 100 }}>
        <button onClick={clear} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, border: `1px solid var(--line)`, background: "var(--bg-card)", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
          Clear API key
        </button>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 32, width: "100%", maxWidth: 440, border: `1px solid var(--line)` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BCG.green500, marginBottom: 6 }}>BCG · Partner Copilot</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Enter your Anthropic API key</div>
        <div style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.6, marginBottom: 20 }}>
          Your key is stored only in this browser's localStorage and sent directly to Anthropic. It is never stored on any server.
        </div>
        <input
          style={{ ...g.formInput, marginBottom: 8, fontSize: 13, fontFamily: "monospace" }}
          type="password"
          placeholder="sk-ant-api03-..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          autoFocus
        />
        {error && <div style={{ fontSize: 12, color: BCG.red500, marginBottom: 10 }}>{error}</div>}
        <button
          style={{ ...g.btnBlue, width: "100%", padding: "10px 16px", fontSize: 14, opacity: testing || !input.trim() ? 0.5 : 1 }}
          onClick={save}
          disabled={testing || !input.trim()}
        >
          {testing ? "Verifying…" : "Connect →"}
        </button>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, lineHeight: 1.6 }}>
          Get a key at <strong>console.anthropic.com</strong> → API Keys. You need a key with access to <code>claude-sonnet-4-6</code>.
        </div>
      </div>
    </div>
  );
}

function PartnerCopilotApp() {
  const [view, setView] = useState("pipeline");
  const [deals, setDeals] = useState(null);
  const [contacts, setContacts] = useState(null);
  const [inited, setInited] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("pc:dark") === "true");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | error
  const [gistToken, setGistToken] = useState(() => getGistToken());
  const [showSyncModal, setShowSyncModal] = useState(false);
  const syncTimer = useRef(null);
  const toggleDark = () => setDark((d) => { const next = !d; localStorage.setItem("pc:dark", next); return next; });

  // ── LOAD: try Gist first, fall back to localStorage ──────────────────────
  useEffect(() => {
    const load = async () => {
      let d, c;
      const token = getGistToken();
      const id    = getGistId();
      if (token && id) {
        try {
          setSyncStatus("syncing");
          const remote = await gistLoad(token, id);
          d = remote.deals;
          c = remote.contacts;
          // Persist locally too
          localStorage.setItem("pc:deals",    JSON.stringify(d));
          localStorage.setItem("pc:contacts", JSON.stringify(c));
          setSyncStatus("ok");
        } catch {
          setSyncStatus("error");
        }
      }
      if (!d) { try { const r = await window.storage.get("pc:deals");    d = JSON.parse(r.value); } catch { d = SEED_DEALS; } }
      if (!c) { try { const r = await window.storage.get("pc:contacts"); c = JSON.parse(r.value); } catch { c = SEED_CONTACTS; } }
      setDeals(d); setContacts(c); setInited(true);
    };
    load();
  }, []);

  // ── SAVE: debounced push to Gist + localStorage on every change ──────────
  useEffect(() => {
    if (!inited || !deals || !contacts) return;
    window.storage.set("pc:deals", JSON.stringify(deals)).catch(() => {});
    const token = getGistToken();
    if (!token) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        let id = getGistId();
        if (!id) {
          // First time — auto-create the Gist
          id = await gistCreate(token, { deals, contacts });
          localStorage.setItem(GIST_ID_KEY, id);
        }
        await gistSave(token, id, { deals, contacts });
        setSyncStatus("ok");
      } catch { setSyncStatus("error"); }
    }, 1500);
  }, [deals, contacts, inited]);

  useEffect(() => { if (inited && contacts) window.storage.set("pc:contacts", JSON.stringify(contacts)).catch(() => {}); }, [contacts, inited]);

  if (!inited || !deals || !contacts) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--sub)", fontSize: 13, background: "var(--bg-app)", minHeight: "100vh" }}>Loading Partner Copilot…</div>;
  }

  const ctx = buildCtx(deals, contacts);

  return (
    <div data-theme={dark ? "dark" : "light"} style={g.app}>
      <style>{THEME_CSS}</style>
      {showSyncModal && <SyncSetupModal onClose={() => setShowSyncModal(false)} onSaved={(t) => setGistToken(t)} />}
      <Header ctx={ctx} dark={dark} onToggleDark={toggleDark} syncStatus={syncStatus} onOpenSync={() => setShowSyncModal(true)} />
      <NavTabs view={view} setView={setView} />
      <div style={g.content}>
        {view === "pipeline" && <PipelineView deals={deals} setDeals={setDeals} ctx={ctx} />}
        {view === "relationships" && <RelationshipsView contacts={contacts} setContacts={setContacts} ctx={ctx} />}
        {view === "coach" && <CoachView deals={deals} contacts={contacts} />}
      </div>
    </div>
  );
}

export default function PartnerCopilot() {
  return <ApiKeyGate><PartnerCopilotApp /></ApiKeyGate>;
}
