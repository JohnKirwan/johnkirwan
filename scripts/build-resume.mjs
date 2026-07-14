import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "data/authors/admin.yaml");
const generatedMarkdownPath = path.join(repoRoot, "resume.md");
const buildDir = path.join(repoRoot, "build");
const typstPath = path.join(buildDir, "resume.typ");
const compilePdfFlag = process.argv.includes("--pdf");

const resume = loadResume(sourcePath);

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(generatedMarkdownPath, renderResumeMarkdown(resume), "utf8");
fs.writeFileSync(typstPath, renderTypst(resume), "utf8");

const generated = [
  relativize(generatedMarkdownPath),
  relativize(typstPath),
];

if (compilePdfFlag) {
  const pdfOutputPath = path.join(repoRoot, resume.pdf.output);
  compileTypstPdf(typstPath, pdfOutputPath);
  generated.push(relativize(pdfOutputPath));
}

console.log(`Updated ${generated.join(", ")}`);

function loadResume(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const author = yaml.load(raw);

  if (!author || typeof author !== "object") {
    throw new Error("data/authors/admin.yaml did not parse into an object.");
  }

  requireString(author.title, "title");
  requireString(author.role, "role");
  requireString(author.summary, "summary");
  requireString(author.contact?.email, "contact.email");
  requireString(author.photo?.path, "photo.path");

  const photoAbsolutePath = path.join(repoRoot, author.photo.path);
  if (!fs.existsSync(photoAbsolutePath)) {
    throw new Error(`Photo path does not exist: ${author.photo.path}`);
  }

  author.links ??= [];
  author.organizations ??= author.affiliations ?? [];
  author.interests ??= [];
  author.education ??= [];
  author.experience ??= [];
  author.skills ??= [];
  author.languages ??= [];
  author.awards ??= [];
  author.resume_pdf ??= {};
  author.resume_pdf.output ??= "static/uploads/resume.pdf";
  author.resume_pdf.skill_group_names ??= [];
  author.resume_pdf.include_awards ??= true;
  author.resume_pdf.page_one ??= {};
  author.resume_pdf.page_one.key_highlights ??= [];
  author.resume_pdf.page_one.featured_skill_names ??= [];
  author.resume_pdf.page_one.featured_experience_positions ??= [];
  author.resume_pdf.page_one.featured_education_degrees ??= [];

  requireStringArray(author.resume_pdf.page_one.key_highlights, "resume_pdf.page_one.key_highlights");
  requireStringArray(author.resume_pdf.page_one.featured_skill_names, "resume_pdf.page_one.featured_skill_names");
  requireStringArray(author.resume_pdf.page_one.featured_experience_positions, "resume_pdf.page_one.featured_experience_positions");
  requireStringArray(author.resume_pdf.page_one.featured_education_degrees, "resume_pdf.page_one.featured_education_degrees");

  return {
    basics: {
      display_name: author.title,
      first_name: author.name?.given || "",
      last_name: author.name?.family || "",
      headline: author.headline || author.role,
      role: author.role,
      email: author.contact.email,
      phone: author.contact.phone || "",
      website: author.contact.website || "",
      location: author.contact.location || "",
      summary: author.summary,
    },
    photo: author.photo,
    site: {
      superuser: Boolean(author.superuser),
      organizations: author.organizations,
      interests: author.interests,
    },
    profiles: author.links.map((link) => ({
      label: link.label || displayUrl(link.url),
      username: link.username || displayUrl(link.url),
      url: link.url,
      icon: link.icon,
      include_in_pdf: link.include_in_pdf !== false,
    })),
    experience: author.experience.map((item) => {
      const parsed = parseMarkdownSummary(item.summary || "");
      return {
        position: item.position,
        organization: {
          name: item.company_name,
          url: item.company_url,
        },
        location: item.location || "",
        date_start: normalizeDateValue(item.date_start, `experience.${item.position}.date_start`),
        date_end: normalizeDateValue(item.date_end, `experience.${item.position}.date_end`),
        summary: parsed.summary,
        highlights: parsed.highlights,
      };
    }),
    education: author.education.map((item) => ({
      degree: item.degree,
      area: item.area,
      institution: item.institution,
      location: item.location || "",
      date_start: normalizeDateValue(item.date_start, `education.${item.degree}.date_start`),
      date_end: normalizeDateValue(item.date_end, `education.${item.degree}.date_end`),
      summary: item.summary || "",
      thesis_button_text: item.button?.text,
      thesis_url: item.button?.url,
    })),
    skill_groups: author.skills.map((group) => ({
      name: group.name,
      include_in_pdf: group.include_in_pdf !== false,
      color: group.color,
      color_border: group.color_border,
      items: group.items || [],
    })),
    languages: author.languages,
    awards: author.awards.map((award) => ({
      ...award,
      date: normalizeDateValue(award.date, `awards.${award.title}.date`),
    })),
    bio: splitParagraphs(author.bio || ""),
    pdf: author.resume_pdf,
  };
}

