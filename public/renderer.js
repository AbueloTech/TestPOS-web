// Variables globales
let products = []
const cart = {}
let total = 0
let ticketNumber = 1000
let selectedPaymentMethod = null
const itemsPerPage = 8
let currentPage = 1

// Fecha local YYYY-MM-DD (toISOString usa UTC y adelanta el día después de las 7pm en Colombia)
function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function localDateTimeStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0")
  return `${localDateStr(d)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
// "YYYY-MM-DD" -> Date a medianoche LOCAL (new Date("YYYY-MM-DD") es UTC y muestra el día anterior)
function parseLocalDate(str) {
  return new Date(String(str).slice(0, 10) + "T00:00:00")
}

// Función para registrar mensajes en la consola
function log(message, data = null) {
  const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message
  console.log(logMessage)

  // También mostrar en un elemento de la página para depuración
  const debugElement = document.getElementById("debug-output")
  if (debugElement) {
    const logItem = document.createElement("div")
    logItem.textContent = logMessage
    debugElement.appendChild(logItem)
  }
}

// Inicialización
document.addEventListener("DOMContentLoaded", async () => {
  log("DOM cargado, iniciando aplicación...")

  try {
    // Asegurarse de que la carpeta de imágenes exista
    await window.electronAPI.ensureImgFolder()

    // Verificar que electronAPI esté disponible
    if (!window.electronAPI) {
      throw new Error("electronAPI no está disponible")
    }

    log("electronAPI está disponible")

    // Obtener el último número de ticket
    await updateTicketNumber()

    // Cargar productos desde la base de datos
    await loadProducts()

    // Mostrar la página de inicio
    showHome()

    // Inicializar botones de método de pago
    initializePaymentMethodButtons()

    log("Aplicación inicializada correctamente")
  } catch (error) {
    log("Error al inicializar la aplicación:", error)
    showError("Error al inicializar la aplicación", error)
  }
})


function formatDateForSQL(dateStr, isEndDate = false) {
  if (!dateStr) return ""

  // Para la fecha de inicio, mantenemos el formato YYYY-MM-DD 00:00:00
  if (!isEndDate) {
    return `${dateStr} 00:00:00`
  }

  // Para la fecha final, usamos YYYY-MM-DD 23:59:59 para incluir todo el día
  return `${dateStr} 23:59:59`
}

// Función para actualizar el número de ticket
async function updateTicketNumber() {
  try {
    ticketNumber = await window.electronAPI.getLastTicketNumber()
    log(`Número de ticket actualizado: ${ticketNumber}`)

    // Actualizar el número de ticket en todos los lugares relevantes de la interfaz
    const ticketNumberElements = document.querySelectorAll(
      ".ticket-number, #current-ticket-number, #cart-ticket-number, #payment-ticket-number",
    )
    ticketNumberElements.forEach((element) => {
      if (element) {
        element.textContent = ticketNumber
      }
    })

    return ticketNumber
  } catch (error) {
    log("Error al obtener el número de ticket:", error)
    return 1000 // Valor por defecto en caso de error
  }
}

// Función para mostrar errores
function showError(title, error) {
  const errorMessage = error instanceof Error ? error.message : String(error)

  // Mostrar alerta
  alert(`${title}: ${errorMessage}`)

  // También mostrar en la consola
  console.error(title, error)

  // Y en un elemento de la página para depuración
  const mainContent = document.getElementById("mainContent")
  if (mainContent) {
    mainContent.innerHTML = `
      <div class="alert alert-danger">
        <h4>${title}</h4>
        <p>${errorMessage}</p>
        <pre>${error.stack || ""}</pre>
      </div>
      <div id="debug-output" class="mt-4 p-3 bg-light">
        <h5>Registro de depuración:</h5>
      </div>
    `
  }
}

// Modificar la función loadProducts para incluir mejor manejo de errores
async function loadProducts() {
  log("Intentando cargar productos...")

  try {
    products = await window.electronAPI.getProducts()
    log(`Productos cargados: ${products.length}`)

    if (products.length === 0) {
      log("No se encontraron productos en la base de datos")
      showError("No hay productos", "No se encontraron productos en la base de datos")
      return
    }

    // Mostrar el primer producto para depuración
    log("Primer producto:", products[0])

    return products
  } catch (error) {
    log("Error al cargar productos:", error)
    showError("Error al cargar productos", error)
    throw error
  }
}

// Modificar la función displayProducts para manejar rutas de imágenes locales
function displayProducts(productsToShow = products, page = 1) {
  log(`Mostrando productos (página ${page}), total: ${productsToShow.length}`)

  const productList = document.getElementById("product-list")
  if (!productList) {
    log("Error: No se encontró el elemento product-list")
    return
  }

  productList.innerHTML = ""

  if (productsToShow.length === 0) {
    productList.innerHTML = `
      <div class="col-12 text-center">
        <div class="alert alert-warning">
          No se encontraron productos para mostrar.
        </div>
      </div>
    `
    return
  }

  const startIndex = (page - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, productsToShow.length)
  const paginatedProducts = productsToShow.slice(startIndex, endIndex)

  log(`Mostrando productos del ${startIndex + 1} al ${endIndex} de ${productsToShow.length}`)

  paginatedProducts.forEach((product, index) => {
    const productCard = document.createElement("div")
    productCard.className = "col"

    // Construir la ruta de la imagen correctamente
    const imagePath = product.Imagen.startsWith("http") ? product.Imagen : `img/${product.Imagen}`

    log(`Producto ${index + 1}: ${product.Plato}, Imagen: ${imagePath}`)

    productCard.innerHTML = `
      <div class="card product-card" onclick="addToCart(${product.ID})">
        <img src="${imagePath}" class="card-img-top product-image" alt="${product.Plato}" onerror="this.src='img/placeholder.jpg'">
        <div class="card-body">
          <h5 class="card-title">${product.Plato}</h5>
          <p class="card-text">$${product.Precio.toFixed(2)}</p>
        </div>
      </div>
    `
    productList.appendChild(productCard)
  })

  updatePagination(productsToShow.length, page)
}

// Actualizar paginación
function updatePagination(totalItems, currentPage) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const paginationElement = document.getElementById("pagination")
  if (!paginationElement) {
    log("Error: No se encontró el elemento pagination")
    return
  }

  paginationElement.innerHTML = ""

  if (totalPages <= 1) {
    return
  }

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li")
    li.className = `page-item ${i === currentPage ? "active" : ""}`
    li.innerHTML = `<a class="page-link" href="#" onclick="changePage(${i})">${i}</a>`
    paginationElement.appendChild(li)
  }

  log(`Paginación actualizada: ${totalPages} páginas, página actual: ${currentPage}`)
}

// Cambiar página
function changePage(page) {
  log(`Cambiando a la página ${page}`)
  currentPage = page
  const activeCategory = document.querySelector(".category-button.active")
  const category = activeCategory ? activeCategory.dataset.category : ""
  const filteredProducts = category ? products.filter((p) => p.Categoria === category) : products
  displayProducts(filteredProducts, page)
}

// Filtrar productos por categoría
function filterProducts(category = "") {
  log(`Filtrando por categoría: "${category}"`)

  const filteredProducts = category ? products.filter((p) => p.Categoria === category) : products

  log(`Productos filtrados: ${filteredProducts.length} de ${products.length} totales`)

  currentPage = 1
  displayProducts(filteredProducts, currentPage)
  updateCategoryButtons(category)
}

// Actualizar botones de categoría
function updateCategoryButtons(activeCategory) {
  log(`Actualizando botones de categoría, categoría activa: "${activeCategory}"`)

  const buttons = document.querySelectorAll(".category-button")
  if (buttons.length === 0) {
    log("Error: No se encontraron botones de categoría")
    return
  }

  buttons.forEach((button) => {
    const buttonCategory = button.dataset.category
    if (buttonCategory === activeCategory) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })
}

// Agregar producto al carrito
function addToCart(productId) {
  log(`Agregando producto al carrito, ID: ${productId}`)

  const product = products.find((p) => p.ID === productId)
  if (!product) {
    log(`Error: Producto no encontrado con ID ${productId}`)
    return
  }

  log(`Producto encontrado: ${product.Plato}`)

  if (cart[productId]) {
    cart[productId].quantity++
    log(`Incrementada cantidad del producto ${product.Plato} a ${cart[productId].quantity}`)
  } else {
    cart[productId] = {
      ...product,
      quantity: 1,
      name: product.Plato,
      price: product.Precio,
      id: product.ID,
    }
    log(`Añadido nuevo producto al carrito: ${product.Plato}`)
  }

  updateCart()
  showConfirmation()
}

// Mostrar confirmación de producto agregado
function showConfirmation() {
  const confirmationModal = document.getElementById("confirmationModal")
  if (!confirmationModal) {
    log("Error: No se encontró el elemento confirmationModal")
    return
  }

  confirmationModal.style.display = "block"
  setTimeout(() => {
    confirmationModal.style.display = "none"
  }, 2000)

  log("Mostrada confirmación de producto agregado")
}

// Eliminar producto del carrito
function removeFromCart(productId) {
  log(`Eliminando producto del carrito, ID: ${productId}`)

  if (cart[productId]) {
    if (cart[productId].quantity > 1) {
      cart[productId].quantity--
      log(`Decrementada cantidad del producto a ${cart[productId].quantity}`)
    } else {
      delete cart[productId]
      log("Producto eliminado del carrito")
    }
    updateCart()
  }
}

// Actualizar carrito
function updateCart() {
  log("Actualizando carrito")

  const cartItems = document.getElementById("cart-items")
  const cartTotal = document.getElementById("cart-total")
  const cartItemCount = document.getElementById("cartItemCount")
  const cartTicketNumber = document.getElementById("cart-ticket-number")

  if (!cartItems || !cartTotal || !cartItemCount) {
    log("Error: No se encontraron elementos del carrito")
    return
  }

  // Actualizar el número de ticket en el carrito
  if (cartTicketNumber) {
    cartTicketNumber.textContent = ticketNumber
  }

  cartItems.innerHTML = ""
  total = 0
  let itemCount = 0

  for (const productId in cart) {
    const item = cart[productId]
    const subtotal = item.price * item.quantity
    total += subtotal
    itemCount += item.quantity

    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>$${subtotal.toFixed(2)}</td>
      <td><span class="remove-item" onclick="removeFromCart(${productId})">❌</span></td>
    `
    cartItems.appendChild(row)
  }

  cartTotal.textContent = total.toFixed(2)
  cartItemCount.textContent = itemCount
  updateCartDate()

  log(`Carrito actualizado: ${itemCount} items, total: $${total.toFixed(2)}`)
}

// Actualizar fecha del carrito
function updateCartDate() {
  const cartDate = document.getElementById("cart-date")
  if (!cartDate) {
    log("Error: No se encontró el elemento cart-date")
    return
  }

  const now = new Date()
  cartDate.textContent = now.toLocaleString()

  log(`Fecha del carrito actualizada: ${now.toLocaleString()}`)
}

// Mostrar carrito
function displayCart() {
  log("Mostrando carrito")
  updateCart()

  try {
    // Intentar usar Bootstrap directly
    const cartModalElement = document.getElementById("cartModal")
    if (!cartModalElement) {
      log("Error: No se encontró el elemento cartModal")
      return
    }

    // Configurar los botones de forma de pago antes de mostrar el modal
    setupPaymentMethodButtons()

    const bootstrapModal = new bootstrap.Modal(cartModalElement)
    bootstrapModal.show()
    log("Modal del carrito mostrado correctamente")
  } catch (error) {
    log("Error al mostrar el modal del carrito:", error)

    // Intentar usar jQuery como alternativa
    try {
      // Configurar los botones de forma de pago antes de mostrar el modal
      setupPaymentMethodButtons()

      if (window.jQuery) {
        jQuery("#cartModal").modal("show")
        log("Modal del carrito mostrado usando jQuery")
      } else {
        throw new Error("jQuery no está disponible")
      }
    } catch (jqError) {
      log("Error al mostrar el modal con jQuery:", jqError)
      showError("Error al mostrar el carrito", error)
    }
  }
}

