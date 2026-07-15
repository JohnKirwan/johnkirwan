import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";
import matter from "gray-matter";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "data/authors/admin.yaml");
const publicationsRoot = path.join(repoRoot, "content/publication");
const buildDir = path.join(repoRoot, "build");
const buildIconsDir = path.join(buildDir, "resume-icons");
const typstPath = path.join(buildDir, "resume.typ");
const compilePdfFlag = process.argv.includes("--pdf");

const resume = loadResume(sourcePath);

fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(buildIconsDir, { recursive: true });
materializeProfileIcons(resume.profiles, buildIconsDir);
fs.writeFileSync(typstPath, renderTypst(resume), "utf8");

const generated = [
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
    publications: loadPublications(author),
    bio: splitParagraphs(author.bio || ""),
    pdf: author.resume_pdf,
  };
}

function loadPublications(author) {
  if (!fs.existsSync(publicationsRoot)) {
    return [];
  }

  const authorNames = new Set(
    [author.title, author.name?.display, [author.name?.given, author.name?.family].filter(Boolean).join(" ")]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  return findPublicationFiles(publicationsRoot)
    .map((filePath) => {
      const raw = fs.readFileSync(filePath, "utf8");
      const { data } = matter(raw);
      return { filePath, data };
    })
    .filter(({ data }) => data && typeof data === "object")
    .filter(({ data }) => data.draft !== true)
    .filter(({ data }) => data.featured === true)
    .filter(({ data }) => Array.isArray(data.authors) && data.authors.some((name) => authorNames.has(String(name).trim())))
    .map(({ filePath, data }) => ({
      title: requireNonEmptyString(data.title, `publication title in ${relativize(filePath)}`),
      authors: data.authors.map((name) => String(name).trim()).filter(Boolean),
      publication: cleanPublicationVenue(data.publication || ""),
      date: normalizeDateValue(data.date, `publication date in ${relativize(filePath)}`),
      url: firstPublicationUrl(data.links),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function findPublicationFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findPublicationFiles(absolutePath));
      continue;
    }
    if (entry.isFile() && entry.name === "index.md") {
      files.push(absolutePath);
    }
  }

  return files;
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
  const profileLines = resume.profiles
    .filter((profile) => profile.include_in_pdf)
    .map((profile) => renderTypstProfile(profile));
  const contactText = [
    resume.basics.location,
    resume.basics.email,
    resume.basics.phone,
    displayUrl(resume.basics.website),
  ].filter(Boolean);

  const lines = [
    '#set page(paper: "a4", margin: (x: 13mm, y: 11mm))',
    '#set text(font: ("Liberation Sans", "DejaVu Sans"), size: 9pt)',
    "#set par(leading: 0.95em)", 
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
  for (const profile of profileLines) {
    lines.push(...profile.map((line) => `    ${line}`));
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
    ...renderTypstParagraphs(resume.basics.summary.trim()).map((line) => `    ${line}`),
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

  if (resume.publications.length) {
    lines.push(...typstSection("Selected Publications", 6));
    for (const publication of resume.publications) {
      lines.push(...renderTypstPublication(publication), "");
    }
  }

  // if (resume.bio.length) {
  //   lines.push(...typstSection("Research Focus", 6));
  //   for (const paragraph of resume.bio) {
  //     lines.push(...renderTypstParagraphs(paragraph.trim()), "");
  //   }
  // }

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
    lines.push(...renderTypstParagraphs(item.summary.trim()));
    lines.push("#v(3pt)");
  }

  for (const highlight of (item.highlights || []).slice(0, maxHighlights)) {
    lines.push(`- ${typstEscape(highlight)}`);
  }

  return lines;
}

function renderTypstPublication(item) {
  const authorList = formatPublicationAuthors(item.authors);
  const venue = [item.publication, formatYear(item.date)].filter(Boolean).join(", ");
  const lines = [
    `#text(weight: "semibold")[${typstEscape(item.title)}]`,
  ];

  if (authorList) {
    lines.push(typstEscape(authorList));
  }
  if (venue) {
    lines.push(`#emph[${typstEscape(venue)}]`);
  }
  if (item.url) {
    lines.push(`#link("${typstEscape(item.url)}")[${typstEscape(displayUrl(item.url))}]`);
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
    lines.push("#v(2pt)");
  }

  return lines;
}

function renderTypstProfile(profile) {
  const handle = profile.username || displayUrl(profile.url);
  if (!handle) {
    throw new Error(`Missing profile username/url for ${profile.label}`);
  }
  const displayHandle = formatProfileDisplayHandle(profile, handle);

  const iconPath = getMaterializedProfileIconPath(profile.icon);
  const rowContent = iconPath
    ? `#box[#box(height: 8.5pt, image("${typstEscape(slash(path.posix.relative("build", iconPath)))}", width: 8.5pt)) #h(1.2pt) ${typstEscape(displayHandle)}]`
    : `#box[#text(weight: "semibold")[${typstEscape(profile.label)}] #h(1.2pt) ${typstEscape(displayHandle)}]`;

  if (profile.url) {
    return [`#link("${typstEscape(profile.url)}")[${rowContent}]\\`];
  }

  return [`${rowContent}\\`];
}

function formatProfileDisplayHandle(profile, handle) {
  if (profile.icon === "academicons/orcid") {
    return handle.replace(/^0000-00/, "");
  }
  return handle;
}

function materializeProfileIcons(profiles, outputDir) {
  const iconNames = [...new Set(
    profiles
      .map((profile) => profile.icon)
      .filter((icon) => Boolean(getIconLookupConfig(icon))),
  )];

  for (const iconName of iconNames) {
    const iconFile = loadIconFile(iconName);
    if (!iconFile) {
      continue;
    }
    const config = getIconLookupConfig(iconName);
    const outputPath = path.join(outputDir, `${config.pack}-${config.name}${config.extension}`);
    if (typeof iconFile === "string") {
      fs.writeFileSync(outputPath, iconFile, "utf8");
    } else {
      fs.writeFileSync(outputPath, iconFile);
    }
  }
}

function getMaterializedProfileIconPath(iconName) {
  const config = getIconLookupConfig(iconName);
  if (!config) {
    return "";
  }
  return path.join(buildIconsDir, `${config.pack}-${config.name}${config.extension}`);
}

function loadIconFile(iconName) {
  const config = getIconLookupConfig(iconName);
  if (!config) {
    return "";
  }

  if (config.customPath) {
    return config.extension === ".svg"
      ? fs.readFileSync(config.customPath, "utf8")
      : fs.readFileSync(config.customPath);
  }

  const iconPack = loadIconPack(config.packFile);
  const icon = iconPack.icons?.[config.name];
  if (!icon?.body) {
    throw new Error(`Icon ${iconName} was not found in theme pack ${config.pack}.`);
  }

  const width = icon.width || iconPack.width || iconPack.height;
  const height = icon.height || iconPack.height;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">${icon.body}</svg>\n`;
}

function getIconLookupConfig(iconName) {
  const aliases = {
    "brands/google-scholar": "brands/googlescholar",
  };
  const canonical = aliases[iconName] || iconName;
  const [pack, name] = canonical.split("/");
  if (!pack || !name) {
    return null;
  }

  const customPath = path.join(repoRoot, "assets/media/icons", pack, `${name}.svg`);
  const customPngPath = path.join(repoRoot, "assets/media/icons", pack, `${name}.png`);
  if (fs.existsSync(customPngPath)) {
    return { pack, name, customPath: customPngPath, extension: ".png" };
  }
  if (fs.existsSync(customPath)) {
    return { pack, name, customPath, extension: ".svg" };
  }

  switch (canonical) {
    case "brands/github":
      return { pack: "brands", name: "github", packFile: themeIconPackPath("brands"), extension: ".svg" };
    case "brands/linkedin":
      return { pack: "brands", name: "linkedin", packFile: themeIconPackPath("brands"), extension: ".svg" };
    case "academicons/orcid":
      return { pack: "academicons", name: "orcid", packFile: themeIconPackPath("academicons"), extension: ".svg" };
    default:
      return null;
  }
}

function themeIconPackPath(pack) {
  return path.join(resolveThemeIconsDir(), `${pack}.json`);
}

function resolveThemeIconsDir() {
  const moduleRoot = path.join(
    process.env.HOME || "/home/jdk",
    ".cache/hugo_cache/modules/filecache/modules/pkg/mod/github.com/!hugo!blox/kit/modules",
  );
  const entries = fs.readdirSync(moduleRoot, { withFileTypes: true });
  const bloxDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("blox@"))
    .map((entry) => entry.name)
    .sort();

  const latest = bloxDirs.at(-1);
  if (!latest) {
    throw new Error(`Could not locate Hugo Blox icon data under ${moduleRoot}`);
  }

  return path.join(moduleRoot, latest, "data/icons");
}

function loadIconPack(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Theme icon pack not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function renderTypstParagraphs(value) {
  const paragraphs = splitParagraphs(value);
  const lines = [];

  paragraphs.forEach((paragraph, index) => {
    lines.push(typstEscape(paragraph));
    if (index < paragraphs.length - 1) {
      lines.push("");
      lines.push("#v(6pt)");
      lines.push("");
    }
  });

  return lines;
}

function typstSection(title, topSpacingPt = 5) {
  return [
    `#v(${topSpacingPt}pt)`,
    `#text(size: 8.4pt, weight: "semibold", tracking: 0.08em, fill: rgb("555555"))[${typstEscape(title).toUpperCase()}]`,
    '#line(length: 100%, stroke: 0.6pt + rgb("d8d8d8"))',
    "#v(3pt)",
  ];
}

function formatPublicationAuthors(authors) {
  return authors.map((author) => author === "John D. Kirwan" ? "John D. Kirwan" : author).join(", ");
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

function firstPublicationUrl(links) {
  if (!Array.isArray(links)) {
    return "";
  }

  const preferredTypes = ["paper", "pdf", "doi", "doc"];
  for (const type of preferredTypes) {
    const match = links.find((link) => link?.type === type && typeof link?.url === "string" && link.url.trim());
    if (match) {
      return match.url.trim();
    }
  }

  const fallback = links.find((link) => typeof link?.url === "string" && link.url.trim());
  return fallback ? fallback.url.trim() : "";
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

function requireNonEmptyString(value, label) {
  requireString(value, label);
  return value.trim();
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

function cleanPublicationVenue(value) {
  return String(value || "").replace(/\*/g, "").trim();
}

function relativize(filePath) {
  return slash(path.relative(repoRoot, filePath));
}

function slash(value) {
  return value.replace(/\\/g, "/");
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
