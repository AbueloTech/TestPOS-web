VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} UserForm2 
   Caption         =   "UserForm2"
   ClientHeight    =   5835
   ClientLeft      =   45
   ClientTop       =   375
   ClientWidth     =   10710
   OleObjectBlob   =   "UserForm2.frx":0000
   StartUpPosition =   1  'Centrar en propietario
End
Attribute VB_Name = "UserForm2"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Public dir
Private Sub ComboBox1_Change()
Dim fila As Integer, uf As Integer, d1 As String, d2 As String
Dim sd As New Collection, celda As Range, dato, r As String
On Error Resume Next
Set a = Sheets("Hoja3")
fila = 2
uf = a.Range("A" & Rows.Count).End(xlUp).Row
ComboBox2.Clear
'ComboBox3.Clear
While a.Cells(fila, 1) <> Empty
d1 = ComboBox1
d2 = a.Cells(fila, 9)
If d1 = d2 Then
sd.Add a.Cells(fila, 10), CStr(a.Cells(fila, 10).Value)
End If
fila = fila + 1
Wend
For Each dato In sd
ComboBox2.AddItem dato
Next dato

End Sub


Private Sub ComboBox2_Change()
'    Dim fila As Integer, uf As Integer, d1 As String, d2 As String
'    Dim sd As New Collection, celda As Range, dato, r As String
'    On Error Resume Next
'    Set b = Sheets("Hoja2")
'    i = 2
'    uf = b.Range("A" & Rows.Count).End(xlUp).Row
'    ListBox1.Clear
'    While b.Cells(fila, 1) <> Empty
'    d1 = ComboBox2
'    d2 = b.Cells(fila, 10)
'    If d1 = d2 Then
'    'sd.Add b.Cells(fila, 4), CStr(b.Cells(fila, 4).Value)
'    ListBox1.AddItem h.Cells(i, "A")
'    ListBox1.List(ListBox1.ListCount - 1, 1) = h.Cells(i, "B")
'    ListBox1.List(ListBox1.ListCount - 1, 2) = h.Cells(i, "C")
'    ListBox1.List(ListBox1.ListCount - 1, 3) = h.Cells(i, "D")
'    ListBox1.List(ListBox1.ListCount - 1, 4) = h.Cells(i, "E")
'    ListBox1.List(ListBox1.ListCount - 1, 5) = h.Cells(i, "F")
'    ListBox1.List(ListBox1.ListCount - 1, 6) = h.Cells(i, "G")
'    ListBox1.List(ListBox1.ListCount - 1, 7) = h.Cells(i, "H")
'    ListBox1.List(ListBox1.ListCount - 1, 8) = h.Cells(i, "I")
'    ListBox1.List(ListBox1.ListCount - 1, 8) = h.Cells(i, "J")
'
'
'    End If
'    i = i + 1
'    Wend
'
''For Each dato In sd
''ListBox1.AddItem dato
'
'
'
On Error Resume Next
ListBox1.Clear
Set h = Sheets("Hoja3")
For i = 2 To h.Range("A" & Rows.Count).End(xlUp).Row
If h.Cells(i, "I") = ComboBox1 And h.Cells(i, "J") = ComboBox2 Then
ListBox1.AddItem h.Cells(i, "A")
ListBox1.List(ListBox1.ListCount - 1, 1) = h.Cells(i, "B")
ListBox1.List(ListBox1.ListCount - 1, 2) = h.Cells(i, "C")
ListBox1.List(ListBox1.ListCount - 1, 3) = h.Cells(i, "D")
ListBox1.List(ListBox1.ListCount - 1, 4) = h.Cells(i, "E")
ListBox1.List(ListBox1.ListCount - 1, 5) = h.Cells(i, "F")
ListBox1.List(ListBox1.ListCount - 1, 6) = h.Cells(i, "G")
ListBox1.List(ListBox1.ListCount - 1, 7) = h.Cells(i, "H")
ListBox1.List(ListBox1.ListCount - 1, 8) = h.Cells(i, "I")
ListBox1.List(ListBox1.ListCount - 1, 8) = h.Cells(i, "J")
End If
Next

End Sub

Private Sub ComboBox3_Change()
'Evito movimientos de la pantalla
Application.ScreenUpdating = False
Dim fila, a As Integer
Dim dato, var As String
'On Error Resume Next
'Borra datos del listbox
TextBox1 = Empty
TextBox2 = Empty
TextBox3 = Empty
TextBox4 = Empty
TextBox5 = Empty
TextBox6 = Empty

a = 0
fila = 2
'Bucle mientras la fila no esté vacia
While Sheets("hoja2").Cells(fila, 4) <> Empty
      dato = ComboBox3
'Si el dato de la fila coincide con textbox carga los datos al listbox
  var = Sheets("hoja2").Cells(fila, 5)
   If var = dato Then
        dir = Sheets("hoja2").Cells(fila, 4).Address(False, False)
        'Copia los datos en textbox
      
        TextBox1 = Sheets("hoja2").Cells(fila, 1)
        TextBox2 = Sheets("hoja2").Cells(fila, 2)
        TextBox3 = Sheets("hoja2").Cells(fila, 3)
        TextBox4 = Sheets("hoja2").Cells(fila, 4)
        TextBox5 = Sheets("hoja2").Cells(fila, 5)
        TextBox6 = Sheets("hoja2").Cells(fila, 6)
   End If
   
'Aumento la fila para que pase a la siguiente
fila = fila + 1
Wend

'Devuelvo movimientos de la pantalla
Application.ScreenUpdating = True
End Sub


Private Sub CommandButton2_Click()
If ComboBox4 = Empty Then
MsgBox ("Debe cargar fecha de salida"), vbCritical, "AVISO"
ComboBox3.SetFocus
Exit Sub
End If
Sheets("hoja2").Range(dir).Offset(0, 2) = ComboBox4
ComboBox1.Clear
ComboBox2.Clear
ComboBox3.Clear
ComboBox4 = Clear
TextBox1 = Empty
TextBox2 = Empty
TextBox3 = Empty
TextBox4 = Empty
TextBox5 = Empty
TextBox6 = Empty
ComboBox1.SetFocus
MsgBox ("El registro se guardó con éxito"), vbInformation, "AVISO"
End Sub

Private Sub CommandButton3_Click()
Unload Me
End Sub
Private Sub UserForm_Initialize()
Dim sd As New Collection
Dim celda As Range
Dim dato
Dim r As String
Dim uf As Integer
Application.ScreenUpdating = False
On Error Resume Next
ListBox1.ColumnCount = 10
ComboBox1.Clear
Sheets("hoja3").Select
Range("A2").Select
uf = Range("A" & Rows.Count).End(xlUp).Row
r = "I2:I" & uf
For Each celda In Range(r)
sd.Add celda.Value, CStr(celda.Value)
Next celda
For Each dato In sd
ComboBox1.AddItem dato
Next dato
Application.ScreenUpdating = True
End Sub