// Función para aceptar la compra
async function acceptPurchase() {
  console.log("Iniciando acceptPurchase")

  // Obtener los elementos del carrito
  const cartItems = document.getElementById("cart-items").getElementsByTagName("tr")
  if (cartItems.length === 0) {
    alert("El carrito está vacío")
    console.log("Carrito vacío, no se puede procesar la compra")
    return
  }

  // Verificar si hay un método de pago seleccionado
  // Primero intentamos con el botón que tiene la clase 'selected'
  let selectedPaymentMethodButton = document.querySelector(".payment-method-button.selected")

  // Si no encontramos uno con 'selected', intentamos con la clase 'active'
  if (!selectedPaymentMethodButton) {
    selectedPaymentMethodButton = document.querySelector(".payment-method-button.active")
  }

  console.log("Elemento de forma de pago seleccionado:", selectedPaymentMethodButton)

  if (!selectedPaymentMethodButton) {
    alert("Por favor seleccione una forma de pago")
    console.log("Forma de pago no seleccionada, no se puede procesar la compra")
    return
  }

  const paymentMethod = selectedPaymentMethodButton.getAttribute("data-payment-method")
  console.log("Método de pago seleccionado:", paymentMethod)

  // Obtener el nombre del cliente
  const clientName = document.getElementById("clientName").value.trim() || "Cliente General"
  console.log("Nombre del cliente:", clientName)

  // Obtener la fecha actual en formato adecuado para la base de datos
  const now = new Date()
  const formattedDate = localDateTimeStr(now) // formato YYYY-MM-DD HH:MM:SS (hora local)
  const displayDate = now.toLocaleString() // formato legible para mostrar

  // Obtener el número de ticket
  const ticketNumber = Number.parseInt(document.getElementById("cart-ticket-number").textContent)
  console.log("Fecha:", formattedDate, "Número de ticket:", ticketNumber)

  // Crear un array para almacenar todas las ventas
  const ventas = []

  // Recorrer los elementos del carrito
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i]
    const cells = item.getElementsByTagName("td")

    // Extraer los datos del item
    const plato = cells[0].textContent
    const cantidad = Number.parseInt(cells[1].textContent)
    const precio = Number.parseFloat(cells[2].textContent.replace("$", ""))
    const importe = Number.parseFloat(cells[3].textContent.replace("$", ""))

    console.log(`Item ${i + 1}:`, plato, cantidad, precio, importe)

    // Crear el objeto de venta con los nombres de campos correctos
    const venta = {
      Fecha: formattedDate,
      NTicket: ticketNumber,
      Cliente: clientName,
      Plato: plato,
      Cantidad: cantidad,
      Precio: precio,
      Importe: importe,
      FormaPago: paymentMethod,
    }

    ventas.push(venta)
  }

  console.log("Ventas a guardar:", ventas)

  try {
    // Guardar todas las ventas y el ticket
    const result = await window.electronAPI.saveVentas(ventas)

    if (result.success) {
      console.log("Ventas guardadas correctamente")

      // Generar el contenido del recibo
      generateReceiptContent(ventas, clientName, ticketNumber, displayDate, paymentMethod, total)

      // Mostrar el modal del recibo
      const receiptModal = new bootstrap.Modal(document.getElementById("receiptModal"))
      receiptModal.show()

      // Cerrar el modal del carrito
      const cartModalElement = document.getElementById("cartModal")
      const cartModal = bootstrap.Modal.getInstance(cartModalElement)
      if (cartModal) {
        cartModal.hide()
      } else {
        // Si no podemos obtener la instancia, intentamos cerrar manualmente
        jQuery(cartModalElement).modal("hide")
      }

      // Actualizar el número de ticket para la próxima venta
      await updateTicketNumberFromDB()

      // Limpiar el carrito
      clearCart()

      // Limpiar la variable global de método de pago seleccionado
      selectedPaymentMethod = null
    }
  } catch (error) {
    console.error("Error al guardar las ventas:", error)
    alert("Error al procesar la compra: " + error.message)
  }
}

// Función para generar el contenido del recibo con fuente más grande
function generateReceiptContent(ventas, clientName, ticketNumber, displayDate, paymentMethod, total) {
  console.log("Generando contenido del recibo")

  const receiptContent = document.getElementById("receipt-content")
  if (!receiptContent) {
    console.error("No se encontró el elemento receipt-content")
    return
  }

  // Calcular el total
  let totalAmount = 0
  ventas.forEach((venta) => {
    totalAmount += venta.Importe
  })

  // Ruta del logo
  const logoPath = "./img/logobroaster.png"

  // Generar el HTML del recibo con el logo y estilos mejorados
  let receiptHTML = `
    <div style="font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.3; width: 100%; max-width: 300px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="margin-bottom: 10px;">
          <img src="${logoPath}" alt="Logo Terreno Broaster" style="max-width: 150px; height: auto; margin: 0 auto; display: block;">
        </div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">TERRENO BROASTER</div>
        <div style="font-size: 14px; margin-bottom: 3px;">RIF: J-123456789</div>
        <div style="font-size: 14px; margin-bottom: 3px;">Dirección: Av. Principal</div>
        <div style="font-size: 14px; margin-bottom: 3px;">Teléfono: (0212) 123-4567</div>
        <div style="font-size: 14px; margin-bottom: 10px;">Fecha: ${displayDate}</div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">TICKET #${ticketNumber}</div>
        <div style="font-size: 14px; margin-bottom: 10px;">Cliente: ${clientName}</div>
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; margin-bottom: 10px;">
        <div style="display: flex; font-weight: bold; margin-bottom: 5px; font-size: 13px;">
          <div style="flex: 2;">Producto</div>
          <div style="flex: 1; text-align: center;">Cant.</div>
          <div style="flex: 1; text-align: right;">Precio</div>
          <div style="flex: 1; text-align: right;">Total</div>
        </div>
  `

  // Agregar los productos con fuente más pequeña y sin decimales
  ventas.forEach((venta) => {
    receiptHTML += `
      <div style="display: flex; margin-bottom: 5px; font-size: 12px;">
        <div style="flex: 2; overflow: hidden; text-overflow: ellipsis;">${venta.Plato}</div>
        <div style="flex: 1; text-align: center;">${venta.Cantidad}</div>
        <div style="flex: 1; text-align: right;">$${Math.round(venta.Precio)}</div>
        <div style="flex: 1; text-align: right;">$${Math.round(venta.Importe)}</div>
      </div>
    `
  })

  // Agregar el total y forma de pago sin decimales
  receiptHTML += `
      </div>
      
      <div style="margin-bottom: 10px; font-size: 16px;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 5px;">
          <div>TOTAL:</div>
          <div>$${Math.round(totalAmount)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <div>Forma de pago:</div>
          <div>${paymentMethod}</div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 15px; font-size: 14px;">
        <div style="margin-bottom: 5px;">¡Gracias por su compra!</div>
        <div>Vuelva pronto</div>
      </div>
    </div>
  `

  // Establecer el contenido HTML
  receiptContent.innerHTML = receiptHTML

  console.log("Contenido del recibo generado correctamente")
}


// Función para actualizar el número de ticket desde la base de datos
async function updateTicketNumberFromDB() {
  try {
    // Obtener el último número de ticket de la base de datos
    const lastTicketNumber = await window.electronAPI.getLastTicketNumber()

    // Incrementar en 1 para el próximo ticket
    ticketNumber = lastTicketNumber + 1

    // Actualizar en la interfaz
    const ticketNumberElements = document.querySelectorAll(".ticket-number")
    ticketNumberElements.forEach((element) => {
      element.textContent = ticketNumber
    })

    // Actualizar específicamente en el carrito
    const cartTicketNumber = document.getElementById("cart-ticket-number")
    if (cartTicketNumber) {
      cartTicketNumber.textContent = ticketNumber
    }

    console.log(`Número de ticket actualizado a: ${ticketNumber}`)
    return ticketNumber
  } catch (error) {
    console.error("Error al obtener el último número de ticket:", error)
    return ticketNumber + 1 // Incrementar en 1 como fallback
  }
}

// Función para limpiar el carrito
function clearCart() {
  // Limpiar los elementos del carrito
  for (const id in cart) {
    delete cart[id]
  }

  // Actualizar la UI
  document.getElementById("cart-items").innerHTML = ""
  document.getElementById("cart-total").textContent = "0.00"
  document.getElementById("cartItemCount").textContent = "0"
  document.getElementById("clientName").value = ""

  // Resetear el total
  total = 0

  // Deseleccionar la forma de pago
  const paymentButtons = document.querySelectorAll(".payment-method-button")
  paymentButtons.forEach((button) => {
    button.classList.remove("selected")
    button.classList.remove("active")
  })

  // Resetear la variable global
  selectedPaymentMethod = null

  console.log("Carrito limpiado completamente")
}


// Función para generar un número de ticket
function generateTicketNumber() {
  // Generar un número aleatorio entre 1000 y 9999 para simular un número de ticket
  // En una aplicación real, esto debería venir de la base de datos
  const ticketNumber = Math.floor(Math.random() * 9000) + 1000
  document.getElementById("cart-ticket-number").textContent = ticketNumber
}

// Función para mostrar el carrito
function showCart() {
  // Actualizar la fecha actual en formato legible
  const today = new Date()
  const formattedDate = today.toLocaleString()
  document.getElementById("cart-date").textContent = formattedDate

  // Actualizar el número de ticket
  const cartTicketNumber = document.getElementById("cart-ticket-number")
  if (cartTicketNumber) {
    cartTicketNumber.textContent = ticketNumber
  }

  // Mostrar el modal
  const cartModal = new bootstrap.Modal(document.getElementById("cartModal"))
  cartModal.show()

  // Configurar los botones de forma de pago
  setupPaymentMethodButtons()
}

// Añadir esta función para manejar la selección de forma de pago
function setupPaymentMethodButtons() {
  console.log("Configurando botones de forma de pago")
  const paymentButtons = document.querySelectorAll(".payment-method-button")

  paymentButtons.forEach((button) => {
    // Eliminar cualquier event listener existente para evitar duplicados
    button.removeEventListener("click", paymentButtonClickHandler)

    // Limpiar clases de selección
    button.classList.remove("selected")
    button.classList.remove("active")

    // Añadir el event listener
    button.addEventListener("click", paymentButtonClickHandler)
  })

  console.log(`${paymentButtons.length} botones de forma de pago configurados`)
}

// Función para manejar los clics en los botones de forma de pago
function paymentButtonClickHandler(event) {
  event.preventDefault() // Prevenir comportamiento por defecto
  console.log("Botón de forma de pago clickeado:", this.getAttribute("data-payment-method"))

  // Quitar la clase 'selected' y 'active' de todos los botones
  const paymentButtons = document.querySelectorAll(".payment-method-button")
  paymentButtons.forEach((btn) => {
    btn.classList.remove("selected")
    btn.classList.remove("active")
  })

  // Añadir la clase 'selected' y 'active' al botón clickeado
  this.classList.add("selected")
  this.classList.add("active")

  // Actualizar la variable global
  selectedPaymentMethod = this.getAttribute("data-payment-method")
  console.log("Forma de pago seleccionada:", selectedPaymentMethod)

  // Mostrar confirmación visual
  showPaymentConfirmation(selectedPaymentMethod)
}

