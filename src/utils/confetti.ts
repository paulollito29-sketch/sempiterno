import confetti from 'canvas-confetti';

export function fireHeartConfetti() {
  confetti({
    particleCount: 50,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FF6E61', '#FFB5A7', '#FDE68A', '#FFFDF7'],
  });
}

export function fireSuperCelebration() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#FF6E61', '#FDE68A', '#FFB5A7', '#BEE1E6'],
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#FF6E61', '#FDE68A', '#FFB5A7', '#BEE1E6'],
    });

    if (Date.now() < animationEnd) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}
