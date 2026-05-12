import { useState, useEffect, useRef } from "react";
import {
  FileText, Shield, Bell, Settings, LayoutDashboard, Upload,
  AlertTriangle, Clock, CheckCircle, Search, X, Calendar,
  ArrowLeft, ChevronDown, ChevronUp, AlertCircle, Loader2,
  TrendingUp, Plus, Download, MoreHorizontal, ChevronRight, Zap
} from "lucide-react";

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
function useGlobalStyles() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      *, *::before, *::after { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse-soft { 0%,100%{opacity:1} 50%{opacity:.45} }
      @keyframes fadeUp { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
      @keyframes scaleIn { from { opacity:0; transform:scale(.97); } to { opacity:1; transform:scale(1); } }
      .spin { animation: spin 1s linear infinite; }
      .pulse { animation: pulse-soft 1.8s ease-in-out infinite; }
      .fade-up { animation: fadeUp .2s ease-out forwards; }
      .scale-in { animation: scaleIn .18s ease-out forwards; }
      .row-hover:hover { background: #f8fafc !important; }
      .nav-btn { transition: background .12s, color .12s; }
      .clause-card { transition: box-shadow .15s; }
      .clause-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,.09); }
      .icon-btn:hover { background: #f1f5f9; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: #334155; border-radius: 99px; }
      ::-webkit-scrollbar-track { background: transparent; }
      input, select, button { font-family: inherit; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(link); document.head.removeChild(style); };
  }, []);
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const CONTRACTS = [
  {
    id: 1, name: "Acme Corp — Software License Agreement", type: "Software License",
    uploadDate: "Apr 10, 2025", expiryDate: "Jun 15, 2025", daysLeft: 54,
    riskLevel: "Critical", riskScore: 87, status: "Complete",
    clauses: [
      {
        id: 1, type: "Indemnification", severity: "Critical",
        rawText: "Licensee shall indemnify, defend, and hold harmless Licensor and its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from Licensee's use of the Software or breach of this Agreement...",
        summary: "You're on the hook for all legal costs if anything goes wrong on your end — including third-party lawsuits. This is unusually broad, one-sided language that puts most of the risk squarely on you.",
        action: "Negotiate a mutual indemnification clause or add a hard cap on your total liability exposure before signing."
      },
      {
        id: 2, type: "Auto-Renewal", severity: "High",
        rawText: "This Agreement shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least ninety (90) days prior to the expiration of the then-current term. Notice must be sent via certified mail to the address on file...",
        summary: "The contract auto-renews each year. You must cancel in writing, 90 days before the end date. Miss that window and you're locked in for another full year — no exceptions.",
        action: "Set a hard calendar reminder for February 15 — 120 days before your June 15 expiry. Don't rely on memory."
      },
      {
        id: 3, type: "IP Assignment", severity: "Critical",
        rawText: "Any modifications, enhancements, derivative works, or improvements to the Software created by Licensee shall automatically become the exclusive intellectual property of Licensor, without further action or compensation to Licensee...",
        summary: "Anything your team builds using or touching this software automatically belongs to the vendor. If your engineers customize or extend it, you lose ownership of that work permanently.",
        action: "Request a carve-out clause protecting your own derivative work. This is non-negotiable for most engineering teams."
      },
      {
        id: 4, type: "Liability Cap", severity: "High",
        rawText: "In no event shall Licensor's total cumulative liability exceed the aggregate fees paid by Licensee in the twelve (12) months immediately preceding the claim giving rise to such liability, regardless of the form of action...",
        summary: "If the vendor causes major damage to your business, the most you can recover is what you paid them in the past year. Your actual losses could be ten or a hundred times more.",
        action: "Review your financial exposure. If this vendor is business-critical, negotiate a higher cap proportionate to your potential losses."
      },
      {
        id: 5, type: "Governing Law", severity: "Low",
        rawText: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law provisions. Each party consents to exclusive jurisdiction of courts located in New Castle County, Delaware...",
        summary: "Legal disputes are handled under Delaware law, in Delaware courts. Standard for US software companies — low risk unless you strongly prefer your local jurisdiction.",
        action: "No action required unless your legal counsel advises otherwise."
      }
    ],
    deadlines: [
      { label: "Cancel-by Deadline", date: "Mar 17, 2025", daysFrom: -36, type: "overdue" },
      { label: "Payment Due", date: "May 1, 2025", daysFrom: 9, type: "urgent" },
      { label: "Contract Expiry", date: "Jun 15, 2025", daysFrom: 54, type: "upcoming" }
    ]
  },
  { id: 2, name: "Stripe — Payment Processing MSA", type: "Master Service Agreement", uploadDate: "Mar 22, 2025", expiryDate: "Mar 22, 2026", daysLeft: 334, riskLevel: "Medium", riskScore: 44, status: "Complete", clauses: [], deadlines: [] },
  { id: 3, name: "AWS Enterprise Agreement", type: "Enterprise License", uploadDate: "Apr 1, 2025", expiryDate: "May 20, 2025", daysLeft: 28, riskLevel: "High", riskScore: 71, status: "Expiring Soon", clauses: [], deadlines: [] },
  { id: 4, name: "WeWork — Office Lease 2025", type: "Commercial Lease", uploadDate: "Feb 14, 2025", expiryDate: "Dec 31, 2025", daysLeft: 253, riskLevel: "High", riskScore: 68, status: "Complete", clauses: [], deadlines: [] },
  { id: 5, name: "Figma — Design Platform License", type: "SaaS Subscription", uploadDate: "Apr 18, 2025", expiryDate: "Apr 18, 2026", daysLeft: 361, riskLevel: "Low", riskScore: 18, status: "Complete", clauses: [], deadlines: [] },
  { id: 6, name: "Notion Labs — Team Workspace", type: "SaaS Subscription", uploadDate: "Apr 19, 2025", expiryDate: "Oct 19, 2025", daysLeft: 180, riskLevel: "Low", riskScore: 22, status: "Analyzing", clauses: [], deadlines: [] }
];