// Función para imprimir el recibo
function printReceipt() {
  console.log("Imprimiendo recibo...")

  const receiptContent = document.getElementById("receipt-content")
  if (!receiptContent) {
    console.error("No se encontró el elemento receipt-content")
    return
  }

  // Crear un iframe para imprimir solo el recibo
  const printFrame = document.createElement("iframe")
  printFrame.style.display = "none"
  document.body.appendChild(printFrame)

  printFrame.contentDocument.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Recibo de Venta</title>
      <style>
        @media print {
          body {
            font-family: 'Bahnschrift SemiBold', monospace;
            font-size: 12px;
            line-height: 1.3;
            width: 58mm;
            margin: 0;
            padding: 0;
          }
          
          @page {
            size: 58mm auto;
            margin: 0mm;
          }
        }
      </style>
    </head>
    <body>
      ${receiptContent.innerHTML}
    </body>
    </html>
  `)

  printFrame.contentWindow.focus()

  // Esperar a que el contenido se cargue antes de imprimir
  setTimeout(() => {
    try {
      printFrame.contentWindow.print()

      // Eliminar el iframe después de imprimir
      setTimeout(() => {
        document.body.removeChild(printFrame)
      }, 1000)

      console.log("Recibo impreso correctamente")
    } catch (error) {
      console.error("Error al imprimir el recibo:", error)
      alert("Error al imprimir el recibo: " + error.message)
    }
  }, 500)
}

// Asignar la función generateReceiptContent al ámbito global
window.generateReceiptContent = generateReceiptContent

// Configurar el botón de imprimir recibo
function setupPrintReceiptButton() {
  const printReceiptBtn = document.getElementById("print-receipt-btn")
  if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", printReceipt)
    console.log("Botón de imprimir recibo configurado")
  } else {
    console.error("No se encontró el botón de imprimir recibo")
  }
}

// Llamar a esta función cuando se cargue la página
document.addEventListener("DOMContentLoaded", () => {
  setupPrintReceiptButton()
})


// Mostrar página de inicio
function showHome() {
  log("Mostrando página de inicio")

  const mainContent = document.getElementById("mainContent")
  if (!mainContent) {
    log("Error: No se encontró el elemento mainContent")
    return
  }

  // Obtener la fecha actual en formato corto
  const now = new Date()
  const formattedDate = now.toLocaleDateString("es-ES")

  mainContent.innerHTML = `
    <div class="row mb-3">
      <div class="col-md-8">
        <h2>Menú</h2>
      </div>
      <div class="col-md-4">
        <div class="info-bar">
          <span><strong>Fecha:</strong> ${formattedDate}</span>
          <span class="ms-3"><strong>Ticket #:</strong> <span id="current-ticket-number">${ticketNumber}</span></span>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-12">
        <div class="mb-3">
          <div id="categoryButtons" class="d-flex flex-wrap justify-content-center">
            <button class="category-button active" data-category="" onclick="filterProducts('')">
              <i class="fas fa-utensils"></i>
              <span>Todas</span>
            </button>
            <button class="category-button" data-category="Hamburguesas" onclick="filterProducts('Hamburguesas')">
              <i class="fas fa-hamburger"></i>
              <span>Hamburguesas</span>
            </button>
            <button class="category-button" data-category="Pollo" onclick="filterProducts('Pollo')">
              <i class="fas fa-drumstick-bite"></i>
              <span>Pollo</span>
            </button>
            <button class="category-button" data-category="Bebidas" onclick="filterProducts('Bebidas')">
              <i class="fas fa-glass-cheers"></i>
              <span>Bebidas</span>
            </button>
            <button class="category-button" data-category="Extras" onclick="filterProducts('Extras')">
              <i class="fas fa-pepper-hot"></i>
              <span>Extras</span>
            </button>
            <button class="category-button" data-category="Pizzas" onclick="filterProducts('Pizzas')">
              <i class="fas fa-pizza-slice"></i>
              <span>Pizzas</span>
            </button>
          </div>
        </div>
        <div id="product-list" class="row row-cols-1 row-cols-md-4 g-4"></div>
        <nav aria-label="Product pagination">
          <ul class="pagination" id="pagination"></ul>
        </nav>
        <div id="debug-output" class="mt-4 p-3 bg-light d-none">
          <h5>Registro de depuración:</h5>
        </div>
      </div>
    </div>
  `

  // Mostrar productos
  displayProducts()

  // Inicializar carrusel de productos
  initializeProductCarousel()

  log("Página de inicio mostrada correctamente")
}

// Mostrar ventas por producto
async function showProductSales() {
  log("Mostrando ventas por producto")

  try {
    window.electronAPI
      .getSalesHistory()
      .then((salesHistory) => {
        log(`Historial de ventas obtenido: ${salesHistory.length} registros`)

        const mainContent = document.getElementById("mainContent")
        if (!mainContent) {
          log("Error: No se encontró el elemento mainContent")
          return
        }

        let salesHTML = `
        <h2>Historial de Ventas por Productos</h2>
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Ticket</th>
              <th>Producto</th>
              <th>Precio</th>
              <th>Cantidad</th>
              <th>IVA</th>
              <th>Importe</th>
              <th>Forma de Pago</th>
            </tr>
          </thead>
          <tbody>
      `

        let totalSales = 0
        salesHistory.forEach((sale) => {
          const date = new Date(sale.Fecha)
          salesHTML += `
          <tr>
            <td>${sale.IdVenta || ""}</td>
            <td>${date.toLocaleDateString()}</td>
            <td>${sale.Nticket}</td>
            <td>${sale.Plato}</td>
            <td>$${Number.parseFloat(sale.precio).toFixed(2)}</td>
            <td>${sale.Cantidad}</td>
            <td>$${Number.parseFloat(sale.Iva).toFixed(2)}</td>
            <td>$${Number.parseFloat(sale.Importe).toFixed(2)}</td>
            <td>${sale.FormaPago}</td>
          </tr>
        `
          totalSales += Number.parseFloat(sale.Importe)
        })

        salesHTML += `
          </tbody>
        </table>
        <h3>Total de Ventas: $${totalSales.toFixed(2)}</h3>
      `

        mainContent.innerHTML = salesHTML
        log("Ventas por producto mostradas correctamente")

        // Reinicializar el carrusel después de cambiar el contenido
        initializeProductCarousel()
      })
      .catch((error) => {
        log("Error al obtener historial de ventas:", error)
        showError("Error al obtener historial de ventas", error)
      })
  } catch (error) {
    log("Error al obtener historial de ventas:", error)
    showError("Error al obtener historial de ventas", error)
  }
}

// Mostrar métodos de pago
async function displayPaymentMethods() {
  log("Mostrando métodos de pago")

  try {
    window.electronAPI
      .getSalesByPaymentMethod()
      .then((paymentMethodTotals) => {
        log(`Métodos de pago obtenidos: ${paymentMethodTotals.length}`)

        const mainContent = document.getElementById("mainContent")
        if (!mainContent) {
          log("Error: No se encontró el elemento mainContent")
          return
        }

        let paymentMethodsHTML = `
        <h2>Ventas por Forma de Pago</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Forma de Pago</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
      `

        paymentMethodTotals.forEach((method) => {
          paymentMethodsHTML += `
          <tr>
            <td>${method.FormaPago}</td>
            <td>$${method.Total.toFixed(2)}</td>
          </tr>
        `
        })

        paymentMethodsHTML += `
          </tbody>
        </table>
      `

        mainContent.innerHTML = paymentMethodsHTML
        log("Métodos de pago mostrados correctamente")

        // Reinicializar el carrusel
        initializeProductCarousel()
      })
      .catch((error) => {
        log("Error al obtener ventas por método de pago:", error)
        showError("Error al obtener ventas por método de pago", error)
      })
  } catch (error) {
    log("Error al obtener ventas por método de pago:", error)
    showError("Error al obtener ventas por método de pago", error)
  }
}

// Mostrar ventas diarias
function showDailySales() {
  log("Mostrando ventas diarias")

  try {
    window.electronAPI
      .getDailySales()
      .then((dailySales) => {
        const today = new Date().toDateString()
        log(`Ventas del día obtenidas: ${JSON.stringify(dailySales)}`)

        const mainContent = document.getElementById("mainContent")
        if (!mainContent) {
          log("Error: No se encontró el elemento mainContent")
          return
        }

        mainContent.innerHTML = `
        <h2>Ventas Totales del Día</h2>
        <h3>Fecha: ${today}</h3>
        <h4>Total: $${(dailySales.Total || 0).toFixed(2)}</h4>
      `

        log("Ventas diarias mostradas correctamente")

        // Reinicializar el carrusel
        initializeProductCarousel()
      })
      .catch((error) => {
        log("Error al obtener ventas diarias:", error)
        showError("Error al obtener ventas diarias", error)
      })
  } catch (error) {
    log("Error al obtener ventas diarias:", error)
    showError("Error al obtener ventas diarias", error)
  }
}

// Mostrar productos más vendidos
function showTopSellingProducts() {
  log("Mostrando productos más vendidos")

  try {
      window.electronAPI
          .getTopSellingProducts()
          .then((topProducts) => {
              log(`Productos más vendidos obtenidos: ${topProducts.length}`)

              const mainContent = document.getElementById("mainContent")
              if (!mainContent) {
                  log("Error: No se encontró el elemento mainContent")
                  return
              }

              let topProductsHTML = `
              <h2>Productos Más Vendidos</h2>
              <table class="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad Vendida</th>
                    <th>Total Vendido</th>
                  </tr>
                </thead>
                <tbody>
            `

              topProducts.forEach((product) => {
                  topProductsHTML += `
                <tr>
                  <td>${product.Plato}</td>
                  <td>${product.CantidadTotal}</td>
                  <td>$${product.TotalVendido.toFixed(2)}</td>
                </tr>
              `
              })

              topProductsHTML += `
                </tbody>
              </table>
            `

              mainContent.innerHTML = topProductsHTML
              log("Productos más vendidos mostrados correctamente")

              // Reinicializar el carrusel
              initializeProductCarousel()
          })
          .catch((error) => {
              log("Error al obtener productos más vendidos:", error)
              showError("Error al obtener productos más vendidos", error)
          })
  } catch (error) {
      log("Error al obtener productos más vendidos:", error)
      showError("Error al obtener productos más vendidos", error)
  }
}
        
        // Mostrar ventas por método de pago
        function showSalesByPaymentMethod() {
          log("Mostrando ventas por método de pago")
        
          try {
            window.electronAPI
              .getSalesByPaymentMethod()
              .then((paymentMethodTotals) => {
                log(`Ventas por método de pago obtenidas: ${paymentMethodTotals.length}`)
        
                const mainContent = document.getElementById("mainContent")
                if (!mainContent) {
                  log("Error: No se encontró el elemento mainContent")
                  return
                }
        
                let salesByMethodHTML = `
                <h2>Ventas por Forma de Pago</h2>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Forma de Pago</th>
                      <th>Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
              `
        
                paymentMethodTotals.forEach((method) => {
                  salesByMethodHTML += `
                  <tr>
                    <td>${method.FormaPago}</td>
                    <td>$${method.Total.toFixed(2)}</td>
                  </tr>
                `
                })
        
                salesByMethodHTML += `
                  </tbody>
                </table>
              `
        
                mainContent.innerHTML = salesByMethodHTML
                log("Ventas por método de pago mostradas correctamente")
        
                // Reinicializar el carrusel
                initializeProductCarousel()
              })
              .catch((error) => {
                log("Error al obtener ventas por método de pago:", error)
                showError("Error al obtener ventas por método de pago", error)
              })
          } catch (error) {
            log("Error al obtener ventas por método de pago:", error)
            showError("Error al obtener ventas por método de pago", error)
          }
        }
        
        // Mostrar opciones de exportación
        function showExportOptions() {
          log("Mostrando opciones de exportación")
        
          const mainContent = document.getElementById("mainContent")
          if (!mainContent) {
            log("Error: No se encontró el elemento mainContent")
            return
          }
        
          mainContent.innerHTML = `
            <h2>Exportar Datos</h2>
            <div class="d-flex justify-content-center mt-4">
              <button class="btn btn-primary me-3" onclick="exportToCSV()">Exportar a CSV</button>
              <button class="btn btn-success" onclick="exportToExcelXML()">Exportar a Excel XML</button>
            </div>
          `
        
          log("Opciones de exportación mostradas correctamente")
        
          // Reinicializar el carrusel
          initializeProductCarousel()
        }
        
        // Exportar a CSV
        async function exportToCSV() {
          log("Exportando a CSV")
        
          try {
            const result = await window.electronAPI.exportToCSV()
            log(`CSV exportado correctamente a: ${result.path}`)
            alert(`Archivo CSV exportado exitosamente a: ${result.path}`)
          } catch (error) {
            log("Error al exportar a CSV:", error)
            showError("Error al exportar a CSV", error)
          }
        }
        
        // Exportar a Excel XML
        async function exportToExcelXML() {
          log("Exportando a Excel XML")
        
          try {
            const result = await window.electronAPI.exportToExcel()
            log(`Excel exportado correctamente a: ${result.path}`)
            alert(`Archivo Excel exportado exitosamente a: ${result.path}`)
          } catch (error) {
            log("Error al exportar a Excel:", error)
            showError("Error al exportar a Excel", error)
          }
        }
        
        // Salir de la aplicación
        function exitApplication() {
          log("Intentando salir de la aplicación")
        
          if (confirm("¿Estás seguro de que quieres salir de la aplicación?")) {
            log("Confirmado: cerrando la aplicación")
            window.close()
            setTimeout(() => { if (!window.closed) alert("El navegador no permite cerrar esta pestaña desde la aplicación. Ciérrala manualmente.") }, 300)
          } else {
            log("Cancelado: no se cerrará la aplicación")
          }
        }

        function printReceipt() {
          console.log("Imprimiendo recibo...")
        
          const receiptContent = document.getElementById("receipt-content")
          if (!receiptContent) {
            console.error("No se encontró el elemento receipt-content")
            return
          }
        
          // Crear un iframe para imprimir solo el recibo
          const printFrame = document.createElement("iframe")
          printFrame.style.display = "none"
          document.body.appendChild(printFrame)
        
          // Asegurarse de que la imagen del logo se cargue correctamente en el iframe
          const logoPath = "./img/logobroaster.png"
        
          printFrame.contentDocument.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Recibo de Venta</title>
              <style>
                @media print {
                  body {
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.3;
                    width: 58mm;
                    margin: 0;
                    padding: 0;
                  }
                  
                  img {
                    max-width: 100%;
                    height: auto;
                  }
                  
                  @page {
                    size: 58mm auto;
                    margin: 0mm;
                  }
                }
              </style>
            </head>
            <body>
              ${receiptContent.innerHTML}
            </body>
            </html>
          `)
        
          // Esperar a que las imágenes se carguen antes de imprimir
          const images = printFrame.contentDocument.getElementsByTagName("img")
          let imagesLoaded = 0
          const totalImages = images.length
        
          if (totalImages === 0) {
            // No hay imágenes, imprimir directamente
            doPrint()
          } else {
            // Esperar a que todas las imágenes se carguen
            for (let i = 0; i < totalImages; i++) {
              if (images[i].complete) {
                imageLoaded()
              } else {
                images[i].onload = imageLoaded
                images[i].onerror = imageLoaded // Continuar incluso si la imagen no se carga
              }
            }
          }
        
          function imageLoaded() {
            imagesLoaded++
            if (imagesLoaded === totalImages) {
              doPrint()
            }
          }
        
          function doPrint() {
            printFrame.contentWindow.focus()
        
            setTimeout(() => {
              try {
                printFrame.contentWindow.print()
        
                // Eliminar el iframe después de imprimir
                setTimeout(() => {
                  document.body.removeChild(printFrame)
                }, 1000)
        
                console.log("Recibo impreso correctamente")
              } catch (error) {
                console.error("Error al imprimir el recibo:", error)
                alert("Error al imprimir el recibo: " + error.message)
              }
            }, 500)
          }
        }
        
        // Asignar la función generateReceiptContent al ámbito global
        window.generateReceiptContent = generateReceiptContent
        
        
        // Modificar la función initializeProductCarousel para manejar rutas de imágenes locales
        function initializeProductCarousel() {
          log("Inicializando carrusel de productos")
        
          const carouselElement = document.getElementById("productCarousel")
          if (!carouselElement) {
            log("Error: No se encontró el elemento productCarousel")
            return
          }
        
          // Limpiar el carrusel
          carouselElement.innerHTML = ""
        
          // Verificar si hay productos
          if (products.length === 0) {
            log("No hay productos para mostrar en el carrusel")
            return
          }
        
          // Agregar productos al carrusel
          products.forEach((product) => {
            // Construir la ruta de la imagen correctamente
            const imagePath = product.Imagen.startsWith("http") ? product.Imagen : `img/${product.Imagen}`
        
            const item = document.createElement("div")
            item.className = "item"
            item.innerHTML = `
              <img src="${imagePath}" alt="${product.Plato}" onclick="addToCart(${product.ID})" onerror="this.src='img/placeholder.jpg'">
            `
            carouselElement.appendChild(item)
          })
        
          // Destruir el carrusel existente si ya está inicializado
          try {
            if (window.jQuery && jQuery.fn.owlCarousel) {
              jQuery(carouselElement).trigger("destroy.owl.carousel")
            }
          } catch (error) {
            log("Error al destruir carrusel existente:", error)
          }
        
          // Inicializar Owl Carousel con configuración fija
          try {
            if (window.jQuery && jQuery.fn.owlCarousel) {
              jQuery(carouselElement).owlCarousel({
                loop: true,
                margin: 10,
                nav: true,
                autoWidth: false,
                items: 7,
                responsive: {
                  0: { items: 3 },
                  600: { items: 5 },
                  1000: { items: 7 },
                },
              })
              log("Carrusel inicializado correctamente con Owl Carousel")
            } else {
              log("Advertencia: jQuery o Owl Carousel no están disponibles, el carrusel no funcionará")
            }
          } catch (error) {
            log("Error al inicializar Owl Carousel:", error)
          }
        }
        
        // Modificar la función showPaymentConfirmation para que solo se use al seleccionar forma de pago
        function showPaymentConfirmation(paymentMethod) {
          log(`Mostrando confirmación de método de pago: ${paymentMethod}`)
        
          const confirmationElement = document.getElementById("paymentConfirmation")
          const selectedMethodElement = document.getElementById("selectedPaymentMethod")
          const ticketNumberElement = document.getElementById("payment-ticket-number")
        
          if (!confirmationElement || !selectedMethodElement) {
            log("Error: No se encontraron elementos de confirmación de pago")
            return
          }
        
          selectedMethodElement.textContent = `Has seleccionado: ${paymentMethod}`
        
          // Mostrar el número de ticket en la confirmación
          if (ticketNumberElement) {
            ticketNumberElement.textContent = ticketNumber
          }
        
          confirmationElement.style.display = "block"
          setTimeout(() => {
            confirmationElement.style.display = "none"
          }, 2000)
        }
        
        // Inicializar botones de método de pago
        function initializePaymentMethodButtons() {
          log("Inicializando botones de método de pago")
        
          const paymentMethodButtons = document.querySelectorAll(".payment-method-button")
          if (paymentMethodButtons.length === 0) {
            log("Error: No se encontraron botones de método de pago")
            return
          }
        
          paymentMethodButtons.forEach((button) => {
            button.addEventListener("click", () => {
              selectedPaymentMethod = button.dataset.paymentMethod
              log(`Método de pago seleccionado: ${selectedPaymentMethod}`)
              updatePaymentMethodButtons()
              showPaymentConfirmation(selectedPaymentMethod)
            })
          })
        
          log(`${paymentMethodButtons.length} botones de método de pago inicializados`)
        }
        
        // Actualizar botones de método de pago
        function updatePaymentMethodButtons() {
          log(`Actualizando botones de método de pago, método seleccionado: ${selectedPaymentMethod}`)
        
          const buttons = document.querySelectorAll(".payment-method-button")
          if (buttons.length === 0) {
            log("Error: No se encontraron botones de método de pago para actualizar")
            return
          }
        
          buttons.forEach((button) => {
            if (button.dataset.paymentMethod === selectedPaymentMethod) {
              button.classList.add("active")
            } else {
              button.classList.remove("active")
            }
          })
        }
        
        // Variable global para almacenar el tipo de reporte actual
        let currentReportType = null
        
        // Función para mostrar el selector de rango de fechas
        function showDateRangeSelector() {
          const dateRangeSelector = document.getElementById("dateRangeSelector")
          dateRangeSelector.style.display = "block"
        }
        
        // Función común para obtener y mostrar los datos del informe
        async function fetchAndDisplayReport() {
          const startDate = document.getElementById("startDate").value
          const endDate = document.getElementById("endDate").value
        
          if (!startDate || !endDate) {
            alert("Por favor, seleccione ambas fechas.")
            return
          }
        
          try {
            const reportData = await window.electronAPI.getSalesReport({
              startDate: startDate,
              endDate: endDate,
              reportType: currentReportType,
            })
        
            displayReport(reportData)
          } catch (error) {
            console.error("Error fetching report data:", error)
            alert("Error fetching report data: " + error.message)
          }
        }
        
        // Función para mostrar el informe (esta función necesita ser adaptada para cada tipo de informe)
        function displayReport(reportData) {
          const reportContent = document.getElementById("reportContent")
          if (!reportContent) {
            console.error("reportContent element not found")
            return
          }
        
          let reportHTML = ""
        
          switch (currentReportType) {
            case "generalSales":
              reportHTML = generateGeneralSalesReportHTML(reportData)
              break
            case "productSales":
              reportHTML = generateProductSalesReportHTML(reportData)
              break
            case "paymentMethods":
              reportHTML = generatePaymentMethodsReportHTML(reportData)
              break
            default:
              reportHTML = "<p>Tipo de reporte no válido.</p>"
          }
        
          reportContent.innerHTML = reportHTML
        }
        
        // Funciones específicas para generar el HTML de cada tipo de informe
        function generateGeneralSalesReportHTML(reportData) {
          let totalSales = 0
          let salesHTML = `
                <h2>Ventas Generales</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Ticket</th>
                            <th>Producto</th>
                            <th>Precio</th>
                            <th>Cantidad</th>
                            <th>IVA</th>
                            <th>Importe</th>
                            <th>Forma de Pago</th>
                        </tr>
                    </thead>
                    <tbody>
            `
        
          reportData.forEach((sale) => {
            const date = new Date(sale.Fecha)
            salesHTML += `
                    <tr>
                        <td>${date.toLocaleDateString()}</td>
                        <td>${sale.Nticket}</td>
                        <td>${sale.Plato}</td>
                        <td>$${Number.parseFloat(sale.precio).toFixed(2)}</td>
                        <td>${sale.Cantidad}</td>
                        <td>$${Number.parseFloat(sale.Iva).toFixed(2)}</td>
                        <td>$${Number.parseFloat(sale.Importe).toFixed(2)}</td>
                        <td>${sale.FormaPago}</td>
                    </tr>
                `
            totalSales += Number.parseFloat(sale.Importe)
          })
        
          salesHTML += `
                    </tbody>
                </table>
                <h3>Total de Ventas: $${totalSales.toFixed(2)}</h3>
            `
        
          return salesHTML
        }
        
        function generateProductSalesReportHTML(reportData) {
          let productsHTML = `
                <h2>Ventas por Producto</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad Total</th>
                            <th>Total Vendido</th>
                        </tr>
                    </thead>
                    <tbody>
            `
        
          reportData.forEach((product) => {
            productsHTML += `
                    <tr>
                        <td>${product.Plato}</td>
                        <td>${product.CantidadTotal}</td>
                        <td>$${product.TotalVendido.toFixed(2)}</td>
                    </tr>
                `
          })
        
          productsHTML += `
                    </tbody>
                </table>
            `
        
          return productsHTML
        }
        
        function generatePaymentMethodsReportHTML(reportData) {
          let paymentMethodsHTML = `
                <h2>Ventas por Forma de Pago</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Forma de Pago</th>
                            <th>Total Vendido</th>
                        </tr>
                    </thead>
                    <tbody>
            `
        
          reportData.forEach((method) => {
            paymentMethodsHTML += `
                    <tr>
                        <td>${method.FormaPago}</td>
                        <td>$${method.Total.toFixed(2)}</td>
                    </tr>
                `
          })
        
          paymentMethodsHTML += `
                    </tbody>
                </table>
            `
        
          return paymentMethodsHTML
        }
        
        function showPaymentMethods() {
          currentReportType = "paymentMethods"
          showDateRangeSelector()
        }
        
        function showGeneralSalesModal() {
          // Prefija el rango: desde el primer día del mes hasta hoy, y carga el historial
          const now = new Date()
          const startInput = document.getElementById("generalSalesStartDate")
          const endInput = document.getElementById("generalSalesEndDate")
          if (!startInput.value) startInput.value = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
          if (!endInput.value) endInput.value = localDateStr(now)
          const generalSalesModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("generalSalesModal"))
          generalSalesModal.show()
          generateGeneralSalesReport()
        }

        function escapeHtml(v) {
          return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
        }

        const money = (n) => "$" + (Number.parseFloat(n) || 0).toFixed(2)

        // "2026-11-11 05:50:00" -> "11/11/2026 05:50" (la hora se omite si es 00:00)
        function formatFechaHora(str) {
          if (!str) return ""
          const [d, t = ""] = String(str).split(/[ T]/)
          const [y, m, day] = d.split("-")
          const hora = t.slice(0, 5)
          return `${day}/${m}/${y}` + (hora && hora !== "00:00" ? ` ${hora}` : "")
        }

        function estadoBadge(estado) {
          const cls = { Completado: "success", Aceptada: "success", Pausado: "warning text-dark", Cancelada: "danger" }[estado] || "secondary"
          return `<span class="badge bg-${cls}">${escapeHtml(estado || "—")}</span>`
        }

        // Historial: una fila por ticket (tabla Tickets)
        async function generateGeneralSalesReport() {
          const startDate = document.getElementById("generalSalesStartDate").value
          const endDate = document.getElementById("generalSalesEndDate").value
          const reportContent = document.getElementById("generalSalesReportContent")

          if (!startDate || !endDate) {
            alert("Por favor, seleccione ambas fechas.")
            return
          }

          try {
            const tickets = await window.electronAPI.getTicketsReport(startDate, endDate)

            if (!tickets.length) {
              reportContent.innerHTML = `<p class="text-muted">No hay ventas en el rango seleccionado.</p>`
              return
            }

            let total = 0
            let canceladas = 0
            let rows = ""
            tickets.forEach((t) => {
              if (t.Estado === "Cancelada") canceladas++
              else total += Number.parseFloat(t.Monto) || 0
              rows += `
                <tr${t.Estado === "Cancelada" ? ' class="table-light text-muted"' : ""}>
                  <td>${escapeHtml(formatFechaHora(t.Fecha))}</td>
                  <td>#${escapeHtml(t.NTicket)}</td>
                  <td>${escapeHtml(t.Cliente)}</td>
                  <td>${escapeHtml(t.Fpago)}</td>
                  <td class="text-end">${money(t.SubTotal)}</td>
                  <td class="text-end">${money(t.Iva)}</td>
                  <td class="text-end fw-semibold">${money(t.Monto)}</td>
                  <td>${estadoBadge(t.Estado)}</td>
                  <td class="text-center">
                    <button type="button" class="btn btn-sm btn-outline-primary btn-eye" title="Ver detalles"
                      aria-label="Ver detalles del ticket ${escapeHtml(t.NTicket)}" onclick="showTicketDetails(${Number(t.NTicket)})">
                      <i class="fas fa-eye"></i>
                    </button>
                  </td>
                </tr>`
            })

            reportContent.innerHTML = `
              <div class="table-responsive">
                <table class="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Ticket</th><th>Cliente</th><th>Forma de Pago</th>
                      <th class="text-end">Subtotal</th><th class="text-end">IVA</th><th class="text-end">Monto</th>
                      <th>Estado</th><th class="text-center">Detalles</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
              <h5>Total de ventas: ${money(total)}
                <small class="text-muted fs-6">(${tickets.length - canceladas} tickets${canceladas ? `, sin contar ${canceladas} cancelados` : ""})</small>
              </h5>`
          } catch (error) {
            console.error("Error al obtener el historial:", error)
            alert("Error al obtener el historial: " + error.message)
            reportContent.innerHTML = `<p class="text-danger">Error al generar el historial.</p>`
          }
        }

        // Detalle de un ticket: líneas de la tabla Ventas enlazadas por NTicket
        async function showTicketDetails(nticket) {
          const content = document.getElementById("ticketDetailContent")
          const modalEl = document.getElementById("ticketDetailModal")
          content.innerHTML = `<p class="text-muted">Cargando…</p>`
          document.getElementById("ticketDetailModalLabel").innerHTML = `<i class="fas fa-eye me-2"></i>Detalle de la venta #${escapeHtml(nticket)}`
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl)
          modal.show()
          // Que el fondo oscuro de este modal quede por encima del modal del historial
          modalEl.addEventListener("shown.bs.modal", () => {
            const backs = document.querySelectorAll(".modal-backdrop")
            if (backs.length) backs[backs.length - 1].classList.add("stacked-backdrop")
          }, { once: true })

          try {
            const { ticket, items } = await window.electronAPI.getTicketDetails(nticket)
            const lineas = items
              .map(
                (v) => `
                <tr>
                  <td>${escapeHtml(v.Plato)}</td>
                  <td class="text-end">${money(v.Precio)}</td>
                  <td class="text-center">${escapeHtml(v.Cantidad)}</td>
                  <td class="text-end">${money(v.Iva)}</td>
                  <td class="text-end">${money(v.Importe)}</td>
                </tr>`,
              )
              .join("")
            const sumLineas = items.reduce((s, v) => s + (Number.parseFloat(v.Importe) || 0), 0)

            content.innerHTML = `
              ${
                ticket
                  ? `<dl class="row ticket-meta mb-3">
                      <dt class="col-sm-3">Fecha</dt><dd class="col-sm-9">${escapeHtml(formatFechaHora(ticket.Fecha))}</dd>
                      <dt class="col-sm-3">Cliente</dt><dd class="col-sm-9">${escapeHtml(ticket.Cliente)}</dd>
                      <dt class="col-sm-3">Forma de pago</dt><dd class="col-sm-9">${escapeHtml(ticket.Fpago)}</dd>
                      <dt class="col-sm-3">Estado</dt><dd class="col-sm-9">${estadoBadge(ticket.Estado)}</dd>
                    </dl>`
                  : `<div class="alert alert-warning">Este ticket no existe en la tabla Tickets.</div>`
              }
              ${
                items.length
                  ? `<div class="table-responsive"><table class="table table-sm align-middle">
                      <thead><tr><th>Producto</th><th class="text-end">Precio</th><th class="text-center">Cant.</th><th class="text-end">IVA</th><th class="text-end">Importe</th></tr></thead>
                      <tbody>${lineas}</tbody>
                      <tfoot><tr><th colspan="4" class="text-end">Suma de líneas</th><th class="text-end">${money(sumLineas)}</th></tr></tfoot>
                    </table></div>`
                  : `<p class="text-muted">Este ticket no tiene líneas de detalle registradas en Ventas.</p>`
              }
              ${
                ticket
                  ? `<div class="text-end">
                      <div>Subtotal: <strong>${money(ticket.SubTotal)}</strong></div>
                      <div>IVA: <strong>${money(ticket.Iva)}</strong></div>
                      <div class="fs-5">Total: <strong>${money(ticket.Monto)}</strong></div>
                    </div>`
                  : ""
              }`
          } catch (error) {
            console.error("Error al obtener el detalle:", error)
            content.innerHTML = `<p class="text-danger">No se pudo cargar el detalle: ${escapeHtml(error.message)}</p>`
          }
        }

        function showProductSalesReportModal() {
          const productSalesReportModal = new bootstrap.Modal(document.getElementById("productSalesReportModal"))
          productSalesReportModal.show()
          loadProductOptions() // Cargar las opciones del select al mostrar el modal
        }
        
        async function loadProductOptions() {
          const productSelect = document.getElementById("productSalesPlato")
          productSelect.innerHTML = '<option value="">Todos los productos</option>' // Limpiar opciones
        
          try {
            const products = await window.electronAPI.getProducts() // Obtener la lista de productos
            products.forEach((product) => {
              const option = document.createElement("option")
              option.value = product.Plato
              option.textContent = product.Plato
              productSelect.appendChild(option)
            })
          } catch (error) {
            console.error("Error al cargar las opciones de productos:", error)
            alert("Error al cargar las opciones de productos: " + error.message)
          }
        }
        
        async function generateProductSalesReport() {
          const startDate = document.getElementById("productSalesStartDate").value
          const endDate = document.getElementById("productSalesEndDate").value
          const plato = document.getElementById("productSalesPlato").value
          const reportContent = document.getElementById("productSalesReportContent")
        
          if (!startDate || !endDate) {
            alert("Por favor, seleccione ambas fechas.")
            return
          }
        
          try {
            const salesData = await window.electronAPI.getProductSalesReport(startDate, endDate, plato)
        
            let totalImporte = 0
            let reportHTML = `
                  <h2>Ventas por Producto</h2>
                  <table class="table">
                      <thead>
                          <tr>
                              <th>Producto</th>
                              <th>Cantidad Total</th>
                              <th>Total Vendido</th>
                          </tr>
                      </thead>
                      <tbody>
              `
        
            salesData.forEach((sale) => {
              reportHTML += `
                      <tr>
                          <td>${sale.Plato}</td>
                          <td>${sale.CantidadTotal}</td>
                          <td>$${Number.parseFloat(sale.TotalVendido).toFixed(2)}</td>
                      </tr>
                  `
              totalImporte += Number.parseFloat(sale.TotalVendido)
            })
        
            reportHTML += `
                      </tbody>
                  </table>
                  <h3>Total de Ventas: $${totalImporte.toFixed(2)}</h3>
              `
        
            reportContent.innerHTML = reportHTML
          } catch (error) {
            console.error("Error al obtener el reporte:", error)
            alert("Error al obtener el reporte: " + error.message)
            reportContent.innerHTML = `<p class="text-danger">Error al generar el reporte.</p>`
          }
        }
        
        function showPaymentMethodsReportModal() {
          const paymentMethodsReportModal = new bootstrap.Modal(document.getElementById("paymentMethodsReportModal"))
          paymentMethodsReportModal.show()
        }
        
        async function generatePaymentMethodsReport() {
          const startDate = document.getElementById("paymentMethodsStartDate").value
          const endDate = document.getElementById("paymentMethodsEndDate").value
          const formaPago = document.getElementById("paymentMethodsFormaPago").value
          const reportContent = document.getElementById("paymentMethodsReportContent")
        
          if (!startDate || !endDate) {
            alert("Por favor, seleccione ambas fechas.")
            return
          }
        
          try {
            const salesData = await window.electronAPI.getPaymentMethodsReport(startDate, endDate, formaPago)
        
            let totalImporte = 0
            let reportHTML = `
                  <h2>Ventas por Forma de Pago</h2>
                  <table class="table">
                      <thead>
                          <tr>
                              <th>Forma de Pago</th>
                              <th>Total Vendido</th>
                          </tr>
                      </thead>
                      <tbody>
              `
        
            salesData.forEach((sale) => {
              reportHTML += `
                      <tr>
                          <td>${sale.FormaPago}</td>
                          <td>$${Number.parseFloat(sale.Total).toFixed(2)}</td>
                      </tr>
                  `
              totalImporte += Number.parseFloat(sale.Total)
            })
        
            reportHTML += `
                      </tbody>
                  </table>
                  <h3>Total de Ventas: $${totalImporte.toFixed(2)}</h3>
              `
        
            reportContent.innerHTML = reportHTML
          } catch (error) {
            console.error("Error al obtener el reporte:", error)
            alert("Error al obtener el reporte: " + error.message)
            reportContent.innerHTML = `<p class="text-danger">Error al generar el reporte.</p>`
          }
        }
        
        function showPlatosModal() {
          const platosModal = new bootstrap.Modal(document.getElementById("platosModal"))
          platosModal.show()
          loadPlatos()
        }
        
        // Función mejorada para cargar los platos en la tabla
        async function loadPlatos() {
          const platosTableBody = document.getElementById("platosTableBody")
          if (!platosTableBody) {
            console.log("Error: No se encontró el elemento platosTableBody")
            return
          }
        
          platosTableBody.innerHTML = "" // Limpiar la tabla
        
          try {
            const platos = await window.electronAPI.getProducts() // Usamos getProducts para obtener la lista de platos
            console.log(`Platos cargados: ${platos.length}`)
        
            platos.forEach((plato) => {
              const row = document.createElement("tr")
        
              // Determinar la ruta de la imagen
              let imagePath = ""
              if (plato.Imagen) {
                // Si la imagen ya es una URL completa, usarla directamente
                if (plato.Imagen.startsWith("http")) {
                  imagePath = plato.Imagen
                } else {
                  // Si no, construir la ruta relativa
                  imagePath = `img/${plato.Imagen}`
                }
              } else {
                // Imagen por defecto si no hay imagen
                imagePath = "img/placeholder.jpg"
              }
        
              row.innerHTML = `
                <td>${plato.ID}</td>
                <td>${plato.Plato}</td>
                <td>$${Number.parseFloat(plato.Precio).toFixed(2)}</td>
                <td>${plato.Categoria || ""}</td>
                <td class="text-center">
                  <img src="${imagePath}" alt="${plato.Plato}" class="img-thumbnail" 
                       style="max-width: 80px; max-height: 80px;" onerror="this.src='img/placeholder.jpg'">
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-outline-primary me-2 btn-action" onclick="showPlatoForm('edit', ${plato.ID})" title="Editar">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger btn-action" onclick="showDeleteConfirmation(${plato.ID}, '${plato.Plato.replace(/'/g, "\\'")}')" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </td>
              `
              platosTableBody.appendChild(row)
            })
          } catch (error) {
            console.error("Error al cargar los platos:", error)
            alert("Error al cargar los platos: " + error.message)
          }
        }
        
        // Función editPlato actualizada para usar el nuevo sistema
        async function editPlato(id) {
          showPlatoForm("edit", id)
        }
        
        // Función deletePlato actualizada para usar el nuevo sistema
        async function deletePlato(id) {
          const plato = await window.electronAPI.getPlato(id)
          if (plato) {
            showDeleteConfirmation(id, plato.Plato)
          }
        }
        
        // Función para limpiar el formulario
        function clearForm() {
          document.getElementById("platoId").value = ""
          document.getElementById("platoNombre").value = ""
          document.getElementById("platoPrecio").value = ""
          document.getElementById("platoCategoria").value = ""
          document.getElementById("platoImagen").value = ""
          document.getElementById("imagePreview").src = "img/placeholder.jpg"
        }
        
        // Variables globales para el manejo de platos
        let allPlatos = [] // Almacena todos los platos para la búsqueda
        let currentPlatoId = null // ID del plato que se está editando o eliminando
        
        // Función para calcular el próximo ID
        async function getNextId() {
          try {
            const platos = await window.electronAPI.getProducts()
            if (!platos || platos.length === 0) {
              return 1 // Si no hay platos, empezar con ID 1
            }
        
            // Encontrar el ID máximo y sumar 1
            const maxId = Math.max(...platos.map((plato) => plato.ID))
            return maxId + 1
          } catch (error) {
            console.error("Error al calcular el próximo ID:", error)
            return "Auto" // Valor por defecto en caso de error
          }
        }
        
        // Función para mostrar el modal del formulario (nuevo o editar)
        async function showPlatoForm(mode, id = null) {
          // Limpiar el formulario
          document.getElementById("platoForm").reset()
          document.getElementById("platoId").value = ""
          document.getElementById("imagePreview").src = "img/placeholder.jpg"
        
          // Configurar el modal según el modo
          if (mode === "new") {
            document.getElementById("platoFormModalLabel").textContent = "Nuevo Plato"
            document.getElementById("savePlatoBtn").onclick = () => savePlato("new")
        
            // Calcular y mostrar el próximo ID
            const nextId = await getNextId()
            document.getElementById("platoId").value = nextId
          } else if (mode === "edit") {
            document.getElementById("platoFormModalLabel").textContent = "Editar Plato"
            document.getElementById("savePlatoBtn").onclick = () => savePlato("edit")
            // Cargar los datos del plato
            loadPlatoData(id)
          }
        
          // Mostrar el modal
          const modal = new bootstrap.Modal(document.getElementById("platoFormModal"))
          modal.show()
        }
        
        // Función para cargar los datos de un plato en el formulario
        async function loadPlatoData(id) {
          currentPlatoId = id
          try {
            const plato = await window.electronAPI.getPlato(id)
            if (!plato) {
              throw new Error(`No se encontró el plato con ID ${id}`)
            }
        
            document.getElementById("platoId").value = plato.ID
            document.getElementById("platoNombre").value = plato.Plato
            document.getElementById("platoPrecio").value = plato.Precio
            document.getElementById("platoCategoria").value = plato.Categoria || ""
            document.getElementById("platoImagen").value = plato.Imagen || ""
        
            // Actualizar la vista previa de la imagen
            if (plato.Imagen) {
              let imagePath = plato.Imagen
              if (!imagePath.startsWith("http")) {
                imagePath = `img/${imagePath}`
              }
              document.getElementById("imagePreview").src = imagePath
            } else {
              document.getElementById("imagePreview").src = "img/placeholder.jpg"
            }
          } catch (error) {
            console.error("Error al cargar el plato para editar:", error)
            alert("Error al cargar el plato para editar: " + error.message)
          }
        }
        
        // Función para seleccionar una imagen
        function selectImage() {
          window.electronAPI
            .openFileDialog()
            .then((result) => {
              if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0]
                const fileName = filePath.split(/[\\/]/).pop() // Obtener solo el nombre del archivo
        
                // Actualizar el campo de imagen y la vista previa
                document.getElementById("platoImagen").value = fileName
                document.getElementById("imagePreview").src = filePath
        
                // Copiar la imagen a la carpeta img
                window.electronAPI
                  .copyImageToApp(filePath, fileName)
                  .then(() => {
                    console.log(`Imagen copiada correctamente: ${fileName}`)
                  })
                  .catch((error) => {
                    console.error("Error al copiar la imagen:", error)
                    alert("Error al copiar la imagen: " + error.message)
                  })
              }
            })
            .catch((error) => {
              console.error("Error al abrir el selector de archivos:", error)
              alert("Error al abrir el selector de archivos: " + error.message)
            })
        }
        
        // Función para guardar un plato (nuevo o editado)
        async function savePlato(mode = "new") {
          const nombre = document.getElementById("platoNombre").value
          const precio = Number.parseFloat(document.getElementById("platoPrecio").value)
          const categoria = document.getElementById("platoCategoria").value
          const imagen = document.getElementById("platoImagen").value
        
          if (!nombre || isNaN(precio) || !categoria) {
            alert("Por favor complete todos los campos requeridos")
            return
          }
        
          try {
            if (mode === "edit") {
              const id = Number.parseInt(document.getElementById("platoId").value)
              await window.electronAPI.updatePlato({
                ID: id,
                Plato: nombre,
                Precio: precio,
                Categoria: categoria,
                Imagen: imagen,
              })
              console.log(`Plato con ID ${id} actualizado correctamente`)
            } else {
              await window.electronAPI.createPlato({
                Plato: nombre,
                Precio: precio,
                Categoria: categoria,
                Imagen: imagen,
              })
              console.log("Nuevo plato creado correctamente")
            }
        
            // Cerrar el modal y recargar la tabla
            const modalElement = document.getElementById("platoFormModal")
            const modal = bootstrap.Modal.getInstance(modalElement)
            modal.hide()
            loadPlatos()
          } catch (error) {
            console.error("Error al guardar el plato:", error)
            alert("Error al guardar el plato: " + error.message)
          }
        }
        
        // Función para mostrar el modal de confirmación de eliminación
        function showDeleteConfirmation(id, nombre) {
          currentPlatoId = id
          document.getElementById("deletePlatoName").textContent = nombre
        
          // Configurar el botón de confirmación
          document.getElementById("confirmDeleteBtn").onclick = confirmDelete
        
          // Mostrar el modal
          const modal = new bootstrap.Modal(document.getElementById("confirmDeleteModal"))
          modal.show()
        }
        
        // Función para confirmar la eliminación
        async function confirmDelete() {
          try {
            await window.electronAPI.deletePlato(currentPlatoId)
            console.log(`Plato con ID ${currentPlatoId} eliminado correctamente`)
        
            // Cerrar el modal y recargar la tabla
            const modalElement = document.getElementById("confirmDeleteModal")
            const modal = bootstrap.Modal.getInstance(modalElement)
            modal.hide()
            loadPlatos()
          } catch (error) {
            console.error("Error al eliminar el plato:", error)
            alert("Error al eliminar el plato: " + error.message)
          }
        }
        
        // Función para buscar platos
        function searchPlatos() {
          const searchTerm = document.getElementById("searchPlato").value.toLowerCase()
        
          // Si no hay término de búsqueda, mostrar todos los platos
          if (!searchTerm.trim()) {
            renderPlatos(allPlatos)
            return
          }
        
          // Cargar los platos si aún no se han cargado
          if (!allPlatos || allPlatos.length === 0) {
            reloadPlatos()
            return
          }
        
          // Filtrar los platos por el término de búsqueda
          const filteredPlatos = allPlatos.filter((plato) => plato.Plato && plato.Plato.toLowerCase().includes(searchTerm))
        
          console.log(`Búsqueda: "${searchTerm}" - Resultados: ${filteredPlatos.length}`)
          renderPlatos(filteredPlatos)
        }
        
        // Función para renderizar los platos en la tabla
        function renderPlatos(platos) {
          const platosTableBody = document.getElementById("platosTableBody")
          platosTableBody.innerHTML = ""
        
          platos.forEach((plato) => {
            const row = document.createElement("tr")
        
            // Determinar la ruta de la imagen
            let imagePath = ""
            if (plato.Imagen) {
              // Si la imagen ya es una URL completa, usarla directamente
              if (plato.Imagen.startsWith("http")) {
                imagePath = plato.Imagen
              } else {
                // Si no, construir la ruta relativa
                imagePath = `img/${plato.Imagen}`
              }
            } else {
              // Imagen por defecto si no hay imagen
              imagePath = "img/placeholder.jpg"
            }
        
            row.innerHTML = `
              <td>${plato.ID}</td>
              <td>${plato.Plato}</td>
              <td>$${Number.parseFloat(plato.Precio).toFixed(2)}</td>
              <td>${plato.Categoria || ""}</td>
              <td class="text-center">
                <img src="${imagePath}" alt="${plato.Plato}" class="img-thumbnail" 
                     style="max-width: 80px; max-height: 80px;" onerror="this.src='img/placeholder.jpg'">
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2 btn-action" onclick="showPlatoForm('edit', ${plato.ID})" title="Editar">
                  <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-action" onclick="showDeleteConfirmation(${plato.ID}, '${plato.Plato.replace(/'/g, "\\'")}')" title="Eliminar">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </td>
            `
            platosTableBody.appendChild(row)
          })
        }
        
        // Función para recargar los platos
        async function reloadPlatos() {
          try {
            const platos = await window.electronAPI.getProducts()
            console.log(`Platos cargados: ${platos.length}`)
        
            // Guardar todos los platos para la búsqueda
            allPlatos = platos
        
            // Renderizar los platos
            renderPlatos(platos)
          } catch (error) {
            console.error("Error al cargar los platos:", error)
            alert("Error al cargar los platos: " +
              error.message)
            }
          }
          
          // Función para recargar la tabla de platos
          function reloadPlatosTable() {
            // Limpiar el campo de búsqueda
            document.getElementById("searchPlato").value = ""
          
            // Recargar todos los platos
            reloadPlatos()
          }

