import base64
import json
import sys


def b64url_decode(parte):
    # JWT usa base64url sin relleno "="; lo agregamos para poder decodificar
    relleno = "=" * (-len(parte) % 4)
    return base64.urlsafe_b64decode(parte + relleno)


# Usa el token que le pases como argumento, o el de token.txt
if len(sys.argv) > 1:
    token = sys.argv[1]
else:
    with open("token.txt") as f:
        token = f.read().strip()

header_b64, payload_b64, firma_b64 = token.split(".")

print("HEADER :", json.loads(b64url_decode(header_b64)))
print("PAYLOAD:", json.loads(b64url_decode(payload_b64)))
print("FIRMA  :", firma_b64 or "(vacía)")