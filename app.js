/* ============================================================
   0 → Shipped Resume Parser — mock milestone
   Parses PDFs client-side with pdf.js and scores skill coverage.
   ============================================================ */

// Tell pdf.js where its worker lives (required for parsing)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// ---------- Skill dictionary ----------
// `re` matches against the lowercased resume text. Aliases are bundled
// into one regex so e.g. "postgres" counts as PostgreSQL.
const SKILLS = [
  { name: "JavaScript",  weight: 3, re: /\bjavascript\b|(?<!\.)\bjs\b/ },
  { name: "TypeScript",  weight: 2, re: /\btypescript\b|(?<!\.)\bts\b/ },
  { name: "Python",      weight: 3, re: /\bpython\b/ },
  { name: "Java",        weight: 2, re: /\bjava\b(?!\s*script)/ },
  { name: "C/C++",       weight: 2, re: /\bc\+\+\b|\bc language\b/ },
  { name: "HTML",        weight: 2, re: /\bhtml5?\b/ },
  { name: "CSS",         weight: 2, re: /\bcss3?\b|\bsass\b|\bscss\b/ },
  { name: "React",       weight: 3, re: /\breact(?:\.?js)?\b/ },
  { name: "Node.js",     weight: 2, re: /\bnode(?:\.?js)?\b/ },
  { name: "Express",     weight: 1, re: /\bexpress(?:\.?js)?\b/ },
  { name: "Next.js",     weight: 1, re: /\bnext\.?js\b|\bnextjs\b/ },
  { name: "SQL",         weight: 2, re: /\bsql\b/ },
  { name: "PostgreSQL",  weight: 1, re: /\bpostgres(?:ql)?\b/ },
  { name: "MongoDB",     weight: 1, re: /\bmongo(?:db)?\b/ },
  { name: "Git",         weight: 2, re: /\bgit\b|\bgithub\b|\bgitlab\b/ },
  { name: "REST APIs",   weight: 2, re: /\brestful\b|\brest\s*api|\bapi(?:s)?\b/ },
  { name: "Docker",      weight: 2, re: /\bdocker\b/ },
  { name: "Kubernetes",  weight: 1, re: /\bkubernetes\b|\bk8s\b/ },
  { name: "AWS",         weight: 2, re: /\baws\b|\bamazon web services\b/ },
  { name: "CI/CD",       weight: 1, re: /\bci\s*\/\s*cd\b|continuous integration|github actions/ },
  { name: "Testing",     weight: 2, re: /\bjest\b|\bvitest\b|\bpytest\b|\bunit tests?\b|\btesting\b/ },
  { name: "Linux",       weight: 1, re: /\blinux\b|\bubuntu\b|\bbash\b/ },
];

const RING_LENGTH = 2 * Math.PI * 52; // circumference of the score ring

// ---------- Element handles ----------
const dropzone   = document.getElementById("dropzone");
const fileInput  = document.getElementById("file-input");
const statusEl   = document.getElementById("status");
const resultsEl  = document.getElementById("results");
const ring       = document.getElementById("ring");
const scoreValue = document.getElementById("score-value");
const scoreLabel = document.getElementById("score-label");
const scoreDetail= document.getElementById("score-detail");
const parseInfo  = document.getElementById("parse-info");
const presentEl  = document.getElementById("skills-present");
const missingEl  = document.getElementById("skills-missing");
const foundCount = document.getElementById("found-count");
const missingCount = document.getElementById("missing-count");

// ---------- Upload wiring ----------
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

document.getElementById("try-sample").addEventListener("click", () => {
  setStatus("Parsing sample resume…", "loading");
  showResults(SAMPLE_TEXT, "sample resume");
});

document.getElementById("reset").addEventListener("click", () => {
  resultsEl.hidden = true;
  fileInput.value = "";
  statusEl.hidden = true;
  dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
});

// ---------- Core flow ----------
async function handleFile(file) {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
    setStatus("That's not a PDF — please upload a .pdf file.", "error");
    return;
  }

  setStatus("Parsing your resume…", "loading");
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    // Extract text from every page
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }

    if (text.replace(/\s/g, "").length < 40) {
      setStatus(
        "No readable text found — this looks like a scanned/image PDF. This mock needs text-based PDFs.",
        "error"
      );
      return;
    }

    showResults(text, `${file.name} · ${pdf.numPages} page${pdf.numPages > 1 ? "s" : ""}`);
  } catch (err) {
    console.error(err);
    setStatus("Couldn't parse that PDF. It may be corrupted or password-protected.", "error");
  }
}

// ---------- Matching + rendering ----------
function showResults(text, sourceLabel) {
  const lower = text.toLowerCase();
  const found = [];
  const missing = [];

  for (const skill of SKILLS) {
    (skill.re.test(lower) ? found : missing).push(skill);
    skill.re.lastIndex = 0; // reset in case the regex ever goes global
  }

  const totalWeight = SKILLS.reduce((sum, s) => sum + s.weight, 0);
  const foundWeight = found.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.round((foundWeight / totalWeight) * 100);

  // Animate the ring and count up
  resultsEl.hidden = false;
  statusEl.hidden = true;
  ring.style.strokeDashoffset = RING_LENGTH * (1 - score / 100);
  animateNumber(scoreValue, score);

  const { label, blurb } = grade(score);
  scoreLabel.textContent = `${label} — ${score}% skill coverage`;
  scoreDetail.textContent = blurb;
  parseInfo.textContent = `Parsed ${sourceLabel} · ${text.trim().split(/\s+/).length} words`;

  foundCount.textContent = `· ${found.length}`;
  missingCount.textContent = `· ${missing.length}`;
  presentEl.innerHTML = found.map(chip("found")).join("");
  missingEl.innerHTML = missing.map(chip("missing")).join("");

  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function chip(kind) {
  return (s) => `<span class="chip ${kind}">${kind === "found" ? "✓ " : "— "}${s.name}</span>`;
}

function grade(score) {
  if (score >= 80) return { label: "Strong",   blurb: "Recruiter-friendly keyword coverage. Ship it." };
  if (score >= 60) return { label: "Good",     blurb: "Solid base — a few key skills are still missing below." };
  if (score >= 40) return { label: "Needs work", blurb: "More than half the tracked skills didn't show up." };
  return { label: "Early draft", blurb: "Most core skills are missing from the text of this resume." };
}

function animateNumber(el, target) {
  const start = performance.now();
  const duration = 700;
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))); // ease-out
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`;
  statusEl.hidden = false;
}

// ---------- Sample resume (for demoing without a PDF) ----------
const SAMPLE_TEXT = `
Aarav Menon — Bengaluru, IN — aarav.dev@email.com — github.com/aaravmenon

SUMMARY
Computer science graduate and self-taught web developer seeking a junior
frontend role. Comfortable across the stack with JavaScript and React.

SKILLS
JavaScript, TypeScript, HTML, CSS, React, Node.js, Express, MongoDB,
REST APIs, Git, GitHub, Linux, bash

EXPERIENCE
Freelance Web Developer (2024–present)
- Built 4 client sites with React and Node.js, connected to MongoDB
- Designed REST APIs consumed by a React dashboard
- Tested components with Jest and kept everything in GitHub

PROJECTS
Task board app — React + Express + MongoDB, deployed with CI via GitHub Actions
Portfolio site — HTML, CSS, JavaScript

EDUCATION
B.Tech Computer Science, 2023
`;

/* Footnote on the C/C++ regex: it deliberately avoids matching a lone
   "c" or "c++" inside words like "object" by requiring word boundaries. */
