document.addEventListener('DOMContentLoaded', () => {
  // ── UI Helper Functions (unchanged) ──────────────────────────────────────
  function showUploadOverlay() {
    document.getElementById('uploadOverlay').style.display = 'flex';
    updateUploadProgress(0);
  }
  function hideUploadOverlay() {
    document.getElementById('uploadOverlay').style.display = 'none';
  }
  function updateUploadProgress(percent) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressPercent');
    progressBar.style.width = percent + '%';
    progressText.textContent = percent + '%';
  }
  function showSuccessPopup() {
    document.getElementById('successPopup').style.display = 'flex';
  }
  function closeSuccessPopup() {
    document.getElementById('successPopup').style.display = 'none';
  }
  // Attach close event (unchanged)
  document.getElementById('closeSuccessBtn').addEventListener('click', closeSuccessPopup);

  // ── Image-to-PDF Converter ────────────────────────────────────────────────
  /**
   * Reads one File as a Data URL (Promise-based).
   */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Loads a Data URL into an HTMLImageElement and returns it (Promise-based).
   * Needed to get naturalWidth / naturalHeight for proper PDF page sizing.
   */
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = dataUrl;
    });
  }

  /**
   * Converts an array of image Files into a single PDF Blob using jsPDF.
   * Each image becomes one page. The page dimensions match the image's
   * aspect ratio (portrait / landscape auto-detected), capped to A4 max.
   *
   * @param {File[]} imageFiles
   * @param {Function} onProgress  called with (current, total) for UI feedback
   * @returns {Promise<Blob>}
   */
  async function imagesToPdfBlob(imageFiles, onProgress) {
    const { jsPDF } = window.jspdf;

    let pdf = null; // initialised after first image so we know orientation

    for (let i = 0; i < imageFiles.length; i++) {
      const dataUrl = await readFileAsDataURL(imageFiles[i]);
      const img = await loadImage(dataUrl);

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const orientation = imgW >= imgH ? 'landscape' : 'portrait';

      // A4 dimensions in mm
      const A4 = { w: 210, h: 297 };
      const pageW = orientation === 'landscape' ? A4.h : A4.w;
      const pageH = orientation === 'landscape' ? A4.w : A4.h;

      // Scale image to fill the page while keeping aspect ratio
      const scale = Math.min(pageW / imgW, pageH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const offsetX = (pageW - drawW) / 2;
      const offsetY = (pageH - drawH) / 2;

      if (pdf === null) {
        // First image – create the document
        pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
      } else {
        // Subsequent images – add a new page with the right orientation
        pdf.addPage('a4', orientation);
      }

      // Detect format from MIME type for jsPDF (JPEG / PNG / WEBP)
      const mime = imageFiles[i].type || 'image/jpeg';
      const fmt = mime.includes('png') ? 'PNG' : mime.includes('webp') ? 'WEBP' : 'JPEG';

      pdf.addImage(dataUrl, fmt, offsetX, offsetY, drawW, drawH);

      // Report progress during conversion (0–60% range)
      if (onProgress) onProgress(i + 1, imageFiles.length);
    }

    return pdf.output('blob');
  }

  // ── Upload Form ───────────────────────────────────────────────────────────
  const form = document.getElementById('uploadForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Remove old error messages
    const prevError = document.getElementById('upload-error-message');
    if (prevError) prevError.remove();

    // Collect form fields (unchanged)
    const titleInput = form.querySelector('[name="title"]');
    const subjectSelect = form.querySelector('[name="subject"]');
    const topicInput = form.querySelector('[name="topic"]');
    const uploaderInput = form.querySelector('[name="uploader"]');
    const fileTypeSelect = form.querySelector('[name="file-type"]');
    const fileInput = form.querySelector('[name="file-upload"]');

    const title = titleInput?.value.trim();
    const subject = subjectSelect?.value;
    const topic = topicInput?.value.trim();
    const uploader_name = uploaderInput?.value.trim();
    const file_type = fileTypeSelect?.value;
    const files = fileInput?.files;

    if (!title || !subject || !topic || !uploader_name || !file_type || !files?.length) {
      const errorMsg = document.createElement('div');
      errorMsg.id = 'upload-error-message';
      errorMsg.className = 'error-message';
      errorMsg.innerText = 'Please fill in all required fields and select a file.';
      form.parentNode.insertBefore(errorMsg, form);
      return;
    }

    // Check Supabase client (unchanged)
    const supabase = window.supabaseClient;
    if (!supabase) {
      const errorMsg = document.createElement('div');
      errorMsg.id = 'upload-error-message';
      errorMsg.className = 'error-message';
      errorMsg.innerText = 'Supabase client not initialized.';
      form.parentNode.insertBefore(errorMsg, form);
      return;
    }

    // Show progress overlay (unchanged)
    showUploadOverlay();

    // Simulated progress animation to 60% while conversion runs
    let progress = 0;
    const progressInterval = setInterval(() => {
      if (progress < 60) {
        progress += 2;
        updateUploadProgress(progress);
      }
    }, 60);

    try {
      let uploadFile;      // the File / Blob that actually goes to Supabase
      let uploadFileName;  // the storage path filename
      let dbFileType;      // what we record in the `file_type` column

      const timestamp = Date.now();

      // ── Branch: Images → convert to PDF ──────────────────────────────────
      if (file_type === 'images') {
        const imageFiles = Array.from(files);

        // Validate: every selected file must be an image
        const nonImages = imageFiles.filter(f => !f.type.startsWith('image/'));
        if (nonImages.length > 0) {
          clearInterval(progressInterval);
          hideUploadOverlay();
          const errorMsg = document.createElement('div');
          errorMsg.id = 'upload-error-message';
          errorMsg.className = 'error-message';
          errorMsg.innerText = 'Please select image files only (JPG, PNG, WEBP, etc.) for this file type.';
          form.parentNode.insertBefore(errorMsg, form);
          return;
        }

        // Convert images → PDF (progress updates handled inside)
        const pdfBlob = await imagesToPdfBlob(imageFiles, (done, total) => {
          // Map conversion progress to 0–60% on the bar
          const pct = Math.round((done / total) * 60);
          clearInterval(progressInterval);
          updateUploadProgress(pct);
        });

        uploadFile = pdfBlob;
        uploadFileName = `${timestamp}-converted.pdf`;
        dbFileType = 'pdf'; // always recorded as pdf in DB

        // ── Branch: PDF or Code → upload as-is (original logic) ──────────────
      } else {
        uploadFile = files[0];
        uploadFileName = `${timestamp}-${files[0].name}`;
        dbFileType = file_type;
      }

      // ── Animate remaining progress 60% → 90% while Supabase uploads ──────
      let uploadProgress = progress < 60 ? 60 : progress;
      const uploadProgressInterval = setInterval(() => {
        if (uploadProgress < 90) {
          uploadProgress += 2;
          updateUploadProgress(uploadProgress);
        }
      }, 60);

      // ── Supabase storage upload (untouched logic, just variables changed) ─
      const { error: uploadError } = await supabase.storage
        .from('notes-files')
        .upload(uploadFileName, uploadFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('notes-files')
        .getPublicUrl(uploadFileName);

      const file_url = urlData.publicUrl;

      // ── DB insert – single row (file_type always 'pdf' for images) ────────
      const { error: insertError } = await supabase
        .from('notes')
        .insert([
          {
            title,
            subject,
            topic,
            uploader_name,
            file_type: dbFileType,
            file_url,
            status: 'pending'
          }
        ]);

      if (insertError) throw insertError;

      clearInterval(uploadProgressInterval);
      updateUploadProgress(100);

      // Success (unchanged)
      setTimeout(() => {
        hideUploadOverlay();
        showSuccessPopup();
        form.reset();
      }, 500);

    } catch (err) {
      clearInterval(progressInterval);
      hideUploadOverlay();
      const errorMsg = document.createElement('div');
      errorMsg.id = 'upload-error-message';
      errorMsg.className = 'error-message';
      errorMsg.innerText = 'Upload failed. Please try again.';
      form.parentNode.insertBefore(errorMsg, form);
      console.error('Upload error:', err);
    }
  });
});
