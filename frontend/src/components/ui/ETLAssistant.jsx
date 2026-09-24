import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, Minus, Maximize2, Minimize2 } from 'lucide-react';
import api, { airflow, monitoring } from '../../utils/api';
import { LanguageSelector, ThinkingDots, VoiceSpeaker, MicDictation } from './VoiceAndLangControls';
import { t, translateDynamicText } from '../../utils/i18n';

const QUICK_PROMPTS = [
  { en: "Which jobs are currently running?", hi: "कौन से जॉब चल रहे हैं?", te: "ప్రస్తుతం ఏ జాబ్‌లు నడుస్తున్నాయి?" },
  { en: "Which jobs are at high risk?", hi: "कौन से जॉब उच्च जोखिम में हैं?", te: "ఏ జాబ్‌లు ప్రమాదంలో ఉన్నాయి?" },
  { en: "Is Airflow healthy?", hi: "क्या एयरफ्लो ठीक है?", te: "Airflow పరిస్థితి ఎలా ఉంది?" },
  { en: "Show pipeline summary", hi: "पाइपलाइन सारांश दिखाएं", te: "పైప్‌లైన్ సారాంశం చూపించు" },
  { en: "Show active alerts", hi: "सक्रिय अलर्ट दिखाएं", te: "యాక్టివ్ హెచ్చరికలు చూపించు" },
];

