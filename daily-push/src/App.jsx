import { useState, useEffect, useRef, useMemo } from "react";

const DEFAULT_TEMPLATES = [
  {
    id: "standup", name: "Daily Standup", isDefault: true, gradient: "from-violet-600 to-indigo-600",
    fields: [
      { key: "done", label: "What I accomplished", placeholder: "Completed the login page UI, fixed 3 bugs in auth flow..." },
      { key: "blockers", label: "Blockers / Issues", placeholder: "Waiting on API keys from backend team..." },
      { key: "tomorrow", label: "Upcoming tasks", placeholder: "Start working on dashboard charts..." },
    ],
    aiPrompt: "Refine this daily standup update into a concise, professional format.\n\nDone: {{done}}\nBlockers: {{blockers}}\nTomorrow: {{tomorrow}}",
  },
  {
    id: "progress", name: "Progress Report", isDefault: true, gradient: "from-emerald-600 to-teal-600",
    fields: [
      { key: "done", label: "Accomplishments", placeholder: "Shipped v2.1 with dark mode, reviewed 4 PRs..." },
      { key: "metrics", label: "Key Metrics", placeholder: "Closed 7 tickets, 92% test coverage..." },
      { key: "learnings", label: "Key Learnings", placeholder: "Discovered a better way to handle state..." },
    ],
    aiPrompt: "Polish this progress report into a clear, professional summary.\n\nAccomplishments: {{done}}\nMetrics: {{metrics}}\nLearnings: {{learnings}}",
  },
  {
    id: "client", name: "Client Update", isDefault: true, gradient: "from-amber-600 to-orange-600",
    fields: [
      { key: "done", label: "Work Completed", placeholder: "Implemented the requested feature, tested on staging..." },
      { key: "status", label: "Project Status", placeholder: "On track for Friday deadline..." },
      { key: "next", label: "Next Steps", placeholder: "Deploy to production, gather feedback..." },
    ],
    aiPrompt: "Rewrite this as a polished, professional client-facing project update.\n\nWork Done: {{done}}\nStatus: {{status}}\nNext Steps: {{next}}",
  },
];

const API_URL = "https://dailypush-backend.onrender.com";

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

