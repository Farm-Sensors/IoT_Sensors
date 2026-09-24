"""Tests unitarios para app.services.reading."""

from datetime import date, datetime, timezone

import pytest
from fastapi import HTTPException

from app.schemas.reading import (
    EnvironmentalData,
    IrrigationData,
    ReadingCreate,
    SoilData,
)
from app.services import reading as reading_service


def _make_reading_payload(timestamp=None):
    return ReadingCreate(
        timestamp=timestamp or datetime(2026, 4, 1, 10, 0, 0, tzinfo=timezone.utc),
        soil=SoilData(conductivity=2.5, temperature=22.3, humidity=45.6, water_potential=-0.8),
        irrigation=IrrigationData(active=True, accumulated_liters=1250.0, flow_per_minute=8.3),
        environmental=EnvironmentalData(
            temperature=28.1,
            relative_humidity=55.0,
            wind_speed=12.5,
            solar_radiation=650.0,
            eto=5.2,
        ),
    )


class TestCreateReading:
    def test_create_success(self, db, sample_node):
        data = _make_reading_payload()
        reading = reading_service.create_reading(db, sample_node, data)
        assert reading.id is not None
        assert reading.nodo_id == sample_node.id
        assert float(reading.suelo_humedad) == 45.6
        assert float(reading.riego_flujo_por_minuto) == 8.3
        assert float(reading.ambiental_eto) == 5.2

    def test_create_with_null_fields(self, db, sample_node):
        """Campos no disponibles se almacenan como None."""
        data = ReadingCreate(
            timestamp=datetime(2026, 4, 1, 11, 0, 0, tzinfo=timezone.utc),
            soil=SoilData(
                conductivity=None, temperature=None, humidity=None, water_potential=None
            ),
            irrigation=IrrigationData(
                active=False, accumulated_liters=None, flow_per_minute=None
            ),
            environmental=EnvironmentalData(
                temperature=None,
                relative_humidity=None,
                wind_speed=None,
                solar_radiation=None,
                eto=None,
            ),
        )
        reading = reading_service.create_reading(db, sample_node, data)
        assert reading.suelo_humedad is None
        assert reading.ambiental_eto is None

    def test_timestamp_stored_correctly(self, db, sample_node):
        ts = datetime(2026, 4, 1, 12, 30, 0, tzinfo=timezone.utc)
        data = _make_reading_payload(timestamp=ts)
        reading = reading_service.create_reading(db, sample_node, data)
        # SQLite puede no preservar timezone, comparar naive
        assert reading.marca_tiempo.replace(tzinfo=None) == ts.replace(tzinfo=None)


class TestGetLatestReading:
    def test_latest_returns_most_recent(self, db, sample_node, sample_irrigation_area):
        t1 = datetime(2026, 4, 1, 8, 0, 0, tzinfo=timezone.utc)
        t2 = datetime(2026, 4, 1, 10, 0, 0, tzinfo=timezone.utc)
        reading_service.create_reading(db, sample_node, _make_reading_payload(t1))
        r2 = reading_service.create_reading(db, sample_node, _make_reading_payload(t2))
        latest = reading_service.get_latest_reading(db, sample_irrigation_area.id)
        assert latest is not None
        assert latest.id == r2.id

    def test_latest_no_readings_returns_none(self, db, sample_irrigation_area, sample_node):
        """Área con nodo asignado pero sin lecturas: retorna None."""
        result = reading_service.get_latest_reading(db, sample_irrigation_area.id)
        assert result is None

    def test_latest_invalid_area_raises_404(self, db):
        with pytest.raises(HTTPException) as exc:
            reading_service.get_latest_reading(db, 99999)
        assert exc.value.status_code == 404


class TestListReadings:
    def test_list_all_for_area(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(db, sample_node, _make_reading_payload())
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 4, 1, 12, 0, 0, tzinfo=timezone.utc)),
        )
        items, total = reading_service.list_readings(
            db, page=1, per_page=50, irrigation_area_id=sample_irrigation_area.id
        )
        assert total == 2

    def test_list_filter_by_start_date(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 3, 1, 10, 0, 0, tzinfo=timezone.utc)),
        )
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 4, 1, 10, 0, 0, tzinfo=timezone.utc)),
        )
        items, total = reading_service.list_readings(
            db, page=1, per_page=50,
            irrigation_area_id=sample_irrigation_area.id,
            start_date=date(2026, 4, 1),
        )
        assert total == 1

    def test_list_filter_by_end_date(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 3, 1, 10, 0, 0, tzinfo=timezone.utc)),
        )
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 4, 1, 10, 0, 0, tzinfo=timezone.utc)),
        )
        items, total = reading_service.list_readings(
            db, page=1, per_page=50,
            irrigation_area_id=sample_irrigation_area.id,
            end_date=date(2026, 3, 31),
        )
        assert total == 1

    def test_list_pagination(self, db, sample_node, sample_irrigation_area):
        for hour in range(5):
            reading_service.create_reading(
                db, sample_node,
                _make_reading_payload(datetime(2026, 4, 1, hour, 0, 0, tzinfo=timezone.utc)),
            )
        items, total = reading_service.list_readings(db, page=1, per_page=2)
        assert len(items) == 2
        assert total >= 5

    def test_list_filter_by_crop_cycle(self, db, sample_node, sample_irrigation_area, sample_crop_cycle):
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)),
        )
        reading_service.create_reading(
            db, sample_node,
            _make_reading_payload(datetime(2025, 6, 1, 10, 0, 0, tzinfo=timezone.utc)),  # fuera del ciclo
        )
        items, total = reading_service.list_readings(
            db, page=1, per_page=50, crop_cycle_id=sample_crop_cycle.id
        )
        assert total == 1


class TestExportReadings:
    def test_export_csv_returns_string(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(db, sample_node, _make_reading_payload())
        result = reading_service.export_readings_csv(
            db, irrigation_area_id=sample_irrigation_area.id
        )
        assert isinstance(result, str)
        assert "timestamp" in result  # header row
        assert "node_id" in result

    def test_export_csv_contains_data(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(db, sample_node, _make_reading_payload())
        result = reading_service.export_readings_csv(
            db, irrigation_area_id=sample_irrigation_area.id
        )
        lines = result.strip().split("\n")
        assert len(lines) == 2  # header + 1 data row

    def test_export_xlsx_returns_bytes(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(db, sample_node, _make_reading_payload())
        result = reading_service.export_readings_xlsx(
            db, irrigation_area_id=sample_irrigation_area.id
        )
        assert isinstance(result, bytes)
        # XLSX empieza con el magic bytes del ZIP (PK header)
        assert result[:2] == b"PK"

    def test_export_pdf_returns_bytes(self, db, sample_node, sample_irrigation_area):
        reading_service.create_reading(db, sample_node, _make_reading_payload())
        result = reading_service.export_readings_pdf(
            db, irrigation_area_id=sample_irrigation_area.id
        )
        assert isinstance(result, bytes)
        # PDF empieza con %PDF
        assert result[:4] == b"%PDF"
