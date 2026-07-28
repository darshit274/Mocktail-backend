const { Pdfs } = require('../models');
const fs = require('fs');
const path = require('path');

async function updatePDFSize() {
  try {
    const pdf = await Pdfs.findOne({
      where: { title: 'Sample Study Material' }
    });

    if (!pdf) {
      // console.log('Sample PDF not found');
      return;
    }

    const filePath = path.join(__dirname, '..', pdf.file_path);
    const stats = fs.statSync(filePath);
    
    await pdf.update({
      file_size: stats.size
    });

    // console.log('✅ Updated PDF size to:', stats.size);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

updatePDFSize();