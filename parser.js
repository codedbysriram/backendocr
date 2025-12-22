function getYear(semester) {
  if (semester <= 2) return 1;
  if (semester <= 4) return 2;
  return 3;
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
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    const subjects = [];
    const lines = block.split("\n");

    for (const line of lines) {
      const match = line.match(
        /^(\d)\s+([A-Z0-9\-]+)\s+(.+?)\s+(\d+|-)\s+(\d+|AA|--)\s+(\d+|AA|--)\s+(\d+|AA)\s+(P|RA|AA)$/i
      );

      if (!match) continue;

      const semester = parseInt(match[1]);
      const code = match[2];
      const title = match[3].trim();

      const ia = parseInt(match[5]) || 0;
      const ea = parseInt(match[6]) || 0;
      const total = parseInt(match[7]) || 0;

      const resultRaw = match[8].toUpperCase();
      const result = resultRaw === "P" ? "PASS" : "FAIL";

      subjects.push({
        semester,
        year: getYear(semester),
        code,
        title,
        ia,
        ea,
        total,
        result,
      });
    }

    if (subjects.length > 0) {
      students.push({
        regno,
        name,
        subjects,
      });
    }
  }

  return students;
};
