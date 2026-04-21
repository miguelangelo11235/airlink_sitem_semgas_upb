# =============================================================
#  api.py — Backend FastAPI para AirLink Dashboard
#
#  Flujo:
#    1. POST /configure  → recibe URI + parámetros, valida conexión
#                          y guarda la config en memoria del proceso
#    2. POST /login      → valida usuario/contraseña contra MongoDB
#    3. GET  /readings   → lecturas históricas por rango (con JWT)
#    4. GET  /latest     → última lectura disponible (con JWT)
#    5. GET  /health     → estado del servidor
#
#  Instalación:
#    pip install fastapi uvicorn pymongo python-jose[cryptography] passlib[bcrypt]
#
#  Ejecución:
#    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
# =============================================================

from datetime import datetime, timedelta, timezone
from typing import Optional
import os

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="AirLink API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # En producción: reemplazar con tu dominio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Seguridad ─────────────────────────────────────────────────
pwd_context   = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer()
TOKEN_EXPIRE_MIN = 480   # 8 horas
ALGORITHM        = "HS256"

# ── Estado de configuración (en memoria del proceso) ──────────
MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "air_quality")
USERS_COLL = os.getenv("USERS_COLL", "users")
READINGS_COLL = os.getenv("READINGS_COLL", "raw_measurements")
SECRET_KEY = os.getenv("SECRET_KEY", "default-secret-key-for-local-dev")

_config: dict = {}

if MONGO_URI:
    _config = {
        "mongo_uri": MONGO_URI,
        "mongo_db": MONGO_DB,
        "users_collection": USERS_COLL,
        "readings_collection": READINGS_COLL,
        "secret_key": SECRET_KEY,
    }

_mongo_client: Optional[MongoClient] = None

def _reset_client():
    global _mongo_client
    if _mongo_client:
        try:
            _mongo_client.close()
        except Exception:
            pass
    _mongo_client = None

def get_db():
    """Retorna la BD activa. Lanza 503 si no hay config."""
    global _mongo_client
    if not _config:
        raise HTTPException(
            status_code=503,
            detail="El servidor no está configurado. Completa el paso de configuración primero."
        )
    if _mongo_client is None:
        _mongo_client = MongoClient(_config["mongo_uri"], serverSelectionTimeoutMS=5000)
    return _mongo_client[_config["mongo_db"]]

# ── Modelos ───────────────────────────────────────────────────
class ConfigRequest(BaseModel):
    mongo_uri:            str
    mongo_db:             str = "air_quality"
    users_collection:     str = "users"
    readings_collection:  str = "readings"
    secret_key:           str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token:    str
    username: str

# ── JWT helpers ───────────────────────────────────────────────
def _create_token(username: str) -> str:
    expire  = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MIN)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, _config.get("secret_key", "fallback"), algorithm=ALGORITHM)

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    try:
        payload  = jwt.decode(
            credentials.credentials,
            _config.get("secret_key", "fallback"),
            algorithms=[ALGORITHM],
        )
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

# ── Rangos de tiempo ──────────────────────────────────────────
RANGE_MAP = {
    "1h":  timedelta(hours=1),
    "6h":  timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d":  timedelta(days=7),
}

# ═══════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/configure")
def configure(req: ConfigRequest):
    """
    Recibe los parámetros de conexión desde setup.html,
    verifica conectividad y guarda la configuración en memoria.
    """
    global _config

    # Validar URI intentando un ping
    try:
        test = MongoClient(req.mongo_uri, serverSelectionTimeoutMS=4000)
        test.admin.command("ping")
        test.close()
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo conectar a MongoDB: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"URI inválida o error de conexión: {e}"
        )

    _reset_client()
    _config = {
        "mongo_uri":           req.mongo_uri,
        "mongo_db":            req.mongo_db,
        "users_collection":    req.users_collection,
        "readings_collection": req.readings_collection,
        "secret_key":          req.secret_key,
    }
    return {"status": "ok", "mongo_db": req.mongo_db}


@app.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """
    Valida credenciales contra la colección de usuarios en MongoDB.

    Documento esperado en la colección 'users' de Atlas:
    {
      "username":      "admin",
      "password_hash": "<bcrypt hash generado con create_user.py>",
      "active":        true
    }
    """
    db       = get_db()
    user_doc = db[_config["users_collection"]].find_one({"username": req.username})

    if not user_doc:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    if not user_doc.get("active", True):
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    if not pwd_context.verify(req.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    return TokenResponse(token=_create_token(req.username), username=req.username)


@app.get("/readings")
def get_readings(
    range: str = "24h",
    username: str = Depends(verify_token),
):
    """
    Retorna lecturas ordenadas ascendente dentro del rango solicitado.
    Query param: range = '1h' | '6h' | '24h' | '7d'
    """
    delta = RANGE_MAP.get(range, timedelta(hours=24))
    since = datetime.now(timezone.utc) - delta

    cursor = (
        get_db()[_config["readings_collection"]]
        .find(
            {"timestamp": {"$gte": since}},
            {"_id": 0, "timestamp": 1, "device_id": 1, "metrics": 1},
        )
        .sort("timestamp", 1)
    )

    readings = []
    for doc in cursor:
        doc["timestamp"] = doc["timestamp"].isoformat()
        readings.append(doc)
    return readings


@app.get("/latest")
def get_latest(username: str = Depends(verify_token)):
    """Retorna el documento más reciente de la colección de lecturas."""
    doc = get_db()[_config["readings_collection"]].find_one(
        {},
        {"_id": 0, "timestamp": 1, "device_id": 1, "metrics": 1},
        sort=[("timestamp", DESCENDING)],
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Sin lecturas disponibles")
    doc["timestamp"] = doc["timestamp"].isoformat()
    return doc


@app.get("/health")
def health():
    if not _config:
        return {"status": "not_configured"}
    try:
        get_db().command("ping")
        return {"status": "ok", "mongodb": "connected", "db": _config.get("mongo_db")}
    except Exception:
        return {"status": "degraded", "mongodb": "disconnected"}