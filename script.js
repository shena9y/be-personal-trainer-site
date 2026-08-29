// Sticky nav shadow
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});
menu.addEventListener('click', e => {
  if (e.target.tagName === 'A') {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }
});

// Active link on scroll
const links = [...menu.querySelectorAll('a')];
const sections = links
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => navObserver.observe(s));

// Animate progress rings when visible
const CIRC = 2 * Math.PI * 52;
document.querySelectorAll('.ring').forEach(ring => {
  const fg = ring.querySelector('.ring-fg');
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = CIRC;
  const value = Number(ring.dataset.value || 0);
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    fg.style.strokeDashoffset = CIRC * (1 - value / 100);
    io.disconnect();
  }, { threshold: 0.4 });
  io.observe(ring);
});

// Scroll reveal
const revealTargets = document.querySelectorAll(
  '.sec .display, .lead, .timeline, .split-copy, .split-media, .about-copy, .about-media, .icons > *, .plan, .etraining > *, .form, .contact-cols'
);
revealTargets.forEach(el => el.classList.add('reveal'));
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
revealTargets.forEach(el => revealObserver.observe(el));

// Video modal
const modal = document.getElementById('modal');
const modalBox = document.getElementById('modalBox');
const VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0';

function openModal() {
  modalBox.innerHTML =
    '<iframe src="' + VIDEO_URL + '" title="Showreel" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('modalClose').focus();
}
function closeModal() {
  modal.hidden = true;
  modalBox.innerHTML = '';
  document.body.style.overflow = '';
}
document.getElementById('videoBtn').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

// Contact form (client-side validation only — no backend wired up)
const form = document.getElementById('contactForm');
const status = document.getElementById('formStatus');

form.addEventListener('submit', e => {
  e.preventDefault();
  let ok = true;

  form.querySelectorAll('input, textarea').forEach(input => {
    const field = input.closest('.field');
    const err = field.querySelector('.err');
    let message = '';

    if (input.required && !input.value.trim()) {
      message = 'This field is required.';
    } else if (input.type === 'email' && input.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
      message = 'Enter a valid e-mail address.';
    }

    err.textContent = message;
    field.classList.toggle('invalid', Boolean(message));
    if (message) ok = false;
  });

  status.textContent = ok
    ? 'Thanks — your message is ready to send. Connect a form endpoint to deliver it.'
    : '';
  if (ok) form.reset();
});

document.getElementById('year').textContent = new Date().getFullYear();