// Función para actualizar el dashboard
async function updateDashboard() {
  console.log("Starting dashboard update...")

  const startDateStr = document.getElementById("dashboardStartDate").value
  const endDateStr = document.getElementById("dashboardEndDate").value
  const today = localDateStr()

  if (!startDateStr || !endDateStr) {
    console.error("Dates not selected")
    alert("Por favor seleccione ambas fechas")
    return
  }

  // Formatear fechas para incluir el día completo
  const startDate = formatDateForSQL(startDateStr, false)
  const endDate = formatDateForSQL(endDateStr, true)

  console.log(`Updating dashboard with dates: ${startDate} to ${endDate}`)

  try {
    // Update cards
    try {
      console.log("Getting daily amount...")
      const dailyAmount = await window.electronAPI.getDailyAmount(today)
      const dailyAmountElement = document.getElementById("dailyAmount")
      if (dailyAmountElement) {
        dailyAmountElement.textContent = `$${Math.round(dailyAmount)}`
      }
      console.log(`Daily amount: $${Math.round(dailyAmount)}`)
    } catch (error) {
      console.error("Error getting daily amount:", error)
      document.getElementById("dailyAmount").textContent = "$0"
    }

    try {
      console.log("Getting monthly amount...")
      const monthlyAmount = await window.electronAPI.getMonthlyAmount(today)
      const monthlyAmountElement = document.getElementById("monthlyAmount")
      if (monthlyAmountElement) {
        monthlyAmountElement.textContent = `$${Math.round(monthlyAmount)}`
      }
      console.log(`Monthly amount: $${Math.round(monthlyAmount)}`)
    } catch (error) {
      console.error("Error getting monthly amount:", error)
      document.getElementById("monthlyAmount").textContent = "$0"
    }

    try {
      console.log("Getting most sold dish...")
      const mostSoldDish = await window.electronAPI.getMostSoldDish(startDate, endDate)
      const mostSoldDishElement = document.getElementById("mostSoldDish")
      const mostSoldDishAmountElement = document.getElementById("mostSoldDishAmount")

      if (mostSoldDishElement && mostSoldDishAmountElement) {
        mostSoldDishElement.textContent = mostSoldDish.Plato
        mostSoldDishAmountElement.textContent = `${mostSoldDish.CantidadTotal} unidades`
      }
      console.log(`Most sold dish: ${mostSoldDish.Plato} (${mostSoldDish.CantidadTotal} units)`)
    } catch (error) {
      console.error("Error getting most sold dish:", error)
      document.getElementById("mostSoldDish").textContent = "-"
      document.getElementById("mostSoldDishAmount").textContent = "0 unidades"
    }

    // NEW CARD: Most profitable dish
    try {
      console.log("Getting most profitable dish...")
      const mostProfitableDish = await getMostProfitableDish(startDate, endDate)
      const mostProfitableDishElement = document.getElementById("mostProfitableDish")
      const mostProfitableDishAmountElement = document.getElementById("mostProfitableDishAmount")

      if (mostProfitableDishElement && mostProfitableDishAmountElement) {
        mostProfitableDishElement.textContent = mostProfitableDish.Plato
        mostProfitableDishAmountElement.textContent = `$${Math.round(mostProfitableDish.TotalVendido)}`
      }
      console.log(`Most profitable dish: ${mostProfitableDish.Plato} ($${Math.round(mostProfitableDish.TotalVendido)})`)
    } catch (error) {
      console.error("Error getting most profitable dish:", error)
      document.getElementById("mostProfitableDish").textContent = "-"
      document.getElementById("mostProfitableDishAmount").textContent = "$0"
    }

    // NEW CARD: Day with highest sales
    try {
      console.log("Getting day with highest sales...")
      const highestSalesDay = await getDayWithHighestSales(startDate, endDate)
      const highestSalesDayElement = document.getElementById("highestSalesDay")
      const highestSalesDayAmountElement = document.getElementById("highestSalesDayAmount")

      if (highestSalesDayElement && highestSalesDayAmountElement) {
        highestSalesDayElement.textContent = highestSalesDay.Dia
        highestSalesDayAmountElement.textContent = `$${Math.round(highestSalesDay.Total)}`
      }
      console.log(`Day with highest sales: ${highestSalesDay.Dia} ($${Math.round(highestSalesDay.Total)})`)
    } catch (error) {
      console.error("Error getting day with highest sales:", error)
      document.getElementById("highestSalesDay").textContent = "-"
      document.getElementById("highestSalesDayAmount").textContent = "$0"
    }

    // NEW CARD: Most used payment method
    try {
      console.log("Getting most used payment method...")
      const mostUsedPayment = await getMostUsedPaymentMethod(startDate, endDate)
      const mostUsedPaymentElement = document.getElementById("mostUsedPayment")
      const mostUsedPaymentAmountElement = document.getElementById("mostUsedPaymentAmount")

      if (mostUsedPaymentElement && mostUsedPaymentAmountElement) {
        mostUsedPaymentElement.textContent = mostUsedPayment.FormaPago
        mostUsedPaymentAmountElement.textContent = `$${Math.round(mostUsedPayment.Total)}`
      }
      console.log(`Most used payment method: ${mostUsedPayment.FormaPago} ($${Math.round(mostUsedPayment.Total)})`)
    } catch (error) {
      console.error("Error getting most used payment method:", error)
      document.getElementById("mostUsedPayment").textContent = "-"
      document.getElementById("mostUsedPaymentAmount").textContent = "$0"
    }

    try {
      console.log("Getting cash amount...")
      const cashAmount = await window.electronAPI.getPaymentMethodAmount(startDate, endDate, "Efectivo")
      const cashAmountElement = document.getElementById("cashAmount")
      if (cashAmountElement) {
        cashAmountElement.textContent = `$${Math.round(cashAmount)}`
      }
      console.log(`Cash amount: $${Math.round(cashAmount)}`)
    } catch (error) {
      console.error("Error getting cash amount:", error)
      document.getElementById("cashAmount").textContent = "$0"
    }

    try {
      console.log("Getting mobile payment amount...")
      const mobilePaymentAmount = await window.electronAPI.getPaymentMethodAmount(startDate, endDate, "Pago Móvil")
      const mobilePaymentAmountElement = document.getElementById("mobilePaymentAmount")
      if (mobilePaymentAmountElement) {
        mobilePaymentAmountElement.textContent = `$${Math.round(mobilePaymentAmount)}`
      }
      console.log(`Mobile payment amount: $${Math.round(mobilePaymentAmount)}`)
    } catch (error) {
      console.error("Error getting mobile payment amount:", error)
      document.getElementById("mobilePaymentAmount").textContent = "$0"
    }

    try {
      console.log("Getting POS amount...")
      const posAmount = await window.electronAPI.getPaymentMethodAmount(startDate, endDate, "Punto de Venta")
      const posAmountElement = document.getElementById("posAmount")
      if (posAmountElement) {
        posAmountElement.textContent = `$${Math.round(posAmount)}`
      }
      console.log(`POS amount: $${Math.round(posAmount)}`)
    } catch (error) {
      console.error("Error getting POS amount:", error)
      document.getElementById("posAmount").textContent = "$0"
    }

    // Update charts
    console.log("Updating charts...")

    // Make sure Chart.js is loaded before updating charts
    if (!window.Chart) {
      console.log("Loading Chart.js before updating charts...")
      await loadChartJS()
    }

    // Actualizar cada gráfico con las fechas formateadas
    try {
      await updateDailySalesChart(startDate, endDate)
    } catch (error) {
      console.error("Error updating daily sales chart:", error)
    }

    try {
      await updatePaymentMethodsChart(startDate, endDate)
    } catch (error) {
      console.error("Error updating payment methods chart:", error)
    }

    try {
      await updateTopProductsChart(startDate, endDate)
    } catch (error) {
      console.error("Error updating top products chart:", error)
    }

    console.log("Dashboard updated successfully")
  } catch (error) {
    console.error("Error updating dashboard:", error)
    alert("Error al actualizar el dashboard: " + error.message)
  }
}

          
         // Función para mostrar el dashboard
