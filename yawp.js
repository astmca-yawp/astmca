document.addEventListener("DOMContentLoaded", () => {
  const VERSION_KEY = "yawpVersion"; // "v1" | "v2"
  let current = localStorage.getItem(VERSION_KEY) || "";

  const overlay = document.getElementById("version-overlay");
  const chooseV1 = document.getElementById("choose-v1");
  const chooseV2 = document.getElementById("choose-v2");
  const switchBtn = document.getElementById("switch-version-btn");

  function hasEngine(version){
    return (version === "v1" && typeof window.YAWP_V1_init === "function") ||
           (version === "v2" && typeof window.YAWP_V2_init === "function");
  }

  function start(version) {
    if (!hasEngine(version)) {
      console.error("Engine non disponibile:", version);
      return;
    }

    // Hide chooser
    if (overlay) overlay.hidden = true;

    // Start selected engine
    if (version === "v1") window.YAWP_V1_init();
    if (version === "v2") window.YAWP_V2_init();
  }

  function choose(version){
    // If already running a different version, reload to guarantee clean state.
    if (current && current !== version) {
      localStorage.setItem(VERSION_KEY, version);
      location.reload();
      return;
    }
    current = version;
    localStorage.setItem(VERSION_KEY, version);
    start(version);
  }

  if (chooseV1) chooseV1.addEventListener("click", () => choose("v1"));
  if (chooseV2) chooseV2.addEventListener("click", () => choose("v2"));

  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      if (overlay) overlay.hidden = false;
    });
  }

  if (!current) {
    if (overlay) overlay.hidden = false;
    return;
  }

  start(current);
});
