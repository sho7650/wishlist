document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");

  // DOM要素
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

  // DOM要素の存在確認
  console.log("DOM Elements Check:");
  console.log("viewerContainer:", viewerContainer);
  console.log("formContainer:", formContainer);
  console.log("newWishButton:", newWishButton);
  console.log("backButton:", backButton);

  // 状態管理
  let isEditMode = false;
  let currentOffset = 0;
  let isLoading = false;
  let hasMoreWishes = true;

  // 画面切り替え
  function showViewerScreen() {
    console.log("Showing Viewer Screen");
    formContainer.classList.add("hidden");
    viewerContainer.classList.remove("hidden");
  }

  function showFormScreen() {
    console.log("Showing Form Screen");
    viewerContainer.classList.add("hidden");
    formContainer.classList.remove("hidden");
  }

  // ボタンのイベントリスナー
  if (newWishButton) {
    console.log("Adding click event listener to newWishButton");
    newWishButton.addEventListener("click", async () => {
      console.log("New Wish Button Clicked");
      // フォームをリセット
      wishForm.reset();
      isEditMode = false;
      formTitle.textContent = "願い事を投稿";
      submitButton.textContent = "投稿する";

      // 現在のユーザーの投稿を確認して、存在すれば編集モードに
      try {
        console.log("Checking current user wish");
        const response = await fetch("/api/wishes/current");
        const data = await response.json();

        if (data.wish) {
          // 編集モードに設定
          console.log("User has existing wish, entering edit mode");
          isEditMode = true;
          formTitle.textContent = "願い事を編集";
          submitButton.textContent = "更新する";

          // フォームに値を設定
          nameInput.value = data.wish.name || "";
          wishInput.value = data.wish.wish;
        } else {
          console.log("No existing wish found, staying in create mode");
        }
      } catch (error) {
        console.error("Error checking current user wish:", error);
      }

      showFormScreen();
    });
  } else {
    console.error("New Wish Button not found in DOM");
  }

  if (backButton) {
    console.log("Adding click event listener to backButton");
    backButton.addEventListener("click", () => {
      console.log("Back Button Clicked");
      showViewerScreen();
    });
  } else {
    console.error("Back Button not found in DOM");
  }

  // 願い事の読み込み
  async function loadWishes(offset = 0, append = false) {
    console.log(`Loading wishes: offset=${offset}, append=${append}`);
    if (isLoading || (!append && !hasMoreWishes)) {
      console.log("Skipping load: already loading or no more wishes");
      return;
    }

    isLoading = true;
    loadingIndicator.classList.remove("hidden");

    try {
      console.log(
        `Fetching wishes from API: /api/wishes?limit=20&offset=${offset}`
      );
      const response = await fetch(`/api/wishes?limit=20&offset=${offset}`);
      const data = await response.json();
      console.log(`Received ${data.wishes.length} wishes from API`);

      if (!append) {
        wishesList.innerHTML = "";
      }

      if (data.wishes.length === 0) {
        console.log("No more wishes to load");
        hasMoreWishes = false;
        loadingIndicator.classList.add("hidden");
        return;
      }

      data.wishes.forEach((wish) => {
        const card = document.createElement("div");
        card.className = "wish-card";

        // ランダムな色を生成
        const hue = Math.floor(Math.random() * 360);
        card.style.backgroundColor = `hsl(${hue}, 70%, 90%)`;

        card.innerHTML = `
          <div class="wish-content">${escapeHTML(wish.wish)}</div>
          <div class="wish-author">- ${escapeHTML(wish.name || "匿名")}</div>
        `;

        wishesList.appendChild(card);
      });

      currentOffset += data.wishes.length;
      console.log(`New offset: ${currentOffset}`);
    } catch (error) {
      console.error("Error loading wishes:", error);
    } finally {
      isLoading = false;
      loadingIndicator.classList.add("hidden");
    }
  }

  // 無限スクロール
  function handleScroll() {
    if (viewerContainer.classList.contains("hidden")) {
      return;
    }

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // 下端に近づいたら追加読み込み
    if (
      scrollY + windowHeight > documentHeight - 200 &&
      !isLoading &&
      hasMoreWishes
    ) {
      console.log("Near bottom of page, loading more wishes");
      loadWishes(currentOffset, true);
    }
  }

  // フォーム送信処理
  if (wishForm) {
    console.log("Adding submit event listener to wishForm");
    wishForm.addEventListener("submit", async (e) => {
      console.log("Form submitted");
      e.preventDefault();

      const name = nameInput.value.trim();
      const wish = wishInput.value.trim();

      if (!wish) {
        showStatus("願い事は必須です", "error");
        return;
      }

      try {
        let response;

        if (isEditMode) {
          console.log("Sending PUT request to update wish");
          // 更新リクエスト
          response = await fetch("/api/wishes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, wish }),
          });
        } else {
          console.log("Sending POST request to create new wish");
          // 新規投稿リクエスト
          response = await fetch("/api/wishes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, wish }),
          });
        }

        const data = await response.json();

        if (response.ok) {
          showStatus(
            isEditMode ? "願い事を更新しました" : "願い事を投稿しました",
            "success"
          );

          // 閲覧画面に戻り、最新データをリロード
          setTimeout(() => {
            currentOffset = 0;
            hasMoreWishes = true;
            loadWishes();
            showViewerScreen();
          }, 1000);
        } else {
          console.error("API returned error:", data.error);
          showStatus(data.error || "エラーが発生しました", "error");
        }
      } catch (error) {
        console.error("Error submitting form:", error);
        showStatus("通信エラーが発生しました", "error");
      }
    });
  } else {
    console.error("Wish Form not found in DOM");
  }

  // ステータスメッセージを表示
  function showStatus(message, type) {
    console.log(`Showing status: ${message} (${type})`);
    statusMessage.textContent = message;
    statusMessage.className = type;

    // 3秒後に消える
    setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "";
    }, 3000);
  }

  // HTMLエスケープ処理
  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // スクロールイベントのリスナー
  console.log("Adding scroll event listener to window");
  window.addEventListener("scroll", handleScroll);

  // 初期化
  console.log("Initializing app");
  showViewerScreen();
  loadWishes();
});
