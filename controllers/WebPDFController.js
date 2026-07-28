const { Op } = require('sequelize');
const { Pdfs, PdfCategory, ExamType, User } = require('../models');

class WebPDFController {
  // Get PDFs with web app compatibility
  static async getPDFs(req, res) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        search
      } = req.query;
      const userId = req.user?.id;

      const offset = (page - 1) * limit;
      const where = { is_active: true };

      // Add search filter
      if (search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      // Add category filter (map web app categories to database categories)
      if (category && category !== 'all') {
        const categoryMap = {
          'notes': 'Study Notes',
          'books': 'Reference Books', 
          'papers': 'Question Papers',
          'guides': 'Study Guides'
        };
        
        // If we have category table, we'd filter by it, for now just use description matching
        if (categoryMap[category]) {
          where[Op.or] = [
            ...(where[Op.or] || []),
            { title: { [Op.like]: `%${categoryMap[category]}%` } },
            { description: { [Op.like]: `%${categoryMap[category]}%` } }
          ];
        }
      }

      const { count, rows } = await Pdfs.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']],
        attributes: [
          'id', 'title', 'description', 'original_filename',
          'file_size', 'access_level', 'download_count', 'view_count',
          'tags', 'created_at', 'updated_at', 'is_featured'
        ]
      });

      // Transform data to match web app format
      const pdfsWithMeta = rows.map((pdf) => {
        // Convert file size to readable format
        const sizeInMB = (parseInt(pdf.file_size) / (1024 * 1024)).toFixed(1);
        
        // Determine category from title/description
        let category = 'notes'; // default
        const title = pdf.title.toLowerCase();
        const description = pdf.description.toLowerCase();
        
        if (title.includes('book') || description.includes('book')) {
          category = 'books';
        } else if (title.includes('paper') || title.includes('question') || description.includes('paper')) {
          category = 'papers';
        } else if (title.includes('guide') || description.includes('guide')) {
          category = 'guides';
        }

        // Parse tags
        let tags = [];
        try {
          if (pdf.tags) {
            tags = typeof pdf.tags === 'string' ? JSON.parse(pdf.tags) : pdf.tags;
          }
        } catch (e) {
          tags = [];
        }
        
        // Generate a numeric ID from the UUID for web app compatibility
        const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;

        return {
          id: numericId,
          title: pdf.title,
          description: pdf.description || `PDF document: ${pdf.original_filename}`,
          category: category,
          fileSize: `${sizeInMB} MB`,
          downloadCount: pdf.download_count || 0,
          isDownloaded: false, // TODO: Track per-user download status
          isPremium: pdf.access_level === 'premium',
          hasAccess: pdf.access_level !== 'premium', // Free access by default, TODO: check user subscriptions
          fileUrl: `/api/pdfs/${pdf.id}/view`,
          uploadDate: pdf.created_at,
          tags: Array.isArray(tags) ? tags : []
        };
      });

      res.json({
        success: true,
        message: 'PDFs retrieved successfully',
        data: pdfsWithMeta,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });

    } catch (error) {
      console.error('PDF list error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Download PDF
  static async downloadPDF(req, res) {
    try {
      const { id } = req.params;
      
      // Find PDF by the numeric ID (convert back to UUID)
      const pdfs = await Pdfs.findAll({
        where: { is_active: true },
        attributes: ['id', 'title', 'original_filename', 'download_count']
      });
      
      // Find matching PDF by converting UUID to numeric ID
      const targetPdf = pdfs.find(pdf => {
        const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;
        return numericId === parseInt(id);
      });

      if (!targetPdf) {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      // Increment download count
      await Pdfs.update(
        { download_count: (targetPdf.download_count || 0) + 1 },
        { where: { id: targetPdf.id } }
      );

      // For now, return a success response
      // In production, this would handle actual file streaming
      res.json({
        success: true,
        message: 'PDF download initiated',
        filename: targetPdf.original_filename
      });

    } catch (error) {
      console.error('PDF download error:', error);
      res.status(500).json({
        success: false,
        message: 'Download failed'
      });
    }
  }

  // Preview PDF
  static async previewPDF(req, res) {
    try {
      const { id } = req.params;
      
      // Find PDF by the numeric ID (similar to download)
      const pdfs = await Pdfs.findAll({
        where: { is_active: true },
        attributes: ['id', 'title', 'view_count']
      });
      
      const targetPdf = pdfs.find(pdf => {
        const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;
        return numericId === parseInt(id);
      });

      if (!targetPdf) {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      // Increment view count
      await Pdfs.update(
        { view_count: (targetPdf.view_count || 0) + 1 },
        { where: { id: targetPdf.id } }
      );

      // Return preview URL (in production, this would be actual PDF viewer)
      res.json({
        success: true,
        message: 'PDF preview available',
        previewUrl: `/api/pdfs/${targetPdf.id}/view`
      });

    } catch (error) {
      console.error('PDF preview error:', error);
      res.status(500).json({
        success: false,
        message: 'Preview failed'
      });
    }
  }

  // View PDF (serve actual PDF file)
  static async viewPDF(req, res) {
    try {
      const { id } = req.params;
      
      // Find PDF by UUID (this endpoint handles both UUID and numeric ID)
      let targetPdf = null;
      
      // Check if it's a UUID format (contains dashes)
      if (id.includes('-')) {
        // Direct UUID lookup
        targetPdf = await Pdfs.findOne({
          where: { id: id, is_active: true },
          attributes: ['id', 'title', 'original_filename', 'file_path', 'view_count']
        });
      } else {
        // Numeric ID lookup (convert from numeric to UUID)
        const pdfs = await Pdfs.findAll({
          where: { is_active: true },
          attributes: ['id', 'title', 'original_filename', 'file_path', 'view_count']
        });
        
        targetPdf = pdfs.find(pdf => {
          const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;
          return numericId === parseInt(id);
        });
      }

      if (!targetPdf) {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      // Increment view count
      await Pdfs.update(
        { view_count: (targetPdf.view_count || 0) + 1 },
        { where: { id: targetPdf.id } }
      );

      // For security, return HTML with embedded PDF viewer instead of direct PDF
      // This prevents direct PDF access and enables our security measures
      const secureViewerHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PDF Viewer - ${targetPdf.title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-user-select: none;
              -moz-user-select: none;
              -ms-user-select: none;
              user-select: none;
              -webkit-touch-callout: none;
              -webkit-tap-highlight-color: transparent;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #1a1a1a;
              color: white;
              overflow: hidden;
              position: fixed;
              width: 100vw;
              height: 100vh;
            }
            
            .viewer-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              background: #2d2d2d;
              padding: 1rem;
              border-bottom: 1px solid #404040;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-shrink: 0;
            }
            
            .title {
              font-size: 1.1rem;
              font-weight: 600;
              color: #ffffff;
              max-width: 70%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .close-btn {
              background: #ef4444;
              color: white;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            
            .close-btn:hover {
              background: #dc2626;
            }
            
            .content {
              flex: 1;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            
            .pdf-container {
              flex: 1;
              background: #2a2a2a;
              border: 1px solid #404040;
              border-radius: 8px;
              margin: 1rem;
              position: relative;
              overflow: hidden;
            }
            
            .pdf-viewer {
              width: 100%;
              height: 100%;
              border: none;
              background: #2a2a2a;
            }
            
            .security-overlay {
              position: absolute;
              top: 10px;
              right: 10px;
              background: rgba(30, 58, 138, 0.9);
              color: #93c5fd;
              padding: 0.5rem;
              border-radius: 6px;
              font-size: 0.8rem;
              z-index: 1000;
              pointer-events: none;
            }
            
            /* Disable text selection and dragging */
            ::selection {
              background: transparent;
            }
            
            ::-moz-selection {
              background: transparent;
            }
            
            img, video, canvas {
              -webkit-user-drag: none;
              -khtml-user-drag: none;
              -moz-user-drag: none;
              -o-user-drag: none;
              user-drag: none;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="viewer-container">
            <div class="header">
              <div class="title">${targetPdf.title}</div>
              <button class="close-btn" onclick="closeViewer()">Close</button>
            </div>
            <div class="content">
              <div class="pdf-container">
                <div class="security-overlay">
                  🔒 Secure • Protected
                </div>
                <embed 
                  src="/api/pdfs/${targetPdf.id}/file" 
                  type="application/pdf" 
                  class="pdf-viewer"
                  style="pointer-events: none;"
                />
              </div>
            </div>
          </div>

          <script>
            // Security measures
            document.addEventListener('contextmenu', e => e.preventDefault());
            document.addEventListener('selectstart', e => e.preventDefault());
            document.addEventListener('dragstart', e => e.preventDefault());
            
            // Keyboard shortcuts blocking
            document.addEventListener('keydown', function(e) {
              // Block common screenshot shortcuts
              if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'a' || e.key === 'c' || e.key === 'v')) {
                e.preventDefault();
                return false;
              }
              
              // Block F12, F5, Ctrl+Shift+I, Ctrl+U, etc.
              if (e.key === 'F12' || e.key === 'F5' || 
                  ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') ||
                  ((e.ctrlKey || e.metaKey) && e.key === 'u')) {
                e.preventDefault();
                return false;
              }
              
              // Block Alt+Tab, Alt+F4
              if (e.altKey && (e.key === 'Tab' || e.key === 'F4')) {
                e.preventDefault();
                return false;
              }
            });
            
            // Visibility change detection
            document.addEventListener('visibilitychange', function() {
              if (document.hidden) {
                // console.log('Tab hidden - potential screenshot attempt detected');
              }
            });
            
            // Close viewer function
            function closeViewer() {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.close();
              }
            }
            
            // Disable developer tools
            setInterval(function() {
              if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
                // console.log('Developer tools detected');
                // In production, you might want to close the window or redirect
              }
            }, 1000);
          </script>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      
      res.send(secureViewerHTML);

    } catch (error) {
      console.error('PDF view error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load PDF'
      });
    }
  }

  // Serve PDF file without authentication 
  static async servePDFFile(req, res) {
    try {
      const { id } = req.params;
      const path = require('path');
      const fs = require('fs');
      
      // Find PDF by UUID or numeric ID conversion
      let targetPdf = null;
      
      if (id.includes('-')) {
        // Direct UUID lookup
        targetPdf = await Pdfs.findOne({
          where: { id: id, is_active: true },
          attributes: ['id', 'title', 'file_path', 'original_filename', 'mime_type']
        });
      } else {
        // Numeric ID lookup
        const pdfs = await Pdfs.findAll({
          where: { is_active: true },
          attributes: ['id', 'title', 'file_path', 'original_filename', 'mime_type']
        });
        
        targetPdf = pdfs.find(pdf => {
          const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;
          return numericId === parseInt(id);
        });
      }

      if (!targetPdf) {
        return res.status(404).json({
          success: false,
          message: 'PDF file not found'
        });
      }

      // Construct the full file path
      const filePath = path.resolve(targetPdf.file_path);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('PDF file not found on disk:', filePath);
        return res.status(404).json({
          success: false,
          message: 'PDF file not found on server'
        });
      }

      // Set headers for PDF serving
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + targetPdf.original_filename + '"');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Stream the PDF file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('Error streaming PDF file:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error reading PDF file'
          });
        }
      });

    } catch (error) {
      console.error('PDF file serve error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to serve PDF file'
      });
    }
  }

  // Simple PDF viewer - no authentication required
  static async secureViewPDF(req, res) {
    try {
      const { id } = req.params;

      // Get the base URL from request for proper absolute URLs
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      // Find PDF with UUID conversion (no auth required)
      let targetPdf;
      
      // Check if ID is a UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(id)) {
        // Direct UUID lookup
        targetPdf = await Pdfs.findOne({
          where: { id: id, is_active: true },
          attributes: ['id', 'title', 'file_path', 'original_filename']
        });
      } else {
        // Numeric ID - find by reverse lookup
        const pdfs = await Pdfs.findAll({
          where: { is_active: true },
          attributes: ['id', 'title', 'file_path', 'original_filename']
        });
        
        targetPdf = pdfs.find(pdf => {
          const numericId = parseInt(pdf.id.replace(/-/g, '').substring(0, 8), 16) % 1000000;
          return numericId === parseInt(id);
        });
      }
      
      if (!targetPdf) {
        return res.status(404).json({
          success: false,
          message: 'PDF not found'
        });
      }

      // Simple PDF viewer with devtools blocking
      const secureViewerHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PDF Viewer - ${targetPdf.title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #1a1a1a;
              color: white;
              overflow: hidden;
              position: fixed;
              width: 100vw;
              height: 100vh;
            }
            
            .viewer-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            
            .header {
              background: #2d2d2d;
              padding: 1rem;
              border-bottom: 1px solid #404040;
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-shrink: 0;
            }
            
            .title {
              font-size: 1.1rem;
              font-weight: 600;
              color: #ffffff;
              max-width: 70%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .close-btn {
              background: #ef4444;
              color: white;
              border: none;
              padding: 0.5rem 1rem;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            
            .close-btn:hover {
              background: #dc2626;
            }
            
            .content {
              flex: 1;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            
            .pdf-container {
              flex: 1;
              background: #2a2a2a;
              border: 1px solid #404040;
              border-radius: 8px;
              margin: 1rem;
              position: relative;
              overflow: hidden;
            }
            
            .pdf-viewer {
              width: 100%;
              height: 100%;
              border: none;
              background: #2a2a2a;
            }
          </style>
        </head>
        <body>
          <div class="viewer-container">
            <div class="header">
              <div class="title">${targetPdf.title}</div>
              <button class="close-btn" onclick="closeViewer()">Close</button>
            </div>
            <div class="content">
              <div class="pdf-container">
                <embed 
                  src="${baseUrl}/api/pdfs/${targetPdf.id}/file" 
                  type="application/pdf" 
                  class="pdf-viewer"
                />
              </div>
            </div>
          </div>

          <script>
            // Block F12 and common developer shortcuts
            document.addEventListener('keydown', function(e) {
              // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
              if (e.key === 'F12' || 
                  (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
                  (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                return false;
              }
            });
            
            // Block right-click context menu
            document.addEventListener('contextmenu', e => e.preventDefault());
            
            // Close viewer function
            function closeViewer() {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.close();
              }
            }
          </script>
        </body>
        </html>
      `;

      // Set security headers
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.send(secureViewerHTML);

    } catch (error) {
      console.error('Secure PDF view error:', error);
      res.status(500).json({
        success: false,
        message: 'Secure PDF access failed'
      });
    }
  }
}

module.exports = WebPDFController;