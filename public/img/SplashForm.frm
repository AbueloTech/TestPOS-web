VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} SplashForm 
   Caption         =   "UserForm1"
   ClientHeight    =   8970
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9345
   OleObjectBlob   =   "SplashForm.frx":0000
   ShowModal       =   0   'False
   StartUpPosition =   1  'Centrar en propietario
End
Attribute VB_Name = "SplashForm"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
'Para mostrar un UserForm sin barra de titulo necesitamos cuatro funciones API:
Const GWL_STYLE = -16
Const WS_CAPTION = &HC00000
#If VBA7 Then
    Private Declare PtrSafe Function GetWindowLong Lib "user32" Alias "GetWindowLongA" (ByVal hwnd As Long, ByVal nIndex As Long) As Long
    Private Declare PtrSafe Function SetWindowLong Lib "user32" Alias "SetWindowLongA" (ByVal hwnd As Long, ByVal nIndex As Long, ByVal dwNewLong As Long) As Long
    Private Declare PtrSafe Function DrawMenuBar Lib "user32" (ByVal hwnd As Long) As Long
    Private Declare PtrSafe Function FindWindowA Lib "user32" (ByVal lpClassName As String, ByVal lpWindowName As String) As Long
#Else
    Private Declare Function GetWindowLong Lib "user32" Alias "GetWindowLongA" (ByVal hwnd As Long, ByVal nIndex As Long) As Long
    Private Declare Function SetWindowLong Lib "user32" Alias "SetWindowLongA" (ByVal hwnd As Long, ByVal nIndex As Long, ByVal dwNewLong As Long) As Long
    Private Declare Function DrawMenuBar Lib "user32" (ByVal hwnd As Long) As Long
    Private Declare Function FindWindowA Lib "user32" (ByVal lpClassName As String, ByVal lpWindowName As String) As Long
#End If

Private Sub UserForm_Initialize()
Application.Visible = False
'Este código realiza el procedimiento de ocultar la barra de título, haciendo uso de las API
    Dim lngWindow As Long, lFrmHdl As Long
    
    lFrmHdl = FindWindowA(vbNullString, Me.Caption)
    lngWindow = GetWindowLong(lFrmHdl, GWL_STYLE)
    lngWindow = lngWindow And (Not WS_CAPTION)
    Call SetWindowLong(lFrmHdl, GWL_STYLE, lngWindow)
    Call DrawMenuBar(lFrmHdl)
'-----------------------------------------------------------------------------------------

'Cargamos el formulario y establecemos un timer para que se cierre automáticamente

Dim Contador As Integer, Maximo As Integer, Intervalo As Integer
Dim Inicio As Double
Dim X As Integer

'Hoja1.txt_UsuarioActual.Text = Empty

Maximo = 400




Me.Show
For Contador = 1 To Maximo
        Inicio = Timer
            Do Until Timer - Inicio > Intervalo
                X = DoEvents()
            Loop
            Me.lbl_Bar.Width = Contador
            Me.lbl_Percent.Caption = "Cargando " & FORMAT(Contador / Maximo, "Percent")
Next Contador
    
    frm_Login.Show

    End


End Sub


