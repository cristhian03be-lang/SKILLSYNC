import jwt
from flask import Flask, request, jsonify

app = Flask(__name__)

# VULNERABILIDAD 2: secreto débil y escrito en el código
SECRET = "secret123"

# "Base de datos" en memoria
USUARIOS = {
    "alumno": {"password": "alumno123", "role": "user"},
    "admin": {"password": "Xk9#mP2$vL7qW4nZ", "role": "admin"},
}


def verificar_token():
    """Devuelve el payload del token o None si no es válido."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[len("Bearer "):]
    try:
        header = jwt.get_unverified_header(token)
        # VULNERABILIDAD 1: confiamos en el algoritmo que declara el propio token
        if header.get("alg") == "none":
            return jwt.decode(token, options={"verify_signature": False})
        return jwt.decode(token, SECRET, algorithms=[header["alg"]])
    except jwt.PyJWTError:
        return None


@app.post("/login")
def login():
    datos = request.get_json(silent=True) or {}
    nombre = datos.get("usuario")
    usuario = USUARIOS.get(nombre)
    if not usuario or usuario["password"] != datos.get("password"):
        return jsonify(error="Credenciales inválidas"), 401
    # VULNERABILIDAD 3: el token no tiene fecha de expiración
    payload = {"sub": nombre, "role": usuario["role"]}
    token = jwt.encode(payload, SECRET, algorithm="HS256")
    return jsonify(token=token)


@app.get("/perfil")
def perfil():
    payload = verificar_token()
    if payload is None:
        return jsonify(error="Token inválido o ausente"), 401
    return jsonify(usuario=payload["sub"], role=payload["role"])


@app.get("/admin")
def admin():
    payload = verificar_token()
    if payload is None:
        return jsonify(error="Token inválido o ausente"), 401
    if payload.get("role") != "admin":
        return jsonify(error="Solo administradores"), 403
    return jsonify(mensaje="Bienvenido al panel de administración",
                   flag="FLAG{jwt_roto_por_" + payload["sub"] + "}")


@app.post("/logout")
def logout():
    # El servidor no guarda estado: solo le pide al cliente que borre el token
    return jsonify(mensaje="Sesión cerrada. Borra tu token.")


if __name__ == "__main__":
    app.run(port=5000)