document.addEventListener('DOMContentLoaded', async () => {
  const feedEl = document.getElementById('community-feed');
  if (!feedEl) return;

  // Show loading state
  feedEl.innerHTML = '<div class="loading-indicator">Loading posts...</div>';

  try {
    // 1. Fetch approved posts from Supabase
    const { data: posts, error } = await window.supabaseClient
      .from('posts')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      feedEl.innerHTML = `<div class="empty-feed">⚠️ Failed to load posts. Please try again later.</div>`;
      return;
    }

    // 2. If no posts, show empty state
    if (!posts || posts.length === 0) {
      feedEl.innerHTML = `<div class="empty-feed">📭 No posts yet. Be the first to share with the community.</div>`;
      return;
    }

    // 3. Render each post
    feedEl.innerHTML = posts.map(post => createPostCard(post)).join('');

    // 4. Attach like button listeners
    attachLikeListeners();

  } catch (err) {
    console.error('Unexpected error:', err);
    feedEl.innerHTML = `<div class="empty-feed">❌ Something went wrong. Refresh the page.</div>`;
  }
});

// Helper: format date as "Mar 6, 2026"
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Helper: create HTML for a single post
function createPostCard(post) {
  const { id, author, caption, image_url, likes, created_at } = post;

  // Only show image section if image_url exists
  const imageHtml = image_url
    ? `<div class="post-image"><img src="${image_url}" alt="Post image" loading="lazy"></div>`
    : '';

  return `
    <article class="post-card" data-post-id="${id}">
      <div class="post-header">
        <span class="post-author">${escapeHtml(author) || 'Anonymous'}</span>
        <span class="post-date">${formatDate(created_at)}</span>
      </div>
      <div class="post-caption">${escapeHtml(caption) || ''}</div>
      ${imageHtml}
      <div class="post-footer">
        <button class="like-button" data-post-id="${id}" data-likes="${likes || 0}">
          ❤️ <span class="like-count">${likes || 0}</span>
        </button>
      </div>
    </article>
  `;
}

// Simple escape to prevent XSS from user input
function escapeHtml(unsafe) {
  if (!unsafe) return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Attach click handlers to all like buttons
function attachLikeListeners() {
  document.querySelectorAll('.like-button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const button = e.currentTarget;
      const postId = button.dataset.postId;
      const currentLikes = parseInt(button.dataset.likes, 10) || 0;

      // Disable button temporarily to prevent double-clicks
      button.disabled = true;

      try {
        // Optimistic UI update
        const newLikes = currentLikes + 1;
        button.dataset.likes = newLikes;
        button.querySelector('.like-count').textContent = newLikes;

        // Persist to Supabase
        const { error } = await window.supabaseClient
          .from('posts')
          .update({ likes: newLikes })
          .eq('id', postId);

        if (error) {
          console.error('Like update failed:', error);
          // Revert optimistic update on error
          button.dataset.likes = currentLikes;
          button.querySelector('.like-count').textContent = currentLikes;
          alert('Could not update like. Please try again.');
        }
      } catch (err) {
        console.error('Like error:', err);
        button.dataset.likes = currentLikes;
        button.querySelector('.like-count').textContent = currentLikes;
      } finally {
        button.disabled = false;
      }
    });
  });
}
