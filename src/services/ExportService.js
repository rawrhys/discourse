// src/services/ExportService.js
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * ExportService
 * Service responsible for exporting courses in various formats
 */
class ExportService {
  /**
   * Download a course as PDF
   * @param {Course} course - The course to export
   */
  async downloadCourseAsPDF(course) {
    const pdf = new jsPDF();
    
    // Add course title
    pdf.setFontSize(24);
    pdf.setTextColor(0, 51, 102);
    pdf.text(course.title, 20, 20);
    
    // Add course description
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const descriptionLines = pdf.splitTextToSize(course.description, 170);
    pdf.text(descriptionLines, 20, 30);
    
    // Add course info
    pdf.setFontSize(14);
    pdf.setTextColor(0, 51, 102);
    pdf.text('Course Information', 20, 50);
    
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Difficulty Level: ${course.difficultyLevel.charAt(0).toUpperCase() + course.difficultyLevel.slice(1)}`, 20, 60);
    
    // Add learning objectives
    pdf.setFontSize(14);
    pdf.setTextColor(0, 51, 102);
    pdf.text('Learning Objectives', 20, 70);
    
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    let yPos = 80;
    course.learningObjectives.forEach((objective, index) => {
      pdf.text(`${index + 1}. ${objective}`, 20, yPos);
      yPos += 10;
    });
    
    // Process each module
    let currentPage = 1;
    for (const module of course.modules) {
      // Add page break if necessary
      if (yPos > 250) {
        pdf.addPage();
        yPos = 20;
        currentPage++;
      }
      
      // Module title
      pdf.setFontSize(16);
      pdf.setTextColor(0, 51, 102);
      pdf.text(`Module ${module.sequenceNumber + 1}: ${module.title}`, 20, yPos);
      yPos += 10;
      
      // Module description
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      const moduleDescLines = pdf.splitTextToSize(module.description, 170);
      pdf.text(moduleDescLines, 20, yPos);
      yPos += moduleDescLines.length * 7 + 5;
      
      // Process each lesson
      for (const lesson of module.lessons) {
        // Add page break if necessary
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
          currentPage++;
        }
        
        // Lesson title
        pdf.setFontSize(14);
        pdf.setTextColor(51, 51, 153);
        pdf.text(`Lesson: ${lesson.title}`, 25, yPos);
        yPos += 10;
        
        // Lesson content (simplified - just the first paragraph)
        pdf.setFontSize(12);
        pdf.setTextColor(0, 0, 0);
        const contentParagraphs = lesson.content.split('\n\n');
        const firstParagraph = contentParagraphs[0];
        if (firstParagraph) {
          const contentLines = pdf.splitTextToSize(firstParagraph, 165);
          pdf.text(contentLines, 25, yPos);
          yPos += contentLines.length * 7 + 5;
        }
        
        // Note about supplementary resources
        if (lesson.supplementaryResources?.length > 0) {
          pdf.setFontSize(11);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`* This lesson has ${lesson.supplementaryResources.length} supplementary resources (not included in PDF)`, 25, yPos);
          yPos += 7;
        }
        
        // Note about interactive elements
        if (lesson.interactiveElements?.length > 0) {
          pdf.setFontSize(11);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`* This lesson has ${lesson.interactiveElements.length} interactive elements (not included in PDF)`, 25, yPos);
          yPos += 10;
        }
      }
      
      // Add spacing after each module
      yPos += 10;
    }
    
    // Add page numbers
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pageCount}`, pdf.internal.pageSize.getWidth() - 40, pdf.internal.pageSize.getHeight() - 10);
    }
    
    // Download the PDF
    pdf.save(`${course.title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }
  
  /**
   * Export course to HTML format
   * @param {Course} course - The course to export
   * @returns {string} - HTML content
   */
  exportCourseToHTML(course) {
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${course.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #003366; }
          h2 { color: #003366; margin-top: 30px; }
          h3 { color: #333399; }
          .module { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
          .lesson { margin-left: 20px; margin-bottom: 15px; }
          .objectives { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
          .quiz { background-color: #e6f2ff; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>${course.title}</h1>
        <p>${course.description}</p>
        
        <div class="objectives">
          <h2>Learning Objectives</h2>
          <ul>
            ${course.learningObjectives.map(objective => `<li>${objective}</li>`).join('')}
          </ul>
          <p><strong>Difficulty Level:</strong> ${course.difficultyLevel.charAt(0).toUpperCase() + course.difficultyLevel.slice(1)}</p>
        </div>
    `;
    
    // Add modules
    course.modules.forEach((module, moduleIndex) => {
      html += `
        <div class="module">
          <h2>Module ${moduleIndex + 1}: ${module.title}</h2>
          <p>${module.description}</p>
      `;
      
      // Add lessons
      module.lessons.forEach((lesson, lessonIndex) => {
        html += `
          <div class="lesson">
            <h3>Lesson ${lessonIndex + 1}: ${lesson.title}</h3>
            <div class="lesson-content">
              ${lesson.content.split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
            </div>
        `;
        
        // Add supplementary resources
        if (lesson.supplementaryResources && lesson.supplementaryResources.length > 0) {
          html += `
            <div class="resources">
              <h4>Additional Resources</h4>
              <ul>
                ${lesson.supplementaryResources.map(resource => 
                  `<li><a href="${resource.url}" target="_blank">${resource.title}</a> - ${resource.description}</li>`
                ).join('')}
              </ul>
            </div>
          `;
        }
        
        html += `</div>`;
      });
      
      html += `</div>`;
    });
    
    html += `
        <footer>
          <p>Generated by LMS Generator - ${new Date().toLocaleDateString()}</p>
        </footer>
      </body>
      </html>
    `;
    
    return html;
  }
  
  /**
   * Generate a download link for HTML content
   * @param {string} htmlContent - HTML content to download
   * @param {string} filename - Name for the download file
   */
  downloadHTML(htmlContent, filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
    element.setAttribute('download', filename);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
  }
  
  /**
   * Export and download course as HTML
   * @param {Course} course - The course to export
   */
  exportAndDownloadHTML(course) {
    const htmlContent = this.exportCourseToHTML(course);
    this.downloadHTML(htmlContent, `${course.title.replace(/\s+/g, '-').toLowerCase()}.html`);
  }
  
  /**
   * Export course to SCORM format (simplified mock implementation)
   * @param {Course} course - The course to export
   */
  exportToSCORM(course) {
    // This would normally generate a SCORM-compliant package
    // For demonstration purposes, we'll show a notification
    alert('SCORM export functionality would be implemented here in a production application.');
    console.log('Would export course to SCORM format:', course.title);
  }
}

// Singleton instance
const exportService = new ExportService();
export default exportService;
export { exportService, ExportService };