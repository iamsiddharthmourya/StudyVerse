import { useEffect, useRef, useState } from 'react';
import { Bot, Check, Info, Plus, Send, UserRound, X } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useUI } from '../components/ui.jsx';
import { AI_PROXY_URL, QUICK_ACTIONS, askRemoteAI, respond } from '../utils/assistant.js';
import { fmtDate, fmtDuration, fmtTime } from '../utils/dates.js';
import { validateTask } from '../utils/validation.js';

const WELCOME = {
  id: 'welcome',
  role: 'bot',
  source: 'local',
  text: 'Hi! I am the local demo study assistant. I use your real tasks, deadlines and settings to suggest study plans. Pick a quick action or type a question.',
};

let msgCounter = 0;
const nextId = () => `m${(msgCounter += 1)}`;

function Proposal({ p, onAdd, onDismiss, state }) {
  return (
    <div className={`proposal ${state || ''}`}>
      <div>
        <strong>{p.title}</strong>
        <div className="muted small">
          {p.subject} · {fmtDate(p.dueDate)}, {fmtTime(p.dueTime)} · {fmtDuration(p.duration)} · {p.priority} priority · {p.difficulty}
        </div>
      </div>
      {state === 'added' ? (
        <span className="badge t-teal"><Check size={12} aria-hidden="true" /> Added</span>
      ) : state === 'dismissed' ? (
        <span className="badge t-slate">Dismissed</span>
      ) : (
        <div className="row">
          <button className="btn primary sm" onClick={onAdd}><Plus size={14} aria-hidden="true" /> Add</button>
          <button className="btn ghost sm" onClick={onDismiss}><X size={14} aria-hidden="true" /> Dismiss</button>
        </div>
      )}
    </div>
  );
}

function BotBody({ m, onProposal, proposalState }) {
  return (
    <>
      <p>{m.text}</p>
      {m.plan && (
        <ol className="plan">
          {m.plan.map((r, i) => (
            <li key={i} className={r.kind}>
              <span className="plan-time">{r.label}</span>
              <div>
                <strong>{r.text}</strong>
                {r.meta && <div className="muted small">{r.meta}</div>}
                {r.why && <div className="why small">Why: {r.why}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {m.ranked && (
        <ol className="plan">
          {m.ranked.map((r, i) => (
            <li key={i} className="study">
              <span className="plan-time">#{i + 1}</span>
              <div>
                <strong>{r.title}</strong>
                <div className="muted small">{r.subject} · score {r.score}</div>
                <div className="why small">Why: {r.reasons.join(' · ')}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {m.tips && (
        <ul className="bullets">
          {m.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {m.suggestions && (
        <p className="muted small">Topics I know: {m.suggestions.join(', ')}.</p>
      )}
      {m.proposals?.map((p) => (
        <Proposal key={p.id} p={p} state={proposalState(p.id)} onAdd={() => onProposal(p, true)} onDismiss={() => onProposal(p, false)} />
      ))}
    </>
  );
}

export default function Assistant() {
  const { tasks, settings, addTask } = useStore();
  const { toast } = useUI();
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [decided, setDecided] = useState({}); // proposalId -> 'added' | 'dismissed'
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  const send = async (text) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: t }]);
    setThinking(true);
    await new Promise((r) => setTimeout(r, 350));

    let reply = respond(t, { tasks, settings, now: new Date(), pending });
    // If a real AI proxy is configured, use it for open-ended questions the local glossary cannot answer.
    if (AI_PROXY_URL && (reply.suggestions || /did not quite understand/.test(reply.text))) {
      try {
        const summary = tasks.filter((x) => !x.completed).slice(0, 15).map((x) => ({ title: x.title, subject: x.subject, due: x.dueDate, priority: x.priority }));
        const text2 = await askRemoteAI(t, { pendingTasks: summary });
        reply = { text: text2, source: 'remote' };
      } catch (err) {
        reply = { ...reply, text: `${reply.text} (The AI service could not be reached, so the local assistant answered.)` };
      }
    }
    setPending(reply.pending || null);
    setMessages((m) => [...m, { id: nextId(), role: 'bot', ...reply }]);
    setThinking(false);
  };

  const onProposal = (p, approve) => {
    if (!approve) {
      setDecided((d) => ({ ...d, [p.id]: 'dismissed' }));
      return;
    }
    const values = { ...p, duration: String(p.duration) };
    const errs = validateTask(values);
    if (Object.keys(errs).length) {
      toast(`Could not add the task: ${Object.values(errs)[0]}`, 'error');
      return;
    }
    addTask(values);
    setDecided((d) => ({ ...d, [p.id]: 'added' }));
    toast('Task added to your planner.');
  };

  const clear = () => {
    setMessages([WELCOME]);
    setPending(null);
    setDecided({});
  };

  return (
    <div className="chat-page">
      <div className="banner info" role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>Local demo assistant.</strong>{' '}
          {AI_PROXY_URL
            ? 'Planning uses built-in rules. Open-ended questions are sent to your configured AI service.'
            : 'It is rule-based, not a real AI model: plans come from a transparent scoring rule, and topic explanations come from a small built-in glossary.'}
        </span>
      </div>

      <div className="chat card">
        <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              <div className="msg-avatar" aria-hidden="true">{m.role === 'bot' ? <Bot size={18} /> : <UserRound size={18} />}</div>
              <div className="msg-bubble">
                {m.role === 'bot' ? (
                  <>
                    <BotBody m={m} onProposal={onProposal} proposalState={(id) => decided[id]} />
                    <div className="msg-source">{m.source === 'remote' ? 'AI service' : 'Local demo assistant'}</div>
                  </>
                ) : (
                  <p>{m.text}</p>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="msg bot">
              <div className="msg-avatar" aria-hidden="true"><Bot size={18} /></div>
              <div className="msg-bubble typing" aria-label="Assistant is typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="quick" role="group" aria-label="Quick actions">
          {QUICK_ACTIONS.map((q) => (
            <button key={q.id} className="chip" onClick={() => send(q.label)} disabled={thinking}>
              {q.label}
            </button>
          ))}
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label className="sr-only" htmlFor="chat-text">Message the study assistant</label>
          <input id="chat-text" className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={pending === 'plan-time' ? 'e.g. 90 minutes' : 'Ask for a plan, or type a topic to explain…'} autoComplete="off" maxLength={500} />
          <button className="btn primary" type="submit" disabled={!input.trim() || thinking}>
            <Send size={16} aria-hidden="true" /> Send
          </button>
          <button className="btn ghost" type="button" onClick={clear}>
            Clear
          </button>
        </form>
      </div>
    </div>
  );
}
