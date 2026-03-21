import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "resume.yaml");
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
  const data = yaml.load(raw);

  if (!data || typeof data !== "object") {
    throw new Error("resume.yaml did not parse into an object.");
  }

  requireString(data.basics?.display_name, "basics.display_name");
  requireString(data.basics?.first_name, "basics.first_name");
  requireString(data.basics?.last_name, "basics.last_name");
  requireString(data.basics?.role, "basics.role");
  requireString(data.basics?.summary, "basics.summary");

  if (data.photo?.path && !fs.existsSync(path.join(repoRoot, data.photo.path))) {
    throw new Error(`Photo path does not exist: ${data.photo.path}`);
  }

  data.site ??= {};
  data.site.organizations ??= [];
  data.site.interests ??= [];
  data.profiles ??= [];
  data.experience ??= [];
  data.education ??= [];
  data.skill_groups ??= [];
  data.languages ??= [];
  data.awards ??= [];
  data.bio ??= [];
  data.pdf ??= {};
  data.pdf.output ??= "static/uploads/resume.pdf";
  data.pdf.skill_group_names ??= [];
  data.pdf.include_awards ??= true;

  return data;
}

function renderResumeMarkdown(resume) {
  const sidebarProfiles = resume.profiles.filter((profile) => profile.include_in_pdf);
  const sidebarSkillGroups = resume.skill_groups.filter((group) => group.include_in_pdf);
  const photoHtml = resume.photo?.include_in_markdown && resume.photo.path
    ? `<img src="${slash(resume.photo.path)}" alt="${escapeHtml(resume.photo.alt || resume.basics.display_name)}" width="${resume.photo.width_px || 160}" style="display:block;margin:0 auto 12px;border-radius:10px;" />`
    : "";
  const contactRows = [
    ["Phone", resume.basics.phone],
    ["Email", resume.basics.email],
    ["Website", displayUrl(resume.basics.website)],
    ...sidebarProfiles.map((profile) => [profile.label, profile.username || displayUrl(profile.url)]),
  ]
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
            `<li style="margin:0 0 6px;">&bull; ${escapeHtml(`${award.title} — ${award.awarder} (${award.date})`)}</li>`,
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
    "<!-- Generated from resume.yaml by `npm run resume:build`. -->",
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
  const photoPath = resume.photo?.path
    ? slash(path.posix.relative("build", slash(resume.photo.path)))
    : null;
  const sidebarProfiles = resume.profiles.filter((profile) => profile.include_in_pdf);
  const skillGroupNames = new Set(
    resume.pdf.skill_group_names.length
      ? resume.pdf.skill_group_names
      : resume.skill_groups.filter((group) => group.include_in_pdf).map((group) => group.name),
  );
  const pdfSkillGroups = resume.skill_groups.filter((group) => skillGroupNames.has(group.name));
  const lines = [
    '#set page(paper: "a4", margin: (x: 14mm, y: 12mm))',
    '#set text(font: ("Aptos", "Liberation Sans", "Arial", "Noto Sans"), size: 10pt)',
    "#set par(leading: 0.75em)",
    "",
    "#let sidebar(body) = block(width: 34mm, inset: 9pt, fill: rgb(\"f7f7f7\"), radius: 6pt)[body]",
    "#let chip(text) = box(fill: rgb(\"e9e9e9\"), radius: 99pt, inset: (x: 6pt, y: 3pt))[text]",
    "",
    "#table(",
    "  columns: (34mm, 1fr),",
    "  gutter: 10mm,",
    "  align: (left, left),",
    "  [",
    "    #sidebar([",
  ];

  if (resume.photo?.include_in_pdf && photoPath) {
    lines.push(
      `      #image("${typstEscape(photoPath)}", width: ${resume.photo.width_mm || 32}mm)`,
      "",
    );
  }

  lines.push(
    `      *Email*  \\\\ ${typstEscape(resume.basics.email)}`,
    "",
    `      *Phone*  \\\\ ${typstEscape(resume.basics.phone)}`,
    "",
    `      *Website*  \\\\ ${typstEscape(displayUrl(resume.basics.website))}`,
    "",
  );

  for (const profile of sidebarProfiles) {
    lines.push(`      *${typstEscape(profile.label)}*  \\\\ ${typstEscape(profile.username || displayUrl(profile.url))}`, "");
  }

  if (pdfSkillGroups.length) {
    lines.push("      #v(8pt)", "      #strong[Key Skills]", "");
    for (const group of pdfSkillGroups) {
      for (const item of group.items || []) {
        lines.push(`      #chip[${typstEscape(item.name)}] #h(4pt)`);
      }
      lines.push("");
    }
  }

  if (resume.languages.length) {
    lines.push("      #v(8pt)", "      #strong[Languages]", "");
    for (const language of resume.languages) {
      lines.push(`      ${typstEscape(language.name)}${language.level ? ` (${typstEscape(language.level)})` : ""}  \\\\`);
    }
    lines.push("");
  }

  lines.push(
    "    ])",
    "  ],",
    "  [",
    `    = ${typstEscape(resume.basics.display_name)}`,
    "",
    `    #text(size: 11pt, fill: rgb("555555"))[${typstEscape(resume.basics.headline || resume.basics.role)}]`,
    "",
    `    ${typstEscape(resume.basics.summary)}`,
    "",
    "    == Experience",
    "",
  );

  for (const item of resume.experience) {
    lines.push(
      `    === ${typstEscape(item.position)}`,
      "",
      `    #emph[${typstEscape([item.organization?.name, item.location].filter(Boolean).join(", "))}] (${typstEscape(
        formatDateRange(item.date_start, item.date_end),
      )})`,
      "",
    );

    if (item.summary) {
      lines.push(`    ${typstEscape(item.summary)}`, "");
    }

    for (const highlight of item.highlights || []) {
      lines.push(`    - ${typstEscape(highlight)}`);
    }

    lines.push("");
  }

  lines.push("    == Education", "");

  for (const item of resume.education) {
    lines.push(
      `    === ${typstEscape([item.degree, item.area].filter(Boolean).join(" "))}`,
      "",
      `    #emph[${typstEscape([item.institution, item.location].filter(Boolean).join(", "))}] (${typstEscape(
        formatDateRange(item.date_start, item.date_end),
      )})`,
      "",
    );

    if (item.summary) {
      lines.push(`    - ${typstEscape(item.summary)}`, "");
    }
  }

  if (resume.pdf.include_awards && resume.awards.length) {
    lines.push("    == Awards", "");
    for (const award of resume.awards) {
      lines.push(`    - ${typstEscape(`${award.title} — ${award.awarder} (${award.date})`)}`);
    }
    lines.push("");
  }

  lines.push("  ]", ")");
  return `${lines.join("\n").trim()}\n`;
}

function formatDateRange(start, end) {
  return `${formatDate(start)}-${end ? formatDate(end) : "present"}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return `${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  return text;
}

function compileTypstPdf(typstInputPath, pdfOutputPath) {
  fs.mkdirSync(path.dirname(pdfOutputPath), { recursive: true });

  const direct = spawnSync("typst", ["compile", typstInputPath, pdfOutputPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (!direct.error && direct.status === 0) {
    return;
  }

  if (process.platform === "win32") {
    const check = spawnSync("wsl", ["bash", "-lc", "command -v typst >/dev/null 2>&1"], {
      cwd: repoRoot,
      stdio: "ignore",
    });

    if (check.status === 0) {
      const command = `cd ${quoteShell(toWslPath(repoRoot))} && typst compile ${quoteShell(
        toWslPath(typstInputPath),
      )} ${quoteShell(toWslPath(pdfOutputPath))}`;
      const viaWsl = spawnSync("wsl", ["bash", "-lc", command], {
        cwd: repoRoot,
        stdio: "inherit",
      });
      if (viaWsl.status === 0) {
        return;
      }
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
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\$/g, "\\$")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/"/g, '\\"');
}