async function showDashboard() {
  console.log("Initializing dashboard view")

  const mainContent = document.getElementById("mainContent")
  if (!mainContent) {
    console.error("mainContent element not found")
    alert("Error: No se encontró el elemento mainContent")
    return
  }

  // Obtener la fecha actual
  const today = new Date()
  const formattedToday = localDateStr(today)

  // Obtener el primer día del mes actual
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const formattedFirstDay = localDateStr(firstDayOfMonth)

  // Create dashboard HTML with updated cards and chart controls
  mainContent.innerHTML = `
    <div class="container-fluid">
      <h1 class="mb-4">Dashboard de Ventas</h1>
      
      <!-- Selectores de fecha -->
      <div class="row mb-4">
        <div class="col-md-6">
          <div class="input-group">
            <span class="input-group-text">Fecha Inicial</span>
            <input type="date" id="dashboardStartDate" class="form-control" value="${formattedFirstDay}">
          </div>
        </div>
        <div class="col-md-6">
          <div class="input-group">
            <span class="input-group-text">Fecha Final</span>
            <input type="date" id="dashboardEndDate" class="form-control" value="${formattedToday}">
            <button class="btn btn-primary" id="updateDashboardBtn">Actualizar</button>
          </div>
        </div>
      </div>
      
      <!-- Tarjetas de información -->
      <div class="row mb-4">
        <!-- Monto del Día -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-primary text-white" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Monto del Día</h6>
                  <h3 class="card-text fs-4" id="dailyAmount">$0</h3>
                </div>
                <i class="fas fa-calendar-day fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Monto del Mes -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-success text-white" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Monto del Mes</h6>
                  <h3 class="card-text fs-4" id="monthlyAmount">$0</h3>
                </div>
                <i class="fas fa-calendar-alt fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Plato más vendido -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-info text-white" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Plato más vendido</h6>
                  <h5 class="card-text fs-6" id="mostSoldDish">-</h5>
                  <small id="mostSoldDishAmount" class="fs-6">0 unidades</small>
                </div>
                <i class="fas fa-utensils fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- NUEVO: Plato más rentable -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-warning text-dark" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Plato más rentable</h6>
                  <h5 class="card-text fs-6" id="mostProfitableDish">-</h5>
                  <small id="mostProfitableDishAmount" class="fs-6">$0</small>
                </div>
                <i class="fas fa-money-bill-wave fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- NUEVO: Día de mayor venta -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-danger text-white" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Día de mayor venta</h6>
                  <h5 class="card-text fs-6" id="highestSalesDay">-</h5>
                  <small id="highestSalesDayAmount" class="fs-6">$0</small>
                </div>
                <i class="fas fa-trophy fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
        
        <!-- NUEVO: Forma de pago más utilizada -->
        <div class="col-md-4 col-lg-2 mb-3">
          <div class="card h-100 bg-secondary text-white" style="max-height: 120px;">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <h6 class="card-title fs-6">Forma de pago más usada</h6>
                  <h5 class="card-text fs-6" id="mostUsedPayment">-</h5>
                  <small id="mostUsedPaymentAmount" class="fs-6">$0</small>
                </div>
                <i class="fas fa-credit-card fa-2x"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Gráfico de líneas - Evolución de ventas diarias con controles de paginación -->
      <div class="row mb-4">
        <div class="col-12">
          <div class="card">
            <div class="card-header bg-light">
              <div class="d-flex justify-content-between align-items-center">
                <h5 class="card-title mb-0">Evolución de Ventas Diarias</h5>
                <div class="d-flex align-items-center">
                  <div class="input-group input-group-sm me-2" style="width: 200px;">
                    <span class="input-group-text">Días por página</span>
                    <select id="dailySalesPageSize" class="form-select" onchange="changeDailySalesPageSize()">
                      <option value="7">7</option>
                      <option value="14">14</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                      <option value="90">90</option>
                    </select>
                  </div>
                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" onclick="prevDailySalesPage()">
                      <i class="fas fa-chevron-left"></i>
                    </button>
                    <span class="btn btn-outline-secondary disabled">
                      Página <input type="number" id="dailySalesCurrentPage" value="1" min="1" 
                        style="width: 40px; border: none; text-align: center; background: transparent;"
                        onchange="changeDailySalesPageSize()"> 
                      de <span id="dailySalesTotalPages">1</span>
                    </span>
                    <button class="btn btn-outline-secondary" onclick="nextDailySalesPage()">
                      <i class="fas fa-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div style="height: 300px;">
                <canvas id="dailySalesChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Gráficos de torta y barras -->
      <div class="row">
        <!-- Gráfico de torta - Formas de pago -->
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header bg-light">
              <h5 class="card-title mb-0">Ventas por Forma de Pago</h5>
            </div>
            <div class="card-body">
              <div style="height: 300px;">
                <canvas id="paymentMethodsChart"></canvas>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Gráfico de barras - Top 10 productos -->
        <div class="col-md-6 mb-4">
          <div class="card h-100">
            <div class="card-header bg-light">
              <h5 class="card-title mb-0">Top 10 Productos Más Vendidos</h5>
            </div>
            <div class="card-body">
              <div style="height: 300px;">
                <canvas id="topProductsChart"></canvas>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `

  try {
    // First load Chart.js
    console.log("Loading Chart.js before continuing...")
    await loadChartJS()
    console.log("Chart.js loaded successfully")

    // Set up update button event listener
    const updateBtn = document.getElementById("updateDashboardBtn")
    if (updateBtn) {
      // Remove any existing event listeners to prevent duplicates
      const newUpdateBtn = updateBtn.cloneNode(true)
      updateBtn.parentNode.replaceChild(newUpdateBtn, updateBtn)

      newUpdateBtn.addEventListener("click", updateDashboard)
      console.log("Update button configured")
    }

    // Set up pagination controls
    window.prevDailySalesPage = prevDailySalesPage
    window.nextDailySalesPage = nextDailySalesPage
    window.changeDailySalesPageSize = changeDailySalesPageSize

    // Load initial dashboard data
    console.log("Loading initial dashboard data...")
    await updateDashboard()
    console.log("Dashboard initialized successfully")
  } catch (error) {
    console.error("Dashboard initialization failed:", error)
    alert(`Error initializing dashboard: ${error.message}`)

    // Show error in the dashboard area
    const chartContainers = document.querySelectorAll(".card-body div")
    chartContainers.forEach((container) => {
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle"></i> 
          Failed to load charts: ${error.message}
        </div>
      `
    })
  }
}
          
          // Functions to navigate through daily sales chart pages
function prevDailySalesPage() {
  const currentPage = Number.parseInt(document.getElementById("dailySalesCurrentPage").value) || 1
  if (currentPage > 1) {
    document.getElementById("dailySalesCurrentPage").value = currentPage - 1
    const startDate = document.getElementById("dashboardStartDate").value
    const endDate = document.getElementById("dashboardEndDate").value
    updateDailySalesChart(startDate, endDate)
  }
}

function nextDailySalesPage() {
  const currentPage = Number.parseInt(document.getElementById("dailySalesCurrentPage").value) || 1
  const totalPages = Number.parseInt(document.getElementById("dailySalesTotalPages").textContent) || 1
  if (currentPage < totalPages) {
    document.getElementById("dailySalesCurrentPage").value = currentPage + 1
    const startDate = document.getElementById("dashboardStartDate").value
    const endDate = document.getElementById("dashboardEndDate").value
    updateDailySalesChart(startDate, endDate)
  }
}

function changeDailySalesPageSize() {
  document.getElementById("dailySalesCurrentPage").value = 1 // Reset to first page
  const startDate = document.getElementById("dashboardStartDate").value
  const endDate = document.getElementById("dashboardEndDate").value
  updateDailySalesChart(startDate, endDate)
}
          
async function updatePaymentMethodsChart(startDate, endDate) {
  try {
    const paymentMethodsData = await window.electronAPI.getPaymentMethodsData(startDate, endDate)

    if (!paymentMethodsData || paymentMethodsData.length === 0) {
      const container = document.getElementById("paymentMethodsChart").parentNode
      container.innerHTML =
        '<div class="alert alert-info">No payment methods data available for the selected period</div>'
      return
    }

    const labels = paymentMethodsData.map((item) => item.FormaPago)
    const data = paymentMethodsData.map((item) => item.Total)

    // Ensure Chart.js is loaded
    if (!window.Chart) {
      await loadChartJS()
    }

    // Reset the chart
    const canvas = resetChart("paymentMethodsChart")
    if (!canvas) {
      throw new Error("Failed to reset payment methods chart canvas")
    }

    // Create the chart
    window.paymentMethodsChart = new Chart(canvas, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ventas por Forma de Pago",
            data: data,
            backgroundColor: [
              "rgba(255, 99, 132, 0.6)",
              "rgba(54, 162, 235, 0.6)",
              "rgba(255, 206, 86, 0.6)",
              "rgba(75, 192, 192, 0.6)",
              "rgba(153, 102, 255, 0.6)",
              "rgba(255, 159, 64, 0.6)",
            ],
            borderColor: [
              "rgba(255, 99, 132, 1)",
              "rgba(54, 162, 235, 1)",
              "rgba(255, 206, 86, 1)",
              "rgba(75, 192, 192, 1)",
              "rgba(153, 102, 255, 1)",
              "rgba(255, 159, 64, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || ""
                const value = context.parsed || 0
                const total = data.reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? Math.round((value / total) * 100) : 0
                return `${label}: $${Math.round(value)} (${percentage}%)`
              },
            },
          },
        },
      },
    })
  } catch (error) {
    console.error("Error updating payment methods chart:", error)
    const container = document.getElementById("paymentMethodsChart")
    if (container && container.parentNode) {
      container.parentNode.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle"></i> 
          Error loading chart: ${error.message}
        </div>
      `
    }
  }
}

          async function updateDailySalesChart(startDate, endDate) {
            console.log(`Updating daily sales chart (${startDate} to ${endDate})`)
          
            try {
              // Get data from backend
              const dailySalesData = await window.electronAPI.getDailySalesData(startDate, endDate)
              console.log(`Received ${dailySalesData.length} data points for daily sales chart`)
          
              if (!dailySalesData || dailySalesData.length === 0) {
                console.log("No daily sales data available")
                const container = document.getElementById("dailySalesChart").parentNode
                container.innerHTML = '<div class="alert alert-info">No sales data available for the selected period</div>'
                return
              }
          
              // Store the full dataset in a global variable for pagination
              window.fullDailySalesData = dailySalesData
          
              // Get pagination settings
              const pageSize = Number.parseInt(document.getElementById("dailySalesPageSize").value) || 7
              const currentPage = Number.parseInt(document.getElementById("dailySalesCurrentPage").value) || 1
          
              // Calculate total pages
              const totalPages = Math.ceil(dailySalesData.length / pageSize)
              document.getElementById("dailySalesTotalPages").textContent = totalPages
          
              // Adjust current page if needed
              const adjustedCurrentPage = Math.min(currentPage, totalPages)
              document.getElementById("dailySalesCurrentPage").value = adjustedCurrentPage
          
              // Calculate start and end indices for the current page
              const startIndex = (adjustedCurrentPage - 1) * pageSize
              const endIndex = Math.min(startIndex + pageSize, dailySalesData.length)
          
              // Get the data for the current page
              const paginatedData = dailySalesData.slice(startIndex, endIndex)
          
              // Log the data to help debug
              console.log(`Showing daily sales data from index ${startIndex} to ${endIndex - 1}`)
              console.log("Paginated data:", JSON.stringify(paginatedData.slice(0, 3)))
          
              // Prepare chart data
              const labels = paginatedData.map((item) => {
                const date = parseLocalDate(item.Dia)
                return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
              })
              const data = paginatedData.map((item) => item.Total)
          
              console.log("Chart labels:", labels)
              console.log("Chart data:", data)
          
              // Ensure Chart.js is loaded
              if (!window.Chart) {
                console.log("Chart.js not available, loading now...")
                await loadChartJS()
              }
          
              // Reset the chart completely
              const canvas = resetChart("dailySalesChart")
              if (!canvas) {
                throw new Error("Failed to reset daily sales chart canvas")
              }
          
              // Create new chart with a try-catch block
              try {
                console.log("Creating new daily sales chart")
                window.dailySalesChart = new Chart(canvas, {
                  type: "line",
                  data: {
                    labels: labels,
                    datasets: [
                      {
                        label: "Ventas Diarias",
                        data: data,
                        borderColor: "rgb(75, 192, 192)",
                        backgroundColor: "rgba(75, 192, 192, 0.2)",
                        tension: 0.1,
                        fill: true,
                      },
                    ],
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => "$" + Math.round(value),
                        },
                      },
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (context) => "$" + Math.round(context.parsed.y),
                        },
                      },
                    },
                  },
                })
                console.log("Daily sales chart created successfully")
              } catch (chartError) {
                console.error("Error creating daily sales chart:", chartError)
          
                // Fallback to a simple HTML representation if Chart.js fails
                const container = canvas.parentNode
                if (container) {
                  let htmlTable = `
                    <div class="alert alert-warning">
                      <p><i class="fas fa-exclamation-triangle"></i> No se pudo crear el gráfico. Mostrando datos en formato de tabla:</p>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                      <table class="table table-sm table-striped">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                  `
          
                  for (let i = 0; i < labels.length; i++) {
                    htmlTable += `
                      <tr>
                        <td>${labels[i]}</td>
                        <td>$${Math.round(data[i])}</td>
                      </tr>
                    `
                  }
          
                  htmlTable += `
                        </tbody>
                      </table>
                    </div>
                  `
          
                  container.innerHTML = htmlTable
                }
          
                throw chartError
              }
          
              console.log("Daily sales chart updated successfully")
            } catch (error) {
              console.error("Failed to update daily sales chart:", error)
              const container = document.getElementById("dailySalesChart")
              if (container && container.parentNode) {
                container.parentNode.innerHTML = `
                  <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Error loading chart: ${error.message}
                  </div>
                `
              }
            }
          }
          
          // Replace the updatePaymentMethodsChart function with this improved version
          async function updatePaymentMethodsChart(startDate, endDate) {
            console.log(`Updating payment methods chart (${startDate} to ${endDate})`)
          
            try {
              const paymentMethodsData = await window.electronAPI.getPaymentMethodsData(startDate, endDate)
              console.log(`Received ${paymentMethodsData.length} payment methods for chart`)
          
              if (!paymentMethodsData || paymentMethodsData.length === 0) {
                console.log("No payment methods data available")
                const container = document.getElementById("paymentMethodsChart").parentNode
                container.innerHTML = '<div class="alert alert-info">No payment data available for the selected period</div>'
                return
              }
          
              // Log the data to help debug
              console.log("Payment methods data:", JSON.stringify(paymentMethodsData))
          
              const labels = paymentMethodsData.map((item) => item.FormaPago)
              const data = paymentMethodsData.map((item) => item.Total)
          
              // Colores para el gráfico de torta
              const backgroundColors = [
                "rgba(255, 99, 132, 0.7)",
                "rgba(54, 162, 235, 0.7)",
                "rgba(255, 206, 86, 0.7)",
                "rgba(75, 192, 192, 0.7)",
                "rgba(153, 102, 255, 0.7)",
              ]
          
              // Ensure Chart.js is loaded
              if (!window.Chart) {
                console.log("Chart.js not available, loading now...")
                await loadChartJS()
              }
          
              // Reset the chart completely
              const canvas = resetChart("paymentMethodsChart")
              if (!canvas) {
                throw new Error("Failed to reset payment methods chart canvas")
              }
          
              // Create new chart with a try-catch block
              try {
                console.log("Creating new payment methods chart")
                window.paymentMethodsChart = new Chart(canvas, {
                  type: "pie",
                  data: {
                    labels: labels,
                    datasets: [
                      {
                        data: data,
                        backgroundColor: backgroundColors,
                        borderWidth: 1,
                      },
                    ],
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.label || ""
                            const value = context.parsed || 0
                            const total = context.dataset.data.reduce((a, b) => a + b, 0)
                            const percentage = Math.round((value / total) * 100)
                            return `${label}: $${Math.round(value)} (${percentage}%)`
                          },
                        },
                      },
                    },
                  },
                })
                console.log("Payment methods chart created successfully")
              } catch (chartError) {
                console.error("Error creating payment methods chart:", chartError)
          
                // Fallback to a simple HTML representation if Chart.js fails
                const container = canvas.parentNode
                if (container) {
                  let htmlTable = `
                    <div class="alert alert-warning">
                      <p><i class="fas fa-exclamation-triangle"></i> No se pudo crear el gráfico. Mostrando datos en formato de tabla:</p>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                      <table class="table table-sm table-striped">
                        <thead>
                          <tr>
                            <th>Forma de Pago</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                  `
          
                  const total = data.reduce((a, b) => a + b, 0)
          
                  for (let i = 0; i < labels.length; i++) {
                    const percentage = Math.round((data[i] / total) * 100)
                    htmlTable += `
                      <tr>
                        <td>${labels[i]}</td>
                        <td>$${Math.round(data[i])} (${percentage}%)</td>
                      </tr>
                    `
                  }
          
                  htmlTable += `
                        </tbody>
                      </table>
                    </div>
                  `
          
                  container.innerHTML = htmlTable
                }
          
                throw chartError
              }
          
              console.log("Payment methods chart updated successfully")
            } catch (error) {
              console.error("Failed to update payment methods chart:", error)
              const container = document.getElementById("paymentMethodsChart")
              if (container && container.parentNode) {
                container.parentNode.innerHTML = `
                  <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Error loading chart: ${error.message}
                  </div>
                `
              }
            }
          }
          
          async function updateTopProductsChart(startDate, endDate) {
            try {
              const topProductsData = await window.electronAPI.getTopProductsData(startDate, endDate)
          
              if (!topProductsData || topProductsData.length === 0) {
                const container = document.getElementById("topProductsChart").parentNode
                container.innerHTML = '<div class="alert alert-info">No top products data available for the selected period</div>'
                return
              }
          
              const labels = topProductsData.map((item) => item.Plato)
              const data = topProductsData.map((item) => item.CantidadTotal)
          
              // Ensure Chart.js is loaded
              if (!window.Chart) {
                await loadChartJS()
              }
          
              // Reset the chart
              const canvas = resetChart("topProductsChart")
              if (!canvas) {
                throw new Error("Failed to reset top products chart canvas")
              }
          
              // Create the chart
              window.topProductsChart = new Chart(canvas, {
                type: "bar",
                data: {
                  labels: labels,
                  datasets: [
                    {
                      label: "Cantidad Vendida",
                      data: data,
                      backgroundColor: "rgba(54, 162, 235, 0.6)",
                      borderColor: "rgba(54, 162, 235, 1)",
                      borderWidth: 1,
                    },
                  ],
                },
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => Math.round(value),
                      },
                    },
                  },
                  plugins: {
                    tooltip: {
                      callbacks: {
                        label: (context) => `Cantidad: ${Math.round(context.parsed.y)}`,
                      },
                    },
                  },
                },
              })
            } catch (error) {
              console.error("Error updating top products chart:", error)
              const container = document.getElementById("topProductsChart")
              if (container && container.parentNode) {
                container.parentNode.innerHTML = `
                  <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Error loading chart: ${error.message}
                  </div>
                `
              }
            }
          }