// ── Icons ──────────────────────────────────────────────────────────
const Icons = {
  send: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  arrowRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  arrowLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  chevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  mail: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M18 14l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5z"/></svg>,
  trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  google: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
  dots: () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="2" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="14" r="1.5"/></svg>,
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
    <div ref={ref} className="relative">
      <button onClick={e => { e.stopPropagation(); setOpen(!open); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all">
        <Icons.dots />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-white/10 rounded-xl min-w-[160px] overflow-hidden shadow-2xl z-50">
          <button onClick={e => { e.stopPropagation(); setOpen(false); onEdit(); }} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
            <Icons.edit /> Edit
          </button>
          <button onClick={e => { e.stopPropagation(); setOpen(false); onDelete(); }} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors">
            <Icons.trash /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const EmailInput = ({ label, chips, onChange, placeholder }) => {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef();
  
  const addChip = (val) => {
    const emails = val.split(/[,;\s]+/).map(e => e.trim()).filter(e => e && e.includes("@"));
    if (emails.length) onChange([...chips, ...emails.filter(e => !chips.includes(e))]);
    setInput("");
  };
  
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{label}</label>
      <div onClick={() => inputRef.current?.focus()} className={`min-h-[48px] px-4 py-2.5 bg-black/30 border rounded-xl flex flex-wrap gap-2 items-center cursor-text transition-all ${focused ? 'border-indigo-500 ring-1 ring-indigo-500/20 bg-black/40' : 'border-white/10 hover:border-white/20'}`}>
        {chips.map((chip, i) => (
          <span key={i} className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-2.5 py-1 text-sm text-indigo-300 flex items-center gap-2">
            {chip}
            <button onClick={() => onChange(chips.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-indigo-200 transition-colors font-bold">×</button>
          </span>
        ))}
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); if (input) addChip(input); }}
          onKeyDown={e => { if (['Enter', ',', ';', 'Tab'].includes(e.key)) { e.preventDefault(); addChip(input); } if (e.key === 'Backspace' && !input && chips.length) onChange(chips.slice(0, -1)); }}
          onPaste={e => { e.preventDefault(); addChip(e.clipboardData.getData('text')); }}
          placeholder={chips.length === 0 ? placeholder : ''} className="border-none outline-none bg-transparent text-white text-sm flex-1 min-w-[140px] placeholder-gray-600" />
      </div>
      <p className="text-xs text-gray-600 mt-1.5">Press Enter or comma to add · Paste multiple at once</p>
    </div>
  );
};

const HistoryPage = ({ apiUrl, user }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('dp_token');
    fetch(`${apiUrl}/emails/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => { setEmails(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [apiUrl]);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white/[0.02] rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">Sent History</h1>
        <p className="text-gray-400">{emails.length} update{emails.length !== 1 ? 's' : ''} from the last 5 days</p>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-6">
            <Icons.mail />
          </div>
          <h3 className="text-lg text-gray-300 mb-2">No emails yet</h3>
          <p className="text-gray-500">Send your first update to see it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map(email => {
            const isExpanded = expandedId === email.id;
            return (
              <div key={email.id} className={`rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-white/15 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01] hover:border-white/10'}`}>
                <div onClick={() => setExpandedId(isExpanded ? null : email.id)} className="p-5 cursor-pointer flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${email.status === 'sent' ? 'bg-green-400 shadow-lg shadow-green-400/30' : 'bg-red-400 shadow-lg shadow-red-400/30'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-sm font-medium text-white truncate">{email.subject}</h3>
                      {email.template_name && <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-xs text-indigo-400 flex-shrink-0">{email.template_name}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>To: {email.to_emails?.slice(0, 2).join(', ')}{email.to_emails?.length > 2 ? ` +${email.to_emails.length - 2}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-xs text-gray-600">{formatDate(email.created_at)}</span>
                    <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}><Icons.chevronDown /></span>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-white/5 p-5 space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                      {[{ label: 'To', list: email.to_emails }, { label: 'CC', list: email.cc_emails }, { label: 'BCC', list: email.bcc_emails }].map(g => g.list?.length > 0 && (
                        <div key={g.label}>
                          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">{g.label}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {g.list.map((em, i) => <span key={i} className="px-2 py-1 bg-white/[0.03] border border-white/5 rounded-md text-xs text-gray-400">{em}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-black/20 border border-white/5 rounded-xl p-5">
                      <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Message</div>
                      <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{email.body}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500">Sent by <span className="text-gray-400">{user?.email}</span></span>
                        <span className={`flex items-center gap-1.5 ${email.status === 'sent' ? 'text-green-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${email.status === 'sent' ? 'bg-green-400' : 'bg-red-400'}`} />
                          {email.status === 'sent' ? 'Delivered' : 'Failed'}
                        </span>
                      </div>
                      <span className="text-gray-600">{formatDate(email.created_at)}</span>
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
  const [toEmails, setToEmails] = useState([]);
  const [ccEmails, setCcEmails] = useState([]);
  const [bccEmails, setBccEmails] = useState([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [refinedContent, setRefinedContent] = useState("");
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("app");
  const [tb, setTb] = useState({ name:"", rawText:"", fields:[], aiPrompt:"" });
  const [tbParsed, setTbParsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const allTemplates = useMemo(() => [...DEFAULT_TEMPLATES, ...customTemplates], [customTemplates]);
  const template = allTemplates.find(t => t.id === selectedTemplate);
  const defaultSubject = `Daily Update — ${new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { localStorage.setItem("dp_token", token); window.history.replaceState({}, "", "/"); }
    const savedToken = token || localStorage.getItem("dp_token");
    if (savedToken) {
      fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.ok ? r.json() : null).then(u => { setUser(u); setAuthLoading(false); }).catch(() => setAuthLoading(false));
    } else setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/templates`, { headers: { Authorization: `Bearer ${localStorage.getItem("dp_token")}` } })
      .then(r => r.json()).then(data => setCustomTemplates(Array.isArray(data) ? data : [])).catch(() => {});
  }, [user]);

  const handleLogout = () => { localStorage.removeItem("dp_token"); setUser(null); };
  const selectTemplate = (id) => { setSelectedTemplate(id); setFormData({}); setRefinedContent(""); setStep(2); };

  const tbParse = () => {
    const fields = parseTemplate(tb.rawText);
    if (!fields.length) { alert("Each line needs: Field Name: placeholder"); return; }
    const vars = fields.map(f => `${f.label}: {{${f.key}}}`).join("\n");
    setTb(p => ({ ...p, fields, aiPrompt: `Refine this ${tb.name||"update"} into a concise, professional format.\n\n${vars}` }));
    setTbParsed(true);
  };

  const tbSave = async () => {
    if (!tb.name || !tb.fields.length) return;
    const token = localStorage.getItem("dp_token");
    try {
      const url = editingTemplate ? `${API_URL}/templates/${editingTemplate.id}` : `${API_URL}/templates`;
      const res = await fetch(url, {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ name:tb.name, raw_text:tb.rawText, fields:tb.fields, ai_prompt:tb.aiPrompt }),
      });
      const saved = await res.json();
      if (editingTemplate) setCustomTemplates(prev => prev.map(t => t.id===editingTemplate.id ? { ...saved, aiPrompt:saved.ai_prompt } : t));
      else setCustomTemplates(prev => [...prev, { ...saved, aiPrompt:saved.ai_prompt }]);
      setShowTemplateModal(false);
    } catch { alert("Failed to save template"); }
  };

  const deleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`${API_URL}/templates/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${localStorage.getItem("dp_token")}` } });
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) { setSelectedTemplate(null); setStep(1); }
  };

  const refineContent = async () => {
    if (!formData[template.fields[0].key]) { setErrorMsg("Fill in at least the first field."); setStatus("error"); return; }
    setStatus("refining"); setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/refine`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("dp_token")}` },
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
      const res = await fetch(`${API_URL}/send`, {
        method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("dp_token")}` },
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

  const copyContent = () => { navigator.clipboard.writeText(refinedContent); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (authLoading) return (
    <div className="h-screen bg-[#050508] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-500/20">
          <Icons.sparkles />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Daily Push</h1>
        <p className="text-gray-400 mb-10 leading-relaxed">
          AI-powered daily updates. Write naturally, let AI polish, send from Gmail — all in under 2 minutes.
        </p>
        <a href={`${API_URL}/auth/google`} className="inline-flex items-center gap-3 bg-white text-gray-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:shadow-xl hover:shadow-white/10">
          <Icons.google /> Continue with Google
        </a>
        <p className="text-xs text-gray-600 mt-6">No password · Sends from your Gmail</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-50 border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-xs font-bold">DP</div>
            <span className="font-semibold text-sm">Daily Push</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setPage(page==="history"?"app":"history")} className="text-sm text-gray-400 hover:text-white transition-colors">
              {page==="history"?"Compose":"History"}
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              {user.picture && <img src={user.picture} className="w-7 h-7 rounded-lg" alt="" />}
              <span className="text-sm text-gray-400">{user.name?.split(' ')[0]}</span>
              <button onClick={handleLogout} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Template Builder Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)} />
          <div className="relative bg-[#0a0a10] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setShowTemplateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">✕</button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Name *</label>
                <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="e.g. Weekly Review" value={tb.name} onChange={e => setTb(p => ({...p, name: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Fields *</label>
                <textarea className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all resize-y"
                  placeholder="Accomplishments: What you achieved today&#10;Blockers: Any issues or delays&#10;Next Steps: What you'll work on next"
                  value={tb.rawText} onChange={e => { setTb(p => ({...p, rawText: e.target.value})); setTbParsed(false); }} rows={7} />
                <button onClick={tbParse} disabled={!tb.rawText.trim()} className="w-full mt-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-500/20 transition-all disabled:opacity-50">
                  Parse Fields
                </button>
              </div>
              {tbParsed && tb.fields.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-green-400 mb-3 uppercase tracking-wider">✓ {tb.fields.length} field{tb.fields.length !== 1 ? 's' : ''} detected</div>
                  <div className="space-y-2">
                    {tb.fields.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-3">
                        <span className="text-sm text-gray-300">{f.label}</span>
                        <code className="text-xs text-gray-600">{`{{${f.key}}}`}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tbParsed && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">AI Prompt</label>
                  <textarea className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all resize-y"
                    value={tb.aiPrompt} onChange={e => setTb(p => ({...p, aiPrompt: e.target.value}))} rows={5} />
                </div>
              )}
              <button onClick={tbSave} disabled={!tb.name || !tbParsed} className="w-full bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700 transition-all disabled:opacity-50">
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 rounded-t-2xl p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Preview</span>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {[['From', user?.email], ['To', toEmails.join(', ') || '—'], ccEmails.length ? ['CC', ccEmails.join(', ')] : null, bccEmails.length ? ['BCC', bccEmails.join(', ')] : null, ['Subject', subject || defaultSubject]].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex gap-3 text-sm mb-1.5">
                  <span className="text-gray-400 min-w-[60px]">{k}:</span>
                  <span className={k === 'Subject' ? 'font-semibold text-gray-900' : 'text-gray-700'}>{v}</span>
                </div>
              ))}
            </div>
            <div className="p-6 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{refinedContent || '(No content)'}</div>
            <div className="px-6 pb-6 pt-4 border-t text-xs text-gray-400">Sent via Daily Push · {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>
          </div>
        </div>
      )}

      {/* History */}
      {page === "history" && <HistoryPage apiUrl={API_URL} user={user} />}

      {/* Main Content */}
      {page === "app" && (
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-16">
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-16">
            {['Template', 'Compose', 'Review', 'Done'].map((label, i) => {
              const n = i + 1, active = step === n, done = step > n;
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active ? 'bg-indigo-600 text-white' : done ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white/20' : done ? 'bg-indigo-500/30' : 'bg-white/10'}`}>
                      {done ? '✓' : n}
                    </span>
                    {label}
                  </div>
                  {i < 3 && <div className={`w-8 h-px ${done ? 'bg-indigo-500/50' : 'bg-white/10'}`} />}
                </div>
              );
            })}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-3">Choose a template</h1>
                <p className="text-gray-400">Pick a format that matches your update style</p>
              </div>

              <div className="mb-12">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">Built-in Templates</h3>
                <div className="grid gap-4">
                  {DEFAULT_TEMPLATES.map(t => (
                    <div key={t.id} onClick={() => selectTemplate(t.id)} className="group cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">{t.name}</h3>
                        <span className="text-gray-600 group-hover:text-gray-400 transition-colors"><Icons.arrowRight /></span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {t.fields.map(f => <span key={f.key} className="px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-gray-400">{f.label}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {customTemplates.length > 0 && (
                <div className="mb-12">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 text-center">Your Templates</h3>
                  <div className="grid gap-4">
                    {customTemplates.map(t => (
                      <div key={t.id} onClick={() => selectTemplate(t.id)} className="group cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <h3 className="font-semibold text-white">{t.name}</h3>
                              <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-[10px] text-indigo-400 uppercase">Custom</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {t.fields.map(f => <span key={f.key} className="px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-xs text-gray-400">{f.label}</span>)}
                            </div>
                          </div>
                          <div onClick={e => e.stopPropagation()}>
                            <MenuDots onEdit={() => { setEditingTemplate(t); setTb({ name:t.name, rawText:t.rawText||"", fields:t.fields, aiPrompt:t.aiPrompt }); setTbParsed(true); setShowTemplateModal(true); }}
                              onDelete={() => deleteTemplate(t.id)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center">
                <button onClick={() => { setEditingTemplate(null); setTb({ name:"", rawText:"", fields:[], aiPrompt:"" }); setTbParsed(false); setShowTemplateModal(true); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 hover:text-white transition-all">
                  <Icons.plus /> Create Custom Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && template && (
            <div className="animate-fade-in">
              <div className="text-center mb-12">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 mb-4 inline-block">{template.name}</span>
                <h1 className="text-3xl font-bold mb-3">Write your update</h1>
                <p className="text-gray-400">Be natural — AI will structure it professionally</p>
              </div>

              <div className="space-y-6">
                {template.fields.map((f, idx) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      {f.label}{idx === 0 && <span className="text-indigo-400 ml-1">*</span>}
                    </label>
                    <textarea className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all resize-y min-h-[120px]"
                      placeholder={f.placeholder} value={formData[f.key] || ''} onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>

              {status === 'error' && <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400">{errorMsg}</div>}

              <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
                <button onClick={() => { setStep(1); setStatus(null); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Icons.arrowLeft /> Back
                </button>
                <button onClick={refineContent} disabled={!formData[template.fields[0].key] || status === 'refining'}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {status === 'refining' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Refining...</> : <><Icons.sparkles /> Refine with AI</>}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="animate-fade-in">
              <div className="text-center mb-12">
                <h1 className="text-3xl font-bold mb-3">Review & Send</h1>
                <p className="text-gray-400">Final check before your update goes out</p>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-300">Refined Content</label>
                    <div className="flex items-center gap-2">
                      <button onClick={copyContent} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        <Icons.copy /> {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <span className="text-xs text-gray-600">{refinedContent.length} chars</span>
                    </div>
                  </div>
                  <textarea className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-4 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all resize-y min-h-[180px] leading-relaxed"
                    value={refinedContent} onChange={e => setRefinedContent(e.target.value)} />
                </div>

                <EmailInput label={<>To <span className="text-indigo-400">*</span></>} chips={toEmails} onChange={setToEmails} placeholder="colleague@company.com" />

                <button onClick={() => setShowCcBcc(!showCcBcc)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                  <span className={`transform transition-transform ${showCcBcc ? 'rotate-45' : ''}`}>+</span>
                  {showCcBcc ? 'Hide CC / BCC' : 'Add CC / BCC'}
                </button>
                {showCcBcc && <><EmailInput label="CC" chips={ccEmails} onChange={setCcEmails} placeholder="manager@company.com" /><EmailInput label="BCC" chips={bccEmails} onChange={setBccEmails} placeholder="bcc@company.com" /></>}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Subject</label>
                  <input className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                    placeholder={defaultSubject} value={subject} onChange={e => setSubject(e.target.value)} />
                </div>
              </div>

              {status === 'error' && <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400">{errorMsg}</div>}

              <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
                <button onClick={() => { setStep(2); setStatus('refined'); }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Icons.arrowLeft /> Back
                </button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowPreview(true)} className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-all">Preview</button>
                  <button onClick={sendEmail} disabled={!toEmails.length || status === 'sending'}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {status === 'sending' ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</> : <><Icons.send /> Send {toEmails.length > 0 && `to ${toEmails.length}`}</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="animate-fade-in text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-500/20">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 className="text-3xl font-bold mb-3">Update Sent!</h1>
              <p className="text-gray-400 mb-1">Delivered to <span className="text-green-400 font-medium">{toEmails.length} recipient{toEmails.length !== 1 ? 's' : ''}</span>{ccEmails.length > 0 && <span className="text-gray-500"> · {ccEmails.length} CC</span>}</p>
              <p className="text-sm text-gray-600 mb-10 flex items-center justify-center gap-2"><Icons.clock /> {new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} · {template?.name}</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => { setStep(3); setStatus('sent'); }} className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-all">View Details</button>
                <button onClick={reset} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-all">
                  <Icons.plus /> Send Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}