"""
Seed inicial: tipos de cultivo + usuarios + jerarquía de prueba completa.

Idempotente: comprueba existencia antes de insertar, seguro de ejecutar
múltiples veces.

Datos creados:
  Usuarios:
    - admin@sensores.com / admin123          (Administrador)
    - alan2203mx@gmail.com / 123            (Cliente de prueba principal)
    - jlopez@test.com / admin123             (Cliente sin predios)

  Jerarquía de prueba:
    Cliente: alan2203mx@gmail.com
      ├─ Predio: DEMO - Rancho Norte
      │    ├─ Área: DEMO - Nogal Norte   → Nodo DEMO - Nogal Norte   (API Key: 99189486-...)
      │    ├─ Área: DEMO - Alfalfa Este  → Nodo DEMO - Alfalfa Este  (API Key: c1f5cd79-...)
      │    ├─ Área: DEMO - Chile Principal → Nodo DEMO - Chile Principal (API Key: 02b21674-...)
      │    └─ Área: DEMO - Área 2        → Nodo DEMO - Prueba E2E    (API Key: ak_b2727b...)
      ├─ Predio: Granja Hogar
      │    └─ Área: Area Granja Hogar    → Nodo Granja Hogar         (API Key: ak_partner_granja_hogar_001)
      └─ Predio: Campus Reforestado
           └─ Área: Area Campus Reforestado → Nodo Campus Reforestado (API Key: ak_partner_campus_reforestado_001)
"""

import bcrypt
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.client import Client
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.hardware_profile import HardwareProfile
from app.models.property import Property
from app.models.user import User

# ---------------------------------------------------------------------------
# Datos de prueba — deben coincidir con docs/test-data.md
# ---------------------------------------------------------------------------

CROP_TYPES = ["Nogal", "Alfalfa", "Manzana", "Maíz", "Chile", "Algodón"]
PRIMARY_TEST_CLIENT_EMAIL = "alan2203mx@gmail.com"
DEMO_PREFIX = "DEMO - "

USERS = [
    {
        "correo": "admin@sensores.com",
        "password": "admin123",
        "nombre": "Administrador",
        "rol": "admin",
    },
    {
        "correo": "alan2203mx@gmail.com",
        "password": "123",
        "nombre": "Alan Test",
        "rol": "cliente",
        "empresa": "Agricola del Norte",
    },
    {
        "correo": "jlopez@test.com",
        "password": "admin123",
        "nombre": "Juan López",
        "rol": "cliente",
        "empresa": "Sin Empresa",
    },
]

# Estructura demo legado del cliente de prueba principal.
# API Keys deben coincidir exactamente con docs/test-data.md
DEMO_PROPERTY_NAME = f"{DEMO_PREFIX}Rancho Norte"
DEMO_AREAS_Y_NODOS = [
    {
        "area_nombre": f"{DEMO_PREFIX}Nogal Norte",
        "cultivo": "Nogal",
        "tamano": 12.5,
        "nodo_nombre": f"Nodo {DEMO_PREFIX}Nogal Norte",
        "api_key": "99189486-8181-4e8c-8c6d-b3da66e6712b",
        "lat": 29.0892,
        "lon": -110.9588,
    },
    {
        "area_nombre": f"{DEMO_PREFIX}Alfalfa Este",
        "cultivo": "Alfalfa",
        "tamano": 8.0,
        "nodo_nombre": f"Nodo {DEMO_PREFIX}Alfalfa Este",
        "api_key": "c1f5cd79-e760-4a9f-92ea-31ea685a3add",
        "lat": 29.0901,
        "lon": -110.9521,
    },
    {
        "area_nombre": f"{DEMO_PREFIX}Chile Principal",
        "cultivo": "Chile",
        "tamano": 5.5,
        "nodo_nombre": f"Nodo {DEMO_PREFIX}Chile Principal",
        "api_key": "02b21674-0099-4470-a8dd-b4ebd7d8c2b0",
        "lat": 29.0876,
        "lon": -110.9601,
    },
    {
        "area_nombre": f"{DEMO_PREFIX}Área 2",
        "cultivo": "Maíz",
        "tamano": 6.0,
        "nodo_nombre": f"Nodo {DEMO_PREFIX}Prueba E2E",
        "api_key": "ak_b2727bc1d95e342932612ee5573fdb18",
        "lat": None,
        "lon": None,
    },
]

# Estructura productiva del socio formador (sin fallback).
PARTNER_PROPERTIES_AND_NODES = [
    {
        "property_name": "Granja Hogar",
        "location": "28.6850292,-106.0765387",
        "area_name": "Area Granja Hogar",
        "crop_name": "Nogal",
        "area_size": 1.0,
        "node_name": "Nodo Granja Hogar",
        "api_key": "ak_partner_granja_hogar_001",
        "lat": 28.6850292,
        "lon": -106.0765387,
    },
    {
        "property_name": "Campus Reforestado",
        "location": "28.6753139,-106.077902",
        "area_name": "Area Campus Reforestado",
        "crop_name": "Nogal",
        "area_size": 1.0,
        "node_name": "Nodo Campus Reforestado",
        "api_key": "ak_partner_campus_reforestado_001",
        "lat": 28.6753139,
        "lon": -106.077902,
    },
]

