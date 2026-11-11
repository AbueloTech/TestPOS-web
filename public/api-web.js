// Reemplazo de preload.js (Electron): expone window.electronAPI usando fetch hacia server.js
// Así renderer.js funciona igual en el navegador sin cambios.
;(function () {
  async function invoke(channel, ...args) {
    const res = await fetch(`/api/invoke/${channel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args }),
    })
    let data = null
    try {
      data = await res.json()
    } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || `Error ${res.status} en ${channel}`)
    return data.result
  }

  // Descarga un archivo generado por el servidor
  async function download(url, fallbackName) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`No se pudo exportar (${res.status})`)
    const blob = await res.blob()
    const match = /filename="?([^"]+)"?/.exec(res.headers.get("Content-Disposition") || "")
    const name = match ? match[1] : fallbackName
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    return { path: `Descargas/${name}` }
  }

  // Selector de imagen: el navegador no expone rutas, así que se guarda el File
  // y se devuelve una "ruta" blob que termina en el nombre real del archivo.
  const pickedFiles = new Map()

  function openFileDialog() {
    return new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/jpeg,image/png,image/gif,image/webp"
      input.onchange = () => {
        const file = input.files && input.files[0]
        if (!file) return resolve({ canceled: true, filePaths: [] })
        const fakePath = `${URL.createObjectURL(file)}#/${encodeURIComponent(file.name)}`
        pickedFiles.set(fakePath, file)
        resolve({ canceled: false, filePaths: [fakePath] })
      }
      input.addEventListener("cancel", () => resolve({ canceled: true, filePaths: [] }))
      input.click()
    })
  }

  async function copyImageToApp(sourcePath, fileName) {
    const file = pickedFiles.get(sourcePath)
    if (!file) throw new Error("Selecciona la imagen de nuevo")
    const res = await fetch(`/api/upload-image?name=${encodeURIComponent(fileName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "No se pudo subir la imagen")
    return { success: true, path: `img/${data.fileName}` }
  }

  window.electronAPI = {
    // Productos
    getProducts: () => invoke("get-products"),
    getPlato: (id) => invoke("get-plato", id),
    createPlato: (plato) => invoke("create-plato", plato),
    updatePlato: (plato) => invoke("update-plato", plato),
    deletePlato: (id) => invoke("delete-plato", id),

    // Ventas
    saveSale: (sale) => invoke("save-sale", sale),
    saveVenta: (venta) => invoke("save-venta", venta),
    saveVentas: (ventas) => invoke("save-ventas", ventas),
    getSalesHistory: () => invoke("get-sales-history"),
    getSalesByPaymentMethod: () => invoke("get-sales-by-payment-method"),
    getDailySales: () => invoke("get-daily-sales"),
    getTopSellingProducts: () => invoke("get-top-selling-products"),
    getLastTicketNumber: () => invoke("getLastTicketNumber"),

    // Reportes
    getGeneralSalesReport: (s, e) => invoke("get-general-sales-report", s, e),
    getTicketsReport: (s, e) => invoke("get-tickets-report", s, e),
    getTicketDetails: (nticket) => invoke("get-ticket-details", nticket),
    getProductSalesReport: (s, e, plato) => invoke("get-product-sales-report", s, e, plato),
    getPaymentMethodsReport: (s, e, forma) => invoke("get-payment-methods-report", s, e, forma),

    // Dashboard
    getDailyAmount: (date) => invoke("getDailyAmount", date),
    getMonthlyAmount: (date) => invoke("getMonthlyAmount", date),
    getMostSoldDish: (s, e) => invoke("getMostSoldDish", s, e),
    getPaymentMethodAmount: (s, e, method) => invoke("getPaymentMethodAmount", s, e, method),
    getDailySalesData: (s, e) => invoke("getDailySalesData", s, e),
    getPaymentMethodsData: (s, e) => invoke("getPaymentMethodsData", s, e),
    getTopProductsData: (s, e) => invoke("getTopProductsData", s, e),

    // Exportación (descarga desde el navegador)
    exportToCSV: () => download("/api/export/csv", "ventas_terreno_broaster.csv"),
    exportToExcel: () => download("/api/export/excel", "ventas_terreno_broaster.xls"),

    // Selector de archivos
    openFileDialog,
    copyImageToApp,

    // Utilidades
    getAppPath: () => invoke("get-app-path"),
    ensureImgFolder: () => invoke("ensure-img-folder"),
    checkImageExists: (p) => invoke("check-image-exists", p),
  }
})()