async function loadChartJS() {
  console.log("Attempting to load Chart.js...")

  return new Promise((resolve, reject) => {
    // Check if Chart.js is already loaded and working
    if (window.Chart && typeof window.Chart === "function") {
      console.log("Chart.js is already available and functional")
      resolve(window.Chart)
      return
    }

    // Clear any existing Chart variable that might be invalid
    window.Chart = undefined

    // Define multiple CDN sources as fallbacks
    const cdnSources = [
      "vendor/chart.min.js", // copia local (funciona sin internet)
      "https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js",
      "https://unpkg.com/chart.js@3.9.1/dist/chart.min.js",
    ]

    // Try to load from each source until one succeeds
    let currentSourceIndex = 0

    const tryLoadScript = () => {
      if (currentSourceIndex >= cdnSources.length) {
        // All sources failed
        const error = new Error(
          "Failed to load Chart.js from all sources. Check your internet connection or try including Chart.js locally.",
        )
        console.error(error)
        reject(error)
        return
      }

      const currentSource = cdnSources[currentSourceIndex]
      console.log(
        `Trying to load Chart.js from source ${currentSourceIndex + 1}/${cdnSources.length}: ${currentSource}`,
      )

      try {
        const script = document.createElement("script")
        script.src = currentSource
        script.crossOrigin = "anonymous"

        script.onload = () => {
          console.log(`Chart.js script loaded from ${currentSource}`)

          // Verify Chart.js is actually working
          if (window.Chart && typeof window.Chart === "function") {
            console.log("Chart.js loaded successfully and is functional")
            resolve(window.Chart)
          } else {
            console.warn(
              `Chart.js loaded from ${currentSource} but window.Chart is not a function, trying next source...`,
            )
            currentSourceIndex++
            tryLoadScript()
          }
        }

        script.onerror = (error) => {
          console.warn(`Failed to load Chart.js from ${currentSource}, trying next source...`, error)
          currentSourceIndex++
          tryLoadScript()
        }

        document.head.appendChild(script)
      } catch (error) {
        console.warn(`Error loading Chart.js from ${currentSource}:`, error)
        currentSourceIndex++
        tryLoadScript()
      }
    }

    // Start trying to load from the first source
    tryLoadScript()
  })
}

