/**
 * Sito Ripassa — comportamento condiviso da tutte le pagine.
 * Niente framework: il sito è statico, questo file resta piccolo apposta.
 */
(function () {
  "use strict";

  // Menu mobile: toggle + chiusura al click su un link o fuori dal menu.
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var aperto = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(aperto));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Evidenzia nel menu la pagina corrente (in alternativa ad aria-current
  // scritto a mano in ogni file, così i quattro file restano identici).
  var qui = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a, .footer-nav a").forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === qui) {
      link.setAttribute("aria-current", "page");
    }
  });

  // Anno corrente nel footer.
  var anno = document.getElementById("anno-corrente");
  if (anno) {
    anno.textContent = String(new Date().getFullYear());
  }
})();
