import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

const docsDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const files = [
  'Rak FlowMind作品设计方案.docx',
  '【赛道二】参赛作品设计方案(1).docx',
  '智能体系统项目书-睿哲.1.docx',
];

for (const file of files) {
  const inputPath = path.join(docsDir, file);
  const outputName = file.replace(/\.docx$/i, '.md');
  const outputPath = path.join(docsDir, outputName);
  try {
    const buffer = await fs.readFile(inputPath);
    const result = await mammoth.convertToMarkdown({ buffer });
    await fs.writeFile(outputPath, result.value, 'utf-8');
    console.log(`✅ ${file} -> ${outputName}`);
    if (result.messages.length > 0) {
      console.log(`   warnings: ${result.messages.map(m => m.message).join(', ')}`);
    }
  } catch (err) {
    console.error(`❌ ${file}: ${err.message}`);
  }
}