function resetChart(chartId) {
  console.log(`Resetting chart: ${chartId}`)

  // Clear any global chart reference
  if (window[chartId]) {
    try {
      if (typeof window[chartId].destroy === "function") {
        console.log(`Destroying existing ${chartId} instance`)
        window[chartId].destroy()
      } else {
        console.log(`${chartId} exists but doesn't have a destroy method`)
      }
    } catch (error) {
      console.error(`Error destroying ${chartId}:`, error)
    }

    // Clear the reference regardless of whether destroy worked
    window[chartId] = null
  }

  // Replace the canvas element with a fresh one
  const canvas = document.getElementById(chartId)
  if (canvas) {
    const parent = canvas.parentNode
    if (parent) {
      console.log(`Replacing canvas for ${chartId}`)
      // Create a new canvas with the same ID
      const newCanvas = document.createElement("canvas")
      newCanvas.id = chartId
      // Remove the old canvas
      parent.removeChild(canvas)
      // Add the new canvas
      parent.appendChild(newCanvas)
      return newCanvas
    } else {
      console.error(`Parent node not found for ${chartId}`)
    }
  } else {
    console.error(`Canvas element not found: ${chartId}`)
  }

  return null
}

// Add these new functions to get the data for the new cards
async function getMostProfitableDish(startDate, endDate) {
  try {
    const topProductsData = await window.electronAPI.getTopProductsData(startDate, endDate)
    if (!topProductsData || topProductsData.length === 0) {
      return { Plato: "-", TotalVendido: 0 }
    }

    // Sort by total sold amount to find the most profitable dish
    topProductsData.sort((a, b) => b.TotalVendido - a.TotalVendido)
    return topProductsData[0]
  } catch (error) {
    console.error("Error getting most profitable dish:", error)
    return { Plato: "-", TotalVendido: 0 }
  }
}

