function getYear(semester) {
  if (semester <= 2) return 1;
  if (semester <= 4) return 2;
  return 3;
}

function toNumber(val) {
  return /^\d+$/.test(val) ? parseInt(val) : 0;
}

module.exports = function parseResult(text) {
  const students = [];

  text = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ");

  const blocks = text.split(/Register No\.\s*:\s*/i);

  for (const block of blocks) {
    if (!block || block.length < 20) continue;

    const regMatch = block.match(/^([0-9A-Z]+)/);
    if (!regMatch) continue;

    const regno = regMatch[1];

    let name = "UNKNOWN";
    const nameMatch = block.match(/Name\s*:\s*([A-Z ]+)/i);
    if (nameMatch) name = nameMatch[1].trim();

    const subjects = [];
    const lines = block.split("\n");

    for (const line of lines) {
      const match = line.match(
        /^(\d)\s+([A-Z0-9\-]+)\s+(.+?)\s+(\d+|-)\s+(\d+|AA|--)\s+(\d+|AA|--)\s+(\d+|AA)\s+(P|RA|AA)$/i
      );

      if (!match) continue;

      const semester = parseInt(match[1]);

      subjects.push({
        semester,
        year: getYear(semester),
        code: match[2],
        title: match[3].trim(),
        ia: toNumber(match[5]),
        ea: toNumber(match[6]),
        total: toNumber(match[7]),
        result: match[8].toUpperCase() === "P" ? "PASS" : "FAIL",
      });
    }

    if (subjects.length) {
      students.push({ regno, name, subjects });
    }
  }

  return students;
};
