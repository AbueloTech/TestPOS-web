// Menú lateral retráctil: abre/cierra con el botón ☰, recuerda la preferencia en escritorio
// y se comporta como panel superpuesto en pantallas pequeñas.
;(function () {
  const KEY = "pos.sidebarOpen"
  const mq = window.matchMedia("(min-width: 992px)")
  const body = document.body
  const toggle = document.getElementById("sidebarToggle")
  const backdrop = document.getElementById("sidebarBackdrop")
  const sidebar = document.getElementById("sidebar")

  const store = {
    get() { try { return localStorage.getItem(KEY) } catch (_) { return null } },
    set(v) { try { localStorage.setItem(KEY, v) } catch (_) {} },
  }

  function setOpen(open, remember) {
    body.classList.toggle("sidebar-open", open)
    toggle.setAttribute("aria-expanded", String(open))
    if (remember && mq.matches) store.set(open ? "1" : "0")
  }

  // Estado inicial: en escritorio abierto (o lo que el usuario dejó), en móvil cerrado
  const saved = store.get()
  setOpen(mq.matches ? saved !== "0" : false, false)

  toggle.addEventListener("click", () => setOpen(!body.classList.contains("sidebar-open"), true))
  backdrop.addEventListener("click", () => setOpen(false, false))
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !mq.matches && body.classList.contains("sidebar-open") && !document.querySelector(".modal.show")) setOpen(false, false)
  })
  mq.addEventListener("change", () => {
    const s = store.get()
    setOpen(mq.matches ? s !== "0" : false, false)
  })

  // Resalta la vista activa (Inicio, Dashboard, Exportar) y cierra el panel en móvil
  sidebar.addEventListener("click", (e) => {
    const link = e.target.closest(".sidebar-link")
    if (!link) return
    if (link.hasAttribute("data-view")) {
      sidebar.querySelectorAll(".sidebar-link.active").forEach((l) => l.classList.remove("active"))
      link.classList.add("active")
    }
    const isSubmenuToggle = link.getAttribute("data-bs-toggle") === "collapse"
    if (!isSubmenuToggle && !mq.matches) setOpen(false, false)
  })
  // El logo de la barra superior también lleva a Inicio
  document.querySelector(".topbar-brand").addEventListener("click", () => {
    sidebar.querySelectorAll(".sidebar-link.active").forEach((l) => l.classList.remove("active"))
    const home = sidebar.querySelector(".sidebar-link[data-view]")
    if (home) home.classList.add("active")
  })
})()
