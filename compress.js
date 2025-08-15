
import { glob } from 'glob';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import zlib from 'zlib';

const pipe = promisify(pipeline);

async function compressFile(file, algorithm, extension) {
  const source = createReadStream(file);
  const destination = createWriteStream(`${file}${extension}`);
  const stream = algorithm === 'brotli' ? zlib.createBrotliCompress() : zlib.createGzip();
  
  await pipe(source, stream, destination);
}

async function main() {
  console.log('Starting compression...');

  const files = glob.sync('dist/**/*.{js,css,html}');

  if (files.length === 0) {
    console.log('No files found to compress.');
    return;
  }

  for (const file of files) {
    try {
      const stats = statSync(file);
      console.log(`Compressing ${file} (${stats.size} bytes)...`);
      
      await compressFile(file, 'gzip', '.gz');
      console.log(`  -> gzipped`);
      
      await compressFile(file, 'brotli', '.br');
      console.log(`  -> brotli`);
      
    } catch (error) {
      console.error(`Failed to compress ${file}:`, error);
    }
  }

  console.log('Compression finished.');
}

main().catch(err => console.error(err));
