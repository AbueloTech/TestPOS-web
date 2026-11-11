Attribute VB_Name = "Cambiar_NumerosaLetras"

Function CONVERTIRNUM(Numero As Double, Optional CentimosEnLetra As Boolean) As String

Dim Moneda As String
Dim Monedas As String
Dim Centimo As String
Dim Centimos As String
Dim Preposicion As String
Dim NumCentimos As Double
Dim Letra As String
Const Maximo = 1999999999.99

'************************************************************
' Parámetros
'************************************************************
Moneda = "Peso"         'Nombre de Moneda (Singular)
Monedas = "Pesos"       'Nombre de Moneda (Plural)
Centimo = "Centavo"     'Nombre de Céntimos (Singular)
Centimos = "Centavos"   'Nombre de Céntimos (Plural)
Preposicion = "Con"     'Preposición entre Moneda y Céntimos
'************************************************************

'Validar que el Numero está dentro de los límites
If (Numero >= 0) And (Numero <= Maximo) Then

    
    Letra = NUMERORECURSIVO((Fix(Numero)))              'Convertir el Numero en letras
    
    'Si Numero = 1 agregar leyenda Moneda (Singular)
    If (Numero = 1) Then
        Letra = Letra & " " & Moneda
    'De lo contrario agregar leyenda Monedas (Plural)
    Else
        Letra = Letra & " " & Monedas
    End If
    
    
    NumCentimos = Round((Numero - Fix(Numero)) * 100)   'Obtener los centimos del Numero
    
    'Si NumCentimos es mayor a cero inicar la conversión
    If NumCentimos >= 0 Then
        'Si el parámetro CentimosEnLetra es VERDADERO obtener letras para los céntimos
        If CentimosEnLetra Then
            Letra = Letra & " " & Preposicion & " " & NUMERORECURSIVO(Fix(NumCentimos)) 'Convertir los céntimos en letra
                
            'Si NumCentimos = 1 agregar leyenda Centimos (Singular)
            If (NumCentimos = 1) Then
                Letra = Letra & " " & Centimo
            'De lo contrario agregar leyenda Centimos (Plural)
            Else
                Letra = Letra & " " & Centimos
            End If
         'De lo contrario mostrar los céntimos como número
         Else
            If NumCentimos < 10 Then
                Letra = Letra & " 0" & NumCentimos & "/100"
            Else
                Letra = Letra & " " & NumCentimos & "/100"
            End If
         End If
    End If

    'Regresar el resultado final de la conversión
    CONVERTIRNUM = Letra

Else
    'Si el Numero no está dentro de los límites, entivar un mensaje de error
    CONVERTIRNUM = "ERROR: El número excede los límites."
End If

End Function

Function NUMERORECURSIVO(Numero As Long) As String

Dim Unidades, Decenas, Centenas
Dim Resultado As String

