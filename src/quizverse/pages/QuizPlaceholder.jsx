import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, FileText, GraduationCap, History, Play, Sparkles, Trophy } from 'lucide-react';

const CONFIG = {
  create: {
    title: 'Quiz Creator',
    badge: 'Under Development · Phase 4 & 5',
    icon: Sparkles,
    desc: 'Automated MCQ generation from topics and uploaded PDF, DOCX, or TXT study notes will be introduced here.',
    features: [
      'Custom topic entry with difficulty selector (Easy, Medium, Hard)',
      'Document notes upload (PDF, DOCX, TXT up to 5 MB)',
      'Configurable question counts and optional time limits',
    ],
  },
  play: {
    title: 'Quiz Player',
    badge: 'Under Development · Phase 6',
    icon: Play,
    desc: 'An interactive, distraction-free quiz taking environment powered by our drift-proof timestamp timer.',
    features: [
      'Timed and untimed testing options',
      'Instant answer selection and question review tray',
      'Immediate score calculation with zero background tab drift',
    ],
  },
  result: {
    title: 'Quiz Results & Review',
    badge: 'Under Development · Phase 7',
    icon: Trophy,
    desc: 'Comprehensive post-quiz review providing explanations, score breakdowns, and study recommendations.',
    features: [
      'Percentage score and accuracy summary',
      'Question-by-question explanations for correct and incorrect answers',
      'Integration with StudyVerse task planner to schedule revision for weak topics',
    ],
  },
  history: {
    title: 'Quiz History',
    badge: 'Under Development · Phase 7',
    icon: History,
    desc: 'A complete timeline of all your past quiz attempts, scores, and progress metrics.',
    features: [
      'Attempt logs with timestamps, score percentages, and time spent',
      'Visual performance analytics and score progression',
      'Option to re-take previously created quizzes',
    ],
  },
};

export default function QuizPlaceholder({ type = 'create' }) {
  const navigate = useNavigate();
  const params = useParams();
  const cfg = CONFIG[type] || CONFIG.create;
  const Icon = cfg.icon;

  return (
    <div className="quiz-placeholder-container">
      <div className="quiz-placeholder-card">
        <div className="quiz-placeholder-head">
          <div className="quiz-placeholder-icon" aria-hidden="true">
            <Icon size={28} />
          </div>
          <div>
            <h2>{cfg.title}</h2>
            <span className="quiz-badge">{cfg.badge}</span>
          </div>
        </div>

        {params.quizId && (
          <p className="quiz-param-note">
            Target Quiz ID: <code>{params.quizId}</code>
          </p>
        )}
        {params.attemptId && (
          <p className="quiz-param-note">
            Target Attempt ID: <code>{params.attemptId}</code>
          </p>
        )}

        <p className="quiz-placeholder-desc">{cfg.desc}</p>

        <div className="quiz-planned-box">
          <h4>Planned Capabilities for this Module:</h4>
          <ul>
            {cfg.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>

        <div className="quiz-placeholder-actions">
          <button className="btn secondary-quiz" onClick={() => navigate('/quiz')}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to QuizVerse</span>
          </button>
          <button className="btn primary" onClick={() => navigate('/study')}>
            <GraduationCap size={16} aria-hidden="true" />
            <span>Open StudyVerse</span>
          </button>
        </div>
      </div>
    </div>
  );
}
