import requests

URL = "http://127.0.0.1:5000"

r = requests.post(f"{URL}/login", json={"usuario": "alumno", "password": "alumno123"})
token = r.json()["token"]
print("Token obtenido:\n", token)

with open("token.txt", "w") as f:
    f.write(token)
print("\nGuardado en token.txt")

r = requests.get(f"{URL}/perfil", headers={"Authorization": f"Bearer {token}"})
print("\n/perfil ->", r.status_code, r.json())

r = requests.get(f"{URL}/admin", headers={"Authorization": f"Bearer {token}"})
print("/admin  ->", r.status_code, r.json())