function getYear(semester) {
  if (semester <= 2) return 1;
  if (semester <= 4) return 2;
  return 3;
}

function safeNumber(val) {
  if (val === undefined || val === null) return null;

  const v = String(val).trim();

  if (["--", "AA", "AAA", "-", ""].includes(v)) return null;

  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .replace(/ +/g, " ")
    .trim();
}

/**
 * ✅ Parser for BSCCT.pdf (table format)
 * PDF layout:
 * regno (alone line)
 * "Register No."
 * name (alone line)
 * "Name :"
 * then 8 subjects per student shown in vertical columns
 */
module.exports = function parseResult(text) {
  const students = [];
  text = normalizeText(text);

  // split pages/blocks by "Per.of study" or "Degree" doesn't matter, just keep it full
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let i = 0;

  while (i < lines.length) {
    // ✅ Detect RegNo like 25SCT1501
    const regLine = lines[i];

    if (/^\d{2}[A-Z]{3}\d{4}$/i.test(regLine)) {
      const regno = regLine.trim();
      let name = "UNKNOWN";

      // try to find Name in next few lines
      for (let k = 1; k <= 5 && i + k < lines.length; k++) {
        const next = lines[i + k];

        // name usually is plain uppercase line (BARANI K)
        if (/^[A-Z][A-Z\s.]+$/.test(next) && next.length >= 3) {
          name = next.trim();
          break;
        }

        // fallback: "Name :" line
        const nm = next.match(/^Name\s*:\s*(.+)$/i);
        if (nm) {
          name = nm[1].trim();
          break;
        }
      }

      // ✅ Now parse subjects for this student
      // In your PDF, each student has 8 subject rows per semester shown
      // We will search next lines that look like subject codes (CUCT-1, 25ULT-1 etc)
      const subjects = [];

      // move forward until we hit next regno or end
      let j = i + 1;

      while (j < lines.length && !/^\d{2}[A-Z]{3}\d{4}$/i.test(lines[j])) {
        // subject line starts with semester number then subject code
        // Example: "1 25ULT-1 Tamil-I - 12 18 030 RA"
        const m = lines[j].match(
          /^(\d)\s+([A-Z0-9-]+)\s+(.+?)\s+(\d+|-)\s+(\d+|AA|AAA|--|-)\s+(\d+|AA|AAA|--|-)\s+(\d+|AA|AAA|--|-)\s+(P|PASS|RA|AA|AAA)$/i
        );

        if (m) {
          const semester = Number(m[1]);
          const code = m[2];
          const title = m[3].trim();
          const credits = safeNumber(m[4]);
          const ia = safeNumber(m[5]);
          const ea = safeNumber(m[6]);
          const total = safeNumber(m[7]);
          const resultRaw = String(m[8]).toUpperCase();

          subjects.push({
            semester,
            year: getYear(semester),
            code,
            title,
            credits,
            ia,
            ea,
            total,
            result:
              resultRaw === "P" || resultRaw === "PASS"
                ? "PASS"
                : resultRaw === "RA"
                ? "RA"
                : resultRaw, // AA / AAA etc
          });
        }

        j++;
      }

      // ✅ Save student if any subjects found
      if (subjects.length > 0) {
        students.push({ regno, name, subjects });
      }

      // continue from next regno
      i = j;
      continue;
    }

    i++;
  }

  return students;
};
