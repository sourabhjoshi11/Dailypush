import { useState, useEffect, useRef, useMemo } from "react";

// ── Constants ──────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: "standup", name: "Daily Standup", isDefault: true, color: "#6366f1",
    fields: [
      { key: "done", label: "What I accomplished", placeholder: "Completed the login page UI, fixed 3 bugs in auth flow..." },
      { key: "blockers", label: "Blockers / Issues", placeholder: "Waiting on API keys from backend team..." },
      { key: "tomorrow", label: "Upcoming tasks", placeholder: "Start working on dashboard charts..." },
    ],
    aiPrompt: "Refine this daily standup update into a concise, professional format. Keep it brief and to the point.\n\nDone: {{done}}\nBlockers: {{blockers}}\nTomorrow: {{tomorrow}}",
  },
  {
    id: "progress", name: "Progress Report", isDefault: true, color: "#06b6d4",
    fields: [
      { key: "done", label: "Accomplishments", placeholder: "Shipped v2.1 with dark mode, reviewed 4 PRs..." },
      { key: "metrics", label: "Key Metrics", placeholder: "Closed 7 tickets, 92% test coverage..." },
      { key: "learnings", label: "Key Learnings", placeholder: "Discovered a better way to handle state..." },
    ],
    aiPrompt: "Polish this progress report into a clear, professional summary. Make it engaging and highlight achievements.\n\nAccomplishments: {{done}}\nMetrics: {{metrics}}\nLearnings: {{learnings}}",
  },
  {
    id: "client", name: "Client Update", isDefault: true, color: "#8b5cf6",
    fields: [
      { key: "done", label: "Work Completed", placeholder: "Implemented the requested feature, tested on staging..." },
      { key: "status", label: "Project Status", placeholder: "On track for Friday deadline..." },
      { key: "next", label: "Next Steps", placeholder: "Deploy to production, gather feedback..." },
    ],
    aiPrompt: "Rewrite this as a polished, professional client-facing project update. Be reassuring and clear.\n\nWork Done: {{done}}\nStatus: {{status}}\nNext Steps: {{next}}",
  },
];

const API_URL = "https://dailypush-backend.onrender.com";

// ── Utility Functions ──────────────────────────────────────────────
const buildPrompt = (template, formData) => {
  let prompt = template.aiPrompt || "";
  template.fields.forEach(f => {
    prompt = prompt.replace(new RegExp(`{{${f.key}}}`, "g"), formData[f.key] || "N/A");
  });
  return prompt;
};

const parseTemplate = (raw) => {
  const lines = raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").map(l=>l.trim()).filter(Boolean);
  const fields = []; const seenKeys = new Set();
  lines.forEach(line => {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) return;
    const label = line.slice(0, colonIdx).trim();
    const placeholder = line.slice(colonIdx+1).trim();
    if (!label) return;
    let key = label.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    if (!key) return;
    if (seenKeys.has(key)) key = `${key}_${seenKeys.size}`;
    seenKeys.add(key);
    fields.push({ key, label, placeholder });
  });
  return fields;
};

// ── Styles ─────────────────────────────────────────────────────────
const styles = {
  // Layout
  body: {
    minHeight: '100vh',
    background: '#09090b',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#fafafa',
  },
  
  // Cards
  glass: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
  },
  
  glassHover: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  // Inputs
  input: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '14px 18px',
    color: '#fafafa',
    fontSize: 14,
    outline: 'none',
    transition: 'all 0.2s ease',
    width: '100%',
    fontFamily: "'Inter', sans-serif",
  },
  
  inputFocus: {
    border: '1px solid rgba(99, 102, 241, 0.5)',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
    background: 'rgba(255, 255, 255, 0.05)',
  },
  
  // Buttons
  buttonPrimary: {
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'Inter', sans-serif",
  },
  
  buttonSecondary: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#cbd5e1',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '12px 24px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', sans-serif",
  },
  
  // Typography
  heading: {
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: '#fafafa',
    fontFamily: "'Inter', sans-serif",
  },
  
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 1.6,
  },
  
  // Tags
  tag: {
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    color: '#cbd5e1',
  },
};

// ── Components ─────────────────────────────────────────────────────

