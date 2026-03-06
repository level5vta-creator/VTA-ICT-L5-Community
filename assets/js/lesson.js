document.addEventListener('DOMContentLoaded', async () => {
    // Get Supabase client from window (attached by supabase.js)
    const supabase = window.supabaseClient;
    if (!supabase) {
        console.error('Supabase client not available');
        document.getElementById('notesGrid').innerHTML = `<div class="empty-state"><span>❌</span>Failed to load notes. Please refresh.</div>`;
        return;
    }

    // DOM elements
    const notesGrid = document.getElementById('notesGrid');
    const searchInput = document.getElementById('searchInput');
    const filterPills = document.querySelectorAll('.pill');
    const topContributorsDiv = document.getElementById('topContributorsList');

    let allNotes = [];           // raw fetched notes
    let filteredNotes = [];      // after search + filter
    let currentSubject = 'all';   // active filter

    // Helper: render notes based on filteredNotes
    function renderNotes() {
        if (filteredNotes.length === 0) {
            notesGrid.innerHTML = `<div class="empty-state"><span>📂</span>No notes match your criteria.</div>`;
            return;
        }

        const cardsHTML = filteredNotes.map(note => {
            // Detect file type icon from file_url extension
            const url = (note.file_url || '').toLowerCase();
            const codeExts = ['.js', '.java', '.py', '.cpp', '.c', '.html', '.css', '.ts', '.php', '.rb', '.go', '.cs'];
            const isCode = codeExts.some(ext => url.endsWith(ext));
            const fileIcon = url.endsWith('.pdf') ? '📄' : isCode ? '💻' : '📁';

            // Format upload date from created_at
            const date = note.created_at
                ? new Date(note.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown date';

            return `
        <div class="note-card">
          <!-- Row 1: File icon + Title -->
          <div class="note-card-header">
            <span class="note-file-icon">${fileIcon}</span>
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
          </div>
          <!-- Row 2: Subject pill -->
          <span class="note-subject">${escapeHtml(note.subject || 'Uncategorized')}</span>
          <span class="note-topic">${escapeHtml(note.topic || '')}</span>
          <!-- Row 3: Uploader + Date -->
          <div class="note-meta">
            <span>👤 ${escapeHtml(note.uploader_name || note.uploader || 'Anonymous')}</span>
            <span>📅 ${date}</span>
          </div>
          <!-- Row 4: Buttons -->
          <div class="note-footer">
            <a href="${escapeHtml(note.file_url)}" target="_blank" rel="noopener noreferrer" class="preview-btn">👁️ Preview</a>
            <a href="${escapeHtml(note.file_url)}" download target="_blank" rel="noopener noreferrer" class="download-btn">📥 Download</a>
          </div>
        </div>
      `;
        }).join('');

        notesGrid.innerHTML = cardsHTML;
    }

    // Simple escape to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Update top contributors based on allNotes (count per uploader)
    function updateTopContributors() {
        const contributorCount = {};
        allNotes.forEach(note => {
            const name = note.uploader_name || 'Anonymous';
            contributorCount[name] = (contributorCount[name] || 0) + 1;
        });

        const sorted = Object.entries(contributorCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const rankEmojis = ['🥇', '🥈', '🥉'];
        if (sorted.length === 0) {
            topContributorsDiv.innerHTML = '<div class="contributor-row">No contributors yet</div>';
            return;
        }

        const rows = sorted.map(([name, count], index) => `
      <div class="contributor-row">
        <span class="rank">${rankEmojis[index]}</span>
        <span class="name">${escapeHtml(name)}</span>
        <span class="count">${count} upload${count !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
        topContributorsDiv.innerHTML = rows;
    }

    // Filter notes by search term and subject
    function applyFilters() {
        const searchTerm = searchInput.value.trim().toLowerCase();

        filteredNotes = allNotes.filter(note => {
            // subject filter
            if (currentSubject !== 'all' && note.subject !== currentSubject) return false;

            // search filter
            if (searchTerm) {
                const titleMatch = note.title?.toLowerCase().includes(searchTerm);
                const subjectMatch = note.subject?.toLowerCase().includes(searchTerm);
                const uploaderMatch = (note.uploader_name || note.uploader)?.toLowerCase().includes(searchTerm);
                return titleMatch || subjectMatch || uploaderMatch;
            }
            return true;
        });

        renderNotes();
    }

    // Fetch notes from Supabase
    async function loadNotes() {
        notesGrid.innerHTML = '<div class="loading-indicator">Loading notes...</div>';

        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', {
                ascending:
                    false
            });

        if (error) {
            console.error('Error fetching notes:', error);
            notesGrid.innerHTML = `<div class="empty-state"><span>❌</span>Error loading notes.</div>`;
            return;
        }

        allNotes = data || [];
        updateTopContributors();
        applyFilters(); // this also renders
    }

    // Event listeners
    searchInput.addEventListener('input', applyFilters);

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            // update active class
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            currentSubject = pill.dataset.subject;
            applyFilters();
        });
    });

    // Initialize
    await loadNotes();

    // Auto-activate filter from URL ?topic= param
    const urlParams = new URLSearchParams(window.location.search);
    const topicParam = urlParams.get('topic');
    if (topicParam) {
        const matchingPill = [...filterPills].find(
            p => p.dataset.subject.toLowerCase() === topicParam.toLowerCase()
        );
        if (matchingPill) {
            matchingPill.click();
        }
    }
});
