const pdf = require("pdf-poppler");
const path = require("path");

module.exports = async function convertPdfToImages(pdfPath) {
  const opts = {
    format: "png",
    out_dir: "uploads",
    out_prefix: "page",
    page: null
  };

  await pdf.convert(pdfPath, opts);
};
