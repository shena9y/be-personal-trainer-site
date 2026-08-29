// Sticky nav shadow, scroll progress bar, back-to-top, hero parallax
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const nav = document.getElementById("nav");
const progress = document.getElementById("scrollProgress");
const toTop = document.getElementById("toTop");
const heroImg = document.querySelector(".hero-media img");

let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-stuck", y > 40);
    if (progress)
      progress.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    if (toTop) toTop.classList.toggle("show", y > 600);
    if (heroImg && !prefersReducedMotion) {
      heroImg.style.transform =
        "scale(1.15) translateY(" + Math.min(y * 0.3, 260) + "px)";
    }
    ticking = false;
  });
};
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

if (toTop) {
  toTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  });
}

// Mobile menu
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
burger.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
});
menu.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }
});

// Active link on scroll (in-page anchors only — skip /login.html, /signup.html, …)
const links = [...menu.querySelectorAll('a[href^="#"]:not([href="#"])')];
const sections = links
  .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
  .filter(Boolean);

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) =>
        a.classList.toggle(
          "active",
          a.getAttribute("href") === "#" + entry.target.id,
        ),
      );
    });
  },
  { rootMargin: "-45% 0px -50% 0px" },
);
sections.forEach((s) => navObserver.observe(s));

// Animate progress rings when visible
const CIRC = 2 * Math.PI * 52;
document.querySelectorAll(".ring").forEach((ring) => {
  const fg = ring.querySelector(".ring-fg");
  fg.style.strokeDasharray = CIRC;
  fg.style.strokeDashoffset = CIRC;
  const value = Number(ring.dataset.value || 0);
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      fg.style.strokeDashoffset = CIRC * (1 - value / 100);
      io.disconnect();
    },
    { threshold: 0.4 },
  );
  io.observe(ring);
});

// Scroll reveal
const revealTargets = document.querySelectorAll(
  ".sec .display, .lead, .timeline, .split-copy, .split-media, .about-copy, .about-media, .icons > *, .plan, .etraining > *, .form, .contact-cols, .stats-grid",
);
revealTargets.forEach((el) => el.classList.add("reveal"));
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        revealObserver.unobserve(e.target);
      }
    });
  },
  { threshold: 0.15 },
);
revealTargets.forEach((el) => revealObserver.observe(el));

// Typewriter hero word
const typedEl = document.getElementById("typed");
if (typedEl) {
  const words = ["strength", "stamina", "confidence", "momentum"];
  if (prefersReducedMotion) {
    typedEl.textContent = words[0];
  } else {
    let wi = 0;
    let ci = 0;
    let deleting = false;
    typedEl.textContent = "";
    const type = () => {
      const word = words[wi];
      if (!deleting) {
        typedEl.textContent = word.slice(0, ++ci);
        if (ci === word.length) {
          deleting = true;
          setTimeout(type, 1800);
          return;
        }
        setTimeout(type, 60 + Math.random() * 50);
      } else {
        typedEl.textContent = word.slice(0, --ci);
        if (ci === 0) {
          deleting = false;
          wi = (wi + 1) % words.length;
        }
        setTimeout(type, 40);
      }
    };
    setTimeout(type, 700);
  }
}

// Hero wave — draw the lines in once visible, then the dot keeps running
const wave = document.querySelector(".wave");
if (wave) {
  wave.querySelectorAll("path").forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });
  const waveIo = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      wave.classList.add("live");
      wave.querySelectorAll("path").forEach((p) => {
        p.style.strokeDashoffset = 0;
      });
      waveIo.disconnect();
    },
    { threshold: 0.3 },
  );
  waveIo.observe(wave);
}

// Animated stat counters
function initCounters() {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.dataset.target);
        const decimals = Number(el.dataset.decimals || 0);
        const suffix = el.dataset.suffix || "";
        const fmt = (n) =>
          n.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }) + suffix;
        if (prefersReducedMotion) {
          el.textContent = fmt(target);
          return;
        }
        const t0 = performance.now();
        const dur = 1400;
        const tick = (now) => {
          const p = Math.min((now - t0) / dur, 1);
          el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll(".stat-num").forEach((el) => io.observe(el));
  return io;
}
initCounters();

