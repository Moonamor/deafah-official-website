/* Native <dialog> controller (replaces the framework modal plugin). Keeps id="contactModal" and every selector in config.json.
   Open:  any [data-modal-open="contactModal"]; optional [data-subject] is copied into the hidden #contactSubject input.
   Close: [data-modal-close], Esc, backdrop click. Focus returns to the opener. */
(function () {
  "use strict";
  var opener = null;

  function dialogFor(id) { var d = document.getElementById(id); return d && d.tagName === "DIALOG" ? d : null; }

  function open(id, subject, trigger) {
    var dlg = dialogFor(id); if (!dlg) return;
    opener = trigger || document.activeElement;
    var subj = dlg.querySelector("#contactSubject");
    if (subj) subj.value = subject || "";
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    document.dispatchEvent(new CustomEvent("deafah:dialogopen", { detail: { id: id, dialog: dlg, subject: subject || "" } }));
    var first = dlg.querySelector("input:not([type=hidden]), textarea, select, button");
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function close(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === "function" && dlg.open) dlg.close(); else dlg.removeAttribute("open");
  }

  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-modal-open]");
    if (o) { e.preventDefault(); open(o.getAttribute("data-modal-open"), o.getAttribute("data-subject"), o); return; }
    var c = e.target.closest("[data-modal-close]");
    if (c) { e.preventDefault(); close(c.closest("dialog")); return; }
    var d = e.target;
    if (d && d.tagName === "DIALOG" && d.open) {
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(d);
    }
  });

  /* keep Tab inside the open dialog (native modal dialogs let focus leave to the browser UI) */
  function focusables(dlg) {
    return Array.prototype.slice.call(dlg.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  document.querySelectorAll("dialog").forEach(function (dlg) {
    dlg.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !dlg.open) return;
      var list = focusables(dlg); if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dlg.addEventListener("close", function () {
      document.body.style.overflow = "";
      if (opener && typeof opener.focus === "function") opener.focus();
      opener = null;
    });
    dlg.addEventListener("cancel", function () { document.body.style.overflow = ""; });
  });

  window.DeafahModal = { open: open, close: function (id) { close(dialogFor(id)); } };
})();
