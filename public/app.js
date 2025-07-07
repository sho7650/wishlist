document.addEventListener('DOMContentLoaded', () => {
  const wishForm = document.getElementById('wish-form');
  const formTitle = document.getElementById('form-title');
  const submitButton = document.getElementById('submit-button');
  const nameInput = document.getElementById('name');
  const wishInput = document.getElementById('wish');
  const statusMessage = document.getElementById('status-message');
  const wishesList = document.getElementById('wishes-list');
  
  let isEditMode = false;
  
  // 現在のユーザーの投稿を確認
  async function checkCurrentUserWish() {
    try {
      const response = await fetch('/api/wishes/current');
      const data = await response.json();
      
      if (data.wish) {
        // 編集モードに設定
        isEditMode = true;
        formTitle.textContent = '願い事を編集';
        submitButton.textContent = '更新する';
        
        // フォームに値を設定
        nameInput.value = data.wish.name || '';
        wishInput.value = data.wish.wish;
      }
    } catch (error) {
      console.error('Error checking current user wish:', error);
    }
  }
  
  // 最新の願い事を取得して表示
  async function loadLatestWishes() {
    try {
      const response = await fetch('/api/wishes');
      const data = await response.json();
      
      wishesList.innerHTML = '';
      
      data.wishes.forEach(wish => {
        const card = document.createElement('div');
        card.className = 'wish-card';
        
        // ランダムな色を生成
        const hue = Math.floor(Math.random() * 360);
        card.style.backgroundColor = `hsl(${hue}, 70%, 90%)`;
        
        card.innerHTML = `
          <div class="wish-content">${escapeHTML(wish.wish)}</div>
          <div class="wish-author">- ${escapeHTML(wish.name || '匿名')}</div>
        `;
        
        wishesList.appendChild(card);
      });
    } catch (error) {
      console.error('Error loading wishes:', error);
    }
  }
  
  // フォーム送信処理
  wishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const wish = wishInput.value.trim();
    
    if (!wish) {
      showStatus('願い事は必須です', 'error');
      return;
    }
    
    try {
      let response;
      
      if (isEditMode) {
        // 更新リクエスト
        response = await fetch('/api/wishes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, wish })
        });
      } else {
        // 新規投稿リクエスト
        response = await fetch('/api/wishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, wish })
        });
      }
      
      const data = await response.json();
      
      if (response.ok) {
        showStatus(isEditMode ? '願い事を更新しました' : '願い事を投稿しました', 'success');
        
        // 編集モードの場合はページをリロード
        if (!isEditMode) {
          // 新規投稿後はページをリロードして編集モードにする
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          // 編集後は一覧を更新
          loadLatestWishes();
        }
      } else {
        showStatus(data.error || 'エラーが発生しました', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      showStatus('通信エラーが発生しました', 'error');
    }
  });
  
  // ステータスメッセージを表示
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    
    // 3秒後に消える
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }
  
  // HTMLエスケープ処理
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  // 初期化
  checkCurrentUserWish();
  loadLatestWishes();
});
