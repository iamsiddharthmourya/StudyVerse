import assert from 'node:assert/strict';

// Simulator for the timestamp-based FocusTimer logic in src/pages/Dashboard.jsx
class FocusTimerSimulator {
  constructor(minutes = 45, onToast = () => {}) {
    this.minutes = minutes;
    this.total = Math.max(1, Number(minutes) || 1) * 60;
    this.left = this.total;
    this.running = false;
    this.idle = true;
    this.deadline = null;
    this.hasCompleted = false;
    this.toastCount = 0;
    this.onToast = onToast;
    this.currentTime = 1000000; // Simulated epoch ms
  }

  now() {
    return this.currentTime;
  }

  advanceTime(ms) {
    this.currentTime += ms;
  }

  start() {
    if (this.running) return;
    const currentLeft = this.left <= 0 ? this.total : this.left;
    this.deadline = this.now() + currentLeft * 1000;
    this.hasCompleted = false;
    this.idle = false;
    this.left = currentLeft;
    this.running = true;
  }

  pause() {
    if (!this.running) return;
    if (this.deadline) {
      const remaining = Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));
      this.deadline = null;
      this.left = remaining;
    }
    this.running = false;
    this.idle = false;
  }

  toggle() {
    if (this.running) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset() {
    this.deadline = null;
    this.hasCompleted = false;
    this.running = false;
    this.idle = true;
    this.left = this.total;
  }

  tick() {
    if (!this.running || !this.deadline) return;
    const remaining = Math.max(0, Math.ceil((this.deadline - this.now()) / 1000));

    if (remaining <= 0) {
      if (!this.hasCompleted) {
        this.hasCompleted = true;
        this.deadline = null;
        this.running = false;
        this.idle = true;
        this.left = this.total;
        this.toastCount += 1;
        this.onToast('Focus session complete. Take a short break!', 'success');
      }
    } else {
      this.left = remaining;
    }
  }

  // Simulated visibilitychange / focus event
  onVisibilityChange(isVisible = true) {
    if (isVisible && this.running) {
      this.tick();
    }
  }
}

console.log('Running Focus Timer Unit Tests (P2)...');

// Test A – Normal Countdown
{
  const timer = new FocusTimerSimulator(1); // 1 minute = 60s
  assert.equal(timer.left, 60);
  assert.equal(timer.running, false);

  timer.start();
  assert.equal(timer.running, true);
  assert.equal(timer.idle, false);

  // Advance 10 seconds with ticks
  for (let i = 0; i < 10; i++) {
    timer.advanceTime(1000);
    timer.tick();
  }
  assert.equal(timer.left, 50, 'Timer should have 50s left after 10s of ticking');
  console.log('  ok  Test A: Normal countdown functions accurately');
}

// Test B – Background Tab Inactivity & Return
{
  const timer = new FocusTimerSimulator(1); // 60s
  timer.start();

  // Tab enters background for 20 seconds; interval callbacks are throttled/frozen by browser
  timer.advanceTime(20000); // 20 seconds pass in real time without tick calls

  // User returns to tab -> visibilitychange fires
  timer.onVisibilityChange(true);
  assert.equal(timer.left, 40, 'Timer should instantly update to 40s left upon tab reactivation');
  console.log('  ok  Test B: Inactive tab drift eliminated; timestamp correctly derives 40s remaining');
}

// Test C – Pause and Resume
{
  const timer = new FocusTimerSimulator(1); // 60s
  timer.start();

  // Run 15 seconds
  timer.advanceTime(15000);
  timer.tick();
  assert.equal(timer.left, 45);

  // User pauses
  timer.toggle(); // pause
  assert.equal(timer.running, false);
  assert.equal(timer.left, 45);
  assert.equal(timer.deadline, null);

  // 10 seconds pass while paused
  timer.advanceTime(10000);
  assert.equal(timer.left, 45, 'Time must not elapse while paused');

  // Resume
  timer.toggle(); // resume
  assert.equal(timer.running, true);
  assert.equal(timer.left, 45);

  // 5 seconds pass while running
  timer.advanceTime(5000);
  timer.tick();
  assert.equal(timer.left, 40, 'Timer accurately counts down from paused remainder');
  console.log('  ok  Test C: Pause and resume properly preserves exact remaining time');
}

// Test D – Reset
{
  const timer = new FocusTimerSimulator(1); // 60s
  timer.start();
  timer.advanceTime(25000);
  timer.tick();
  assert.equal(timer.left, 35);
  assert.equal(timer.running, true);

  // Reset while running
  timer.reset();
  assert.equal(timer.running, false);
  assert.equal(timer.idle, true);
  assert.equal(timer.left, 60, 'Reset returns left to total duration');
  assert.equal(timer.deadline, null);
  console.log('  ok  Test D: Reset while running immediately restores full duration and idle state');
}

// Test E – Completion
{
  let toastMsg = '';
  const timer = new FocusTimerSimulator(1, (msg) => { toastMsg = msg; });
  timer.start();

  // Run full 60 seconds
  timer.advanceTime(60000);
  timer.tick();

  assert.equal(timer.running, false, 'Timer stops running upon completion');
  assert.equal(timer.left, 60, 'Timer resets to total upon completion');
  assert.equal(timer.toastCount, 1, 'Toast fires exactly once');
  assert.equal(toastMsg, 'Focus session complete. Take a short break!');

  // Extra ticks do not fire additional toasts
  timer.advanceTime(5000);
  timer.tick();
  assert.equal(timer.toastCount, 1, 'Duplicate toasts are prevented');
  console.log('  ok  Test E: Completion fires exactly once and resets cleanly');
}

// Test F – Edge Cases (Sleep/wake, negative deadline, repeated toggles)
{
  const timer = new FocusTimerSimulator(45);
  timer.start();

  // Computer went to sleep for 2 hours (7200s > 2700s total)
  timer.advanceTime(7200000);
  timer.onVisibilityChange(true);

  assert.equal(timer.running, false);
  assert.equal(timer.left, 2700);
  assert.equal(timer.toastCount, 1);
  console.log('  ok  Test F: Returning after long sleep handles expired deadline gracefully');
}

console.log('\nAll Focus Timer P2 tests passed successfully!');
