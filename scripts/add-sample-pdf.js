const { Pdfs, PdfCategory } = require('../models');

async function addSamplePDF() {
  try {
    // First, create or find a PDF category
    let category = await PdfCategory.findOne({
      where: { name: 'Study Materials' }
    });

    if (!category) {
      category = await PdfCategory.create({
        name: 'Study Materials',
        description: 'General study materials for various exams',
        is_active: true
      });
      // console.log('✅ Created PDF category:', category.name);
    }

    // Check if sample PDF already exists
    const existingPdf = await Pdfs.findOne({
      where: { title: 'Sample Study Material' }
    });

    if (existingPdf) {
      // console.log('Sample PDF already exists with ID:', existingPdf.id);
      return;
    }

    // Create a sample PDF entry
    const samplePdf = await Pdfs.create({
      title: 'Sample Study Material',
      description: 'This is a sample PDF for testing the secure PDF viewer. It contains important study material for competitive exams.',
      category_id: category.id,
      exam_type_id: null,
      test_series_id: null,
      file_path: 'uploads/pdfs/sample.pdf',
      original_filename: 'sample-study-material.pdf',
      file_size: 1024000, // 1MB
      access_level: 'free',
      tags: ['sample', 'test', 'study-material'],
      is_active: true,
      is_featured: true,
      download_count: 0,
      view_count: 0,
      uploaded_by: 1
    });

    // console.log('✅ Sample PDF created successfully with ID:', samplePdf.id);
    // console.log('📄 PDF Details:', {
//       id: samplePdf.id,
//       title: samplePdf.title,
//       access_level: samplePdf.access_level,
//       file_path: samplePdf.file_path
//     });

  } catch (error) {
    console.error('❌ Error creating sample PDF:', error);
  } finally {
    process.exit(0);
  }
}

addSamplePDF();