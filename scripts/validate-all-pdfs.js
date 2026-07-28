/**
 * Script to validate all PDF files without deleting them
 *
 * This script:
 * 1. Checks all PDFs in the database
 * 2. Validates their file size and signature
 * 3. Reports on their status
 *
 * Usage: node scripts/validate-all-pdfs.js
 */

const path = require('path');
const fs = require('fs');
const { Pdfs } = require('../models');
const { validatePDFFile, formatFileSize } = require('../utils/pdfUpload');

async function validateAllPDFs() {
  // console.log('🔍 Validating all PDF files...\n');

  try {
    const allPDFs = await Pdfs.findAll({
      attributes: ['id', 'title', 'file_path', 'file_size', 'original_filename', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    // console.log(`📊 Total PDFs in database: ${allPDFs.length}\n`);

    let validCount = 0;
    let invalidCount = 0;

    // console.log('PDF Validation Report:');
    // console.log('═'.repeat(80));
    // console.log('');

    for (const pdf of allPDFs) {
      const isValid = validatePDFFile(pdf.file_path);
      const fileExists = fs.existsSync(pdf.file_path);
      const sizeFormatted = formatFileSize(pdf.file_size);

      const status = isValid && fileExists ? '✅ VALID' : '❌ INVALID';

      if (isValid && fileExists) {
        validCount++;
      } else {
        invalidCount++;
      }

      // console.log(`${status} - ${pdf.title}`);
      // console.log(`   File: ${path.basename(pdf.file_path)}`);
      // console.log(`   Size: ${sizeFormatted} (${pdf.file_size} bytes)`);
      // console.log(`   Original: ${pdf.original_filename}`);
      // console.log(`   Created: ${new Date(pdf.created_at).toLocaleString()}`);

      if (!fileExists) {
        // console.log(`   ⚠️  File not found on disk!`);
      } else if (!isValid) {
        // console.log(`   ⚠️  Invalid PDF signature or file too small`);

        // Show first 100 characters of file content for debugging
        const buffer = fs.readFileSync(pdf.file_path, { encoding: 'utf8', start: 0, end: 100 });
        // console.log(`   Content preview: ${buffer.substring(0, 80)}...`);
      }

      // console.log('');
    }

    // console.log('═'.repeat(80));
    // console.log(`\n📊 Summary:`);
    // console.log(`   ✅ Valid PDFs: ${validCount}`);
    // console.log(`   ❌ Invalid PDFs: ${invalidCount}`);
    // console.log(`   📈 Total: ${allPDFs.length}`);

    if (invalidCount > 0) {
      // console.log(`\n⚠️  To remove invalid PDFs, run: node scripts/cleanup-invalid-pdfs.js`);
    }

    // console.log('');

  } catch (error) {
    console.error('❌ Error during validation:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the validation
validateAllPDFs();