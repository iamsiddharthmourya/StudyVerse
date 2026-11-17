import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  Play,
  PlusCircle,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useQuiz } from '../state/QuizContext.jsx';
import { useUI, Modal } from '../../components/ui.jsx';
import { SAMPLE_QUIZZES } from '../utils/sampleQuizzes.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export default function QuizCreate() {
  const navigate = useNavigate();
  const { createQuiz } = useQuiz();
  const { toast } = useUI();
  const fileInputRef = useRef(null);

  // Form state
  const [sourceMode, setSourceMode] = useState('topic'); // 'topic' | 'document'
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [difficulty, setDifficulty] = useState('medium'); // 'easy' | 'medium' | 'hard'
  const [questionCount, setQuestionCount] = useState(10); // 5 | 10 | 15 | 20

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Validation & modal state
  const [fieldErrors, setFieldErrors] = useState({});
  const [showAiModal, setShowAiModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File validation
  const validateAndSetFile = (file) => {
    setFileError('');
    if (!file) return;

    // Check extension
    const name = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasValidExt) {
      setFileError('Unsupported file format. Please upload a PDF (.pdf), Word doc (.docx), or text file (.txt).');
      setSelectedFile(null);
      return;
    }

    // Check size limit: 5 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setFileError(`File exceeds maximum size limit of 5 MB. Selected file is ${sizeMb} MB.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setFileError('');
    setFieldErrors((prev) => ({ ...prev, file: '' }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Trigger form validation and show Phase 5 info modal
  const handleGenerateClick = (e) => {
    e.preventDefault();
    const errors = {};

    if (sourceMode === 'topic') {
      if (!topic.trim()) {
        errors.topic = 'Please enter a quiz topic (e.g. "Photosynthesis", "Data Structures").';
      }
    } else if (sourceMode === 'document') {
      if (!selectedFile) {
        errors.file = 'Please upload a PDF, DOCX, or TXT file (up to 5 MB).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setShowAiModal(true);
  };

  // Create a real sample quiz immediately so user can test the Quiz Player & Results
  const handleCreateSampleQuiz = async (sampleIndex = 0) => {
    setIsSubmitting(true);
    try {
      const sample = SAMPLE_QUIZZES[sampleIndex] || SAMPLE_QUIZZES[0];
      // Clone and adjust title if user provided topic
      const customTitle = topic.trim()
        ? `${topic.trim()} (Practice Quiz)`
        : sample.title;

      const newQuizData = {
        ...sample,
        title: customTitle,
        sourceType: sourceMode,
        sourceName: subject.trim() || sample.sourceName,
        difficulty,
      };

      const created = await createQuiz(newQuizData);
      toast('Quiz created! Ready for practice.', 'success');
      setShowAiModal(false);
      navigate(`/quiz/play/${created.id}`);
    } catch (err) {
      toast(err.message || 'Failed to create quiz.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="quiz-shell">
      <QuizTopBar />

      <main className="quiz-main">
        {/* Back Link & Header */}
        <div className="quiz-create-header">
          <button
            className="btn ghost sm back-btn"
            onClick={() => navigate('/quiz')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
          <h1>Create New Quiz</h1>
          <p className="muted">
            Configure your topic or study notes, choose question difficulty, and generate practice questions.
          </p>
        </div>

        <div className="quiz-create-grid">
          {/* Main Creator Form */}
          <form className="card quiz-form-card" onSubmit={handleGenerateClick}>
            {/* Step 1: Source Material */}
            <section className="form-section">
              <label className="section-label">
                <span className="step-num">1</span>
                <strong>Choose Source Material</strong>
              </label>

              <div className="source-toggle-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'topic'}
                  className={`source-tab ${sourceMode === 'topic' ? 'active' : ''}`}
                  onClick={() => {
                    setSourceMode('topic');
                    setFieldErrors({});
                  }}
                >
                  <Sparkles size={18} aria-hidden="true" />
                  <div>
                    <strong>Topic-based</strong>
                    <span>Generate from subject & keywords</span>
                  </div>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'document'}
                  className={`source-tab ${sourceMode === 'document' ? 'active' : ''}`}
                  onClick={() => {
                    setSourceMode('document');
                    setFieldErrors({});
                  }}
                >
                  <FileText size={18} aria-hidden="true" />
                  <div>
                    <strong>Notes-based</strong>
                    <span>Upload PDF, DOCX, or TXT (up to 5 MB)</span>
                  </div>
                </button>
              </div>

              {/* Topic Mode Fields */}
              {sourceMode === 'topic' && (
                <div className="source-fields-group">
                  <div className={`field ${fieldErrors.topic ? 'has-error' : ''}`}>
                    <label htmlFor="quiz-topic">
                      Quiz Topic <span className="req">*</span>
                    </label>
                    <input
                      id="quiz-topic"
                      type="text"
                      placeholder="e.g. Cellular Respiration and ATP Synthesis"
                      value={topic}
                      onChange={(e) => {
                        setTopic(e.target.value);
                        if (fieldErrors.topic) setFieldErrors((prev) => ({ ...prev, topic: '' }));
                      }}
                      maxLength={200}
                    />
                    {fieldErrors.topic ? (
                      <p className="field-err" role="alert">
                        <AlertTriangle size={13} aria-hidden="true" /> {fieldErrors.topic}
                      </p>
                    ) : (
                      <p className="hint">The specific topic or concept you want to practice.</p>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="quiz-subject">Subject or Course (Optional)</label>
                    <input
                      id="quiz-subject"
                      type="text"
                      placeholder="e.g. AP Biology, CS 101, Organic Chemistry"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quiz-instructions">Focus Areas & Instructions (Optional)</label>
                    <textarea
                      id="quiz-instructions"
                      rows={3}
                      placeholder="e.g. Focus on light-dependent reactions, enzyme regulation, and electron transport chain..."
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      maxLength={1000}
                    />
                  </div>
                </div>
              )}

              {/* Notes Mode Fields */}
              {sourceMode === 'document' && (
                <div className="source-fields-group">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="quiz-doc-upload"
                    accept=".pdf,.docx,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />

                  {!selectedFile ? (
                    <div
                      className={`file-dropzone ${isDragging ? 'dragging' : ''} ${fieldErrors.file || fileError ? 'has-error' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="dropzone-icon">
                        <Upload size={28} aria-hidden="true" />
                      </div>
                      <div className="dropzone-text">
                        <strong>Drag & drop your study notes here</strong>
                        <span>or click to browse your files</span>
                      </div>
                      <div className="dropzone-badge muted small">
                        Supported: PDF, DOCX, TXT · Maximum size: 5 MB
                      </div>
                    </div>
                  ) : (
                    <div className="selected-file-card">
                      <div className="file-card-icon">
                        <FileText size={24} aria-hidden="true" />
                      </div>
                      <div className="file-card-info">
                        <strong className="file-name">{selectedFile.name}</strong>
                        <span className="file-size muted small">
                          {formatFileSize(selectedFile.size)} · Ready for quiz generation
                        </span>
                      </div>
                      <div className="file-card-actions">
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => fileInputRef.current?.click()}
                          title="Choose a different file"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm"
                          onClick={handleRemoveFile}
                          title="Remove file"
                          aria-label="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {fileError && (
                    <p className="field-err" role="alert">
                      <AlertTriangle size={13} aria-hidden="true" /> {fileError}
                    </p>
                  )}
                  {fieldErrors.file && (
                    <p className="field-err" role="alert">
                      <AlertTriangle size={13} aria-hidden="true" /> {fieldErrors.file}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Quiz Configuration */}
            <section className="form-section">
              <label className="section-label">
                <span className="step-num">2</span>
                <strong>Quiz Configuration</strong>
              </label>

              <div className="config-grid">
                {/* Difficulty Selector */}
                <div className="field">
                  <label>Difficulty Level</label>
                  <div className="selector-pills" role="radiogroup" aria-label="Difficulty level">
                    {[
                      { id: 'easy', label: 'Easy' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'hard', label: 'Hard' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        role="radio"
                        aria-checked={difficulty === d.id}
                        className={`pill-option ${difficulty === d.id ? 'active' : ''}`}
                        onClick={() => setDifficulty(d.id)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Count Selector */}
                <div className="field">
                  <label>Number of Questions</label>
                  <div className="selector-pills" role="radiogroup" aria-label="Number of questions">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        role="radio"
                        aria-checked={questionCount === num}
                        className={`pill-option ${questionCount === num ? 'active' : ''}`}
                        onClick={() => setQuestionCount(num)}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Type */}
                <div className="field">
                  <label>Question Format</label>
                  <div className="static-format-pill">
                    <CheckCircle2 size={15} className="teal-icon" aria-hidden="true" />
                    <span>Multiple Choice (MCQ) · 4 Options with Explanations</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Form Actions */}
            <div className="form-actions-footer">
              <button
                type="submit"
                className="btn primary lg generate-btn"
              >
                <Sparkles size={18} aria-hidden="true" />
                <span>Generate Quiz</span>
              </button>
            </div>
          </form>

          {/* Sidebar / Quick Start Starter Quizzes */}
          <aside className="quiz-create-sidebar">
            <div className="card quick-start-card">
              <div className="quick-start-head">
                <div className="quick-icon-wrap">
                  <Layers size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3>Ready-to-Test Sample Quizzes</h3>
                  <p className="muted small">Instant test quizzes for Phase 4 verification</p>
                </div>
              </div>
              <p className="small muted">
                Want to test the interactive quiz player, drift-proof timer, and results engine right now?
                Load one of our structured sample quizzes:
              </p>

              <div className="sample-quiz-buttons">
                {SAMPLE_QUIZZES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="sample-quiz-card-btn"
                    onClick={() => handleCreateSampleQuiz(idx)}
                    disabled={isSubmitting}
                  >
                    <div className="sample-btn-title">
                      <strong>{sample.title}</strong>
                      <span className="muted small">{sample.questions.length} Questions · Medium</span>
                    </div>
                    <Play size={16} className="sample-play-icon" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <div className="card phase-info-card">
              <div className="phase-info-head">
                <Info size={18} className="info-icon" aria-hidden="true" />
                <strong>Phase 4 & 5 Roadmap</strong>
              </div>
              <p className="muted small">
                Phase 4 establishes the complete interactive frontend, file size validation (≤ 5 MB),
                and data wiring. Phase 5 will connect this screen directly to our secure Google Gemini serverless backend.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Phase 5 AI Connection Modal */}
      <Modal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="AI Quiz Generation (Phase 5)"
      >
        <div className="ai-modal-content">
          <div className="ai-modal-badge">
            <Sparkles size={16} aria-hidden="true" />
            <span>Scheduled for Phase 5</span>
          </div>

          <p>
            Your quiz inputs have been validated:
          </p>
          <ul className="ai-modal-specs">
            <li>
              <strong>Source:</strong>{' '}
              {sourceMode === 'topic' ? `Topic: "${topic}"` : `Document: "${selectedFile?.name}"`}
            </li>
            <li>
              <strong>Settings:</strong> {questionCount} Questions · {difficulty.toUpperCase()} difficulty
            </li>
          </ul>

          <div className="ai-notice-callout">
            <Info size={18} aria-hidden="true" className="notice-icon" />
            <div>
              <strong>Gemini AI Backend Connection:</strong>
              <p className="muted small">
                Automated document parsing and dynamic AI question generation are scheduled for Phase 5
                via our secure Vercel serverless backend.
              </p>
            </div>
          </div>

          <p className="muted small">
            To test the Quiz Player, timer, answer tracking, and score results right now, you can create
            a starter quiz based on your topic:
          </p>

          <div className="modal-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowAiModal(false)}
            >
              Keep Editing
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => handleCreateSampleQuiz(0)}
              disabled={isSubmitting}
            >
              <Play size={16} aria-hidden="true" />
              <span>{isSubmitting ? 'Creating…' : 'Create & Play Practice Quiz'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
