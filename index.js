(function () {
  const pluginId = "portal-scroll-mode-plugin";
  const plugin = BF2042Portal.Plugins.getPlugin(pluginId);

  const STORAGE_KEY = "portal-scroll-mode-plugin:enabled";
  const MENU_ITEM_ID = "scrollModeToggleMenuItem";

  /* ---------------------------
     State (persisted per browser)
     Default: OFF (standard behavior) until the user turns it on from the menu.
  ---------------------------- */
  let enabled = false;
  try {
    enabled = localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {
    enabled = false;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch (e) {
      /* storage unavailable: keep in-memory state only */
    }
  }

  /* ---------------------------
     Normalize wheel deltas to pixels
  ---------------------------- */
  function toPixels(value, deltaMode) {
    if (deltaMode === 1) return value * 40; // lines
    if (deltaMode === 2) return value * 800; // pages
    return value; // pixels
  }

  /* ---------------------------
     Wheel handler
       Wheel        -> vertical scroll
       Shift+Wheel  -> horizontal scroll
       Ctrl+Wheel   -> zoom (around the mouse pointer)
  ---------------------------- */
  function onWheel(e) {
    if (!enabled) return; // let the editor's standard behavior run

    // Leave the toolbox / flyout (block palette) alone
    if (e.target && e.target.closest && e.target.closest(".blocklyFlyout, .blocklyToolboxDiv, .blocklyWidgetDiv, .blocklyDropDownDiv")) {
      return;
    }

    const ws = _Blockly.getMainWorkspace();
    if (!ws) return;

    // Take over the event from the editor's own handler
    e.preventDefault();
    e.stopImmediatePropagation();

    const dx = toPixels(e.deltaX, e.deltaMode);
    const dy = toPixels(e.deltaY, e.deltaMode);

    try {
      if (e.ctrlKey || e.metaKey) {
        // ---- Zoom ----
        const amount = Math.max(-3, Math.min(3, -dy / 100));
        if (amount === 0) return;
        const svg = ws.getParentSvg();
        const rect = svg.getBoundingClientRect();
        ws.zoom(e.clientX - rect.left, e.clientY - rect.top, amount);
      } else if (e.shiftKey) {
        // ---- Horizontal scroll ----
        // Browsers often move the value to deltaX when Shift is held.
        const h = dx !== 0 ? dx : dy;
        ws.scroll(ws.scrollX - h, ws.scrollY);
      } else {
        // ---- Vertical scroll ----
        ws.scroll(ws.scrollX, ws.scrollY - dy);
      }
    } catch (err) {
      console.error("[ScrollModePlugin] wheel handling failed:", err);
    }
  }

  function attachWheelHandler(ws) {
    try {
      const svg = ws.getParentSvg();
      if (!svg || svg._scrollModeAttached) return;
      svg._scrollModeAttached = true;
      // capture:true so we run before the editor's own wheel listener
      svg.addEventListener("wheel", onWheel, { capture: true, passive: false });
    } catch (e) {
      console.warn("[ScrollModePlugin] attachWheelHandler failed:", e);
    }
  }

  /* ---------------------------
     Right-click (workspace) menu item
  ---------------------------- */
  const toggleItem = {
    id: MENU_ITEM_ID,
    displayText: () =>
      enabled
        ? "スクロール操作: 変更ON → 標準に戻す"
        : "スクロール操作を変更 (ホイール=上下 / Shift=左右 / Ctrl=拡大縮小)",
    preconditionFn: () => "enabled",
    callback: () => {
      enabled = !enabled;
      saveState();
      console.log("[ScrollModePlugin] scroll mode:", enabled ? "ON" : "OFF");
    },
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    weight: 91,
  };

  plugin.initializeWorkspace = function () {
    try {
      const ws = _Blockly.getMainWorkspace();

      const reg = _Blockly.ContextMenuRegistry.registry;
      if (reg.getItem(toggleItem.id)) reg.unregister(toggleItem.id);
      reg.register(toggleItem);

      attachWheelHandler(ws);
    } catch (err) {
      console.error("[ScrollModePlugin] Initialization failed:", err);
    }
  };
})();
