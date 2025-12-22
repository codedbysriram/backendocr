const Tesseract = require("tesseract.js");

module.exports = async function extractText(imagePath) {
  const { data } = await Tesseract.recognize(imagePath, "eng");
  return data.text;
};