export default function ETLAssistant() {
  const [isOpen, setIsOpen]           = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [lang, setLang]               = useState('en');

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am your ETL Assistant. Ask me about running jobs, high-risk pipelines, Airflow connectivity, or recovery recommendations.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen, isMinimized]);

  const handleQuery = async (queryText) => {
    const q = (queryText || input).trim();
    if (!q) return;

    const userMsg = { id: Date.now().toString(), sender: 'user', text: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      let botResponse = '';
      const lower = q.toLowerCase();

      // Delay for thinking animation
      await new Promise(res => setTimeout(res, 800));

      if (lower.includes('running') || lower.includes('active') || lower.includes('चल रहे') || lower.includes('నడుస్తున్నాయి')) {
        const { data } = await api.get('/jobs?status=running');
        const jobs = data.jobs || data || [];
        if (jobs.length === 0) {
          botResponse = "No jobs are currently running. All pipelines are idle or complete.";
        } else {
          botResponse = `There are currently **${jobs.length} running job(s)**:\n` +
            jobs.map(j => `• **${j.jobName || j.name || j.dag_id}** (ID: \`${j.jobId || j._id}\`) - Stage: ${j.stage || 'PROCESSING'} | CPU: ${j.cpuUtilization || 0}% | Memory: ${j.memoryUtilization || 0}%`).join('\n');
        }
      } else if (lower.includes('risk') || lower.includes('high risk') || lower.includes('predict') || lower.includes('जोखिम') || lower.includes('ప్రమాదం')) {
        const { data } = await api.get('/predict/at-risk');
        const atRisk = Array.isArray(data) ? data : (data.jobs || []);
        if (atRisk.length === 0) {
          botResponse = "No jobs are currently flagged as high-risk by the failure prediction model.";
        } else {
          botResponse = `Found **${atRisk.length} job(s) at elevated risk**:\n` +
            atRisk.map(j => `• **${j.jobName || j.name || j.dag_id}** - Risk Score: **${Math.round((j.failureProbability || j.riskScore || 0) * 100)}%** (${j.riskLevel || 'HIGH'})\n  *Contributing Factors:* ${j.recommendation || 'Elevated memory & retry counts'}`).join('\n');
        }
      } else if (lower.includes('airflow') || lower.includes('dag') || lower.includes('एयरफ्लो')) {
        const { data: ping } = await airflow.ping().catch(() => ({ data: { status: 'offline' } }));
        const { data: status } = await airflow.getSyncStatus().catch(() => ({ data: {} }));
        botResponse = `**Airflow Status Report:**\n` +
          `• Connectivity: **${ping?.status === 'ok' ? 'Online 🟢' : 'Offline (Simulator Mode Active)'}**\n` +
          `• Last Sync: ${status?.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'N/A'}\n` +
          `• Total DAGs Tracked: ${status?.dagCount ?? 'Available in Airflow View'}`;
      } else if (lower.includes('alert') || lower.includes('failed') || lower.includes('failure') || lower.includes('अलर्ट') || lower.includes('హెచ్చరిక')) {
        const { data } = await api.get('/alerts?limit=5');
        const alerts = Array.isArray(data) ? data : [];
        if (alerts.length === 0) {
          botResponse = "No active critical alerts detected.";
        } else {
          botResponse = `**Active Critical Alerts (${alerts.length}):**\n` +
            alerts.map(a => `• **[${a.type?.toUpperCase() || 'ALERT'}]** ${a.jobName || a.jobId}: ${a.message} (${new Date(a.createdAt).toLocaleTimeString()})`).join('\n');
        }
      } else if (lower.includes('summary') || lower.includes('health') || lower.includes('status') || lower.includes('सारांश') || lower.includes('సారాంశం')) {
        const [jobsRes, liveRes] = await Promise.all([
          api.get('/jobs?limit=50').catch(() => ({ data: [] })),
          monitoring.getLive().catch(() => ({ data: {} })),
        ]);
        const allJobs = jobsRes.data?.jobs || jobsRes.data || [];
        const running = allJobs.filter(j => j.status === 'running').length;
        const failed = allJobs.filter(j => j.status === 'failed').length;
        const success = allJobs.filter(j => j.status === 'success' || j.status === 'completed').length;
        botResponse = `**ETL Platform Health Summary:**\n` +
          `• Total Monitored Jobs: **${allJobs.length}**\n` +
          `• Running: **${running}** | Success: **${success}** | Failed: **${failed}**\n` +
          `• Telemetry Mode: **${liveRes.data?.mode || 'Active Simulator'}**`;
      } else {
        botResponse = `I checked the platform for "${q}".\n` +
          `Currently, monitoring services are polling live ETL telemetry. You can ask me to inspect running jobs, high-risk DAGs, Airflow health, or recent alerts!`;
      }

      const finalBotText = translateDynamicText(botResponse, lang);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: finalBotText,
        timestamp: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `Unable to query telemetry API: ${err.message}. Please verify backend connection.`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Determine window style depending on minimized / maximized state
  const windowStyle = isMaximized ? {
    position: 'fixed',
    bottom: '3vh',
    right: '3vw',
    width: '94vw',
    height: '92vh',
    background: 'var(--bg-card, #ffffff)',
    border: '1px solid var(--border-color, #cbd5e1)',
    borderRadius: 12,
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  } : isMinimized ? {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 320,
    height: 48,
    background: 'var(--bg-card, #ffffff)',
    border: '1px solid #DDA0DD',
    borderRadius: 24,
    boxShadow: '0 8px 24px rgba(221, 160, 221, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 1000,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } : {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 460,
    height: 600,
    minWidth: 360,
    minHeight: 420,
    maxWidth: '92vw',
    maxHeight: '90vh',
    resize: 'both',
    overflow: 'hidden',
    background: 'var(--bg-card, #ffffff)',
    border: '1px solid rgba(221, 160, 221, 0.5)',
    borderRadius: 12,
    boxShadow: '0 12px 30px -5px rgba(221, 160, 221, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    transition: 'width 0.15s ease, height 0.15s ease',
  };

  return (
    <>
      {/* Launcher Button (when window is closed) */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            height: 42,
            padding: '0 18px',
            borderRadius: 21,
            background: '#DDA0DD',
            color: '#ffffff',
            border: '1px solid #c070c0',
            boxShadow: '0 4px 14px rgba(221, 160, 221, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            zIndex: 999,
            fontWeight: 700,
            fontSize: 13,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#c070c0'}
          onMouseLeave={e => e.currentTarget.style.background = '#DDA0DD'}
        >
          <Sparkles size={16} color="#ffffff" />
          <span>{t('assistantTitle', lang)}</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
        </button>
      )}

      {/* Assistant Window (Open) */}
      {isOpen && (
        isMinimized ? (
          /* Minimized Bar */
          <div style={windowStyle} onClick={() => setIsMinimized(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={18} color="#DDA0DD" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>{t('assistantTitle', lang)}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                style={{ background: 'none', border: 'none', color: '#DDA0DD', cursor: 'pointer', padding: 4 }}
                title="Restore Window"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* Full / Resizable Chat Window */
          <div style={windowStyle}>
            {/* Header Controls Bar */}
            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-subtle, #f8fafc)',
              borderBottom: '1px solid rgba(221, 160, 221, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              userSelect: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: 'rgba(221, 160, 221, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={16} color="#DDA0DD" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#DDA0DD' }}>
                    {t('assistantTitle', lang)}
                  </div>
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a' }} />
                    Live AI Telemetry Workspace
                  </div>
                </div>
              </div>

              {/* Language Selector + Window Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LanguageSelector selectedLang={lang} onChange={setLang} />

                {/* Minimize button */}
                <button
                  onClick={() => setIsMinimized(true)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex' }}
                  title="Minimize"
                >
                  <Minus size={15} />
                </button>

                {/* Maximize / Restore button */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex' }}
                  title={isMaximized ? "Restore Window" : "Maximize Workspace"}
                >
                  {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                {/* Close button */}
                <button
                  onClick={() => setIsOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex' }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Quick Prompts Bar */}
            <div style={{
              padding: '8px 12px',
              background: 'var(--bg-card, #ffffff)',
              borderBottom: '1px solid var(--border-color, #f1f5f9)',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}>
              {QUICK_PROMPTS.map((p, idx) => {
                const text = p[lang] || p.en;
                return (
                  <button
                    key={idx}
                    onClick={() => handleQuery(text)}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(221, 160, 221, 0.08)',
                      border: '1px solid rgba(221, 160, 221, 0.3)',
                      borderRadius: 12,
                      color: 'var(--text-main, #475569)',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#DDA0DD'; e.currentTarget.style.color = '#c070c0'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(221, 160, 221, 0.3)'; e.currentTarget.style.color = 'var(--text-main, #475569)'; }}
                  >
                    {text}
                  </button>
                );
              })}
            </div>

            {/* Messages Body */}
            <div style={{
              flex: 1,
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: 'var(--bg-card, #ffffff)',
            }}>
              {messages.map(m => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: isMaximized ? '75%' : '88%',
                    background: m.sender === 'user' ? '#DDA0DD' : 'var(--bg-subtle, #f8fafc)',
                    color: m.sender === 'user' ? '#ffffff' : 'var(--text-main, #0f172a)',
                    padding: '11px 15px',
                    borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    border: m.sender === 'user' ? 'none' : '1px solid rgba(221, 160, 221, 0.25)',
                    fontSize: isMaximized ? 14 : 12.5,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <div>{m.sender === 'bot' ? translateDynamicText(m.text, lang) : m.text}</div>
                  {/* Voice Speaker Button on Bot Responses */}
                  {m.sender === 'bot' && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <VoiceSpeaker text={m.text} lang={lang} />
                    </div>
                  )}
                </div>
              ))}

              {/* Animated 3 Dots Thinking Bubble (...) */}
              {loading && (
                <div style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(221, 160, 221, 0.1)',
                  padding: '10px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  border: '1px solid rgba(221, 160, 221, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Bot size={15} color="#DDA0DD" />
                  <ThinkingDots label={t('analyzing', lang)} color="#DDA0DD" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleQuery(); }}
              style={{
                padding: '12px 14px',
                background: 'var(--bg-subtle, #f8fafc)',
                borderTop: '1px solid rgba(221, 160, 221, 0.3)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                placeholder={t('typePrompt', lang)}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid rgba(221, 160, 221, 0.4)',
                  borderRadius: 6,
                  padding: isMaximized ? '10px 14px' : '8px 12px',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: isMaximized ? 14 : 12.5,
                  outline: 'none',
                }}
              />
              {/* Mic Dictation Button */}
              <MicDictation
                lang={lang}
                onTranscript={(text) => setInput(text)}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  padding: isMaximized ? '10px 18px' : '8px 14px',
                  background: '#DDA0DD',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  opacity: loading || !input.trim() ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(221, 160, 221, 0.3)'
                }}
              >
                <Send size={15} color="#ffffff" />
              </button>
            </form>
          </div>
        )
      )}
    </>
  );
}