// ─── RISK CONFIG ──────────────────────────────────────────────────────────────
const RISK = {
  Critical: { badgeBg: "#DC2626", badgeText: "#fff", lightBg: "#fef2f2", lightText: "#b91c1c", border: "#DC2626", accentBorder: "#fca5a5" },
  High:     { badgeBg: "#EA580C", badgeText: "#fff", lightBg: "#fff7ed", lightText: "#c2410c", border: "#F97316", accentBorder: "#fdba74" },
  Medium:   { badgeBg: "#D97706", badgeText: "#fff", lightBg: "#fffbeb", lightText: "#92400e", border: "#F59E0B", accentBorder: "#fcd34d" },
  Low:      { badgeBg: "#16A34A", badgeText: "#fff", lightBg: "#f0fdf4", lightText: "#15803d", border: "#22C55E", accentBorder: "#86efac" },
};
const STATUS_STYLE = {
  Complete:      { bg: "#f1f5f9", color: "#475569" },
  Analyzing:     { bg: "#dbeafe", color: "#1d4ed8" },
  "Expiring Soon": { bg: "#fef2f2", color: "#b91c1c" },
};

// ─── ATOMS ────────────────────────────────────────────────────────────────────
function RiskBadge({ level, large }) {
  const r = RISK[level] || RISK.Low;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: r.badgeBg, color: r.badgeText, fontSize: large ? 13 : 11, fontWeight: 700, borderRadius: 99, padding: large ? "5px 14px" : "3px 9px", letterSpacing: "0.2px" }}>
      {level}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Complete;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "3px 10px" }}>
      {status === "Analyzing" && <Loader2 size={10} className="spin" />}
      {status === "Expiring Soon" && <Clock size={10} />}
      {status === "Complete" && <CheckCircle size={10} />}
      {status}
    </span>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, onNav, onUpload }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "contracts", label: "All Contracts", icon: FileText },
    { id: "alerts", label: "Alerts", icon: Bell, badge: 3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  return (
    <div style={{ width: 220, minWidth: 220, background: "#0F172A", display: "flex", flexDirection: "column", height: "100vh", flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
          <div style={{ background: "#2563EB", borderRadius: 8, padding: "6px 7px", display: "flex" }}>
            <Shield size={15} color="#fff" />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.4px" }}>ClauseGuardian</span>
        </div>
        <span style={{ color: "#475569", fontSize: 10, fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase" }}>Solvexis Engineering</span>
      </div>

      {/* Upload CTA */}
      <div style={{ padding: "14px 12px 6px" }}>
        <button onClick={onUpload} style={{ width: "100%", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" }}>
          <Plus size={14} /> Upload Contract
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
        {nav.map(({ id, label, icon: Icon, badge }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNav(id)} className="nav-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 7, marginBottom: 2, border: "none", cursor: "pointer", background: isActive ? "rgba(37,99,235,.2)" : "transparent", color: isActive ? "#93C5FD" : "#64748B", fontSize: 13, fontWeight: isActive ? 600 : 400, textAlign: "left" }}>
              <Icon size={15} />
              <span style={{ flex: 1 }}>{label}</span>
              {badge && <span style={{ background: "#DC2626", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 7px" }}>{badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>AC</div>
        <div>
          <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>Alex Chen</div>
          <div style={{ color: "#475569", fontSize: 11 }}>Ops Lead · Free Plan</div>
        </div>
      </div>
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconColor, iconBg }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", lineHeight: 1, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>{sub}</div>}
        </div>
        <div style={{ background: iconBg, borderRadius: 10, padding: 10 }}>
          <Icon size={17} color={iconColor} />
        </div>
      </div>
    </div>
  );
}

// ─── RISK GAUGE ───────────────────────────────────────────────────────────────
function RiskGauge({ score, riskLevel }) {
  const r = RISK[riskLevel] || RISK.Low;
  const radius = 54, circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 8 }}>
      <svg width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle cx="72" cy="72" r={radius} fill="none" stroke={r.border} strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 72 72)" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
        <text x="72" y="66" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 32, fontWeight: 800, fill: "#0F172A", fontFamily: "'IBM Plex Mono', monospace" }}>{score}</text>
        <text x="72" y="90" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}>/ 100</text>
      </svg>
      <RiskBadge level={riskLevel} large />
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, fontWeight: 500 }}>Overall Risk Score</div>
    </div>
  );
}

// ─── CLAUSE CARD ──────────────────────────────────────────────────────────────
function ClauseCard({ clause, expanded, onToggle }) {
  const r = RISK[clause.severity] || RISK.Low;
  return (
    <div className="clause-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `3px solid ${r.border}`, borderRadius: "0 10px 10px 0", marginBottom: 10, overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: expanded ? 0 : 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{clause.type}</span>
            <RiskBadge level={clause.severity} />
          </div>
          {!expanded && <p style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 380, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>{clause.rawText.slice(0, 88)}…</p>}
        </div>
        <div style={{ color: "#cbd5e1", flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {expanded && (
        <div className="fade-up" style={{ padding: "0 16px 16px" }}>
          {/* Raw clause text */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "11px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 6 }}>Contract Language</div>
            <p style={{ fontSize: 11.5, color: "#475569", lineHeight: 1.75, fontFamily: "'IBM Plex Mono', monospace" }}>{clause.rawText}</p>
          </div>

          {/* Plain-language summary */}
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "11px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 6 }}>What This Means For You</div>
            <p style={{ fontSize: 13, color: "#166534", lineHeight: 1.75, fontStyle: "italic" }}>{clause.summary}</p>
          </div>

          {/* Action */}
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Zap size={14} color="#ea580c" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#c2410c", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Recommended Action</div>
              <p style={{ fontSize: 13, color: "#7c2d12", lineHeight: 1.65 }}>{clause.action}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DEADLINE TIMELINE ────────────────────────────────────────────────────────
function DeadlineTimeline({ deadlines }) {
  const typeMap = {
    overdue:  { dot: "#DC2626", label: "#DC2626", bg: "#fef2f2", tag: "⚠ Overdue" },
    urgent:   { dot: "#EA580C", label: "#c2410c", bg: "#fff7ed", tag: "Urgent" },
    upcoming: { dot: "#2563EB", label: "#1d4ed8", bg: "#eff6ff", tag: "Upcoming" },
  };
  if (!deadlines.length) return <div style={{ padding: "24px 0", color: "#94a3b8", fontSize: 13, textAlign: "center" }}>No dates extracted yet</div>;

  return (
    <div>
      {deadlines.map((d, i) => {
        const t = typeMap[d.type] || typeMap.upcoming;
        return (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 18, position: "relative" }}>
            {i < deadlines.length - 1 && <div style={{ position: "absolute", left: 6, top: 14, width: 1, height: "calc(100% + 4px)", background: "#e2e8f0" }} />}
            <div style={{ width: 13, height: 13, borderRadius: "50%", background: t.dot, flexShrink: 0, marginTop: 4, position: "relative", zIndex: 1, boxShadow: `0 0 0 3px ${t.dot}22` }} />
            <div style={{ flex: 1, background: t.bg, borderRadius: 9, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.label, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{t.tag}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" }}>{d.date}</div>
              {d.daysFrom < 0 && <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700, marginTop: 4 }}>{Math.abs(d.daysFrom)} days overdue</div>}
              {d.daysFrom > 0 && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>in {d.daysFrom} days</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef();

  const processingSteps = [
    { label: "Uploading file", icon: Upload },
    { label: "Extracting text", icon: FileText },
    { label: "Analyzing clauses", icon: Shield },
    { label: "Complete!", icon: CheckCircle },
  ];

  const start = (name) => {
    setFileName(name);
    setStep(1);
    setTimeout(() => setStep(2), 1700);
    setTimeout(() => setStep(3), 3400);
    setTimeout(() => setStep(4), 5000);
    setTimeout(() => { onClose(); onComplete && onComplete(name); }, 6400);
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) start(f.name); };
  const handleFile = (e) => { const f = e.target.files[0]; if (f) start(f.name); };
  const progress = step === 0 ? 0 : Math.min((step / 4) * 100, 100);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(3px)" }}>
      <div className="scale-in" style={{ background: "#fff", borderRadius: 16, width: 510, boxShadow: "0 24px 60px rgba(0,0,0,.28)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px" }}>Upload Contract</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>PDF or DOCX · up to 50 pages · 20MB max</p>
          </div>
          {step === 0 && <button onClick={onClose} className="icon-btn" style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: 7, cursor: "pointer", display: "flex", color: "#64748b", transition: "background .15s" }}><X size={15} /></button>}
        </div>

        <div style={{ padding: 22 }}>
          {step === 0 ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${isDragging ? "#2563EB" : "#cbd5e1"}`, borderRadius: 12, padding: "38px 28px", textAlign: "center", cursor: "pointer", background: isDragging ? "#eff6ff" : "#f8fafc", transition: "all .15s" }}
              >
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <div style={{ background: isDragging ? "#dbeafe" : "#eff6ff", borderRadius: 14, padding: 16, transition: "background .15s" }}>
                    <Upload size={28} color={isDragging ? "#1d4ed8" : "#2563EB"} />
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 5 }}>{isDragging ? "Drop to analyze" : "Drag & drop your contract"}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>or click to browse files</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                  {["PDF", "DOCX"].map(t => (
                    <span key={t} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: "0.5px" }}>{t}</span>
                  ))}
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFile} style={{ display: "none" }} />
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button onClick={() => start("vendor-nda-draft.pdf")} style={{ fontSize: 13, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Try with example contract →
                </button>
              </div>
            </>
          ) : (
            <>
              {/* File pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                <FileText size={18} color="#2563EB" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{fileName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{step < 4 ? "Processing…" : "Analysis complete"}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: step === 4 ? "#16a34a" : "#2563EB" }}>{progress.toFixed(0)}%</div>
              </div>

              {/* Progress bar */}
              <div style={{ background: "#e2e8f0", borderRadius: 99, height: 5, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: step === 4 ? "#16A34A" : "#2563EB", width: `${progress}%`, transition: "width .7s ease-out, background .4s" }} />
              </div>

              {/* Steps */}
              {processingSteps.map((s, i) => {
                const idx = i + 1;
                const done = step > idx, active = step === idx, Icon = s.icon;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 9, marginBottom: 8, background: active ? "#eff6ff" : done ? "#f0fdf4" : "#f8fafc", border: `1px solid ${active ? "#bfdbfe" : done ? "#bbf7d0" : "#e2e8f0"}`, transition: "all .3s" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "#2563EB" : done ? "#16A34A" : "#e2e8f0", flexShrink: 0, transition: "background .3s" }}>
                      {active ? <Loader2 size={13} color="#fff" className="spin" /> : done ? <CheckCircle size={13} color="#fff" /> : <Icon size={12} color="#94a3b8" />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? "#1d4ed8" : done ? "#15803d" : "#94a3b8", transition: "color .3s" }}>{s.label}</span>
                    {done && <span style={{ marginLeft: "auto", fontSize: 11, color: "#16a34a", fontWeight: 700 }}>Done</span>}
                    {active && <span className="pulse" style={{ marginLeft: "auto", fontSize: 11, color: "#2563EB" }}>Working…</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ contracts, allContracts, riskFilter, statusFilter, search, onFilter, onOpenContract, onUpload }) {
  const atRisk = allContracts.filter(c => c.riskLevel === "Critical" || c.riskLevel === "High").length;
  const expiring = allContracts.filter(c => c.daysLeft <= 30 && c.daysLeft > 0).length;

  return (
    <div style={{ padding: "30px 34px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>Your contracts, monitored 24/7 — nothing slips through.</p>
        </div>
        <button onClick={onUpload} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", boxShadow: "0 2px 10px rgba(37,99,235,.35)" }}>
          <Plus size={14} /> Upload Contract
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 26 }}>
        <StatCard label="Total Contracts" value={allContracts.length} sub={`${allContracts.filter(c => c.status === "Complete").length} fully analyzed`} icon={FileText} iconColor="#2563EB" iconBg="#eff6ff" />
        <StatCard label="At Risk" value={atRisk} sub="Critical or High severity" icon={AlertTriangle} iconColor="#EA580C" iconBg="#fff7ed" />
        <StatCard label="Expiring This Month" value={expiring} sub="Within 30 days" icon={Clock} iconColor="#D97706" iconBg="#fffbeb" />
        <StatCard label="Alerts Sent" value={8} sub="Last 30 days" icon={Bell} iconColor="#16A34A" iconBg="#f0fdf4" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "0 13px", height: 38 }}>
          <Search size={13} color="#94a3b8" />
          <input value={search} onChange={e => onFilter("search", e.target.value)} placeholder="Search contracts…" style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#0F172A", background: "transparent" }} />
          {search && <button onClick={() => onFilter("search", "")} style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex" }}><X size={13} /></button>}
        </div>
        <select value={riskFilter} onChange={e => onFilter("risk", e.target.value)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "0 13px", height: 38, fontSize: 13, color: "#475569", cursor: "pointer", outline: "none" }}>
          <option value="All">All Risk Levels</option>
          {["Critical", "High", "Medium", "Low"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => onFilter("status", e.target.value)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 9, padding: "0 13px", height: 38, fontSize: 13, color: "#475569", cursor: "pointer", outline: "none" }}>
          <option value="All">All Statuses</option>
          {["Complete", "Analyzing", "Expiring Soon"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {/* Head */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 100px 100px 110px 75px 120px 30px", padding: "10px 22px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["Contract Name", "Type", "Uploaded", "Expires", "Risk", "Days Left", "Status", ""].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{h}</div>
          ))}
        </div>

        {contracts.length === 0 ? (
          <div style={{ padding: "44px 22px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No contracts match your filters.</div>
        ) : contracts.map((c, i) => {
          const r = RISK[c.riskLevel] || RISK.Low;
          return (
            <div key={c.id} className="row-hover" onClick={() => onOpenContract(c)} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 100px 100px 110px 75px 120px 30px", alignItems: "center", padding: "13px 22px", borderBottom: i < contracts.length - 1 ? "1px solid #f1f5f9" : "none", borderLeft: `3px solid ${r.border}`, cursor: "pointer", transition: "background .1s" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.type}</div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'IBM Plex Mono', monospace" }}>{c.uploadDate}</div>
              <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: c.daysLeft < 30 ? "#dc2626" : "#64748b", fontWeight: c.daysLeft < 30 ? 700 : 400 }}>{c.expiryDate}</div>
              <div><RiskBadge level={c.riskLevel} /></div>
              <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: c.daysLeft < 30 ? 800 : 400, color: c.daysLeft < 30 ? "#dc2626" : "#475569" }}>{c.daysLeft}d</div>
              <div><StatusBadge status={c.status} /></div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><ChevronRight size={14} color="#cbd5e1" /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CONTRACT DETAIL ──────────────────────────────────────────────────────────
function ContractDetail({ contract, onBack }) {
  const [expandedClause, setExpandedClause] = useState(null);
  const toggle = (id) => setExpandedClause(p => p === id ? null : id);

  const clauseCounts = (contract.clauses || []).reduce((a, c) => { a[c.severity] = (a[c.severity] || 0) + 1; return a; }, {});

  return (
    <div style={{ padding: "28px 34px", minHeight: "100vh" }}>
      {/* Back */}
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0, fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ background: "#eff6ff", borderRadius: 12, padding: 14, flexShrink: 0 }}>
            <FileText size={24} color="#2563EB" />
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.4px" }}>{contract.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", marginTop: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}><strong style={{ color: "#475569" }}>Type:</strong> {contract.type}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}><strong style={{ color: "#475569" }}>Uploaded:</strong> {contract.uploadDate}</span>
              <span style={{ fontSize: 12, color: contract.daysLeft < 30 ? "#dc2626" : "#64748b", fontWeight: contract.daysLeft < 30 ? 600 : 400 }}>
                <strong style={{ color: "#475569", fontWeight: 600 }}>Expires:</strong> {contract.expiryDate} · {contract.daysLeft} days
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="icon-btn" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}>
            <Download size={12} /> Export
          </button>
          <button className="icon-btn" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background .15s" }}>
            <Bell size={12} /> Set Alert
          </button>
        </div>
      </div>

      {/* 2-col layout */}
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        {/* LEFT */}
        <div style={{ flex: "0 0 61%" }}>
          {/* Risk overview card */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7 }}>
              <Shield size={14} color="#64748b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Risk Overview</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "14px 20px" }}>
              <RiskGauge score={contract.riskScore} riskLevel={contract.riskLevel} />
              <div style={{ flex: 1, paddingLeft: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 14 }}>Flagged Clauses</div>
                {Object.entries(clauseCounts).map(([sev, cnt]) => {
                  const r = RISK[sev] || RISK.Low;
                  return (
                    <div key={sev} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.border, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#475569", flex: 1 }}>{sev}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", fontFamily: "'IBM Plex Mono', monospace" }}>{cnt}</span>
                    </div>
                  );
                })}
                {contract.clauses.length === 0 && <p style={{ fontSize: 13, color: "#94a3b8" }}>No clauses extracted</p>}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 9, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Total flagged</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace" }}>{contract.clauses.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clauses */}
          {contract.clauses.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
                Flagged Clauses &nbsp;<span style={{ color: "#94a3b8", fontWeight: 400 }}>— tap to expand</span>
              </div>
              {contract.clauses.map(cl => (
                <ClauseCard key={cl.id} clause={cl} expanded={expandedClause === cl.id} onToggle={() => toggle(cl.id)} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Timeline */}
        <div style={{ flex: 1 }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 7 }}>
              <Calendar size={14} color="#64748b" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Key Dates</span>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <DeadlineTimeline deadlines={contract.deadlines} />
            </div>
          </div>

          {/* Quick tip card */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, marginTop: 16, padding: "14px 18px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Quick Tip</div>
            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.65 }}>Share this analysis with your legal advisor before signing. Export as PDF using the button above.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  useGlobalStyles();

  const [view, setView] = useState("dashboard");
  const [selectedContract, setSelectedContract] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const handleFilter = (type, value) => {
    if (type === "risk") setRiskFilter(value);
    else if (type === "status") setStatusFilter(value);
    else if (type === "search") setSearch(value);
  };

  const filtered = CONTRACTS.filter(c => {
    if (riskFilter !== "All" && c.riskLevel !== riskFilter) return false;
    if (statusFilter !== "All" && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openContract = (contract) => { setSelectedContract(contract); setView("detail"); };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f1f5f9" }}>
      <Sidebar
        active={view === "detail" ? "dashboard" : view}
        onNav={v => { setView(v); setSelectedContract(null); }}
        onUpload={() => setShowUpload(true)}
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "dashboard" && (
          <Dashboard
            contracts={filtered} allContracts={CONTRACTS}
            riskFilter={riskFilter} statusFilter={statusFilter} search={search}
            onFilter={handleFilter} onOpenContract={openContract}
            onUpload={() => setShowUpload(true)}
          />
        )}
        {view === "detail" && selectedContract && (
          <ContractDetail contract={selectedContract} onBack={() => setView("dashboard")} />
        )}
      </div>
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onComplete={() => {}} />}
    </div>
  );
}