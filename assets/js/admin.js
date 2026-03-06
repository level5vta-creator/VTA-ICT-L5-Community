document.addEventListener('DOMContentLoaded', async () => {
    // Get Supabase client from window (attached by supabase.js)
    const supabase = window.supabaseClient;
    if (!supabase) {
        console.error('Supabase client not available');
        document.getElementById('adminGrid').innerHTML =
            `<div class="empty-state"><span>❌</span> Failed to connect to database. Please refresh.</div>`;
        return;
    }

    const adminGrid = document.getElementById('adminGrid');

    // Helper: escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Format date nicely
    function formatDate(isoString) {
        if (!isoString) return 'Unknown date';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Fetch all pending notes (status = 'pending')
    async function fetchPendingNotes() {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notes:', error);
            adminGrid.innerHTML =
                `<div class="empty-state"><span>❌</span> Failed to load notes: ${escapeHtml(error.message)}</div>`;
            return [];
        }
        return data || [];
    }

    // Render notes as cards
    function renderNotes(notes) {
        if (!notes.length) {
            adminGrid.innerHTML = `<div class="empty-state">✅ No pending uploads — all clear!</div>`;
            return;
        }

        const cardsHTML = notes.map(note => {
            const fileType = note.file_type === 'pdf' ? 'PDF' : 'Code';
            const typeClass = note.file_type === 'pdf' ? 'pdf' : 'code';

            return `
        <div class="card note-card" data-id="${note.id}">
          <h3 class="note-title">${escapeHtml(note.title)}</h3>
          <div class="note-meta">
            <span>📚 ${escapeHtml(note.subject || 'Uncategorized')}</span>
            <span>📝 ${escapeHtml(note.topic || 'No topic')}</span>
            <span>👤 ${escapeHtml(note.uploader_name || 'Anonymous')}</span>
            <span>📅 ${formatDate(note.created_at)}</span>
          </div>
          <div style="margin-bottom: 0.75rem;">
            <span class="file-type-badge ${typeClass}">${fileType}</span>
          </div>
          <div class="admin-actions">
            <a href="${escapeHtml(note.file_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-preview">👁️ Preview</a>
            <a href="${escapeHtml(note.file_url)}" download target="_blank" rel="noopener noreferrer" class="btn btn-preview">⬇️ Download</a>
            <button class="btn btn-approve approve-btn" data-note-id="${note.id}">✅ Approve</button>
            <button class="btn btn-delete delete-btn">🗑️ Reject</button>
          </div>
        </div>
      `;
        }).join('');

        adminGrid.innerHTML = cardsHTML;

        // Attach event listeners
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', handleApprove);
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', handleReject);
        });
    }

    // Approve button handler — sets status = 'approved' in the database
    async function handleApprove(e) {
        const btn = e.target.closest('.approve-btn');
        if (!btn) return;
        const noteId = btn.dataset.noteId;

        btn.disabled = true;
        btn.textContent = 'Approving…';

        try {
            const { error } = await supabase
                .from('notes')
                .update({ status: 'approved' })
                .eq('id', noteId);

            if (error) throw error;

            alert('Note approved!');
            location.reload();
        } catch (err) {
            console.error('Approve error:', err);
            alert('Failed to approve note. Please try again.');
            btn.disabled = false;
            btn.textContent = '✅ Approve';
        }
    }

    // Reject button handler — deletes the note entirely
    async function handleReject(e) {
        const card = e.target.closest('.note-card');
        if (!card) return;
        const noteId = card.dataset.id;

        if (!confirm('Are you sure you want to reject and delete this note? This cannot be undone.')) {
            return;
        }

        e.target.disabled = true;
        e.target.textContent = 'Deleting…';

        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', noteId);

            if (error) throw error;

            card.remove();
            if (adminGrid.children.length === 0) {
                adminGrid.innerHTML = `<div class="empty-state">✅ No pending uploads — all clear!</div>`;
            }
        } catch (err) {
            console.error('Reject error:', err);
            alert('Failed to reject note. Please try again.');
            e.target.disabled = false;
            e.target.textContent = '🗑️ Reject';
        }
    }

    // Initial load — Notes
    adminGrid.innerHTML = '<div class="loading-indicator">Loading pending notes…</div>';
    const notes = await fetchPendingNotes();
    renderNotes(notes);

    // ── Community Posts Moderation ──────────────────────────────────────────

    const postsGrid = document.getElementById('postsGrid');

    // Fetch pending community posts
    async function fetchPendingPosts() {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching posts:', error);
            postsGrid.innerHTML =
                `<div class="empty-state"><span>❌</span> Failed to load posts: ${escapeHtml(error.message)}</div>`;
            return [];
        }
        return data || [];
    }

    // Render community post cards
    function renderPosts(posts) {
        if (!posts.length) {
            postsGrid.innerHTML = `<div class="empty-state">✅ No pending community posts — all clear!</div>`;
            return;
        }

        postsGrid.innerHTML = posts.map(post => `
            <div class="card note-card" data-post-id="${post.id}">
                ${post.image_url
                ? `<img src="${escapeHtml(post.image_url)}" alt="Post image" class="post-image" loading="lazy">`
                : `<div class="empty-state" style="padding:1rem;font-size:0.9rem;">🖼️ No image</div>`
            }
                <p class="post-caption">${escapeHtml(post.caption || 'No caption provided.')}</p>
                <div class="note-meta">
                    <span>👤 ${escapeHtml(post.author || 'Anonymous')}</span>
                    <span>📅 ${formatDate(post.created_at)}</span>
                </div>
                <div class="admin-actions">
                    <button class="btn btn-approve approve-post-btn" data-post-id="${post.id}">✅ Approve</button>
                    <button class="btn btn-delete delete-post-btn" data-post-id="${post.id}">🗑️ Reject</button>
                </div>
            </div>
        `).join('');

        // Attach approve listeners
        postsGrid.querySelectorAll('.approve-post-btn').forEach(btn => {
            btn.addEventListener('click', handleApprovePost);
        });

        // Attach reject listeners
        postsGrid.querySelectorAll('.delete-post-btn').forEach(btn => {
            btn.addEventListener('click', handleRejectPost);
        });
    }

    // Approve a community post
    async function handleApprovePost(e) {
        const btn = e.target.closest('.approve-post-btn');
        if (!btn) return;
        const postId = btn.dataset.postId;
        const card = postsGrid.querySelector(`[data-post-id="${postId}"]`);

        btn.disabled = true;
        btn.textContent = 'Approving…';

        try {
            const { error } = await supabase
                .from('posts')
                .update({ status: 'approved' })
                .eq('id', postId);

            if (error) throw error;

            card.remove();
            if (postsGrid.children.length === 0) {
                postsGrid.innerHTML = `<div class="empty-state">✅ No pending community posts — all clear!</div>`;
            }
        } catch (err) {
            console.error('Approve post error:', err);
            alert('Failed to approve post. Please try again.');
            btn.disabled = false;
            btn.textContent = '✅ Approve';
        }
    }

    // Reject (delete) a community post
    async function handleRejectPost(e) {
        const btn = e.target.closest('.delete-post-btn');
        if (!btn) return;
        const postId = btn.dataset.postId;
        const card = postsGrid.querySelector(`[data-post-id="${postId}"]`);

        if (!confirm('Are you sure you want to reject and delete this post? This cannot be undone.')) return;

        btn.disabled = true;
        btn.textContent = 'Deleting…';

        try {
            const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postId);

            if (error) throw error;

            card.remove();
            if (postsGrid.children.length === 0) {
                postsGrid.innerHTML = `<div class="empty-state">✅ No pending community posts — all clear!</div>`;
            }
        } catch (err) {
            console.error('Reject post error:', err);
            alert('Failed to reject post. Please try again.');
            btn.disabled = false;
            btn.textContent = '🗑️ Reject';
        }
    }

    // Initial load — Posts
    const posts = await fetchPendingPosts();
    renderPosts(posts);
});


