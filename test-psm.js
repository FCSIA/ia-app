const { createWorker, PSM } = require('tesseract.js');
const fs = require('fs');

async function run(psm) {
  const worker = await createWorker('eng');
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
  });
  const ret = await worker.recognize('padded.png');
  console.log(`\n\n=== PSM ${psm} ===\n`);
  console.log(ret.data.text);
  await worker.terminate();
}

async function main() {
  await run(PSM.SPARSE_TEXT); // 11
  await run(PSM.SINGLE_BLOCK); // 6
  await run(PSM.SINGLE_COLUMN); // 4
  await run(PSM.AUTO_OSD); // 1
}
main();