'**************************************************
' Nombre de los números
'**************************************************
Unidades = Array("", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Doce", "Trece", "Catorce", "Quince", "Dieciséis", "Diecisiete", "Dieciocho", "Diecinueve", "Veinte", "Veintiuno", "Veintidos", "Veintitres", "Veinticuatro", "Veinticinco", "Veintiseis", "Veintisiete", "Veintiocho", "Veintinueve")
Decenas = Array("", "Diez", "Veinte", "Treinta", "Cuarenta", "Cincuenta", "Sesenta", "Setenta", "Ochenta", "Noventa", "Cien")
Centenas = Array("", "Ciento", "Doscientos", "Trescientos", "Cuatrocientos", "Quinientos", "Seiscientos", "Setecientos", "Ochocientos", "Novecientos")
'**************************************************

Select Case Numero
    Case 0
        Resultado = "Cero"
    Case 1 To 29
        Resultado = Unidades(Numero)
    Case 30 To 100
        Resultado = Decenas(Numero \ 10) + IIf(Numero Mod 10 <> 0, " y " + NUMERORECURSIVO(Numero Mod 10), "")
    Case 101 To 999
        Resultado = Centenas(Numero \ 100) + IIf(Numero Mod 100 <> 0, " " + NUMERORECURSIVO(Numero Mod 100), "")
    Case 1000 To 1999
        Resultado = "Mil" + IIf(Numero Mod 1000 <> 0, " " + NUMERORECURSIVO(Numero Mod 1000), "")
    Case 2000 To 999999
        Resultado = NUMERORECURSIVO(Numero \ 1000) + " Mil" + IIf(Numero Mod 1000 <> 0, " " + NUMERORECURSIVO(Numero Mod 1000), "")
    Case 1000000 To 1999999
        Resultado = "Un Millón" + IIf(Numero Mod 1000000 <> 0, " " + NUMERORECURSIVO(Numero Mod 1000000), "")
    Case 2000000 To 1999999999
        Resultado = NUMERORECURSIVO(Numero \ 1000000) + " Millones" + IIf(Numero Mod 1000000 <> 0, " " + NUMERORECURSIVO(Numero Mod 1000000), "")
End Select

NUMERORECURSIVO = Resultado

End Function

Function Pesos(ByVal cantidad)
Dim Pesotes, Centavos, Temp
Dim DecimalPlace, Count
Dim origNumLen, origNum
Dim Sep, Moneda
Dim Decimales As Long

Decimales = Round(100 * (cantidad - Int(cantidad)), 0) 'extrae la parte decimal

ReDim place(9) As String
place(2) = " MIL "
place(3) = " MILLONES "
place(4) = " BILLONES "
place(5) = " TRILLONES "

cantidad = Trim(CStr(cantidad))
origNumLen = Len(cantidad)
origNum = cantidad
'Especificar el separador de miles y/o decimales
Sep = "."
'Especificar el tipo de moneda Pesos (default)
Moneda = "Pesos"

If Sep = "." Then DecimalPlace = InStr(cantidad, ".")

' Convert Centavos and set Cantidad to currency amount.
If DecimalPlace > 0 Then
Centavos = GetTens(Left(Mid(cantidad, DecimalPlace + 1) & _
"00", 2))
cantidad = Trim(Left(cantidad, DecimalPlace - 1))
End If

Count = 1
Do While cantidad <> ""
Temp = GetHundreds(Right(cantidad, 3))
If Temp <> "" Then
If Temp = "UN" And Count > 2 Then
Pesotes = Temp & Left(place(Count), Len(place(Count)) - 3) _
& " " & Pesotes
Else
Pesotes = Temp & place(Count) & Pesotes
End If
End If
If Len(cantidad) > 3 Then
cantidad = Left(cantidad, Len(cantidad) - 3)
Else
cantidad = ""
End If
Count = Count + 1
Loop

Select Case Pesotes
Case ""
Pesotes = " (CERO " & Moneda
Case "UN"
Pesotes = " (UN " & Left(Moneda, Len(Moneda) - 1)

Case Else
If origNumLen > 6 And (origNum Mod 1000000) = 0 Then
Pesotes = " (" & Pesotes & " " & "DE " & Moneda
Else
Pesotes = " (" & Pesotes & " " & Moneda
End If
End Select

Select Case Centavos
Case ""
Centavos = " 00/100)"
Case Else
If Decimales < 10 Then
Centavos = " 0" & Decimales & "/100)"
Else
Centavos = " " & Decimales & "/100)"
End If
End Select

Pesos = UCase(Trim(Pesotes & Centavos))
End Function


' Convertir rango de numeros del 100 hasta 999 en texto

Private Function GetHundreds(ByVal cantidad)
Dim Result As String

If Val(cantidad) = 0 Then Exit Function
cantidad = Right("000" & cantidad, 3)

' Convert the hundreds place.
If Mid(cantidad, 1, 1) <> "0" Then
If cantidad = "100" Then
Result = "CIEN "
Else
Select Case Mid(cantidad, 1, 1)
Case 1
Select Case Len(cantidad)
Case 1
Result = "UN "
Case 3
Result = "CIENTO "
Case 4
Result = ""
Case 6
Result = "CIENTO "
Case 9
Result = "CIENTO "
End Select

Case 2
Result = "DOSCIENTOS "
Case 3
Result = "TRESCIENTOS "
Case 4
Result = "CUATROCIENTOS "
Case 5
Result = "QUINIENTOS "
Case 6
Result = "SEISCIENTOS "
Case 7
Result = "SETECIENTOS "
Case 8
Result = "OCHOCIENTOS "
Case 9
Result = "NOVECIENTOS "
End Select
End If
End If
' Convert the tens and ones place.
If Mid(cantidad, 2, 1) <> "0" Then
Result = Result & GetTens(Mid(cantidad, 2))
Else
Result = Result & GetDigit(Mid(cantidad, 3))
End If

GetHundreds = Result
End Function



' Convertir rango de numeros del 10 hasta 99 en texto

Private Function GetTens(TensText)
Dim Result As String

Result = ""
If Val(Left(TensText, 1)) = 1 Then
Select Case Val(TensText)
Case 10: Result = "DIEZ"
Case 11: Result = "ONCE"
Case 12: Result = "DOCE"
Case 13: Result = "TRECE"
Case 14: Result = "CATORCE"
Case 15: Result = "QUINCE"
Case 16: Result = "DIECISEIS"
Case 17: Result = "DIECISIETE"
Case 18: Result = "DIECIOCHO"
Case 19: Result = "DIECINUEVE"
Case Else
End Select
Else
If Val(Right(TensText, 1)) = 0 Then
Select Case Val(Left(TensText, 1))
Case 2: Result = "VEINTE"
Case 3: Result = "TREINTA"
Case 4: Result = "CUARENTA"
Case 5: Result = "CINCUENTA"
Case 6: Result = "SESENTA"
Case 7: Result = "SETENTA"
Case 8: Result = "OCHENTA"
Case 9: Result = "NOVENTA"
Case Else
End Select
Else
Select Case Val(Left(TensText, 1))
Case 2: Result = "VEINTI"
Case 3: Result = "TREINTA Y "
Case 4: Result = "CUARENTA Y "
Case 5: Result = "CINCUENTA Y "
Case 6: Result = "SESENTA Y "
Case 7: Result = "SETENTA Y "
Case 8: Result = "OCHENTA Y "
Case 9: Result = "NOVENTA Y "
Case Else
End Select
End If

Result = Result & GetDigit _
(Right(TensText, 1))
End If
GetTens = Result
End Function


' Convertir rango de numeros del 1 hasta 9 en texto


Private Function GetDigit(Digit)
Select Case Val(Digit)
Case 1: GetDigit = "UN"
Case 2: GetDigit = "DOS"
Case 3: GetDigit = "TRES"
Case 4: GetDigit = "CUATRO"
Case 5: GetDigit = "CINCO"
Case 6: GetDigit = "SEIS"
Case 7: GetDigit = "SIETE"
Case 8: GetDigit = "OCHO"
Case 9: GetDigit = "NUEVE"
Case Else: GetDigit = ""
End Select
End Function