const MenuDots = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#71717a', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fafafa'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, minWidth: 160, zIndex: 50, overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }}
            style={{ display: 'block', width: '100%', padding: '12px 18px', textAlign: 'left',
              background: 'none', border: 'none', color: '#d4d4d8', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Edit template</button>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }}
            style={{ display: 'block', width: '100%', padding: '12px 18px', textAlign: 'left',
              background: 'none', border: 'none', color: '#f87171', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Delete template</button>
        </div>
      )}
    </div>
  );
};

// Simple email chip input used in the compose view
const EmailInput = ({ label, chips, onChange, placeholder }) => {
  const [input, setInput] = useState("");
  const addChip = (val) => {
    const emails = String(val || "").split(/[,;\s]+/).map(e => e.trim()).filter(e => e && e.includes("@"));
    if (emails.length) onChange([...(chips || []), ...emails.filter(e => !(chips || []).includes(e))]);
    setInput("");
  };
  const removeChip = (i) => onChange((chips || []).filter((_, idx) => idx !== i));

  return (
    <div>
      <label style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, minHeight: 48, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }} onClick={e => e.currentTarget.querySelector('input')?.focus()}>
        {(chips || []).map((c, i) => (
          <span key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, padding: '6px 8px', fontSize: 13, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
            {c}
            <button onClick={() => removeChip(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (['Enter', ',', ';', 'Tab'].includes(e.key)) { e.preventDefault(); addChip(input); } if (e.key === 'Backspace' && !input && (chips || []).length) removeChip((chips || []).length - 1); }}
          onBlur={() => input && addChip(input)}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData('text')); }}
          placeholder={(chips || []).length === 0 ? placeholder : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: '#fafafa', fontSize: 14, flex: 1, minWidth: 140, fontFamily: "'Inter', sans-serif" }}
        />
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Type and press Enter or comma. Paste multiple emails at once.</p>
    </div>
  );
};

const EmptyState = ({ icon, title, description }) => (
  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
    <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
      {icon}
    </div>
    <h3 style={{ fontSize: 18, color: '#d4d4d8', marginBottom: 8, fontWeight: 500 }}>{title}</h3>
    <p style={{ fontSize: 14, color: '#9ca3af' }}>{description}</p>
  </div>
);

const Spinner = () => (
  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
);

