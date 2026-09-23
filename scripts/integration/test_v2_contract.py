"""Contract regression tests independent of FastAPI, database and live credentials."""

import copy
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from validate_v2_contract import PACKAGE, Contract, credential_free, validate_package


class V2ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = Contract()
        cls.cases = {
            c["name"]: c
            for c in json.loads((PACKAGE / "fixtures/machine-cases.json").read_text())
        }

    def test_complete_package_and_frozen_v1(self):
        self.assertGreater(validate_package(), 30)

    def test_all_required_headers_are_enforced(self):
        schema = json.loads((PACKAGE / "machine.schema.json").read_text())
        for case in self.cases.values():
            if not case["valid"]:
                continue
            definition = self.contract.operations[case["operation"]]["headers"].split(
                "/"
            )[-1]
            for header in schema["$defs"][definition]["required"]:
                with self.subTest(operation=case["operation"], header=header):
                    changed = copy.deepcopy(case)
                    changed["request"]["headers"].pop(header)
                    with self.assertRaises(ValueError):
                        self.contract.case(changed)

    def test_headers_are_case_insensitive(self):
        case = copy.deepcopy(self.cases["telemetry"])
        case["request"]["headers"] = {
            k.lower(): v for k, v in case["request"]["headers"].items()
        }
        self.contract.case(case)

    def test_confirmation_requires_selected_candidate_path(self):
        for parameters in ({}, {"candidate_id": "0"}, {"candidate_id": "uid-fixture"}):
            case = copy.deepcopy(self.cases["confirmation"])
            case["request"]["path_parameters"] = parameters
            with self.assertRaises(ValueError):
                self.contract.case(case)

    def test_duplicate_case_insensitive_header_is_rejected(self):
        case = copy.deepcopy(self.cases["heartbeat"])
        case["request"]["headers"]["x-api-key"] = "<gateway-credential>"
        with self.assertRaises(ValueError):
            self.contract.case(case)

    def test_both_revisions_required_for_304(self):
        for config_version in (None, "3", "4", "5"):
            for binding_revision in (None, "8", "9", "10"):
                case = copy.deepcopy(self.cases["configuration-current"])
                case["request"]["headers"] = {"X-API-Key": "<gateway-credential>"}
                for name, value in [
                    ("X-Config-Version", config_version),
                    ("X-Bindings-Revision", binding_revision),
                ]:
                    if value is not None:
                        case["request"]["headers"][name] = value
                if (config_version, binding_revision) == ("4", "9"):
                    self.contract.case(case)
                else:
                    with self.assertRaises(ValueError):
                        self.contract.case(case)
                    case["response"] = copy.deepcopy(
                        self.cases["configuration-full"]["response"]
                    )
                    self.contract.case(case)

    def test_zero_null_false_and_exact_twelve_fields(self):
        body = copy.deepcopy(self.cases["telemetry"]["request"]["body"])
        self.assertEqual(
            sum(len(body[k]) for k in ("soil", "irrigation", "environmental")), 12
        )
        for category in ("soil", "irrigation", "environmental"):
            for field in body[category]:
                for value in (None, False) if field == "active" else (None, 0):
                    changed = copy.deepcopy(body)
                    changed[category][field] = value
                    self.contract.validate("telemetry.schema.json", changed)
                changed = copy.deepcopy(body)
                del changed[category][field]
                with self.assertRaises(ValueError):
                    self.contract.validate("telemetry.schema.json", changed)
                changed = copy.deepcopy(body)
                changed[category][field] = 0 if field == "active" else False
                with self.assertRaises(ValueError):
                    self.contract.validate("telemetry.schema.json", changed)

    def test_invalid_calendar_date_is_rejected(self):
        body = copy.deepcopy(self.cases["telemetry"]["request"]["body"])
        for timestamp in (
            "2026-02-30T00:00:00Z",
            "not-a-dateZ",
            "2026-09-23T00:00:00z",
        ):
            body["timestamp"] = timestamp
            with self.assertRaises(ValueError):
                self.contract.validate("telemetry.schema.json", body)

    def test_all_documented_errors_use_common_envelope(self):
        for name, operation in self.contract.operations.items():
            case = next(
                copy.deepcopy(c)
                for c in self.cases.values()
                if c["operation"] == name and c["valid"]
            )
            for status in operation["errors"]:
                case["response"] = {
                    "status": status,
                    "body": {"code": "machine_error_code", "message": "Safe message"},
                }
                self.contract.case(case)
                case["response"]["body"]["credential"] = "<gateway-credential>"
                with self.assertRaises(ValueError):
                    self.contract.case(case)

    def test_overlay_preserves_slot_identity_and_binding_state(self):
        for mutate in (
            lambda body: body["binding_overlay"]["slots"][0].update(
                logical_node_id=999
            ),
            lambda body: body["binding_overlay"]["slots"][0].update(
                binding_status="confirmed"
            ),
            lambda body: body["configuration"].update(property_id=999),
        ):
            case = copy.deepcopy(self.cases["configuration-full"])
            mutate(case["response"]["body"])
            with self.assertRaises(ValueError):
                self.contract.case(case)

    def test_response_node_and_capture_time_match_request(self):
        for field, value in [("node_id", 999), ("timestamp", "2026-01-01T00:00:00Z")]:
            case = copy.deepcopy(self.cases["telemetry"])
            case["response"]["body"][field] = value
            with self.assertRaises(ValueError):
                self.contract.case(case)

    def test_fixtures_never_contain_issued_material(self):
        for value in (
            {"credential": "gk_secret"},
            {"activation_reference": "ar_secret"},
            {"nested": ["eyJsecret"]},
        ):
            with self.assertRaises(ValueError):
                credential_free(value)

    def test_corruption_missing_files_and_v1_edits_fail_closed(self):
        for relative in (
            "v2/telemetry.schema.json",
            "v2/fixtures/machine-cases.json",
            "v1/README.md",
        ):
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                shutil.copytree(PACKAGE.parent, root / "edge-cloud")
                target = root / "edge-cloud" / relative
                target.write_text(target.read_text() + "\n")
                with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
                    validate_package(root / "edge-cloud/v2")
                target.unlink()
                with self.assertRaises(ValueError):
                    validate_package(root / "edge-cloud/v2")

    def test_unlisted_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "edge-cloud"
            shutil.copytree(PACKAGE.parent, root)
            (root / "v2/unreviewed.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "every package file"):
                validate_package(root / "v2")

    def test_recomputed_checksum_does_not_hide_incomplete_operation_catalog(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "edge-cloud"
            shutil.copytree(PACKAGE.parent, root)
            package = root / "v2"
            operations = json.loads((package / "operations.json").read_text())
            del operations["heartbeat"]
            (package / "operations.json").write_text(json.dumps(operations))
            manifest = package / "SHA256SUMS"
            manifest.write_text(
                "".join(
                    f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(package).as_posix()}\n"
                    for p in sorted(package.rglob("*"))
                    if p.is_file() and p != manifest
                )
            )
            with self.assertRaisesRegex(ValueError, "Incomplete operation catalog"):
                validate_package(package)


if __name__ == "__main__":
    unittest.main()