// Pull the coaching figures from the backend when it is reachable; otherwise
// the values baked into the markup are used unchanged.
async function renderStats() {
  try {
    const res = await fetch("http://localhost:3000/api/stats");
    if (!res.ok) return;
    const data = await res.json();
    const stats = data.stats || [];
    document.querySelectorAll(".stat-num").forEach((el) => {
      const match = stats.find((s) => s.slug === el.dataset.slug);
      if (!match) return;
      el.dataset.target = String(match.value);
      el.dataset.decimals = String(match.decimals || 0);
      el.dataset.suffix = match.suffix || "";
      el.textContent = "0";
    });
    initCounters(); // re-observe so the live values animate in
  } catch (_) {
    /* backend offline — static values remain */
  }
}
renderStats();

// Pricing billing toggle (event delegation — keeps working after the cards
// are re-rendered from the plans API)
const billBtns = document.querySelectorAll(".bill-btn");
const plansWrap = document.querySelector(".plans");
const billing = document.querySelector(".billing");
if (billing && plansWrap) {
  billing.addEventListener("click", (e) => {
    const btn = e.target.closest(".bill-btn");
    if (!btn || btn.classList.contains("active")) return;
    billBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const mode = btn.dataset.bill;
    plansWrap.classList.add("is-switching");
    setTimeout(() => {
      document.querySelectorAll(".price").forEach((price) => {
        const num = price.querySelector(".price-num");
        const note = price.querySelector(".price-note");
        if (num) num.textContent = "$" + price.dataset[mode];
        if (note)
          note.textContent =
            mode === "yearly" ? "/mo · billed annually" : "/month";
      });
      plansWrap.classList.remove("is-switching");
    }, 210);
  });
}

// 3D tilt on plan cards (hover-capable pointers, motion-safe). A `data-tilt`
// guard means cards re-rendered from the plans API get listeners too.
const useTilt =
  !prefersReducedMotion &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;
function initTilt() {
  if (!useTilt) return;
  document.querySelectorAll(".plan").forEach((plan) => {
    if (plan.dataset.tilt) return;
    plan.dataset.tilt = "1";
    plan.classList.add("plan-tilt");
    const move = (e) => {
      const r = plan.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      plan.style.transform =
        "rotateX(" + -py * 6 + "deg) rotateY(" + px * 6 + "deg)";
    };
    const leave = () => {
      plan.style.transform = "";
    };
    plan.addEventListener("pointermove", move);
    plan.addEventListener("pointerleave", leave);
  });
}
initTilt();

// Pricing cards — prefer the backend's plans when available, otherwise keep
// the markup baked into index.html.
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

async function renderPlans() {
  const wrap = document.querySelector(".plans");
  if (!wrap) return;
  try {
    const res = await fetch("http://localhost:3000/api/plans");
    if (!res.ok) return;
    const data = await res.json();
    const plans = data.plans || [];
    if (!plans.length) return;
    wrap.innerHTML = plans
      .map(
        (plan) => `
      <article class="plan${plan.accent ? " is-" + plan.accent : ""}">
        <h3>${escapeHTML(plan.name)}</h3>
        <p>${escapeHTML(plan.tagline)}</p>
        <ul>
          ${(plan.features || [])
            .map(
              (f) =>
                `<li class="${f.included ? "yes" : "no"}">${escapeHTML(f.text)}</li>`,
            )
            .join("")}
        </ul>
        <div class="price" data-monthly="${plan.priceMonthly}" data-yearly="${plan.priceYearly}">
          <b class="price-num">$${plan.priceMonthly}</b><small class="price-note">/month</small>
        </div>
        <a class="plan-cta" href="#contact" data-plan="${escapeHTML(plan.name)}">Buy now</a>
      </article>`,
      )
      .join("");
    initTilt();
  } catch (_) {
    /* backend offline — static markup stays */
  }
}
renderPlans();

// Video modal — the showreel is embedded from YouTube.
// Before launch, set SHOWREEL_VIDEO_ID to the real showreel video's ID (the
// last segment of a `youtube.com/watch?v=…` URL). While it stays empty the
// modal shows a friendly notice instead of a broken embed.
const modal = document.getElementById("modal");
const modalBox = document.getElementById("modalBox");
const SHOWREEL_VIDEO_ID = "";