async function getDayWithHighestSales(startDate, endDate) {
  try {
    const dailySalesData = await window.electronAPI.getDailySalesData(startDate, endDate)
    if (!dailySalesData || dailySalesData.length === 0) {
      return { Dia: "-", Total: 0 }
    }

    // Sort by total to find the day with highest sales
    dailySalesData.sort((a, b) => b.Total - a.Total)

    // Format the date for display
    const highestDay = dailySalesData[0]
    const date = parseLocalDate(highestDay.Dia)
    const formattedDate = date.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    return {
      Dia: formattedDate,
      Total: highestDay.Total,
    }
  } catch (error) {
    console.error("Error getting day with highest sales:", error)
    return { Dia: "-", Total: 0 }
  }
}

async function getMostUsedPaymentMethod(startDate, endDate) {
  try {
    const paymentMethodsData = await window.electronAPI.getPaymentMethodsData(startDate, endDate)
    if (!paymentMethodsData || paymentMethodsData.length === 0) {
      return { FormaPago: "-", Total: 0 }
    }

    // Sort by total to find the most used payment method
    paymentMethodsData.sort((a, b) => b.Total - a.Total)
    return paymentMethodsData[0]
  } catch (error) {
    console.error("Error getting most used payment method:", error)
    return { FormaPago: "-", Total: 0 }
  }
}

// Functions to navigate through daily sales chart pages
function prevDailySalesPage() {
  const currentPage = Number.parseInt(document.getElementById("dailySalesCurrentPage").value) || 1
  if (currentPage > 1) {
    document.getElementById("dailySalesCurrentPage").value = currentPage - 1
    const startDate = document.getElementById("dashboardStartDate").value
    const endDate = document.getElementById("dashboardEndDate").value
    updateDailySalesChart(startDate, endDate)
  }
}

function nextDailySalesPage() {
  const currentPage = Number.parseInt(document.getElementById("dailySalesCurrentPage").value) || 1
  const totalPages = Number.parseInt(document.getElementById("dailySalesTotalPages").textContent) || 1
  if (currentPage < totalPages) {
    document.getElementById("dailySalesCurrentPage").value = currentPage + 1
    const startDate = document.getElementById("dashboardStartDate").value
    const endDate = document.getElementById("dashboardEndDate").value
    updateDailySalesChart(startDate, endDate)
  }
}

function changeDailySalesPageSize() {
  document.getElementById("dailySalesCurrentPage").value = 1 // Reset to first page
  const startDate = document.getElementById("dashboardStartDate").value
  const endDate = document.getElementById("dashboardEndDate").value
  updateDailySalesChart(startDate, endDate)
}
          
          
          // Exponer funciones al ámbito global para que puedan ser llamadas desde HTML
          window.showHome = showHome
          window.showTicketDetails = showTicketDetails
          window.showPaymentMethodsReportModal = showPaymentMethodsReportModal
          window.showProductSales = showProductSales
          window.displayPaymentMethods = displayPaymentMethods
          window.showDailySales = showDailySales
          window.showTopSellingProducts = showTopSellingProducts
          window.showSalesByPaymentMethod = showSalesByPaymentMethod
          window.showExportOptions = showExportOptions
          window.exportToCSV = exportToCSV
          window.exportToExcelXML = exportToExcelXML
          window.exitApplication = exitApplication
          window.addToCart = addToCart
          window.removeFromCart = removeFromCart
          window.displayCart = displayCart
          window.acceptPurchase = acceptPurchase
          window.printReceipt = printReceipt
          window.changePage = changePage
          window.filterProducts = filterProducts
          window.log = log
          window.showPlatosModal = showPlatosModal
          window.showGeneralSalesModal = showGeneralSalesModal
          window.showProductSalesReportModal = showProductSalesReportModal
          window.showPaymentMethodsReportModal = showPaymentMethodsReportModal
          window.generateGeneralSalesReport = generateGeneralSalesReport
          window.generateProductSalesReport = generateProductSalesReport
          window.generatePaymentMethodsReport = generatePaymentMethodsReport
          window.editPlato = editPlato
          window.deletePlato = deletePlato
          window.clearForm = clearForm
          window.loadPlatos = loadPlatos
          window.showPlatoForm = showPlatoForm
          window.savePlato = savePlato
          window.showDeleteConfirmation = showDeleteConfirmation
          window.confirmDelete = confirmDelete
          window.searchPlatos = searchPlatos
          window.reloadPlatosTable = reloadPlatosTable
          window.selectImage = selectImage
          window.clearCart = clearCart
          window.generateTicketNumber = generateTicketNumber
          // Exponer funciones al ámbito global
          window.showDashboard = showDashboard;
          window.updateDashboard = updateDashboard;
          window.loadChartJS = loadChartJS;
          
          // Definir la variable bootstrap para acceder a los modales
          const bootstrap = window.bootstrap
          const jQuery = window.jQuery