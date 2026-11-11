VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} UserForm4 
   Caption         =   "Menu de Acceso"
   ClientHeight    =   5445
   ClientLeft      =   45
   ClientTop       =   375
   ClientWidth     =   4560
   OleObjectBlob   =   "UserForm4.frx":0000
   StartUpPosition =   1  'Centrar en propietario
End
Attribute VB_Name = "UserForm4"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Private Sub CommandButton1_Click()
Dim Dia1, Dia2, Mes1, Mes2, Año1, Año2, FechaDesde, FechaHasta As String

Dia1 = Mid(DateValue(TextBox1), 1, 2)
Mes1 = Mid(DateValue(TextBox1), 4, 2)
Año1 = Mid(DateValue(TextBox1), 7, 4)

Dia2 = Mid(DateValue(TextBox1), 1, 2)
Mes2 = Mid(DateValue(TextBox1), 4, 2)
Año2 = Mid(DateValue(TextBox1), 7, 4)

FechaDesde = Mes1 & "/" & Dia1 & "/" & Año1
FechaHasta = Mes1 & "/" & Dia1 & "/" & Año1


    Selection.AutoFilter
    ActiveSheet.Range("D4:F10").AutoFilter Field = 1, Criteria1 = ">=" & FechaDesde, Operator:=xlAnd, Criteria2:="<" & FechaHasta
    


End Sub

Private Sub ingresar_Click()

If usuario = "angel" And contrasena = "123" Then

MsgBox " los datos son correctos"
Sheets("Detalle de Facturas").Select
Unload Me

Else

MsgBox "datos incorrectos"
End If

End Sub

Private Sub salir_Click()
Unload Me

End Sub