function openModal() {
  if (SHOWREEL_VIDEO_ID) {
    modalBox.innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' +
      SHOWREEL_VIDEO_ID +
      '?autoplay=1&rel=0" title="Showreel" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
  } else {
    modalBox.innerHTML =
      '<p class="modal-note">The showreel is being edited — check back soon.</p>';
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("modalClose").focus();
}
function closeModal() {
  modal.hidden = true;
  modalBox.innerHTML = "";
  document.body.style.overflow = "";
}
document.getElementById("videoBtn").addEventListener("click", openModal);
document.getElementById("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

// Contact form — client-side validation first, then POST to the backend.
// If the API is unreachable the error surfaces in the status line.
const form = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

const setStatus = (text, kind) => {
  formStatus.textContent = text || "";
  formStatus.classList.remove("is-ok", "is-error", "is-info");
  if (kind) formStatus.classList.add("is-" + kind);
};

// "Buy now" links remember which plan the visitor picked so the stored
// message arrives with a plan attached (shown in the admin inbox).
if (plansWrap) {
  plansWrap.addEventListener("click", (e) => {
    const cta = e.target.closest(".plan-cta");
    if (!cta) return;
    const plan = cta.dataset.plan || "";
    const planField = document.getElementById("cf-plan");
    if (planField) planField.value = plan;
    setStatus(
      plan
        ? "You picked the " +
            plan +
            " plan — tell me below and I'll get back to you."
        : "",
      plan ? "info" : "",
    );
  });
}

const validateField = (input) => {
  const field = input.closest(".field");
  if (!field) return "";
  const err = field.querySelector(".err");
  let message = "";

  if (input.required && !input.value.trim()) {
    message = "This field is required.";
  } else if (
    input.type === "email" &&
    input.value &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)
  ) {
    message = "Enter a valid e-mail address.";
  }

  if (err) err.textContent = message;
  field.classList.toggle("invalid", Boolean(message));
  return message;
};

const clearErrors = () => {
  form
    .querySelectorAll(".field.invalid")
    .forEach((f) => f.classList.remove("invalid"));
  form.querySelectorAll(".err").forEach((err) => {
    err.textContent = "";
  });
};

const fieldByName = (name) => form.querySelector('[name="' + name + '"]');

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  setStatus("", "");

  // Skip the hidden honeypot input (bare data-honeypot attribute → '').
  const inputs = [...form.querySelectorAll("input, textarea")].filter(
    (f) => !("honeypot" in f.dataset),
  );
  let ok = true;
  inputs.forEach((input) => {
    if (validateField(input)) ok = false;
  });
  if (!ok) return;

  const btn = form.querySelector(".center-btn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sending…";
  setStatus("Sending your message…", "info");

  const payload = {
    name: (fieldByName("name") || {}).value || "",
    email: (fieldByName("email") || {}).value || "",
    subject: (fieldByName("subject") || {}).value || "",
    message: (fieldByName("message") || {}).value || "",
    plan: (fieldByName("plan") || {}).value || "",
    website: (document.getElementById("cf-website") || {}).value || "",
  };

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.error && data.error.fields) {
        Object.entries(data.error.fields).forEach(([name, msg]) => {
          const input = form.querySelector('[name="' + name + '"]');
          if (!input || !input.closest(".field")) return;
          const err = input.closest(".field").querySelector(".err");
          if (err) err.textContent = msg;
          input.closest(".field").classList.add("invalid");
        });
      }
      throw new Error(
        (data.error && data.error.message) ||
          "Could not send your message. Please try again.",
      );
    }

    form.reset();
    setStatus(
      data.message ||
        "Thanks — your message has been sent. I'll get back to you within 1 business day.",
      "ok",
    );
  } catch (err) {
    setStatus(
      err.message || "Network error — your message was not sent.",
      "error",
    );
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

document.getElementById("year").textContent = new Date().getFullYear();

/* ---- Nav auth state: swap Sign in/Sign up for Dashboard when signed in ---- */
(async () => {
  const loginLink = document.querySelector('.menu a[data-auth="login"]');
  const signupLink = document.querySelector('.menu a[data-auth="signup"]');
  if (!loginLink && !signupLink) return;
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return; // logged out — keep the default links
    const { user } = await res.json();
    if (!user) return;
    const dash = document.createElement("a");
    dash.href = "/dashboard.html";
    dash.setAttribute("data-auth", "dashboard");
    dash.textContent = "Dashboard";
    if (loginLink) loginLink.replaceWith(dash);
    if (signupLink) signupLink.remove();
  } catch {
    // /api/auth/me unreachable (e.g. the page was opened as a plain file) —
    // keep the default Sign in / Sign up links.
  }
})();
