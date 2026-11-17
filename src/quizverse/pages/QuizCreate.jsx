import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Layers,
  Loader2,
  Play,
  PlusCircle,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';
import { useQuiz } from '../state/QuizContext.jsx';
import { useUI } from '../../components/ui.jsx';
import { SAMPLE_QUIZZES } from '../utils/sampleQuizzes.js';
import { fetchDailyQuota, generateQuizWithBackend } from '../services/quizApi.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

export default function QuizCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // Quota & generation state
  const [quota, setQuota] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [apiError, setApiError] = useState('');
  const [isSubmittingSample, setIsSubmittingSample] = useState(false);

  // Load daily quota on mount
  useEffect(() => {
    let active = true;
    async function loadQuota() {
      try {
        const q = await fetchDailyQuota(user);
        if (active && q) {
          setQuota(q);
        }
      } catch (err) {
        console.warn('Could not load quota:', err);
      }
    }
    loadQuota();
    return () => {
      active = false;
    };
  }, [user]);

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

  // Trigger AI Generation
  const handleGenerateClick = async (e) => {
    e.preventDefault();
    setApiError('');
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

    // Check quota client-side warning
    if (quota && quota.remaining <= 0) {
      setApiError('You have reached your daily limit of 5 AI quizzes. Quota resets at midnight IST.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep(
      sourceMode === 'document'
        ? 'Extracting document text and analyzing concepts…'
        : 'Formulating questions and explanations with Gemini AI…'
    );

    try {
      const result = await generateQuizWithBackend(
        user,
        {
          sourceType: sourceMode,
          topic: topic.trim(),
          subject: subject.trim(),
          instructions: instructions.trim(),
          difficulty,
          questionCount,
        },
        selectedFile
      );

      // Save generated quiz into user store
      setGenerationStep('Saving quiz to your library…');
      const savedQuiz = await createQuiz(result.quiz);

      // Update quota display
      if (result.quota) {
        setQuota((prev) => ({ ...prev, ...result.quota }));
      }

      toast(`Quiz "${savedQuiz.title}" created with Gemini AI!`, 'success');
      navigate(`/quiz/play/${savedQuiz.id}`);
    } catch (err) {
      console.error('Quiz generation error:', err);
      setApiError(err.message || 'Failed to generate quiz. Please check your connection or try again.');

      // Refresh quota if 429
      if (err.status === 429 || err.code === 'DAILY_QUOTA_EXCEEDED') {
        const q = await fetchDailyQuota(user);
        if (q) setQuota(q);
      }
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Create a sample quiz immediately
  const handleCreateSampleQuiz = async (sampleIndex = 0) => {
    setIsSubmittingSample(true);
    setApiError('');
    try {
      const sample = SAMPLE_QUIZZES[sampleIndex] || SAMPLE_QUIZZES[0];
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
      toast('Practice quiz ready!', 'success');
      navigate(`/quiz/play/${created.id}`);
    } catch (err) {
      toast(err.message || 'Failed to create starter quiz.', 'error');
    } finally {
      setIsSubmittingSample(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isQuotaExceeded = quota && quota.remaining <= 0;

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
          <div className="quiz-create-title-row">
            <div>
              <h1>Create New Quiz</h1>
              <p className="muted">
                Synthesize questions from study topics or lecture notes powered by Google Gemini.
              </p>
            </div>

            {/* Daily Quota Pill Badge */}
            {quota && (
              <div className={`quota-status-pill ${isQuotaExceeded ? 'quota-exhausted' : ''}`}>
                <Sparkles size={14} className="teal-icon" aria-hidden="true" />
                <span>
                  Daily AI Quota: <strong>{quota.remaining} / {quota.limit}</strong> remaining
                </span>
                <span className="quota-tooltip-icon" title="Resets daily at Midnight IST (UTC+05:30)">
                  <Clock size={13} aria-hidden="true" />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quota Exceeded Warning Banner */}
        {isQuotaExceeded && (
          <div className="card quota-alert-card" role="alert">
            <div className="quota-alert-head">
              <AlertCircle size={20} className="alert-icon-warning" aria-hidden="true" />
              <div>
                <strong>Daily Generation Limit Reached (5/5)</strong>
                <p className="muted small">
                  You have used all 5 of your free AI quiz generations for today. Your quota resets at{' '}
                  <strong>Midnight IST (00:00 IST)</strong>.
                </p>
              </div>
            </div>
            <p className="small muted">
              You can still practice all previously created quizzes, review results, or test with our sample quizzes below without consuming quota.
            </p>
          </div>
        )}

        {/* API Error Alert */}
        {apiError && (
          <div className="card quota-alert-card error-card" role="alert">
            <div className="quota-alert-head">
              <AlertTriangle size={20} className="alert-icon-error" aria-hidden="true" />
              <div>
                <strong>Quiz Generation Notice</strong>
                <p className="small">{apiError}</p>
              </div>
            </div>
          </div>
        )}

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
                  disabled={isGenerating}
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
                  disabled={isGenerating}
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
                      placeholder="e.g. Cellular Respiration and Krebs Cycle"
                      value={topic}
                      onChange={(e) => {
                        setTopic(e.target.value);
                        if (fieldErrors.topic) setFieldErrors((prev) => ({ ...prev, topic: '' }));
                      }}
                      maxLength={200}
                      disabled={isGenerating}
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
                      disabled={isGenerating}
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
                      disabled={isGenerating}
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
                    disabled={isGenerating}
                  />

                  {!selectedFile ? (
                    <div
                      className={`file-dropzone ${isDragging ? 'dragging' : ''} ${
                        fieldErrors.file || fileError ? 'has-error' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => !isGenerating && fileInputRef.current?.click()}
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
                          {formatFileSize(selectedFile.size)} · Ready for text extraction
                        </span>
                      </div>
                      <div className="file-card-actions">
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => fileInputRef.current?.click()}
                          title="Choose a different file"
                          disabled={isGenerating}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm"
                          onClick={handleRemoveFile}
                          title="Remove file"
                          aria-label="Remove file"
                          disabled={isGenerating}
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
                        disabled={isGenerating}
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
                        disabled={isGenerating}
                      >
                        {num} Qs
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Format */}
                <div className="field">
                  <label>Question Format</label>
                  <div className="static-format-pill">
                    <CheckCircle2 size={15} className="teal-icon" aria-hidden="true" />
                    <span>Multiple Choice (MCQ) · 4 Options with Explanations</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Progress status banner when generating */}
            {isGenerating && (
              <div className="ai-generating-banner">
                <Loader2 size={18} className="spin teal-icon" aria-hidden="true" />
                <span className="generating-text">{generationStep}</span>
              </div>
            )}

            {/* Form Actions */}
            <div className="form-actions-footer">
              <button
                type="submit"
                className="btn primary lg generate-btn"
                disabled={isGenerating || isQuotaExceeded}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="spin" aria-hidden="true" />
                    <span>Generating Quiz…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} aria-hidden="true" />
                    <span>Generate AI Quiz</span>
                  </>
                )}
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
                  <p className="muted small">Instant test quizzes (Consumes 0 AI quota)</p>
                </div>
              </div>
              <p className="small muted">
                Want to practice or verify the Quiz Player without consuming your daily AI quota? Load one of our structured sample quizzes:
              </p>

              <div className="sample-quiz-buttons">
                {SAMPLE_QUIZZES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="sample-quiz-card-btn"
                    onClick={() => handleCreateSampleQuiz(idx)}
                    disabled={isGenerating || isSubmittingSample}
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
                <strong>Daily Quota Policy</strong>
              </div>
              <p className="muted small">
                Every user is granted 5 AI quiz generations per day. Failed requests, taking quizzes, and reviewing explanations never consume quota. Resets every night at midnight IST.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
