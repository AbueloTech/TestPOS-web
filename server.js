// Terreno Broaster POS - servidor web (Express + SQLite vía sql.js)
// Reemplaza a main.js de Electron: cada handler IPC pasó a ser un "canal" en /api/invoke/:canal
const express = require("express")
const initSqlJs = require("sql.js")
const fs = require("fs")
const path = require("path")

const PORT = process.env.PORT || 3000
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data")
const DB_PATH = path.join(DATA_DIR, "TerrenoBroaster.db")
const PUBLIC_DIR = path.join(__dirname, "public")
const IMG_DIR = path.join(PUBLIC_DIR, "img")
const BACKUP_DIR = path.join(DATA_DIR, "backups")

let db

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------
async function openDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`No se encontró la base de datos en ${DB_PATH}`)
  }
  const SQL = await initSqlJs()
  db = new SQL.Database(fs.readFileSync(DB_PATH))

  for (const t of ["Platos", "Ventas", "Tickets"]) {
    if (!get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [t])) {
      throw new Error(`La tabla '${t}' no existe en la base de datos`)
    }
  }
  dailyBackup()
}

function persist() {
  // Escritura atómica: archivo temporal + rename, para no corromper la BD si se corta la luz
  const tmp = DB_PATH + ".tmp"
  fs.writeFileSync(tmp, Buffer.from(db.export()))
  fs.renameSync(tmp, DB_PATH)
}

function dailyBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const stamp = localDate().replace(/-/g, "")
    const target = path.join(BACKUP_DIR, `TerrenoBroaster-${stamp}.db`)
    if (!fs.existsSync(target)) fs.copyFileSync(DB_PATH, target)
    const old = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".db"))
      .sort()
      .slice(0, -14) // conserva los últimos 14 respaldos
    old.forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)))
  } catch (e) {
    console.warn("No se pudo crear el respaldo diario:", e.message)
  }
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

function get(sql, params = []) {
  return all(sql, params)[0]
}

function run(sql, params = []) {
  db.run(sql, params)
  return { changes: db.getRowsModified(), lastID: get("SELECT last_insert_rowid() AS id").id }
}

// Ejecuta fn dentro de una transacción y guarda en disco al terminar
function transaction(fn) {
  db.exec("BEGIN")
  try {
    const result = fn()
    db.exec("COMMIT")
    persist()
    return result
  } catch (err) {
    try {
      db.exec("ROLLBACK")
    } catch (_) {}
    throw err
  }
}

function mutate(fn) {
  const result = fn()
  persist()
  return result
}

// ---------------------------------------------------------------------------
// Utilidades de fechas
// ---------------------------------------------------------------------------
function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Rango [inicio, día siguiente al fin) para incluir todo el día final
function dateRange(startDate, endDate) {
  const d = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return [String(startDate), d.toISOString().slice(0, 10)]
}

const NUEVO_ESTADO = "Completado"

