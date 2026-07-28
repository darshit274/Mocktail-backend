/**
 * Script to clean up invalid PDF files from the database and file system
 *
 * This script:
 * 1. Finds all PDFs with file_size < 100 bytes (likely JSON responses)
 * 2. Validates each PDF file on disk
 * 3. Removes invalid PDFs from database and file system
 *
 * Usage: node scripts/cleanup-invalid-pdfs.js
 */

const path = require('path');
const fs = require('fs');
const { Pdfs } = require('../models');
const { validatePDFFile } = require('../utils/pdfUpload');

async function cleanupInvalidPDFs() {
  // console.log('🔍 Starting cleanup of invalid PDF files...\n');

  try {
    // Find all PDFs
    const allPDFs = await Pdfs.findAll({
      attributes: ['id', 'title', 'file_path', 'file_size', 'original_filename', 'created_at']
    });

    // console.log(`📊 Total PDFs in database: ${allPDFs.length}\n`);

    let invalidCount = 0;
    let deletedCount = 0;
    const invalidPDFs = [];

    // Check each PDF
    for (const pdf of allPDFs) {
      let isInvalid = false;
      let reason = '';

      // Check 1: File size too small
      if (pdf.file_size < 100) {
        isInvalid = true;
        reason = `File size too small (${pdf.file_size} bytes)`;
      }

      // Check 2: File doesn't exist
      if (!isInvalid && !fs.existsSync(pdf.file_path)) {
        isInvalid = true;
        reason = 'File not found on disk';
      }

      // Check 3: Invalid PDF signature
      if (!isInvalid && !validatePDFFile(pdf.file_path)) {
        isInvalid = true;
        reason = 'Invalid PDF signature';
      }

      // Check 4: File contains JSON (check first 100 bytes)
      if (!isInvalid && fs.existsSync(pdf.file_path)) {
        const buffer = fs.readFileSync(pdf.file_path, { encoding: 'utf8', start: 0, end: 100 });
        if (buffer.includes('{"success"') || buffer.includes('"message"')) {
          isInvalid = true;
          reason = 'File contains JSON instead of PDF content';
        }
      }

      if (isInvalid) {
        invalidCount++;
        invalidPDFs.push({
          id: pdf.id,
          title: pdf.title,
          file_size: pdf.file_size,
          file_path: pdf.file_path,
          original_filename: pdf.original_filename,
          created_at: pdf.created_at,
          reason: reason
        });

        // console.log(`❌ INVALID PDF #${invalidCount}:`);
        // console.log(`   ID: ${pdf.id}`);
        // console.log(`   Title: ${pdf.title}`);
        // console.log(`   Size: ${pdf.file_size} bytes`);
        // console.log(`   File: ${path.basename(pdf.file_path)}`);
        // console.log(`   Reason: ${reason}`);
        // console.log(`   Created: ${pdf.created_at}`);
        // console.log('');
      }
    }

    if (invalidCount === 0) {
      // console.log('✅ No invalid PDFs found! All PDFs are valid.\n');
      return;
    }

    // console.log(`\n⚠️  Found ${invalidCount} invalid PDF(s)\n`);

    // Ask for confirmation before deleting
    // console.log('Do you want to delete these invalid PDFs? (yes/no)');
    // console.log('This will remove them from both the database and file system.\n');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('Enter your choice: ', async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        // console.log('\n🗑️  Deleting invalid PDFs...\n');

        for (const invalidPDF of invalidPDFs) {
          try {
            // Delete from file system
            if (fs.existsSync(invalidPDF.file_path)) {
              fs.unlinkSync(invalidPDF.file_path);
              // console.log(`   ✓ Deleted file: ${path.basename(invalidPDF.file_path)}`);
            }

            // Delete from database
            await Pdfs.destroy({ where: { id: invalidPDF.id } });
            // console.log(`   ✓ Deleted database record: ${invalidPDF.title}`);
            // console.log('');

            deletedCount++;
          } catch (err) {
            console.error(`   ✗ Error deleting ${invalidPDF.title}:`, err.message);
          }
        }

        // console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} invalid PDF(s).\n`);
      } else {
        // console.log('\n❌ Cleanup cancelled. No files were deleted.\n');
      }

      readline.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupInvalidPDFs();