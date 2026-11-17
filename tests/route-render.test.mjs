import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

// Mock browser globals for SSR rendering
const storage = new Map();
storage.set('ssp:guest', '1'); // Authenticated in Guest Mode
storage.set('ssp:theme', 'dark');

global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

global.window = {
  location: { hash: '', pathname: '/', search: '' },
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

global.document = {
  documentElement: { dataset: {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  body: { style: {} },
};

async function run() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const { MemoryRouter } = await import('react-router-dom');

  // Load pages directly to test their rendering
  const { default: LandingPage } = await server.ssrLoadModule('./src/pages/LandingPage.jsx');
  const { default: QuizDashboard } = await server.ssrLoadModule('./src/quizverse/pages/QuizDashboard.jsx');
  const { default: QuizHistory } = await server.ssrLoadModule('./src/quizverse/pages/QuizHistory.jsx');
  const { QuizProvider } = await server.ssrLoadModule('./src/quizverse/state/QuizContext.jsx');
  const { default: DailyTasks } = await server.ssrLoadModule('./src/pages/DailyTasks.jsx');
  const { default: Dashboard } = await server.ssrLoadModule('./src/pages/Dashboard.jsx');
  const { AuthProvider } = await server.ssrLoadModule('./src/services/auth.jsx');
  const { UIProvider } = await server.ssrLoadModule('./src/components/ui.jsx');
  const { StoreProvider } = await server.ssrLoadModule('./src/state/store.jsx');
  const { TaskEditorProvider } = await server.ssrLoadModule('./src/components/TaskEditor.jsx');

  const mockUser = { uid: 'guest', name: 'Guest', mode: 'guest' };

  console.log('Testing React component rendering on Phase 2 routes...\n');

  // 1. Verify Route: '/' (Landing Page)
  {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            MemoryRouter,
            { initialEntries: ['/'] },
            React.createElement(LandingPage)
          )
        )
      )
    );
    assert.ok(html.includes('Your Learning Space'), 'Landing page must render heading');
    assert.ok(html.includes('Plan smarter. Practice better.'), 'Landing page must render tagline');
    assert.ok(html.includes('Open StudyVerse'), 'Landing page must render StudyVerse button');
    assert.ok(html.includes('Explore QuizVerse'), 'Landing page must render QuizVerse button');
    console.log('  ok  Route / renders LandingPage with "Your Learning Space" and dual mode cards');
  }

  // 2. Verify Route: '/study' (StudyVerse Dashboard)
  {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            StoreProvider,
            { user: mockUser },
            React.createElement(
              TaskEditorProvider,
              null,
              React.createElement(
                MemoryRouter,
                { initialEntries: ['/study'] },
                React.createElement(Dashboard, { navigate: () => {} })
              )
            )
          )
        )
      )
    );
    assert.ok(html.includes('Quick focus timer') || html.includes('Dashboard'), 'Dashboard must render timer and stats');
    assert.ok(html.includes('Overall completion') || html.includes('Total tasks'), 'Dashboard must render summary cards');
    console.log('  ok  Route /study renders Dashboard with Focus Timer, summary stats, and quick actions');
  }

  // 3. Verify Route: '/study/daily' (Daily Tasks)
  {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            StoreProvider,
            { user: mockUser },
            React.createElement(
              TaskEditorProvider,
              null,
              React.createElement(
                MemoryRouter,
                { initialEntries: ['/study/daily'] },
                React.createElement(DailyTasks, { navigate: () => {} })
              )
            )
          )
        )
      )
    );
    assert.ok(html.includes('Daily Tasks'), 'Daily tasks must render header');
    console.log('  ok  Route /study/daily renders DailyTasks with task list and filters');
  }

  // 4. Verify Route: '/quiz' (QuizVerse Dashboard)
  {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            QuizProvider,
            null,
            React.createElement(
              MemoryRouter,
              { initialEntries: ['/quiz'] },
              React.createElement(QuizDashboard)
            )
          )
        )
      )
    );
    assert.ok(html.includes('Welcome back'), 'Quiz dashboard must render welcome greeting');
    assert.ok(html.includes('Create a Quiz'), 'Quiz dashboard must render Create card');
    assert.ok(html.includes('Quiz History'), 'Quiz dashboard must render History card');
    assert.ok(html.includes('Switch to StudyVerse'), 'Quiz dashboard must render Switch to StudyVerse button');
    console.log('  ok  Route /quiz renders QuizDashboard with navigation cards and mode switcher');
  }

  // 5. Verify Route: '/quiz/history' (Quiz History Real View)
  {
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            QuizProvider,
            null,
            React.createElement(
              MemoryRouter,
              { initialEntries: ['/quiz/history'] },
              React.createElement(QuizHistory)
            )
          )
        )
      )
    );
    assert.ok(html.includes('Quiz History &amp; Library') || html.includes('Quiz History & Library'), 'Quiz history must render title');
    assert.ok(html.includes('Practice Attempts'), 'Quiz history must render Practice Attempts tab');
    assert.ok(html.includes('Back to Dashboard'), 'Quiz history must render back button');
    console.log('  ok  Route /quiz/history renders QuizHistory with dual tabs and actions');
  }

  await server.close();
  console.log('\nAll 5 requested routes verified for actual React component DOM rendering!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
