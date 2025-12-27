document.addEventListener("DOMContentLoaded", () => {
  const VERSION_KEY = "yawpVersion"; // "v1" | "v2"
  const chosen = localStorage.getItem(VERSION_KEY) || "";

  const overlay = document.getElementById("version-overlay");
  const chooseV1 = document.getElementById("choose-v1");
  const chooseV2 = document.getElementById("choose-v2");
  const changeBtn = document.getElementById("change-version-btn");

  function start(version) {
    // Safety: hide overlay, show app controls
    if (overlay) overlay.classList.add("hidden");

    // Initialize correct engine
    if (version === "v1") {
      if (typeof window.YAWP_V1_init !== "function") {
        console.error("YAWP_V1_init not found");
        return;
      }
      window.YAWP_V1_init();
      return;
    }
    // default v2
    if (typeof window.YAWP_V2_init !== "function") {
      console.error("YAWP_V2_init not found");
      return;
    }
    window.YAWP_V2_init();
  }

  function pick(version) {
    localStorage.setItem(VERSION_KEY, version);
    // reload to guarantee clean listeners/state
    location.reload();
  }

  if (chooseV1) chooseV1.addEventListener("click", () => pick("v1"));
  if (chooseV2) chooseV2.addEventListener("click", () => pick("v2"));

  if (changeBtn) {
    changeBtn.addEventListener("click", () => {
      // show overlay and allow switching; switching triggers reload
      if (overlay) overlay.classList.remove("hidden");
    });
  }

  if (!chosen) {
    // No choice yet: show overlay and wait
    if (overlay) overlay.classList.remove("hidden");
    return;
  }

  start(chosen);
});