LEGACY_DEMO_PROPERTY_NAME = "Rancho Norte"
LEGACY_DEMO_AREA_NAMES = {"Nogal Norte", "Alfalfa Este", "Chile Principal", "Área 2"}
LEGACY_DEMO_NODE_NAMES = {
    "Nodo Nogal Norte",
    "Nodo Alfalfa Este",
    "Nodo Chile Principal",
    "Nodo Prueba E2E",
}

HARDWARE_PROFILES = [
    {"codigo": "soil-irrigation-v1", "nombre": "Soil and irrigation sensors"},
    {"codigo": "environmental-v1", "nombre": "Environmental sensors"},
    {"codigo": "full-telemetry-v1", "nombre": "Full telemetry sensor profile"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_or_create(db, model, filter_kwargs, create_kwargs=None):
    """Fetch existing record or create it. Returns (instance, created: bool)."""
    obj = db.execute(select(model).filter_by(**filter_kwargs)).scalar_one_or_none()
    if obj:
        return obj, False
    obj = model(**(filter_kwargs | (create_kwargs or {})))
    db.add(obj)
    db.flush()  # get generated id without committing
    return obj, True


def _ensure_demo_prefix(value: str) -> str:
    return value if value.startswith(DEMO_PREFIX) else f"{DEMO_PREFIX}{value}"


def _migrate_legacy_demo_names(db, *, client_id: int) -> None:
    legacy_property = db.execute(
        select(Property).where(
            Property.cliente_id == client_id,
            Property.nombre == LEGACY_DEMO_PROPERTY_NAME,
            Property.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()

    if legacy_property is not None:
        legacy_property.nombre = DEMO_PROPERTY_NAME
        if not legacy_property.ubicacion:
            legacy_property.ubicacion = "Sonora, México"

    demo_property = db.execute(
        select(Property).where(
            Property.cliente_id == client_id,
            Property.nombre == DEMO_PROPERTY_NAME,
            Property.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if demo_property is None:
        return

    areas = list(
        db.execute(
            select(IrrigationArea).where(
                IrrigationArea.predio_id == demo_property.id,
                IrrigationArea.eliminado_en.is_(None),
            )
        ).scalars()
    )
    for area in areas:
        if area.nombre in LEGACY_DEMO_AREA_NAMES:
            area.nombre = _ensure_demo_prefix(area.nombre)

    if not areas:
        return

    area_ids = [area.id for area in areas]
    nodes = list(
        db.execute(
            select(Node).where(
                Node.area_riego_id.in_(area_ids),
                Node.eliminado_en.is_(None),
            )
        ).scalars()
    )
    for node in nodes:
        if node.nombre in LEGACY_DEMO_NODE_NAMES:
            node.nombre = _ensure_demo_prefix(node.nombre)


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------


def seed():
    db = SessionLocal()
    try:
        print("\n🌱 Iniciando seed...")

        # 1. Tipos de cultivo
        print("\n  📋 Tipos de cultivo:")
        for nombre in CROP_TYPES:
            _, created = get_or_create(db, CropType, {"nombre": nombre})
            print(f"    {'+ Creado' if created else '✓ Ya existe'}: {nombre}")

        # Hardware profiles are identifiers and labels only; they contain no credentials.
        print("\n  🔧 Gateway hardware profiles:")
        for item in HARDWARE_PROFILES:
            _, created = get_or_create(
                db,
                HardwareProfile,
                {"codigo": item["codigo"]},
                {"nombre": item["nombre"], "activo": True},
            )
            print(f"    {'+ Creado' if created else '✓ Ya existe'}: {item['codigo']}")

        # 2. Usuarios
        print("\n  👥 Usuarios:")
        user_map = {}  # correo -> User instance
        for u in USERS:
            user, created = get_or_create(
                db,
                User,
                {"correo": u["correo"]},
                {
                    "contrasena_hash": hash_password(u["password"]),
                    "nombre_completo": u["nombre"],
                    "rol": u["rol"],
                },
            )

            # Mantener datos del seed en sincronía aunque el usuario ya exista.
            user.contrasena_hash = hash_password(u["password"])
            user.nombre_completo = u["nombre"]
            user.rol = u["rol"]
            user.activo = True

            user_map[u["correo"]] = user
            print(
                f"    {'+ Creado' if created else '✓ Ya existe'}: {u['correo']} ({u['rol']})"
            )

            # Crear registro de cliente para usuarios con rol 'cliente'
            if u["rol"] == "cliente":
                client_record, _ = get_or_create(
                    db,
                    Client,
                    {"usuario_id": user.id},
                    {"nombre_empresa": u.get("empresa", u["nombre"])},
                )
                client_record.nombre_empresa = u.get("empresa", u["nombre"])

        # 3. Jerarquía del cliente principal: demo + productivo socio
        cliente_user = user_map[PRIMARY_TEST_CLIENT_EMAIL]
        cliente_record = db.execute(
            select(Client).where(Client.usuario_id == cliente_user.id)
        ).scalar_one()

        _migrate_legacy_demo_names(db, client_id=cliente_record.id)

        print("\n  🏡 Predios/áreas demo:")
        demo_property, created = get_or_create(
            db,
            Property,
            {"cliente_id": cliente_record.id, "nombre": DEMO_PROPERTY_NAME},
            {"ubicacion": "Sonora, México"},
        )
        demo_property.ubicacion = "Sonora, México"
        print(f"    {'+ Creado' if created else '✓ Ya existe'}: {DEMO_PROPERTY_NAME}")

        print("\n  🌿 Áreas/nodos demo:")
        for item in DEMO_AREAS_Y_NODOS:
            # Obtener tipo de cultivo
            cultivo = db.execute(
                select(CropType).where(CropType.nombre == item["cultivo"])
            ).scalar_one()

            # Área de riego
            area, area_created = get_or_create(
                db,
                IrrigationArea,
                {"predio_id": demo_property.id, "nombre": item["area_nombre"]},
                {"tipo_cultivo_id": cultivo.id, "tamano_area": item["tamano"]},
            )
            area.tipo_cultivo_id = cultivo.id
            area.tamano_area = item["tamano"]
            print(
                f"    {'+ Creada' if area_created else '✓ Ya existe'}: {item['area_nombre']}"
            )

            # Nodo
            node, node_created = get_or_create(
                db,
                Node,
                {"api_key": item["api_key"]},
                {
                    "area_riego_id": area.id,
                    "nombre": item["nodo_nombre"],
                    "latitud": item["lat"],
                    "longitud": item["lon"],
                    "activo": True,
                },
            )

            # Forzar asignación y metadatos del nodo para evitar deriva entre corridas.
            node.area_riego_id = area.id
            node.nombre = item["nodo_nombre"]
            node.latitud = item["lat"]
            node.longitud = item["lon"]
            node.activo = True

            print(
                f"      {'+ Nodo creado' if node_created else '✓ Nodo ya existe'}: {item['nodo_nombre']}"
            )

        print("\n  🧭 Predios/áreas productivos (socio formador):")
        for item in PARTNER_PROPERTIES_AND_NODES:
            property_record, property_created = get_or_create(
                db,
                Property,
                {
                    "cliente_id": cliente_record.id,
                    "nombre": item["property_name"],
                },
                {"ubicacion": item["location"]},
            )
            property_record.ubicacion = item["location"]
            print(
                f"    {'+ Creado' if property_created else '✓ Ya existe'}: {item['property_name']}"
            )

            crop_type = db.execute(
                select(CropType).where(CropType.nombre == item["crop_name"])
            ).scalar_one()
            area, area_created = get_or_create(
                db,
                IrrigationArea,
                {"predio_id": property_record.id, "nombre": item["area_name"]},
                {
                    "tipo_cultivo_id": crop_type.id,
                    "tamano_area": item["area_size"],
                },
            )
            area.tipo_cultivo_id = crop_type.id
            area.tamano_area = item["area_size"]
            print(
                f"      {'+ Área creada' if area_created else '✓ Área ya existe'}: {item['area_name']}"
            )

            node, node_created = get_or_create(
                db,
                Node,
                {"api_key": item["api_key"]},
                {
                    "area_riego_id": area.id,
                    "nombre": item["node_name"],
                    "latitud": item["lat"],
                    "longitud": item["lon"],
                    "activo": True,
                },
            )
            node.area_riego_id = area.id
            node.nombre = item["node_name"]
            node.latitud = item["lat"]
            node.longitud = item["lon"]
            node.activo = True
            print(
                f"      {'+ Nodo creado' if node_created else '✓ Nodo ya existe'}: {item['node_name']}"
            )

        db.commit()
        print("\n✅ Seed completado exitosamente.\n")
        print("  Credenciales de acceso:")
        print("    Admin:    admin@sensores.com     / admin123")
        print("    Cliente:  alan2203mx@gmail.com   / 123")
        print(
            "    Simulador demo (API Key DEMO - Nogal Norte): 99189486-8181-4e8c-8c6d-b3da66e6712b"
        )
        print(
            "    Simulador productivo socio (API Key Nodo Granja Hogar): ak_partner_granja_hogar_001"
        )
        print(
            "    Simulador productivo socio (API Key Nodo Campus Reforestado): ak_partner_campus_reforestado_001\n"
        )

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
