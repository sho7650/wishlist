document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded: Initializing application...");

  // --- DOM要素の取得 ---
  const viewerContainer = document.getElementById("viewer-container");
  const formContainer = document.getElementById("form-container");
  const newWishButton = document.getElementById("new-wish-button");
  const backButton = document.getElementById("back-button");
  const wishForm = document.getElementById("wish-form");
  const formTitle = document.getElementById("form-title");
  const submitButton = document.getElementById("submit-button");
  const nameInput = document.getElementById("name");
  const wishInput = document.getElementById("wish");
  const statusMessage = document.getElementById("status-message");
  const wishesList = document.getElementById("wishes-list");
  const loadingIndicator = document.getElementById("loading-indicator");

  // --- アプリケーションの状態管理 ---
  let isEditMode = false;
  let currentOffset = 0;
  let isLoading = false;
  let hasMoreWishes = true;

  // --- 画面表示の切り替え関数 ---
  function showViewerScreen() {
    console.log("Switching to Viewer Screen");
    viewerContainer.classList.remove("hidden");
    formContainer.classList.add("hidden");
  }

  function showFormScreen() {
    console.log("Switching to Form Screen");
    viewerContainer.classList.add("hidden");
    formContainer.classList.remove("hidden");
  }

  // --- 願い事データを読み込む関数 ---
  async function loadWishes(offset = 0, append = false) {
    if (isLoading) {
      console.log(
        "loadWishes: Skipped because a request is already in progress."
      );
      return;
    }
    if (!append && !hasMoreWishes) {
      console.log(
        "loadWishes: Skipped because there are no more wishes to load for a fresh list."
      );
      return;
    }

    isLoading = true;
    loadingIndicator.classList.remove("hidden");
    console.log(`loadWishes: Fetching wishes... (offset: ${offset})`);

    try {
      const response = await fetch(`/api/wishes?limit=20&offset=${offset}`);
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json();

      if (!append) {
        wishesList.innerHTML = "";
      }

      if (data.wishes.length > 0) {
        data.wishes.forEach((wish) => {
          const card = document.createElement("div");
          card.className = "wish-card";
          const hue = Math.floor(Math.random() * 360);
          card.style.backgroundColor = `hsl(${hue}, 70%, 90%)`;
          card.innerHTML = `
            <div class="wish-content">${escapeHTML(wish.wish)}</div>
            <div class="wish-author">- ${escapeHTML(wish.name || "匿名")}</div>
          `;
          wishesList.appendChild(card);
        });
        currentOffset += data.wishes.length;
      }

      // 取得したデータがリクエストした数より少なければ、これが最後のページ
      if (data.wishes.length < 20) {
        hasMoreWishes = false;
        console.log("loadWishes: Reached the end of all wishes.");
      }

      console.log(
        `loadWishes: Success. New offset is ${currentOffset}. Has more: ${hasMoreWishes}`
      );
    } catch (error) {
      console.error("Error loading wishes:", error);
      hasMoreWishes = false; // エラー時も追加読み込みを停止
    } finally {
      isLoading = false;
      loadingIndicator.classList.add("hidden");
      console.log("loadWishes: Finished. isLoading is now false.");
    }
  }

  // --- 無限スクロールのハンドラ ---
  function handleScroll() {
    // 閲覧画面でない場合は何もしない
    if (formContainer.classList.contains("hidden") === false) return;

    const scrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollPosition = window.scrollY;

    // デバッグ用ログ（必要に応じてコメントを外してください）
    // console.log(`Scroll: ${scrollPosition.toFixed(0)} / ${scrollableHeight.toFixed(0)}`);

    // ドキュメントの底から200px以内にスクロールしたら次のデータを読み込む
    if (scrollableHeight > 0 && scrollableHeight - scrollPosition < 200) {
      if (!isLoading && hasMoreWishes) {
        console.log(
          "handleScroll: Reached bottom of page, attempting to load more wishes."
        );
        loadWishes(currentOffset, true);
      }
    }
  }

  // --- その他のヘルパー関数 ---
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "status-message";
    }, 3000);
  }

  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- イベントリスナーの設定 ---

  // 「願い事を投稿する」ボタン
  newWishButton.addEventListener("click", async () => {
    console.log("New Wish Button clicked.");
    wishForm.reset();
    isEditMode = false;
    formTitle.textContent = "願い事を投稿";
    submitButton.textContent = "投稿する";

    try {
      const response = await fetch("/api/wishes/current");
      const data = await response.json();
      if (data.wish) {
        console.log("Existing wish found. Entering edit mode.");
        isEditMode = true;
        formTitle.textContent = "願い事を編集";
        submitButton.textContent = "更新する";
        nameInput.value = data.wish.name || "";
        wishInput.value = data.wish.wish;
      }
    } catch (error) {
      console.error("Error checking for current user wish:", error);
    }

    showFormScreen();
  });

  // 「閲覧画面に戻る」ボタン
  backButton.addEventListener("click", () => {
    console.log("Back Button clicked.");
    showViewerScreen();
  });

  // 投稿フォームの送信
  wishForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Wish form submitted.");

    const name = nameInput.value.trim();
    const wish = wishInput.value.trim();

    if (name.length > 64) {
      showStatus("名前は64文字以内で入力してください。", "error");
      return;
    }

    if (wish.length === 0) {
      showStatus("願い事は必須です。", "error");
      return;
    }

    if (wish.length > 240) {
      showStatus("願い事は240文字以内で入力してください。", "error");
      return;
    }

    const url = "/api/wishes";
    const method = isEditMode ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, wish }),
      });

      const data = await response.json();

      if (response.ok) {
        showStatus(
          isEditMode ? "願い事を更新しました" : "願い事を投稿しました",
          "success"
        );

        setTimeout(() => {
          // 状態をリセットして、閲覧画面を再読み込み
          currentOffset = 0;
          hasMoreWishes = true;
          showViewerScreen();
          loadWishes(0, false);
        }, 1000);
      } else {
        showStatus(data.error || "エラーが発生しました", "error");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showStatus("通信エラーが発生しました", "error");
    }
  });

  // 無限スクロール
  window.addEventListener("scroll", handleScroll);

  // --- アプリケーションの初期化 ---
  loadWishes(0, false);
});