// ---------------------------------------------------------------------------
// Lógica de ventas / tickets
// ---------------------------------------------------------------------------
function insertVenta(v) {
  run(
    `INSERT INTO Ventas (Fecha, NTicket, Plato, Precio, Cantidad, Iva, Importe, FormaPago, Estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.Fecha, v.NTicket, v.Plato, v.Precio, v.Cantidad, 0, v.Importe, v.FormaPago, NUEVO_ESTADO],
  )
  return get("SELECT last_insert_rowid() AS id").id
}

// Crea el ticket o, si ya existe, le suma el importe
function upsertTicket({ Fecha, NTicket, Cliente, FormaPago }, importe) {
  const existing = get("SELECT IdTicket FROM Tickets WHERE NTicket = ?", [NTicket])
  if (existing) {
    run("UPDATE Tickets SET SubTotal = SubTotal + ?, Monto = Monto + ? WHERE NTicket = ?", [importe, importe, NTicket])
    return existing.IdTicket
  }
  // Tickets.Estado y Tickets.Fpago son NOT NULL en esta base de datos
  return run(
    `INSERT INTO Tickets (Fecha, NTicket, Cliente, SubTotal, Iva, Monto, Fpago, Estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [Fecha, NTicket, Cliente || "Cliente General", importe, 0, importe, FormaPago || "Efectivo", NUEVO_ESTADO],
  ).lastID
}

function nextTicketNumber() {
  // Usa el mayor número entre Tickets y Ventas para no repetir nunca un ticket
  const row = get(
    `SELECT MAX(
       COALESCE((SELECT MAX(NTicket) FROM Tickets), 0),
       COALESCE((SELECT MAX(NTicket) FROM Ventas), 0)
     ) AS last`,
  )
  const last = Number(row && row.last) || 0
  return last >= 1000 ? last + 1 : 1000
}

// ---------------------------------------------------------------------------
// Canales (equivalentes a los ipcMain.handle de main.js)
// ---------------------------------------------------------------------------
const handlers = {
  // --- Platos ---
  "get-products": () => all("SELECT * FROM Platos"),
  "get-platos": () => all("SELECT * FROM Platos"),
  "get-plato": (id) => get("SELECT * FROM Platos WHERE ID = ?", [id]) || null,
  "create-plato": (p) =>
    mutate(() => ({
      id: run("INSERT INTO Platos (Plato, Precio, Categoria, Imagen) VALUES (?, ?, ?, ?)", [
        p.Plato,
        p.Precio,
        p.Categoria,
        p.Imagen || "",
      ]).lastID,
    })),
  "update-plato": (p) =>
    mutate(() => ({
      changes: run("UPDATE Platos SET Plato = ?, Precio = ?, Categoria = ?, Imagen = ? WHERE ID = ?", [
        p.Plato,
        p.Precio,
        p.Categoria,
        p.Imagen || "",
        p.ID,
      ]).changes,
    })),
  "delete-plato": (id) => mutate(() => ({ changes: run("DELETE FROM Platos WHERE ID = ?", [id]).changes })),

  // --- Ventas ---
  "save-venta": (venta) =>
    transaction(() => {
      const ticketId = upsertTicket(venta, venta.Importe)
      const ventaId = insertVenta(venta)
      return { success: true, ventaId, ticketId }
    }),
  "save-ventas": (ventas) => {
    if (!Array.isArray(ventas) || ventas.length === 0) return { success: true }
    return transaction(() => {
      const total = ventas.reduce((s, v) => s + Number(v.Importe || 0), 0)
      const { Fecha, NTicket, Cliente, FormaPago } = ventas[0]
      upsertTicket({ Fecha, NTicket, Cliente, FormaPago }, total)
      ventas.forEach(insertVenta)
      return { success: true }
    })
  },
  "save-sale": (sale) =>
    mutate(() => ({
      success: true,
      id: insertVenta({
        Fecha: sale.date,
        NTicket: sale.ticketNumber,
        Plato: sale.productName,
        Precio: sale.price,
        Cantidad: sale.quantity,
        Importe: sale.importe,
        FormaPago: sale.paymentMethod,
      }),
    })),

  "get-sales-history": () => all("SELECT * FROM Ventas ORDER BY Fecha DESC"),
  "get-sales-by-payment-method": () => all("SELECT FormaPago, SUM(Importe) AS Total FROM Ventas GROUP BY FormaPago"),
  "get-daily-sales": () => get("SELECT SUM(Importe) AS Total FROM Ventas WHERE Fecha LIKE ?", [localDate() + "%"]),
  "get-top-selling-products": () =>
    all(
      `SELECT Plato, SUM(Cantidad) AS CantidadTotal, SUM(Importe) AS TotalVendido
       FROM Ventas GROUP BY Plato ORDER BY CantidadTotal DESC`,
    ),

  "get-last-ticket-number": () => nextTicketNumber(),
  getLastTicketNumber: () => nextTicketNumber(),

  // --- Historial de ventas (una fila por ticket) ---
  "get-tickets-report": (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return all(
      `SELECT t.*, (SELECT COUNT(*) FROM Ventas v WHERE v.NTicket = t.NTicket) AS Items
       FROM Tickets t WHERE t.Fecha >= ? AND t.Fecha < ?
       ORDER BY t.Fecha DESC, t.NTicket DESC`,
      [a, b],
    )
  },
  "get-ticket-details": (nticket) => ({
    ticket: get("SELECT * FROM Tickets WHERE NTicket = ?", [nticket]) || null,
    items: all("SELECT * FROM Ventas WHERE NTicket = ? ORDER BY IDVenta", [nticket]),
  }),

  // --- Reportes ---
  "get-general-sales-report": (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return all("SELECT * FROM Ventas WHERE Fecha >= ? AND Fecha < ? ORDER BY Fecha DESC", [a, b])
  },
  "get-product-sales-report": (startDate, endDate, plato) => {
    const [a, b] = dateRange(startDate, endDate)
    const params = [a, b]
    let sql = `SELECT Plato, SUM(Cantidad) AS CantidadTotal, SUM(Importe) AS TotalVendido
               FROM Ventas WHERE Fecha >= ? AND Fecha < ?`
    if (plato) {
      sql += " AND Plato = ?"
      params.push(plato)
    }
    return all(sql + " GROUP BY Plato ORDER BY TotalVendido DESC", params)
  },
  "get-payment-methods-report": (startDate, endDate, formaPago) => {
    const [a, b] = dateRange(startDate, endDate)
    const params = [a, b]
    let sql = `SELECT FormaPago, SUM(Importe) AS Total FROM Ventas WHERE Fecha >= ? AND Fecha < ?`
    if (formaPago) {
      sql += " AND FormaPago = ?"
      params.push(formaPago)
    }
    return all(sql + " GROUP BY FormaPago ORDER BY Total DESC", params)
  },

  // --- Dashboard ---
  getDailyAmount: (date) => {
    const row = get("SELECT SUM(Importe) AS Total FROM Ventas WHERE date(Fecha) = date(?)", [date])
    return (row && row.Total) || 0
  },
  getMonthlyAmount: (date) => {
    const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`)
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    const row = get("SELECT SUM(Importe) AS Total FROM Ventas WHERE date(Fecha) >= date(?) AND date(Fecha) <= date(?)", [
      first,
      last,
    ])
    return (row && row.Total) || 0
  },
  getMostSoldDish: (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return (
      get(
        `SELECT Plato, SUM(Cantidad) AS CantidadTotal, SUM(Importe) AS TotalVendido
         FROM Ventas WHERE Fecha >= ? AND Fecha < ?
         GROUP BY Plato ORDER BY CantidadTotal DESC LIMIT 1`,
        [a, b],
      ) || { Plato: "Ninguno", CantidadTotal: 0, TotalVendido: 0 }
    )
  },
  getPaymentMethodAmount: (startDate, endDate, paymentMethod) => {
    const [a, b] = dateRange(startDate, endDate)
    const row = get("SELECT SUM(Importe) AS Total FROM Ventas WHERE Fecha >= ? AND Fecha < ? AND FormaPago = ?", [
      a,
      b,
      paymentMethod,
    ])
    return (row && row.Total) || 0
  },
  getDailySalesData: (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return all(
      `SELECT date(Fecha) AS Dia, SUM(Importe) AS Total FROM Ventas
       WHERE Fecha >= ? AND Fecha < ? GROUP BY date(Fecha) ORDER BY date(Fecha)`,
      [a, b],
    )
  },
  getPaymentMethodsData: (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return all(
      `SELECT FormaPago, SUM(Importe) AS Total FROM Ventas
       WHERE Fecha >= ? AND Fecha < ? GROUP BY FormaPago ORDER BY Total DESC`,
      [a, b],
    )
  },
  getTopProductsData: (startDate, endDate) => {
    const [a, b] = dateRange(startDate, endDate)
    return all(
      `SELECT Plato, SUM(Cantidad) AS CantidadTotal, SUM(Importe) AS TotalVendido FROM Ventas
       WHERE Fecha >= ? AND Fecha < ? GROUP BY Plato ORDER BY TotalVendido DESC LIMIT 10`,
      [a, b],
    )
  },

  // --- Utilidades (en web son no-ops compatibles) ---
  "ensure-img-folder": () => {
    fs.mkdirSync(IMG_DIR, { recursive: true })
    return "img"
  },
  "get-app-path": () => "",
  "check-image-exists": (imagePath) => {
    const full = path.resolve(PUBLIC_DIR, String(imagePath || ""))
    return full.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(full)
  },
}

// ---------------------------------------------------------------------------
// Exportaciones (CSV / Excel XML) -> se descargan desde el navegador
// ---------------------------------------------------------------------------
const COLS = ["IDVenta", "Fecha", "NTicket", "Plato", "Precio", "Cantidad", "Iva", "Importe", "FormaPago"]

const csvCell = (v) => {
  const s = v == null ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const xmlEsc = (v) =>
  String(v == null ? "" : v).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])

function buildCSV() {
  const rows = all("SELECT * FROM Ventas ORDER BY Fecha DESC")
  const lines = [COLS.join(",")].concat(rows.map((r) => COLS.map((c) => csvCell(r[c])).join(",")))
  return "﻿" + lines.join("\r\n") + "\r\n" // BOM para que Excel lea bien los acentos
}

function buildExcelXML() {
  const rows = all("SELECT * FROM Ventas ORDER BY Fecha DESC")
  const num = new Set(["IDVenta", "NTicket", "Precio", "Cantidad", "Iva", "Importe"])
  const cell = (c, v) =>
    `<Cell><Data ss:Type="${num.has(c) && v !== null && v !== "" ? "Number" : "String"}">${xmlEsc(v)}</Data></Cell>`
  let xml = '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>'
  xml +=
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
  xml += '<Worksheet ss:Name="Ventas"><Table><Row>'
  xml += COLS.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")
  xml += "</Row>"
  rows.forEach((r) => {
    xml += "<Row>" + COLS.map((c) => cell(c, r[c])).join("") + "</Row>"
  })
  return xml + "</Table></Worksheet></Workbook>"
}

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------
const app = express()

// Protección opcional con usuario/clave: POS_USER=admin POS_PASS=secreto node server.js
if (process.env.POS_USER && process.env.POS_PASS) {
  const expected = "Basic " + Buffer.from(`${process.env.POS_USER}:${process.env.POS_PASS}`).toString("base64")
  app.use((req, res, next) => {
    if (req.headers.authorization === expected) return next()
    res.set("WWW-Authenticate", 'Basic realm="Terreno Broaster POS"').status(401).send("Autenticación requerida")
  })
}

app.use(express.json({ limit: "1mb" }))

app.post("/api/invoke/:channel", (req, res) => {
  const handler = handlers[req.params.channel]
  if (!handler) return res.status(404).json({ error: `Canal desconocido: ${req.params.channel}` })
  try {
    const args = Array.isArray(req.body && req.body.args) ? req.body.args : []
    const result = handler(...args)
    res.json({ result: result === undefined ? null : result })
  } catch (err) {
    console.error(`[${req.params.channel}]`, err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get("/api/export/csv", (req, res) => {
  res
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ventas_terreno_broaster.csv"',
    })
    .send(buildCSV())
})

app.get("/api/export/excel", (req, res) => {
  res
    .set({
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ventas_terreno_broaster.xls"',
    })
    .send(buildExcelXML())
})

// Subida de imágenes de platos (cuerpo binario crudo, nombre en ?name=)
app.post("/api/upload-image", express.raw({ type: "*/*", limit: "10mb" }), (req, res) => {
  try {
    const name = path.basename(String(req.query.name || "")).replace(/[\\/:*?"<>|]/g, "_")
    if (!/\.(jpe?g|png|gif|webp)$/i.test(name)) return res.status(400).json({ error: "Formato de imagen no permitido" })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Archivo vacío" })
    fs.mkdirSync(IMG_DIR, { recursive: true })
    fs.writeFileSync(path.join(IMG_DIR, name), req.body)
    res.json({ success: true, fileName: name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Solo se sirve la carpeta public/ (la base de datos y el servidor quedan fuera)
app.use(express.static(PUBLIC_DIR))

openDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log("==============================================")
      console.log(" Terreno Broaster POS (web)")
      console.log(` Abre:  http://localhost:${PORT}`)
      console.log(` BD:    ${DB_PATH}`)
      console.log("==============================================")
    })
  })
  .catch((err) => {
    console.error("No se pudo iniciar:", err.message)
    process.exit(1)
  })