function renderResumeMarkdown(resume) {
  const sidebarProfiles = resume.profiles.filter((profile) => profile.include_in_pdf);
  const sidebarSkillGroups = resume.skill_groups.filter((group) => group.include_in_pdf);
  const photoHtml = resume.photo?.include_in_markdown && resume.photo.path
    ? `<img src="${slash(resume.photo.path)}" alt="${escapeHtml(resume.photo.alt || resume.basics.display_name)}" width="${resume.photo.width_px || 160}" style="display:block;margin:0 auto 12px;border-radius:10px;" />`
    : "";
  const contactRows = [
    ["Location", resume.basics.location],
    ["Phone", resume.basics.phone],
    ["Email", resume.basics.email],
    ["Website", displayUrl(resume.basics.website)],
    ...sidebarProfiles.map((profile) => [profile.label, profile.username || displayUrl(profile.url)]),
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `<div style="margin:0 0 8px;"><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</div>`)
    .join("\n");
  const skillBlocks = sidebarSkillGroups
    .map((group) => {
      const chips = (group.items || [])
        .map(
          (item) =>
            `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#e9e9e9;margin:3px 6px 3px 0;font-size:13px;">${escapeHtml(item.name)}</span>`,
        )
        .join("");
      return `<h2 style="margin:18px 0 8px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">${escapeHtml(group.name)}</h2><div>${chips}</div>`;
    })
    .join("\n");
  const languageChips = resume.languages
    .map((language) => {
      const label = `${language.name}${language.level ? ` (${language.level})` : ""}`;
      return `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#e9e9e9;margin:3px 6px 3px 0;font-size:13px;">${escapeHtml(label)}</span>`;
    })
    .join("");
  const experienceHtml = resume.experience
    .map((item) => renderResumeEntryHtml(item.position, [item.organization?.name, item.location].filter(Boolean).join(", "), formatDateRange(item.date_start, item.date_end), item.summary, item.highlights))
    .join("\n");
  const educationHtml = resume.education
    .map((item) => renderResumeEntryHtml([item.degree, item.area].filter(Boolean).join(" "), [item.institution, item.location].filter(Boolean).join(", "), formatDateRange(item.date_start, item.date_end), "", item.summary ? [item.summary] : []))
    .join("\n");
  const awardsHtml = resume.pdf.include_awards && resume.awards.length
    ? [
        '<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0 14px;">',
        '<h2 style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">Awards</h2>',
        '<ul style="list-style:none;margin:6px 0 10px 0;padding-left:0;">',
        ...resume.awards.map(
          (award) =>
            `<li style="margin:0 0 6px;">&bull; ${escapeHtml(`${award.title} — ${award.awarder} (${formatDate(award.date)})`)}</li>`,
        ),
        "</ul>",
      ].join("")
    : "";
  const bioHtml = resume.bio.length
    ? [
        '<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0 14px;">',
        '<h2 style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">Bio</h2>',
        ...resume.bio.map((paragraph) => `<p style="margin:0 0 10px;">${escapeHtml(paragraph.trim())}</p>`),
      ].join("")
    : "";

  const parts = [
    "<!-- Generated from data/authors/admin.yaml by `npm run resume:build`. -->",
    `<div style="display:grid;grid-template-columns:180px 1fr;gap:24px;align-items:start;padding:16px 20px;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;color:#111;">`,
    `<div style="background:#f7f7f7;border-radius:8px;padding:12px;">`,
    photoHtml,
    contactRows,
    skillBlocks,
    `<h2 style="margin:18px 0 8px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">Languages</h2>`,
    `<div>${languageChips}</div>`,
    `</div>`,
    `<div style="min-width:0;max-width:700px;line-height:1.5;overflow-wrap:anywhere;word-break:normal;">`,
    `<h1 style="font-size:28px;line-height:1.2;margin:0 0 6px;font-weight:700;">${escapeHtml(resume.basics.display_name)}</h1>`,
    `<div style="color:#555;margin:0 0 18px;font-weight:600;">${escapeHtml(resume.basics.headline || resume.basics.role)}</div>`,
    `<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0 14px;">`,
    `<div>${escapeHtml(resume.basics.summary.trim())}</div>`,
    `<h2 style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">Experience</h2>`,
    experienceHtml,
    `<hr style="border:0;border-top:1px solid #e5e5e5;margin:12px 0 14px;">`,
    `<h2 style="margin:22px 0 10px;font-size:12px;letter-spacing:.12em;color:#555;text-transform:uppercase;">Education</h2>`,
    educationHtml,
    awardsHtml,
    bioHtml,
    `</div>`,
    `</div>`,
  ];

  return `${parts.filter(Boolean).join("\n")}\n`;
}