// ── History Page ───────────────────────────────────────────────────
const HistoryPage = ({ apiUrl, user }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('dp_token');
    fetch(`${apiUrl}/emails/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { setEmails(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ width: 200, height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ width: 140, height: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ ...styles.glass, padding: 24, height: 80, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: '#fafafa', marginBottom: 8, letterSpacing: '-0.02em' }}>Email History</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>
            {emails.length > 0 ? `${emails.length} update${emails.length !== 1 ? 's' : ''} from the last 5 days` : 'Track your sent updates'}
          </p>
        </div>
        {emails.length > 0 && (
          <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#cbd5e1' }}>
            Last 5 days
          </div>
        )}
      </div>

      {emails.length === 0 ? (
        <EmptyState 
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          title="No emails yet"
          description="Your sent updates will appear here once you start sending."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {emails.map(email => {
            const isExpanded = expandedId === email.id;
            const statusColor = email.status === 'sent' ? '#22c55e' : '#ef4444';
            
            return (
              <div key={email.id} style={{
                ...styles.glass,
                ...(isExpanded ? { border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)' } : {}),
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}>
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  style={{
                    padding: '20px 24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Status Indicator */}
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: statusColor,
                    boxShadow: `0 0 12px ${statusColor}40`,
                    flexShrink: 0,
                  }} />
                  
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 500, color: '#fafafa', margin: 0 }}>{email.subject}</h3>
                      {email.template_name && (
                        <span style={{
                          background: 'rgba(99,102,241,0.1)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          borderRadius: 6,
                          padding: '2px 8px',
                          fontSize: 11,
                          color: '#a5b4fc',
                        }}>
                          {email.template_name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        To: {email.to_emails?.slice(0, 2).join(', ')}{email.to_emails?.length > 2 ? ` +${email.to_emails.length - 2}` : ''}
                      </span>
                    </div>
                  </div>
                  
                  {/* Right side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(email.created_at)}</span>
                    <svg 
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
                    {/* Recipients Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                      {[
                        { label: 'To', list: email.to_emails },
                        { label: 'CC', list: email.cc_emails },
                        { label: 'BCC', list: email.bcc_emails },
                      ].filter(g => g.list?.length > 0).map(group => (
                        <div key={group.label}>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            {group.label}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {group.list.map((em, i) => (
                              <span key={i} style={styles.tag}>{em}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Email Body */}
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      padding: '20px 24px',
                    }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Message Content
                      </div>
                      <div style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                        {email.body}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>
                          Sent by <span style={{ color: '#d4d4d8' }}>{user?.email}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                          <span style={{ fontSize: 12, color: statusColor, fontWeight: 500 }}>
                            {email.status === 'sent' ? 'Delivered' : 'Failed'}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(email.created_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [voiceMode, setVoiceMode] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [isReleasingMic, setIsReleasingMic] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [debugAudioUrl, setDebugAudioUrl] = useState(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const [toEmails, setToEmails] = useState([]);
  const [ccEmails, setCcEmails] = useState([]);
  const [bccEmails, setBccEmails] = useState([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [refinedContent, setRefinedContent] = useState("");
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("app");

  const [tb, setTb] = useState({ name:"", rawText:"", fields:[], aiPrompt:"" });
  const [tbParsed, setTbParsed] = useState(false);

  const allTemplates = useMemo(() => [...DEFAULT_TEMPLATES, ...customTemplates], [customTemplates]);
  const template = allTemplates.find(t => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}`;

  // Auth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { localStorage.setItem("dp_token", token); window.history.replaceState({}, "", "/"); }
    const savedToken = token || localStorage.getItem("dp_token");
    if (savedToken) {
      fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(u => { setUser(u); setAuthLoading(false); })
        .catch(() => setAuthLoading(false));
    } else { setAuthLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("dp_token");
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCustomTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  const handleLogout = () => { localStorage.removeItem("dp_token"); setUser(null); };
  const selectTemplate = (id) => { setSelectedTemplate(id); setFormData({}); setRefinedContent(""); setStep(2); };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) { alert("Each line must have: Field Name: placeholder"); return; }
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    setTb(p => ({ ...p, fields, aiPrompt: `Refine this ${tb.name||"update"} into a concise, professional format.\n\n${vars}` }));
    setTbParsed(true);
  };

  const tbSave = async () => {
    if (!tb.name || !tb.fields.length) return;
    const token = localStorage.getItem("dp_token");
    try {
      const url = editingTemplate ? `${API_URL}/templates/${editingTemplate.id}` : `${API_URL}/templates`;
      const method = editingTemplate ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ name:tb.name, raw_text:tb.rawText, fields:tb.fields, ai_prompt:tb.aiPrompt }),
      });
      const saved = await res.json();
      if (editingTemplate) {
        setCustomTemplates(prev => prev.map(t => t.id===editingTemplate.id ? { ...saved, aiPrompt:saved.ai_prompt } : t));
      } else {
        setCustomTemplates(prev => [...prev, { ...saved, aiPrompt:saved.ai_prompt }]);
      }
      setShowTemplateBuilder(false);
    } catch { alert("Failed to save template"); }
  };

  const deleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    const token = localStorage.getItem("dp_token");
    await fetch(`${API_URL}/templates/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${token}` } });
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) { setSelectedTemplate(null); setStep(1); }
  };

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!voiceMode || !template) return;
    const field = template.fields[currentFieldIndex];
    if (!field) return;
    window.speechSynthesis.cancel();
    setIsPrompting(true);
    const utterance = new SpeechSynthesisUtterance(field.label);
    utterance.onend = () => setIsPrompting(false);
    utterance.onerror = () => setIsPrompting(false);
    window.speechSynthesis.speak(utterance);
    return () => {
      window.speechSynthesis.cancel();
      setIsPrompting(false);
    };
  }, [voiceMode, currentFieldIndex, template]);

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    setIsRecording(false);
    mediaRecorder.current.stop();
  };

  const handleRerecord = () => {
    if (!template) return;
    const fieldKey = template.fields[currentFieldIndex]?.key;
    if (fieldKey) handleFieldChange(fieldKey, "");
    audioChunks.current = [];
    if (isRecording) stopRecording();
  };

  const handleNextVoiceField = () => {
    if (!template) return;
    if (isRecording) stopRecording();
    audioChunks.current = [];
    const nextIndex = currentFieldIndex + 1;
    if (nextIndex >= template.fields.length) {
      setVoiceMode(false);
      setCurrentFieldIndex(0);
      return;
    }
    setCurrentFieldIndex(nextIndex);
  };

  const handleVoiceToggle = () => {
    setVoiceMode(prev => {
      const next = !prev;
      if (next) {
        setCurrentFieldIndex(0);
      } else {
        setCurrentFieldIndex(0);
        window.speechSynthesis.cancel();
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
          mediaRecorder.current.stop();
        }
      }
      return next;
    });
    audioChunks.current = [];
    setIsRecording(false);
    setTranscribing(false);
  };

  const startRecording = async () => {
    if (!template || !template.fields[currentFieldIndex]) return;
    audioChunks.current = [];
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Microphone access is not available in this browser.");
      setStatus("error");
      return;
    }

    if (mediaRecorder.current && mediaRecorder.current.stream) {
      setIsReleasingMic(true);
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsReleasingMic(false);
    }

    if (window.speechSynthesis.speaking || isPrompting) {
      window.speechSynthesis.cancel();
      setIsPrompting(false);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const fieldKeyAtStart = template.fields[currentFieldIndex]?.key;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const fieldKey = fieldKeyAtStart;
          if (!fieldKey) return;
          const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);
          setDebugAudioUrl(audioUrl);
          console.log('Recorded blob size:', blob.size, 'bytes');
          const body = new FormData();
          body.append('file', blob, `${fieldKey}.webm`);

          setTranscribing(true);
          const token = localStorage.getItem('dp_token');
          const res = await fetch(`${API_URL}/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.detail || res.statusText || 'Transcription failed');
          }

          const data = await res.json();
          handleFieldChange(fieldKey, data.text || '');
        } catch (error) {
          setErrorMsg(error.message || 'Transcription failed');
          setStatus('error');
        } finally {
          setTranscribing(false);
          if (mediaRecorder.current?.stream) {
            mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
          }
        }
      };

      mediaRecorder.current = recorder;
      recorder.start();
      setIsRecording(true);
      setErrorMsg("");
      setStatus(null);
    } catch (error) {
      setErrorMsg(error.message || 'Unable to access microphone.');
      setStatus('error');
    }
  };

  const refineContent = async () => {
    if (!formData[template.fields[0].key]) { setErrorMsg("Fill in at least the first field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    try {
      const token = localStorage.getItem("dp_token");
      const res = await fetch(`${API_URL}/refine`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ prompt: buildPrompt(template, formData) }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Refine failed");
      const data = await res.json();
      setRefinedContent(data.refined); setStatus("refined"); setStep(3);
    } catch(e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const sendEmail = async () => {
    if (!toEmails.length) { setErrorMsg("Add at least one recipient."); setStatus("error"); return; }
    setStatus("sending"); setErrorMsg("");
    try {
      const token = localStorage.getItem("dp_token");
      const res = await fetch(`${API_URL}/send`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ to:toEmails, cc:ccEmails, bcc:bccEmails, subject:subject||defaultSubject, body:refinedContent, template_name:template?.name||selectedTemplate }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Send failed");
      setStatus("sent"); setStep(4);
    } catch(e) { setErrorMsg(e.message); setStatus("error"); }
  };

  const reset = () => {
    setStep(1); setSelectedTemplate(null); setFormData({}); setRefinedContent("");
    setStatus(null); setErrorMsg(""); setToEmails([]); setCcEmails([]); setBccEmails([]);
    setSubject(""); setShowPreview(false); setShowCcBcc(false);
  };

  // ── Loading State ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ ...styles.body, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Spinner />
          </div>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // ── Login Screen ───────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ ...styles.body, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          {/* Logo */}
          <div style={{ 
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: '0 20px 60px rgba(99,102,241,0.3)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fafafa', marginBottom: 12, letterSpacing: '-0.03em' }}>
            Daily Push
          </h1>
          <p style={{ fontSize: 16, color: '#cbd5e1', lineHeight: 1.7, marginBottom: 48 }}>
            AI-powered daily updates. Write, refine, and send professional updates from your Gmail in seconds.
          </p>
          
          <a 
            href={`${API_URL}/auth/google`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              background: '#fff', color: '#18181b',
              padding: '14px 32px', borderRadius: 14,
              fontSize: 15, fontWeight: 600, textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </a>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 24 }}>
            No password needed · Sends directly from your Gmail
          </p>
        </div>
        
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #09090b; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fadeIn 0.4s ease forwards; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        `}</style>
      </div>
    );
  }

  // ── Main App ───────────────────────────────────────────────────
  return (
    <div style={styles.body}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #09090b; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease forwards; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        input::placeholder, textarea::placeholder { color: #94a3b8; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.02em' }}>Daily Push</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setPage(page === 'history' ? 'app' : 'history')}
            style={{
              ...styles.buttonSecondary, padding: '8px 16px', fontSize: 13,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            {page === 'history' ? '← Compose' : 'History'}
          </button>
          
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />}
            <div>
              <div style={{ fontSize: 13, color: '#d4d4d8', fontWeight: 500 }}>{user.name?.split(' ')[0]}</div>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#52525b', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Template Builder Modal */}
      {showTemplateBuilder && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 200 }}
            onClick={() => setShowTemplateBuilder(false)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
            background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: 32, zIndex: 201,
            boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: '#fafafa' }}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setShowTemplateBuilder(false)} style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Template Name *
                </label>
                <input style={styles.input} placeholder="e.g. Weekly Review"
                  value={tb.name} onChange={e => setTb(p => ({...p, name: e.target.value}))} />
              </div>
              
              <div>
                <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fields *
                </label>
                <textarea style={{...styles.input, resize: 'vertical', lineHeight: 1.8}}
                  placeholder="Accomplishments: What you achieved today&#10;Blockers: Any issues or delays&#10;Next Steps: What you'll work on next"
                  value={tb.rawText} onChange={e => { setTb(p => ({...p, rawText: e.target.value})); setTbParsed(false); }}
                  rows={7} />
                <button onClick={tbParse} disabled={!tb.rawText.trim()} style={{
                  ...styles.buttonSecondary, marginTop: 12, width: '100%', justifyContent: 'center',
                  opacity: tb.rawText.trim() ? 1 : 0.5,
                }}>
                  Parse Fields
                </button>
              </div>
              
              {tbParsed && tb.fields.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ✓ {tb.fields.length} field{tb.fields.length !== 1 ? 's' : ''} detected
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tb.fields.map((f, i) => (
                      <div key={i} style={{ ...styles.glass, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#d4d4d8' }}>{f.label}</span>
                        <code style={{ fontSize: 11, color: '#71717a' }}>{`{{${f.key}}}`}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {tbParsed && (
                <div>
                  <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Prompt
                  </label>
                  <textarea style={{...styles.input, resize: 'vertical'}}
                    value={tb.aiPrompt} onChange={e => setTb(p => ({...p, aiPrompt: e.target.value}))}
                    rows={5} />
                </div>
              )}
              
              <button onClick={tbSave} disabled={!tb.name || !tbParsed} style={{
                ...styles.buttonPrimary, width: '100%', justifyContent: 'center',
                opacity: (!tb.name || !tbParsed) ? 0.5 : 1, marginTop: 8,
              }}>
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', padding: 24 }}
          onClick={() => setShowPreview(false)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#fafafa', borderRadius: '20px 20px 0 0', padding: '20px 28px', borderBottom: '1px solid #e4e4e7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Preview</span>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              {[['From', user?.email], ['To', toEmails.join(', ') || '—'], ccEmails.length ? ['CC', ccEmails.join(', ')] : null, bccEmails.length ? ['BCC', bccEmails.join(', ')] : null, ['Subject', subject || defaultSubject]].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#a1a1aa', minWidth: 60 }}>{k}:</span>
                  <span style={{ color: '#18181b', fontWeight: k === 'Subject' ? 600 : 400 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '28px' }}>
              <div style={{ fontSize: 14, color: '#3f3f46', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {refinedContent || '(No content)'}
              </div>
              <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e4e4e7' }}>
                <p style={{ fontSize: 12, color: '#a1a1aa' }}>Sent via Daily Push · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Page */}
      {page === 'history' && <HistoryPage apiUrl={API_URL} user={user} />}

      {/* Main App */}
      {page === 'app' && (
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px' }}>
          
          {/* Progress Steps */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 56 }}>
            {['Template', 'Compose', 'Review', 'Done'].map((label, i) => {
              const n = i + 1, active = step === n, done = step > n;
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                      background: done ? '#6366f1' : active ? '#6366f1' : 'rgba(255,255,255,0.03)',
                      border: !done && !active ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      color: done || active ? '#fff' : '#52525b',
                      transition: 'all 0.3s ease',
                      boxShadow: active ? '0 0 0 8px rgba(99,102,241,0.15)' : 'none',
                    }}>
                      {done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : n}
                    </div>
                    <span style={{ fontSize: 10, color: active ? '#a5b4fc' : done ? '#6366f1' : '#52525b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div style={{
                      flex: 1, height: 2, margin: '0 12px', marginBottom: 24,
                      background: done ? '#6366f1' : 'rgba(255,255,255,0.06)',
                      borderRadius: 1, transition: 'background 0.5s ease',
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* STEP 1: Template Selection */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
                <div>
                  <h1 style={{ fontSize: 32, fontWeight: 600, color: '#fafafa', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    Choose a template
                  </h1>
                  <p style={{ fontSize: 15, color: '#71717a' }}>
                    Select a format that fits your update style
                  </p>
                </div>
                <button onClick={() => { setEditingTemplate(null); setTb({ name:"", rawText:"", fields:[], aiPrompt:"" }); setTbParsed(false); setShowTemplateBuilder(true); }}
                  style={styles.buttonSecondary}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Template
                </button>
              </div>

              {customTemplates.length > 0 ? (
                <>
                  {/* Custom templates first when present */}
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Your Templates
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                      {customTemplates.map(t => (
                        <div key={t.id} onClick={() => selectTemplate(t.id)} style={{
                          ...styles.glass, padding: '20px 24px', cursor: 'pointer',
                          transition: 'all 0.3s ease', position: 'relative',
                          borderLeft: `6px solid ${t.color || '#6366f1'}`,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fafafa', marginBottom: 12 }}>{t.name}</h3>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {t.fields.map(f => (
                              <span key={f.key} style={styles.tag}>{f.label}</span>
                            ))}
                          </div>
                          <div style={{ position: 'absolute', top: 12, right: 12 }} onClick={e => e.stopPropagation()}>
                            <MenuDots onEdit={() => { setEditingTemplate(t); setTb({ name:t.name, rawText:t.rawText||"", fields:t.fields, aiPrompt:t.aiPrompt }); setTbParsed(true); setShowTemplateBuilder(true); }}
                              onDelete={() => deleteTemplate(t.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Built-in templates after custom */}
                  <div style={{ marginBottom: 40 }}>
                    <p style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                      Default Templates
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                      {DEFAULT_TEMPLATES.map(t => (
                        <div key={t.id} onClick={() => selectTemplate(t.id)} style={{
                          ...styles.glass, padding: '20px 24px', cursor: 'pointer',
                          transition: 'all 0.3s ease', position: 'relative',
                          borderLeft: `6px solid ${t.color}`,
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fafafa', marginBottom: 12 }}>
                            {t.name}
                          </h3>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {t.fields.map(f => (
                              <span key={f.key} style={styles.tag}>{f.label}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 40 }}>
                  <p style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
                    Default Templates
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {DEFAULT_TEMPLATES.map(t => (
                      <div key={t.id} onClick={() => selectTemplate(t.id)} style={{
                        ...styles.glass, padding: '20px 24px', cursor: 'pointer',
                        transition: 'all 0.3s ease', position: 'relative',
                        borderLeft: `6px solid ${t.color}`,
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fafafa', marginBottom: 12 }}>
                          {t.name}
                        </h3>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {t.fields.map(f => (
                            <span key={f.key} style={styles.tag}>{f.label}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Compose */}
          {step === 2 && template && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: template.color || '#6366f1' }} />
                  <h1 style={{ fontSize: 28, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.02em' }}>
                    {template.name}
                  </h1>
                </div>
                <p style={{ fontSize: 15, color: '#71717a' }}>
                  Write naturally — AI will polish and structure your update
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ fontSize: 13, color: '#94a3af' }}>
                  {voiceMode ? `Question ${currentFieldIndex + 1} of ${template.fields.length}` : 'Type your responses below'}
                </div>
                <button
                  onClick={handleVoiceToggle}
                  style={{
                    ...styles.buttonSecondary,
                    background: voiceMode ? 'rgba(99,102,241,0.18)' : styles.buttonSecondary.background,
                    border: voiceMode ? '1px solid rgba(99,102,241,0.5)' : styles.buttonSecondary.border,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = voiceMode ? 'rgba(99,102,241,0.24)' : 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = voiceMode ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)'}
                >
                  🎤 Voice Mode
                </button>
              </div>

              {voiceMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ ...styles.glass, padding: '28px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Voice question</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', lineHeight: 1.2 }}>
                          {template.fields[currentFieldIndex].label}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3af' }}>
                        Question {currentFieldIndex + 1} of {template.fields.length}
                      </div>
                    </div>

                    <p style={{ marginTop: 18, color: '#9ca3af', lineHeight: 1.7 }}>
                      Press record and speak your answer. The transcript will appear below and can be edited before moving to the next field.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isPrompting || transcribing || isReleasingMic}
                        style={{
                          ...styles.buttonPrimary,
                          minWidth: 150,
                          background: isRecording ? '#ef4444' : '#6366f1',
                          opacity: (isPrompting || transcribing || isReleasingMic) ? 0.5 : 1,
                          cursor: (isPrompting || transcribing || isReleasingMic) ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isRecording ? '⏹ Stop' : '🎤 Record'}
                      </button>
                      <div style={{ fontSize: 13, color: '#94a3af' }}>
                        {isPrompting ? 'Waiting for prompt to finish...' : isReleasingMic ? 'Resetting microphone...' : isRecording ? 'Recording...' : transcribing ? 'Transcribing...' : 'Ready to capture audio.'}
                      </div>
                    </div>

                    {debugAudioUrl && (
                      <audio controls src={debugAudioUrl} style={{ width: '100%', marginTop: 12 }} />
                    )}

                    <textarea
                      style={{ ...styles.input, resize: 'vertical', lineHeight: 1.8, minHeight: 140, marginTop: 18 }}
                      placeholder={template.fields[currentFieldIndex].placeholder}
                      value={formData[template.fields[currentFieldIndex].key] || ''}
                      onChange={e => handleFieldChange(template.fields[currentFieldIndex].key, e.target.value)}
                      rows={6}
                      disabled={transcribing}
                      onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                      onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                      <button
                        onClick={handleRerecord}
                        style={{ ...styles.buttonSecondary, minWidth: 140 }}
                      >
                        🔄 Re-record
                      </button>
                      <button
                        onClick={handleNextVoiceField}
                        style={{ ...styles.buttonPrimary, minWidth: 140 }}
                        disabled={transcribing}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {template.fields.map((f, idx) => (
                    <div key={f.key}>
                      <label style={{
                        fontSize: 12, color: '#a1a1aa', fontWeight: 600,
                        display: 'block', marginBottom: 10,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {f.label}
                        {idx === 0 && <span style={{ color: '#6366f1', marginLeft: 4 }}>*</span>}
                      </label>
                      <textarea
                        style={{ ...styles.input, resize: 'vertical', lineHeight: 1.8 }}
                        placeholder={f.placeholder}
                        value={formData[f.key] || ''}
                        onChange={e => { handleFieldChange(f.key, e.target.value); }}
                        rows={4}
                        onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                        onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {status === 'error' && (
                <div style={{
                  marginTop: 20, padding: '14px 18px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12,
                  color: '#fca5a5', fontSize: 13,
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => { setStep(1); setStatus(null); }} style={styles.buttonSecondary}>
                  ← Back
                </button>
                <button
                  onClick={refineContent}
                  disabled={!formData[template.fields[0].key] || status === 'refining'}
                  style={{
                    ...styles.buttonPrimary,
                    opacity: (!formData[template.fields[0].key] || status === 'refining') ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!(!formData[template.fields[0].key] || status === 'refining')) { e.currentTarget.style.background = '#5558e6'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {status === 'refining' ? (
                    <><Spinner /> Refining...</>
                  ) : (
                    <>Refine with AI <span style={{ fontSize: 18, lineHeight: 1 }}>→</span></>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Send */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 600, color: '#fafafa', marginBottom: 8, letterSpacing: '-0.02em' }}>
                    Review & Send
                  </h1>
                  <p style={{ fontSize: 15, color: '#71717a' }}>
                    Final check before delivering your update
                  </p>
                </div>
                <button onClick={() => setShowPreview(true)} style={styles.buttonSecondary}>
                  Preview
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Refined Content
                    </label>
                    <span style={{ fontSize: 12, color: '#52525b' }}>{refinedContent.length} chars</span>
                  </div>
                  <textarea
                    style={{ ...styles.input, resize: 'vertical', lineHeight: 1.8, minHeight: 160 }}
                    value={refinedContent}
                    onChange={e => setRefinedContent(e.target.value)}
                    rows={8}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>

                <EmailInput
                  label={<>To Recipients <span style={{ color: '#6366f1' }}>*</span></>}
                  chips={toEmails}
                  onChange={setToEmails}
                  placeholder="colleague@company.com"
                />

                <button
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  style={{
                    background: 'none', border: 'none', color: '#71717a', fontSize: 13,
                    cursor: 'pointer', alignSelf: 'flex-start', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#a1a1aa'}
                  onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: showCcBcc ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  {showCcBcc ? 'Hide CC / BCC' : 'Add CC / BCC'}
                </button>

                {showCcBcc && (
                  <>
                    <EmailInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="manager@company.com" />
                    <EmailInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="bcc@company.com" />
                  </>
                )}

                <div>
                  <label style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Subject Line
                  </label>
                  <input
                    style={styles.input}
                    placeholder={defaultSubject}
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    onFocus={e => { e.currentTarget.style.border = '1px solid rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {status === 'error' && (
                <div style={{
                  marginTop: 20, padding: '14px 18px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12,
                  color: '#fca5a5', fontSize: 13,
                }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={() => { setStep(2); setStatus('refined'); }} style={styles.buttonSecondary}>
                  ← Back
                </button>
                <button
                  onClick={sendEmail}
                  disabled={!toEmails.length || status === 'sending'}
                  style={{
                    ...styles.buttonPrimary,
                    background: '#22c55e',
                    opacity: (!toEmails.length || status === 'sending') ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (toEmails.length && status !== 'sending') e.currentTarget.style.background = '#16a34a'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#22c55e'; }}
                >
                  {status === 'sending' ? (
                    <><Spinner /> Sending...</>
                  ) : (
                    <>Send to {toEmails.length} {toEmails.length === 1 ? 'recipient' : 'recipients'}</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === 4 && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24,
                background: 'linear-gradient(135deg, #22c55e, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 28px',
                boxShadow: '0 20px 60px rgba(34,197,94,0.3)',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              
              <h1 style={{ fontSize: 32, fontWeight: 600, color: '#fafafa', marginBottom: 12, letterSpacing: '-0.02em' }}>
                Update Sent
              </h1>
              <p style={{ fontSize: 16, color: '#a1a1aa', marginBottom: 6 }}>
                Delivered to <span style={{ color: '#22c55e', fontWeight: 500 }}>{toEmails.length} recipient{toEmails.length !== 1 ? 's' : ''}</span>
                {ccEmails.length > 0 && <span style={{ color: '#71717a' }}> · {ccEmails.length} CC</span>}
              </p>
              <p style={{ fontSize: 14, color: '#52525b', marginBottom: 48 }}>
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {template?.name}
              </p>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => { setStep(3); setStatus('sent'); }} style={styles.buttonSecondary}>
                  View Details
                </button>
                <button onClick={reset} style={styles.buttonPrimary}>
                  Send Another Update →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}