function renderResumeEntryHtml(title, organization, dateRange, summary, bullets) {
  const summaryHtml = summary?.trim() ? `<p style="margin:0 0 8px;">${escapeHtml(summary.trim())}</p>` : "";
  const bulletsHtml = bullets?.length
    ? `<ul style="list-style:none;margin:6px 0 10px 0;padding-left:0;">${bullets
        .map((bullet) => `<li style="margin:0 0 4px;">&bull; ${escapeHtml(bullet)}</li>`)
        .join("")}</ul>`
    : "";
  return [
    `<h3 style="margin:14px 0 6px;font-size:14px;font-weight:700;">${escapeHtml(title)} — <em>${escapeHtml(organization)}</em> (${escapeHtml(dateRange)})</h3>`,
    summaryHtml,
    bulletsHtml,
  ]
    .filter(Boolean)
    .join("");
}

function renderTypst(resume) {
  const photoPath = slash(path.posix.relative("build", slash(resume.photo.path)));
  const pdfSkillGroups = selectPdfSkillGroups(resume);
  const pageOneExperience = selectByName(
    resume.experience,
    resume.pdf.page_one.featured_experience_positions,
    (item) => item.position,
    "resume_pdf.page_one.featured_experience_positions",
  );
  const remainingExperience = resume.experience.filter((item) => !pageOneExperience.includes(item));
  const pageOneEducation = selectByName(
    resume.education,
    resume.pdf.page_one.featured_education_degrees,
    (item) => item.degree,
    "resume_pdf.page_one.featured_education_degrees",
  );
  const remainingEducation = resume.education.filter((item) => !pageOneEducation.includes(item));
  const featuredSkills = selectSkillsForPageOne(pdfSkillGroups, resume.pdf.page_one.featured_skill_names);
  const profileText = resume.profiles
    .filter((profile) => profile.include_in_pdf)
    .map((profile) => `${profile.label}: ${profile.username || displayUrl(profile.url)}`);
  const contactText = [
    resume.basics.location,
    resume.basics.email,
    resume.basics.phone,
    displayUrl(resume.basics.website),
  ].filter(Boolean);

  const lines = [
    '#set page(paper: "a4", margin: (x: 13mm, y: 11mm))',
    '#set text(font: ("Liberation Sans", "DejaVu Sans", "Arial", "Noto Sans"), size: 9pt)',
    "#set par(leading: 0.8em)",
    "#set list(marker: [•])",
    "",
    "#let muted(body) = text(fill: rgb(\"5b5b5b\"))[#body]",
    "#let chip(body) = box(fill: rgb(\"ececec\"), radius: 99pt, inset: (x: 6pt, y: 2pt))[#body]",
    "",
    `= ${typstEscape(resume.basics.display_name)}`,
    `#text(size: 10.5pt, fill: rgb("555555"))[${typstEscape(resume.basics.headline || resume.basics.role)}]`,
    "",
    `#muted[${typstEscape(contactText.join("  •  "))}]`,
    "",
    "#table(",
    "  columns: (35mm, 1fr),",
    "  gutter: 7mm,",
    "  inset: 0pt,",
    "  stroke: none,",
    "  [",
  ];

  if (resume.photo?.include_in_pdf !== false) {
    lines.push(`    #image("${typstEscape(photoPath)}", width: ${resume.photo.width_mm || 32}mm)`);
    lines.push("    #v(4pt)");
  }

  lines.push(
    ...typstSection("Key Skills", 3).map((line) => `    ${line}`),
  );

  for (const skill of featuredSkills) {
    lines.push(`    #chip[${typstEscape(skill)}] #h(3pt)`);
  }

  lines.push("", ...typstSection("Profiles", 5).map((line) => `    ${line}`));
  for (const profile of profileText) {
    lines.push(`    ${typstEscape(profile)}\\`);
  }

  lines.push("", ...typstSection("Languages", 5).map((line) => `    ${line}`));
  for (const language of resume.languages) {
    const label = `${language.name}${language.level ? ` (${language.level})` : ""}`;
    lines.push(`    ${typstEscape(label)}\\`);
  }

  lines.push(
    "  ],",
    "  [",
    ...typstSection("Profile", 5).map((line) => `    ${line}`),
    `    ${typstEscape(resume.basics.summary.trim())}`,
    "",
    ...typstSection("Selected Highlights", 6).map((line) => `    ${line}`),
  );

  for (const highlight of resume.pdf.page_one.key_highlights) {
    lines.push(`    - ${typstEscape(highlight)}`);
  }

  lines.push("", ...typstSection("Recent Experience", 6).map((line) => `    ${line}`));
  for (const item of pageOneExperience) {
    lines.push(...renderTypstExperience(item, 3).map((line) => `    ${line}`), "");
  }

  lines.push(...typstSection("Education", 6).map((line) => `    ${line}`));
  for (const item of pageOneEducation) {
    lines.push(...renderTypstEducation(item).map((line) => `    ${line}`), "");
  }

  lines.push("  ]", ")", "", "#pagebreak()", "");

  lines.push(`#text(size: 10.5pt, weight: "semibold")[${typstEscape(resume.basics.display_name)}]`);
  lines.push(`#muted[${typstEscape(resume.basics.role)}]`, "");

  if (remainingExperience.length) {
    lines.push(...typstSection("Additional Experience", 6));
    for (const item of remainingExperience) {
      lines.push(...renderTypstExperience(item, 3), "");
    }
  }

  if (remainingEducation.length) {
    lines.push(...typstSection("Additional Education", 6));
    for (const item of remainingEducation) {
      lines.push(...renderTypstEducation(item), "");
    }
  }

  if (resume.pdf.include_awards && resume.awards.length) {
    lines.push(...typstSection("Awards & Certifications", 6));
    for (const award of resume.awards) {
      const bits = [award.title, award.awarder, formatYear(award.date)].filter(Boolean).join(" — ");
      lines.push(`- ${typstEscape(bits)}`);
      if (award.summary) {
        lines.push(`  ${typstEscape(award.summary)}`);
      }
    }
    lines.push("");
  }

  if (resume.bio.length) {
    lines.push(...typstSection("Research Focus", 6));
    for (const paragraph of resume.bio) {
      lines.push(typstEscape(paragraph.trim()), "");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function renderTypstExperience(item, maxHighlights) {
  const lines = [
    `#text(weight: "semibold")[${typstEscape(item.position)}]`,
    `#emph[${typstEscape([item.organization?.name, item.location].filter(Boolean).join(", "))}] (${typstEscape(
      formatDateRange(item.date_start, item.date_end),
    )})`,
  ];

  if (item.summary?.trim()) {
    lines.push(typstEscape(item.summary.trim()));
  }

  for (const highlight of (item.highlights || []).slice(0, maxHighlights)) {
    lines.push(`- ${typstEscape(highlight)}`);
  }

  return lines;
}

function renderTypstEducation(item) {
  const lines = [
    `#text(weight: "semibold")[${typstEscape([item.degree, item.area].filter(Boolean).join(" "))}]`,
    `#emph[${typstEscape([item.institution, item.location].filter(Boolean).join(", "))}] (${typstEscape(
      formatDateRange(item.date_start, item.date_end),
    )})`,
  ];

  if (item.summary?.trim()) {
    lines.push(item.summary.trim().startsWith("Thesis:")
      ? typstEscape(item.summary.trim())
      : `- ${typstEscape(item.summary.trim())}`);
  }

  return lines;
}

function selectPdfSkillGroups(resume) {
  const skillGroupNames = new Set(
    resume.pdf.skill_group_names.length
      ? resume.pdf.skill_group_names
      : resume.skill_groups.filter((group) => group.include_in_pdf).map((group) => group.name),
  );
  const groups = resume.skill_groups.filter((group) => skillGroupNames.has(group.name));

  if (!groups.length) {
    throw new Error("No PDF skill groups selected. Check resume_pdf.skill_group_names in data/authors/admin.yaml.");
  }

  return groups;
}

function selectSkillsForPageOne(groups, selectedNames) {
  const allSkills = groups.flatMap((group) => (group.items || []).map((item) => item.name));
  if (!selectedNames.length) {
    return allSkills.slice(0, 10);
  }

  const missing = selectedNames.filter((name) => !allSkills.includes(name));
  if (missing.length) {
    throw new Error(`Unknown page-one skills: ${missing.join(", ")}`);
  }

  return selectedNames;
}

function selectByName(items, selectedNames, keyFn, label) {
  if (!selectedNames.length) {
    return items.slice();
  }

  const mapping = new Map(items.map((item) => [keyFn(item), item]));
  const missing = selectedNames.filter((name) => !mapping.has(name));
  if (missing.length) {
    throw new Error(`Unknown entries in ${label}: ${missing.join(", ")}`);
  }

  return selectedNames.map((name) => mapping.get(name));
}

function parseMarkdownSummary(value) {
  const lines = String(value || "").split(/\r?\n/);
  const summaryLines = [];
  const highlights = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (summaryLines.length && summaryLines.at(-1) !== "") {
        summaryLines.push("");
      }
      continue;
    }
    if (line.startsWith("- ")) {
      highlights.push(line.slice(2).trim());
      continue;
    }
    summaryLines.push(line);
  }

  return {
    summary: summaryLines.join("\n").replace(/\n{2,}/g, "\n\n").trim(),
    highlights,
  };
}

function splitParagraphs(value) {
  return String(value || "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function typstSection(title, topSpacingPt = 5) {
  return [
    `#v(${topSpacingPt}pt)`,
    `#text(size: 8.4pt, weight: "semibold", tracking: 0.08em, fill: rgb("555555"))[${typstEscape(title).toUpperCase()}]`,
    '#line(length: 100%, stroke: 0.6pt + rgb("d8d8d8"))',
    "#v(3pt)",
  ];
}

function formatDateRange(start, end) {
  return `${formatDate(start)}-${end ? formatDate(end) : "present"}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const text = normalizeDateValue(value, "date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  return text;
}

function formatYear(value) {
  if (!value) {
    return "";
  }
  const match = normalizeDateValue(value, "year").match(/^(\d{4})/);
  return match ? match[1] : String(value);
}

function compileTypstPdf(typstInputPath, pdfOutputPath) {
  fs.mkdirSync(path.dirname(pdfOutputPath), { recursive: true });

  const direct = spawnSync("typst", ["compile", "--root", repoRoot, typstInputPath, pdfOutputPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (!direct.error && direct.status === 0) {
    return;
  }
  if (!direct.error && direct.status !== 0) {
    throw new Error("Typst compilation failed. See diagnostics above.");
  }

  if (process.platform === "win32") {
    const check = spawnSync("wsl", ["bash", "-lc", "command -v typst >/dev/null 2>&1"], {
      cwd: repoRoot,
      stdio: "ignore",
    });

    if (check.status === 0) {
      const command = `cd ${quoteShell(toWslPath(repoRoot))} && typst compile --root ${quoteShell(
        toWslPath(repoRoot),
      )} ${quoteShell(toWslPath(typstInputPath))} ${quoteShell(toWslPath(pdfOutputPath))}`;
      const viaWsl = spawnSync("wsl", ["bash", "-lc", command], {
        cwd: repoRoot,
        stdio: "inherit",
      });
      if (viaWsl.status === 0) {
        return;
      }
      throw new Error("Typst compilation failed in WSL. See diagnostics above.");
    }
  }

  throw new Error("Typst was not found on this machine or in WSL. Install Typst, then rerun `npm run resume:pdf`.");
}

function toWslPath(filePath) {
  const resolved = path.resolve(filePath);
  const drive = resolved[0].toLowerCase();
  return `/mnt/${drive}${resolved.slice(2).replace(/\\/g, "/")}`;
}

function quoteShell(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required field: ${label}`);
  }
}

function requireStringArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Expected an array for ${label}`);
  }
  for (const item of value) {
    requireString(item, `${label}[]`);
  }
}

function normalizeDateValue(value, label) {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid date value for ${label}`);
    }
    return value.toISOString().slice(0, 10);
  }

  throw new Error(`Invalid date value for ${label}: expected a string or Date`);
}

function displayUrl(value) {
  return String(value || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function relativize(filePath) {
  return slash(path.relative(repoRoot, filePath));
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function typstEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/@/g, "\\@")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\$/g, "\\$")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/"/g, '\\"');
}
